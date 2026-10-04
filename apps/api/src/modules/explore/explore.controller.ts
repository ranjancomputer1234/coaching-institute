import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ExploreService } from './explore.service';
import {
  CreateExploreSectionDto,
  ReorderExploreDto,
  UpdateExploreSectionDto,
} from './dto/explore.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/explore-sections')
export class ExploreController {
  constructor(private readonly exploreService: ExploreService) {}

  @Get()
  @RequirePermissions('explore.manage')
  findAll() {
    return this.exploreService.findAll();
  }

  @Post('reorder')
  @RequirePermissions('explore.manage')
  reorder(
    @Body() dto: ReorderExploreDto,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.exploreService.reorder(dto.orderedIds, user);
  }

  @Get(':id')
  @RequirePermissions('explore.manage')
  findOne(@Param('id') id: string) {
    return this.exploreService.findOne(id);
  }

  @Post()
  @RequirePermissions('explore.manage')
  create(
    @Body() dto: CreateExploreSectionDto,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.exploreService.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions('explore.manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExploreSectionDto,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.exploreService.update(id, dto, user);
  }

  @Post(':id/publish')
  @RequirePermissions('explore.manage')
  publish(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.exploreService.publish(id, user);
  }
}
