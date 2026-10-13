import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditSeverity,
  ContentLifecycle,
  ProjectSubmissionStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateProjectDto,
  CreateSubmissionDto,
  ReviewSubmissionDto,
} from './dto/project.dto';

type Actor = { userId: string; email?: string };

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.project.findMany({
      include: {
        course: { select: { id: true, title: true } },
        semester: { select: { id: true, title: true, index: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  listSubmissions(status?: ProjectSubmissionStatus) {
    return this.prisma.projectSubmission.findMany({
      where: status
        ? { status }
        : { status: ProjectSubmissionStatus.submitted },
      include: {
        project: { select: { id: true, title: true } },
        learner: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        reviews: { orderBy: { reviewedAt: 'desc' } },
      },
      orderBy: { submittedAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        submissions: {
          include: {
            learner: true,
            reviews: { orderBy: { reviewedAt: 'desc' } },
          },
          orderBy: { submittedAt: 'desc' },
        },
      },
    });
    if (!project) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Project ${id} not found`,
        fieldErrors: {},
      });
    }
    return project;
  }

  async create(dto: CreateProjectDto, actor: Actor) {
    const project = await this.prisma.project.create({
      data: {
        courseId: dto.courseId,
        semesterId: dto.semesterId,
        title: dto.title,
        instructions: dto.instructions,
        lifecycle: ContentLifecycle.draft,
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'project.create',
      resourceType: 'Project',
      resourceId: project.id,
      after: project,
    });
    return project;
  }

  async submit(projectId: string, dto: CreateSubmissionDto, actor: Actor) {
    await this.findOne(projectId);
    if (!dto.textBody?.trim()) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Submission text is required',
        fieldErrors: { textBody: ['Required'] },
      });
    }
    const submission = await this.prisma.projectSubmission.create({
      data: {
        projectId,
        learnerId: dto.learnerId,
        textBody: dto.textBody,
        status: ProjectSubmissionStatus.submitted,
      },
      include: { learner: true, project: true },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'project.submission_create',
      resourceType: 'ProjectSubmission',
      resourceId: submission.id,
      after: { projectId, learnerId: dto.learnerId },
    });
    return submission;
  }

  async accept(submissionId: string, dto: ReviewSubmissionDto, actor: Actor) {
    return this.decide(
      submissionId,
      ProjectSubmissionStatus.accepted,
      dto,
      actor,
    );
  }

  async requestChanges(
    submissionId: string,
    dto: ReviewSubmissionDto,
    actor: Actor,
  ) {
    return this.decide(
      submissionId,
      ProjectSubmissionStatus.changes_required,
      dto,
      actor,
    );
  }

  private async decide(
    submissionId: string,
    decision: ProjectSubmissionStatus,
    dto: ReviewSubmissionDto,
    actor: Actor,
  ) {
    if (!dto.learnerFeedback?.trim()) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Learner feedback is required',
        fieldErrors: { learnerFeedback: ['Required'] },
      });
    }
    const submission = await this.prisma.projectSubmission.findUnique({
      where: { id: submissionId },
    });
    if (!submission) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Submission ${submissionId} not found`,
        fieldErrors: {},
      });
    }
    if (submission.status !== ProjectSubmissionStatus.submitted) {
      throw new BadRequestException({
        code: 'INVALID_STATE',
        message: `Submission is ${submission.status}, expected submitted`,
        fieldErrors: {},
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.projectReview.create({
        data: {
          submissionId,
          decision,
          learnerFeedback: dto.learnerFeedback,
          internalNotes: dto.internalNotes,
          reviewerId: actor.userId,
        },
      });
      return tx.projectSubmission.update({
        where: { id: submissionId },
        data: { status: decision },
        include: {
          reviews: { orderBy: { reviewedAt: 'desc' } },
          learner: true,
          project: true,
        },
      });
    });

    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action:
        decision === ProjectSubmissionStatus.accepted
          ? 'project.accept'
          : 'project.request_changes',
      resourceType: 'ProjectSubmission',
      resourceId: submissionId,
      before: { status: submission.status },
      after: { status: updated.status },
      severity: AuditSeverity.notice,
    });
    return updated;
  }
}
