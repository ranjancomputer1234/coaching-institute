import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { LearnerLiveService } from './learner-live.service';
import { LearnerJwtAuthGuard } from '../../common/guards/learner-jwt-auth.guard';
import { OptionalLearnerJwtAuthGuard } from '../../common/guards/optional-learner-jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class ReminderDto {
  @IsBoolean()
  enabled!: boolean;
}

class HandDto {
  @IsBoolean()
  raised!: boolean;
}

@Controller('live-classes')
export class LearnerLiveController {
  constructor(private readonly live: LearnerLiveService) {}

  @UseGuards(OptionalLearnerJwtAuthGuard)
  @Get()
  list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @CurrentUser() user?: { learnerId: string } | null,
  ) {
    return this.live.list({ from, to, learnerId: user?.learnerId });
  }

  @UseGuards(OptionalLearnerJwtAuthGuard)
  @Get(':id')
  getOne(
    @Param('id') id: string,
    @CurrentUser() user?: { learnerId: string } | null,
  ) {
    return this.live.getOne(id, user?.learnerId);
  }

  @UseGuards(LearnerJwtAuthGuard)
  @Post(':id/join')
  join(
    @Param('id') id: string,
    @CurrentUser() user: { learnerId: string },
  ) {
    return this.live.join(id, user.learnerId);
  }

  @UseGuards(LearnerJwtAuthGuard)
  @Put(':id/reminder')
  @HttpCode(204)
  async reminder(
    @Param('id') id: string,
    @Body() dto: ReminderDto,
    @CurrentUser() user: { learnerId: string },
  ) {
    await this.live.setReminder(id, user.learnerId, dto.enabled);
  }

  @UseGuards(LearnerJwtAuthGuard)
  @Put(':id/hand')
  hand(
    @Param('id') id: string,
    @Body() dto: HandDto,
    @CurrentUser() user: { learnerId: string },
  ) {
    return this.live.setHand(id, user.learnerId, dto.raised);
  }
}
