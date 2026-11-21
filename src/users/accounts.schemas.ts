import { z } from 'zod';
import { email } from '../auth/auth.schemas.js';
import { USER_ROLES, type User } from './user.entity.js';

/** An account as the admin sees it: who it is and its status, never anything the user keeps in the app. */
export const accountSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
  role: z.enum(USER_ROLES),
  active: z.boolean(),
  /** Still using the temporary password the admin handed out. */
  mustChangePassword: z.boolean(),
  createdAt: z.iso.datetime(),
  deactivatedAt: z.iso.datetime().nullable(),
});
export type Account = z.infer<typeof accountSchema>;

export function toAccount(user: User): Account {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    active: user.deactivatedAt === null,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt.toISOString(),
    deactivatedAt: user.deactivatedAt?.toISOString() ?? null,
  };
}

export const createAccountSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  email,
  role: z.enum(USER_ROLES).default('user'),
});
export type CreateAccountDto = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = z
  .strictObject({
    role: z.enum(USER_ROLES).optional(),
    /** `false` deactivates the account and ends its sessions; `true` reactivates it. */
    active: z.boolean().optional(),
  })
  .refine((changes) => changes.role !== undefined || changes.active !== undefined, {
    message: 'send role, active or both',
  });
export type UpdateAccountDto = z.infer<typeof updateAccountSchema>;

/** Shown once: only its hash is stored (decision 017). */
export const temporaryPasswordSchema = z.object({ temporaryPassword: z.string() });
export type TemporaryPassword = z.infer<typeof temporaryPasswordSchema>;

export const createdAccountSchema = z.object({ account: accountSchema, temporaryPassword: z.string() });
export type CreatedAccount = z.infer<typeof createdAccountSchema>;
