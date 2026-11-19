import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailWorker } from './email.worker';

@Global()
@Module({
  providers: [EmailService, EmailWorker],
  exports: [EmailService],
})
export class EmailModule {}
