import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditSeverity, LearnerAccountState } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateLearnerDto } from './dto/create-learner.dto';
import { UpdateLearnerDto } from './dto/update-learner.dto';

type Actor = { userId: string; name?: string; email?: string };

export type LearnerActivityItem = {
  id: string;
  kind: string;
  title: string;
  detail?: string;
  occurredAt: string;
};

export type LearnerActivityResponse = {
  summary: {
    lastActiveAt: string | null;
    memberSince: string;
    enrolledCourses: number;
    lessonsCompleted: number;
    lessonsInProgress: number;
    testAttempts: number;
    documentsIssued: number;
    resourceDownloads: number;
  };
  items: LearnerActivityItem[];
};

@Injectable()
export class LearnersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(q?: string) {
    const query = q?.trim();
    return this.prisma.learner.findMany({
      where: query
        ? {
            OR: [
              { firstName: { contains: query } },
              { lastName: { contains: query } },
              { email: { contains: query } },
              { phone: { contains: query } },
              { id: { contains: query } },
            ],
          }
        : undefined,
      include: { batch: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const learner = await this.prisma.learner.findUnique({
      where: { id },
      include: {
        batch: true,
        enrollments: { include: { course: true } },
        memberships: { include: { batch: true } },
      },
    });
    if (!learner) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Learner ${id} not found`,
        fieldErrors: {},
      });
    }
    return learner;
  }

  async getActivity(id: string): Promise<LearnerActivityResponse> {
    const learner = await this.prisma.learner.findUnique({
      where: { id },
      select: { id: true, createdAt: true, lastActiveAt: true },
    });
    if (!learner) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Learner ${id} not found`,
        fieldErrors: {},
      });
    }

    const [
      progress,
      attempts,
      enrollments,
      documents,
      downloads,
      audits,
      entitlements,
      attemptCount,
      completedLessons,
      inProgressLessons,
    ] = await Promise.all([
      this.prisma.lessonProgress.findMany({
        where: { learnerId: id },
        include: {
          lesson: { include: { course: { select: { title: true } } } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 40,
      }),
      this.prisma.attempt.findMany({
        where: { learnerId: id },
        include: {
          test: { select: { title: true } },
          result: {
            select: { percentage: true, passed: true, published: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 25,
      }),
      this.prisma.enrollment.findMany({
        where: { learnerId: id },
        include: { course: { select: { title: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.issuedDocument.findMany({
        where: { learnerId: id },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
      this.prisma.downloadSession.findMany({
        where: { learnerId: id },
        include: { resource: { select: { title: true, kind: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.auditEvent.findMany({
        where: { resourceType: 'Learner', resourceId: id },
        orderBy: { occurredAtUtc: 'desc' },
        take: 25,
      }),
      this.prisma.entitlement.findMany({
        where: { learnerId: id },
        include: { course: { select: { title: true } } },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
      this.prisma.attempt.count({ where: { learnerId: id } }),
      this.prisma.lessonProgress.count({
        where: { learnerId: id, status: 'completed' },
      }),
      this.prisma.lessonProgress.count({
        where: { learnerId: id, status: { not: 'completed' } },
      }),
    ]);

    const items: LearnerActivityItem[] = [];

    items.push({
      id: `account-${learner.id}`,
      kind: 'account',
      title: 'Account created',
      occurredAt: learner.createdAt.toISOString(),
    });

    if (learner.lastActiveAt) {
      items.push({
        id: `active-${learner.id}`,
        kind: 'session',
        title: 'Last seen in app',
        detail: 'Most recent learner activity timestamp',
        occurredAt: learner.lastActiveAt.toISOString(),
      });
    }

    for (const row of enrollments) {
      items.push({
        id: `enrollment-${row.id}`,
        kind: 'enrollment',
        title: `Enrolled in ${row.course.title}`,
        detail: `Status: ${row.status}`,
        occurredAt: row.createdAt.toISOString(),
      });
    }

    for (const row of entitlements) {
      const scope =
        row.course?.title ??
        (row.scopeRef ? `${row.scopeKind}: ${row.scopeRef}` : row.scopeKind);
      items.push({
        id: `entitlement-${row.id}`,
        kind: 'entitlement',
        title: `Access granted — ${scope}`,
        detail: `Source: ${row.source}, state: ${row.state}`,
        occurredAt: row.createdAt.toISOString(),
      });
    }

    for (const row of progress) {
      const lessonTitle = row.lesson.title;
      const courseTitle = row.lesson.course.title;
      const completed = row.status === 'completed';
      items.push({
        id: `lesson-${row.id}`,
        kind: completed ? 'lesson_complete' : 'lesson_progress',
        title: completed
          ? `Completed lesson — ${lessonTitle}`
          : `Lesson progress — ${lessonTitle}`,
        detail: `${courseTitle} · ${Math.round(row.progressPct)}%`,
        occurredAt: (row.completedAt ?? row.updatedAt).toISOString(),
      });
    }

    for (const row of attempts) {
      const when = row.submittedAt ?? row.startedAt;
      let detail = `Status: ${row.status}`;
      if (row.result?.published) {
        detail = `Score ${Math.round(row.result.percentage)}% · ${row.result.passed ? 'passed' : 'not passed'}`;
      }
      items.push({
        id: `attempt-${row.id}`,
        kind: 'test',
        title: `Test — ${row.test.title}`,
        detail,
        occurredAt: when.toISOString(),
      });
    }

    for (const row of documents) {
      items.push({
        id: `document-${row.id}`,
        kind: 'document',
        title: row.title,
        detail: `Type: ${row.documentType}, status: ${row.status}`,
        occurredAt: (row.issuedAt ?? row.createdAt).toISOString(),
      });
    }

    for (const row of downloads) {
      items.push({
        id: `download-${row.id}`,
        kind: 'download',
        title: `Downloaded ${row.resource.title}`,
        detail: `${row.resource.kind}${row.usedAt ? ' · completed' : ' · link issued'}`,
        occurredAt: (row.usedAt ?? row.createdAt).toISOString(),
      });
    }

    for (const row of audits) {
      items.push({
        id: `audit-${row.id}`,
        kind: 'admin',
        title: row.action.replace(/\./g, ' · '),
        detail: row.actorDisplay
          ? `${row.actorDisplay}${row.reason ? ` — ${row.reason}` : ''}`
          : (row.reason ?? undefined),
        occurredAt: row.occurredAtUtc.toISOString(),
      });
    }

    items.sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );

    const documentsIssued = documents.filter(
      (d) => d.status === 'issued',
    ).length;

    return {
      summary: {
        lastActiveAt: learner.lastActiveAt?.toISOString() ?? null,
        memberSince: learner.createdAt.toISOString(),
        enrolledCourses: enrollments.length,
        lessonsCompleted: completedLessons,
        lessonsInProgress: inProgressLessons,
        testAttempts: attemptCount,
        documentsIssued,
        resourceDownloads: downloads.length,
      },
      items: items.slice(0, 60),
    };
  }

  async create(dto: CreateLearnerDto, actor: Actor) {
    const learner = await this.prisma.learner.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        phoneNormalized: dto.phone?.replace(/\D/g, '') || undefined,
        city: dto.city,
        batchId: dto.batchId,
        source: dto.source,
        accountState: LearnerAccountState.active,
        verifiedEmail: Boolean(dto.email),
      },
      include: { batch: true },
    });

    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.name ?? actor.email,
      action: 'learner.create',
      resourceType: 'Learner',
      resourceId: learner.id,
      after: learner,
    });

    return learner;
  }

  async update(id: string, dto: UpdateLearnerDto, actor: Actor) {
    const before = await this.findOne(id);
    const learner = await this.prisma.learner.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        phoneNormalized: dto.phone?.replace(/\D/g, '') || undefined,
        city: dto.city,
        batchId: dto.batchId,
        source: dto.source,
        internalNotes: dto.internalNotes,
      },
      include: { batch: true },
    });

    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.name ?? actor.email,
      action: 'learner.update',
      resourceType: 'Learner',
      resourceId: id,
      before,
      after: learner,
    });

    return learner;
  }

  async suspend(id: string, reason: string, actor: Actor) {
    if (!reason?.trim()) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Reason is required',
        fieldErrors: { reason: ['Reason is required.'] },
      });
    }
    const before = await this.findOne(id);
    const learner = await this.prisma.learner.update({
      where: { id },
      data: { accountState: LearnerAccountState.suspended },
      include: { batch: true },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.name ?? actor.email,
      action: 'learner.suspend',
      resourceType: 'Learner',
      resourceId: id,
      before: { accountState: before.accountState },
      after: { accountState: learner.accountState },
      reason,
      severity: AuditSeverity.high,
    });
    return learner;
  }

  async reactivate(id: string, reason: string, actor: Actor) {
    if (!reason?.trim()) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Reason is required',
        fieldErrors: { reason: ['Reason is required.'] },
      });
    }
    const before = await this.findOne(id);
    const learner = await this.prisma.learner.update({
      where: { id },
      data: { accountState: LearnerAccountState.active },
      include: { batch: true },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.name ?? actor.email,
      action: 'learner.reactivate',
      resourceType: 'Learner',
      resourceId: id,
      before: { accountState: before.accountState },
      after: { accountState: learner.accountState },
      reason,
      severity: AuditSeverity.notice,
    });
    return learner;
  }
}
