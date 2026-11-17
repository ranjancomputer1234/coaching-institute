import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttemptStatus,
  AuditSeverity,
  ContentLifecycle,
  EntitlementState,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateAttemptDto, SaveAnswerDto } from './dto/attempt.dto';

/**
 * `kind: 'learner'` actors are not AdminUser rows, so they must never be
 * written to the audit `actorId` foreign key; they are recorded by display.
 */
type Actor = { userId: string; email?: string; kind?: 'admin' | 'learner' };

function auditActor(actor: Actor) {
  if (actor.kind === 'learner') {
    return { actorId: null, actorDisplay: `learner:${actor.userId}` };
  }
  return { actorId: actor.userId, actorDisplay: actor.email };
}

type SnapshotQuestion = {
  questionId: string;
  prompt?: string;
  marks?: number;
  negativeMarks?: number;
  options?: Array<{ id: string; label: string }>;
  correctOptionId?: string;
};

type Snapshot = { testRevision?: number; questions: SnapshotQuestion[] };

/** Minimal attempt shape consumed by the learner view helpers. */
export type LearnerViewAttempt = {
  id: string;
  testId?: string;
  status: AttemptStatus;
  startedAt?: Date | null;
  expiresAt?: Date | null;
  submittedAt?: Date | null;
  snapshotJson?: string | null;
  answers?: Array<{ questionId: string; selectedOptionId: string | null }>;
  test?: {
    id: string;
    title: string;
    mode: string;
    durationMinutes: number;
  } | null;
};

function parseSnapshot(json?: string | null): Snapshot {
  if (!json) return { questions: [] };
  try {
    const parsed = JSON.parse(json) as Partial<Snapshot>;
    return {
      testRevision: parsed.testRevision,
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
    };
  } catch {
    return { questions: [] };
  }
}

function isManualPublishPolicy(policy?: string | null) {
  return (
    (policy ?? 'after_manual_publish').trim().toLowerCase() ===
    'after_manual_publish'
  );
}

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

  private async loadPublishedTest(testId: string) {
    const test = await this.prisma.test.findUnique({
      where: { id: testId },
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
    return test;
  }

  async create(dto: CreateAttemptDto, actor: Actor) {
    const test = await this.loadPublishedTest(dto.testId);
    return this.createFromTest(test, dto.learnerId, actor);
  }

  private async createFromTest(
    test: Awaited<ReturnType<AttemptsService['loadPublishedTest']>>,
    learnerId: string,
    actor: Actor,
  ) {
    const dto = { testId: test.id, learnerId };
    const expiresAt = new Date(Date.now() + test.durationMinutes * 60 * 1000);
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
      ...auditActor(actor),
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
      ...auditActor(actor),
      action: 'attempt.submit',
      resourceType: 'Attempt',
      resourceId: id,
      after: { rawScore, maxScore, percentage, passed },
      severity: AuditSeverity.notice,
    });

    return { ...result, attemptId: id };
  }

  // —— Learner-facing API ——

  private learnerActor(learnerId: string): Actor {
    return { userId: learnerId, kind: 'learner' };
  }

  private async hasTestEntitlement(
    learnerId: string,
    test: { id: string; courseId: string | null },
  ) {
    const now = new Date();
    const scopes: Prisma.EntitlementWhereInput[] = [
      { scopeKind: 'test', scopeRef: test.id },
    ];
    if (test.courseId) {
      scopes.push(
        { courseId: test.courseId },
        { scopeKind: 'course', scopeRef: test.courseId },
      );
    }
    const found = await this.prisma.entitlement.findFirst({
      where: {
        learnerId,
        state: EntitlementState.active,
        startsAt: { lte: now },
        AND: [
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
          { OR: scopes },
        ],
      },
      select: { id: true },
    });
    return Boolean(found);
  }

  async createForLearner(testId: string, learnerId: string) {
    const test = await this.loadPublishedTest(testId);

    if ((test.pricing ?? 'free').trim().toLowerCase() === 'paid') {
      const entitled = await this.hasTestEntitlement(learnerId, test);
      if (!entitled) {
        throw new ForbiddenException({
          code: 'ACCESS_DENIED',
          message: 'You do not have access to this test',
          fieldErrors: {},
        });
      }
    }

    // Resume an unexpired in-progress attempt instead of starting another.
    const existing = await this.prisma.attempt.findFirst({
      where: {
        learnerId,
        testId,
        status: AttemptStatus.in_progress,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { startedAt: 'desc' },
      include: { test: true, answers: true },
    });
    if (existing) return existing;

    if (test.attemptLimit != null) {
      const used = await this.prisma.attempt.count({
        where: {
          learnerId,
          testId,
          status: { notIn: [AttemptStatus.abandoned] },
        },
      });
      if (used >= test.attemptLimit) {
        throw new BadRequestException({
          code: 'ATTEMPT_LIMIT',
          message: `Attempt limit of ${test.attemptLimit} reached`,
          fieldErrors: {},
        });
      }
    }

    const created = await this.createFromTest(
      test,
      learnerId,
      this.learnerActor(learnerId),
    );
    return {
      ...created,
      answers: [] as Array<{
        questionId: string;
        selectedOptionId: string | null;
      }>,
    };
  }

  /** Client-safe attempt shape. Never includes correct answers. */
  toLearnerView(attempt: LearnerViewAttempt) {
    const snapshot = parseSnapshot(attempt.snapshotJson);
    const questions = snapshot.questions.map((q) => ({
      questionId: q.questionId,
      prompt: q.prompt,
      marks: q.marks,
      negativeMarks: q.negativeMarks,
      options: (q.options ?? []).map((o) => ({ id: o.id, label: o.label })),
    }));
    const answers = (attempt.answers ?? []).map((a) => ({
      questionId: a.questionId,
      selectedOptionId: a.selectedOptionId,
    }));
    return {
      id: attempt.id,
      testId: attempt.testId ?? attempt.test?.id,
      status: attempt.status,
      startedAt: attempt.startedAt ?? null,
      expiresAt: attempt.expiresAt ?? null,
      submittedAt: attempt.submittedAt ?? null,
      test: attempt.test
        ? {
            id: attempt.test.id,
            title: attempt.test.title,
            mode: attempt.test.mode,
            durationMinutes: attempt.test.durationMinutes,
            expiresAt: attempt.expiresAt ?? null,
            status: attempt.status,
            startedAt: attempt.startedAt ?? null,
          }
        : null,
      questions,
      answers,
    };
  }

  private async findOwned(attemptId: string, learnerId: string) {
    const attempt = await this.findOne(attemptId);
    if (attempt.learnerId !== learnerId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'This attempt belongs to another learner',
        fieldErrors: {},
      });
    }
    return attempt;
  }

  async getForLearner(attemptId: string, learnerId: string) {
    const attempt = await this.findOwned(attemptId, learnerId);
    return this.toLearnerView(attempt);
  }

  async saveAnswerForLearner(
    attemptId: string,
    questionId: string,
    selectedOptionId: string,
    learnerId: string,
  ) {
    const attempt = await this.findOwned(attemptId, learnerId);
    const question = parseSnapshot(attempt.snapshotJson).questions.find(
      (q) => q.questionId === questionId,
    );
    if (
      !question ||
      !(question.options ?? []).some((o) => o.id === selectedOptionId)
    ) {
      throw new BadRequestException({
        code: 'INVALID_ANSWER',
        message: 'Question or option is not part of this attempt',
        fieldErrors: {},
      });
    }
    const saved = await this.saveAnswer(attemptId, questionId, {
      selectedOptionId,
    });
    return {
      questionId: saved.questionId,
      selectedOptionId: saved.selectedOptionId,
      answeredAt: saved.answeredAt,
    };
  }

  async submitForLearner(attemptId: string, learnerId: string) {
    await this.findOwned(attemptId, learnerId);
    await this.submit(attemptId, this.learnerActor(learnerId));

    const attempt = await this.findOne(attemptId);
    if (
      attempt.result &&
      !attempt.result.published &&
      !isManualPublishPolicy(attempt.test.resultPolicy)
    ) {
      const publishedAt = new Date();
      await this.prisma.$transaction([
        this.prisma.result.update({
          where: { attemptId },
          data: { published: true, publishedAt },
        }),
        this.prisma.attempt.update({
          where: { id: attemptId },
          data: { status: AttemptStatus.result_published },
        }),
      ]);
    }
    return this.getForLearner(attemptId, learnerId);
  }

  async getResultForLearner(attemptId: string, learnerId: string) {
    const attempt = await this.findOwned(attemptId, learnerId);
    const result = attempt.result;
    if (!result) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'No result for this attempt yet',
        fieldErrors: {},
      });
    }
    if (!result.published && isManualPublishPolicy(attempt.test.resultPolicy)) {
      throw new ForbiddenException({
        code: 'RESULT_UNPUBLISHED',
        message: 'Result has not been published yet',
        fieldErrors: {},
      });
    }

    const base = {
      attempt: {
        id: attempt.id,
        testId: attempt.testId,
        status: attempt.status,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        test: {
          id: attempt.test.id,
          title: attempt.test.title,
          mode: attempt.test.mode,
        },
      },
      result: {
        id: result.id,
        rawScore: result.rawScore,
        maxScore: result.maxScore,
        percentage: result.percentage,
        passed: result.passed,
        correctCount: result.correctCount,
        wrongCount: result.wrongCount,
        skippedCount: result.skippedCount,
        published: result.published,
        publishedAt: result.publishedAt,
      },
    };
    if (!result.published) {
      return { ...base, review: null };
    }

    const answerMap = new Map(
      attempt.answers.map((a) => [a.questionId, a.selectedOptionId]),
    );
    const review = parseSnapshot(attempt.snapshotJson).questions.map((q) => {
      const selectedOptionId = answerMap.get(q.questionId) ?? null;
      return {
        questionId: q.questionId,
        prompt: q.prompt,
        marks: q.marks,
        options: (q.options ?? []).map((o) => ({ id: o.id, label: o.label })),
        selectedOptionId,
        correctOptionId: q.correctOptionId ?? null,
        isCorrect:
          selectedOptionId != null && selectedOptionId === q.correctOptionId,
      };
    });
    return { ...base, review };
  }

  async listMine(learnerId: string, opts?: { testId?: string }) {
    const rows = await this.prisma.attempt.findMany({
      where: { learnerId, ...(opts?.testId ? { testId: opts.testId } : {}) },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        test: { select: { id: true, title: true, mode: true } },
        result: { select: { published: true } },
      },
    });
    return rows.map((a) => ({
      id: a.id,
      testId: a.testId,
      status: a.status,
      startedAt: a.startedAt,
      expiresAt: a.expiresAt,
      submittedAt: a.submittedAt,
      updatedAt: a.updatedAt,
      test: a.test,
      testTitle: a.test.title,
      resultPublished: a.result?.published ?? false,
    }));
  }
}
