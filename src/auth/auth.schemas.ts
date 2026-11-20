import { z } from 'zod';

/**
 * Emails are trimmed and lowercased before they are validated, so `Ray@Example.com ` and `ray@example.com` are the
 * same account (the users table refuses anything else). The metadata keeps the email format in the OpenAPI spec.
 */
const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email())
  .meta({ format: 'email', example: 'ada@example.com' });

/** New passwords: any non-empty password up to 128 characters, no composition rules (decision 015). */
export const newPassword = z.string().min(1).max(128);

export const setupSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  email,
  password: newPassword,
});
export type SetupDto = z.infer<typeof setupSchema>;

export const signInSchema = z.strictObject({
  email,
  password: z.string().min(1).max(128),
});
export type SignInDto = z.infer<typeof signInSchema>;

export const changePasswordSchema = z
  .strictObject({
    currentPassword: z.string().min(1).max(128),
    newPassword,
  })
  .refine(({ currentPassword, newPassword }) => currentPassword !== newPassword, {
    path: ['newPassword'],
    message: 'must be different from the current password',
  });
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;

export const setupStatusSchema = z.object({
  /** True until the first admin exists: the web app then shows the first-run screen. */
  needsSetup: z.boolean(),
});
export type SetupStatus = z.infer<typeof setupStatusSchema>;
