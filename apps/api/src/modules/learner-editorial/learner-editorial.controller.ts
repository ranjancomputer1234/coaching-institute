import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { LearnerEditorialService } from './learner-editorial.service';
import { LearnerJwtAuthGuard } from '../../common/guards/learner-jwt-auth.guard';
import { OptionalLearnerJwtAuthGuard } from '../../common/guards/optional-learner-jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class FactReactionDto {
  @IsBoolean()
  reacted!: boolean;
}

@Controller()
export class LearnerEditorialController {
  constructor(private readonly editorial: LearnerEditorialService) {}

  // News
  @Get('news/categories')
  newsCategories(
    @Query('search') search?: string,
    @Query('pricing') pricing?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.editorial.listNewsCategories({ search, pricing, cursor });
  }

  @UseGuards(OptionalLearnerJwtAuthGuard)
  @Get('news')
  newsList(
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('cursor') cursor?: string,
    @CurrentUser() user?: { learnerId: string } | null,
  ) {
    return this.editorial.listNews({
      categoryId,
      search,
      cursor,
      learnerId: user?.learnerId,
    });
  }

  @UseGuards(OptionalLearnerJwtAuthGuard)
  @Get('news/:id')
  newsOne(
    @Param('id') id: string,
    @CurrentUser() user?: { learnerId: string } | null,
  ) {
    return this.editorial.getNews(id, user?.learnerId);
  }

  // Awareness
  @UseGuards(OptionalLearnerJwtAuthGuard)
  @Get('awareness/topics')
  awarenessTopics(
    @Query('search') search?: string,
    @Query('pricing') pricing?: string,
    @Query('cursor') cursor?: string,
    @CurrentUser() user?: { learnerId: string } | null,
  ) {
    return this.editorial.listAwarenessTopics({
      search,
      pricing,
      cursor,
      learnerId: user?.learnerId,
    });
  }

  @UseGuards(OptionalLearnerJwtAuthGuard)
  @Get('awareness/topics/:id')
  awarenessTopic(
    @Param('id') id: string,
    @CurrentUser() user?: { learnerId: string } | null,
  ) {
    return this.editorial.getAwarenessTopic(id, user?.learnerId);
  }

  // Facts
  @Get('facts/categories')
  factCategories(
    @Query('search') search?: string,
    @Query('pricing') pricing?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.editorial.listFactCategories({ search, pricing, cursor });
  }

  @UseGuards(OptionalLearnerJwtAuthGuard)
  @Get('facts')
  factsList(
    @Query('categoryId') categoryId?: string,
    @Query('cursor') cursor?: string,
    @CurrentUser() user?: { learnerId: string } | null,
  ) {
    return this.editorial.listFacts({
      categoryId,
      cursor,
      learnerId: user?.learnerId,
    });
  }

  @UseGuards(OptionalLearnerJwtAuthGuard)
  @Get('facts/:id')
  factOne(
    @Param('id') id: string,
    @CurrentUser() user?: { learnerId: string } | null,
  ) {
    return this.editorial.getFact(id, user?.learnerId);
  }

  @UseGuards(LearnerJwtAuthGuard)
  @Put('facts/:id/reaction')
  factReaction(
    @Param('id') id: string,
    @Body() dto: FactReactionDto,
    @CurrentUser() user: { learnerId: string },
  ) {
    return this.editorial.setFactReaction(id, user.learnerId, dto.reacted);
  }

  // Interview
  @UseGuards(OptionalLearnerJwtAuthGuard)
  @Get('interview/categories')
  interviewCategories(
    @Query('search') search?: string,
    @Query('pricing') pricing?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.editorial.listInterviewCategories({ search, pricing, cursor });
  }

  @Get('interview/questions')
  interviewQuestions(@Query('categoryId') categoryId?: string) {
    return this.editorial.listInterviewQuestions({ categoryId });
  }

  @Get('interview/questions/:id')
  interviewQuestion(@Param('id') id: string) {
    return this.editorial.getInterviewQuestion(id);
  }
}
