import { EMAIL_TEMPLATE_KEYS, TemplateVars } from './email.types';

export type RenderedEmail = {
  subject: string;
  htmlBody: string;
  textBody: string;
};

function esc(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function apply(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    esc(vars[key]),
  );
}

const BUILTIN: Record<
  string,
  { subject: string; html: string; text: string }
> = {
  [EMAIL_TEMPLATE_KEYS.verify]: {
    subject: 'Verify your REDI account — {{otp}}',
    html: `<p>Hi {{firstName}},</p><p>Your verification code is <strong style="font-size:20px;letter-spacing:2px">{{otp}}</strong>.</p><p>It expires in {{expiresMinutes}} minutes. If you did not create this account, ignore this email.</p><p>— REDI</p>`,
    text: `Hi {{firstName}},\n\nYour verification code is {{otp}}.\nIt expires in {{expiresMinutes}} minutes.\n\n— REDI`,
  },
  [EMAIL_TEMPLATE_KEYS.passwordReset]: {
    subject: 'Reset your REDI password — {{otp}}',
    html: `<p>Hi {{firstName}},</p><p>Your password reset code is <strong style="font-size:20px;letter-spacing:2px">{{otp}}</strong>.</p><p>It expires in {{expiresMinutes}} minutes. If you did not request this, ignore this email.</p><p>— REDI</p>`,
    text: `Hi {{firstName}},\n\nYour password reset code is {{otp}}.\nIt expires in {{expiresMinutes}} minutes.\n\n— REDI`,
  },
  [EMAIL_TEMPLATE_KEYS.liveClass]: {
    subject: 'Live class: {{title}}',
    html: `<p>Hi {{firstName}},</p><p>Your live class <strong>{{title}}</strong> is scheduled.</p><p><strong>Starts:</strong> {{startsAt}}</p>{{#joinUrl}}<p><a href="{{joinUrl}}">Join class</a></p>{{/joinUrl}}<p>— REDI</p>`,
    text: `Hi {{firstName}},\n\nLive class: {{title}}\nStarts: {{startsAt}}\n{{joinUrl}}\n\n— REDI`,
  },
  [EMAIL_TEMPLATE_KEYS.resultPublished]: {
    subject: 'Result published: {{testTitle}}',
    html: `<p>Hi {{firstName}},</p><p>Your result for <strong>{{testTitle}}</strong> is now available in the REDI app.</p><p>— REDI</p>`,
    text: `Hi {{firstName}},\n\nYour result for {{testTitle}} is now available in the REDI app.\n\n— REDI`,
  },
};

/** Simple Mustache-lite: strips {{#joinUrl}}...{{/joinUrl}} when joinUrl empty. */
function expandConditionals(source: string, vars: TemplateVars): string {
  return source.replace(
    /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
    (_, key: string, inner: string) => {
      const v = vars[key];
      if (v === null || v === undefined || v === '') return '';
      return inner;
    },
  );
}

export function renderBuiltinTemplate(
  key: string,
  vars: TemplateVars,
): RenderedEmail {
  const tpl = BUILTIN[key];
  if (!tpl) {
    throw new Error(`Unknown email template: ${key}`);
  }
  const subject = apply(tpl.subject, vars);
  const htmlBody = apply(expandConditionals(tpl.html, vars), vars);
  const textBody = apply(expandConditionals(tpl.text, vars), vars);
  return { subject, htmlBody, textBody };
}

export function renderFromDbTemplate(
  title: string,
  body: string,
  vars: TemplateVars,
): RenderedEmail {
  const subject = apply(expandConditionals(title, vars), vars);
  const htmlBody = apply(expandConditionals(body, vars), vars);
  const textBody = htmlBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return { subject, htmlBody, textBody };
}
