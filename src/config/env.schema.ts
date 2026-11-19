import { z } from 'zod';

/**
 * Environment variables the API reads, validated once at startup by ConfigModule.
 * A plain object, not strictObject: the process environment always carries unrelated variables (PATH, HOME...).
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, error: 'must be a postgres:// URL' }),
  /**
   * Origin of kairo-web. The only origin CORS allows, and trusted for cookie requests by the CSRF check and the
   * session cookie. Must be a bare origin, as browsers send it in the Origin header.
   */
  WEB_ORIGIN: z
    .url({ protocol: /^https?$/ })
    .refine((url) => new URL(url).origin === url, 'must be an origin like http://localhost:3000, with no path')
    .default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;
