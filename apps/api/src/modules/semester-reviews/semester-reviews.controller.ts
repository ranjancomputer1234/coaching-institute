import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SemesterReviewsService } from './semester-reviews.service';
import {
  CreateSemesterDto,
  SemesterDecisionDto,
} from '../projects/dto/project.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsString } from 'class-validator';

class SubmitReviewDto {
  @IsString()
  enrollmentId!: string;

  @IsString()
  semesterId!: string;
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin')
export class SemesterReviewsController {
  constructor(private readonly service: SemesterReviewsService) {}

  @Get('semesters')
  @RequirePermissions('semester.review')
  listSemesters(@Query('courseId') courseId?: string) {
    return this.service.listSemesters(courseId);
  }

  @Post('semesters')
  @RequirePermissions('content.create')
  createSemester(
    @Body() dto: CreateSemesterDto,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.service.createSemester(dto, user);
  }

  @Get('semester-reviews')
  @RequirePermissions('semester.review')
  listPending() {
    return this.service.listPending();
  }

  @Post('semester-reviews/submit')
  @RequirePermissions('semester.review')
  submit(
    @Body() dto: SubmitReviewDto,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.service.submitReview(dto.enrollmentId, dto.semesterId, user);
  }

  @Post('semester-reviews/:id/approve')
  @RequirePermissions('semester.approve')
  approve(
    @Param('id') id: string,
    @Body() dto: SemesterDecisionDto,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.service.approve(id, dto, user);
  }

  @Post('semester-reviews/:id/request-changes')
  @RequirePermissions('semester.review')
  requestChanges(
    @Param('id') id: string,
    @Body() dto: SemesterDecisionDto,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.service.requestChanges(id, dto, user);
  }
}
