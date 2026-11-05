import { Module } from '@nestjs/common';
import { PlatformService } from './platform.service';
import { PlatformController } from './platform.controller';
import { LegalController } from './legal.controller';
import { DailyService } from './daily.service';

@Module({
  controllers: [PlatformController, LegalController],
  providers: [PlatformService, DailyService],
  exports: [PlatformService, DailyService],
})
export class PlatformModule {}
