import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContentLifecycle, AuditSeverity } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
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
  ) {}

  findAll() {
    return this.prisma.course.findMany({
      include: {
        _count: { select: { lessons: true, enrollments: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        lessons: { orderBy: { sortOrder: 'asc' } },
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
    const course = await this.prisma.course.create({
      data: {
        slug: dto.slug,
        title: dto.title,
        shortTitle: dto.shortTitle,
        summary: dto.summary,
        description: dto.description,
        deliveryType: dto.deliveryType,
        commercialMode: dto.commercialMode,
        featured: dto.featured ?? false,
        estimatedMinutes: dto.estimatedMinutes,
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
    const course = await this.prisma.course.update({
      where: { id },
      data: {
        title: dto.title,
        shortTitle: dto.shortTitle,
        summary: dto.summary,
        description: dto.description,
        deliveryType: dto.deliveryType,
        commercialMode: dto.commercialMode,
        featured: dto.featured,
        estimatedMinutes: dto.estimatedMinutes,
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
      throw new BadRequestException({
        code: 'COURSE_INVALID',
        message: 'Cannot publish a course with no lessons',
        fieldErrors: {},
      });
    }
    const course = await this.prisma.course.update({
      where: { id },
      data: {
        lifecycle: ContentLifecycle.published,
        publishedAt: new Date(),
        revision: { increment: 1 },
      },
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
    await this.findOne(courseId);
    const lesson = await this.prisma.lesson.create({
      data: {
        courseId,
        title: dto.title,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
        durationMinutes: dto.durationMinutes,
        contentType: dto.contentType ?? 'video',
        isPreview: dto.isPreview ?? false,
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
}
