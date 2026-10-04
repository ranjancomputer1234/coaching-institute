import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { AuditService } from '../audit/audit.service';
import { AuditSeverity } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.isActive) {
      await this.audit.write({
        action: 'admin.login_failed',
        resourceType: 'AdminUser',
        after: { email: dto.email },
        outcome: 'failure',
        severity: AuditSeverity.warning,
        reason: 'Invalid credentials or inactive',
      });
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid email or password',
        fieldErrors: {},
      });
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      await this.audit.write({
        actorDisplay: user.email,
        action: 'admin.login_failed',
        resourceType: 'AdminUser',
        resourceId: user.id,
        outcome: 'failure',
        severity: AuditSeverity.warning,
      });
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid email or password',
        fieldErrors: {},
      });
    }

    const authUser = this.usersService.toAuthUser(user);
    const payload = {
      sub: user.id,
      email: user.email,
      roles: authUser.roles,
      permissions: authUser.permissions,
    };

    await this.audit.write({
      actorId: user.id,
      actorDisplay: user.name,
      action: 'admin.login',
      resourceType: 'AdminUser',
      resourceId: user.id,
      severity: AuditSeverity.info,
    });

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: authUser,
    };
  }
}
