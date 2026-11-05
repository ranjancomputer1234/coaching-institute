import { Module } from '@nestjs/common';
import { LearnerExamsController } from './learner-exams.controller';
import { LearnerExamsService } from './learner-exams.service';

@Module({
  controllers: [LearnerExamsController],
  providers: [LearnerExamsService],
  exports: [LearnerExamsService],
})
export class LearnerExamsModule {}
