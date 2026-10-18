import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ResourcesService } from './resources.service';
import {
  CreateResourceDto,
  CreateVideoUploadDto,
  DownloadAuthorizationDto,
} from './dto/resource.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { LearnerJwtAuthGuard } from '../../common/guards/learner-jwt-auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ContentAccessService } from '../content-access/content-access.service';

type AdminActor = { userId: string; email?: string };

@Controller()
export class ResourcesController {
  constructor(
    private readonly resources: ResourcesService,
    private readonly access: ContentAccessService,
  ) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('admin/resources')
  @RequirePermissions('content.edit')
  findAll() {
    return this.resources.findAllAdmin();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('admin/resources')
  @RequirePermissions('content.create')
  create(@Body() dto: CreateResourceDto, @CurrentUser() user: AdminActor) {
    return this.resources.create(dto, user);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('admin/resources/video-uploads')
  @RequirePermissions('content.create')
  createVideoUpload(
    @Body() dto: CreateVideoUploadDto,
    @CurrentUser() user: AdminActor,
  ) {
    return this.resources.createVideoUpload(dto, user);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('admin/resources/:id/video-status')
  @RequirePermissions('content.edit')
  videoStatus(@Param('id') id: string) {
    return this.resources.refreshVideoStatus(id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('admin/resources/:id/video-playback')
  @RequirePermissions('content.edit')
  videoPlayback(@Param('id') id: string) {
    return this.resources.adminVideoPlayback(id);
  }

  @UseGuards(LearnerJwtAuthGuard)
  @Post('resources/:id/download-authorization')
  authorize(
    @Param('id') id: string,
    @Body() dto: DownloadAuthorizationDto,
    @CurrentUser() user: { learnerId: string },
  ) {
    return this.resources.authorizeDownload(id, user.learnerId, dto);
  }

  @Get('protected/delivery/:resourceId')
  delivery(
    @Param('resourceId') resourceId: string,
    @Query('token') token = '',
  ) {
    return this.resources.serveDelivery(resourceId, token);
  }

  @Get('crypto/offline-verification')
  offlineVerification() {
    return this.access.getOfflineVerificationPublic();
  }
}
