export type EmailProviderName = 'console' | 'brevo';

export type SendEmailInput = {
  toEmail: string;
  toName?: string | null;
  subject: string;
  htmlBody: string;
  textBody?: string | null;
};

export type SendEmailResult = {
  providerId?: string;
};

export interface EmailProvider {
  readonly name: EmailProviderName;
  send(input: SendEmailInput): Promise<SendEmailResult>;
}

export type TemplateVars = Record<string, string | number | null | undefined>;

export const EMAIL_TEMPLATE_KEYS = {
  verify: 'email.verify',
  passwordReset: 'email.password_reset',
  liveClass: 'email.live_class',
  resultPublished: 'email.result_published',
} as const;
