import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttemptStatus,
  AuditSeverity,
  ContentLifecycle,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateAttemptDto, SaveAnswerDto } from './dto/attempt.dto';

type Actor = { userId: string; email?: string };

@Injectable()
export class AttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(status?: AttemptStatus) {
    return this.prisma.attempt.findMany({
      where: status ? { status } : undefined,
      include: {
        test: { select: { id: true, title: true } },
        learner: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        result: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  async findOne(id: string) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id },
      include: {
        test: true,
        learner: true,
        answers: true,
        result: true,
      },
    });
    if (!attempt) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Attempt ${id} not found`,
        fieldErrors: {},
      });
    }
    return attempt;
  }

  async create(dto: CreateAttemptDto, actor: Actor) {
    const test = await this.prisma.test.findUnique({
      where: { id: dto.testId },
      include: {
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: {
            question: {
              include: { options: { orderBy: { sortOrder: 'asc' } } },
            },
          },
        },
      },
    });
    if (!test || test.lifecycle !== ContentLifecycle.published) {
      throw new BadRequestException({
        code: 'TEST_UNAVAILABLE',
        message: 'Test is not published',
        fieldErrors: {},
      });
    }

    const expiresAt = new Date(
      Date.now() + test.durationMinutes * 60 * 1000,
    );
    const snapshot = {
      testRevision: test.revision,
      questions: test.questions.map((tq) => ({
        questionId: tq.questionId,
        prompt: tq.question.prompt,
        marks: tq.marks ?? tq.question.marks,
        negativeMarks: tq.question.negativeMarks,
        options: tq.question.options.map((o) => ({
          id: o.id,
          label: o.label,
          // correct flag stored server-side only in scoring path via live question
        })),
        correctOptionId: tq.question.options.find((o) => o.isCorrect)?.id,
      })),
    };

    const attempt = await this.prisma.attempt.create({
      data: {
        testId: dto.testId,
        learnerId: dto.learnerId,
        status: AttemptStatus.in_progress,
        expiresAt,
        snapshotJson: JSON.stringify(snapshot),
      },
      include: { test: true, learner: true },
    });

    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'attempt.create',
      resourceType: 'Attempt',
      resourceId: attempt.id,
      after: {
        testId: dto.testId,
        learnerId: dto.learnerId,
        expiresAt,
      },
    });
    return attempt;
  }

  async saveAnswer(id: string, questionId: string, dto: SaveAnswerDto) {
    const attempt = await this.findOne(id);
    if (
      attempt.status !== AttemptStatus.in_progress &&
      attempt.status !== AttemptStatus.created
    ) {
      throw new BadRequestException({
        code: 'ATTEMPT_CLOSED',
        message: 'Cannot change answers on a closed attempt',
        fieldErrors: {},
      });
    }
    if (attempt.expiresAt && attempt.expiresAt < new Date()) {
      await this.prisma.attempt.update({
        where: { id },
        data: { status: AttemptStatus.expired },
      });
      throw new BadRequestException({
        code: 'ATTEMPT_EXPIRED',
        message: 'Attempt has expired',
        fieldErrors: {},
      });
    }

    return this.prisma.attemptAnswer.upsert({
      where: {
        attemptId_questionId: { attemptId: id, questionId },
      },
      create: {
        attemptId: id,
        questionId,
        selectedOptionId: dto.selectedOptionId,
      },
      update: {
        selectedOptionId: dto.selectedOptionId,
        revision: { increment: 1 },
        answeredAt: new Date(),
      },
    });
  }

  async submit(id: string, actor: Actor) {
    const attempt = await this.findOne(id);
    if (
      attempt.status === AttemptStatus.submitted ||
      attempt.status === AttemptStatus.scored ||
      attempt.status === AttemptStatus.result_unpublished ||
      attempt.status === AttemptStatus.result_published
    ) {
      // idempotent: return existing result
      return this.findOne(id);
    }
    if (
      attempt.status !== AttemptStatus.in_progress &&
      attempt.status !== AttemptStatus.created
    ) {
      throw new BadRequestException({
        code: 'ATTEMPT_CLOSED',
        message: `Cannot submit attempt in status ${attempt.status}`,
        fieldErrors: {},
      });
    }

    const snapshot = attempt.snapshotJson
      ? (JSON.parse(attempt.snapshotJson) as {
          questions: Array<{
            questionId: string;
            marks: number;
            negativeMarks: number;
            correctOptionId?: string;
          }>;
        })
      : { questions: [] };

    let rawScore = 0;
    let maxScore = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let skippedCount = 0;
    const answerMap = new Map(
      attempt.answers.map((a) => [a.questionId, a.selectedOptionId]),
    );

    for (const q of snapshot.questions) {
      maxScore += q.marks;
      const selected = answerMap.get(q.questionId);
      if (!selected) {
        skippedCount += 1;
        continue;
      }
      if (selected === q.correctOptionId) {
        rawScore += q.marks;
        correctCount += 1;
      } else {
        wrongCount += 1;
        if (attempt.test.negativeMarking) {
          rawScore -= q.negativeMarks;
        }
      }
    }

    const percentage = maxScore > 0 ? (rawScore / maxScore) * 100 : 0;
    const passed = percentage >= attempt.test.passThreshold;

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.attempt.update({
        where: { id },
        data: {
          status: AttemptStatus.result_unpublished,
          submittedAt: new Date(),
        },
      });
      return tx.result.upsert({
        where: { attemptId: id },
        create: {
          attemptId: id,
          rawScore,
          maxScore,
          percentage,
          passed,
          correctCount,
          wrongCount,
          skippedCount,
          published: false,
        },
        update: {
          rawScore,
          maxScore,
          percentage,
          passed,
          correctCount,
          wrongCount,
          skippedCount,
          revision: { increment: 1 },
        },
      });
    });

    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'attempt.submit',
      resourceType: 'Attempt',
      resourceId: id,
      after: { rawScore, maxScore, percentage, passed },
      severity: AuditSeverity.notice,
    });

    return { ...result, attemptId: id };
  }
}
