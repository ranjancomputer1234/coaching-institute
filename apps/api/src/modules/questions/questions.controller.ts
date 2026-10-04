import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { QuestionStatus } from '@prisma/client';
import { QuestionsService } from './questions.service';
import { CreateQuestionDto, UpdateQuestionDto } from './dto/question.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get()
  @RequirePermissions('assessments.author')
  findAll(@Query('status') status?: QuestionStatus) {
    return this.questionsService.findAll(status);
  }

  @Get(':id')
  @RequirePermissions('assessments.author')
  findOne(@Param('id') id: string) {
    return this.questionsService.findOne(id);
  }

  @Post()
  @RequirePermissions('assessments.author')
  create(
    @Body() dto: CreateQuestionDto,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.questionsService.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions('assessments.author')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionDto,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.questionsService.update(id, dto, user);
  }

  @Post(':id/approve')
  @RequirePermissions('assessments.publish')
  approve(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.questionsService.approve(id, user);
  }

  @Post(':id/retire')
  @RequirePermissions('assessments.author')
  retire(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.questionsService.retire(id, user);
  }
}
