import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../../common/guards/permissions.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/audit-events')
export class AuditEventsController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions('audit.read')
  list(
    @Query('action') action?: string,
    @Query('resourceType') resourceType?: string,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
  ) {
    return this.audit.list({
      action,
      resourceType,
      cursor,
      take: take ? Number(take) : 50,
    });
  }
}
