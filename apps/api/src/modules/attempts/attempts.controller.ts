import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AttemptStatus } from '@prisma/client';
import { AttemptsService } from './attempts.service';
import { CreateAttemptDto, SaveAnswerDto } from './dto/attempt.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

type Actor = { userId: string; email?: string };

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/attempts')
export class AttemptsController {
  constructor(private readonly attemptsService: AttemptsService) {}

  @Get()
  @RequirePermissions('results.read')
  findAll(@Query('status') status?: AttemptStatus) {
    return this.attemptsService.findAll(status);
  }

  @Get(':id')
  @RequirePermissions('results.read')
  findOne(@Param('id') id: string) {
    return this.attemptsService.findOne(id);
  }

  @Post()
  @RequirePermissions('assessments.author')
  create(@Body() dto: CreateAttemptDto, @CurrentUser() user: Actor) {
    return this.attemptsService.create(dto, user);
  }

  @Post(':id/answers/:questionId')
  @RequirePermissions('assessments.author')
  saveAnswer(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Body() dto: SaveAnswerDto,
  ) {
    return this.attemptsService.saveAnswer(id, questionId, dto);
  }

  @Post(':id/submit')
  @RequirePermissions('assessments.author')
  submit(@Param('id') id: string, @CurrentUser() user: Actor) {
    return this.attemptsService.submit(id, user);
  }
}
