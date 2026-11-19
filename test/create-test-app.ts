import { PasswordHasher } from '@nestjs/authentication';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { resetDatabase } from './reset-database.js';

/** The kairo-web origin the tests send, the default of WEB_ORIGIN. */
export const WEB_ORIGIN = 'http://localhost:3000';

/**
 * The real AppModule with the same HTTP setup as main.ts, on an empty test database. Only the password hasher
 * changes: scrypt at the production cost takes about 128 MiB and a few hundred milliseconds per hash.
 */
export async function createTestApp(): Promise<{ app: INestApplication<App>; dataSource: DataSource }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PasswordHasher)
    .useValue(new PasswordHasher({ logN: 10 }))
    .compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();

  const dataSource = app.get(DataSource);
  await resetDatabase(dataSource);
  return { app, dataSource };
}

/** The `name=value` pair of the session cookie a response sets, to send back in a Cookie header. */
export function sessionCookie(setCookie: string | string[] | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const session = cookies.find((cookie) => cookie.startsWith('__Host-sid='));
  if (!session) {
    throw new Error(`No session cookie in Set-Cookie: ${JSON.stringify(cookies)}`);
  }
  return session.split(';')[0];
}
