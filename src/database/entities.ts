import type { DataSourceOptions } from 'typeorm';

/**
 * Every entity, registered explicitly. The app and the TypeORM CLI read this same list,
 * so a new entity only has to be added here.
 */
export const entities: NonNullable<DataSourceOptions['entities']> = [];
