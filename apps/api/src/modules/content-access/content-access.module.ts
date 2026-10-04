import { Module } from '@nestjs/common';
import { ContentAccessService } from './content-access.service';

@Module({
  providers: [ContentAccessService],
  exports: [ContentAccessService],
})
export class ContentAccessModule {}
