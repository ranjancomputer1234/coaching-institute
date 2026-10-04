import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContentLifecycle, AuditSeverity } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateBannerDto, UpdateBannerDto } from './dto/banner.dto';

type Actor = { userId: string; email?: string };

const UNSAFE_SCHEMES = /^(javascript|data|vbscript):/i;

@Injectable()
export class BannersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.banner.findMany({
      orderBy: [{ priority: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Banner ${id} not found`,
        fieldErrors: {},
      });
    }
    return banner;
  }

  private assertTarget(kind: string, ref: string) {
    if (!kind?.trim() || !ref?.trim()) {
      throw new BadRequestException({
        code: 'INVALID_TARGET',
        message: 'Target kind and reference are required',
        fieldErrors: {},
      });
    }
    if (kind === 'external' && UNSAFE_SCHEMES.test(ref)) {
      throw new BadRequestException({
        code: 'INVALID_TARGET',
        message: 'Unsafe external URL scheme',
        fieldErrors: { targetRef: ['Unsafe scheme'] },
      });
    }
  }

  async create(dto: CreateBannerDto, actor: Actor) {
    this.assertTarget(dto.targetKind, dto.targetRef);
    const banner = await this.prisma.banner.create({
      data: {
        campaignName: dto.campaignName,
        title: dto.title,
        subtitle: dto.subtitle,
        ctaLabel: dto.ctaLabel,
        placement: dto.placement,
        priority: dto.priority ?? 100,
        targetKind: dto.targetKind,
        targetRef: dto.targetRef,
        imageUrl: dto.imageUrl,
        altText: dto.altText,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        lifecycle: ContentLifecycle.draft,
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'banner.create',
      resourceType: 'Banner',
      resourceId: banner.id,
      after: banner,
    });
    return banner;
  }

  async update(id: string, dto: UpdateBannerDto, actor: Actor) {
    const before = await this.findOne(id);
    if (dto.targetKind || dto.targetRef) {
      this.assertTarget(
        dto.targetKind ?? before.targetKind,
        dto.targetRef ?? before.targetRef,
      );
    }
    const banner = await this.prisma.banner.update({
      where: { id },
      data: {
        campaignName: dto.campaignName,
        title: dto.title,
        subtitle: dto.subtitle,
        ctaLabel: dto.ctaLabel,
        placement: dto.placement,
        priority: dto.priority,
        targetKind: dto.targetKind,
        targetRef: dto.targetRef,
        imageUrl: dto.imageUrl,
        altText: dto.altText,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        revision: { increment: 1 },
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'banner.update',
      resourceType: 'Banner',
      resourceId: id,
      before: { title: before.title },
      after: { title: banner.title },
    });
    return banner;
  }

  async publish(id: string, actor: Actor) {
    const before = await this.findOne(id);
    this.assertTarget(before.targetKind, before.targetRef);
    const banner = await this.prisma.banner.update({
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
      action: 'banner.publish',
      resourceType: 'Banner',
      resourceId: id,
      before: { lifecycle: before.lifecycle },
      after: { lifecycle: banner.lifecycle },
      severity: AuditSeverity.notice,
    });
    return banner;
  }

  async pause(id: string, actor: Actor) {
    const before = await this.findOne(id);
    const banner = await this.prisma.banner.update({
      where: { id },
      data: {
        lifecycle: ContentLifecycle.unpublished,
        revision: { increment: 1 },
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'banner.pause',
      resourceType: 'Banner',
      resourceId: id,
      before: { lifecycle: before.lifecycle },
      after: { lifecycle: banner.lifecycle },
    });
    return banner;
  }
}
