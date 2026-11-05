import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ExamsService } from './exams.service';
import { CreateExamDto, UpdateExamDto } from './dto/exam.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

type Actor = { userId: string; email?: string };

@Controller('admin/exams')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExamsController {
  constructor(private readonly exams: ExamsService) {}

  @Get()
  @RequirePermissions('content.edit')
  findAll() {
    return this.exams.findAll();
  }

  @Get(':id')
  @RequirePermissions('content.edit')
  findOne(@Param('id') id: string) {
    return this.exams.findOne(id);
  }

  @Post()
  @RequirePermissions('content.create')
  create(@Body() dto: CreateExamDto, @CurrentUser() user: Actor) {
    return this.exams.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions('content.edit')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExamDto,
    @CurrentUser() user: Actor,
  ) {
    return this.exams.update(id, dto, user);
  }

  @Post(':id/publish')
  @RequirePermissions('content.publish')
  publish(@Param('id') id: string, @CurrentUser() user: Actor) {
    return this.exams.publish(id, user);
  }
}
