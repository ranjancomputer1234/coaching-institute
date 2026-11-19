import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { LearnerAuthService } from './learner-auth.service';
import {
  LearnerLoginDto,
  LearnerRegisterDto,
  LearnerUpdateMeDto,
  PasswordForgotDto,
  PasswordResetDto,
  PasswordVerifyDto,
  ResendVerificationDto,
  VerifyChallengeDto,
} from './dto/learner-auth.dto';
import { LearnerJwtAuthGuard } from '../../common/guards/learner-jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OptionalLearnerJwtAuthGuard } from '../../common/guards/optional-learner-jwt-auth.guard';

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

  @Post('auth/challenges/:id/verify')
  verifyChallenge(
    @Param('id') id: string,
    @Body() dto: VerifyChallengeDto,
  ) {
    return this.learnerAuth.verifyChallenge(id, dto);
  }

  @UseGuards(OptionalLearnerJwtAuthGuard)
  @Post('auth/email/resend')
  resendVerification(
    @Body() dto: ResendVerificationDto,
    @CurrentUser() user?: { learnerId?: string },
  ) {
    return this.learnerAuth.resendVerification(dto, user?.learnerId);
  }

  @Post('auth/password/forgot')
  passwordForgot(@Body() dto: PasswordForgotDto) {
    return this.learnerAuth.passwordForgot(dto);
  }

  @Post('auth/password/verify')
  passwordVerify(@Body() dto: PasswordVerifyDto) {
    return this.learnerAuth.passwordVerify(dto);
  }

  @Post('auth/password/reset')
  passwordReset(@Body() dto: PasswordResetDto) {
    return this.learnerAuth.passwordReset(dto);
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
