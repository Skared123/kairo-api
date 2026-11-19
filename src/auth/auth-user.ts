import { z } from 'zod';
import { USER_ROLES, type User } from '../users/user.entity.js';

/**
 * The signed-in user as the rest of the app sees it: what SessionAuth loads on every request, and what the auth
 * routes return. It never carries the password hash.
 */
export const authUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
  role: z.enum(USER_ROLES),
  /** The web app sends the user to the change-password screen while this is true (decision 011). */
  mustChangePassword: z.boolean(),
});

export type AuthUser = z.infer<typeof authUserSchema>;

export function toAuthUser({ id, email, name, role, mustChangePassword }: User): AuthUser {
  return { id, email, name, role, mustChangePassword };
}
