import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from './email.service';

/**
 * In-process email worker: polls EmailOutbox and delivers via EmailService.
 * No Redis required — suitable for a single Railway API instance.
 */
@Injectable()
export class EmailWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const enabled =
      (this.config.get<string>('EMAIL_WORKER_ENABLED') ?? 'true') !== 'false';
    if (!enabled) {
      this.logger.log('Email worker disabled (EMAIL_WORKER_ENABLED=false)');
      return;
    }
    const intervalMs = Number(
      this.config.get<string>('EMAIL_WORKER_INTERVAL_MS') ?? '5000',
    );
    this.timer = setInterval(() => {
      void this.tick();
    }, Math.max(2000, intervalMs));
    // Unref so tests/process can exit; Nest keeps the process alive via HTTP.
    this.timer.unref?.();
    this.logger.log(
      `Email worker started (provider=${this.email.providerName()}, every ${Math.max(2000, intervalMs)}ms)`,
    );
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      // Re-queue stale failed / stuck processing rows that are due.
      await this.prisma.emailOutbox.updateMany({
        where: {
          status: { in: ['failed', 'processing'] },
          scheduledAt: { lte: new Date() },
          attempts: { lt: 5 },
        },
        data: { status: 'pending' },
      });

      const batch = await this.prisma.emailOutbox.findMany({
        where: {
          status: 'pending',
          scheduledAt: { lte: new Date() },
        },
        orderBy: { scheduledAt: 'asc' },
        take: 20,
      });

      for (const row of batch) {
        const claimed = await this.prisma.emailOutbox.updateMany({
          where: { id: row.id, status: 'pending' },
          data: { status: 'processing' },
        });
        if (claimed.count !== 1) continue;
        await this.email.deliverOutboxRow(row.id);
      }
    } catch (err) {
      this.logger.warn(
        `Email worker tick failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
