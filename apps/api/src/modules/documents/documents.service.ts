import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditSeverity,
  ContentLifecycle,
  DocumentStatus,
  DocumentType,
  ResourceKind,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { IssueDocumentDto } from './dto/document.dto';

type AdminActor = { userId: string; email?: string };

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listTemplates() {
    return this.prisma.documentTemplate.findMany({
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
    });
  }

  async createTemplate(data: {
    key: string;
    title: string;
    documentType: DocumentType;
    locale?: string;
  }) {
    const latest = await this.prisma.documentTemplate.findFirst({
      where: { key: data.key },
      orderBy: { version: 'desc' },
    });
    return this.prisma.documentTemplate.create({
      data: {
        key: data.key,
        version: (latest?.version ?? 0) + 1,
        title: data.title,
        documentType: data.documentType,
        locale: data.locale ?? 'en',
        lifecycle: ContentLifecycle.published,
        publishedAt: new Date(),
      },
    });
  }

  listAdmin(status?: DocumentStatus) {
    return this.prisma.issuedDocument.findMany({
      where: status ? { status } : undefined,
      include: {
        learner: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        template: true,
        resource: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  async issue(dto: IssueDocumentDto, actor: AdminActor) {
    const learner = await this.prisma.learner.findUnique({
      where: { id: dto.learnerId },
    });
    if (!learner) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Learner not found',
        fieldErrors: {},
      });
    }

    let templateId = dto.templateId;
    if (!templateId) {
      const template = await this.prisma.documentTemplate.findFirst({
        where: {
          documentType: dto.documentType,
          lifecycle: ContentLifecycle.published,
        },
        orderBy: { version: 'desc' },
      });
      templateId = template?.id;
    }

    const serial =
      dto.serial ??
      `${dto.documentType === DocumentType.admit_card ? 'AC' : 'CERT'}-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;

    const pdfResource = await this.prisma.resource.create({
      data: {
        title: `${dto.title} (PDF)`,
        kind: ResourceKind.pdf,
        mimeType: 'application/pdf',
        ...(dto.courseId ? { course: { connect: { id: dto.courseId } } } : {}),
        downloadable: true,
        previewAllowed: false,
        lifecycle: ContentLifecycle.published,
        publishedAt: new Date(),
        mediaAsset: {
          create: {
            storageKey:
              dto.storageKey ??
              `documents/${dto.documentType}/${serial}.pdf.enc`,
            mimeType: 'application/pdf',
            checksumSha256: dto.pdfSha256,
            encryptionAlgo: 'aes-256-gcm',
            packagingFormat: 'encrypted_pdf',
            lifecycle: ContentLifecycle.published,
          },
        },
      },
    });

    const doc = await this.prisma.issuedDocument.create({
      data: {
        learnerId: dto.learnerId,
        documentType: dto.documentType,
        status: DocumentStatus.issued,
        serial,
        title: dto.title,
        courseId: dto.courseId,
        templateId,
        resourceId: pdfResource.id,
        issuedAt: new Date(),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        snapshotJson: JSON.stringify({
          learnerName: `${learner.firstName} ${learner.lastName}`,
          ...((dto.snapshot as object) ?? {}),
          watermark: 'OFFICIAL',
        }),
        pdfSha256: dto.pdfSha256,
        issuedByAdminId: actor.userId,
      },
      include: { resource: true, learner: true },
    });

    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'document.issue',
      resourceType: 'IssuedDocument',
      resourceId: doc.id,
      after: { serial, learnerId: dto.learnerId, type: dto.documentType },
      severity: AuditSeverity.high,
    });
    return doc;
  }

  async revoke(id: string, reason: string, actor: AdminActor) {
    const existing = await this.prisma.issuedDocument.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Document ${id} not found`,
        fieldErrors: {},
      });
    }
    if (existing.status === DocumentStatus.revoked) {
      return existing;
    }
    if (!reason?.trim()) {
      throw new BadRequestException({
        code: 'REASON_REQUIRED',
        message: 'Revocation reason is required',
        fieldErrors: { reason: 'required' },
      });
    }

    const updated = await this.prisma.issuedDocument.update({
      where: { id },
      data: {
        status: DocumentStatus.revoked,
        revokedAt: new Date(),
        revokeReason: reason,
      },
    });

    if (existing.resourceId) {
      await this.prisma.offlineGrant.updateMany({
        where: {
          resourceId: existing.resourceId,
          learnerId: existing.learnerId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      await this.prisma.downloadSession.updateMany({
        where: {
          resourceId: existing.resourceId,
          learnerId: existing.learnerId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    }

    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'document.revoke',
      resourceType: 'IssuedDocument',
      resourceId: id,
      reason,
      severity: AuditSeverity.high,
    });
    return updated;
  }

  listForLearner(learnerId: string) {
    return this.prisma.issuedDocument.findMany({
      where: {
        learnerId,
        status: {
          in: [
            DocumentStatus.issued,
            DocumentStatus.revoked,
            DocumentStatus.superseded,
            DocumentStatus.expired,
            DocumentStatus.not_issued,
          ],
        },
      },
      select: {
        id: true,
        documentType: true,
        status: true,
        serial: true,
        title: true,
        courseId: true,
        resourceId: true,
        issuedAt: true,
        expiresAt: true,
        revokedAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getForLearner(learnerId: string, id: string) {
    const doc = await this.prisma.issuedDocument.findFirst({
      where: { id, learnerId },
      select: {
        id: true,
        documentType: true,
        status: true,
        serial: true,
        title: true,
        courseId: true,
        resourceId: true,
        issuedAt: true,
        expiresAt: true,
        revokedAt: true,
        verificationToken: true,
        updatedAt: true,
      },
    });
    if (!doc) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Document not found',
        fieldErrors: {},
      });
    }
    return {
      ...doc,
      // Never expose raw PDF bytes or export URLs here.
      download: doc.resourceId
        ? {
            resourceId: doc.resourceId,
            path: `POST /api/resources/${doc.resourceId}/download-authorization`,
            openInsideAppOnly: true,
          }
        : null,
      shareForbidden: true,
    };
  }

  async verify(token: string) {
    const doc = await this.prisma.issuedDocument.findUnique({
      where: { verificationToken: token },
      include: {
        learner: { select: { firstName: true, lastName: true } },
      },
    });
    if (!doc) {
      return {
        valid: false,
        status: 'invalid',
        message: 'Verification token not recognized',
      };
    }
    const valid = doc.status === DocumentStatus.issued;
    return {
      valid,
      status: doc.status,
      documentType: doc.documentType,
      title: doc.title,
      serial: doc.serial,
      issuedAt: doc.issuedAt,
      issuer: 'Ranjan Educational Institute',
      identity: {
        displayName: `${doc.learner.firstName} ${doc.learner.lastName.charAt(0)}.`,
      },
      // Intentionally omit phone, email, scores, and PDF bytes.
    };
  }
}
