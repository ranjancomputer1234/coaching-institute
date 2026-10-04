import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditSeverity,
  ContentLifecycle,
  QuestionStatus,
  QuestionType,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateTestDto,
  SetTestQuestionsDto,
  UpdateTestDto,
} from './dto/test.dto';

type Actor = { userId: string; email?: string };

@Injectable()
export class TestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.test.findMany({
      include: {
        _count: { select: { questions: true, attempts: true } },
        course: { select: { id: true, title: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const test = await this.prisma.test.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: {
            question: {
              include: { options: { orderBy: { sortOrder: 'asc' } } },
            },
          },
        },
        course: true,
      },
    });
    if (!test) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Test ${id} not found`,
        fieldErrors: {},
      });
    }
    return test;
  }

  async create(dto: CreateTestDto, actor: Actor) {
    const test = await this.prisma.test.create({
      data: {
        title: dto.title,
        description: dto.description,
        mode: dto.mode,
        courseId: dto.courseId,
        semesterId: dto.semesterId,
        instructions: dto.instructions,
        durationMinutes: dto.durationMinutes ?? 60,
        passThreshold: dto.passThreshold ?? 40,
        negativeMarking: dto.negativeMarking ?? false,
        attemptLimit: dto.attemptLimit,
        resultPolicy: dto.resultPolicy ?? 'after_manual_publish',
        lifecycle: ContentLifecycle.draft,
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'test.create',
      resourceType: 'Test',
      resourceId: test.id,
      after: test,
    });
    return test;
  }

  async update(id: string, dto: UpdateTestDto, actor: Actor) {
    await this.findOne(id);
    const test = await this.prisma.test.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        mode: dto.mode,
        instructions: dto.instructions,
        durationMinutes: dto.durationMinutes,
        passThreshold: dto.passThreshold,
        negativeMarking: dto.negativeMarking,
        attemptLimit: dto.attemptLimit,
        resultPolicy: dto.resultPolicy,
        revision: { increment: 1 },
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'test.update',
      resourceType: 'Test',
      resourceId: id,
      after: { title: test.title, revision: test.revision },
    });
    return test;
  }

  async setQuestions(id: string, dto: SetTestQuestionsDto, actor: Actor) {
    await this.findOne(id);
    const questions = await this.prisma.question.findMany({
      where: { id: { in: dto.questionIds } },
      include: { options: true },
    });
    if (questions.length !== dto.questionIds.length) {
      throw new BadRequestException({
        code: 'QUESTION_MISSING',
        message: 'One or more question IDs were not found',
        fieldErrors: {},
      });
    }
    for (const q of questions) {
      if (q.type !== QuestionType.single_choice) {
        throw new BadRequestException({
          code: 'UNSUPPORTED_QUESTION_TYPE',
          message: `Question ${q.id} is not single_choice`,
          fieldErrors: {},
        });
      }
      if (q.status === QuestionStatus.retired) {
        throw new BadRequestException({
          code: 'QUESTION_RETIRED',
          message: `Question ${q.id} is retired`,
          fieldErrors: {},
        });
      }
    }

    const maxScore = questions.reduce((sum, q) => sum + q.marks, 0);
    await this.prisma.$transaction(async (tx) => {
      await tx.testQuestion.deleteMany({ where: { testId: id } });
      await tx.testQuestion.createMany({
        data: dto.questionIds.map((questionId, index) => ({
          testId: id,
          questionId,
          sortOrder: index,
          marks: questions.find((q) => q.id === questionId)?.marks,
        })),
      });
      await tx.test.update({
        where: { id },
        data: {
          questionCount: dto.questionIds.length,
          maxScore,
          revision: { increment: 1 },
        },
      });
    });

    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'test.set_questions',
      resourceType: 'Test',
      resourceId: id,
      after: { questionIds: dto.questionIds, maxScore },
      severity: AuditSeverity.notice,
    });
    return this.findOne(id);
  }

  async publish(id: string, actor: Actor) {
    const test = await this.findOne(id);
    if (test.questions.length === 0) {
      throw new BadRequestException({
        code: 'TEST_INVALID',
        message: 'Cannot publish a test with no questions',
        fieldErrors: {},
      });
    }
    if (test.questions.length !== test.questionCount) {
      throw new BadRequestException({
        code: 'TEST_INVALID',
        message: 'Active question count differs from configured count',
        fieldErrors: {},
      });
    }
    for (const tq of test.questions) {
      if (tq.question.status !== QuestionStatus.approved) {
        throw new BadRequestException({
          code: 'TEST_INVALID',
          message: `Question ${tq.questionId} is not approved`,
          fieldErrors: {},
        });
      }
      const correct = tq.question.options.filter((o) => o.isCorrect).length;
      if (correct !== 1) {
        throw new BadRequestException({
          code: 'TEST_INVALID',
          message: `Question ${tq.questionId} lacks exactly one correct option`,
          fieldErrors: {},
        });
      }
    }

    const published = await this.prisma.test.update({
      where: { id },
      data: {
        lifecycle: ContentLifecycle.published,
        publishedAt: new Date(),
        revision: { increment: 1 },
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'test.publish',
      resourceType: 'Test',
      resourceId: id,
      before: { lifecycle: test.lifecycle },
      after: { lifecycle: published.lifecycle },
      severity: AuditSeverity.notice,
    });
    return published;
  }
}
