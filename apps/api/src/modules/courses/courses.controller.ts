import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import {
  CreateCourseDto,
  CreateLessonDto,
  UpdateCourseDto,
} from './dto/course.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

type Actor = { userId: string; email?: string };

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @RequirePermissions('content.edit')
  findAll() {
    return this.coursesService.findAll();
  }

  @Get(':id')
  @RequirePermissions('content.edit')
  findOne(@Param('id') id: string) {
    return this.coursesService.findOne(id);
  }

  @Post()
  @RequirePermissions('content.create')
  create(@Body() dto: CreateCourseDto, @CurrentUser() user: Actor) {
    return this.coursesService.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions('content.edit')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
    @CurrentUser() user: Actor,
  ) {
    return this.coursesService.update(id, dto, user);
  }

  @Post(':id/publish')
  @RequirePermissions('content.publish')
  publish(@Param('id') id: string, @CurrentUser() user: Actor) {
    return this.coursesService.publish(id, user);
  }

  @Post(':id/unpublish')
  @RequirePermissions('content.publish')
  unpublish(@Param('id') id: string, @CurrentUser() user: Actor) {
    return this.coursesService.unpublish(id, user);
  }

  @Post(':id/lessons')
  @RequirePermissions('content.edit')
  addLesson(
    @Param('id') id: string,
    @Body() dto: CreateLessonDto,
    @CurrentUser() user: Actor,
  ) {
    return this.coursesService.addLesson(id, dto, user);
  }
}
