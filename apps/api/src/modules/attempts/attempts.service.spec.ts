import { BadRequestException } from '@nestjs/common';
import { AttemptStatus, ContentLifecycle } from '@prisma/client';
import { AttemptsService } from './attempts.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';

const actor = { userId: 'admin-1', email: 'admin@institute.local' };

function attempt(overrides: Record<string, unknown> = {}) {
  return {
    id: 'attempt-1',
    status: AttemptStatus.in_progress,
    expiresAt: new Date(Date.now() + 60_000),
    snapshotJson: JSON.stringify({
      questions: [
        {
          questionId: 'q1',
          marks: 2,
          negativeMarks: 1,
          correctOptionId: 'opt-right',
        },
        {
          questionId: 'q2',
          marks: 2,
          negativeMarks: 1,
          correctOptionId: 'opt-right-2',
        },
      ],
    }),
    answers: [
      { questionId: 'q1', selectedOptionId: 'opt-right' },
      { questionId: 'q2', selectedOptionId: 'opt-wrong' },
    ],
    test: { negativeMarking: true, passThreshold: 50 },
    ...overrides,
  };
}

describe('AttemptsService', () => {
  const prisma = {
    test: { findUnique: jest.fn() },
    attempt: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    attemptAnswer: { upsert: jest.fn() },
    $transaction: jest.fn(),
  };
  const audit = { write: jest.fn() };
  const service = new AttemptsService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refuses to start an unpublished test', async () => {
    prisma.test.findUnique.mockResolvedValue({
      id: 'test-1',
      lifecycle: ContentLifecycle.draft,
    });

    await expect(
      service.create({ testId: 'test-1', learnerId: 'learner-1' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('scores a snapshot, applying negative marks only to wrong answers', async () => {
    prisma.attempt.findUnique.mockResolvedValue(attempt());
    prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      Promise.resolve(
        fn({
          attempt: { update: jest.fn() },
          result: {
            upsert: jest
              .fn()
              .mockImplementation(({ create }: { create: unknown }) => create),
          },
        }),
      ),
    );

    const result = await service.submit('attempt-1', actor);

    expect(result).toMatchObject({
      rawScore: 1,
      maxScore: 4,
      percentage: 25,
      passed: false,
      correctCount: 1,
      wrongCount: 1,
      skippedCount: 0,
      published: false,
    });
  });

  it('returns the existing attempt when submit is repeated', async () => {
    const submitted = attempt({ status: AttemptStatus.result_unpublished });
    prisma.attempt.findUnique.mockResolvedValue(submitted);

    await expect(service.submit('attempt-1', actor)).resolves.toBe(submitted);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('expires an attempt that is answered after the timer', async () => {
    prisma.attempt.findUnique.mockResolvedValue(
      attempt({ expiresAt: new Date(Date.now() - 1000) }),
    );

    await expect(
      service.saveAnswer('attempt-1', 'q1', { selectedOptionId: 'opt-right' }),
    ).rejects.toMatchObject({
      response: { code: 'ATTEMPT_EXPIRED' },
    });
    expect(prisma.attempt.update).toHaveBeenCalledWith({
      where: { id: 'attempt-1' },
      data: { status: AttemptStatus.expired },
    });
  });
});
