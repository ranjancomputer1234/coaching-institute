import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationInboxItem } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export type LearnerNotificationDto = {
  id: string;
  title: string;
  body: string;
  category: string;
  read: boolean;
  createdAt: Date;
  priority: string;
  actionLabel: string | null;
  target: { kind: string; id: string } | null;
};

const PAGE_SIZE = 50;

@Injectable()
export class LearnerNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private map(row: NotificationInboxItem): LearnerNotificationDto {
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      category: row.category,
      read: row.read,
      createdAt: row.createdAt,
      priority: row.priority,
      actionLabel: row.actionLabel,
      target:
        row.targetKind && row.targetRef
          ? { kind: row.targetKind, id: row.targetRef }
          : null,
    };
  }

  async list(learnerId: string, opts: { category?: string; cursor?: string }) {
    const now = new Date();
    const category = opts.category?.trim();
    const rows = await this.prisma.notificationInboxItem.findMany({
      where: {
        learnerId,
        ...(category ? { category } : {}),
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: PAGE_SIZE,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    return rows.map((r) => this.map(r));
  }

  async markRead(learnerId: string, id: string, read: boolean) {
    const existing = await this.prisma.notificationInboxItem.findFirst({
      where: { id, learnerId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Notification not found',
        fieldErrors: {},
      });
    }
    const row = await this.prisma.notificationInboxItem.update({
      where: { id },
      data: { read },
    });
    return this.map(row);
  }

  async clear(learnerId: string) {
    const res = await this.prisma.notificationInboxItem.updateMany({
      where: { learnerId, read: false },
      data: { read: true },
    });
    return { updated: res.count };
  }
}
