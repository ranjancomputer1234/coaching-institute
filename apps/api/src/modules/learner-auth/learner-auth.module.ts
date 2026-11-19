import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { OptionalLearnerJwtAuthGuard } from '../../common/guards/optional-learner-jwt-auth.guard';
import { LearnerAuthService } from './learner-auth.service';
import { LearnerAuthController } from './learner-auth.controller';
import { LearnerJwtStrategy } from './learner-jwt.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [LearnerAuthController],
  providers: [
    LearnerAuthService,
    LearnerJwtStrategy,
    OptionalLearnerJwtAuthGuard,
  ],
  exports: [LearnerAuthService],
})
export class LearnerAuthModule {}
