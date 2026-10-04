import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BatchesService } from './batches.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../../common/guards/permissions.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller(['admin/batches', 'batches'])
export class BatchesController {
  constructor(private readonly batchesService: BatchesService) {}

  @Get()
  @RequirePermissions('users.read')
  findAll() {
    return this.batchesService.findAll();
  }

  @Get(':id')
  @RequirePermissions('users.read')
  findOne(@Param('id') id: string) {
    return this.batchesService.findOne(id);
  }

  @Post()
  @RequirePermissions('enrollments.create')
  create(@Body() dto: CreateBatchDto) {
    return this.batchesService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('enrollments.create')
  update(@Param('id') id: string, @Body() dto: UpdateBatchDto) {
    return this.batchesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('enrollments.revoke')
  remove(@Param('id') id: string) {
    return this.batchesService.remove(id);
  }
}
