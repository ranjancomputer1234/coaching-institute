import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContentLifecycle, AuditSeverity } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateExploreSectionDto,
  UpdateExploreSectionDto,
} from './dto/explore.dto';

const ALLOWED_TARGET_KINDS = new Set([
  'course',
  'lesson',
  'test',
  'news',
  'fact',
  'topic',
  'interviewQuestion',
  'interviewCategory',
  'liveClass',
  'document',
  'exam',
  'section',
  'catalog',
]);

type Actor = { userId: string; email?: string };

@Injectable()
export class ExploreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.exploreSection.findMany({
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    });
  }

  async findOne(id: string) {
    const section = await this.prisma.exploreSection.findUnique({
      where: { id },
    });
    if (!section) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Explore section ${id} not found`,
        fieldErrors: {},
      });
    }
    return section;
  }

  private assertTarget(kind: string, ref: string) {
    if (!ALLOWED_TARGET_KINDS.has(kind)) {
      throw new BadRequestException({
        code: 'INVALID_TARGET',
        message: `Unsupported target kind: ${kind}`,
        fieldErrors: { targetKind: ['Unsupported target kind'] },
      });
    }
    if (!ref?.trim()) {
      throw new BadRequestException({
        code: 'INVALID_TARGET',
        message: 'Target reference is required',
        fieldErrors: { targetRef: ['Required'] },
      });
    }
  }

  async create(dto: CreateExploreSectionDto, actor: Actor) {
    this.assertTarget(dto.targetKind, dto.targetRef);
    const section = await this.prisma.exploreSection.create({
      data: {
        slug: dto.slug,
        title: dto.title,
        description: dto.description,
        badge: dto.badge,
        category: dto.category,
        targetKind: dto.targetKind,
        targetRef: dto.targetRef,
        pricingFilter: dto.pricingFilter ?? 'all',
        sortOrder: dto.sortOrder ?? 0,
        featured: dto.featured ?? false,
        homeVisible: dto.homeVisible ?? true,
        iconKey: dto.iconKey,
        themeKey: dto.themeKey,
        lifecycle: ContentLifecycle.draft,
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'explore.create',
      resourceType: 'ExploreSection',
      resourceId: section.id,
      after: section,
    });
    return section;
  }

  async update(id: string, dto: UpdateExploreSectionDto, actor: Actor) {
    const before = await this.findOne(id);
    if (dto.targetKind || dto.targetRef) {
      this.assertTarget(
        dto.targetKind ?? before.targetKind,
        dto.targetRef ?? before.targetRef,
      );
    }
    const section = await this.prisma.exploreSection.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        badge: dto.badge,
        category: dto.category,
        targetKind: dto.targetKind,
        targetRef: dto.targetRef,
        pricingFilter: dto.pricingFilter,
        sortOrder: dto.sortOrder,
        featured: dto.featured,
        homeVisible: dto.homeVisible,
        iconKey: dto.iconKey,
        themeKey: dto.themeKey,
        revision: { increment: 1 },
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'explore.update',
      resourceType: 'ExploreSection',
      resourceId: id,
      before: { title: before.title, sortOrder: before.sortOrder },
      after: { title: section.title, sortOrder: section.sortOrder },
    });
    return section;
  }

  async publish(id: string, actor: Actor) {
    const before = await this.findOne(id);
    this.assertTarget(before.targetKind, before.targetRef);
    const section = await this.prisma.exploreSection.update({
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
      action: 'explore.publish',
      resourceType: 'ExploreSection',
      resourceId: id,
      before: { lifecycle: before.lifecycle },
      after: { lifecycle: section.lifecycle },
      severity: AuditSeverity.notice,
    });
    return section;
  }

  async reorder(orderedIds: string[], actor: Actor) {
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.exploreSection.update({
          where: { id },
          data: { sortOrder: index, revision: { increment: 1 } },
        }),
      ),
    );
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'explore.reorder',
      resourceType: 'ExploreSection',
      after: { orderedIds },
      severity: AuditSeverity.notice,
    });
    return this.findAll();
  }
}
