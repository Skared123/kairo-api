import { Policy } from '@nestjs/authorization';
import type { AuthUser } from '../auth/auth-user.js';

/**
 * Who may manage accounts. Admins manage accounts only: no other policy gives them a bypass, so they can never read
 * another user's data (CLAUDE.md, hard rules).
 */
@Policy()
export class AccountPolicy {
  /** List, create, change and reset accounts. `null` is a guest. */
  manage(user: AuthUser | null): boolean {
    return user?.role === 'admin';
  }
}
