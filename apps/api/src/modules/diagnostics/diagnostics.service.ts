import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContentLifecycle } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../email/email.service';
import { EMAIL_TEMPLATE_KEYS } from '../email/email.types';
import { DailyService } from '../platform/daily.service';
import { DiagnosticsRunDto } from './diagnostics.dto';

export type DiagnosticStatus = 'pass' | 'fail' | 'warn' | 'skip';

export type DiagnosticResult = {
  id: string;
  name: string;
  group: 'core' | 'email' | 'auth' | 'providers' | 'data';
  status: DiagnosticStatus;
  durationMs: number;
  detail?: string;
};

@Injectable()
export class DiagnosticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
    private readonly daily: DailyService,
  ) {}

  overview() {
    const key = this.config.get<string>('EMAIL_PROVIDER_KEY')?.trim() || '';
    return {
      appEnv: this.config.get<string>('APP_ENV') || 'local',
      email: {
        provider: this.email.providerName(),
        configured: this.email.isConfigured(),
        fromAddress: this.config.get<string>('EMAIL_FROM_ADDRESS') || null,
        fromName: this.config.get<string>('EMAIL_FROM_NAME') || null,
        requireVerify:
          (this.config.get<string>('EMAIL_REQUIRE_VERIFY') ?? 'true') !== 'false',
        workerEnabled:
          (this.config.get<string>('EMAIL_WORKER_ENABLED') ?? 'true') !== 'false',
        keyPresent: Boolean(key),
        keyLooksLikeSmtp: key.startsWith('xsmtpsib-'),
        keyLooksLikeApi: key.startsWith('xkeysib-'),
      },
      providers: {
        live: this.daily.isConfigured(),
        push: Boolean(this.config.get('PUSH_PROVIDER_KEY')),
        email: this.email.isConfigured(),
        payments: Boolean(this.config.get('PAYMENT_PROVIDER_KEY')),
        storage: Boolean(this.config.get('OBJECT_STORAGE_BUCKET')),
        videoMux: Boolean(
          this.config.get('MUX_TOKEN_ID') && this.config.get('MUX_TOKEN_SECRET'),
        ),
        videoCloudinary: Boolean(
          this.config.get('CLOUDINARY_CLOUD_NAME') &&
            this.config.get('CLOUDINARY_API_KEY') &&
            this.config.get('CLOUDINARY_API_SECRET'),
        ),
      },
    };
  }

  async runSuite(dto: DiagnosticsRunDto, actorEmail?: string) {
    const started = Date.now();
    const results: DiagnosticResult[] = [];
    const push = async (
      id: string,
      name: string,
      group: DiagnosticResult['group'],
      fn: () => Promise<{ status: DiagnosticStatus; detail?: string }>,
    ) => {
      const t0 = Date.now();
      try {
        const out = await fn();
        results.push({
          id,
          name,
          group,
          status: out.status,
          durationMs: Date.now() - t0,
          detail: out.detail,
        });
      } catch (err) {
        results.push({
          id,
          name,
          group,
          status: 'fail',
          durationMs: Date.now() - t0,
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    };

    await push('database.ping', 'Database reachable', 'core', async () => {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'pass', detail: 'SELECT 1 ok' };
    });

    await push('secrets.jwt', 'Auth secrets present', 'core', async () => {
      const jwt = this.config.get<string>('JWT_SECRET') || '';
      const learner = this.config.get<string>('LEARNER_JWT_SECRET') || '';
      const offline = this.config.get<string>('OFFLINE_GRANT_SECRET') || '';
      const short = [jwt, learner, offline].filter((s) => s.length < 16);
      if (short.length) {
        return {
          status: 'fail',
          detail: `${short.length} secret(s) shorter than 16 chars`,
        };
      }
      if (jwt === learner) {
        return { status: 'warn', detail: 'JWT_SECRET equals LEARNER_JWT_SECRET' };
      }
      return { status: 'pass', detail: 'JWT / learner / offline secrets set' };
    });

    await push('email.provider', 'Email provider configured', 'email', async () => {
      const name = this.email.providerName();
      const key = this.config.get<string>('EMAIL_PROVIDER_KEY')?.trim() || '';
      if (name === 'console') {
        return {
          status: 'warn',
          detail: 'EMAIL_PROVIDER=console (OTP logged, not delivered)',
        };
      }
      if (!this.email.isConfigured()) {
        return { status: 'fail', detail: 'EMAIL_PROVIDER_KEY missing' };
      }
      if (key.startsWith('xsmtpsib-')) {
        return {
          status: 'fail',
          detail:
            'Key starts with xsmtpsib- (SMTP). Use an API key starting with xkeysib- from Brevo → SMTP & API → API keys.',
        };
      }
      if (!key.startsWith('xkeysib-')) {
        return {
          status: 'warn',
          detail: 'Brevo API keys usually start with xkeysib-',
        };
      }
      return { status: 'pass', detail: `provider=${name}` };
    });

    await push('email.from', 'Email From address set', 'email', async () => {
      const from =
        this.config.get<string>('EMAIL_FROM_ADDRESS')?.trim() ||
        '';
      if (!from || !from.includes('@')) {
        return { status: 'fail', detail: 'EMAIL_FROM_ADDRESS missing' };
      }
      return { status: 'pass', detail: from };
    });

    await push('email.templates', 'Email templates published', 'email', async () => {
      const keys = Object.values(EMAIL_TEMPLATE_KEYS);
      const rows = await this.prisma.notificationTemplate.findMany({
        where: {
          key: { in: keys },
          channel: 'email',
          lifecycle: ContentLifecycle.published,
        },
        select: { key: true },
      });
      const found = new Set(rows.map((r) => r.key));
      const missing = keys.filter((k) => !found.has(k));
      if (missing.length) {
        return {
          status: 'warn',
          detail: `Missing DB templates (builtins still work): ${missing.join(', ')}. Run prisma:seed.`,
        };
      }
      return { status: 'pass', detail: `${keys.length} templates found` };
    });

    await push('email.outbox', 'Email outbox table', 'email', async () => {
      const grouped = await this.prisma.emailOutbox.groupBy({
        by: ['status'],
        _count: { _all: true },
      });
      const counts = Object.fromEntries(
        grouped.map((g) => [g.status, g._count._all]),
      ) as Record<string, number>;
      const pending = counts.pending ?? 0;
      const failed = counts.failed ?? 0;
      const sent = counts.sent ?? 0;
      const dead = counts.dead ?? 0;
      const status: DiagnosticStatus =
        dead > 0 || failed > 0 ? 'warn' : 'pass';
      return {
        status,
        detail: `pending=${pending} sent=${sent} failed=${failed} dead=${dead}`,
      };
    });

    const toEmail =
      dto.toEmail?.trim().toLowerCase() ||
      actorEmail?.trim().toLowerCase() ||
      this.config.get<string>('EMAIL_FROM_ADDRESS')?.trim().toLowerCase();

    await push('email.delivery', 'Send test email', 'email', async () => {
      if (dto.dryRun) {
        return { status: 'skip', detail: 'dryRun=true' };
      }
      if (!toEmail) {
        return {
          status: 'fail',
          detail: 'No toEmail / actor email / EMAIL_FROM_ADDRESS',
        };
      }
      const key = this.config.get<string>('EMAIL_PROVIDER_KEY')?.trim() || '';
      if (
        this.email.providerName() === 'brevo' &&
        key.startsWith('xsmtpsib-')
      ) {
        return {
          status: 'fail',
          detail: 'Cannot send: SMTP key configured. Replace with xkeysib- API key.',
        };
      }
      return this.sendProbe(toEmail, 'System test from REDI admin');
    });

    await push('auth.otp_roundtrip', 'OTP challenge round-trip', 'auth', async () => {
      const code = String(crypto.randomInt(100000, 999999));
      const codeHash = crypto.createHash('sha256').update(code).digest('hex');
      const email = `diag+${Date.now()}@redi.local`;
      const challenge = await this.prisma.authChallenge.create({
        data: {
          purpose: 'email_verify',
          email,
          codeHash,
          expiresAt: new Date(Date.now() + 10 * 60_000),
        },
      });
      const match = challenge.codeHash === codeHash;
      await this.prisma.authChallenge.delete({ where: { id: challenge.id } });
      if (!match) {
        return { status: 'fail', detail: 'Hash mismatch' };
      }
      return { status: 'pass', detail: `challenge ${challenge.id.slice(0, 8)}… ok` };
    });

    await push('providers.live', 'Live (Daily) configured', 'providers', async () => {
      if (!this.daily.isConfigured()) {
        return { status: 'warn', detail: 'DAILY_API_KEY not set' };
      }
      return { status: 'pass', detail: 'Daily API key present' };
    });

    await push('providers.push', 'Push configured', 'providers', async () => {
      if (!this.config.get('PUSH_PROVIDER_KEY')) {
        return { status: 'warn', detail: 'PUSH_PROVIDER_KEY not set' };
      }
      return { status: 'pass' };
    });

    await push('providers.payments', 'Payments configured', 'providers', async () => {
      if (!this.config.get('PAYMENT_PROVIDER_KEY')) {
        return { status: 'warn', detail: 'PAYMENT_PROVIDER_KEY not set' };
      }
      return { status: 'pass' };
    });

    await push('providers.video', 'Video providers', 'providers', async () => {
      const mux = Boolean(
        this.config.get('MUX_TOKEN_ID') && this.config.get('MUX_TOKEN_SECRET'),
      );
      const cloudinary = Boolean(
        this.config.get('CLOUDINARY_CLOUD_NAME') &&
          this.config.get('CLOUDINARY_API_KEY') &&
          this.config.get('CLOUDINARY_API_SECRET'),
      );
      if (!mux && !cloudinary) {
        return { status: 'warn', detail: 'Neither Mux nor Cloudinary configured' };
      }
      return {
        status: 'pass',
        detail: `mux=${mux} cloudinary=${cloudinary}`,
      };
    });

    await push('data.learners', 'Learners present', 'data', async () => {
      const count = await this.prisma.learner.count();
      if (count === 0) {
        return { status: 'warn', detail: 'No learners — run prisma:seed' };
      }
      return { status: 'pass', detail: `${count} learner(s)` };
    });

    await push('data.courses', 'Published courses', 'data', async () => {
      const count = await this.prisma.course.count({
        where: { lifecycle: ContentLifecycle.published },
      });
      if (count === 0) {
        return { status: 'warn', detail: 'No published courses' };
      }
      return { status: 'pass', detail: `${count} published` };
    });

    await push('data.admin', 'Admin users', 'data', async () => {
      const count = await this.prisma.adminUser.count({
        where: { isActive: true },
      });
      if (count === 0) {
        return { status: 'fail', detail: 'No active admin users' };
      }
      return { status: 'pass', detail: `${count} active` };
    });

    const summary = {
      pass: results.filter((r) => r.status === 'pass').length,
      fail: results.filter((r) => r.status === 'fail').length,
      warn: results.filter((r) => r.status === 'warn').length,
      skip: results.filter((r) => r.status === 'skip').length,
      total: results.length,
    };

    return {
      ok: summary.fail === 0,
      ranAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      toEmail: toEmail ?? null,
      summary,
      results,
      overview: this.overview(),
    };
  }

  async sendProbe(toEmail: string, note?: string) {
    const t0 = Date.now();
    const row = await this.email.enqueueRaw({
      toEmail,
      subject: `REDI system test — ${new Date().toISOString()}`,
      htmlBody: `<p>This is a REDI admin system test email.</p><p>${note || ''}</p><p>If you received this, Brevo delivery is working.</p>`,
      textBody: `REDI system test. ${note || ''} If you received this, Brevo delivery is working.`,
      templateKey: 'diagnostics.probe',
      meta: { kind: 'diagnostics' },
    });
    const delivered = await this.email.deliverOutboxRow(row.id);
    if (!delivered || delivered.status !== 'sent') {
      return {
        status: 'fail' as const,
        detail: delivered?.lastError || 'Delivery failed',
        durationMs: Date.now() - t0,
        outboxId: row.id,
      };
    }
    return {
      status: 'pass' as const,
      detail: `Sent to ${toEmail} (providerId=${delivered.providerId || 'n/a'})`,
      durationMs: Date.now() - t0,
      outboxId: row.id,
      providerId: delivered.providerId,
    };
  }

  async emailProbe(toEmail: string, note?: string) {
    const result = await this.sendProbe(toEmail, note);
    return {
      ok: result.status === 'pass',
      ...result,
      overview: this.overview(),
    };
  }
}
