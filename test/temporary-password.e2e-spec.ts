import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { DataSource } from 'typeorm';
import { User } from '../src/users/user.entity.js';
import { createTestApp, sessionCookie } from './create-test-app.js';

const HOUR = 60 * 60 * 1000;

/** Decision 026: a temporary password works for 72 hours, then a new one has to come from the admin. */
describe('Temporary password expiry (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let http: ReturnType<typeof request>;
  let adminCookie: string;

  beforeEach(async () => {
    ({ app, dataSource } = await createTestApp());
    http = request(app.getHttpServer());
    const res = await http
      .post('/auth/setup')
      .send({ name: 'Ada Lovelace', email: 'ada@example.com', password: 'abc123' })
      .expect(201);
    adminCookie = sessionCookie(res.headers['set-cookie']);
  });

  afterEach(async () => {
    await app.close();
  });

  /** An account the admin creates: its id, and the credentials to sign in with its temporary password. */
  async function createGrace(): Promise<{ id: string; credentials: { email: string; password: string } }> {
    const res = await http
      .post('/admin/users')
      .set('Cookie', adminCookie)
      .send({ name: 'Grace Hopper', email: 'grace@example.com' })
      .expect(201);
    return {
      id: res.body.account.id,
      credentials: { email: res.body.account.email, password: res.body.temporaryPassword },
    };
  }

  async function signIn(credentials: { email: string; password: string }): Promise<string> {
    const res = await http.post('/auth/sign-in').send(credentials).expect(200);
    return sessionCookie(res.headers['set-cookie']);
  }

  /** Moves the temporary password's expiry, standing in for the clock. */
  async function expireIn(id: string, ms: number): Promise<void> {
    await dataSource.getRepository(User).update({ id }, { temporaryPasswordExpiresAt: new Date(Date.now() + ms) });
  }

  it('gives an account the admin creates 72 hours, and none to the first admin', async () => {
    const before = Date.now();
    const grace = await createGrace();
    const accounts = (await http.get('/admin/users').set('Cookie', adminCookie).expect(200)).body as {
      id: string;
      temporaryPasswordExpiresAt: string | null;
    }[];

    const expiresAt = new Date(accounts.find((a) => a.id === grace.id)!.temporaryPasswordExpiresAt!).getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + 72 * HOUR);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 72 * HOUR);
    expect(accounts.find((a) => a.id !== grace.id)!.temporaryPasswordExpiresAt).toBeNull();
  });

  it('refuses an expired temporary password at sign-in, and ends the session it opened', async () => {
    const grace = await createGrace();
    const cookie = await signIn(grace.credentials);

    await expireIn(grace.id, -1);

    const res = await http.post('/auth/sign-in').send(grace.credentials).expect(403);
    expect(res.body.error).toBe('temporary_password_expired');
    expect(res.headers['set-cookie']).toBeUndefined();
    await http.get('/auth/me').set('Cookie', cookie).expect(401);
    await http
      .post('/auth/password')
      .set('Cookie', cookie)
      .send({ currentPassword: grace.credentials.password, newPassword: 'abc123' })
      .expect(401);
  });

  it('still answers a wrong password with 401, so the 403 never helps someone guessing', async () => {
    const grace = await createGrace();
    await expireIn(grace.id, -1);

    const res = await http
      .post('/auth/sign-in')
      .send({ email: grace.credentials.email, password: 'not it' })
      .expect(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('works again after the admin resets it', async () => {
    const grace = await createGrace();
    await expireIn(grace.id, -1);

    const reset = await http.post(`/admin/users/${grace.id}/password`).set('Cookie', adminCookie).expect(200);
    const res = await http
      .post('/auth/sign-in')
      .send({ email: grace.credentials.email, password: reset.body.temporaryPassword })
      .expect(200);
    expect(res.body.mustChangePassword).toBe(true);
  });

  it('stops counting once the user chooses their own password', async () => {
    const grace = await createGrace();
    const cookie = await signIn(grace.credentials);
    await http
      .post('/auth/password')
      .set('Cookie', cookie)
      .send({ currentPassword: grace.credentials.password, newPassword: 'my own password' })
      .expect(200);

    const row = await dataSource.getRepository(User).findOneByOrFail({ id: grace.id });
    expect(row.temporaryPasswordExpiresAt).toBeNull();
    await signIn({ email: grace.credentials.email, password: 'my own password' });
  });
});
