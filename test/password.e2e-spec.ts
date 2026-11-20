import { Controller, Get, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { createTestApp, insertUser, sessionCookie } from './create-test-app.js';

/** A plain signed-in route, standing in for the app's routes until v0.2 adds real ones. */
@Controller('probe')
class ProbeController {
  @Get()
  probe() {
    return 'ok';
  }
}

describe('Password change (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;

  beforeEach(async () => {
    ({ app } = await createTestApp({ controllers: [ProbeController] }));
    http = request(app.getHttpServer());
  });

  afterEach(async () => {
    await app.close();
  });

  async function signIn(credentials: { email: string; password: string }): Promise<string> {
    const res = await http.post('/auth/sign-in').send(credentials).expect(200);
    return sessionCookie(res.headers['set-cookie']);
  }

  describe('POST /auth/password', () => {
    it('changes the password, keeps this browser signed in and ends every other session', async () => {
      const grace = await insertUser(app);
      const laptop = await signIn(grace);
      const phone = await signIn(grace);

      const res = await http
        .post('/auth/password')
        .set('Cookie', laptop)
        .send({ currentPassword: grace.password, newPassword: 'abc123' })
        .expect(200);
      expect(res.body).toMatchObject({ email: grace.email, mustChangePassword: false });

      // This browser got a new session id: the new cookie works, the old one and the other browser's do not.
      const rotated = sessionCookie(res.headers['set-cookie']);
      expect(rotated).not.toBe(laptop);
      await http.get('/auth/me').set('Cookie', rotated).expect(200);
      await http.get('/auth/me').set('Cookie', laptop).expect(401);
      await http.get('/auth/me').set('Cookie', phone).expect(401);

      await http.post('/auth/sign-in').send(grace).expect(401);
      await http.post('/auth/sign-in').send({ email: grace.email, password: 'abc123' }).expect(200);
    });

    it('requires the right current password and a different new one', async () => {
      const grace = await insertUser(app);
      const cookie = await signIn(grace);

      const wrong = await http
        .post('/auth/password')
        .set('Cookie', cookie)
        .send({ currentPassword: 'not my password', newPassword: 'abc123' })
        .expect(400);
      expect(wrong.body.message).toBe('Current password is incorrect');

      await http
        .post('/auth/password')
        .set('Cookie', cookie)
        .send({ currentPassword: grace.password, newPassword: grace.password })
        .expect(400);

      // Neither attempt changed anything.
      await http.get('/auth/me').set('Cookie', cookie).expect(200);
      await signIn(grace);
    });

    it('needs a session', async () => {
      await http.post('/auth/password').send({ currentPassword: 'a', newPassword: 'b' }).expect(401);
    });
  });

  describe('forced change (decision 016)', () => {
    it('blocks every other route until the password changes', async () => {
      const grace = await insertUser(app, { mustChangePassword: true });
      const res = await http.post('/auth/sign-in').send(grace).expect(200);
      expect(res.body.mustChangePassword).toBe(true);
      const cookie = sessionCookie(res.headers['set-cookie']);

      const blocked = await http.get('/probe').set('Cookie', cookie).expect(403);
      expect(blocked.body.error).toBe('password_change_required');
      await http.get('/auth/me').set('Cookie', cookie).expect(200);

      const changed = await http
        .post('/auth/password')
        .set('Cookie', cookie)
        .send({ currentPassword: grace.password, newPassword: 'my own password' })
        .expect(200);
      expect(changed.body.mustChangePassword).toBe(false);

      await http.get('/probe').set('Cookie', sessionCookie(changed.headers['set-cookie'])).expect(200, 'ok');
    });

    it('lets a user with a pending change sign out', async () => {
      const cookie = await signIn(await insertUser(app, { mustChangePassword: true }));

      await http.post('/auth/sign-out').set('Cookie', cookie).expect(204);
      await http.get('/auth/me').set('Cookie', cookie).expect(401);
    });

    it('leaves users without a pending change alone', async () => {
      const cookie = await signIn(await insertUser(app));
      await http.get('/probe').set('Cookie', cookie).expect(200, 'ok');
    });
  });
});
