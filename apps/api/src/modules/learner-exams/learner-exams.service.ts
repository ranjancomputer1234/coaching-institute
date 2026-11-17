import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ContentLifecycle,
  CourseCommercialMode,
  EntitlementState,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { parseCursorTake, toPage } from '../../common/utils/pagination';
import {
  parseJsonArray,
  resolveCommercialAccess,
  resolvePricingAccess,
} from '../../common/utils/content-access';

const published = { lifecycle: ContentLifecycle.published };

@Injectable()
export class LearnerExamsService {
  constructor(private readonly prisma: PrismaService) {}

  private async isEntitled(learnerId: string, scopeRefs: string[]) {
    const refs = scopeRefs.filter(Boolean);
    if (refs.length === 0) return false;
    const now = new Date();
    const row = await this.prisma.entitlement.findFirst({
      where: {
        learnerId,
        state: EntitlementState.active,
        OR: [{ scopeRef: { in: refs } }, { courseId: { in: refs } }],
        AND: [
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
          { startsAt: { lte: now } },
        ],
      },
      select: { id: true },
    });
    return Boolean(row);
  }

  private async mapExam(
    exam: {
      id: string;
      title: string;
      summary: string | null;
      description: string | null;
      commercialMode: CourseCommercialMode;
      iconKey: string | null;
      themeKey: string | null;
      imageUrl: string | null;
      learnerCount: number;
      relatedExamsJson: string;
      _count?: { tests: number };
    },
    learnerId?: string,
  ) {
    const pricing =
      exam.commercialMode === CourseCommercialMode.paid ? 'paid' : 'free';
    const entitled =
      pricing === 'paid' && learnerId
        ? await this.isEntitled(learnerId, [exam.id])
        : false;
    return {
      id: exam.id,
      title: exam.title,
      summary: exam.summary,
      description: exam.description,
      pricing,
      commercialMode: exam.commercialMode,
      iconKey: exam.iconKey,
      themeKey: exam.themeKey,
      imageUrl: exam.imageUrl,
      testCount: exam._count?.tests ?? 0,
      learnerCount: exam.learnerCount,
      relatedExams: parseJsonArray<string>(exam.relatedExamsJson),
      access: resolveCommercialAccess(exam.commercialMode, {
        learnerId,
        entitled,
      }),
    };
  }

  private async mapTest(
    test: {
      id: string;
      examId: string | null;
      courseId?: string | null;
      title: string;
      questionCount: number;
      durationMinutes: number;
      pricing: string;
      mode: string;
      marking: string;
      negativeMarking: boolean;
      negativeMarkingLabel: string | null;
      passThreshold: number;
      attemptLimit: number | null;
    },
    learnerId?: string,
  ) {
    const entitled =
      (test.pricing ?? 'free').toLowerCase() === 'paid' && learnerId
        ? await this.isEntitled(learnerId, [
            test.id,
            test.examId ?? '',
            test.courseId ?? '',
          ])
        : false;
    return {
      id: test.id,
      examId: test.examId,
      title: test.title,
      questionCount: test.questionCount,
      durationMinutes: test.durationMinutes,
      pricing: test.pricing,
      mode: test.mode,
      marking: test.marking,
      negativeMarking:
        test.negativeMarkingLabel ?? (test.negativeMarking ? '-0.25' : '0'),
      passThreshold: test.passThreshold,
      attemptLimit: test.attemptLimit,
      access: resolvePricingAccess(test.pricing, { learnerId, entitled }),
    };
  }

  async listExams(opts: {
    search?: string;
    pricing?: string;
    cursor?: string;
    learnerId?: string;
  }) {
    const { take, pageSize, ...cursorArgs } = parseCursorTake(opts.cursor);
    const search = opts.search?.trim();
    const pricing = opts.pricing?.trim().toLowerCase();

    const where: Prisma.ExamWhereInput = {
      ...published,
      ...(pricing === 'free'
        ? { commercialMode: CourseCommercialMode.free }
        : pricing === 'paid'
          ? { commercialMode: CourseCommercialMode.paid }
          : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { summary: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.exam.findMany({
        where,
        ...cursorArgs,
        take,
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        include: {
          _count: {
            select: { tests: { where: published } },
          },
        },
      }),
      this.prisma.exam.count({ where }),
    ]);

    const page = toPage(rows, pageSize, total);
    return {
      ...page,
      items: await Promise.all(
        page.items.map((exam) => this.mapExam(exam, opts.learnerId)),
      ),
    };
  }

  async getExam(id: string, learnerId?: string) {
    const exam = await this.prisma.exam.findFirst({
      where: { id, ...published },
      include: {
        _count: { select: { tests: { where: published } } },
      },
    });
    if (!exam) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Exam ${id} not found`,
        fieldErrors: {},
      });
    }
    return this.mapExam(exam, learnerId);
  }

  async listTests(opts: { examId?: string; learnerId?: string }) {
    const where: Prisma.TestWhereInput = {
      ...published,
      ...(opts.examId ? { examId: opts.examId } : {}),
    };
    const rows = await this.prisma.test.findMany({
      where,
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
    });
    return Promise.all(rows.map((test) => this.mapTest(test, opts.learnerId)));
  }

  async getTest(id: string, learnerId?: string) {
    const test = await this.prisma.test.findFirst({
      where: { id, ...published },
    });
    if (!test) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Test ${id} not found`,
        fieldErrors: {},
      });
    }
    return this.mapTest(test, learnerId);
  }
}
