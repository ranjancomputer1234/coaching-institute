import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditSeverity, EntitlementState } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  GrantEntitlementDto,
  RevokeEntitlementDto,
} from './dto/entitlement.dto';

type AdminActor = { userId: string; email?: string };

@Injectable()
export class EntitlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(learnerId?: string) {
    return this.prisma.entitlement.findMany({
      where: learnerId ? { learnerId } : undefined,
      include: {
        learner: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        course: { select: { id: true, title: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  async grant(dto: GrantEntitlementDto, actor: AdminActor) {
    const entitlement = await this.prisma.entitlement.create({
      data: {
        learnerId: dto.learnerId,
        courseId: dto.courseId,
        scopeKind: dto.scopeKind ?? (dto.courseId ? 'course' : 'resource'),
        scopeRef: dto.scopeRef ?? dto.courseId,
        source: dto.source ?? 'manual',
        state: EntitlementState.active,
        canDownload: dto.canDownload ?? true,
        canPreview: dto.canPreview ?? true,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        grantReason: dto.grantReason,
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'entitlement.grant',
      resourceType: 'Entitlement',
      resourceId: entitlement.id,
      after: entitlement,
      severity: AuditSeverity.high,
    });
    return entitlement;
  }

  async revoke(id: string, dto: RevokeEntitlementDto, actor: AdminActor) {
    const existing = await this.prisma.entitlement.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Entitlement ${id} not found`,
        fieldErrors: {},
      });
    }
    const updated = await this.prisma.entitlement.update({
      where: { id },
      data: {
        state: EntitlementState.revoked,
        revokeReason: dto.reason,
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'entitlement.revoke',
      resourceType: 'Entitlement',
      resourceId: id,
      reason: dto.reason,
      severity: AuditSeverity.high,
    });
    return updated;
  }
}
