import { loadEnv } from 'vite';

/**
 * URL of the end-to-end database, from TEST_DATABASE_URL in .env (or the environment).
 * Refuses any database whose name does not end in _test, so tests can never wipe development data.
 */
export function testDatabaseUrl(): string {
  const url = loadEnv('test', process.cwd(), '').TEST_DATABASE_URL;
  if (!url) {
    throw new Error('TEST_DATABASE_URL is not set. Copy it from .env.example into .env.');
  }

  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith('_test')) {
    throw new Error(`Refusing to run end-to-end tests against "${name}": the database name must end in _test.`);
  }
  return url;
}
