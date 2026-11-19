import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './database.config.js';

/**
 * Entry point for the TypeORM CLI only; the Nest app builds its connection in AppModule.
 * The migration:* scripts load .env with `node --env-file-if-exists=.env`.
 */
export default new DataSource(buildDataSourceOptions(process.env.DATABASE_URL));
