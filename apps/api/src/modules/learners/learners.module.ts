import { Module } from '@nestjs/common';
import { LearnerAuthModule } from '../learner-auth/learner-auth.module';
import { LearnersService } from './learners.service';
import { LearnersController } from './learners.controller';

@Module({
  imports: [LearnerAuthModule],
  controllers: [LearnersController],
  providers: [LearnersService],
  exports: [LearnersService],
})
export class LearnersModule {}
