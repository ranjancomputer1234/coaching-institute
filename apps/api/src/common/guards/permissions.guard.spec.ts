import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

function context(permissions?: string[]): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({ user: permissions ? { permissions } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const guard = new PermissionsGuard(reflector as unknown as Reflector);

  beforeEach(() => {
    reflector.getAllAndOverride.mockReset();
  });

  it('allows routes that do not require a permission', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(context())).toBe(true);
  });

  it('allows a user who has every required permission', () => {
    reflector.getAllAndOverride.mockReturnValue([
      'learners.read',
      'learners.write',
    ]);
    expect(
      guard.canActivate(
        context(['learners.read', 'learners.write', 'audit.read']),
      ),
    ).toBe(true);
  });

  it('rejects a user missing a required permission', () => {
    reflector.getAllAndOverride.mockReturnValue(['settings.manage']);
    expect(() => guard.canActivate(context(['learners.read']))).toThrow(
      ForbiddenException,
    );
  });
});
