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
import { LearnersService } from './learners.service';
import { CreateLearnerDto } from './dto/create-learner.dto';
import { UpdateLearnerDto } from './dto/update-learner.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsString, MinLength } from 'class-validator';

class ReasonDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}

type Actor = { userId: string; name?: string; email?: string };

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/learners')
export class LearnersController {
  constructor(private readonly learnersService: LearnersService) {}

  @Get()
  @RequirePermissions('users.read')
  findAll(@Query('q') q?: string) {
    return this.learnersService.findAll(q);
  }

  @Get(':id')
  @RequirePermissions('users.read')
  findOne(@Param('id') id: string) {
    return this.learnersService.findOne(id);
  }

  @Post()
  @RequirePermissions('users.update')
  create(@Body() dto: CreateLearnerDto, @CurrentUser() user: Actor) {
    return this.learnersService.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions('users.update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLearnerDto,
    @CurrentUser() user: Actor,
  ) {
    return this.learnersService.update(id, dto, user);
  }

  @Post(':id/suspend')
  @RequirePermissions('users.suspend')
  suspend(
    @Param('id') id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() user: Actor,
  ) {
    return this.learnersService.suspend(id, dto.reason, user);
  }

  @Post(':id/reactivate')
  @RequirePermissions('users.suspend')
  reactivate(
    @Param('id') id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() user: Actor,
  ) {
    return this.learnersService.reactivate(id, dto.reason, user);
  }
}
