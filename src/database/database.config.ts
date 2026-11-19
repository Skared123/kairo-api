import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import { entities } from './entities.js';

/** Connection options shared by the Nest app and the TypeORM CLI. */
export function buildDataSourceOptions(url: string | undefined): DataSourceOptions {
  if (!url) {
    // Without this guard, pg would fall back to localhost:5432 and could connect to another project's database.
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  }

  return {
    type: 'postgres',
    url,
    entities,
    // Compiled migrations: the CLI runs against dist/ (see the migration:* scripts in package.json).
    migrations: [join(import.meta.dirname, 'migrations', '*.js')],
    // Schema changes always go through reviewed migrations (decision 004).
    synchronize: false,
  };
}
