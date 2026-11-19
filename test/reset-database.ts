import type { DataSource } from 'typeorm';

/** Empties every entity table, so each test starts from a clean database. */
export async function resetDatabase(dataSource: DataSource): Promise<void> {
  const [{ name }] = await dataSource.query<{ name: string }[]>('SELECT current_database() AS name');
  if (!name.endsWith('_test')) {
    throw new Error(`Refusing to reset "${name}": only *_test databases can be reset.`);
  }

  const tables = dataSource.entityMetadatas.map((metadata) => `"${metadata.tableName}"`);
  if (tables.length) {
    await dataSource.query(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
  }
}
