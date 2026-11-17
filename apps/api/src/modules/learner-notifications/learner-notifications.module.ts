import { Module } from '@nestjs/common';
import { LearnerNotificationsController } from './learner-notifications.controller';
import { LearnerNotificationsService } from './learner-notifications.service';

@Module({
  controllers: [LearnerNotificationsController],
  providers: [LearnerNotificationsService],
  exports: [LearnerNotificationsService],
})
export class LearnerNotificationsModule {}
