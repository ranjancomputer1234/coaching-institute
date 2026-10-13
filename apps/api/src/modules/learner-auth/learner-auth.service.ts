import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { LearnerAccountState } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  LearnerLoginDto,
  LearnerRegisterDto,
  LearnerUpdateMeDto,
} from './dto/learner-auth.dto';

@Injectable()
export class LearnerAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  private async signLearnerToken(learnerId: string, email?: string | null) {
    const secret: string = this.config.get<string>(
      'LEARNER_JWT_SECRET',
      this.config.get<string>('JWT_SECRET', 'dev-change-me'),
    );
    const expiresIn = this.config.get<string>(
      'LEARNER_JWT_EXPIRES_IN',
      '30d',
    ) as JwtSignOptions['expiresIn'];
    return this.jwtService.signAsync(
      { sub: learnerId, email: email ?? undefined, typ: 'learner' },
      { secret, expiresIn },
    );
  }

  private toProfile(learner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    city: string | null;
    accountState: LearnerAccountState;
    verifiedEmail: boolean;
    verifiedPhone: boolean;
    appVersion: string | null;
    batchId: string | null;
  }) {
    return {
      id: learner.id,
      firstName: learner.firstName,
      lastName: learner.lastName,
      email: learner.email,
      phone: learner.phone,
      city: learner.city,
      accountState: learner.accountState,
      verifiedEmail: learner.verifiedEmail,
      verifiedPhone: learner.verifiedPhone,
      appVersion: learner.appVersion,
      batchId: learner.batchId,
    };
  }

  async register(dto: LearnerRegisterDto) {
    const existing = await this.prisma.learner.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new BadRequestException({
        code: 'EMAIL_IN_USE',
        message: 'An account with this email already exists',
        fieldErrors: { email: 'taken' },
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const learner = await this.prisma.learner.create({
      data: {
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email: dto.email.toLowerCase(),
        phone: dto.phone,
        phoneNormalized: dto.phone?.replace(/\D/g, '') || undefined,
        city: dto.city,
        accountState: LearnerAccountState.active,
        verifiedEmail: true,
        source: 'self_register',
        credential: { create: { passwordHash } },
      },
    });

    return {
      accessToken: await this.signLearnerToken(learner.id, learner.email),
      learner: this.toProfile(learner),
    };
  }

  async login(dto: LearnerLoginDto) {
    const learner = await this.prisma.learner.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { credential: true },
    });
    if (!learner?.credential) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid email or password',
        fieldErrors: {},
      });
    }
    if (
      learner.accountState === LearnerAccountState.suspended ||
      learner.accountState === LearnerAccountState.blocked ||
      learner.accountState === LearnerAccountState.deleted
    ) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Account is not allowed to sign in',
        fieldErrors: {},
      });
    }

    const valid = await bcrypt.compare(
      dto.password,
      learner.credential.passwordHash,
    );
    if (!valid) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid email or password',
        fieldErrors: {},
      });
    }

    await this.prisma.learner.update({
      where: { id: learner.id },
      data: { lastActiveAt: new Date() },
    });

    return {
      accessToken: await this.signLearnerToken(learner.id, learner.email),
      learner: this.toProfile(learner),
    };
  }

  async me(learnerId: string) {
    const learner = await this.prisma.learner.findUniqueOrThrow({
      where: { id: learnerId },
    });
    return this.toProfile(learner);
  }

  async updateMe(learnerId: string, dto: LearnerUpdateMeDto) {
    const learner = await this.prisma.learner.update({
      where: { id: learnerId },
      data: {
        firstName: dto.firstName?.trim(),
        lastName: dto.lastName?.trim(),
        phone: dto.phone,
        phoneNormalized: dto.phone?.replace(/\D/g, '') || undefined,
        city: dto.city,
        appVersion: dto.appVersion,
        lastActiveAt: new Date(),
      },
    });
    return this.toProfile(learner);
  }

  logout(learnerId: string) {
    return { ok: true, learnerId };
  }
}
