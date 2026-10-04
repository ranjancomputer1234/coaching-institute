import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';
import {
  GrantEntitlementDto,
  RevokeEntitlementDto,
} from './dto/entitlement.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/entitlements')
export class EntitlementsController {
  constructor(private readonly entitlements: EntitlementsService) {}

  @Get()
  @RequirePermissions('enrollments.create')
  list(@Query('learnerId') learnerId?: string) {
    return this.entitlements.list(learnerId);
  }

  @Post('grant')
  @RequirePermissions('enrollments.create')
  grant(
    @Body() dto: GrantEntitlementDto,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.entitlements.grant(dto, user);
  }

  @Post(':id/revoke')
  @RequirePermissions('enrollments.revoke')
  revoke(
    @Param('id') id: string,
    @Body() dto: RevokeEntitlementDto,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.entitlements.revoke(id, dto, user);
  }
}
