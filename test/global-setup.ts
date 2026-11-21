import { execFileSync } from 'node:child_process';
import { testDatabaseUrl } from './test-env.js';

/**
 * Runs once before the end-to-end suite: builds the app and applies the migrations to the test database,
 * with the same CLI over dist/ that the migration:* scripts use.
 */
export default function setup(): void {
  const DATABASE_URL = testDatabaseUrl();

  execFileSync('pnpm', ['build'], { stdio: 'inherit' });
  try {
    execFileSync('node', ['node_modules/typeorm/cli.js', 'migration:run', '-d', 'dist/database/data-source.js'], {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL },
    });
  } catch {
    // The CLI already printed the cause above; this says what usually fixes it.
    throw new Error('Could not migrate the test database. Is it running? Start it with `pnpm db:up`.');
  }
}
