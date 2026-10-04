import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditSeverity, LearnerAccountState } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateLearnerDto } from './dto/create-learner.dto';
import { UpdateLearnerDto } from './dto/update-learner.dto';

type Actor = { userId: string; name?: string; email?: string };

@Injectable()
export class LearnersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(q?: string) {
    const query = q?.trim();
    return this.prisma.learner.findMany({
      where: query
        ? {
            OR: [
              { firstName: { contains: query } },
              { lastName: { contains: query } },
              { email: { contains: query } },
              { phone: { contains: query } },
              { id: { contains: query } },
            ],
          }
        : undefined,
      include: { batch: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const learner = await this.prisma.learner.findUnique({
      where: { id },
      include: {
        batch: true,
        enrollments: { include: { course: true } },
        memberships: { include: { batch: true } },
      },
    });
    if (!learner) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Learner ${id} not found`,
        fieldErrors: {},
      });
    }
    return learner;
  }

  async create(dto: CreateLearnerDto, actor: Actor) {
    const learner = await this.prisma.learner.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        phoneNormalized: dto.phone?.replace(/\D/g, '') || undefined,
        city: dto.city,
        batchId: dto.batchId,
        source: dto.source,
        accountState: LearnerAccountState.active,
        verifiedEmail: Boolean(dto.email),
      },
      include: { batch: true },
    });

    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.name ?? actor.email,
      action: 'learner.create',
      resourceType: 'Learner',
      resourceId: learner.id,
      after: learner,
    });

    return learner;
  }

  async update(id: string, dto: UpdateLearnerDto, actor: Actor) {
    const before = await this.findOne(id);
    const learner = await this.prisma.learner.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        phoneNormalized: dto.phone?.replace(/\D/g, '') || undefined,
        city: dto.city,
        batchId: dto.batchId,
        source: dto.source,
        internalNotes: dto.internalNotes,
      },
      include: { batch: true },
    });

    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.name ?? actor.email,
      action: 'learner.update',
      resourceType: 'Learner',
      resourceId: id,
      before,
      after: learner,
    });

    return learner;
  }

  async suspend(id: string, reason: string, actor: Actor) {
    if (!reason?.trim()) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Reason is required',
        fieldErrors: { reason: ['Reason is required.'] },
      });
    }
    const before = await this.findOne(id);
    const learner = await this.prisma.learner.update({
      where: { id },
      data: { accountState: LearnerAccountState.suspended },
      include: { batch: true },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.name ?? actor.email,
      action: 'learner.suspend',
      resourceType: 'Learner',
      resourceId: id,
      before: { accountState: before.accountState },
      after: { accountState: learner.accountState },
      reason,
      severity: AuditSeverity.high,
    });
    return learner;
  }

  async reactivate(id: string, reason: string, actor: Actor) {
    if (!reason?.trim()) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Reason is required',
        fieldErrors: { reason: ['Reason is required.'] },
      });
    }
    const before = await this.findOne(id);
    const learner = await this.prisma.learner.update({
      where: { id },
      data: { accountState: LearnerAccountState.active },
      include: { batch: true },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.name ?? actor.email,
      action: 'learner.reactivate',
      resourceType: 'Learner',
      resourceId: id,
      before: { accountState: before.accountState },
      after: { accountState: learner.accountState },
      reason,
      severity: AuditSeverity.notice,
    });
    return learner;
  }
}
