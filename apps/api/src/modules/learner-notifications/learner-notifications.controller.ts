import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { LearnerNotificationsService } from './learner-notifications.service';
import { LearnerJwtAuthGuard } from '../../common/guards/learner-jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class MarkReadDto {
  @IsBoolean()
  read!: boolean;
}

@UseGuards(LearnerJwtAuthGuard)
@Controller('me/notifications')
export class LearnerNotificationsController {
  constructor(private readonly notifications: LearnerNotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: { learnerId: string },
    @Query('category') category?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.notifications.list(user.learnerId, { category, cursor });
  }

  @Post('clear')
  @HttpCode(200)
  clear(@CurrentUser() user: { learnerId: string }) {
    return this.notifications.clear(user.learnerId);
  }

  @Patch(':id')
  markRead(
    @Param('id') id: string,
    @Body() dto: MarkReadDto,
    @CurrentUser() user: { learnerId: string },
  ) {
    return this.notifications.markRead(user.learnerId, id, dto.read);
  }
}
