import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ContentLifecycle,
  EditorialKind,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { parseCursorTake, toPage } from '../../common/utils/pagination';
import {
  parseJsonArray,
  resolvePricingAccess,
} from '../../common/utils/content-access';

const published = { lifecycle: ContentLifecycle.published };

type Entry = {
  id: string;
  label: string;
  value?: string;
  text?: string;
  group?: string;
  iconColor?: string;
};

@Injectable()
export class LearnerEditorialService {
  constructor(private readonly prisma: PrismaService) {}

  private async listCategories(
    kind: EditorialKind,
    opts: { search?: string; pricing?: string; cursor?: string },
  ) {
    const { take, pageSize, ...cursorArgs } = parseCursorTake(opts.cursor);
    const search = opts.search?.trim();
    const pricing = opts.pricing?.trim().toLowerCase();

    const where: Prisma.ContentCategoryWhereInput = {
      kind,
      ...published,
      ...(pricing === 'free' || pricing === 'paid' ? { pricing } : {}),
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
      this.prisma.contentCategory.findMany({
        where,
        ...cursorArgs,
        take,
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.contentCategory.count({ where }),
    ]);

    const page = toPage(rows, pageSize, total);
    return {
      ...page,
      items: page.items.map((row) => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        pricing: row.pricing,
        iconKey: row.iconKey,
        access: resolvePricingAccess(row.pricing),
      })),
    };
  }

  // —— News ——
  listNewsCategories(opts: {
    search?: string;
    pricing?: string;
    cursor?: string;
  }) {
    return this.listCategories(EditorialKind.news, opts);
  }

  async listNews(opts: {
    categoryId?: string;
    search?: string;
    cursor?: string;
    learnerId?: string;
  }) {
    const { take, pageSize, ...cursorArgs } = parseCursorTake(opts.cursor);
    const search = opts.search?.trim();
    const where: Prisma.EditorialItemWhereInput = {
      kind: EditorialKind.news,
      ...published,
      ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
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
      this.prisma.editorialItem.findMany({
        where,
        ...cursorArgs,
        take,
        orderBy: [
          { featured: 'desc' },
          { publishedAt: 'desc' },
          { id: 'desc' },
        ],
      }),
      this.prisma.editorialItem.count({ where }),
    ]);

    const page = toPage(rows, pageSize, total);
    return {
      ...page,
      items: page.items.map((row) => this.mapNews(row, opts.learnerId, false)),
    };
  }

  async getNews(id: string, learnerId?: string) {
    const row = await this.prisma.editorialItem.findFirst({
      where: { id, kind: EditorialKind.news, ...published },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `News article ${id} not found`,
        fieldErrors: {},
      });
    }
    return this.mapNews(row, learnerId, true);
  }

  private mapNews(
    row: {
      id: string;
      categoryId: string | null;
      category: string | null;
      title: string;
      summary: string | null;
      body: string | null;
      byline: string | null;
      publishedAt: Date | null;
      createdAt: Date;
      readingMinutes: number | null;
      tagsJson: string;
      featured: boolean;
      imageUrl: string | null;
      highlightsJson: string;
      pricing: string;
    },
    learnerId: string | undefined,
    includeBody: boolean,
  ) {
    const access = resolvePricingAccess(row.pricing, { learnerId });
    const tags = parseJsonArray<string>(row.tagsJson);
    const highlights = parseJsonArray<string>(row.highlightsJson);
    const body =
      includeBody && access.granted
        ? this.normalizeBody(row.body)
        : includeBody
          ? []
          : undefined;
    return {
      id: row.id,
      categoryId: row.categoryId || row.category || 'news',
      title: row.title,
      excerpt: row.summary,
      byline: row.byline || 'RACI News',
      publishedAt: (row.publishedAt ?? row.createdAt).toISOString(),
      readingMinutes: row.readingMinutes ?? 3,
      tags,
      featured: row.featured,
      imageUrl: row.imageUrl,
      ...(includeBody ? { body, highlights: access.granted ? highlights : [] } : {}),
      access,
    };
  }

  private normalizeBody(body: string | null): string[] {
    if (!body) return [];
    try {
      const parsed = JSON.parse(body) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is string => typeof x === 'string');
      }
    } catch {
      /* plain text */
    }
    return [body];
  }

  // —— Awareness ——
  async listAwarenessTopics(opts: {
    search?: string;
    pricing?: string;
    cursor?: string;
    learnerId?: string;
  }) {
    const { take, pageSize, ...cursorArgs } = parseCursorTake(opts.cursor);
    const search = opts.search?.trim();
    const pricing = opts.pricing?.trim().toLowerCase();
    const where: Prisma.EditorialItemWhereInput = {
      kind: EditorialKind.awareness,
      ...published,
      ...(pricing === 'free' || pricing === 'paid' ? { pricing } : {}),
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
      this.prisma.editorialItem.findMany({
        where,
        ...cursorArgs,
        take,
        orderBy: [{ title: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          title: true,
          summary: true,
          pricing: true,
          commercialMode: true,
          iconKey: true,
          imageUrl: true,
        },
      }),
      this.prisma.editorialItem.count({ where }),
    ]);

    const page = toPage(rows, pageSize, total);
    return {
      ...page,
      items: page.items.map((row) => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        pricing: row.pricing,
        commercialMode: row.commercialMode,
        iconKey: row.iconKey || 'book',
        imageUrl: row.imageUrl,
        access: resolvePricingAccess(row.pricing, {
          learnerId: opts.learnerId,
        }),
      })),
    };
  }

  async getAwarenessTopic(id: string, learnerId?: string) {
    const row = await this.prisma.editorialItem.findFirst({
      where: { id, kind: EditorialKind.awareness, ...published },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Topic ${id} not found`,
        fieldErrors: {},
      });
    }
    const access = resolvePricingAccess(row.pricing, { learnerId });
    const entries = access.granted
      ? parseJsonArray<Entry>(row.entriesJson)
      : [];
    return {
      id: row.id,
      title: row.title,
      summary: row.summary,
      pricing: row.pricing,
      schema: row.schema || 'pairs',
      summaryChips: parseJsonArray<string>(row.summaryChipsJson),
      entries,
      access,
    };
  }

  // —— Facts ——
  listFactCategories(opts: {
    search?: string;
    pricing?: string;
    cursor?: string;
  }) {
    return this.listCategories(EditorialKind.fact, opts);
  }

  async listFacts(opts: {
    categoryId?: string;
    cursor?: string;
    learnerId?: string;
  }) {
    const { take, pageSize, ...cursorArgs } = parseCursorTake(opts.cursor);
    const where: Prisma.EditorialItemWhereInput = {
      kind: EditorialKind.fact,
      ...published,
      ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.editorialItem.findMany({
        where,
        ...cursorArgs,
        take,
        orderBy: [
          { featured: 'desc' },
          { publishedAt: 'desc' },
          { id: 'desc' },
        ],
        include: {
          reactions: opts.learnerId
            ? { where: { learnerId: opts.learnerId }, take: 1 }
            : false,
        },
      }),
      this.prisma.editorialItem.count({ where }),
    ]);

    const page = toPage(rows, pageSize, total);
    return {
      ...page,
      items: page.items.map((row) => this.mapFact(row, opts.learnerId)),
    };
  }

  async getFact(id: string, learnerId?: string) {
    const row = await this.prisma.editorialItem.findFirst({
      where: { id, kind: EditorialKind.fact, ...published },
      include: {
        reactions: learnerId
          ? { where: { learnerId }, take: 1 }
          : false,
      },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Fact ${id} not found`,
        fieldErrors: {},
      });
    }
    return this.mapFact(row, learnerId);
  }

  private mapFact(
    row: {
      id: string;
      categoryId: string | null;
      category: string | null;
      title: string;
      summary: string | null;
      explanation: string | null;
      body: string | null;
      reactionCount: number;
      featured: boolean;
      quizId: string | null;
      reactions?: { reacted: boolean; bookmarked: boolean }[];
    },
    _learnerId?: string,
  ) {
    const reaction = row.reactions?.[0];
    return {
      id: row.id,
      categoryId: row.categoryId || row.category || 'facts',
      text: row.summary || row.title,
      explanation: row.explanation || row.body,
      reactionCount: row.reactionCount,
      reacted: reaction?.reacted ?? false,
      bookmarked: reaction?.bookmarked ?? false,
      featured: row.featured,
      quizId: row.quizId,
    };
  }

  async setFactReaction(id: string, learnerId: string, reacted: boolean) {
    const fact = await this.prisma.editorialItem.findFirst({
      where: { id, kind: EditorialKind.fact, ...published },
    });
    if (!fact) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Fact ${id} not found`,
        fieldErrors: {},
      });
    }

    const existing = await this.prisma.factReaction.findUnique({
      where: { factId_learnerId: { factId: id, learnerId } },
    });

    const wasReacted = existing?.reacted ?? false;
    let delta = 0;
    if (reacted && !wasReacted) delta = 1;
    if (!reacted && wasReacted) delta = -1;

    await this.prisma.$transaction([
      this.prisma.factReaction.upsert({
        where: { factId_learnerId: { factId: id, learnerId } },
        create: {
          factId: id,
          learnerId,
          reacted,
          bookmarked: existing?.bookmarked ?? false,
        },
        update: { reacted },
      }),
      ...(delta !== 0
        ? [
            this.prisma.editorialItem.update({
              where: { id },
              data: { reactionCount: { increment: delta } },
            }),
          ]
        : []),
    ]);

    return this.getFact(id, learnerId);
  }

  // —— Interview ——
  listInterviewCategories(opts: {
    search?: string;
    pricing?: string;
    cursor?: string;
  }) {
    return this.listCategories(EditorialKind.interview, opts);
  }

  async listInterviewQuestions(opts: {
    categoryId?: string;
    learnerId?: string;
  }) {
    const where: Prisma.EditorialItemWhereInput = {
      kind: EditorialKind.interview,
      ...published,
      ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
    };
    const rows = await this.prisma.editorialItem.findMany({
      where,
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map((row) => this.mapInterview(row));
  }

  async getInterviewQuestion(id: string) {
    const row = await this.prisma.editorialItem.findFirst({
      where: { id, kind: EditorialKind.interview, ...published },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Question ${id} not found`,
        fieldErrors: {},
      });
    }
    return this.mapInterview(row);
  }

  private mapInterview(row: {
    id: string;
    categoryId: string | null;
    category: string | null;
    title: string;
    prompt: string | null;
    modelAnswer: string | null;
    body: string | null;
  }) {
    return {
      id: row.id,
      categoryId: row.categoryId || row.category || 'interview',
      prompt: row.prompt || row.title,
      modelAnswer: row.modelAnswer || row.body || '',
    };
  }
}
