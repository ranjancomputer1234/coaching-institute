import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditSeverity,
  ContentLifecycle,
  EditorialKind,
  LiveClassStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateCampaignDto,
  CreateCouponDto,
  CreateEditorialDto,
  CreateLiveClassDto,
  CreateOrderDto,
  CreateProductDto,
  CreateRefundDto,
  CreateSupportDto,
  CreateTemplateDto,
  ReconcileOrderDto,
  UpdateSupportDto,
  UpsertSettingDto,
} from './platform.dto';

type Actor = { userId: string; email?: string };

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  providers() {
    return {
      live: Boolean(this.config.get('LIVE_PROVIDER_BASE_URL')),
      push: Boolean(this.config.get('PUSH_PROVIDER_KEY')),
      payments: Boolean(this.config.get('PAYMENT_PROVIDER_KEY')),
      storage: Boolean(this.config.get('OBJECT_STORAGE_BUCKET')),
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

  async publishEditorial(id: string, actor: Actor) {
    const before = await this.prisma.editorialItem.findUnique({ where: { id } });
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

  listLiveClasses() {
    return this.prisma.liveClass.findMany({ orderBy: { startsAt: 'asc' } });
  }

  async createLiveClass(dto: CreateLiveClassDto, actor: Actor) {
    const row = await this.prisma.liveClass.create({
      data: {
        title: dto.title,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        courseId: dto.courseId,
        hostName: dto.hostName,
        capacity: dto.capacity,
        status: LiveClassStatus.draft,
        provider: 'unconfigured',
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'live.create',
      resourceType: 'LiveClass',
      resourceId: row.id,
      after: { title: row.title },
    });
    return row;
  }

  async scheduleLiveClass(id: string, actor: Actor) {
    const existing = await this.prisma.liveClass.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Live class not found',
        fieldErrors: {},
      });
    }
    const configured = this.providers().live;
    const row = await this.prisma.liveClass.update({
      where: { id },
      data: configured
        ? { status: LiveClassStatus.scheduled, provider: 'configured' }
        : {
            status: LiveClassStatus.provider_unavailable,
            provider: 'unconfigured',
            joinUrl: null,
            recordingStatus: 'not_available',
          },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'live.schedule',
      resourceType: 'LiveClass',
      resourceId: id,
      outcome: configured ? 'success' : 'capability_unavailable',
      after: { status: row.status, provider: row.provider },
      severity: AuditSeverity.notice,
    });
    return {
      ...row,
      capability: configured ? 'ready' : 'unavailable',
      message: configured
        ? 'Provider is configured. Room creation still requires the adapter call.'
        : 'Live video provider is not configured. The class stays a draft record and no join link was invented.',
    };
  }

  listTemplates() {
    return this.prisma.notificationTemplate.findMany({
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
    });
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

  listCampaigns() {
    return this.prisma.notificationCampaign.findMany({
      include: { template: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCampaign(dto: CreateCampaignDto, actor: Actor) {
    const row = await this.prisma.notificationCampaign.create({
      data: {
        title: dto.title,
        body: dto.body,
        audience: dto.audience ?? 'single',
        audienceRef: dto.audienceRef,
        templateId: dto.templateId,
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
      after: { title: row.title, audience: row.audience },
    });
    return row;
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
    const row = await this.prisma.notificationCampaign.update({
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
            failureReason:
              'Push provider is not configured. No message was delivered.',
          },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'notification.send',
      resourceType: 'NotificationCampaign',
      resourceId: id,
      outcome: configured ? 'queued' : 'capability_unavailable',
      after: { status: row.status, providerStatus: row.providerStatus },
      severity: AuditSeverity.notice,
    });
    return row;
  }

  listProducts() {
    return this.prisma.product.findMany({ orderBy: { updatedAt: 'desc' } });
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

  listCoupons() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
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
    const existing = await this.prisma.order.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Order not found',
        fieldErrors: {},
      });
    }
    const row = await this.prisma.order.update({
      where: { id },
      data: {
        status: 'paid_manual',
        externalReference: dto.externalReference,
        providerStatus: 'manual_reference',
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'order.reconcile',
      resourceType: 'Order',
      resourceId: id,
      reason: dto.externalReference,
      after: { status: row.status },
      severity: AuditSeverity.high,
    });
    return row;
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
