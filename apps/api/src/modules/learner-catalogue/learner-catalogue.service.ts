import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContentLifecycle,
  CourseCommercialMode,
  Prisma,
  ResourceKind,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ContentAccessService } from '../content-access/content-access.service';
import { ResourcesService } from '../resources/resources.service';
import { LessonProgressDto } from './dto/learning.dto';
import { parseCursorTake, toPage } from '../../common/utils/pagination';
import { resolveCommercialAccess } from '../../common/utils/content-access';

const published = { lifecycle: ContentLifecycle.published };

/** Draft lessons on a live course were invisible in the app, including previews. */
const visibleLesson = {
  lifecycle: {
    notIn: [ContentLifecycle.unpublished, ContentLifecycle.archived],
  },
};

const lessonFields = {
  id: true,
  courseId: true,
  title: true,
  description: true,
  sortOrder: true,
  durationMinutes: true,
  contentType: true,
  isPreview: true,
  mediaUrl: true,
} satisfies Prisma.LessonSelect;

const courseListSelect = {
  id: true,
  slug: true,
  title: true,
  shortTitle: true,
  summary: true,
  description: true,
  commercialMode: true,
  deliveryType: true,
  estimatedMinutes: true,
  coverImageUrl: true,
  iconUrl: true,
} satisfies Prisma.CourseSelect;

@Injectable()
export class LearnerCatalogueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ContentAccessService,
    private readonly resources: ResourcesService,
  ) {}

  private directPlayback(url: string | null | undefined) {
    const value = url?.trim() ?? '';
    if (!/^https?:\/\//i.test(value)) return null;
    return {
      type: value.includes('.m3u8') ? 'hls' : 'progressive_mp4',
      url: value,
      fallbackUrl: null as string | null,
      expiresInSeconds: null as number | null,
    };
  }

  /**
   * Attach the lesson video. Playback is included for a preview lesson, and
   * for every lesson when the viewer already has the course.
   */
  private async presentLessons<
    T extends {
      id: string;
      isPreview: boolean;
      mediaUrl: string | null;
    },
  >(lessons: T[], courseGranted: boolean) {
    const ids = lessons.map((lesson) => lesson.id);
    const videos =
      ids.length === 0
        ? []
        : await this.prisma.resource.findMany({
            where: {
              lessonId: { in: ids },
              kind: ResourceKind.video,
              lifecycle: {
                notIn: [
                  ContentLifecycle.unpublished,
                  ContentLifecycle.archived,
                ],
              },
            },
            include: { mediaAsset: true },
            orderBy: { createdAt: 'asc' },
          });
    const byLesson = new Map<string, typeof videos>();
    for (const video of videos) {
      if (!video.lessonId) continue;
      const list = byLesson.get(video.lessonId) ?? [];
      list.push(video);
      byLesson.set(video.lessonId, list);
    }

    return Promise.all(
      lessons.map(async (lesson) => {
        const attached = byLesson.get(lesson.id) ?? [];
        const playableFlags = await Promise.all(
          attached.map((video) => this.resources.playbackForResource(video)),
        );
        const playableIndex = playableFlags.findIndex((item) => item);
        const video =
          (playableIndex >= 0 ? attached[playableIndex] : attached[0]) ?? null;
        const preview = lesson.isPreview || Boolean(video?.previewAllowed);
        const playback =
          (playableIndex >= 0 ? playableFlags[playableIndex] : null) ??
          this.directPlayback(lesson.mediaUrl);
        const { mediaUrl, ...safe } = lesson;
        return {
          ...safe,
          isPreview: preview,
          hasMedia: Boolean(video || mediaUrl),
          resourceId: video?.id ?? null,
          playback: courseGranted || preview ? playback : null,
        };
      }),
    );
  }

  private window(now = new Date()) {
    return {
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      ],
    };
  }

  private async courseAccess(
    courseId: string,
    commercialMode: CourseCommercialMode,
    learnerId?: string,
  ) {
    if (learnerId) {
      const decision = await this.access.resolveCourseAccess(
        learnerId,
        courseId,
      );
      const reason =
        decision.reason === 'entitlement_required'
          ? 'purchase_required'
          : decision.reason;
      return {
        granted: decision.granted,
        canPreview: decision.canPreview,
        canDownload: decision.canDownload,
        reason,
        source: decision.source,
      };
    }
    return resolveCommercialAccess(commercialMode, { learnerId: null });
  }

  async home(learnerId?: string) {
    const now = new Date();
    const [bannerRows, sections, featuredCourses, continuing] =
      await Promise.all([
        this.prisma.banner.findMany({
          where: {
            lifecycle: ContentLifecycle.published,
            placement: 'hero',
            imageUrl: { not: null },
            ...this.window(now),
          },
          orderBy: [{ priority: 'desc' }, { publishedAt: 'desc' }],
          take: 8,
        }),
        this.prisma.exploreSection.findMany({
          where: {
            lifecycle: ContentLifecycle.published,
            homeVisible: true,
            ...this.window(now),
          },
          orderBy: { sortOrder: 'asc' },
        }),
        this.prisma.course.findMany({
          where: {
            ...published,
            featured: true,
            commercialMode: { not: CourseCommercialMode.hidden_internal },
          },
          orderBy: { publishedAt: 'desc' },
          take: 8,
          select: courseListSelect,
        }),
        learnerId
          ? this.prisma.lessonProgress.findMany({
              where: { learnerId, status: { not: 'completed' } },
              include: {
                lesson: {
                  select: {
                    id: true,
                    title: true,
                    courseId: true,
                    course: { select: { title: true } },
                  },
                },
              },
              orderBy: { updatedAt: 'desc' },
              take: 5,
            })
          : Promise.resolve([]),
      ]);

    const banners = bannerRows
      .filter(
        (b) => typeof b.imageUrl === 'string' && b.imageUrl.trim().length > 0,
      )
      .map((b) => ({
        ...b,
        targetKind: b.targetKind?.trim() ? b.targetKind : null,
        targetRef: b.targetRef?.trim() ? b.targetRef : null,
      }));

    return {
      banners,
      sections,
      featuredCourses,
      continuing: continuing.map((row) => ({
        lessonId: row.lessonId,
        title: row.lesson.title,
        courseId: row.lesson.courseId,
        courseTitle: row.lesson.course.title,
        progressPct: row.progressPct,
      })),
    };
  }

  async listCourses(opts: {
    search?: string;
    pricing?: string;
    cursor?: string;
    learnerId?: string;
  }) {
    const { take, pageSize, ...cursorArgs } = parseCursorTake(opts.cursor);
    const search = opts.search?.trim();
    const pricing = opts.pricing?.trim().toLowerCase();

    const commercialModeFilter: Prisma.CourseWhereInput['commercialMode'] =
      pricing === 'free'
        ? CourseCommercialMode.free
        : pricing === 'paid'
          ? {
              notIn: [
                CourseCommercialMode.free,
                CourseCommercialMode.hidden_internal,
              ],
            }
          : { not: CourseCommercialMode.hidden_internal };

    const where: Prisma.CourseWhereInput = {
      ...published,
      commercialMode: commercialModeFilter,
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { summary: { contains: search, mode: 'insensitive' } },
              { shortTitle: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        ...cursorArgs,
        take,
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        select: courseListSelect,
      }),
      this.prisma.course.count({ where }),
    ]);

    const page = toPage(rows, pageSize, total);
    const items = await Promise.all(
      page.items.map(async (course) => ({
        ...course,
        access: await this.courseAccess(
          course.id,
          course.commercialMode,
          opts.learnerId,
        ),
      })),
    );
    return { ...page, items };
  }

  categories() {
    return this.prisma.exploreSection.findMany({
      where: { lifecycle: ContentLifecycle.published, ...this.window() },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async search(q: string) {
    const query = q.trim();
    if (!query) return { courses: [], lessons: [] };
    const [courses, lessons] = await Promise.all([
      this.prisma.course.findMany({
        where: {
          ...published,
          OR: [
            { title: { contains: query } },
            { summary: { contains: query } },
            { slug: { contains: query } },
          ],
        },
        take: 20,
        select: {
          id: true,
          slug: true,
          title: true,
          summary: true,
          commercialMode: true,
        },
      }),
      this.prisma.lesson.findMany({
        where: {
          lifecycle: ContentLifecycle.published,
          title: { contains: query },
          course: published,
        },
        take: 20,
        select: {
          id: true,
          title: true,
          courseId: true,
          course: { select: { title: true } },
        },
      }),
    ]);
    return { courses, lessons };
  }

  async getCourse(id: string, learnerId?: string) {
    const course = await this.prisma.course.findFirst({
      where: {
        id,
        ...published,
        commercialMode: { not: CourseCommercialMode.hidden_internal },
      },
      include: {
        lessons: {
          where: visibleLesson,
          orderBy: { sortOrder: 'asc' },
          select: lessonFields,
        },
      },
    });
    if (!course) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Course ${id} not found`,
        fieldErrors: {},
      });
    }
    const access = await this.courseAccess(
      id,
      course.commercialMode,
      learnerId,
    );
    const lessons = await this.presentLessons(course.lessons, access.granted);
    return { ...course, lessons, access };
  }

  async enroll(courseId: string, learnerId: string) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, ...published },
    });
    if (!course) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Course not found',
        fieldErrors: {},
      });
    }
    const access = await this.access.resolveCourseAccess(learnerId, courseId);
    const free = course.commercialMode === CourseCommercialMode.free;
    if (!free && !access.granted) {
      throw new ForbiddenException({
        code: 'ACCESS_DENIED',
        message: access.reason ?? 'Enrollment requires an active entitlement',
        fieldErrors: {},
      });
    }
    return this.prisma.enrollment.upsert({
      where: { learnerId_courseId: { learnerId, courseId } },
      create: {
        learnerId,
        courseId,
        source: free ? 'self_enroll' : 'entitlement',
        status: 'active',
      },
      update: { status: 'active' },
    });
  }

  async getLessons(courseId: string, learnerId?: string) {
    const course = await this.getCourse(courseId, learnerId);
    return course.lessons;
  }

  async getLesson(id: string, learnerId?: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id, ...visibleLesson, course: published },
      select: {
        ...lessonFields,
        course: { select: { id: true, commercialMode: true } },
      },
    });
    if (!lesson) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Lesson ${id} not found`,
        fieldErrors: {},
      });
    }
    const access = await this.courseAccess(
      lesson.course.id,
      lesson.course.commercialMode,
      learnerId,
    );
    const {
      id,
      courseId,
      title,
      description,
      sortOrder,
      durationMinutes,
      contentType,
      isPreview,
      mediaUrl,
    } = lesson;
    const [presented] = await this.presentLessons(
      [
        {
          id,
          courseId,
          title,
          description,
          sortOrder,
          durationMinutes,
          contentType,
          isPreview,
          mediaUrl,
        },
      ],
      access.granted,
    );
    return presented;
  }

  async saveProgress(
    lessonId: string,
    learnerId: string,
    dto: LessonProgressDto,
  ) {
    await this.getLesson(lessonId);
    return this.prisma.lessonProgress.upsert({
      where: { learnerId_lessonId: { learnerId, lessonId } },
      create: {
        learnerId,
        lessonId,
        status: 'in_progress',
        progressPct: dto.progressPct ?? 0,
        positionSeconds: dto.positionSeconds,
      },
      update: {
        progressPct: dto.progressPct,
        positionSeconds: dto.positionSeconds,
        status: 'in_progress',
      },
    });
  }

  async completeLesson(lessonId: string, learnerId: string) {
    await this.getLesson(lessonId);
    return this.prisma.lessonProgress.upsert({
      where: { learnerId_lessonId: { learnerId, lessonId } },
      create: {
        learnerId,
        lessonId,
        status: 'completed',
        progressPct: 100,
        completedAt: new Date(),
      },
      update: {
        status: 'completed',
        progressPct: 100,
        completedAt: new Date(),
      },
    });
  }

  myEnrollments(learnerId: string) {
    return this.prisma.enrollment.findMany({
      where: { learnerId },
      include: {
        course: {
          select: { id: true, title: true, slug: true, lifecycle: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  myEntitlements(learnerId: string) {
    return this.prisma.entitlement.findMany({
      where: { learnerId },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
