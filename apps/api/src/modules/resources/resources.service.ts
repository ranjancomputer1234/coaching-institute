import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditSeverity,
  ContentLifecycle,
  DocumentStatus,
  DrmScheme,
  ResourceKind,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ContentAccessService } from '../content-access/content-access.service';
import {
  CreateResourceDto,
  DownloadAuthorizationDto,
} from './dto/resource.dto';

type AdminActor = { userId: string; email?: string };

@Injectable()
export class ResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ContentAccessService,
    private readonly audit: AuditService,
  ) {}

  findAllAdmin() {
    return this.prisma.resource.findMany({
      include: {
        mediaAsset: true,
        course: { select: { id: true, title: true } },
        lesson: { select: { id: true, title: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(dto: CreateResourceDto, actor: AdminActor) {
    let mediaAssetId = dto.mediaAssetId;
    if (!mediaAssetId && dto.storageKey) {
      const asset = await this.prisma.mediaAsset.create({
        data: {
          storageKey: dto.storageKey,
          mimeType: dto.mimeType,
          byteSize: dto.byteSize,
          checksumSha256: dto.checksumSha256,
          encryptionAlgo: dto.encryptionAlgo,
          packagingFormat: dto.packagingFormat,
          drmScheme: dto.drmScheme ?? DrmScheme.none,
          drmContentId: dto.drmContentId,
          licenseServiceUrl: dto.licenseServiceUrl,
          offlinePeriodSeconds: dto.offlinePeriodSeconds,
          lifecycle: ContentLifecycle.published,
        },
      });
      mediaAssetId = asset.id;
    }

    const resource = await this.prisma.resource.create({
      data: {
        title: dto.title,
        kind: dto.kind,
        mimeType: dto.mimeType,
        byteSize: dto.byteSize,
        ...(dto.courseId ? { course: { connect: { id: dto.courseId } } } : {}),
        ...(dto.lessonId ? { lesson: { connect: { id: dto.lessonId } } } : {}),
        ...(mediaAssetId
          ? { mediaAsset: { connect: { id: mediaAssetId } } }
          : {}),
        downloadable: dto.downloadable ?? true,
        previewAllowed: dto.previewAllowed ?? false,
        lifecycle: ContentLifecycle.published,
        publishedAt: new Date(),
      },
      include: { mediaAsset: true },
    });

    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'resource.create',
      resourceType: 'Resource',
      resourceId: resource.id,
      after: { title: resource.title, kind: resource.kind },
    });
    return resource;
  }

  async authorizeDownload(
    resourceId: string,
    learnerId: string,
    dto: DownloadAuthorizationDto,
  ) {
    const { resource, access } = await this.access.resolveResourceAccess(
      learnerId,
      resourceId,
    );
    if (!resource) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Resource ${resourceId} not found`,
        fieldErrors: {},
      });
    }
    if (!access.granted || !access.canDownload) {
      throw new ForbiddenException({
        code: 'ACCESS_DENIED',
        message: access.reason ?? 'Download not permitted',
        fieldErrors: {},
        entitlement: access,
      });
    }

    const document = resource.documents[0];
    if (
      document &&
      (document.status === DocumentStatus.revoked ||
        document.status === DocumentStatus.superseded ||
        document.status === DocumentStatus.not_issued)
    ) {
      throw new ForbiddenException({
        code: 'DOCUMENT_REVOKED',
        message: 'Document is not available for download',
        fieldErrors: {},
      });
    }

    const deliveryToken = this.access.newDeliveryToken();
    const deliveryTtlSec = Number(
      process.env.DOWNLOAD_SESSION_TTL_SECONDS ?? 15 * 60,
    );
    const deliveryExpires = new Date(Date.now() + deliveryTtlSec * 1000);
    const offlineTtl = this.access.offlineTtlSeconds(resource.kind);
    const validUntil = new Date(Date.now() + offlineTtl * 1000);

    const session = await this.prisma.downloadSession.create({
      data: {
        learnerId,
        resourceId,
        deliveryToken,
        expiresAt: deliveryExpires,
        deviceId: dto.deviceId,
      },
    });

    const offlinePayload = {
      grantId: '', // filled after create
      accountId: learnerId,
      resourceId,
      contentVersion: resource.contentVersion,
      deviceId: dto.deviceId ?? null,
      validFrom: new Date().toISOString(),
      validUntil: validUntil.toISOString(),
      kid: this.access.getOfflineKid(),
    };

    const grant = await this.prisma.offlineGrant.create({
      data: {
        learnerId,
        resourceId,
        contentVersion: resource.contentVersion,
        deviceId: dto.deviceId,
        validUntil,
        kid: this.access.getOfflineKid(),
        payloadJson: '{}',
        signature: 'pending',
      },
    });

    offlinePayload.grantId = grant.id;
    const canonical = JSON.stringify(offlinePayload);
    const signature = this.access.signOfflinePayload(canonical);
    await this.prisma.offlineGrant.update({
      where: { id: grant.id },
      data: { payloadJson: canonical, signature },
    });

    await this.audit.write({
      actorDisplay: `learner:${learnerId}`,
      action: 'resource.download_authorization',
      resourceType: 'Resource',
      resourceId,
      after: {
        learnerId,
        sessionId: session.id,
        grantId: grant.id,
        deviceId: dto.deviceId ?? null,
      },
      severity: AuditSeverity.info,
    });

    const media = resource.mediaAsset;
    const drmConfigured =
      media &&
      media.drmScheme !== DrmScheme.none &&
      Boolean(media.drmContentId && media.licenseServiceUrl);

    return {
      resourceId: resource.id,
      kind: resource.kind,
      title: resource.title,
      mimeType: resource.mimeType,
      byteSize: resource.byteSize,
      contentVersion: resource.contentVersion,
      parent: {
        courseId: resource.courseId,
        lessonId: resource.lessonId,
      },
      entitlement: {
        granted: true,
        download: true,
        preview: access.canPreview,
        reason: null,
        expiresAt: access.expiresAt,
        source: access.source,
      },
      delivery: {
        method: 'https',
        url: this.access.buildDeliveryUrl(resource.id, deliveryToken),
        expiresAt: deliveryExpires.toISOString(),
        integrity: media?.checksumSha256
          ? { algo: 'sha256', hash: media.checksumSha256 }
          : null,
        encryption: {
          algo: media?.encryptionAlgo ?? null,
          packagingFormat: media?.packagingFormat ?? null,
        },
        // Delivery URLs are short-lived and must be consumed only by the REDI app.
        exportForbidden: true,
      },
      offlineAuthorization: {
        grantId: grant.id,
        scope: {
          accountId: learnerId,
          resourceId: resource.id,
          contentVersion: resource.contentVersion,
          deviceId: dto.deviceId ?? null,
        },
        validFrom: offlinePayload.validFrom,
        validUntil: offlinePayload.validUntil,
        kid: offlinePayload.kid,
        signature,
        payload: offlinePayload,
      },
      drm:
        resource.kind === ResourceKind.video
          ? drmConfigured
            ? {
                scheme: media.drmScheme,
                contentId: media.drmContentId,
                licenseUrl: media.licenseServiceUrl,
                offlineAllowed: true,
                offlinePeriodSeconds: media.offlinePeriodSeconds ?? offlineTtl,
                status: 'ready',
              }
            : {
                scheme: media?.drmScheme ?? DrmScheme.none,
                contentId: null,
                licenseUrl: null,
                offlineAllowed: false,
                offlinePeriodSeconds: null,
                status: 'provider_configuration_required',
                message:
                  'Protected offline video requires Widevine/FairPlay packaging and a license service. Adapter contract is ready; production DRM is not claimed until configured.',
              }
          : null,
      document: document
        ? {
            id: document.id,
            documentType: document.documentType,
            status: document.status,
            serial: document.serial,
            issuedAt: document.issuedAt,
            expiresAt: document.expiresAt,
          }
        : null,
      policy: {
        openInsideAppOnly: true,
        shareExportPrintForbidden: true,
        publicStorageForbidden: true,
      },
    };
  }

  async serveDelivery(resourceId: string, token: string) {
    const session = await this.prisma.downloadSession.findUnique({
      where: { deliveryToken: token },
      include: { resource: { include: { mediaAsset: true } } },
    });
    if (
      !session ||
      session.resourceId !== resourceId ||
      session.revokedAt ||
      session.expiresAt < new Date()
    ) {
      throw new ForbiddenException({
        code: 'DELIVERY_EXPIRED',
        message: 'Download session is invalid or expired',
        fieldErrors: {},
      });
    }

    await this.prisma.downloadSession.update({
      where: { id: session.id },
      data: { usedAt: new Date() },
    });

    // Placeholder delivery metadata until object storage is wired.
    // Never return exportable public URLs for protected assets.
    return {
      resourceId,
      storageKey: session.resource.mediaAsset?.storageKey ?? null,
      mimeType: session.resource.mimeType,
      contentVersion: session.resource.contentVersion,
      encryptionAlgo: session.resource.mediaAsset?.encryptionAlgo ?? null,
      packagingFormat: session.resource.mediaAsset?.packagingFormat ?? null,
      checksumSha256: session.resource.mediaAsset?.checksumSha256 ?? null,
      status: session.resource.mediaAsset
        ? 'metadata_only_until_storage_wired'
        : 'missing_media_asset',
      note: 'Wire PROTECTED_CONTENT storage provider to stream ciphertext bytes. Do not redirect to a public CDN URL for protected resources.',
    };
  }
}
