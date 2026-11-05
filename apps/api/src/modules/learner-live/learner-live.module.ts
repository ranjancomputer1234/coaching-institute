import { Module } from '@nestjs/common';
import { LearnerLiveController } from './learner-live.controller';
import { LearnerLiveService } from './learner-live.service';

@Module({
  controllers: [LearnerLiveController],
  providers: [LearnerLiveService],
  exports: [LearnerLiveService],
})
export class LearnerLiveModule {}
