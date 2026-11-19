import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../../common/guards/permissions.guard';
import { DiagnosticsRunDto, EmailProbeDto } from './diagnostics.dto';
import { DiagnosticsService } from './diagnostics.service';

type Actor = { userId: string; email?: string };

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/diagnostics')
export class DiagnosticsController {
  constructor(private readonly diagnostics: DiagnosticsService) {}

  @Get()
  @RequirePermissions('settings.manage')
  overview() {
    return this.diagnostics.overview();
  }

  @Post('run')
  @RequirePermissions('settings.manage')
  run(@Body() dto: DiagnosticsRunDto, @CurrentUser() user: Actor) {
    return this.diagnostics.runSuite(dto ?? {}, user.email);
  }

  @Post('email-test')
  @RequirePermissions('settings.manage')
  emailTest(@Body() dto: EmailProbeDto) {
    return this.diagnostics.emailProbe(dto.toEmail, dto.note);
  }
}
