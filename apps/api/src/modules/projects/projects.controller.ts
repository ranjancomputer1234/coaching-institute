import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProjectSubmissionStatus } from '@prisma/client';
import { ProjectsService } from './projects.service';
import {
  CreateProjectDto,
  CreateSubmissionDto,
  ReviewSubmissionDto,
} from './dto/project.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @RequirePermissions('semester.review')
  findAll() {
    return this.projectsService.findAll();
  }

  @Get('submissions')
  @RequirePermissions('semester.review')
  listSubmissions(@Query('status') status?: ProjectSubmissionStatus) {
    return this.projectsService.listSubmissions(status);
  }

  @Post('submissions/:submissionId/accept')
  @RequirePermissions('semester.approve')
  accept(
    @Param('submissionId') submissionId: string,
    @Body() dto: ReviewSubmissionDto,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.projectsService.accept(submissionId, dto, user);
  }

  @Post('submissions/:submissionId/request-changes')
  @RequirePermissions('semester.review')
  requestChanges(
    @Param('submissionId') submissionId: string,
    @Body() dto: ReviewSubmissionDto,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.projectsService.requestChanges(submissionId, dto, user);
  }

  @Get(':id')
  @RequirePermissions('semester.review')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Post()
  @RequirePermissions('content.create')
  create(
    @Body() dto: CreateProjectDto,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.projectsService.create(dto, user);
  }

  @Post(':id/submissions')
  @RequirePermissions('semester.review')
  submit(
    @Param('id') id: string,
    @Body() dto: CreateSubmissionDto,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.projectsService.submit(id, dto, user);
  }
}
