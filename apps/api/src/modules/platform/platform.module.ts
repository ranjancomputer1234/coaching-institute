import { Module } from '@nestjs/common';
import { PlatformService } from './platform.service';
import { PlatformController } from './platform.controller';
import { DailyService } from './daily.service';

@Module({
  controllers: [PlatformController],
  providers: [PlatformService, DailyService],
  exports: [PlatformService, DailyService],
})
export class PlatformModule {}
