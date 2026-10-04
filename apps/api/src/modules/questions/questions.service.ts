import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditSeverity, QuestionStatus, QuestionType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateQuestionDto, UpdateQuestionDto } from './dto/question.dto';

type Actor = { userId: string; email?: string };

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(status?: QuestionStatus) {
    return this.prisma.question.findMany({
      where: status ? { status } : undefined,
      include: { options: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!question) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Question ${id} not found`,
        fieldErrors: {},
      });
    }
    return question;
  }

  private assertSingleChoice(dto: {
    type?: QuestionType;
    options: { isCorrect: boolean }[];
  }) {
    const type = dto.type ?? QuestionType.single_choice;
    if (type !== QuestionType.single_choice) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_QUESTION_TYPE',
        message:
          'Phase 1 mobile only supports single_choice. Other types cannot be published yet.',
        fieldErrors: { type: ['Use single_choice'] },
      });
    }
    const correct = dto.options.filter((o) => o.isCorrect).length;
    if (correct !== 1) {
      throw new BadRequestException({
        code: 'INVALID_OPTIONS',
        message: 'single_choice requires exactly one correct option',
        fieldErrors: { options: ['Exactly one correct option required'] },
      });
    }
  }

  async create(dto: CreateQuestionDto, actor: Actor) {
    this.assertSingleChoice(dto);
    const question = await this.prisma.question.create({
      data: {
        prompt: dto.prompt,
        type: dto.type ?? QuestionType.single_choice,
        explanation: dto.explanation,
        subject: dto.subject,
        topic: dto.topic,
        difficulty: dto.difficulty,
        marks: dto.marks ?? 1,
        negativeMarks: dto.negativeMarks ?? 0,
        status: QuestionStatus.draft,
        options: {
          create: dto.options.map((o, i) => ({
            label: o.label,
            isCorrect: o.isCorrect,
            sortOrder: o.sortOrder ?? i,
          })),
        },
      },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'question.create',
      resourceType: 'Question',
      resourceId: question.id,
      after: { prompt: question.prompt },
    });
    return question;
  }

  async update(id: string, dto: UpdateQuestionDto, actor: Actor) {
    const before = await this.findOne(id);
    if (dto.options) {
      this.assertSingleChoice({
        type: before.type,
        options: dto.options,
      });
    }
    const question = await this.prisma.$transaction(async (tx) => {
      if (dto.options) {
        await tx.questionOption.deleteMany({ where: { questionId: id } });
        await tx.questionOption.createMany({
          data: dto.options.map((o, i) => ({
            questionId: id,
            label: o.label,
            isCorrect: o.isCorrect,
            sortOrder: o.sortOrder ?? i,
          })),
        });
      }
      return tx.question.update({
        where: { id },
        data: {
          prompt: dto.prompt,
          explanation: dto.explanation,
          subject: dto.subject,
          topic: dto.topic,
          difficulty: dto.difficulty,
          marks: dto.marks,
          negativeMarks: dto.negativeMarks,
          status: dto.status,
          revision: { increment: 1 },
        },
        include: { options: { orderBy: { sortOrder: 'asc' } } },
      });
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'question.update',
      resourceType: 'Question',
      resourceId: id,
      before: { revision: before.revision, status: before.status },
      after: { revision: question.revision, status: question.status },
    });
    return question;
  }

  async approve(id: string, actor: Actor) {
    const before = await this.findOne(id);
    this.assertSingleChoice(before);
    const question = await this.prisma.question.update({
      where: { id },
      data: { status: QuestionStatus.approved, revision: { increment: 1 } },
      include: { options: true },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'question.approve',
      resourceType: 'Question',
      resourceId: id,
      before: { status: before.status },
      after: { status: question.status },
      severity: AuditSeverity.notice,
    });
    return question;
  }

  async retire(id: string, actor: Actor) {
    const before = await this.findOne(id);
    const question = await this.prisma.question.update({
      where: { id },
      data: { status: QuestionStatus.retired, revision: { increment: 1 } },
      include: { options: true },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'question.retire',
      resourceType: 'Question',
      resourceId: id,
      before: { status: before.status },
      after: { status: question.status },
      severity: AuditSeverity.notice,
    });
    return question;
  }
}
