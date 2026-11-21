import { Can } from '@nestjs/authorization';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { createTestApp } from './create-test-app.js';
import { createTwoUsers } from './two-users.js';

/**
 * The only routes a guest may reach. A new public route has to be added here on purpose; anything else that answers
 * a guest with something other than 401 fails the inventory test below.
 */
const PUBLIC_ROUTES = ['GET /', 'GET /auth/setup', 'POST /auth/setup', 'POST /auth/sign-in'];

const ANY_UUID = '00000000-0000-4000-8000-000000000000';

/** Test-only routes: one that forgot its authorization declaration, and one open to any signed-in user. */
@Controller('probe')
class ProbeController {
  @Get('undeclared')
  undeclared() {
    return 'should never run';
  }

  @Can.Anyone()
  @Get('anyone')
  anyone() {
    return 'ok';
  }
}

describe('Authorization (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;

  beforeEach(async () => {
    ({ app } = await createTestApp({ controllers: [ProbeController] }));
    http = request(app.getHttpServer());
  });

  afterEach(async () => {
    await app.close();
  });

  it('requires a session on every route of the app, except the public ones', async () => {
    // The OpenAPI document lists every route, so a route added in a later version is checked without touching this.
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
    const routes = Object.entries(document.paths)
      .flatMap(([path, operations]) => Object.keys(operations).map((method) => ({ method, path })))
      .filter(({ path }) => !path.startsWith('/probe'));
    expect(routes.length).toBeGreaterThan(PUBLIC_ROUTES.length);

    const open: string[] = [];
    for (const { method, path } of routes) {
      const route = `${method.toUpperCase()} ${path}`;
      const url = path.replace(/\{[^}]+\}/g, ANY_UUID);
      const res = await http[method as 'get' | 'post' | 'patch' | 'put' | 'delete'](url).send({});
      if (res.status !== 401 && !PUBLIC_ROUTES.includes(route)) {
        open.push(`${route} answered ${res.status}`);
      }
    }
    expect(open).toEqual([]);
  });

  it('denies a route that declares no authorization, even to a signed-in user', async () => {
    const { ada } = await createTwoUsers(app);

    await http.get('/probe/undeclared').expect(401);
    await http.get('/probe/undeclared').set('Cookie', ada.cookie).expect(403);
    await http.get('/probe/anyone').set('Cookie', ada.cookie).expect(200, 'ok');
  });

  describe('createTwoUsers', () => {
    it('signs in two regular users, each with a session of their own', async () => {
      const { ada, grace } = await createTwoUsers(app);
      expect(ada.id).not.toBe(grace.id);
      expect(ada.cookie).not.toBe(grace.cookie);

      const adaMe = await http.get('/auth/me').set('Cookie', ada.cookie).expect(200);
      const graceMe = await http.get('/auth/me').set('Cookie', grace.cookie).expect(200);
      expect(adaMe.body).toMatchObject({ id: ada.id, email: ada.email, role: 'user', mustChangePassword: false });
      expect(graceMe.body).toMatchObject({ id: grace.id, email: grace.email, role: 'user' });
    });

    it("keeps one user's account actions away from the other's sessions", async () => {
      const { ada, grace } = await createTwoUsers(app);

      await http
        .post('/auth/password')
        .set('Cookie', grace.cookie)
        .send({ currentPassword: 'another long passphrase', newPassword: 'abc123' })
        .expect(200);
      await http.post('/auth/sign-out').set('Cookie', grace.cookie).expect(401);

      // Grace ended her other sessions and changed her password; Ada is untouched.
      await http.get('/auth/me').set('Cookie', ada.cookie).expect(200);
    });
  });
});
