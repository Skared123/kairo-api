import { PasswordHasher } from '@nestjs/authentication';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { DataSource } from 'typeorm';
import { SETUP_LOCK_KEY } from '../src/auth/credentials.service.js';
import { User } from '../src/users/user.entity.js';
import { createTestApp, insertUser, sessionCookie, WEB_ORIGIN } from './create-test-app.js';

const admin = { name: 'Ada Lovelace', email: 'ada@example.com', password: 'correct horse battery staple' };

describe('Authentication (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let http: ReturnType<typeof request>;

  beforeEach(async () => {
    ({ app, dataSource } = await createTestApp());
    http = request(app.getHttpServer());
  });

  afterEach(async () => {
    await app.close();
  });

  /** Creates the first admin through the API and returns the session cookie it was signed in with. */
  async function setupAdmin(): Promise<string> {
    const res = await http.post('/auth/setup').send(admin).expect(201);
    return sessionCookie(res.headers['set-cookie']);
  }

  describe('setup', () => {
    it('creates the first admin, signs them in, then closes', async () => {
      await http.get('/auth/setup').expect(200, { needsSetup: true });

      const res = await http
        .post('/auth/setup')
        .send({ ...admin, email: '  Ada@Example.COM ' })
        .expect(201);
      expect(res.body).toEqual({
        id: expect.any(String),
        name: admin.name,
        email: admin.email,
        role: 'admin',
        mustChangePassword: false,
      });

      const cookie = sessionCookie(res.headers['set-cookie']);
      await http.get('/auth/me').set('Cookie', cookie).expect(200, res.body);

      await http.get('/auth/setup').expect(200, { needsSetup: false });
      await http.post('/auth/setup').send({ ...admin, email: 'other@example.com' }).expect(409);
    });

    it('waits for a concurrent setup and then refuses', async () => {
      // Plays the other setup: holds the lock, and creates a user while the request waits for it.
      const other = dataSource.createQueryRunner();
      await other.connect();
      await other.startTransaction();
      await other.query('SELECT pg_advisory_xact_lock(hashtext($1))', [SETUP_LOCK_KEY]);

      const pending = http
        .post('/auth/setup')
        .send(admin)
        .then((res) => res);
      await vi.waitFor(async () => {
        const [{ waiting }] = await dataSource.query<{ waiting: number }[]>(
          `SELECT count(*)::int AS waiting FROM pg_locks WHERE locktype = 'advisory' AND NOT granted`,
        );
        expect(waiting).toBe(1);
      });

      const passwordHash = await app.get(PasswordHasher).hash(admin.password);
      await other.manager.save(User, { name: 'Other', email: 'other@example.com', passwordHash, role: 'admin' });
      await other.commitTransaction();
      await other.release();

      expect((await pending).status).toBe(409);
      expect(await dataSource.getRepository(User).count()).toBe(1);
    });

    it('accepts any short password, and rejects an empty one and unknown fields', async () => {
      await http
        .post('/auth/setup')
        .send({ ...admin, password: '' })
        .expect(400);
      await http
        .post('/auth/setup')
        .send({ ...admin, role: 'admin' })
        .expect(400);
      await http.get('/auth/setup').expect(200, { needsSetup: true });

      // Decision 015: no minimum length.
      await http
        .post('/auth/setup')
        .send({ ...admin, password: 'abc123' })
        .expect(201);
      await http.post('/auth/sign-in').send({ email: admin.email, password: 'abc123' }).expect(200);
    });
  });

  describe('sign-in', () => {
    it('signs in with the right password, whatever the email case', async () => {
      await setupAdmin();

      const res = await http.post('/auth/sign-in').send({ email: 'ADA@example.com', password: admin.password });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ email: admin.email, role: 'admin' });
      expect(res.body).not.toHaveProperty('passwordHash');

      const cookie = sessionCookie(res.headers['set-cookie']);
      expect(res.headers['set-cookie']?.[0]).toMatch(/HttpOnly/i);
      await http.get('/auth/me').set('Cookie', cookie).expect(200);
    });

    it('answers a wrong password and an unknown email the same way', async () => {
      await setupAdmin();

      const wrongPassword = await http
        .post('/auth/sign-in')
        .send({ email: admin.email, password: 'not the password at all' })
        .expect(401);
      const unknownEmail = await http
        .post('/auth/sign-in')
        .send({ email: 'nobody@example.com', password: admin.password })
        .expect(401);

      expect(wrongPassword.body.message).toBe('Invalid email or password');
      expect(unknownEmail.body).toEqual(wrongPassword.body);
      expect(wrongPassword.headers['set-cookie']).toBeUndefined();
    });

    it('refuses a deactivated account, and ends the sessions it already had', async () => {
      await setupAdmin();
      const grace = await insertUser(app);
      const res = await http.post('/auth/sign-in').send(grace).expect(200);
      const cookie = sessionCookie(res.headers['set-cookie']);

      await dataSource.getRepository(User).update({ email: grace.email }, { deactivatedAt: new Date() });

      await http.get('/auth/me').set('Cookie', cookie).expect(401);
      await http.post('/auth/sign-in').send(grace).expect(401);
    });
  });

  describe('signed-in routes', () => {
    it('reject requests without a session', async () => {
      await http.get('/auth/me').expect(401);
      await http.post('/auth/sign-out').expect(401);
    });

    it('sign out ends the session', async () => {
      const cookie = await setupAdmin();

      await http.post('/auth/sign-out').set('Cookie', cookie).expect(204);
      await http.get('/auth/me').set('Cookie', cookie).expect(401);
    });
  });

  describe('cross-origin requests', () => {
    it('lets kairo-web sign in, with CORS for its origin only', async () => {
      await setupAdmin();

      const res = await http
        .post('/auth/sign-in')
        .set('Origin', WEB_ORIGIN)
        .set('Sec-Fetch-Site', 'same-site')
        .send({ email: admin.email, password: admin.password })
        .expect(200);
      expect(res.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
      expect(res.headers['access-control-allow-credentials']).toBe('true');

      // CORS always names kairo-web's origin, so a browser on any other site cannot read the response.
      const other = await http.get('/auth/setup').set('Origin', 'https://evil.example');
      expect(other.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
    });

    it("refuses another site's page, even on public routes", async () => {
      await http
        .post('/auth/setup')
        .set('Origin', 'https://evil.example')
        .set('Sec-Fetch-Site', 'cross-site')
        .send(admin)
        .expect(403);
      await http.get('/auth/setup').expect(200, { needsSetup: true });
    });
  });
});
