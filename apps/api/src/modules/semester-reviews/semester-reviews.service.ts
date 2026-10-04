import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditSeverity,
  ProjectSubmissionStatus,
  SemesterStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateSemesterDto,
  SemesterDecisionDto,
} from '../projects/dto/project.dto';

type Actor = { userId: string; email?: string };

@Injectable()
export class SemesterReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listSemesters(courseId?: string) {
    return this.prisma.semesterDefinition.findMany({
      where: courseId ? { courseId } : undefined,
      include: {
        course: { select: { id: true, title: true } },
        _count: { select: { projects: true, reviews: true } },
      },
      orderBy: [{ courseId: 'asc' }, { index: 'asc' }],
    });
  }

  listPending() {
    return this.prisma.semesterReview.findMany({
      where: { status: SemesterStatus.pending_review },
      include: {
        semester: true,
        enrollment: {
          include: {
            learner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            course: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createSemester(dto: CreateSemesterDto, actor: Actor) {
    const semester = await this.prisma.semesterDefinition.create({
      data: {
        courseId: dto.courseId,
        title: dto.title,
        index: Number(dto.index),
        description: dto.description,
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'semester.create',
      resourceType: 'SemesterDefinition',
      resourceId: semester.id,
      after: semester,
    });
    return semester;
  }

  async submitReview(
    enrollmentId: string,
    semesterId: string,
    actor: Actor,
  ) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { learner: true, course: true },
    });
    if (!enrollment) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Enrollment not found',
        fieldErrors: {},
      });
    }
    const semester = await this.prisma.semesterDefinition.findUnique({
      where: { id: semesterId },
      include: { projects: true },
    });
    if (!semester || semester.courseId !== enrollment.courseId) {
      throw new BadRequestException({
        code: 'INVALID_SEMESTER',
        message: 'Semester does not belong to enrollment course',
        fieldErrors: {},
      });
    }

    const projects = semester.projects;
    const accepted = await this.prisma.projectSubmission.findMany({
      where: {
        learnerId: enrollment.learnerId,
        projectId: { in: projects.map((p) => p.id) },
        status: ProjectSubmissionStatus.accepted,
      },
    });
    const checklist = {
      requiredProjects: projects.length,
      acceptedProjects: accepted.length,
      projectsComplete:
        projects.length === 0 || accepted.length >= projects.length,
      entitlementValid: enrollment.status === 'active',
    };

    if (!checklist.projectsComplete) {
      throw new BadRequestException({
        code: 'REQUIREMENTS_INCOMPLETE',
        message: 'Required projects are not all accepted',
        fieldErrors: {},
        checklist,
      });
    }

    const existing = await this.prisma.semesterReview.findFirst({
      where: {
        enrollmentId,
        semesterId,
        status: SemesterStatus.pending_review,
      },
    });
    if (existing) {
      return existing;
    }

    const review = await this.prisma.$transaction(async (tx) => {
      await tx.semesterProgress.upsert({
        where: {
          enrollmentId_semesterId: { enrollmentId, semesterId },
        },
        create: {
          enrollmentId,
          semesterId,
          learnerId: enrollment.learnerId,
          status: SemesterStatus.pending_review,
        },
        update: { status: SemesterStatus.pending_review },
      });
      return tx.semesterReview.create({
        data: {
          enrollmentId,
          semesterId,
          status: SemesterStatus.pending_review,
          checklistJson: JSON.stringify(checklist),
        },
      });
    });

    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'semester.submit_review',
      resourceType: 'SemesterReview',
      resourceId: review.id,
      after: checklist,
    });
    return review;
  }

  async approve(id: string, dto: SemesterDecisionDto, actor: Actor) {
    const review = await this.prisma.semesterReview.findUnique({
      where: { id },
      include: { semester: true, enrollment: true },
    });
    if (!review) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Review ${id} not found`,
        fieldErrors: {},
      });
    }
    if (review.status !== SemesterStatus.pending_review) {
      // idempotent if already approved
      if (review.status === SemesterStatus.approved) {
        return review;
      }
      throw new BadRequestException({
        code: 'SEMESTER_REVIEW_CONFLICT',
        message: 'This semester was already reviewed.',
        fieldErrors: {},
      });
    }

    const nextSemester = await this.prisma.semesterDefinition.findFirst({
      where: {
        courseId: review.semester.courseId,
        index: review.semester.index + 1,
      },
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const decided = await tx.semesterReview.update({
        where: { id },
        data: {
          status: SemesterStatus.approved,
          learnerFeedback: dto.learnerFeedback,
          internalNotes: dto.internalNotes,
          reviewerId: actor.userId,
          decidedAt: new Date(),
        },
      });
      await tx.semesterProgress.upsert({
        where: {
          enrollmentId_semesterId: {
            enrollmentId: review.enrollmentId,
            semesterId: review.semesterId,
          },
        },
        create: {
          enrollmentId: review.enrollmentId,
          semesterId: review.semesterId,
          learnerId: review.enrollment.learnerId,
          status: nextSemester
            ? SemesterStatus.approved
            : SemesterStatus.course_complete,
        },
        update: {
          status: nextSemester
            ? SemesterStatus.approved
            : SemesterStatus.course_complete,
        },
      });
      if (nextSemester) {
        await tx.semesterProgress.upsert({
          where: {
            enrollmentId_semesterId: {
              enrollmentId: review.enrollmentId,
              semesterId: nextSemester.id,
            },
          },
          create: {
            enrollmentId: review.enrollmentId,
            semesterId: nextSemester.id,
            learnerId: review.enrollment.learnerId,
            status: SemesterStatus.available,
          },
          update: { status: SemesterStatus.available },
        });
      }
      return decided;
    });

    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'semester.approve',
      resourceType: 'SemesterReview',
      resourceId: id,
      after: {
        unlockedSemesterId: nextSemester?.id ?? null,
        courseComplete: !nextSemester,
      },
      reason: dto.reason,
      severity: AuditSeverity.high,
    });
    return updated;
  }

  async requestChanges(id: string, dto: SemesterDecisionDto, actor: Actor) {
    if (!dto.learnerFeedback?.trim()) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Feedback is required.',
        fieldErrors: { learnerFeedback: ['Feedback is required.'] },
      });
    }
    const review = await this.prisma.semesterReview.findUnique({
      where: { id },
      include: { enrollment: true },
    });
    if (!review) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Review ${id} not found`,
        fieldErrors: {},
      });
    }
    if (review.status !== SemesterStatus.pending_review) {
      throw new BadRequestException({
        code: 'SEMESTER_REVIEW_CONFLICT',
        message: 'This semester was already reviewed.',
        fieldErrors: {},
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const decided = await tx.semesterReview.update({
        where: { id },
        data: {
          status: SemesterStatus.changes_required,
          learnerFeedback: dto.learnerFeedback,
          internalNotes: dto.internalNotes,
          reviewerId: actor.userId,
          decidedAt: new Date(),
        },
      });
      await tx.semesterProgress.updateMany({
        where: {
          enrollmentId: review.enrollmentId,
          semesterId: review.semesterId,
        },
        data: { status: SemesterStatus.changes_required },
      });
      return decided;
    });

    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'semester.request_changes',
      resourceType: 'SemesterReview',
      resourceId: id,
      severity: AuditSeverity.notice,
    });
    return updated;
  }
}
