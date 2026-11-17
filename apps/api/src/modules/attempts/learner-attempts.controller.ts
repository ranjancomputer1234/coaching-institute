import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AttemptsService } from './attempts.service';
import { SaveLearnerAnswerDto } from './dto/attempt.dto';
import { LearnerJwtAuthGuard } from '../../common/guards/learner-jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

type LearnerUser = { learnerId: string };

@UseGuards(LearnerJwtAuthGuard)
@Controller()
export class LearnerAttemptsController {
  constructor(private readonly attempts: AttemptsService) {}

  @Post('tests/:testId/attempts')
  async start(
    @Param('testId') testId: string,
    @CurrentUser() user: LearnerUser,
  ) {
    const attempt = await this.attempts.createForLearner(
      testId,
      user.learnerId,
    );
    return this.attempts.toLearnerView(attempt);
  }

  @Get('me/attempts')
  listMine(@CurrentUser() user: LearnerUser, @Query('testId') testId?: string) {
    return this.attempts.listMine(user.learnerId, { testId });
  }

  @Get('attempts/:id')
  getOne(@Param('id') id: string, @CurrentUser() user: LearnerUser) {
    return this.attempts.getForLearner(id, user.learnerId);
  }

  @Put('attempts/:id/answers/:questionId')
  saveAnswerPut(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Body() dto: SaveLearnerAnswerDto,
    @CurrentUser() user: LearnerUser,
  ) {
    return this.saveAnswer(id, questionId, dto, user);
  }

  @Post('attempts/:id/answers/:questionId')
  saveAnswerPost(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Body() dto: SaveLearnerAnswerDto,
    @CurrentUser() user: LearnerUser,
  ) {
    return this.saveAnswer(id, questionId, dto, user);
  }

  @Post('attempts/:id/submit')
  submit(@Param('id') id: string, @CurrentUser() user: LearnerUser) {
    return this.attempts.submitForLearner(id, user.learnerId);
  }

  @Get('attempts/:id/result')
  result(@Param('id') id: string, @CurrentUser() user: LearnerUser) {
    return this.attempts.getResultForLearner(id, user.learnerId);
  }

  private saveAnswer(
    id: string,
    questionId: string,
    dto: SaveLearnerAnswerDto,
    user: LearnerUser,
  ) {
    const selectedOptionId = (dto.selectedOptionId ?? dto.optionId) as string;
    return this.attempts.saveAnswerForLearner(
      id,
      questionId,
      selectedOptionId,
      user.learnerId,
    );
  }
}
