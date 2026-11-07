import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LiveClassStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

const visibleStatuses: LiveClassStatus[] = [
  LiveClassStatus.scheduled,
  LiveClassStatus.starting,
  LiveClassStatus.live,
  LiveClassStatus.reconnecting,
  LiveClassStatus.ended,
  LiveClassStatus.cancelled,
  LiveClassStatus.provider_unavailable,
];

@Injectable()
export class LearnerLiveService {
  constructor(private readonly prisma: PrismaService) {}

  private mapStatus(status: LiveClassStatus): string {
    if (status === LiveClassStatus.provider_unavailable) return 'scheduled';
    if (status === LiveClassStatus.draft) return 'scheduled';
    return status;
  }

  private recordingAvailable(
    recordingStatus: string,
    playbackUrl: string | null,
  ) {
    return (
      Boolean(playbackUrl) &&
      ['ready', 'available', 'published'].includes(recordingStatus)
    );
  }

  private mapClass(
    row: {
      id: string;
      title: string;
      startsAt: Date;
      endsAt: Date;
      hostName: string | null;
      status: LiveClassStatus;
      viewerCount: number;
      recordingStatus: string;
      playbackUrl: string | null;
      batch?: { name: string } | null;
      reminders?: { enabled: boolean }[];
    },
    learnerId?: string,
  ) {
    const durationMins = Math.max(
      1,
      Math.round((row.endsAt.getTime() - row.startsAt.getTime()) / 60000),
    );
    const reminderSet = learnerId
      ? Boolean(row.reminders?.[0]?.enabled)
      : false;
    return {
      id: row.id,
      title: row.title,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      instructorName: row.hostName || 'RACI Faculty',
      status: this.mapStatus(row.status),
      batch: row.batch?.name ?? null,
      durationLabel: `${durationMins} min`,
      viewerCount: row.viewerCount,
      recordingAvailable: this.recordingAvailable(
        row.recordingStatus,
        row.playbackUrl,
      ),
      reminderSet,
    };
  }

  async list(opts: { from?: string; to?: string; learnerId?: string }) {
    const from = opts.from ? new Date(opts.from) : undefined;
    const to = opts.to ? new Date(opts.to) : undefined;

    const where: Prisma.LiveClassWhereInput = {
      status: { in: visibleStatuses },
      ...(from || to
        ? {
            startsAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    const rows = await this.prisma.liveClass.findMany({
      where,
      include: {
        batch: { select: { name: true } },
        reminders: opts.learnerId
          ? {
              where: { learnerId: opts.learnerId },
              take: 1,
            }
          : false,
      },
      orderBy: { startsAt: 'asc' },
    });

    return rows.map((row) => this.mapClass(row, opts.learnerId));
  }

  async getOne(id: string, learnerId?: string) {
    const row = await this.prisma.liveClass.findFirst({
      where: { id, status: { in: visibleStatuses } },
      include: {
        batch: { select: { name: true } },
        reminders: learnerId ? { where: { learnerId }, take: 1 } : false,
      },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Live class ${id} not found`,
        fieldErrors: {},
      });
    }
    return this.mapClass(row, learnerId);
  }

  async join(id: string, learnerId: string) {
    const row = await this.prisma.liveClass.findFirst({
      where: { id, status: { in: visibleStatuses } },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Live class not found',
        fieldErrors: {},
      });
    }

    const joinableStatuses: LiveClassStatus[] = [
      LiveClassStatus.starting,
      LiveClassStatus.live,
      LiveClassStatus.reconnecting,
    ];
    const joinable = joinableStatuses.includes(row.status);
    const recording = this.recordingAvailable(
      row.recordingStatus,
      row.playbackUrl,
    );

    if (!joinable && !recording) {
      throw new ForbiddenException({
        code: 'ACCESS_DENIED',
        message: 'Stream is not available for this class yet',
        fieldErrors: {},
      });
    }

    const audience = this.parseAudience(row.audienceLearnerIdsJson);
    if (audience.length && !audience.includes(learnerId) && row.batchId) {
      const member = await this.prisma.batchMembership.findFirst({
        where: { batchId: row.batchId, learnerId },
      });
      const primary = await this.prisma.learner.findFirst({
        where: { id: learnerId, batchId: row.batchId },
      });
      if (!member && !primary) {
        throw new ForbiddenException({
          code: 'ACCESS_DENIED',
          message: 'You are not in the audience for this class',
          fieldErrors: {},
        });
      }
    } else if (audience.length && !audience.includes(learnerId)) {
      throw new ForbiddenException({
        code: 'ACCESS_DENIED',
        message: 'You are not in the audience for this class',
        fieldErrors: {},
      });
    }

    const playbackUrl = row.playbackUrl || row.joinUrl || null;
    return {
      playbackUrl,
      chatAvailable: false,
      expiresAt: row.endsAt.toISOString(),
    };
  }

  async setReminder(id: string, learnerId: string, enabled: boolean) {
    await this.getOne(id, learnerId);
    await this.prisma.liveClassReminder.upsert({
      where: {
        liveClassId_learnerId: { liveClassId: id, learnerId },
      },
      create: { liveClassId: id, learnerId, enabled },
      update: { enabled },
    });
  }

  async setHand(id: string, learnerId: string, raised: boolean) {
    await this.getOne(id, learnerId);
    await this.prisma.liveClassHand.upsert({
      where: {
        liveClassId_learnerId: { liveClassId: id, learnerId },
      },
      create: { liveClassId: id, learnerId, raised },
      update: { raised },
    });
    return { raised };
  }

  private parseAudience(json: string): string[] {
    try {
      const parsed = JSON.parse(json || '[]') as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((x): x is string => typeof x === 'string')
        : [];
    } catch {
      return [];
    }
  }
}
