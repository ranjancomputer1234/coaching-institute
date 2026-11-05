import { Module } from '@nestjs/common';
import { LearnerEditorialController } from './learner-editorial.controller';
import { LearnerEditorialService } from './learner-editorial.service';

@Module({
  controllers: [LearnerEditorialController],
  providers: [LearnerEditorialService],
  exports: [LearnerEditorialService],
})
export class LearnerEditorialModule {}
