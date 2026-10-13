import { QuestionStatus, QuestionType } from '@prisma/client';
import { TestsService } from './tests.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';

const actor = { userId: 'admin-1', email: 'admin@institute.local' };

describe('TestsService', () => {
  const prisma = {
    test: { findUnique: jest.fn(), update: jest.fn() },
    question: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const audit = { write: jest.fn() };
  const service = new TestsService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a question that is not single choice', async () => {
    prisma.test.findUnique.mockResolvedValue({ id: 'test-1', questions: [] });
    prisma.question.findMany.mockResolvedValue([
      {
        id: 'q1',
        type: QuestionType.multiple_choice,
        status: QuestionStatus.approved,
        marks: 1,
        options: [],
      },
    ]);

    await expect(
      service.setQuestions('test-1', { questionIds: ['q1'] }, actor),
    ).rejects.toMatchObject({
      response: { code: 'UNSUPPORTED_QUESTION_TYPE' },
    });
  });

  it('refuses to publish until every question is approved with one correct option', async () => {
    prisma.test.findUnique.mockResolvedValue({
      id: 'test-1',
      questionCount: 1,
      questions: [
        {
          questionId: 'q1',
          question: {
            status: QuestionStatus.draft,
            options: [{ isCorrect: true }, { isCorrect: false }],
          },
        },
      ],
    });

    await expect(service.publish('test-1', actor)).rejects.toMatchObject({
      response: { code: 'TEST_INVALID' },
    });
    expect(prisma.test.update).not.toHaveBeenCalled();
  });

  it('publishes a valid test', async () => {
    prisma.test.findUnique.mockResolvedValue({
      id: 'test-1',
      lifecycle: 'draft',
      questionCount: 1,
      questions: [
        {
          questionId: 'q1',
          question: {
            status: QuestionStatus.approved,
            options: [{ isCorrect: true }, { isCorrect: false }],
          },
        },
      ],
    });
    prisma.test.update.mockResolvedValue({
      id: 'test-1',
      lifecycle: 'published',
    });

    await expect(service.publish('test-1', actor)).resolves.toMatchObject({
      lifecycle: 'published',
    });
  });
});
