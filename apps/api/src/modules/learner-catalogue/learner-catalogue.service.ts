import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContentLifecycle, CourseCommercialMode } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ContentAccessService } from '../content-access/content-access.service';
import { LessonProgressDto } from './dto/learning.dto';

const published = { lifecycle: ContentLifecycle.published };

@Injectable()
export class LearnerCatalogueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ContentAccessService,
  ) {}

  private window(now = new Date()) {
    return {
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      ],
    };
  }

  async home(learnerId?: string) {
    const now = new Date();
    const [banners, sections, featuredCourses, continuing] = await Promise.all([
      this.prisma.banner.findMany({
        where: { lifecycle: ContentLifecycle.published, ...this.window(now) },
        orderBy: [{ priority: 'asc' }, { publishedAt: 'desc' }],
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
        where: { ...published, featured: true },
        orderBy: { publishedAt: 'desc' },
        take: 8,
        select: {
          id: true,
          slug: true,
          title: true,
          shortTitle: true,
          summary: true,
          commercialMode: true,
          estimatedMinutes: true,
          coverImageUrl: true,
        },
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
      where: { id, ...published },
      include: {
        lessons: {
          where: published,
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            sortOrder: true,
            durationMinutes: true,
            contentType: true,
            isPreview: true,
          },
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
    const access = learnerId
      ? await this.access.resolveCourseAccess(learnerId, id)
      : null;
    return { ...course, access };
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

  async getLessons(courseId: string) {
    await this.getCourse(courseId);
    return this.prisma.lesson.findMany({
      where: { courseId, ...published },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        sortOrder: true,
        durationMinutes: true,
        contentType: true,
        isPreview: true,
      },
    });
  }

  async getLesson(id: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id, ...published, course: published },
      select: {
        id: true,
        courseId: true,
        title: true,
        description: true,
        sortOrder: true,
        durationMinutes: true,
        contentType: true,
        isPreview: true,
        mediaUrl: true,
      },
    });
    if (!lesson) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Lesson ${id} not found`,
        fieldErrors: {},
      });
    }
    const { mediaUrl, ...safe } = lesson;
    return { ...safe, hasMedia: Boolean(mediaUrl) };
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
