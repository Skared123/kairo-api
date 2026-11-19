import { z } from 'zod';

/**
 * Environment variables the API reads, validated once at startup by ConfigModule.
 * A plain object, not strictObject: the process environment always carries unrelated variables (PATH, HOME...).
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, error: 'must be a postgres:// URL' }),
});

export type Env = z.infer<typeof envSchema>;
