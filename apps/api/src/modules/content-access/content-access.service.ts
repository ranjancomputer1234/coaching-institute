import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ContentLifecycle,
  DocumentStatus,
  EntitlementState,
  ResourceKind,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export type AccessDecision = {
  granted: boolean;
  reason: string | null;
  canDownload: boolean;
  canPreview: boolean;
  expiresAt: Date | null;
  source: string | null;
};

@Injectable()
export class ContentAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  getOfflineKid() {
    return this.config.get<string>('OFFLINE_GRANT_KID', 'redi-offline-v1');
  }

  /** Public verification material only — never expose the signing secret. */
  getOfflineVerificationPublic() {
    return {
      kid: this.getOfflineKid(),
      algorithm: 'HMAC-SHA256',
      note: 'Verify offlineAuthorization.signature over the canonical payload JSON using the server-held secret matching this kid. Mobile apps receive signed grants; they do not receive the HMAC secret.',
      status: this.config.get('OFFLINE_GRANT_SECRET')
        ? 'configured'
        : 'using_dev_fallback',
    };
  }

  private offlineSecret() {
    return (
      this.config.get<string>('OFFLINE_GRANT_SECRET') ||
      this.config.get<string>('JWT_SECRET', 'dev-change-me')
    );
  }

  signOfflinePayload(canonicalJson: string) {
    return createHmac('sha256', this.offlineSecret())
      .update(canonicalJson)
      .digest('base64url');
  }

  verifyOfflineSignature(canonicalJson: string, signature: string) {
    const expected = this.signOfflinePayload(canonicalJson);
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async resolveCourseAccess(
    learnerId: string,
    courseId: string,
  ): Promise<AccessDecision> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course || course.lifecycle !== ContentLifecycle.published) {
      return {
        granted: false,
        reason: 'course_unavailable',
        canDownload: false,
        canPreview: false,
        expiresAt: null,
        source: null,
      };
    }

    if (course.commercialMode === 'free') {
      return {
        granted: true,
        reason: null,
        canDownload: true,
        canPreview: true,
        expiresAt: null,
        source: 'free_course',
      };
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        learnerId_courseId: { learnerId, courseId },
      },
    });
    if (enrollment?.status === 'active') {
      return {
        granted: true,
        reason: null,
        canDownload: true,
        canPreview: true,
        expiresAt: enrollment.endsAt,
        source: 'enrollment',
      };
    }

    const entitlement = await this.prisma.entitlement.findFirst({
      where: {
        learnerId,
        state: EntitlementState.active,
        OR: [{ courseId }, { scopeKind: 'course', scopeRef: courseId }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }],
      },
      orderBy: { createdAt: 'desc' },
    });
    if (entitlement) {
      return {
        granted: true,
        reason: null,
        canDownload: entitlement.canDownload,
        canPreview: entitlement.canPreview,
        expiresAt: entitlement.endsAt,
        source: entitlement.source,
      };
    }

    return {
      granted: false,
      reason: 'entitlement_required',
      canDownload: false,
      canPreview: false,
      expiresAt: null,
      source: null,
    };
  }

  async resolveResourceAccess(learnerId: string, resourceId: string) {
    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
      include: {
        mediaAsset: true,
        lesson: true,
        course: true,
        documents: {
          where: { learnerId },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!resource || resource.lifecycle !== ContentLifecycle.published) {
      return {
        resource: null as typeof resource,
        access: {
          granted: false,
          reason: 'resource_unavailable',
          canDownload: false,
          canPreview: false,
          expiresAt: null,
          source: null,
        } satisfies AccessDecision,
      };
    }

    const scoped = await this.prisma.entitlement.findFirst({
      where: {
        learnerId,
        state: EntitlementState.active,
        scopeKind: 'resource',
        scopeRef: resourceId,
        OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
      },
    });
    if (scoped) {
      return {
        resource,
        access: {
          granted: true,
          reason: null,
          canDownload: scoped.canDownload && resource.downloadable,
          canPreview: scoped.canPreview || resource.previewAllowed,
          expiresAt: scoped.endsAt,
          source: scoped.source,
        } satisfies AccessDecision,
      };
    }

    if (resource.lesson?.isPreview || resource.previewAllowed) {
      return {
        resource,
        access: {
          granted: true,
          reason: null,
          canDownload: resource.downloadable,
          canPreview: true,
          expiresAt: null,
          source: 'preview',
        } satisfies AccessDecision,
      };
    }

    const courseId =
      resource.courseId ?? resource.lesson?.courseId ?? undefined;
    if (courseId) {
      const access = await this.resolveCourseAccess(learnerId, courseId);
      return {
        resource,
        access: {
          ...access,
          canDownload: access.canDownload && resource.downloadable,
          canPreview: access.canPreview || resource.previewAllowed,
        },
      };
    }

    const document = resource.documents[0];
    if (document) {
      const ok =
        document.status === DocumentStatus.issued &&
        (!document.expiresAt || document.expiresAt > new Date());
      return {
        resource,
        access: {
          granted: ok,
          reason: ok ? null : 'document_not_available',
          canDownload: ok && resource.downloadable,
          canPreview: ok,
          expiresAt: document.expiresAt,
          source: 'issued_document',
        } satisfies AccessDecision,
      };
    }

    return {
      resource,
      access: {
        granted: false,
        reason: 'entitlement_required',
        canDownload: false,
        canPreview: false,
        expiresAt: null,
        source: null,
      } satisfies AccessDecision,
    };
  }

  buildDeliveryUrl(resourceId: string, token: string) {
    const base = this.config.get<string>(
      'PROTECTED_CONTENT_BASE_URL',
      'http://localhost:3333/api/protected/delivery',
    );
    return `${base}/${resourceId}?token=${encodeURIComponent(token)}`;
  }

  newDeliveryToken() {
    return randomBytes(32).toString('base64url');
  }

  offlineTtlSeconds(kind: ResourceKind) {
    if (kind === ResourceKind.video) {
      return Number(
        this.config.get('OFFLINE_VIDEO_TTL_SECONDS', 60 * 60 * 24 * 7),
      );
    }
    return Number(
      this.config.get('OFFLINE_DOCUMENT_TTL_SECONDS', 60 * 60 * 24 * 14),
    );
  }
}
