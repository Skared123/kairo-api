import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { DataSource } from 'typeorm';
import { ACCOUNTS_LOCK_KEY } from '../src/users/accounts.service.js';
import { User } from '../src/users/user.entity.js';
import { createTestApp, insertUser, sessionCookie } from './create-test-app.js';

const admin = { name: 'Ada Lovelace', email: 'ada@example.com', password: 'abc123' };

describe('Admin accounts (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let http: ReturnType<typeof request>;
  /** Session cookie of the first admin, created in beforeEach. */
  let adminCookie: string;
  let adminId: string;

  beforeEach(async () => {
    ({ app, dataSource } = await createTestApp());
    http = request(app.getHttpServer());
    const res = await http.post('/auth/setup').send(admin).expect(201);
    adminCookie = sessionCookie(res.headers['set-cookie']);
    adminId = res.body.id;
  });

  afterEach(async () => {
    await app.close();
  });

  async function signIn(credentials: { email: string; password: string }): Promise<string> {
    const res = await http.post('/auth/sign-in').send(credentials).expect(200);
    return sessionCookie(res.headers['set-cookie']);
  }

  /** Creates an account through the API, as the admin. */
  async function createAccount(fields: { name?: string; email: string; role?: 'admin' | 'user' }) {
    const res = await http
      .post('/admin/users')
      .set('Cookie', adminCookie)
      .send({ name: 'Grace Hopper', ...fields })
      .expect(201);
    return res.body as { account: { id: string; email: string }; temporaryPassword: string };
  }

  describe('access', () => {
    it('is for admins only', async () => {
      const userCookie = await signIn(await insertUser(app));
      const someId = adminId;

      for (const [method, path] of [
        ['get', '/admin/users'],
        ['post', '/admin/users'],
        ['patch', `/admin/users/${someId}`],
        ['post', `/admin/users/${someId}/password`],
      ] as const) {
        await http[method](path).send({}).expect(401);
        await http[method](path).set('Cookie', userCookie).send({}).expect(403);
      }
    });
  });

  describe('POST /admin/users', () => {
    it('creates an account whose temporary password works once, until it is changed', async () => {
      const { account, temporaryPassword } = await createAccount({ email: ' Grace@Example.com ' });
      expect(account).toMatchObject({ email: 'grace@example.com', role: 'user', active: true, mustChangePassword: true });
      expect(temporaryPassword).toMatch(/^\w{4}-\w{4}-\w{4}$/);

      const res = await http.post('/auth/sign-in').send({ email: 'grace@example.com', password: temporaryPassword });
      expect(res.status).toBe(200);
      expect(res.body.mustChangePassword).toBe(true);

      // Only the hash is stored.
      const row = await dataSource.getRepository(User).findOneByOrFail({ id: account.id });
      expect(row.passwordHash).not.toContain(temporaryPassword);
    });

    it('refuses an email that already has an account, whatever its case', async () => {
      await createAccount({ email: 'grace@example.com' });
      await http
        .post('/admin/users')
        .set('Cookie', adminCookie)
        .send({ name: 'Other Grace', email: 'GRACE@example.com' })
        .expect(409);
    });

    it('does not accept a password or other fields from the admin', async () => {
      await http
        .post('/admin/users')
        .set('Cookie', adminCookie)
        .send({ name: 'Grace Hopper', email: 'grace@example.com', password: 'chosen by the admin' })
        .expect(400);
    });
  });

  describe('GET /admin/users', () => {
    it('lists accounts with their status only', async () => {
      await createAccount({ email: 'grace@example.com' });

      const res = await http.get('/admin/users').set('Cookie', adminCookie).expect(200);
      expect(res.body.map((account: { email: string }) => account.email)).toEqual([admin.email, 'grace@example.com']);
      expect(Object.keys(res.body[1]).sort()).toEqual(
        [
          'active',
          'createdAt',
          'deactivatedAt',
          'email',
          'id',
          'mustChangePassword',
          'name',
          'role',
          'temporaryPasswordExpiresAt',
        ].sort(),
      );
    });
  });

  describe('PATCH /admin/users/:id', () => {
    it('deactivates an account, ending its sessions, and reactivates it', async () => {
      const grace = await insertUser(app);
      const graceCookie = await signIn(grace);
      const { id } = await dataSource.getRepository(User).findOneByOrFail({ email: grace.email });

      const off = await http.patch(`/admin/users/${id}`).set('Cookie', adminCookie).send({ active: false }).expect(200);
      expect(off.body).toMatchObject({ active: false, deactivatedAt: expect.any(String) });
      await http.get('/auth/me').set('Cookie', graceCookie).expect(401);
      await http.post('/auth/sign-in').send(grace).expect(401);
      expect(await dataSource.query('SELECT 1 FROM sessions WHERE user_id = $1', [id])).toEqual([]);

      const on = await http.patch(`/admin/users/${id}`).set('Cookie', adminCookie).send({ active: true }).expect(200);
      expect(on.body).toMatchObject({ active: true, deactivatedAt: null });
      await signIn(grace);
    });

    it('promotes a user, who then manages accounts', async () => {
      const grace = await insertUser(app);
      const graceCookie = await signIn(grace);
      const { id } = await dataSource.getRepository(User).findOneByOrFail({ email: grace.email });
      await http.get('/admin/users').set('Cookie', graceCookie).expect(403);

      await http.patch(`/admin/users/${id}`).set('Cookie', adminCookie).send({ role: 'admin' }).expect(200);
      // The role is read on every request, so the same session gets the new rights at once.
      await http.get('/admin/users').set('Cookie', graceCookie).expect(200);
    });

    it('never leaves the app without an active admin', async () => {
      await http.patch(`/admin/users/${adminId}`).set('Cookie', adminCookie).send({ role: 'user' }).expect(409);
      await http.patch(`/admin/users/${adminId}`).set('Cookie', adminCookie).send({ active: false }).expect(409);

      // With a second admin, the first one may step down.
      const grace = await insertUser(app, { role: 'admin' });
      await http.patch(`/admin/users/${adminId}`).set('Cookie', adminCookie).send({ role: 'user' }).expect(200);
      await http.get('/admin/users').set('Cookie', adminCookie).expect(403);
      await http.get('/admin/users').set('Cookie', await signIn(grace)).expect(200);
    });

    it('waits for a concurrent change and then refuses to remove the last admin', async () => {
      const grace = await insertUser(app, { role: 'admin' });
      const graceRow = await dataSource.getRepository(User).findOneByOrFail({ email: grace.email });

      // Plays a concurrent request that demotes Grace: holds the lock while Ada's own demotion waits for it.
      const other = dataSource.createQueryRunner();
      await other.connect();
      await other.startTransaction();
      await other.query('SELECT pg_advisory_xact_lock(hashtext($1))', [ACCOUNTS_LOCK_KEY]);

      const pending = http
        .patch(`/admin/users/${adminId}`)
        .set('Cookie', adminCookie)
        .send({ role: 'user' })
        .then((res) => res);
      await vi.waitFor(async () => {
        const [{ waiting }] = await dataSource.query<{ waiting: number }[]>(
          `SELECT count(*)::int AS waiting FROM pg_locks WHERE locktype = 'advisory' AND NOT granted`,
        );
        expect(waiting).toBe(1);
      });

      await other.manager.update(User, { id: graceRow.id }, { role: 'user' });
      await other.commitTransaction();
      await other.release();

      expect((await pending).status).toBe(409);
      expect(await dataSource.getRepository(User).countBy({ role: 'admin' })).toBe(1);
    });

    it('answers 404 for an unknown account and 400 for a bad id or body', async () => {
      await http
        .patch('/admin/users/00000000-0000-4000-8000-000000000000')
        .set('Cookie', adminCookie)
        .send({ active: false })
        .expect(404);
      await http.patch('/admin/users/not-a-uuid').set('Cookie', adminCookie).send({ active: false }).expect(400);
      await http.patch(`/admin/users/${adminId}`).set('Cookie', adminCookie).send({}).expect(400);
      await http.patch(`/admin/users/${adminId}`).set('Cookie', adminCookie).send({ email: 'x@example.com' }).expect(400);
    });
  });

  describe('POST /admin/users/:id/password', () => {
    it('replaces a forgotten password with a temporary one and ends the sessions', async () => {
      const grace = await insertUser(app);
      const graceCookie = await signIn(grace);
      const { id } = await dataSource.getRepository(User).findOneByOrFail({ email: grace.email });

      const res = await http.post(`/admin/users/${id}/password`).set('Cookie', adminCookie).expect(200);
      const { temporaryPassword } = res.body as { temporaryPassword: string };

      await http.get('/auth/me').set('Cookie', graceCookie).expect(401);
      await http.post('/auth/sign-in').send(grace).expect(401);
      const signedIn = await http
        .post('/auth/sign-in')
        .send({ email: grace.email, password: temporaryPassword })
        .expect(200);
      expect(signedIn.body.mustChangePassword).toBe(true);
    });

    it('answers 404 for an unknown account', async () => {
      await http
        .post('/admin/users/00000000-0000-4000-8000-000000000000/password')
        .set('Cookie', adminCookie)
        .expect(404);
    });
  });
});
