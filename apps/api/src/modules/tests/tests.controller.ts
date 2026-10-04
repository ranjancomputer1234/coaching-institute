import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TestsService } from './tests.service';
import {
  CreateTestDto,
  SetTestQuestionsDto,
  UpdateTestDto,
} from './dto/test.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/tests')
export class TestsController {
  constructor(private readonly testsService: TestsService) {}

  @Get()
  @RequirePermissions('assessments.author')
  findAll() {
    return this.testsService.findAll();
  }

  @Get(':id')
  @RequirePermissions('assessments.author')
  findOne(@Param('id') id: string) {
    return this.testsService.findOne(id);
  }

  @Post()
  @RequirePermissions('assessments.author')
  create(
    @Body() dto: CreateTestDto,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.testsService.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions('assessments.author')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTestDto,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.testsService.update(id, dto, user);
  }

  @Post(':id/questions')
  @RequirePermissions('assessments.author')
  setQuestions(
    @Param('id') id: string,
    @Body() dto: SetTestQuestionsDto,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.testsService.setQuestions(id, dto, user);
  }

  @Post(':id/publish')
  @RequirePermissions('assessments.publish')
  publish(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.testsService.publish(id, user);
  }
}
