import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LearnerCatalogueService } from './learner-catalogue.service';
import { LessonProgressDto } from './dto/learning.dto';
import { LearnerJwtAuthGuard } from '../../common/guards/learner-jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
export class LearnerCatalogueController {
  constructor(private readonly catalogue: LearnerCatalogueService) {}

  @Get('home')
  home() {
    return this.catalogue.home();
  }

  @UseGuards(LearnerJwtAuthGuard)
  @Get('home/me')
  homeMe(@CurrentUser() user: { learnerId: string }) {
    return this.catalogue.home(user.learnerId);
  }

  @Get('categories')
  categories() {
    return this.catalogue.categories();
  }

  @Get('search')
  search(@Query('q') q = '') {
    return this.catalogue.search(q);
  }

  @Get('courses/:id')
  getCourse(@Param('id') id: string) {
    return this.catalogue.getCourse(id);
  }

  @UseGuards(LearnerJwtAuthGuard)
  @Get('courses/:id/access')
  getCourseAccess(
    @Param('id') id: string,
    @CurrentUser() user: { learnerId: string },
  ) {
    return this.catalogue.getCourse(id, user.learnerId);
  }

  @UseGuards(LearnerJwtAuthGuard)
  @Post('courses/:id/enroll')
  enroll(
    @Param('id') id: string,
    @CurrentUser() user: { learnerId: string },
  ) {
    return this.catalogue.enroll(id, user.learnerId);
  }

  @Get('courses/:id/lessons')
  getLessons(@Param('id') id: string) {
    return this.catalogue.getLessons(id);
  }

  @Get('lessons/:id')
  getLesson(@Param('id') id: string) {
    return this.catalogue.getLesson(id);
  }

  @UseGuards(LearnerJwtAuthGuard)
  @Post('lessons/:id/progress')
  progress(
    @Param('id') id: string,
    @Body() dto: LessonProgressDto,
    @CurrentUser() user: { learnerId: string },
  ) {
    return this.catalogue.saveProgress(id, user.learnerId, dto);
  }

  @UseGuards(LearnerJwtAuthGuard)
  @Post('lessons/:id/complete')
  complete(
    @Param('id') id: string,
    @CurrentUser() user: { learnerId: string },
  ) {
    return this.catalogue.completeLesson(id, user.learnerId);
  }

  @UseGuards(LearnerJwtAuthGuard)
  @Get('me/enrollments')
  enrollments(@CurrentUser() user: { learnerId: string }) {
    return this.catalogue.myEnrollments(user.learnerId);
  }

  @UseGuards(LearnerJwtAuthGuard)
  @Get('me/entitlements')
  entitlements(@CurrentUser() user: { learnerId: string }) {
    return this.catalogue.myEntitlements(user.learnerId);
  }
}
