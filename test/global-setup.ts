import { execFileSync } from 'node:child_process';
import { testDatabaseUrl } from './test-env.js';

/**
 * Runs once before the end-to-end suite: builds the app and applies the migrations to the test database,
 * with the same CLI over dist/ that the migration:* scripts use.
 */
export default function setup(): void {
  const DATABASE_URL = testDatabaseUrl();

  execFileSync('pnpm', ['build'], { stdio: 'inherit' });
  execFileSync('node', ['node_modules/typeorm/cli.js', 'migration:run', '-d', 'dist/database/data-source.js'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL },
  });
}
