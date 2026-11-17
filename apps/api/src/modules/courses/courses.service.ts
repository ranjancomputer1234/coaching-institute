import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditSeverity,
  ContentLifecycle,
  CourseCommercialMode,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CloudinaryService } from '../resources/cloudinary.service';
import {
  CreateCourseDto,
  CreateLessonDto,
  UpdateCourseDto,
} from './dto/course.dto';

type Actor = { userId: string; email?: string };

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  imageUploadSlot() {
    return this.cloudinary.createSignedImageUpload();
  }

  private courseInvalid(message: string) {
    return new BadRequestException({
      code: 'COURSE_INVALID',
      message,
      fieldErrors: {},
    });
  }

  private resolvePricePaise(
    commercialMode: CourseCommercialMode,
    pricePaise: number | null | undefined,
    options?: { requireWhenPaid?: boolean },
  ): number | null {
    if (commercialMode === CourseCommercialMode.free) {
      return null;
    }
    const paise = pricePaise ?? null;
    if (commercialMode === CourseCommercialMode.paid) {
      if (options?.requireWhenPaid && (paise === null || paise < 100)) {
        throw this.courseInvalid(
          'Paid courses require pricePaise of at least 100',
        );
      }
      if (paise !== null && paise < 100) {
        throw this.courseInvalid('pricePaise must be at least 100');
      }
    }
    return paise;
  }

  findAll() {
    return this.prisma.course.findMany({
      include: {
        _count: { select: { lessons: true, enrollments: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        lessons: { orderBy: { sortOrder: 'asc' } },
        semesters: {
          orderBy: { index: 'asc' },
          select: { id: true, index: true, title: true },
        },
        _count: { select: { enrollments: true } },
      },
    });
    if (!course) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Course ${id} not found`,
        fieldErrors: {},
      });
    }
    return course;
  }

  async create(dto: CreateCourseDto, actor: Actor) {
    const commercialMode = dto.commercialMode ?? CourseCommercialMode.free;
    const pricePaise = this.resolvePricePaise(commercialMode, dto.pricePaise, {
      requireWhenPaid: commercialMode === CourseCommercialMode.paid,
    });
    const course = await this.prisma.course.create({
      data: {
        slug: dto.slug,
        title: dto.title,
        shortTitle: dto.shortTitle,
        summary: dto.summary,
        description: dto.description,
        deliveryType: dto.deliveryType,
        commercialMode,
        featured: dto.featured ?? false,
        estimatedMinutes: dto.estimatedMinutes,
        pricePaise,
        sortOrder: dto.sortOrder,
        coverImageUrl: dto.coverImageUrl,
        iconUrl: dto.iconUrl,
        lifecycle: ContentLifecycle.draft,
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'course.create',
      resourceType: 'Course',
      resourceId: course.id,
      after: course,
    });
    return course;
  }

  async update(id: string, dto: UpdateCourseDto, actor: Actor) {
    const before = await this.findOne(id);
    const commercialMode = dto.commercialMode ?? before.commercialMode;
    const priceInput =
      dto.pricePaise !== undefined ? dto.pricePaise : before.pricePaise;
    const pricePaise = this.resolvePricePaise(commercialMode, priceInput, {
      requireWhenPaid: commercialMode === CourseCommercialMode.paid,
    });
    const course = await this.prisma.course.update({
      where: { id },
      data: {
        title: dto.title,
        shortTitle: dto.shortTitle,
        summary: dto.summary,
        description: dto.description,
        deliveryType: dto.deliveryType,
        commercialMode,
        featured: dto.featured,
        estimatedMinutes: dto.estimatedMinutes,
        pricePaise,
        sortOrder: dto.sortOrder,
        coverImageUrl: dto.coverImageUrl,
        iconUrl: dto.iconUrl,
        revision: { increment: 1 },
      },
      include: { lessons: { orderBy: { sortOrder: 'asc' } } },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'course.update',
      resourceType: 'Course',
      resourceId: id,
      before: { title: before.title, revision: before.revision },
      after: { title: course.title, revision: course.revision },
    });
    return course;
  }

  async publish(id: string, actor: Actor) {
    const before = await this.findOne(id);
    if (before.lessons.length === 0) {
      throw this.courseInvalid('Cannot publish a course with no lessons');
    }
    if (
      before.commercialMode === CourseCommercialMode.paid &&
      (!before.pricePaise || before.pricePaise < 100)
    ) {
      throw this.courseInvalid(
        'Paid courses require a valid price before publish',
      );
    }
    const course = await this.prisma.course.update({
      where: { id },
      data: {
        lifecycle: ContentLifecycle.published,
        publishedAt: new Date(),
        revision: { increment: 1 },
      },
    });
    await this.prisma.lesson.updateMany({
      where: {
        courseId: id,
        lifecycle: {
          notIn: [ContentLifecycle.unpublished, ContentLifecycle.archived],
        },
      },
      data: { lifecycle: ContentLifecycle.published },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'course.publish',
      resourceType: 'Course',
      resourceId: id,
      before: { lifecycle: before.lifecycle },
      after: { lifecycle: course.lifecycle },
      severity: AuditSeverity.notice,
    });
    return course;
  }

  async reorder(orderedIds: string[], actor: Actor) {
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.course.update({
          where: { id },
          data: { sortOrder: (index + 1) * 10, revision: { increment: 1 } },
        }),
      ),
    );
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'course.reorder',
      resourceType: 'Course',
      after: { orderedIds },
      severity: AuditSeverity.notice,
    });
    return this.findAll();
  }

  async unpublish(id: string, actor: Actor) {
    const before = await this.findOne(id);
    const course = await this.prisma.course.update({
      where: { id },
      data: {
        lifecycle: ContentLifecycle.unpublished,
        revision: { increment: 1 },
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'course.unpublish',
      resourceType: 'Course',
      resourceId: id,
      before: { lifecycle: before.lifecycle },
      after: { lifecycle: course.lifecycle },
      severity: AuditSeverity.notice,
    });
    return course;
  }

  async addLesson(courseId: string, dto: CreateLessonDto, actor: Actor) {
    const course = await this.findOne(courseId);
    let sortOrder = dto.sortOrder;
    if (sortOrder === undefined) {
      const last = await this.prisma.lesson.aggregate({
        where: { courseId },
        _max: { sortOrder: true },
      });
      sortOrder = (last._max.sortOrder ?? -1) + 1;
    }
    const lesson = await this.prisma.lesson.create({
      data: {
        courseId,
        title: dto.title,
        description: dto.description,
        sortOrder,
        durationMinutes: dto.durationMinutes,
        contentType: dto.contentType ?? 'video',
        isPreview: dto.isPreview ?? false,
        lifecycle:
          course.lifecycle === ContentLifecycle.published
            ? ContentLifecycle.published
            : ContentLifecycle.draft,
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'lesson.create',
      resourceType: 'Lesson',
      resourceId: lesson.id,
      after: lesson,
    });
    return lesson;
  }

  async publishLesson(courseId: string, lessonId: string, actor: Actor) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, courseId },
    });
    if (!lesson) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Lesson ${lessonId} not found on course ${courseId}`,
        fieldErrors: {},
      });
    }
    if (
      lesson.lifecycle === ContentLifecycle.archived ||
      lesson.lifecycle === ContentLifecycle.unpublished
    ) {
      throw new BadRequestException({
        code: 'LESSON_INVALID',
        message: `Cannot publish a lesson in ${lesson.lifecycle} state`,
        fieldErrors: {},
      });
    }
    if (lesson.lifecycle === ContentLifecycle.published) {
      return lesson;
    }
    const updated = await this.prisma.lesson.update({
      where: { id: lessonId },
      data: { lifecycle: ContentLifecycle.published },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'lesson.publish',
      resourceType: 'Lesson',
      resourceId: lessonId,
      before: { lifecycle: lesson.lifecycle },
      after: { lifecycle: updated.lifecycle },
      severity: AuditSeverity.notice,
    });
    return updated;
  }
}
