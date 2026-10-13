jest.mock('@nestjs/jwt', () => ({
  JwtService: class JwtService {},
}));

import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

const user = {
  id: 'admin-1',
  email: 'admin@institute.local',
  name: 'REDI Super Admin',
  passwordHash: 'hash',
  isActive: true,
};

describe('AuthService', () => {
  const users = {
    findByEmail: jest.fn(),
    toAuthUser: jest.fn(),
  };
  const jwt = { signAsync: jest.fn() };
  const audit = { write: jest.fn() };
  const service = new AuthService(
    users as unknown as UsersService,
    jwt as unknown as JwtService,
    audit as unknown as AuditService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects an unknown email', async () => {
    users.findByEmail.mockResolvedValue(null);

    await expect(
      service.login({ email: 'missing@institute.local', password: 'admin123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin.login_failed',
        outcome: 'failure',
      }),
    );
  });

  it('rejects a wrong password', async () => {
    users.findByEmail.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({ email: user.email, password: 'nope123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns a token for a valid password', async () => {
    users.findByEmail.mockResolvedValue(user);
    users.toAuthUser.mockReturnValue({
      id: user.id,
      email: user.email,
      name: user.name,
      roles: ['super_admin'],
      permissions: ['settings.manage'],
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    jwt.signAsync.mockResolvedValue('signed-token');

    await expect(
      service.login({ email: user.email, password: 'admin123' }),
    ).resolves.toMatchObject({
      accessToken: 'signed-token',
      user: { email: user.email, roles: ['super_admin'] },
    });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.login' }),
    );
  });
});
