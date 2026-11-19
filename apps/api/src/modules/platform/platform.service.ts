import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditSeverity,
  ContentLifecycle,
  CourseCommercialMode,
  EditorialKind,
  EntitlementState,
  LearnerAccountState,
  LiveClassStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { DailyService } from './daily.service';
import { LEGAL_PAGE_DEFAULTS } from './legal-pages';
import {
  CreateCampaignDto,
  CreateCouponDto,
  CreateEditorialDto,
  CreateLegalPageDto,
  CreateLiveClassDto,
  CreateOrderDto,
  CreateProductDto,
  CreateRefundDto,
  CreateSupportDto,
  CreateTemplateDto,
  ReconcileOrderDto,
  UpdateCampaignDto,
  UpdateContentCategoryDto,
  UpdateCouponDto,
  UpdateEditorialDto,
  UpdateLegalPageDto,
  UpdateLiveClassDto,
  UpdateProductDto,
  UpdateSupportDto,
  UpdateTemplateDto,
  UpsertSettingDto,
} from './platform.dto';

type Actor = { userId: string; email?: string };

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly daily: DailyService,
    private readonly email: EmailService,
  ) {}

  providers() {
    return {
      // Daily live rooms — requires API key (URL alone is not enough).
      live: this.daily.isConfigured(),
      push: Boolean(this.config.get('PUSH_PROVIDER_KEY')),
      email: this.email.isConfigured(),
      emailProvider: this.email.providerName(),
      payments: Boolean(this.config.get('PAYMENT_PROVIDER_KEY')),
      storage: Boolean(this.config.get('OBJECT_STORAGE_BUCKET')),
      video: Boolean(
        this.config.get('MUX_TOKEN_ID') && this.config.get('MUX_TOKEN_SECRET'),
      ),
      videoBackup: Boolean(
        this.config.get('CLOUDINARY_CLOUD_NAME') &&
        this.config.get('CLOUDINARY_API_KEY') &&
        this.config.get('CLOUDINARY_API_SECRET'),
      ),
      mfa: false,
    };
  }

  listEditorial(kind?: EditorialKind) {
    return this.prisma.editorialItem.findMany({
      where: kind ? { kind } : undefined,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createEditorial(dto: CreateEditorialDto, actor: Actor) {
    const item = await this.prisma.editorialItem.create({
      data: {
        kind: dto.kind,
        title: dto.title,
        summary: dto.summary,
        body: dto.body,
        category: dto.category,
        categoryId: dto.categoryId,
        pricing: dto.pricing ?? 'free',
        commercialMode:
          dto.pricing === 'paid'
            ? CourseCommercialMode.paid
            : CourseCommercialMode.free,
        featured: dto.featured ?? false,
        imageUrl: dto.imageUrl,
        iconKey: dto.iconKey,
        byline: dto.byline,
        readingMinutes: dto.readingMinutes,
        explanation: dto.explanation,
        quizId: dto.quizId,
        schema: dto.schema,
        prompt: dto.prompt,
        modelAnswer: dto.modelAnswer,
        entriesJson: dto.entriesJson ?? '[]',
        summaryChipsJson: dto.summaryChipsJson ?? '[]',
        tagsJson: dto.tagsJson ?? '[]',
        highlightsJson: dto.highlightsJson ?? '[]',
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'editorial.create',
      resourceType: 'EditorialItem',
      resourceId: item.id,
      after: { kind: item.kind, title: item.title },
    });
    return item;
  }

  listContentCategories(kind?: EditorialKind) {
    return this.prisma.contentCategory.findMany({
      where: kind ? { kind } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  async createContentCategory(
    dto: {
      id?: string;
      kind: EditorialKind;
      title: string;
      summary?: string;
      pricing?: string;
      iconKey?: string;
      sortOrder?: number;
    },
    actor: Actor,
  ) {
    const row = await this.prisma.contentCategory.create({
      data: {
        ...(dto.id ? { id: dto.id } : {}),
        kind: dto.kind,
        title: dto.title,
        summary: dto.summary,
        pricing: dto.pricing ?? 'free',
        commercialMode:
          dto.pricing === 'paid'
            ? CourseCommercialMode.paid
            : CourseCommercialMode.free,
        iconKey: dto.iconKey,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'content_category.create',
      resourceType: 'ContentCategory',
      resourceId: row.id,
      after: { kind: row.kind, title: row.title },
    });
    return row;
  }

  async publishContentCategory(id: string, actor: Actor) {
    const before = await this.prisma.contentCategory.findUnique({
      where: { id },
    });
    if (!before) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Category not found',
        fieldErrors: {},
      });
    }
    const row = await this.prisma.contentCategory.update({
      where: { id },
      data: {
        lifecycle: ContentLifecycle.published,
        publishedAt: new Date(),
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'content_category.publish',
      resourceType: 'ContentCategory',
      resourceId: id,
      before: { lifecycle: before.lifecycle },
      after: { lifecycle: row.lifecycle },
      severity: AuditSeverity.notice,
    });
    return row;
  }

  async getEditorial(id: string) {
    const item = await this.prisma.editorialItem.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Editorial item not found',
        fieldErrors: {},
      });
    }
    return item;
  }

  async updateEditorial(id: string, dto: UpdateEditorialDto, actor: Actor) {
    await this.getEditorial(id);
    const item = await this.prisma.editorialItem.update({
      where: { id },
      data: {
        title: dto.title,
        summary: dto.summary,
        body: dto.body,
        category: dto.category,
        categoryId: dto.categoryId,
        pricing: dto.pricing,
        ...(dto.pricing
          ? {
              commercialMode:
                dto.pricing === 'paid'
                  ? CourseCommercialMode.paid
                  : CourseCommercialMode.free,
            }
          : {}),
        featured: dto.featured,
        imageUrl: dto.imageUrl,
        iconKey: dto.iconKey,
        byline: dto.byline,
        readingMinutes: dto.readingMinutes,
        explanation: dto.explanation,
        quizId: dto.quizId,
        schema: dto.schema,
        prompt: dto.prompt,
        modelAnswer: dto.modelAnswer,
        entriesJson: dto.entriesJson,
        summaryChipsJson: dto.summaryChipsJson,
        tagsJson: dto.tagsJson,
        highlightsJson: dto.highlightsJson,
        revision: { increment: 1 },
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'editorial.update',
      resourceType: 'EditorialItem',
      resourceId: id,
      after: { title: item.title },
    });
    return item;
  }

  async getContentCategory(id: string) {
    const row = await this.prisma.contentCategory.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Category not found',
        fieldErrors: {},
      });
    }
    return row;
  }

  async updateContentCategory(
    id: string,
    dto: UpdateContentCategoryDto,
    actor: Actor,
  ) {
    await this.getContentCategory(id);
    const row = await this.prisma.contentCategory.update({
      where: { id },
      data: {
        title: dto.title,
        summary: dto.summary,
        pricing: dto.pricing,
        ...(dto.pricing
          ? {
              commercialMode:
                dto.pricing === 'paid'
                  ? CourseCommercialMode.paid
                  : CourseCommercialMode.free,
            }
          : {}),
        iconKey: dto.iconKey,
        sortOrder: dto.sortOrder,
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'content_category.update',
      resourceType: 'ContentCategory',
      resourceId: id,
      after: { title: row.title },
    });
    return row;
  }

  async publishEditorial(id: string, actor: Actor) {
    const before = await this.prisma.editorialItem.findUnique({
      where: { id },
    });
    if (!before) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Editorial item not found',
        fieldErrors: {},
      });
    }
    const item = await this.prisma.editorialItem.update({
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
      action: 'editorial.publish',
      resourceType: 'EditorialItem',
      resourceId: id,
      before: { lifecycle: before.lifecycle },
      after: { lifecycle: item.lifecycle },
      severity: AuditSeverity.notice,
    });
    return item;
  }

  async archiveEditorial(id: string, actor: Actor) {
    const before = await this.getEditorial(id);
    const item = await this.prisma.editorialItem.update({
      where: { id },
      data: {
        lifecycle: ContentLifecycle.archived,
        revision: { increment: 1 },
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'editorial.archive',
      resourceType: 'EditorialItem',
      resourceId: id,
      before: { lifecycle: before.lifecycle },
      after: { lifecycle: item.lifecycle },
      severity: AuditSeverity.notice,
    });
    return item;
  }

  async archiveContentCategory(id: string, actor: Actor) {
    const before = await this.getContentCategory(id);
    const row = await this.prisma.contentCategory.update({
      where: { id },
      data: { lifecycle: ContentLifecycle.archived },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'content_category.archive',
      resourceType: 'ContentCategory',
      resourceId: id,
      before: { lifecycle: before.lifecycle },
      after: { lifecycle: row.lifecycle },
      severity: AuditSeverity.notice,
    });
    return row;
  }

  listLiveClasses() {
    return this.prisma.liveClass.findMany({
      include: {
        batch: { select: { id: true, name: true } },
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  async getLiveClass(id: string) {
    const row = await this.prisma.liveClass.findUnique({
      where: { id },
      include: { batch: { select: { id: true, name: true } } },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Live class not found',
        fieldErrors: {},
      });
    }
    return row;
  }

  async cancelLiveClass(id: string, actor: Actor) {
    const before = await this.getLiveClass(id);
    const row = await this.prisma.liveClass.update({
      where: { id },
      data: { status: LiveClassStatus.cancelled },
      include: { batch: { select: { id: true, name: true } } },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'live.cancel',
      resourceType: 'LiveClass',
      resourceId: id,
      before: { status: before.status },
      after: { status: row.status },
      severity: AuditSeverity.notice,
    });
    return row;
  }

  async updateLiveClass(id: string, dto: UpdateLiveClassDto, actor: Actor) {
    await this.getLiveClass(id);
    if (dto.batchId) {
      const batch = await this.prisma.batch.findUnique({
        where: { id: dto.batchId },
        select: { id: true },
      });
      if (!batch) {
        throw new BadRequestException({
          code: 'INVALID_BATCH',
          message: 'Batch not found',
          fieldErrors: { batchId: 'Unknown batch' },
        });
      }
    }
    const learnerIds =
      dto.learnerIds !== undefined ? [...new Set(dto.learnerIds)] : undefined;
    if (learnerIds?.length) {
      const found = await this.prisma.learner.count({
        where: { id: { in: learnerIds } },
      });
      if (found !== learnerIds.length) {
        throw new BadRequestException({
          code: 'INVALID_LEARNERS',
          message: 'One or more learners were not found',
          fieldErrors: { learnerIds: 'Unknown learner id(s)' },
        });
      }
    }
    const row = await this.prisma.liveClass.update({
      where: { id },
      data: {
        title: dto.title,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        courseId: dto.courseId,
        batchId: dto.batchId,
        ...(learnerIds !== undefined
          ? { audienceLearnerIdsJson: JSON.stringify(learnerIds) }
          : {}),
        hostName: dto.hostName,
        capacity: dto.capacity,
      },
      include: { batch: { select: { id: true, name: true } } },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'live.update',
      resourceType: 'LiveClass',
      resourceId: id,
      after: { title: row.title, batchId: row.batchId },
    });
    return row;
  }

  private parseAudienceIds(json: string | null | undefined): string[] {
    try {
      const parsed = JSON.parse(json || '[]') as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((x): x is string => typeof x === 'string')
        : [];
    } catch {
      return [];
    }
  }

  private async resolveAudienceLearnerIds(live: {
    batchId: string | null;
    audienceLearnerIdsJson: string;
  }): Promise<string[]> {
    const explicit = this.parseAudienceIds(live.audienceLearnerIdsJson);
    if (explicit.length) return [...new Set(explicit)];
    if (!live.batchId) return [];
    const members = await this.prisma.batchMembership.findMany({
      where: { batchId: live.batchId },
      select: { learnerId: true },
    });
    if (members.length) return members.map((m) => m.learnerId);
    const primary = await this.prisma.learner.findMany({
      where: { batchId: live.batchId },
      select: { id: true },
    });
    return primary.map((l) => l.id);
  }

  async createLiveClass(dto: CreateLiveClassDto, actor: Actor) {
    if (dto.batchId) {
      const batch = await this.prisma.batch.findUnique({
        where: { id: dto.batchId },
        select: { id: true },
      });
      if (!batch) {
        throw new BadRequestException({
          code: 'INVALID_BATCH',
          message: 'Batch not found',
          fieldErrors: { batchId: 'Unknown batch' },
        });
      }
    }
    const learnerIds = [...new Set(dto.learnerIds ?? [])];
    if (learnerIds.length) {
      const found = await this.prisma.learner.count({
        where: { id: { in: learnerIds } },
      });
      if (found !== learnerIds.length) {
        throw new BadRequestException({
          code: 'INVALID_LEARNERS',
          message: 'One or more learners were not found',
          fieldErrors: { learnerIds: 'Unknown learner id(s)' },
        });
      }
    }

    const row = await this.prisma.liveClass.create({
      data: {
        title: dto.title,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        courseId: dto.courseId,
        batchId: dto.batchId,
        audienceLearnerIdsJson: JSON.stringify(learnerIds),
        hostName: dto.hostName,
        capacity: dto.capacity,
        status: LiveClassStatus.draft,
        provider: this.daily.isConfigured() ? 'daily' : 'unconfigured',
      },
      include: { batch: { select: { id: true, name: true } } },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'live.create',
      resourceType: 'LiveClass',
      resourceId: row.id,
      after: {
        title: row.title,
        batchId: row.batchId,
        audienceCount: learnerIds.length,
      },
    });
    return row;
  }

  async scheduleLiveClass(id: string, actor: Actor) {
    const existing = await this.prisma.liveClass.findUnique({
      where: { id },
      include: { batch: { select: { id: true, name: true } } },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Live class not found',
        fieldErrors: {},
      });
    }

    if (!this.daily.isConfigured()) {
      const row = await this.prisma.liveClass.update({
        where: { id },
        data: {
          status: LiveClassStatus.scheduled,
          provider: 'unconfigured',
          joinUrl: null,
          recordingStatus: 'not_available',
        },
        include: { batch: { select: { id: true, name: true } } },
      });
      await this.audit.write({
        actorId: actor.userId,
        actorDisplay: actor.email,
        action: 'live.schedule',
        resourceType: 'LiveClass',
        resourceId: id,
        outcome: 'capability_unavailable',
        after: { status: row.status, provider: row.provider },
        severity: AuditSeverity.notice,
      });
      return {
        ...row,
        capability: 'unavailable' as const,
        audienceCount: 0,
        notify: { push: false, email: false, queued: false },
        message:
          'Daily is not configured. Set DAILY_API_KEY in apps/api/.env (Daily → Developers), then restart the API.',
      };
    }

    // Reuse existing room if already scheduled.
    let joinUrl = existing.joinUrl;
    let providerRoomId = existing.providerRoomId;
    if (!joinUrl) {
      const room = await this.daily.createRoom({
        name: `redi-${id.slice(-10)}-${Date.now().toString(36)}`,
        startsAt: existing.startsAt,
        endsAt: existing.endsAt,
        capacity: existing.capacity,
      });
      joinUrl = room.url;
      providerRoomId = room.id || room.name;
    }

    const audienceIds = await this.resolveAudienceLearnerIds(existing);
    const when = existing.startsAt.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
    });
    const body = [
      `Live class: ${existing.title}`,
      `Starts: ${when}`,
      joinUrl ? `Join: ${joinUrl}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const pushReady = this.providers().push;
    const emailReady = this.providers().email;
    const campaign = await this.prisma.notificationCampaign.create({
      data: {
        title: `Live: ${existing.title}`,
        body,
        audience: existing.batchId
          ? 'batch'
          : audienceIds.length
            ? 'learners'
            : 'manual',
        audienceRef:
          existing.batchId ??
          (audienceIds.length ? audienceIds.join(',') : null),
        status: pushReady || emailReady ? 'queued' : 'not_sent',
        providerStatus:
          pushReady || emailReady
            ? 'configured_pending_adapter'
            : 'not_configured',
        failureReason:
          pushReady || emailReady
            ? null
            : 'Push/email providers are not configured. Room was created; notifications were not delivered.',
      },
    });

    const row = await this.prisma.liveClass.update({
      where: { id },
      data: {
        status: LiveClassStatus.scheduled,
        provider: 'daily',
        joinUrl,
        providerRoomId,
        recordingStatus: 'not_available',
        notifyCampaignId: campaign.id,
      },
      include: { batch: { select: { id: true, name: true } } },
    });

    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'live.schedule',
      resourceType: 'LiveClass',
      resourceId: id,
      outcome: 'success',
      after: {
        status: row.status,
        provider: row.provider,
        joinUrl: row.joinUrl,
        audienceCount: audienceIds.length,
        notifyCampaignId: campaign.id,
      },
      severity: AuditSeverity.notice,
    });

    let emailQueued = 0;
    if (emailReady && audienceIds.length) {
      const learners = await this.prisma.learner.findMany({
        where: {
          id: { in: audienceIds },
          email: { not: null },
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });
      for (const learner of learners) {
        if (!learner.email) continue;
        await this.email.enqueueLiveClass({
          toEmail: learner.email,
          toName: `${learner.firstName} ${learner.lastName}`.trim(),
          learnerId: learner.id,
          firstName: learner.firstName,
          title: existing.title,
          startsAt: when,
          joinUrl,
        });
        emailQueued += 1;
      }
      if (emailQueued > 0) {
        await this.prisma.notificationCampaign.update({
          where: { id: campaign.id },
          data: {
            status: 'queued',
            providerStatus: `email_outbox:${emailQueued}`,
            failureReason: null,
          },
        });
      }
    }

    const notifyNote =
      emailQueued > 0
        ? `${emailQueued} class email(s) queued for delivery.`
        : pushReady || emailReady
          ? 'Notification campaign recorded (push adapter still pending).'
          : 'Set EMAIL_PROVIDER / EMAIL_PROVIDER_KEY to email class invites.';

    return {
      ...row,
      capability: 'ready' as const,
      audienceCount: audienceIds.length,
      notify: {
        push: pushReady,
        email: emailReady,
        emailQueued,
        queued: Boolean(pushReady || emailQueued),
        campaignId: campaign.id,
      },
      message: `Daily room ready. ${audienceIds.length} student(s) in audience. ${notifyNote}`,
    };
  }

  listTemplates() {
    return this.prisma.notificationTemplate.findMany({
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
    });
  }

  async getTemplate(id: string) {
    const row = await this.prisma.notificationTemplate.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Template not found',
        fieldErrors: {},
      });
    }
    return row;
  }

  async createTemplate(dto: CreateTemplateDto, actor: Actor) {
    const latest = await this.prisma.notificationTemplate.findFirst({
      where: { key: dto.key },
      orderBy: { version: 'desc' },
    });
    const row = await this.prisma.notificationTemplate.create({
      data: {
        key: dto.key,
        version: (latest?.version ?? 0) + 1,
        title: dto.title,
        body: dto.body,
        channel: dto.channel ?? 'push',
        lifecycle: ContentLifecycle.published,
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'notification.template_create',
      resourceType: 'NotificationTemplate',
      resourceId: row.id,
      after: { key: row.key, version: row.version },
    });
    return row;
  }

  async updateTemplate(id: string, dto: UpdateTemplateDto, actor: Actor) {
    await this.getTemplate(id);
    const row = await this.prisma.notificationTemplate.update({
      where: { id },
      data: {
        title: dto.title,
        body: dto.body,
        channel: dto.channel,
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'notification.template_update',
      resourceType: 'NotificationTemplate',
      resourceId: id,
      after: { title: row.title },
    });
    return row;
  }

  listCampaigns() {
    return this.prisma.notificationCampaign.findMany({
      include: { template: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCampaign(id: string) {
    const row = await this.prisma.notificationCampaign.findUnique({
      where: { id },
      include: { template: true },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Campaign not found',
        fieldErrors: {},
      });
    }
    return row;
  }

  async createCampaign(dto: CreateCampaignDto, actor: Actor) {
    const row = await this.prisma.notificationCampaign.create({
      data: {
        title: dto.title,
        body: dto.body,
        audience: dto.audience ?? 'single',
        audienceRef: dto.audienceRef,
        templateId: dto.templateId,
        category: dto.category ?? 'system',
        actionLabel: dto.actionLabel?.trim() || null,
        targetKind: dto.targetKind?.trim() || null,
        targetRef: dto.targetRef?.trim() || null,
        status: 'draft',
        providerStatus: 'not_configured',
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'notification.campaign_create',
      resourceType: 'NotificationCampaign',
      resourceId: row.id,
      after: {
        title: row.title,
        audience: row.audience,
        category: row.category,
      },
    });
    return row;
  }

  async deleteCampaign(id: string, actor: Actor) {
    const existing = await this.getCampaign(id);
    if (existing.status !== 'draft') {
      throw new BadRequestException({
        code: 'CAMPAIGN_LOCKED',
        message: 'Only draft campaigns can be deleted',
        fieldErrors: {},
      });
    }
    await this.prisma.notificationCampaign.delete({ where: { id } });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'notification.campaign_delete',
      resourceType: 'NotificationCampaign',
      resourceId: id,
      before: { title: existing.title, status: existing.status },
      severity: AuditSeverity.notice,
    });
    return { id, deleted: true };
  }

  async updateCampaign(id: string, dto: UpdateCampaignDto, actor: Actor) {
    const existing = await this.getCampaign(id);
    if (existing.status !== 'draft') {
      throw new BadRequestException({
        code: 'CAMPAIGN_LOCKED',
        message: 'Only draft campaigns can be edited',
        fieldErrors: {},
      });
    }
    const row = await this.prisma.notificationCampaign.update({
      where: { id },
      data: {
        title: dto.title,
        body: dto.body,
        audience: dto.audience,
        audienceRef: dto.audienceRef,
        templateId: dto.templateId,
        category: dto.category,
        actionLabel:
          dto.actionLabel !== undefined
            ? dto.actionLabel.trim() || null
            : undefined,
        targetKind:
          dto.targetKind !== undefined
            ? dto.targetKind.trim() || null
            : undefined,
        targetRef:
          dto.targetRef !== undefined ? dto.targetRef.trim() || null : undefined,
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'notification.campaign_update',
      resourceType: 'NotificationCampaign',
      resourceId: id,
      after: { title: row.title, audience: row.audience },
    });
    return row;
  }

  /** Resolve eligible learner IDs for a campaign audience. */
  private async resolveCampaignLearnerIds(campaign: {
    audience: string;
    audienceRef: string | null;
  }): Promise<string[]> {
    const audience = (campaign.audience ?? 'single').toLowerCase();
    const ref = campaign.audienceRef?.trim() || null;
    const deliverable = {
      accountState: {
        notIn: ['suspended', 'blocked', 'deleted'] as LearnerAccountState[],
      },
    };

    if (audience === 'all' || audience === 'everyone') {
      const rows = await this.prisma.learner.findMany({
        where: { accountState: LearnerAccountState.active },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }

    if (!ref) return [];

    if (audience === 'segment' || audience === 'batch') {
      const batch = await this.prisma.batch.findUnique({
        where: { id: ref },
        select: { id: true },
      });
      if (batch) {
        const rows = await this.prisma.learner.findMany({
          where: {
            ...deliverable,
            OR: [
              { batchId: batch.id },
              { memberships: { some: { batchId: batch.id } } },
            ],
          },
          select: { id: true },
        });
        return rows.map((r) => r.id);
      }
    }

    // single (and segment/batch whose ref is not a batch): treat ref as learner id(s).
    const ids = (audience === 'learners' ? ref.split(',') : [ref])
      .map((s) => s.trim())
      .filter(Boolean);
    if (!ids.length) return [];
    const rows = await this.prisma.learner.findMany({
      where: { id: { in: ids }, ...deliverable },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async sendCampaign(id: string, actor: Actor) {
    const existing = await this.prisma.notificationCampaign.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Campaign not found',
        fieldErrors: {},
      });
    }
    const configured = this.providers().push;
    const queued = await this.prisma.notificationCampaign.update({
      where: { id },
      data: configured
        ? {
            status: 'queued',
            providerStatus: 'configured_pending_adapter',
            failureReason: null,
          }
        : {
            status: 'not_sent',
            providerStatus: 'not_configured',
            failureReason: null,
          },
    });

    // Inbox is authoritative: always fan out, regardless of push configuration.
    const learnerIds = [
      ...new Set(await this.resolveCampaignLearnerIds(queued)),
    ];
    const items = learnerIds.map((learnerId) => ({
      learnerId,
      campaignId: queued.id,
      title: queued.title,
      body: queued.body,
      category: queued.category,
      priority: 'normal',
      actionLabel: queued.actionLabel,
      targetKind: queued.targetKind,
      targetRef: queued.targetRef,
    }));

    const CHUNK = 1000;
    const { inboxCreated, row } = await this.prisma.$transaction(async (tx) => {
      let created = 0;
      for (let i = 0; i < items.length; i += CHUNK) {
        const res = await tx.notificationInboxItem.createMany({
          data: items.slice(i, i + CHUNK),
          skipDuplicates: true,
        });
        created += res.count;
      }
      const recipientCount = await tx.notificationInboxItem.count({
        where: { campaignId: queued.id },
      });
      const updated = await tx.notificationCampaign.update({
        where: { id },
        data: {
          recipientCount,
          sentAt: new Date(),
          ...(recipientCount > 0
            ? {
                status: 'sent',
                failureReason: configured
                  ? null
                  : 'Push provider is not configured. Delivered to in-app inbox only.',
              }
            : {
                failureReason: 'No eligible recipients for this audience.',
              }),
        },
      });
      return { inboxCreated: created, row: updated };
    });

    let emailQueued = 0;
    if (this.email.isConfigured() && learnerIds.length) {
      const learners = await this.prisma.learner.findMany({
        where: { id: { in: learnerIds }, email: { not: null } },
        select: { id: true, email: true, firstName: true, lastName: true },
      });
      for (const learner of learners) {
        if (!learner.email) continue;
        await this.email.enqueueRaw({
          toEmail: learner.email,
          toName: `${learner.firstName} ${learner.lastName}`.trim(),
          learnerId: learner.id,
          subject: queued.title,
          htmlBody: `<p>${queued.body.replace(/\n/g, '<br/>')}</p>`,
          textBody: queued.body,
          templateKey: 'campaign.custom',
          meta: { campaignId: queued.id },
        });
        emailQueued += 1;
      }
    }

    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'notification.send',
      resourceType: 'NotificationCampaign',
      resourceId: id,
      outcome: row.recipientCount > 0 ? 'sent' : 'no_recipients',
      after: {
        status: row.status,
        providerStatus: row.providerStatus,
        recipientCount: row.recipientCount,
        inboxCreated,
        emailQueued,
      },
      severity: AuditSeverity.notice,
    });
    return {
      ...row,
      recipientCount: row.recipientCount,
      inboxCreated,
      emailQueued,
    };
  }

  listProducts() {
    return this.prisma.product.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  async getProduct(id: string) {
    const row = await this.prisma.product.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Product not found',
        fieldErrors: {},
      });
    }
    return row;
  }

  async createProduct(dto: CreateProductDto, actor: Actor) {
    const row = await this.prisma.product.create({
      data: {
        sku: dto.sku,
        title: dto.title,
        pricePaise: dto.pricePaise,
        courseId: dto.courseId,
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'product.create',
      resourceType: 'Product',
      resourceId: row.id,
      after: { sku: row.sku, pricePaise: row.pricePaise },
    });
    return row;
  }

  async updateProduct(id: string, dto: UpdateProductDto, actor: Actor) {
    await this.getProduct(id);
    const row = await this.prisma.product.update({
      where: { id },
      data: {
        sku: dto.sku,
        title: dto.title,
        pricePaise: dto.pricePaise,
        courseId: dto.courseId,
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'product.update',
      resourceType: 'Product',
      resourceId: id,
      after: { sku: row.sku, pricePaise: row.pricePaise },
    });
    return row;
  }

  async archiveProduct(id: string, actor: Actor) {
    const before = await this.getProduct(id);
    const row = await this.prisma.product.update({
      where: { id },
      data: { lifecycle: ContentLifecycle.archived },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'product.archive',
      resourceType: 'Product',
      resourceId: id,
      before: { lifecycle: before.lifecycle },
      after: { lifecycle: row.lifecycle },
      severity: AuditSeverity.notice,
    });
    return row;
  }

  listCoupons() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async getCoupon(id: string) {
    const row = await this.prisma.coupon.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Coupon not found',
        fieldErrors: {},
      });
    }
    return row;
  }

  async createCoupon(dto: CreateCouponDto, actor: Actor) {
    if (!dto.percentOff && !dto.amountOffPaise) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Set percentOff or amountOffPaise',
        fieldErrors: {},
      });
    }
    const row = await this.prisma.coupon.create({
      data: {
        code: dto.code.toUpperCase(),
        percentOff: dto.percentOff,
        amountOffPaise: dto.amountOffPaise,
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'coupon.create',
      resourceType: 'Coupon',
      resourceId: row.id,
      after: { code: row.code },
    });
    return row;
  }

  async updateCoupon(id: string, dto: UpdateCouponDto, actor: Actor) {
    await this.getCoupon(id);
    const row = await this.prisma.coupon.update({
      where: { id },
      data: {
        code: dto.code ? dto.code.toUpperCase() : undefined,
        percentOff: dto.percentOff,
        amountOffPaise: dto.amountOffPaise,
        active: dto.active,
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'coupon.update',
      resourceType: 'Coupon',
      resourceId: id,
      after: { code: row.code, active: row.active },
    });
    return row;
  }

  listOrders() {
    return this.prisma.order.findMany({
      include: { product: true, refunds: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createOrder(dto: CreateOrderDto, actor: Actor) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Product not found',
        fieldErrors: {},
      });
    }
    const row = await this.prisma.order.create({
      data: {
        learnerId: dto.learnerId,
        productId: product.id,
        amountPaise: product.pricePaise,
        currency: product.currency,
        status: 'pending',
        providerStatus: this.providers().payments
          ? 'configured_pending_adapter'
          : 'not_configured',
      },
      include: { product: true },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'order.create',
      resourceType: 'Order',
      resourceId: row.id,
      after: {
        learnerId: row.learnerId,
        amountPaise: row.amountPaise,
        providerStatus: row.providerStatus,
      },
    });
    return row;
  }

  async reconcileOrder(id: string, dto: ReconcileOrderDto, actor: Actor) {
    const existing = await this.prisma.order.findUnique({
      where: { id },
      include: { product: true },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Order not found',
        fieldErrors: {},
      });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const row = await tx.order.update({
        where: { id },
        data: {
          status: 'paid_manual',
          externalReference: dto.externalReference,
          providerStatus: 'manual_reference',
        },
        include: { product: true },
      });

      let entitlement: {
        id: string;
        courseId: string | null;
        state: EntitlementState;
        source: string;
      } | null = null;

      const courseId = existing.product.courseId;
      if (courseId) {
        const orderMarker = `order:${id}`;
        const already = await tx.entitlement.findFirst({
          where: {
            learnerId: existing.learnerId,
            courseId,
            state: EntitlementState.active,
            OR: [
              { grantReason: { contains: orderMarker } },
              {
                source: 'purchase',
                productKey: existing.product.sku,
              },
            ],
          },
        });
        if (already) {
          entitlement = already;
        } else {
          entitlement = await tx.entitlement.create({
            data: {
              learnerId: existing.learnerId,
              courseId,
              scopeKind: 'course',
              scopeRef: courseId,
              source: 'purchase',
              state: EntitlementState.active,
              productKey: existing.product.sku,
              grantReason: `${orderMarker} ref:${dto.externalReference}`,
              canDownload: true,
              canPreview: true,
            },
          });
        }
      }

      return { order: row, entitlement, accessGranted: Boolean(entitlement) };
    });

    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'order.reconcile',
      resourceType: 'Order',
      resourceId: id,
      reason: dto.externalReference,
      after: {
        status: result.order.status,
        accessGranted: result.accessGranted,
        entitlementId: result.entitlement?.id ?? null,
        courseId: result.entitlement?.courseId ?? existing.product.courseId,
      },
      severity: AuditSeverity.high,
    });
    return result;
  }

  listRefunds() {
    return this.prisma.refundRequest.findMany({
      include: { order: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRefund(dto: CreateRefundDto, actor: Actor) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
    });
    if (!order) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Order not found',
        fieldErrors: {},
      });
    }
    const row = await this.prisma.refundRequest.create({
      data: {
        orderId: dto.orderId,
        reason: dto.reason,
        amountPaise: dto.amountPaise,
        status: 'requested',
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'refund.request',
      resourceType: 'RefundRequest',
      resourceId: row.id,
      reason: dto.reason,
      after: { amountPaise: dto.amountPaise },
      severity: AuditSeverity.high,
    });
    return row;
  }

  async approveRefund(id: string, actor: Actor) {
    const existing = await this.prisma.refundRequest.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Refund not found',
        fieldErrors: {},
      });
    }
    const row = await this.prisma.refundRequest.update({
      where: { id },
      data: { status: 'approved_manual' },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'refund.approve',
      resourceType: 'RefundRequest',
      resourceId: id,
      after: {
        status: row.status,
        gateway: this.providers().payments
          ? 'adapter_not_called'
          : 'not_configured',
      },
      severity: AuditSeverity.high,
    });
    return {
      ...row,
      message:
        'Refund recorded as a manual approval. No payment gateway refund was sent.',
    };
  }

  private async ensureLegalPages() {
    for (const page of LEGAL_PAGE_DEFAULTS) {
      const existing = await this.prisma.legalPage.findFirst({
        where: { slug: page.slug, locale: page.locale },
        select: { id: true },
      });
      if (existing) continue;
      const effectiveAt = new Date('2026-10-26T00:00:00.000Z');
      try {
        await this.prisma.legalPage.create({
          data: {
            slug: page.slug,
            locale: page.locale,
            title: page.title,
            summary: page.summary,
            body: page.body,
            version: 1,
            lifecycle: ContentLifecycle.published,
            publishedAt: effectiveAt,
            effectiveAt,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }
        throw error;
      }
    }
  }

  async listLegalPages() {
    await this.ensureLegalPages();
    return this.prisma.legalPage.findMany({
      orderBy: [{ slug: 'asc' }, { version: 'desc' }],
    });
  }

  async listPublicLegal(locale = 'en') {
    await this.ensureLegalPages();
    const rows = await this.prisma.legalPage.findMany({
      where: { locale, lifecycle: ContentLifecycle.published },
      orderBy: [{ slug: 'asc' }, { version: 'desc' }],
    });
    const seen = new Set<string>();
    return rows
      .filter((row) => {
        if (seen.has(row.slug)) return false;
        seen.add(row.slug);
        return true;
      })
      .map((row) => ({
        slug: row.slug,
        locale: row.locale,
        title: row.title,
        summary: row.summary,
        version: row.version,
        effectiveAt: row.effectiveAt,
      }));
  }

  async getPublicLegal(slug: string, locale = 'en') {
    await this.ensureLegalPages();
    const row = await this.prisma.legalPage.findFirst({
      where: { slug, locale, lifecycle: ContentLifecycle.published },
      orderBy: { version: 'desc' },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Legal page not found',
        fieldErrors: {},
      });
    }
    return {
      slug: row.slug,
      locale: row.locale,
      title: row.title,
      summary: row.summary,
      body: row.body,
      version: row.version,
      effectiveAt: row.effectiveAt,
      publishedAt: row.publishedAt,
    };
  }

  async createLegalPage(dto: CreateLegalPageDto, actor: Actor) {
    const locale = (dto.locale ?? 'en').toLowerCase();
    const latest = await this.prisma.legalPage.findFirst({
      where: { slug: dto.slug, locale },
      orderBy: { version: 'desc' },
    });
    const row = await this.prisma.legalPage.create({
      data: {
        slug: dto.slug,
        locale,
        title: dto.title,
        summary: dto.summary,
        body: dto.body,
        effectiveAt: dto.effectiveAt ? new Date(dto.effectiveAt) : undefined,
        version: (latest?.version ?? 0) + 1,
        lifecycle: ContentLifecycle.draft,
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'legal.create',
      resourceType: 'LegalPage',
      resourceId: row.id,
      after: { slug: row.slug, version: row.version, title: row.title },
    });
    return row;
  }

  async updateLegalPage(id: string, dto: UpdateLegalPageDto, actor: Actor) {
    const current = await this.prisma.legalPage.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Legal page not found',
        fieldErrors: {},
      });
    }
    if (!dto.title && !dto.summary && !dto.body && !dto.effectiveAt) {
      throw new BadRequestException({
        code: 'VALIDATION',
        message: 'Change the title, summary, body, or effective date',
        fieldErrors: {},
      });
    }

    const patch = {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.summary !== undefined ? { summary: dto.summary } : {}),
      ...(dto.body !== undefined ? { body: dto.body } : {}),
      ...(dto.effectiveAt !== undefined
        ? { effectiveAt: new Date(dto.effectiveAt) }
        : {}),
    };

    const editable =
      current.lifecycle === ContentLifecycle.draft ||
      current.lifecycle === ContentLifecycle.in_review ||
      current.lifecycle === ContentLifecycle.changes_requested;

    if (editable) {
      const row = await this.prisma.legalPage.update({
        where: { id },
        data: patch,
      });
      await this.audit.write({
        actorId: actor.userId,
        actorDisplay: actor.email,
        action: 'legal.update',
        resourceType: 'LegalPage',
        resourceId: row.id,
        after: { slug: row.slug, version: row.version },
      });
      return row;
    }

    const draft = await this.prisma.legalPage.findFirst({
      where: {
        slug: current.slug,
        locale: current.locale,
        lifecycle: ContentLifecycle.draft,
      },
      orderBy: { version: 'desc' },
    });
    if (draft) {
      const row = await this.prisma.legalPage.update({
        where: { id: draft.id },
        data: patch,
      });
      await this.audit.write({
        actorId: actor.userId,
        actorDisplay: actor.email,
        action: 'legal.update',
        resourceType: 'LegalPage',
        resourceId: row.id,
        after: { slug: row.slug, version: row.version },
      });
      return row;
    }

    const latest = await this.prisma.legalPage.findFirst({
      where: { slug: current.slug, locale: current.locale },
      orderBy: { version: 'desc' },
    });
    const row = await this.prisma.legalPage.create({
      data: {
        slug: current.slug,
        locale: current.locale,
        title: dto.title ?? current.title,
        summary: dto.summary ?? current.summary,
        body: dto.body ?? current.body,
        effectiveAt: dto.effectiveAt
          ? new Date(dto.effectiveAt)
          : current.effectiveAt,
        version: (latest?.version ?? current.version) + 1,
        lifecycle: ContentLifecycle.draft,
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'legal.draft',
      resourceType: 'LegalPage',
      resourceId: row.id,
      before: { version: current.version, lifecycle: current.lifecycle },
      after: { slug: row.slug, version: row.version },
      severity: AuditSeverity.notice,
    });
    return row;
  }

  async publishLegalPage(id: string, actor: Actor) {
    const current = await this.prisma.legalPage.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Legal page not found',
        fieldErrors: {},
      });
    }
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.legalPage.updateMany({
        where: {
          slug: current.slug,
          locale: current.locale,
          lifecycle: ContentLifecycle.published,
          NOT: { id },
        },
        data: { lifecycle: ContentLifecycle.unpublished },
      });
      return tx.legalPage.update({
        where: { id },
        data: {
          lifecycle: ContentLifecycle.published,
          publishedAt: new Date(),
          effectiveAt: current.effectiveAt ?? new Date(),
        },
      });
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'legal.publish',
      resourceType: 'LegalPage',
      resourceId: row.id,
      after: { slug: row.slug, version: row.version, lifecycle: row.lifecycle },
      severity: AuditSeverity.notice,
    });
    return row;
  }

  listSupport() {
    return this.prisma.supportCase.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  async createSupport(dto: CreateSupportDto, actor: Actor) {
    const row = await this.prisma.supportCase.create({
      data: {
        subject: dto.subject,
        body: dto.body,
        learnerId: dto.learnerId,
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'support.create',
      resourceType: 'SupportCase',
      resourceId: row.id,
      after: { subject: row.subject },
    });
    return row;
  }

  async updateSupport(id: string, dto: UpdateSupportDto, actor: Actor) {
    const row = await this.prisma.supportCase.update({
      where: { id },
      data: { status: dto.status },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'support.update',
      resourceType: 'SupportCase',
      resourceId: id,
      after: { status: row.status },
    });
    return row;
  }

  async settings() {
    const defaults: Record<string, string> = {
      organization_name: 'Ranjan Educational Institute',
      timezone: 'Asia/Kolkata',
      locale: 'en',
    };
    for (const [key, value] of Object.entries(defaults)) {
      await this.prisma.appSetting.upsert({
        where: { key },
        create: { key, value },
        update: {},
      });
    }
    const items = await this.prisma.appSetting.findMany({
      orderBy: { key: 'asc' },
    });
    return { items, providers: this.providers() };
  }

  async upsertSetting(dto: UpsertSettingDto, actor: Actor) {
    const row = await this.prisma.appSetting.upsert({
      where: { key: dto.key },
      create: { key: dto.key, value: dto.value },
      update: { value: dto.value },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'settings.update',
      resourceType: 'AppSetting',
      resourceId: row.key,
      after: { value: row.value },
      severity: AuditSeverity.notice,
    });
    return row;
  }

  async reports() {
    const [
      learners,
      activeLearners,
      courses,
      publishedCourses,
      enrollments,
      attempts,
      publishedResults,
      pendingOrders,
      openSupport,
      liveClasses,
      campaigns,
    ] = await Promise.all([
      this.prisma.learner.count(),
      this.prisma.learner.count({ where: { accountState: 'active' } }),
      this.prisma.course.count(),
      this.prisma.course.count({ where: { lifecycle: 'published' } }),
      this.prisma.enrollment.count({ where: { status: 'active' } }),
      this.prisma.attempt.count(),
      this.prisma.result.count({ where: { published: true } }),
      this.prisma.order.count({ where: { status: 'pending' } }),
      this.prisma.supportCase.count({ where: { status: 'open' } }),
      this.prisma.liveClass.count(),
      this.prisma.notificationCampaign.count(),
    ]);
    return {
      generatedAt: new Date().toISOString(),
      learners: { total: learners, active: activeLearners },
      learning: {
        courses,
        publishedCourses,
        activeEnrollments: enrollments,
      },
      assessments: { attempts, publishedResults },
      operations: { pendingOrders, openSupport, liveClasses, campaigns },
      providers: this.providers(),
    };
  }
}
