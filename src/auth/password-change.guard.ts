import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from './auth-user.js';

/** Marks a route that stays reachable while the signed-in user has to change their password (decision 016). */
export const AllowPendingPasswordChange = Reflector.createDecorator<true>({ transform: () => true });

/**
 * While the signed-in user's mustChangePassword flag is on, refuses every route not marked
 * @AllowPendingPasswordChange() with a 403. Registered globally after the authentication guard, which sets
 * request.user (AuthenticationContext is empty in guards). Public routes and guests have no user and pass through.
 */
@Injectable()
export class PasswordChangeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<{ user?: AuthUser | null }>().user;
    if (!user?.mustChangePassword) {
      return true;
    }

    const allowed = this.reflector.getAllAndOverride(AllowPendingPasswordChange, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed) {
      return true;
    }
    // `error` is the code the web app reads to show the change-password screen.
    throw new ForbiddenException({
      statusCode: 403,
      error: 'password_change_required',
      message: 'Change your password to continue',
    });
  }
}
