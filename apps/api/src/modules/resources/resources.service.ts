import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  CreateVideoUploadDto,
  DownloadAuthorizationDto,
} from './dto/resource.dto';
import { MuxService } from './mux.service';
import { CloudinaryService } from './cloudinary.service';
import { randomUUID } from 'node:crypto';

type AdminActor = { userId: string; email?: string };

@Injectable()
export class ResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ContentAccessService,
    private readonly audit: AuditService,
    private readonly mux: MuxService,
    private readonly cloudinary: CloudinaryService,
    private readonly config: ConfigService,
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

  /**
   * Video upload, step 1: create a draft resource + a direct-upload slot.
   * Primary provider is Mux; Cloudinary is the automatic backup
   * (VIDEO_PROVIDER=auto|mux|cloudinary, default auto). The browser sends
   * the file directly to the provider — never through this API — and polls
   * `refreshVideoStatus` until transcoding finishes.
   */
  async createVideoUpload(dto: CreateVideoUploadDto, actor: AdminActor) {
    const preference = (
      this.config.get<string>('VIDEO_PROVIDER') ?? 'auto'
    ).toLowerCase();
    const corsOrigin = (
      this.config.get<string>('CORS_ORIGIN') ?? 'http://localhost:5173'
    )
      .split(',')[0]
      .trim();

    const tryMux = async () => {
      const upload = await this.mux.createDirectUpload(corsOrigin);
      const resource = await this.createDraftVideoResource(dto, {
        storageKey: `mux:upload:${upload.id}`,
        packagingFormat: 'mux_hls',
        provider: 'mux',
        providerUploadId: upload.id,
      });
      return {
        resource,
        response: {
          resourceId: resource.id,
          provider: 'mux' as const,
          uploadId: upload.id,
          uploadUrl: upload.url,
          uploadMethod: 'PUT' as const,
          formFields: null,
          status: 'waiting',
        },
      };
    };

    const tryCloudinary = async () => {
      const signed = this.cloudinary.createSignedUpload(
        `v_${randomUUID().replace(/-/g, '')}`,
      );
      const resource = await this.createDraftVideoResource(dto, {
        storageKey: `cloudinary:${signed.publicId}`,
        packagingFormat: 'cloudinary_hls',
        provider: 'cloudinary',
        providerUploadId: signed.publicId,
      });
      return {
        resource,
        response: {
          resourceId: resource.id,
          provider: 'cloudinary' as const,
          uploadId: signed.publicId,
          uploadUrl: signed.uploadUrl,
          uploadMethod: 'POST_FORM' as const,
          formFields: signed.formFields,
          status: 'waiting',
        },
      };
    };

    let attempt: Awaited<ReturnType<typeof tryMux | typeof tryCloudinary>>;
    if (preference === 'cloudinary') {
      attempt = await tryCloudinary();
    } else if (preference === 'mux') {
      attempt = await tryMux();
    } else if (this.mux.isConfigured()) {
      try {
        attempt = await tryMux();
      } catch (error) {
        if (!this.cloudinary.isConfigured()) throw error;
        attempt = await tryCloudinary(); // Mux down/unreachable → backup
      }
    } else if (this.cloudinary.isConfigured()) {
      attempt = await tryCloudinary();
    } else {
      // Neither configured: calling Mux throws the beginner-friendly
      // VIDEO_PROVIDER_NOT_CONFIGURED error with setup instructions.
      attempt = await tryMux();
    }

    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'resource.video_upload.create',
      resourceType: 'Resource',
      resourceId: attempt.resource.id,
      after: {
        title: attempt.resource.title,
        provider: attempt.response.provider,
        uploadId: attempt.response.uploadId,
      },
    });
    return {
      ...attempt.response,
      next: 'Send the video file to uploadUrl, then poll GET /admin/resources/:id/video-status',
    };
  }

  private async createDraftVideoResource(
    dto: CreateVideoUploadDto,
    asset: {
      storageKey: string;
      packagingFormat: string;
      provider: string;
      providerUploadId: string;
    },
  ) {
    const media = await this.prisma.mediaAsset.create({
      data: {
        ...asset,
        mimeType: dto.mimeType ?? 'video/mp4',
        byteSize: dto.byteSize,
        providerStatus: 'waiting',
        lifecycle: ContentLifecycle.draft,
      },
    });
    return this.prisma.resource.create({
      data: {
        title: dto.title,
        kind: ResourceKind.video,
        mimeType: dto.mimeType ?? 'video/mp4',
        byteSize: dto.byteSize,
        ...(dto.courseId ? { course: { connect: { id: dto.courseId } } } : {}),
        ...(dto.lessonId ? { lesson: { connect: { id: dto.lessonId } } } : {}),
        mediaAsset: { connect: { id: media.id } },
        downloadable: false,
        previewAllowed: false,
        lifecycle: ContentLifecycle.draft,
      },
      include: { mediaAsset: true },
    });
  }

  /** Video upload, step 2 (poll): ask Mux how far transcoding got and mirror it locally. */
  async refreshVideoStatus(resourceId: string) {
    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
      include: { mediaAsset: true },
    });
    if (
      !resource?.mediaAsset?.providerUploadId &&
      !resource?.mediaAsset?.providerAssetId
    ) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Video resource ${resourceId} not found`,
        fieldErrors: {},
      });
    }
    const media = resource.mediaAsset;
    if (media.providerStatus === 'ready' && media.providerPlaybackId) {
      return {
        resourceId,
        provider: media.provider ?? 'mux',
        status: 'ready',
        assetId: media.providerAssetId,
        playbackId: media.providerPlaybackId,
      };
    }

    if (media.provider === 'cloudinary') {
      const publicId = media.providerUploadId ?? media.providerAssetId;
      const found = publicId
        ? await this.cloudinary.getResource(publicId)
        : null;
      if (!found) {
        return {
          resourceId,
          provider: 'cloudinary',
          status: 'preparing',
          assetId: null,
          playbackId: null,
        };
      }
      await this.prisma.mediaAsset.update({
        where: { id: media.id },
        data: {
          providerStatus: 'ready',
          providerAssetId: found.public_id,
          providerPlaybackId: found.public_id,
          byteSize: found.bytes ?? media.byteSize,
          lifecycle: ContentLifecycle.published,
        },
      });
      await this.prisma.resource.update({
        where: { id: resourceId },
        data: {
          lifecycle: ContentLifecycle.published,
          publishedAt: new Date(),
        },
      });
      return {
        resourceId,
        provider: 'cloudinary',
        status: 'ready',
        assetId: found.public_id,
        playbackId: found.public_id,
      };
    }

    let assetId = media.providerAssetId;
    if (!assetId && media.providerUploadId) {
      const upload = await this.mux.getUpload(media.providerUploadId);
      assetId = upload.asset_id ?? null;
      if (!assetId) {
        return {
          resourceId,
          status: media.providerStatus ?? 'waiting',
          assetId: null,
          playbackId: null,
        };
      }
      await this.prisma.mediaAsset.update({
        where: { id: media.id },
        data: {
          providerAssetId: assetId,
          providerStatus: 'asset_created',
          storageKey: `mux:asset:${assetId}`,
        },
      });
    }

    const asset = await this.mux.getAsset(assetId!);
    const playbackId = asset.playback_ids?.[0]?.id ?? null;
    const status =
      asset.status === 'ready' && playbackId
        ? 'ready'
        : asset.status === 'errored'
          ? 'errored'
          : 'preparing';

    await this.prisma.mediaAsset.update({
      where: { id: media.id },
      data: {
        providerStatus: status,
        providerPlaybackId: playbackId,
        lifecycle:
          status === 'ready' ? ContentLifecycle.published : media.lifecycle,
      },
    });
    if (status === 'ready') {
      await this.prisma.resource.update({
        where: { id: resourceId },
        data: {
          lifecycle: ContentLifecycle.published,
          publishedAt: new Date(),
        },
      });
    }
    return {
      resourceId,
      status,
      assetId,
      playbackId,
      error:
        status === 'errored'
          ? (asset.errors?.messages ?? []).join(', ') ||
            'Mux could not process this file'
          : null,
    };
  }

  /** Admin "test streaming" preview: a 1-hour signed HLS URL for the in-browser player. */
  async adminVideoPlayback(resourceId: string) {
    const current = await this.refreshVideoStatus(resourceId);
    if (current.status !== 'ready' || !current.playbackId) {
      throw new BadRequestException({
        code: 'VIDEO_NOT_READY',
        message: `Video is not ready yet (status: ${current.status}). Wait a few seconds and check again.`,
        fieldErrors: {},
      });
    }
    if (current.provider === 'cloudinary') {
      return {
        resourceId,
        provider: 'cloudinary',
        status: 'ready',
        playbackId: current.playbackId,
        playbackUrl: this.cloudinary.playbackUrl(current.playbackId),
        fallbackUrl: this.cloudinary.fallbackMp4Url(current.playbackId),
        expiresInSeconds: null,
      };
    }
    return {
      resourceId,
      provider: 'mux',
      status: 'ready',
      playbackId: current.playbackId,
      playbackUrl: this.mux.signedPlaybackUrl(current.playbackId),
      fallbackUrl: null,
      expiresInSeconds: 3600,
    };
  }

  /** Learner playback for a ready provider video, or null when not playable yet. */
  private learnerPlayback(resource: {
    kind: ResourceKind;
    mediaAsset: {
      provider?: string | null;
      providerStatus?: string | null;
      providerPlaybackId?: string | null;
    } | null;
  }): { type: string; url: string; expiresInSeconds: number | null } | null {
    const media = resource.mediaAsset;
    if (
      resource.kind !== ResourceKind.video ||
      media?.providerStatus !== 'ready' ||
      !media?.providerPlaybackId
    ) {
      return null;
    }
    if (media.provider === 'cloudinary') {
      return {
        type: 'cloudinary_hls',
        url: this.cloudinary.playbackUrl(media.providerPlaybackId),
        expiresInSeconds: null,
      };
    }
    if (media.provider === 'mux' && this.mux.isSigningConfigured()) {
      return {
        type: 'mux_hls',
        url: this.mux.signedPlaybackUrl(media.providerPlaybackId),
        expiresInSeconds: 3600,
      };
    }
    return null;
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
      playback:
        resource.kind === ResourceKind.video
          ? (() => {
              const playback = this.learnerPlayback(resource);
              return playback
                ? playback
                : {
                    type: 'video_hls',
                    url: null,
                    status: 'not_ready_or_signing_not_configured',
                  };
            })()
          : null,
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
