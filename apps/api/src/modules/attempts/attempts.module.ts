import { Module } from '@nestjs/common';
import { AttemptsService } from './attempts.service';
import { AttemptsController } from './attempts.controller';
import { LearnerAttemptsController } from './learner-attempts.controller';

@Module({
  controllers: [AttemptsController, LearnerAttemptsController],
  providers: [AttemptsService],
  exports: [AttemptsService],
})
export class AttemptsModule {}
