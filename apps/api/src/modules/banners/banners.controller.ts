import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BannersService } from './banners.service';
import { CreateBannerDto, UpdateBannerDto } from './dto/banner.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

type Actor = { userId: string; email?: string };

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Get()
  @RequirePermissions('banners.manage')
  findAll() {
    return this.bannersService.findAll();
  }

  @Get(':id')
  @RequirePermissions('banners.manage')
  findOne(@Param('id') id: string) {
    return this.bannersService.findOne(id);
  }

  @Post()
  @RequirePermissions('banners.manage')
  create(@Body() dto: CreateBannerDto, @CurrentUser() user: Actor) {
    return this.bannersService.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions('banners.manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBannerDto,
    @CurrentUser() user: Actor,
  ) {
    return this.bannersService.update(id, dto, user);
  }

  @Post(':id/publish')
  @RequirePermissions('banners.manage')
  publish(@Param('id') id: string, @CurrentUser() user: Actor) {
    return this.bannersService.publish(id, user);
  }

  @Post(':id/pause')
  @RequirePermissions('banners.manage')
  pause(@Param('id') id: string, @CurrentUser() user: Actor) {
    return this.bannersService.pause(id, user);
  }
}
