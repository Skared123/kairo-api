import { removesLastActiveAdmin } from './accounts.service.js';
import {
  generateTemporaryPassword,
  hasExpiredTemporaryPassword,
  TEMPORARY_PASSWORD_TTL_MS,
  temporaryPasswordExpiry,
} from './temporary-password.js';

describe('removesLastActiveAdmin', () => {
  const activeAdmin = { role: 'admin' as const, deactivatedAt: null };

  it('refuses to demote or deactivate the only active admin', () => {
    expect(removesLastActiveAdmin(activeAdmin, { role: 'user' }, 0)).toBe(true);
    expect(removesLastActiveAdmin(activeAdmin, { active: false }, 0)).toBe(true);
    expect(removesLastActiveAdmin(activeAdmin, { role: 'user', active: true }, 0)).toBe(true);
  });

  it('allows it while another active admin remains', () => {
    expect(removesLastActiveAdmin(activeAdmin, { role: 'user' }, 1)).toBe(false);
    expect(removesLastActiveAdmin(activeAdmin, { active: false }, 1)).toBe(false);
  });

  it('allows changes that keep the admin active', () => {
    expect(removesLastActiveAdmin(activeAdmin, { role: 'admin' }, 0)).toBe(false);
    expect(removesLastActiveAdmin(activeAdmin, { active: true }, 0)).toBe(false);
  });

  it('ignores accounts that are not active admins', () => {
    expect(removesLastActiveAdmin({ role: 'user', deactivatedAt: null }, { active: false }, 0)).toBe(false);
    expect(removesLastActiveAdmin({ role: 'admin', deactivatedAt: new Date() }, { role: 'user' }, 0)).toBe(false);
  });
});

describe('generateTemporaryPassword', () => {
  it('makes three groups of four characters without look-alikes', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateTemporaryPassword()).toMatch(/^[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}$/);
    }
  });

  it('does not repeat', () => {
    const passwords = new Set(Array.from({ length: 1000 }, generateTemporaryPassword));
    expect(passwords.size).toBe(1000);
  });
});

describe('temporary password expiry (decision 026)', () => {
  const now = new Date('2026-11-23T12:00:00Z');
  const pending = (expiresAt: string | null) => ({
    mustChangePassword: true,
    temporaryPasswordExpiresAt: expiresAt ? new Date(expiresAt) : null,
  });

  it('expires 72 hours after it is handed out', () => {
    expect(TEMPORARY_PASSWORD_TTL_MS).toBe(72 * 60 * 60 * 1000);
    expect(temporaryPasswordExpiry(now).toISOString()).toBe('2026-11-26T12:00:00.000Z');
  });

  it('counts as expired from its expiry on', () => {
    expect(hasExpiredTemporaryPassword(pending('2026-11-23T11:59:59Z'), now)).toBe(true);
    expect(hasExpiredTemporaryPassword(pending('2026-11-23T12:00:00Z'), now)).toBe(true);
    expect(hasExpiredTemporaryPassword(pending('2026-11-23T12:00:01Z'), now)).toBe(false);
  });

  it('only matters while the change is pending', () => {
    expect(hasExpiredTemporaryPassword({ ...pending('2026-01-01T00:00:00Z'), mustChangePassword: false }, now)).toBe(
      false,
    );
    expect(hasExpiredTemporaryPassword(pending(null), now)).toBe(false);
  });
});
