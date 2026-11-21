import { randomInt } from 'node:crypto';

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
