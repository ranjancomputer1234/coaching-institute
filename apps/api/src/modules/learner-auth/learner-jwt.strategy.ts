import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { LearnerAccountState } from '@prisma/client';

type LearnerJwtPayload = {
  sub: string;
  email?: string;
  typ?: string;
};

@Injectable()
export class LearnerJwtStrategy extends PassportStrategy(
  Strategy,
  'learner-jwt',
) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>(
        'LEARNER_JWT_SECRET',
        config.get<string>('JWT_SECRET', 'dev-change-me')!,
      ),
    });
  }

  async validate(payload: LearnerJwtPayload) {
    if (payload.typ !== 'learner') {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid learner token',
        fieldErrors: {},
      });
    }
    const learner = await this.prisma.learner.findUnique({
      where: { id: payload.sub },
    });
    if (
      !learner ||
      learner.accountState === LearnerAccountState.suspended ||
      learner.accountState === LearnerAccountState.blocked ||
      learner.accountState === LearnerAccountState.deleted
    ) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Learner account unavailable',
        fieldErrors: {},
      });
    }
    return {
      learnerId: learner.id,
      email: learner.email,
      typ: 'learner' as const,
    };
  }
}
