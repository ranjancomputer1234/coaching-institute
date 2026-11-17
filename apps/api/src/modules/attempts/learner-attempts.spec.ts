import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AttemptStatus, ContentLifecycle } from '@prisma/client';
import { AttemptsService } from './attempts.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';

const snapshotJson = JSON.stringify({
  testRevision: 1,
  questions: [
    {
      questionId: 'q1',
      prompt: 'Pick one',
      marks: 2,
      negativeMarks: 0.5,
      options: [
        { id: 'o-right', label: 'Right' },
        { id: 'o-wrong', label: 'Wrong' },
      ],
      correctOptionId: 'o-right',
    },
  ],
});

function attempt(overrides: Record<string, unknown> = {}) {
  return {
    id: 'attempt-1',
    testId: 'test-1',
    learnerId: 'learner-1',
    status: AttemptStatus.in_progress,
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    snapshotJson,
    answers: [{ questionId: 'q1', selectedOptionId: 'o-right' }],
    result: null,
    test: {
      id: 'test-1',
      title: 'Tally basics',
      mode: 'practice',
      durationMinutes: 30,
      resultPolicy: 'after_manual_publish',
    },
    ...overrides,
  };
}

describe('AttemptsService learner API', () => {
  const prisma = {
    test: { findUnique: jest.fn() },
    entitlement: { findFirst: jest.fn() },
    attempt: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    result: { update: jest.fn() },
    $transaction: jest.fn(),
  };
  const audit = { write: jest.fn() };
  const service = new AttemptsService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
  );

  const publishedTest = (overrides: Record<string, unknown> = {}) => ({
    id: 'test-1',
    lifecycle: ContentLifecycle.published,
    pricing: 'free',
    courseId: null,
    attemptLimit: null,
    durationMinutes: 30,
    revision: 1,
    questions: [],
    ...overrides,
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('toLearnerView never leaks correctOptionId', () => {
    const view = service.toLearnerView(attempt());
    const serialized = JSON.stringify(view);

    expect(serialized).not.toContain('correctOptionId');
    expect(serialized).not.toContain('isCorrect');
    expect(view.questions[0].options).toEqual([
      { id: 'o-right', label: 'Right' },
      { id: 'o-wrong', label: 'Wrong' },
    ]);
    expect(view.answers).toEqual([
      { questionId: 'q1', selectedOptionId: 'o-right' },
    ]);
    expect(view.test).toMatchObject({ id: 'test-1', mode: 'practice' });
  });

  it('createForLearner resumes an unexpired in-progress attempt', async () => {
    const existing = attempt();
    prisma.test.findUnique.mockResolvedValue(
      publishedTest({ attemptLimit: 1 }),
    );
    prisma.attempt.findFirst.mockResolvedValue(existing);

    await expect(service.createForLearner('test-1', 'learner-1')).resolves.toBe(
      existing,
    );
    expect(prisma.attempt.create).not.toHaveBeenCalled();
    expect(prisma.attempt.count).not.toHaveBeenCalled();
  });

  it('createForLearner denies paid tests without an entitlement', async () => {
    prisma.test.findUnique.mockResolvedValue(
      publishedTest({ pricing: 'Paid', courseId: 'course-1' }),
    );
    prisma.entitlement.findFirst.mockResolvedValue(null);

    await expect(
      service.createForLearner('test-1', 'learner-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.attempt.create).not.toHaveBeenCalled();
  });

  it('createForLearner enforces the attempt limit', async () => {
    prisma.test.findUnique.mockResolvedValue(
      publishedTest({ attemptLimit: 2 }),
    );
    prisma.attempt.findFirst.mockResolvedValue(null);
    prisma.attempt.count.mockResolvedValue(2);

    await expect(
      service.createForLearner('test-1', 'learner-1'),
    ).rejects.toMatchObject({ response: { code: 'ATTEMPT_LIMIT' } });
    await expect(
      service.createForLearner('test-1', 'learner-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createForLearner creates a fresh attempt and audits without an admin actorId', async () => {
    prisma.test.findUnique.mockResolvedValue(publishedTest());
    prisma.attempt.findFirst.mockResolvedValue(null);
    prisma.attempt.create.mockResolvedValue(attempt({ answers: undefined }));

    const created = await service.createForLearner('test-1', 'learner-1');

    expect(created.answers).toEqual([]);
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: null,
        actorDisplay: 'learner:learner-1',
        action: 'attempt.create',
      }),
    );
  });

  it('getForLearner rejects another learner', async () => {
    prisma.attempt.findUnique.mockResolvedValue(attempt());

    await expect(
      service.getForLearner('attempt-1', 'someone-else'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('getResultForLearner hides unpublished results under manual publish', async () => {
    prisma.attempt.findUnique.mockResolvedValue(
      attempt({ result: { id: 'r1', published: false } }),
    );

    await expect(
      service.getResultForLearner('attempt-1', 'learner-1'),
    ).rejects.toMatchObject({ response: { code: 'RESULT_UNPUBLISHED' } });
  });

  it('getResultForLearner returns review only for published results', async () => {
    prisma.attempt.findUnique.mockResolvedValue(
      attempt({
        status: AttemptStatus.result_published,
        result: {
          id: 'r1',
          rawScore: 2,
          maxScore: 2,
          percentage: 100,
          passed: true,
          correctCount: 1,
          wrongCount: 0,
          skippedCount: 0,
          published: true,
          publishedAt: new Date(),
        },
      }),
    );

    const res = await service.getResultForLearner('attempt-1', 'learner-1');

    expect(res.result.passed).toBe(true);
    expect(res.review?.[0]).toMatchObject({
      correctOptionId: 'o-right',
      isCorrect: true,
    });
  });
});
