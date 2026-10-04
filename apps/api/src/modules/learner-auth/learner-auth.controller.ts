import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { LearnerAuthService } from './learner-auth.service';
import {
  LearnerLoginDto,
  LearnerRegisterDto,
  LearnerUpdateMeDto,
} from './dto/learner-auth.dto';
import { LearnerJwtAuthGuard } from '../../common/guards/learner-jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
export class LearnerAuthController {
  constructor(private readonly learnerAuth: LearnerAuthService) {}

  @Post('auth/register')
  register(@Body() dto: LearnerRegisterDto) {
    return this.learnerAuth.register(dto);
  }

  @Post('auth/login')
  login(@Body() dto: LearnerLoginDto) {
    return this.learnerAuth.login(dto);
  }

  @Post('auth/logout')
  logout() {
    return { ok: true };
  }

  @UseGuards(LearnerJwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: { learnerId: string }) {
    return this.learnerAuth.me(user.learnerId);
  }

  @UseGuards(LearnerJwtAuthGuard)
  @Patch('me')
  updateMe(
    @CurrentUser() user: { learnerId: string },
    @Body() dto: LearnerUpdateMeDto,
  ) {
    return this.learnerAuth.updateMe(user.learnerId, dto);
  }
}
