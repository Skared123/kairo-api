import { AuthenticationRegistry, SessionCookieProvider, type SessionRecord } from '@nestjs/authentication';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, type Repository } from 'typeorm';
import { hasExpiredTemporaryPassword } from '../users/temporary-password.js';
import { User } from '../users/user.entity.js';
import { toAuthUser, type AuthUser } from './auth-user.js';

/** Signs requests in from the session cookie (decision 008). */
@Injectable()
export class SessionAuth extends SessionCookieProvider<AuthUser> {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    registry: AuthenticationRegistry,
  ) {
    super();
    // Adds this provider to the chain the global guard runs on every request.
    registry.registerProvider(this);
  }

  /**
   * Runs on every request with a live session. Null for a deleted or deactivated account, or one whose temporary
   * password expired (decision 026), which ends the session, so losing access takes effect on the next request.
   */
  async validate(session: SessionRecord): Promise<AuthUser | null> {
    const user = await this.users.findOneBy({ id: session.userId, deactivatedAt: IsNull() });
    return user && !hasExpiredTemporaryPassword(user) ? toAuthUser(user) : null;
  }
}
