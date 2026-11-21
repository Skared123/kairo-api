import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { User } from '../src/users/user.entity.js';
import { insertUser, sessionCookie } from './create-test-app.js';

/** A regular user, signed in: send `cookie` in the Cookie header to act as them. */
export interface SignedInUser {
  id: string;
  email: string;
  cookie: string;
}

/**
 * Two regular users, Ada and Grace, each signed in with a session of their own.
 *
 * Every module that stores user data proves with it that one user can never reach another's rows (CLAUDE.md, hard
 * rules): Ada creates a record, then Grace lists, reads, changes and deletes it, and must find nothing.
 *
 * @example
 * const { ada, grace } = await createTwoUsers(app);
 * const { body: job } = await http.post('/jobs').set('Cookie', ada.cookie).send(newJob).expect(201);
 * await http.get(`/jobs/${job.id}`).set('Cookie', grace.cookie).expect(404);
 * expect((await http.get('/jobs').set('Cookie', grace.cookie).expect(200)).body).toEqual([]);
 */
export async function createTwoUsers(app: INestApplication<App>): Promise<{ ada: SignedInUser; grace: SignedInUser }> {
  const [ada, grace] = await Promise.all([
    signedIn(app, { name: 'Ada Lovelace', email: 'ada@example.com' }),
    signedIn(app, { name: 'Grace Hopper', email: 'grace@example.com' }),
  ]);
  return { ada, grace };
}

async function signedIn(app: INestApplication<App>, fields: Pick<User, 'name' | 'email'>): Promise<SignedInUser> {
  const credentials = await insertUser(app, { ...fields, role: 'user' });
  const res = await request(app.getHttpServer()).post('/auth/sign-in').send(credentials).expect(200);
  const { id } = await app.get(DataSource).getRepository(User).findOneByOrFail({ email: credentials.email });
  return { id, email: credentials.email, cookie: sessionCookie(res.headers['set-cookie']) };
}
