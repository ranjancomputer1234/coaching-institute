import { Injectable } from '@nestjs/common';
import { AuditSeverity, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export type AuditWriteInput = {
  actorId?: string | null;
  actorDisplay?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  outcome?: string;
  errorCode?: string | null;
  severity?: AuditSeverity;
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async write(input: AuditWriteInput, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    return client.auditEvent.create({
      data: {
        actorId: input.actorId ?? undefined,
        actorDisplay: input.actorDisplay ?? undefined,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? undefined,
        beforeJson: input.before ? JSON.stringify(input.before) : undefined,
        afterJson: input.after ? JSON.stringify(input.after) : undefined,
        reason: input.reason ?? undefined,
        outcome: input.outcome ?? 'success',
        errorCode: input.errorCode ?? undefined,
        severity: input.severity ?? AuditSeverity.info,
        requestId: input.requestId ?? undefined,
        ip: input.ip ?? undefined,
        userAgent: input.userAgent ?? undefined,
      },
    });
  }

  list(params: {
    take?: number;
    cursor?: string;
    action?: string;
    resourceType?: string;
  }) {
    const take = Math.min(params.take ?? 50, 100);
    return this.prisma.auditEvent.findMany({
      where: {
        action: params.action || undefined,
        resourceType: params.resourceType || undefined,
      },
      orderBy: { occurredAtUtc: 'desc' },
      take,
      ...(params.cursor ? { skip: 1, cursor: { id: params.cursor } } : {}),
    });
  }
}
