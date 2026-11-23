import { randomInt } from 'node:crypto';
import type { User } from './user.entity.js';

// Lowercase letters and digits without look-alikes (0/o, 1/l/i), so the password can be read out or copied by hand.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/**
 * A temporary password for an account the admin creates or resets (decision 017), such as `k7m2-q9xd-4pzt`:
 * 12 characters from a 31-letter alphabet, about 59 bits, from the crypto random generator.
 */
export function generateTemporaryPassword(): string {
  const groups = Array.from({ length: 3 }, () =>
    Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(''),
  );
  return groups.join('-');
}

/** How long a temporary password works after the admin creates or resets the account (decision 026). */
export const TEMPORARY_PASSWORD_TTL_MS = 72 * 60 * 60 * 1000;

/** When a temporary password handed out now stops working. */
export function temporaryPasswordExpiry(now = new Date()): Date {
  return new Date(now.getTime() + TEMPORARY_PASSWORD_TTL_MS);
}

/** Whether the account still uses a temporary password that has stopped working (decision 026). */
export function hasExpiredTemporaryPassword(
  user: Pick<User, 'mustChangePassword' | 'temporaryPasswordExpiresAt'>,
  now = new Date(),
): boolean {
  return user.mustChangePassword && user.temporaryPasswordExpiresAt !== null && user.temporaryPasswordExpiresAt <= now;
}
