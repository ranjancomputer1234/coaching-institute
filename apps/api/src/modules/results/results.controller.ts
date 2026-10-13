import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ResultsService } from './results.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsOptional, IsString } from 'class-validator';

class PublishDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/results')
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  @Get()
  @RequirePermissions('results.read')
  findAll(@Query('published') published?: string) {
    const flag = published === undefined ? undefined : published === 'true';
    return this.resultsService.findAll(flag);
  }

  @Post('by-test/:testId/publish')
  @RequirePermissions('results.publish')
  publishForTest(
    @Param('testId') testId: string,
    @Body() dto: PublishDto,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.resultsService.publishForTest(testId, dto.reason, user);
  }

  @Get(':id')
  @RequirePermissions('results.read')
  findOne(@Param('id') id: string) {
    return this.resultsService.findOne(id);
  }

  @Post(':id/publish')
  @RequirePermissions('results.publish')
  publishOne(
    @Param('id') id: string,
    @Body() dto: PublishDto,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.resultsService.publishOne(id, dto.reason, user);
  }
}
