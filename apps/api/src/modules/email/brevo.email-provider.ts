import { Logger } from '@nestjs/common';
import {
  EmailProvider,
  SendEmailInput,
  SendEmailResult,
} from './email.types';

type BrevoConfig = {
  apiKey: string;
  fromEmail: string;
  fromName: string;
};

/** Brevo (Sendinblue) transactional API — works with a verified personal From address (no custom domain required). */
export class BrevoEmailProvider implements EmailProvider {
  readonly name = 'brevo' as const;
  private readonly logger = new Logger(BrevoEmailProvider.name);

  constructor(private readonly config: BrevoConfig) {}

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': this.config.apiKey,
      },
      body: JSON.stringify({
        sender: {
          name: this.config.fromName,
          email: this.config.fromEmail,
        },
        to: [
          {
            email: input.toEmail,
            name: input.toName || undefined,
          },
        ],
        subject: input.subject,
        htmlContent: input.htmlBody,
        textContent: input.textBody || undefined,
      }),
    });

    const raw = await res.text();
    if (!res.ok) {
      this.logger.warn(`Brevo send failed status=${res.status} body=${raw}`);
      throw new Error(`Brevo HTTP ${res.status}: ${raw.slice(0, 300)}`);
    }

    let providerId: string | undefined;
    try {
      const parsed = JSON.parse(raw) as { messageId?: string };
      providerId = parsed.messageId;
    } catch {
      providerId = undefined;
    }
    return { providerId };
  }
}
