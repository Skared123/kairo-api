import { removesLastActiveAdmin } from './accounts.service.js';
import { generateTemporaryPassword } from './temporary-password.js';

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
