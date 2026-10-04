import { Module } from '@nestjs/common';
import { SemesterReviewsService } from './semester-reviews.service';
import { SemesterReviewsController } from './semester-reviews.controller';

@Module({
  controllers: [SemesterReviewsController],
  providers: [SemesterReviewsService],
  exports: [SemesterReviewsService],
})
export class SemesterReviewsModule {}
