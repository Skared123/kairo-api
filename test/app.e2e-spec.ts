import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import { resetDatabase } from './reset-database.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
    await resetDatabase(dataSource);
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('runs against the migrated test database', async () => {
    const [{ name }] = await dataSource.query<{ name: string }[]>('SELECT current_database() AS name');
    expect(name).toBe('kairo_test');
    expect(await dataSource.showMigrations()).toBe(false);
  });

  afterEach(async () => {
    await app.close();
  });
});
