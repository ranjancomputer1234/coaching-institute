import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttemptStatus, AuditSeverity } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';

type Actor = { userId: string; email?: string };

@Injectable()
export class ResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(published?: boolean) {
    return this.prisma.result.findMany({
      where: published === undefined ? undefined : { published },
      include: {
        attempt: {
          include: {
            test: { select: { id: true, title: true } },
            learner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  async findOne(id: string) {
    const result = await this.prisma.result.findUnique({
      where: { id },
      include: {
        attempt: {
          include: { test: true, learner: true, answers: true },
        },
      },
    });
    if (!result) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Result ${id} not found`,
        fieldErrors: {},
      });
    }
    return result;
  }

  async publishForTest(
    testId: string,
    reason: string | undefined,
    actor: Actor,
  ) {
    const unpublished = await this.prisma.result.findMany({
      where: {
        published: false,
        attempt: { testId },
      },
    });
    if (!unpublished.length) {
      throw new BadRequestException({
        code: 'NO_RESULTS',
        message: 'No unpublished results for this test',
        fieldErrors: {},
      });
    }

    await this.prisma.$transaction(async (tx) => {
      for (const result of unpublished) {
        await tx.result.update({
          where: { id: result.id },
          data: {
            published: true,
            publishedAt: new Date(),
            revision: { increment: 1 },
          },
        });
        await tx.attempt.update({
          where: { id: result.attemptId },
          data: { status: AttemptStatus.result_published },
        });
      }
    });

    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'results.publish',
      resourceType: 'Test',
      resourceId: testId,
      after: { affected: unpublished.length },
      reason,
      severity: AuditSeverity.high,
    });

    return { published: unpublished.length, testId };
  }

  async publishOne(id: string, reason: string | undefined, actor: Actor) {
    const result = await this.findOne(id);
    if (result.published) {
      return result;
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const r = await tx.result.update({
        where: { id },
        data: {
          published: true,
          publishedAt: new Date(),
          revision: { increment: 1 },
        },
      });
      await tx.attempt.update({
        where: { id: result.attemptId },
        data: { status: AttemptStatus.result_published },
      });
      return r;
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'result.publish',
      resourceType: 'Result',
      resourceId: id,
      reason,
      severity: AuditSeverity.notice,
    });
    return updated;
  }
}
