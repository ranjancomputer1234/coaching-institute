import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DocumentStatus } from '@prisma/client';
import { DocumentsService } from './documents.service';
import {
  CreateTemplateDto,
  IssueDocumentDto,
  RevokeDocumentDto,
} from './dto/document.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { LearnerJwtAuthGuard } from '../../common/guards/learner-jwt-auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

type AdminActor = { userId: string; email?: string };

@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('admin/document-templates')
  @RequirePermissions('documents.generate')
  listTemplates() {
    return this.documents.listTemplates();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('admin/document-templates')
  @RequirePermissions('documents.generate')
  createTemplate(@Body() dto: CreateTemplateDto) {
    return this.documents.createTemplate(dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('admin/documents')
  @RequirePermissions('documents.issue')
  list(@Query('status') status?: DocumentStatus) {
    return this.documents.listAdmin(status);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('admin/documents/issue')
  @RequirePermissions('documents.issue')
  issue(@Body() dto: IssueDocumentDto, @CurrentUser() user: AdminActor) {
    return this.documents.issue(dto, user);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('admin/documents/:id/revoke')
  @RequirePermissions('documents.revoke')
  revoke(
    @Param('id') id: string,
    @Body() dto: RevokeDocumentDto,
    @CurrentUser() user: AdminActor,
  ) {
    return this.documents.revoke(id, dto.reason, user);
  }

  @UseGuards(LearnerJwtAuthGuard)
  @Get('me/documents')
  mine(@CurrentUser() user: { learnerId: string }) {
    return this.documents.listForLearner(user.learnerId);
  }

  @UseGuards(LearnerJwtAuthGuard)
  @Get('me/documents/:id')
  mineOne(@Param('id') id: string, @CurrentUser() user: { learnerId: string }) {
    return this.documents.getForLearner(user.learnerId, id);
  }

  @Get('documents/verify/:token')
  verify(@Param('token') token: string) {
    return this.documents.verify(token);
  }
}
