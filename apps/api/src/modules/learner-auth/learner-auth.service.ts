import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { LearnerAccountState } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../email/email.service';
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

const OTP_TTL_MINUTES = 10;
const PURPOSE_VERIFY = 'email_verify';
const PURPOSE_RESET = 'password_reset';

@Injectable()
export class LearnerAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
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

  private learnerJwtSecret() {
    return this.config.get<string>(
      'LEARNER_JWT_SECRET',
      this.config.get<string>('JWT_SECRET', 'dev-change-me'),
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

  private generateOtp(): string {
    return String(crypto.randomInt(100000, 999999));
  }

  private hashOtp(code: string) {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  private async createChallenge(opts: {
    purpose: string;
    email: string;
    learnerId?: string;
  }) {
    const code = this.generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);
    const challenge = await this.prisma.authChallenge.create({
      data: {
        purpose: opts.purpose,
        email: opts.email.toLowerCase(),
        learnerId: opts.learnerId,
        codeHash: this.hashOtp(code),
        expiresAt,
      },
    });
    return { challenge, code, expiresMinutes: OTP_TTL_MINUTES };
  }

  private async assertChallenge(challengeId: string, purpose: string, code: string) {
    const challenge = await this.prisma.authChallenge.findUnique({
      where: { id: challengeId },
    });
    if (!challenge || challenge.purpose !== purpose) {
      throw new BadRequestException({
        code: 'CHALLENGE_INVALID',
        message: 'Invalid or unknown challenge',
        fieldErrors: {},
      });
    }
    if (challenge.consumedAt) {
      throw new BadRequestException({
        code: 'CHALLENGE_USED',
        message: 'This code was already used',
        fieldErrors: {},
      });
    }
    if (challenge.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException({
        code: 'CHALLENGE_EXPIRED',
        message: 'This code has expired',
        fieldErrors: {},
      });
    }
    if (challenge.attempts >= challenge.maxAttempts) {
      throw new BadRequestException({
        code: 'CHALLENGE_LOCKED',
        message: 'Too many attempts. Request a new code.',
        fieldErrors: {},
      });
    }

    const ok = challenge.codeHash === this.hashOtp(code.trim());
    await this.prisma.authChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    if (!ok) {
      throw new BadRequestException({
        code: 'CHALLENGE_CODE_INVALID',
        message: 'Incorrect verification code',
        fieldErrors: { code: 'invalid' },
      });
    }
    return challenge;
  }

  async register(dto: LearnerRegisterDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.learner.findUnique({
      where: { email },
    });
    if (existing) {
      throw new BadRequestException({
        code: 'EMAIL_IN_USE',
        message: 'An account with this email already exists',
        fieldErrors: { email: 'taken' },
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const requireVerify =
      (this.config.get<string>('EMAIL_REQUIRE_VERIFY') ?? 'true') !== 'false';

    const learner = await this.prisma.learner.create({
      data: {
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email,
        phone: dto.phone,
        phoneNormalized: dto.phone?.replace(/\D/g, '') || undefined,
        city: dto.city,
        accountState: requireVerify
          ? LearnerAccountState.pending_verification
          : LearnerAccountState.active,
        verifiedEmail: !requireVerify,
        source: 'self_register',
        credential: { create: { passwordHash } },
      },
    });

    if (!requireVerify) {
      return {
        accessToken: await this.signLearnerToken(learner.id, learner.email),
        learner: this.toProfile(learner),
        challengeId: null as string | null,
        verificationRequired: false,
      };
    }

    const { challenge, code, expiresMinutes } = await this.createChallenge({
      purpose: PURPOSE_VERIFY,
      email,
      learnerId: learner.id,
    });
    await this.email.enqueueVerify({
      toEmail: email,
      toName: `${learner.firstName} ${learner.lastName}`.trim(),
      learnerId: learner.id,
      firstName: learner.firstName,
      otp: code,
      expiresMinutes,
    });

    return {
      accessToken: null as string | null,
      learner: this.toProfile(learner),
      challengeId: challenge.id,
      verificationRequired: true,
      message: 'Check your email for a verification code',
      ...this.debugOtpPayload(code),
    };
  }

  /** Local/console only — never expose OTP in production. */
  private debugOtpPayload(code: string) {
    const env = (this.config.get<string>('APP_ENV') || 'local').toLowerCase();
    if (env === 'production') return {};
    if (this.email.providerName() !== 'console') return {};
    return { debugOtp: code };
  }

  async verifyChallenge(challengeId: string, dto: VerifyChallengeDto) {
    const challenge = await this.assertChallenge(
      challengeId,
      PURPOSE_VERIFY,
      dto.code,
    );
    if (!challenge.learnerId) {
      throw new BadRequestException({
        code: 'CHALLENGE_INVALID',
        message: 'Challenge is not linked to a learner',
        fieldErrors: {},
      });
    }

    await this.prisma.authChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    const learner = await this.prisma.learner.update({
      where: { id: challenge.learnerId },
      data: {
        verifiedEmail: true,
        accountState: LearnerAccountState.active,
        lastActiveAt: new Date(),
      },
    });

    return {
      accessToken: await this.signLearnerToken(learner.id, learner.email),
      learner: this.toProfile(learner),
    };
  }

  async resendVerification(
    dto: ResendVerificationDto,
    authedLearnerId?: string,
  ) {
    let learner =
      authedLearnerId
        ? await this.prisma.learner.findUnique({ where: { id: authedLearnerId } })
        : null;

    if (!learner && dto.email) {
      learner = await this.prisma.learner.findUnique({
        where: { email: dto.email.toLowerCase() },
      });
    }

    // Always return a generic shape to avoid email enumeration.
    const generic = {
      ok: true,
      message: 'If an unverified account exists, a new code was sent',
      challengeId: null as string | null,
    };

    if (!learner?.email || learner.verifiedEmail) {
      return generic;
    }

    const { challenge, code, expiresMinutes } = await this.createChallenge({
      purpose: PURPOSE_VERIFY,
      email: learner.email,
      learnerId: learner.id,
    });
    await this.email.enqueueVerify({
      toEmail: learner.email,
      toName: `${learner.firstName} ${learner.lastName}`.trim(),
      learnerId: learner.id,
      firstName: learner.firstName,
      otp: code,
      expiresMinutes,
    });

    return {
      ok: true,
      message: 'Verification code sent',
      challengeId: challenge.id,
      ...this.debugOtpPayload(code),
    };
  }

  /** Admin-triggered resend — returns real challengeId for support tooling. */
  async adminResendVerification(learnerId: string) {
    const learner = await this.prisma.learner.findUniqueOrThrow({
      where: { id: learnerId },
    });
    if (!learner.email) {
      throw new BadRequestException({
        code: 'EMAIL_REQUIRED',
        message: 'Learner has no email address',
        fieldErrors: { email: 'required' },
      });
    }
    if (learner.verifiedEmail) {
      throw new BadRequestException({
        code: 'ALREADY_VERIFIED',
        message: 'Learner email is already verified',
        fieldErrors: {},
      });
    }

    const { challenge, code, expiresMinutes } = await this.createChallenge({
      purpose: PURPOSE_VERIFY,
      email: learner.email,
      learnerId: learner.id,
    });
    await this.email.enqueueVerify({
      toEmail: learner.email,
      toName: `${learner.firstName} ${learner.lastName}`.trim(),
      learnerId: learner.id,
      firstName: learner.firstName,
      otp: code,
      expiresMinutes,
    });

    return {
      ok: true,
      challengeId: challenge.id,
      email: learner.email,
      queued: true,
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

    const requireVerify =
      (this.config.get<string>('EMAIL_REQUIRE_VERIFY') ?? 'true') !== 'false';
    if (
      requireVerify &&
      !learner.verifiedEmail &&
      learner.accountState === LearnerAccountState.pending_verification
    ) {
      const { challenge, code, expiresMinutes } = await this.createChallenge({
        purpose: PURPOSE_VERIFY,
        email: learner.email!,
        learnerId: learner.id,
      });
      await this.email.enqueueVerify({
        toEmail: learner.email!,
        toName: `${learner.firstName} ${learner.lastName}`.trim(),
        learnerId: learner.id,
        firstName: learner.firstName,
        otp: code,
        expiresMinutes,
      });
      throw new UnauthorizedException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Verify your email before signing in',
        fieldErrors: {},
        challengeId: challenge.id,
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

  async passwordForgot(dto: PasswordForgotDto) {
    const email = dto.email.toLowerCase();
    const learner = await this.prisma.learner.findUnique({
      where: { email },
      include: { credential: true },
    });

    const generic = {
      ok: true,
      message: 'If an account exists, a reset code was sent',
      challengeId: null as string | null,
    };

    if (!learner?.credential) {
      return generic;
    }

    const { challenge, code, expiresMinutes } = await this.createChallenge({
      purpose: PURPOSE_RESET,
      email,
      learnerId: learner.id,
    });
    await this.email.enqueuePasswordReset({
      toEmail: email,
      toName: `${learner.firstName} ${learner.lastName}`.trim(),
      learnerId: learner.id,
      firstName: learner.firstName,
      otp: code,
      expiresMinutes,
    });

    return {
      ok: true,
      message: 'If an account exists, a reset code was sent',
      // Return challengeId so the mobile app can proceed without polling.
      // Still safe: knowing the id alone cannot reset without the OTP.
      challengeId: challenge.id,
      ...this.debugOtpPayload(code),
    };
  }

  async passwordVerify(dto: PasswordVerifyDto) {
    const challenge = await this.assertChallenge(
      dto.challengeId,
      PURPOSE_RESET,
      dto.code,
    );
    await this.prisma.authChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    const resetToken = await this.jwtService.signAsync(
      {
        sub: challenge.learnerId,
        email: challenge.email,
        typ: 'password_reset',
        cid: challenge.id,
      },
      {
        secret: this.learnerJwtSecret(),
        expiresIn: '15m',
      },
    );

    return { resetToken, expiresIn: 900 };
  }

  async passwordReset(dto: PasswordResetDto) {
    let payload: {
      sub?: string;
      email?: string;
      typ?: string;
      cid?: string;
    };
    try {
      payload = await this.jwtService.verifyAsync(dto.resetToken, {
        secret: this.learnerJwtSecret(),
      });
    } catch {
      throw new BadRequestException({
        code: 'RESET_TOKEN_INVALID',
        message: 'Reset token is invalid or expired',
        fieldErrors: {},
      });
    }
    if (payload.typ !== 'password_reset' || !payload.sub) {
      throw new BadRequestException({
        code: 'RESET_TOKEN_INVALID',
        message: 'Reset token is invalid',
        fieldErrors: {},
      });
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.learnerCredential.upsert({
      where: { learnerId: payload.sub },
      create: { learnerId: payload.sub, passwordHash },
      update: { passwordHash },
    });

    // Activate if they verified via reset on a pending account.
    await this.prisma.learner.update({
      where: { id: payload.sub },
      data: {
        verifiedEmail: true,
        accountState: LearnerAccountState.active,
      },
    });

    const learner = await this.prisma.learner.findUniqueOrThrow({
      where: { id: payload.sub },
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
