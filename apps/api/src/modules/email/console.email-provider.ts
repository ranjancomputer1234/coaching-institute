import { Logger } from '@nestjs/common';
import {
  EmailProvider,
  SendEmailInput,
  SendEmailResult,
} from './email.types';

/** Local/dev provider: logs the message instead of delivering. */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console' as const;
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    this.logger.log(
      `[console-mail] to=${input.toEmail} subject=${JSON.stringify(input.subject)}`,
    );
    if (input.textBody) {
      this.logger.debug(input.textBody);
    } else {
      this.logger.debug(input.htmlBody.replace(/<[^>]+>/g, ' ').slice(0, 500));
    }
    return { providerId: `console-${Date.now()}` };
  }
}
