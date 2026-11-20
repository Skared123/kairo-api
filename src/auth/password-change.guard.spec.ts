import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from './auth-user.js';
import { AllowPendingPasswordChange, PasswordChangeGuard } from './password-change.guard.js';

// Handlers are passed around as plain functions, as Nest does with getHandler(); they never use `this`.
class Routes {
  @AllowPendingPasswordChange()
  allowed(this: void) {}

  blocked(this: void) {}
}

@AllowPendingPasswordChange()
class AllowedRoutes {
  any(this: void) {}
}

const user = (mustChangePassword: boolean): AuthUser => ({
  id: '0b8c4b5e-5d0e-4c43-9a4a-3f1f3c1d2e10',
  email: 'grace@example.com',
  name: 'Grace Hopper',
  role: 'user',
  mustChangePassword,
});

function contextFor(
  requestUser: AuthUser | null | undefined,
  handler: () => void,
  controller: new () => object,
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user: requestUser }) }),
    getHandler: () => handler,
    getClass: () => controller,
  } as unknown as ExecutionContext;
}

describe('PasswordChangeGuard', () => {
  const guard = new PasswordChangeGuard(new Reflector());

  it('lets guests and public routes through', () => {
    expect(guard.canActivate(contextFor(undefined, Routes.prototype.blocked, Routes))).toBe(true);
    expect(guard.canActivate(contextFor(null, Routes.prototype.blocked, Routes))).toBe(true);
  });

  it('lets a user without a pending change through', () => {
    expect(guard.canActivate(contextFor(user(false), Routes.prototype.blocked, Routes))).toBe(true);
  });

  it('refuses a pending change on an unmarked route, with a code the web app can read', () => {
    const run = () => guard.canActivate(contextFor(user(true), Routes.prototype.blocked, Routes));

    expect(run).toThrow(ForbiddenException);
    try {
      run();
    } catch (error) {
      expect((error as ForbiddenException).getResponse()).toMatchObject({ error: 'password_change_required' });
    }
  });

  it('allows a pending change on routes marked on the handler or the controller', () => {
    expect(guard.canActivate(contextFor(user(true), Routes.prototype.allowed, Routes))).toBe(true);
    expect(guard.canActivate(contextFor(user(true), AllowedRoutes.prototype.any, AllowedRoutes))).toBe(true);
  });
});
