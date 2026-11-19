import { envSchema } from './env.schema.js';

const DATABASE_URL = 'postgres://kairo:kairo@localhost:5434/kairo';

describe('envSchema', () => {
  it('applies defaults when only DATABASE_URL is set', () => {
    expect(envSchema.parse({ DATABASE_URL })).toEqual({ NODE_ENV: 'development', PORT: 4000, DATABASE_URL });
  });

  it('turns PORT into a number', () => {
    expect(envSchema.parse({ DATABASE_URL, PORT: '4100' }).PORT).toBe(4100);
  });

  it('rejects a PORT that is not a number', () => {
    expect(envSchema.safeParse({ DATABASE_URL, PORT: 'abc' }).success).toBe(false);
  });

  it('requires DATABASE_URL', () => {
    expect(envSchema.safeParse({}).success).toBe(false);
  });

  it('rejects a DATABASE_URL that is not postgres', () => {
    expect(envSchema.safeParse({ DATABASE_URL: 'mysql://kairo:kairo@localhost:3306/kairo' }).success).toBe(false);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(envSchema.safeParse({ DATABASE_URL, NODE_ENV: 'staging' }).success).toBe(false);
  });
});
