import { QuestionType } from '@prisma/client';
import { QuestionsService } from './questions.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';

const actor = { userId: 'admin-1', email: 'admin@institute.local' };

describe('QuestionsService', () => {
  const prisma = {
    question: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  };
  const audit = { write: jest.fn() };
  const service = new QuestionsService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires exactly one correct option', async () => {
    await expect(
      service.create(
        {
          prompt: 'What is a voucher?',
          type: QuestionType.single_choice,
          options: [
            { label: 'A', isCorrect: true },
            { label: 'B', isCorrect: true },
          ],
        },
        actor,
      ),
    ).rejects.toMatchObject({
      response: { code: 'INVALID_OPTIONS' },
    });
    expect(prisma.question.create).not.toHaveBeenCalled();
  });

  it('stores a valid single-choice question as a draft', async () => {
    prisma.question.create.mockResolvedValue({
      id: 'q1',
      prompt: 'What is a voucher?',
    });

    await service.create(
      {
        prompt: 'What is a voucher?',
        options: [
          { label: 'A payment record', isCorrect: true },
          { label: 'A student', isCorrect: false },
        ],
      },
      actor,
    );

    const [createArgs] = prisma.question.create.mock.calls[0] as [
      { data: { status: string; marks: number } },
    ];
    expect(createArgs.data).toMatchObject({ status: 'draft', marks: 1 });
  });
});
