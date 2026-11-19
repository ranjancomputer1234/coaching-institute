import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContentLifecycle } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { BrevoEmailProvider } from './brevo.email-provider';
import { ConsoleEmailProvider } from './console.email-provider';
import {
  renderBuiltinTemplate,
  renderFromDbTemplate,
} from './email.templates';
import {
  EMAIL_TEMPLATE_KEYS,
  EmailProvider,
  EmailProviderName,
  TemplateVars,
} from './email.types';

export type EnqueueTemplateInput = {
  toEmail: string;
  toName?: string | null;
  learnerId?: string | null;
  templateKey: string;
  vars: TemplateVars;
  meta?: Record<string, unknown>;
  scheduledAt?: Date;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private provider: EmailProvider;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.provider = this.buildProvider();
  }

  isConfigured(): boolean {
    const name = this.providerName();
    if (name === 'console') return true;
    return Boolean(this.config.get<string>('EMAIL_PROVIDER_KEY')?.trim());
  }

  providerName(): EmailProviderName {
    const raw = (
      this.config.get<string>('EMAIL_PROVIDER') || 'console'
    ).toLowerCase();
    if (raw === 'brevo') return 'brevo';
    return 'console';
  }

  private buildProvider(): EmailProvider {
    const name = this.providerName();
    if (name === 'brevo') {
      const apiKey = this.config.get<string>('EMAIL_PROVIDER_KEY')?.trim();
      const fromEmail =
        this.config.get<string>('EMAIL_FROM_ADDRESS')?.trim() ||
        this.parseFromAddress(
          this.config.get<string>('EMAIL_FROM') || '',
        );
      const fromName =
        this.config.get<string>('EMAIL_FROM_NAME')?.trim() ||
        this.parseFromName(this.config.get<string>('EMAIL_FROM') || '') ||
        'REDI';
      if (!apiKey || !fromEmail) {
        this.logger.warn(
          'EMAIL_PROVIDER=brevo but EMAIL_PROVIDER_KEY / EMAIL_FROM_ADDRESS missing — falling back to console',
        );
        return new ConsoleEmailProvider();
      }
      if (apiKey.startsWith('xsmtpsib-')) {
        this.logger.warn(
          'EMAIL_PROVIDER_KEY looks like a Brevo SMTP key (xsmtpsib-). Use an API key (xkeysib-) instead.',
        );
      }
      return new BrevoEmailProvider({ apiKey, fromEmail, fromName });
    }
    return new ConsoleEmailProvider();
  }

  private parseFromAddress(from: string): string | undefined {
    const m = from.match(/<([^>]+)>/);
    if (m?.[1]) return m[1].trim();
    if (from.includes('@')) return from.trim();
    return undefined;
  }

  private parseFromName(from: string): string | undefined {
    const m = from.match(/^([^<]+)</);
    return m?.[1]?.trim() || undefined;
  }

  async renderTemplate(
    templateKey: string,
    vars: TemplateVars,
  ): Promise<{ subject: string; htmlBody: string; textBody: string }> {
    const db = await this.prisma.notificationTemplate.findFirst({
      where: {
        key: templateKey,
        channel: 'email',
        lifecycle: ContentLifecycle.published,
      },
      orderBy: { version: 'desc' },
    });
    if (db) {
      return renderFromDbTemplate(db.title, db.body, vars);
    }
    return renderBuiltinTemplate(templateKey, vars);
  }

  async enqueueTemplate(input: EnqueueTemplateInput) {
    const rendered = await this.renderTemplate(input.templateKey, input.vars);
    return this.prisma.emailOutbox.create({
      data: {
        toEmail: input.toEmail.toLowerCase(),
        toName: input.toName ?? undefined,
        learnerId: input.learnerId ?? undefined,
        templateKey: input.templateKey,
        subject: rendered.subject,
        htmlBody: rendered.htmlBody,
        textBody: rendered.textBody,
        scheduledAt: input.scheduledAt ?? new Date(),
        metaJson: JSON.stringify(input.meta ?? {}),
        status: 'pending',
      },
    });
  }

  async enqueueRaw(input: {
    toEmail: string;
    toName?: string | null;
    learnerId?: string | null;
    subject: string;
    htmlBody: string;
    textBody?: string | null;
    templateKey?: string;
    meta?: Record<string, unknown>;
  }) {
    return this.prisma.emailOutbox.create({
      data: {
        toEmail: input.toEmail.toLowerCase(),
        toName: input.toName ?? undefined,
        learnerId: input.learnerId ?? undefined,
        templateKey: input.templateKey,
        subject: input.subject,
        htmlBody: input.htmlBody,
        textBody: input.textBody ?? undefined,
        metaJson: JSON.stringify(input.meta ?? {}),
        status: 'pending',
      },
    });
  }

  /** Deliver one outbox row via the active provider (used by the worker). */
  async deliverOutboxRow(id: string) {
    const row = await this.prisma.emailOutbox.findUnique({ where: { id } });
    if (!row) return null;

    try {
      const result = await this.provider.send({
        toEmail: row.toEmail,
        toName: row.toName,
        subject: row.subject,
        htmlBody: row.htmlBody,
        textBody: row.textBody,
      });
      return this.prisma.emailOutbox.update({
        where: { id },
        data: {
          status: 'sent',
          sentAt: new Date(),
          providerId: result.providerId,
          lastError: null,
          attempts: { increment: 1 },
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const attempts = row.attempts + 1;
      const dead = attempts >= row.maxAttempts;
      return this.prisma.emailOutbox.update({
        where: { id },
        data: {
          status: dead ? 'dead' : 'failed',
          lastError: message.slice(0, 1000),
          attempts,
          scheduledAt: dead
            ? row.scheduledAt
            : new Date(Date.now() + Math.min(attempts, 5) * 60_000),
        },
      });
    }
  }

  /** Convenience helpers for known product mails */
  enqueueVerify(opts: {
    toEmail: string;
    toName?: string;
    learnerId: string;
    firstName: string;
    otp: string;
    expiresMinutes: number;
  }) {
    return this.enqueueTemplate({
      toEmail: opts.toEmail,
      toName: opts.toName,
      learnerId: opts.learnerId,
      templateKey: EMAIL_TEMPLATE_KEYS.verify,
      vars: {
        firstName: opts.firstName,
        otp: opts.otp,
        expiresMinutes: opts.expiresMinutes,
      },
    });
  }

  enqueuePasswordReset(opts: {
    toEmail: string;
    toName?: string;
    learnerId?: string;
    firstName: string;
    otp: string;
    expiresMinutes: number;
  }) {
    return this.enqueueTemplate({
      toEmail: opts.toEmail,
      toName: opts.toName,
      learnerId: opts.learnerId,
      templateKey: EMAIL_TEMPLATE_KEYS.passwordReset,
      vars: {
        firstName: opts.firstName,
        otp: opts.otp,
        expiresMinutes: opts.expiresMinutes,
      },
    });
  }

  enqueueLiveClass(opts: {
    toEmail: string;
    toName?: string;
    learnerId: string;
    firstName: string;
    title: string;
    startsAt: string;
    joinUrl?: string | null;
  }) {
    return this.enqueueTemplate({
      toEmail: opts.toEmail,
      toName: opts.toName,
      learnerId: opts.learnerId,
      templateKey: EMAIL_TEMPLATE_KEYS.liveClass,
      vars: {
        firstName: opts.firstName,
        title: opts.title,
        startsAt: opts.startsAt,
        joinUrl: opts.joinUrl ?? '',
      },
    });
  }

  enqueueResultPublished(opts: {
    toEmail: string;
    toName?: string;
    learnerId: string;
    firstName: string;
    testTitle: string;
  }) {
    return this.enqueueTemplate({
      toEmail: opts.toEmail,
      toName: opts.toName,
      learnerId: opts.learnerId,
      templateKey: EMAIL_TEMPLATE_KEYS.resultPublished,
      vars: {
        firstName: opts.firstName,
        testTitle: opts.testTitle,
      },
    });
  }
}
