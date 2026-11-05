import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { LearnerExamsService } from './learner-exams.service';
import { OptionalLearnerJwtAuthGuard } from '../../common/guards/optional-learner-jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
@UseGuards(OptionalLearnerJwtAuthGuard)
export class LearnerExamsController {
  constructor(private readonly exams: LearnerExamsService) {}

  @Get('exams')
  listExams(
    @Query('search') search?: string,
    @Query('pricing') pricing?: string,
    @Query('cursor') cursor?: string,
    @CurrentUser() user?: { learnerId: string } | null,
  ) {
    return this.exams.listExams({
      search,
      pricing,
      cursor,
      learnerId: user?.learnerId,
    });
  }

  @Get('exams/:id')
  getExam(
    @Param('id') id: string,
    @CurrentUser() user?: { learnerId: string } | null,
  ) {
    return this.exams.getExam(id, user?.learnerId);
  }

  @Get('tests')
  listTests(
    @Query('examId') examId?: string,
    @CurrentUser() user?: { learnerId: string } | null,
  ) {
    return this.exams.listTests({ examId, learnerId: user?.learnerId });
  }

  @Get('tests/:id')
  getTest(
    @Param('id') id: string,
    @CurrentUser() user?: { learnerId: string } | null,
  ) {
    return this.exams.getTest(id, user?.learnerId);
  }
}
