import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateStaffDto, UpdateStaffDto } from '../platform/platform.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin')
export class StaffController {
  constructor(private readonly users: UsersService) {}

  @Get('staff')
  @RequirePermissions('admins.manage')
  list() {
    return this.users.listStaff();
  }

  @Get('roles')
  @RequirePermissions('admins.manage')
  roles() {
    return this.users.listRoles();
  }

  @Post('staff')
  @RequirePermissions('admins.manage')
  create(
    @Body() dto: CreateStaffDto,
    @CurrentUser() user: { userId: string; email?: string },
  ) {
    return this.users.createStaff(dto, user);
  }

  @Patch('staff/:id')
  @RequirePermissions('admins.manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
    @CurrentUser() user: { userId: string; email?: string },
  ) {
    return this.users.updateStaff(id, dto, user);
  }
}
