import { AuthenticationStorage } from '@nestjs/authentication';
import { authenticationStoreContract } from '@nestjs/authentication/testing';
import { DataSource } from 'typeorm';
import { Session } from '../src/auth/session.entity.js';
import { TypeOrmSessionStore } from '../src/auth/typeorm-session.store.js';
import { buildDataSourceOptions } from '../src/database/database.config.js';
import { resetDatabase } from './reset-database.js';

/**
 * Runs the library's own contract suite against the PostgreSQL store, concurrency cases included.
 * The default connection pool lets those parallel calls really race.
 */
describe('TypeOrmSessionStore (contract)', () => {
  const dataSource = new DataSource(buildDataSourceOptions(process.env.DATABASE_URL));

  beforeAll(async () => {
    await dataSource.initialize();
    await resetDatabase(dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  // Each case gets its own store and registry; ids are unique per case, so the cases share the table.
  const cases = authenticationStoreContract(
    () => ({ sessions: new TypeOrmSessionStore(dataSource.getRepository(Session), new AuthenticationStorage()) }),
    { contracts: ['sessions'], concurrent: true },
  );

  for (const contractCase of cases) {
    it(contractCase.name, () => contractCase.run());
  }
});
