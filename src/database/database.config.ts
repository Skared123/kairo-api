import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import { entities } from './entities.js';
import { SnakeNamingStrategy } from './snake-naming.strategy.js';

/** Connection options shared by the Nest app and the TypeORM CLI. */
export function buildDataSourceOptions(url: string | undefined): DataSourceOptions {
  if (!url) {
    // The app validates DATABASE_URL through envSchema; the CLI does not go through Nest, so it relies on this guard.
    // Without it, pg would fall back to localhost:5432 and could connect to another project's database.
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  }

  return {
    type: 'postgres',
    url,
    entities,
    namingStrategy: new SnakeNamingStrategy(),
    // TypeORM would otherwise run CREATE EXTENSION on every connection. Extensions are schema changes,
    // so they go through migrations like everything else (decision 004).
    installExtensions: false,
    // Generate UUIDs with gen_random_uuid(), built into PostgreSQL 13+, instead of uuid-ossp's uuid_generate_v4().
    uuidExtension: 'pgcrypto',
    // Compiled migrations: the CLI runs against dist/ (see the migration:* scripts in package.json).
    migrations: [join(import.meta.dirname, 'migrations', '*.js')],
    // Schema changes always go through reviewed migrations (decision 004).
    synchronize: false,
  };
}
