import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditSeverity,
  ContentLifecycle,
  CourseCommercialMode,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateExamDto, UpdateExamDto } from './dto/exam.dto';

type Actor = { userId: string; email?: string };

@Injectable()
export class ExamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.exam.findMany({
      include: { _count: { select: { tests: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: {
        tests: { orderBy: { updatedAt: 'desc' } },
        _count: { select: { tests: true } },
      },
    });
    if (!exam) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Exam ${id} not found`,
        fieldErrors: {},
      });
    }
    return exam;
  }

  async create(dto: CreateExamDto, actor: Actor) {
    const exam = await this.prisma.exam.create({
      data: {
        title: dto.title,
        summary: dto.summary,
        description: dto.description,
        commercialMode: dto.commercialMode ?? CourseCommercialMode.free,
        iconKey: dto.iconKey,
        themeKey: dto.themeKey,
        imageUrl: dto.imageUrl,
        learnerCount: dto.learnerCount ?? 0,
        relatedExamsJson: JSON.stringify(dto.relatedExams ?? []),
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'exam.create',
      resourceType: 'Exam',
      resourceId: exam.id,
      after: { title: exam.title },
    });
    return exam;
  }

  async update(id: string, dto: UpdateExamDto, actor: Actor) {
    await this.findOne(id);
    const exam = await this.prisma.exam.update({
      where: { id },
      data: {
        title: dto.title,
        summary: dto.summary,
        description: dto.description,
        commercialMode: dto.commercialMode,
        iconKey: dto.iconKey,
        themeKey: dto.themeKey,
        imageUrl: dto.imageUrl,
        learnerCount: dto.learnerCount,
        ...(dto.relatedExams
          ? { relatedExamsJson: JSON.stringify(dto.relatedExams) }
          : {}),
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'exam.update',
      resourceType: 'Exam',
      resourceId: id,
      after: { title: exam.title },
    });
    return exam;
  }

  async publish(id: string, actor: Actor) {
    await this.findOne(id);
    const exam = await this.prisma.exam.update({
      where: { id },
      data: {
        lifecycle: ContentLifecycle.published,
        publishedAt: new Date(),
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'exam.publish',
      resourceType: 'Exam',
      resourceId: id,
      severity: AuditSeverity.notice,
      after: { lifecycle: exam.lifecycle },
    });
    return exam;
  }
}
