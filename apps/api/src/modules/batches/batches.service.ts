import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';

const batchDetailInclude = {
  _count: { select: { learners: true, memberships: true } },
  memberships: {
    include: {
      learner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          city: true,
          accountState: true,
        },
      },
    },
    orderBy: { joinedAt: 'desc' as const },
  },
};

@Injectable()
export class BatchesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.batch.findMany({
      include: {
        _count: { select: { learners: true, memberships: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const batch = await this.prisma.batch.findUnique({
      where: { id },
      include: {
        ...batchDetailInclude,
        learners: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            city: true,
            accountState: true,
          },
        },
      },
    });
    if (!batch) {
      throw new NotFoundException(`Batch ${id} not found`);
    }
    return batch;
  }

  private async assertLearnersExist(learnerIds: string[]) {
    if (learnerIds.length === 0) return;
    const found = await this.prisma.learner.findMany({
      where: { id: { in: learnerIds } },
      select: { id: true },
    });
    if (found.length !== learnerIds.length) {
      const known = new Set(found.map((l) => l.id));
      const missing = learnerIds.filter((id) => !known.has(id));
      throw new BadRequestException({
        code: 'INVALID_LEARNERS',
        message: `Unknown learner id(s): ${missing.join(', ')}`,
        fieldErrors: { learnerIds: 'One or more learners were not found' },
      });
    }
  }

  private async syncMemberships(batchId: string, learnerIds: string[]) {
    const unique = [...new Set(learnerIds)];
    await this.assertLearnersExist(unique);

    await this.prisma.$transaction(async (tx) => {
      const previous = await tx.batchMembership.findMany({
        where: { batchId },
        select: { learnerId: true },
      });
      const previousIds = previous.map((m) => m.learnerId);
      const removed = previousIds.filter((id) => !unique.includes(id));

      await tx.batchMembership.deleteMany({
        where: {
          batchId,
          ...(unique.length ? { learnerId: { notIn: unique } } : {}),
        },
      });

      if (removed.length) {
        await tx.learner.updateMany({
          where: { id: { in: removed }, batchId },
          data: { batchId: null },
        });
      }

      if (unique.length === 0) return;

      await tx.batchMembership.createMany({
        data: unique.map((learnerId) => ({ batchId, learnerId })),
        skipDuplicates: true,
      });

      // Primary batch pointer for list/summary views.
      await tx.learner.updateMany({
        where: { id: { in: unique } },
        data: { batchId },
      });
    });
  }

  async create(dto: CreateBatchDto) {
    const learnerIds = [...new Set(dto.learnerIds ?? [])];
    await this.assertLearnersExist(learnerIds);

    const batch = await this.prisma.batch.create({
      data: {
        name: dto.name,
        subject: dto.subject,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        ...(learnerIds.length
          ? {
              learners: { connect: learnerIds.map((id) => ({ id })) },
              memberships: {
                create: learnerIds.map((learnerId) => ({ learnerId })),
              },
            }
          : {}),
      },
      include: batchDetailInclude,
    });
    return batch;
  }

  async update(id: string, dto: UpdateBatchDto) {
    await this.findOne(id);
    await this.prisma.batch.update({
      where: { id },
      data: {
        name: dto.name,
        subject: dto.subject,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });

    if (dto.learnerIds !== undefined) {
      await this.syncMemberships(id, dto.learnerIds);
    }

    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.batch.delete({ where: { id } });
  }
}
