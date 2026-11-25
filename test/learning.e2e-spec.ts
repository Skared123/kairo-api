import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { DataSource } from 'typeorm';
import { User } from '../src/users/user.entity.js';
import { createTestApp } from './create-test-app.js';
import { createTwoUsers, type SignedInUser } from './two-users.js';

interface ItemBody {
  id: string;
  title: string;
  kind: string;
  url: string | null;
  status: string;
  finishedAt: string | null;
  isFocus: boolean;
  notes: string | null;
  skills: { id: string; name: string }[];
}

describe('Learning (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let http: ReturnType<typeof request>;
  let ada: SignedInUser;
  let grace: SignedInUser;

  beforeEach(async () => {
    ({ app, dataSource } = await createTestApp());
    http = request(app.getHttpServer());
    ({ ada, grace } = await createTwoUsers(app));
  });

  afterEach(async () => {
    await app.close();
  });

  async function createItem(user: SignedInUser, fields: Record<string, unknown>): Promise<ItemBody> {
    const res = await http
      .post('/learning')
      .set('Cookie', user.cookie)
      .send({ kind: 'course', ...fields })
      .expect(201);
    return res.body as ItemBody;
  }

  const update = (user: SignedInUser, id: string, changes: Record<string, unknown>) =>
    http.patch(`/learning/${id}`).set('Cookie', user.cookie).send(changes);

  const skillsOf = async (userId: string) =>
    dataSource.query<{ name: string }[]>('SELECT name FROM skills WHERE user_id = $1 ORDER BY name', [userId]);

  /** Links between an item and a skill of different users: there must never be any, whatever the API answers. */
  const crossUserLinks = async () =>
    (
      await dataSource.query<{ count: number }[]>(
        `SELECT count(*)::int AS count FROM learning_item_skills link
         JOIN learning_items item ON item.id = link.item_id
         JOIN skills skill ON skill.id = link.skill_id
         WHERE item.user_id <> skill.user_id`,
      )
    )[0].count;

  describe('create and read', () => {
    it('creates an item to start, with only a title and a kind', async () => {
      const item = await createItem(ada, { title: ' NestJS Fundamentals ', kind: 'course', notes: '' });
      expect(item).toMatchObject({
        title: 'NestJS Fundamentals',
        kind: 'course',
        url: null,
        status: 'to_start',
        finishedAt: null,
        isFocus: false,
        notes: null,
        skills: [],
      });
      expect(item).not.toHaveProperty('userId');

      await http.get(`/learning/${item.id}`).set('Cookie', ada.cookie).expect(200, item);
    });

    it('rejects invalid fields', async () => {
      const send = (fields: Record<string, unknown>) => http.post('/learning').set('Cookie', ada.cookie).send(fields);
      await send({ kind: 'course' }).expect(400);
      await send({ title: 'No kind' }).expect(400);
      await send({ title: 'Podcast', kind: 'podcast' }).expect(400);
      await send({ title: 'Bad link', kind: 'video', url: 'javascript:alert(1)' }).expect(400);
      await send({ title: 'Empty skill', kind: 'video', skills: ['  '] }).expect(400);
      await send({ title: 'Long skill', kind: 'video', skills: ['x'.repeat(51)] }).expect(400);
      // Status and focus come in step 2, and the owner never comes from the request.
      await send({ title: 'Owner', kind: 'video', userId: grace.id }).expect(400);
    });
  });

  describe('skills (decision 040)', () => {
    it('creates skills by name, and reuses them ignoring case and spaces', async () => {
      const first = await createItem(ada, { title: 'NestJS Fundamentals', skills: ['NestJS', 'TypeScript'] });
      expect(first.skills.map((skill) => skill.name)).toEqual(['NestJS', 'TypeScript']);

      // The same skills, written differently, and one repeated within the list.
      const second = await createItem(ada, {
        title: 'Effective TypeScript',
        kind: 'book',
        skills: [' typescript ', 'TYPESCRIPT', 'System   design'],
      });
      expect(second.skills.map((skill) => skill.name)).toEqual(['System design', 'TypeScript']);
      const typescript = (body: ItemBody) => body.skills.find((skill) => skill.name === 'TypeScript')!.id;
      expect(typescript(second)).toBe(typescript(first));

      // Saved once each, as first written.
      expect((await skillsOf(ada.id)).map((skill) => skill.name)).toEqual(['NestJS', 'System design', 'TypeScript']);
    });

    it('replaces the whole set of skills on update, and clears it', async () => {
      const item = await createItem(ada, { title: 'NestJS Fundamentals', skills: ['NestJS', 'TypeScript'] });

      const changed = await update(ada, item.id, { skills: ['TypeScript', 'PostgreSQL'] }).expect(200);
      expect(changed.body.skills.map((skill: { name: string }) => skill.name)).toEqual(['PostgreSQL', 'TypeScript']);

      // Changing other fields keeps the skills.
      const renamed = await update(ada, item.id, { title: 'NestJS in depth' }).expect(200);
      expect(renamed.body.skills).toHaveLength(2);

      const cleared = await update(ada, item.id, { skills: [] }).expect(200);
      expect(cleared.body.skills).toEqual([]);
      // The skills stay in the user's list.
      expect(await skillsOf(ada.id)).toHaveLength(3);
    });
  });

  describe('list, update and delete', () => {
    it('lists the latest change first, and updates and clears fields', async () => {
      const older = await createItem(ada, { title: 'Designing Data-Intensive Applications', kind: 'book' });
      const newer = await createItem(ada, { title: 'Build a CLI in Go', kind: 'project' });

      const list = await http.get('/learning').set('Cookie', ada.cookie).expect(200);
      expect(list.body.map((item: ItemBody) => item.id)).toEqual([newer.id, older.id]);

      const changed = await update(ada, older.id, {
        url: 'https://example.com/ddia',
        notes: 'Chapter 5 next',
      }).expect(200);
      expect(changed.body).toMatchObject({ url: 'https://example.com/ddia', notes: 'Chapter 5 next' });
      const relisted = await http.get('/learning').set('Cookie', ada.cookie).expect(200);
      expect(relisted.body.map((item: ItemBody) => item.id)).toEqual([older.id, newer.id]);

      const cleared = await update(ada, older.id, { url: null, notes: '' }).expect(200);
      expect(cleared.body).toMatchObject({ url: null, notes: null });
      await update(ada, older.id, {}).expect(400);
      await update(ada, older.id, { title: '' }).expect(400);
    });

    it('deletes an item and its skill links, keeping the skills', async () => {
      const item = await createItem(ada, { title: 'NestJS Fundamentals', skills: ['NestJS'] });
      await http.delete(`/learning/${item.id}`).set('Cookie', ada.cookie).expect(204);
      await http.get(`/learning/${item.id}`).set('Cookie', ada.cookie).expect(404);
      await http.delete(`/learning/${item.id}`).set('Cookie', ada.cookie).expect(404);

      const [{ count }] = await dataSource.query<{ count: number }[]>(
        'SELECT count(*)::int AS count FROM learning_item_skills',
      );
      expect(count).toBe(0);
      expect(await skillsOf(ada.id)).toHaveLength(1);
    });

    it("deletes a user's items and skills with the user", async () => {
      await createItem(ada, { title: 'NestJS Fundamentals', skills: ['NestJS'] });
      await dataSource.getRepository(User).delete({ id: ada.id });
      expect(await skillsOf(ada.id)).toEqual([]);
      const [{ count }] = await dataSource.query<{ count: number }[]>(
        'SELECT count(*)::int AS count FROM learning_items WHERE user_id = $1',
        [ada.id],
      );
      expect(count).toBe(0);
    });
  });

  describe('isolation (CLAUDE.md, hard rules)', () => {
    it("never lets one user list, read, change or delete another user's item", async () => {
      const item = await createItem(ada, { title: 'NestJS Fundamentals', skills: ['NestJS'] });

      expect((await http.get('/learning').set('Cookie', grace.cookie).expect(200)).body).toEqual([]);

      // 404, not 403: Grace cannot even tell the item exists.
      await http.get(`/learning/${item.id}`).set('Cookie', grace.cookie).expect(404);
      await update(grace, item.id, { title: 'Hijacked' }).expect(404);
      await update(grace, item.id, { skills: ['Hijacked'] }).expect(404);
      await http.delete(`/learning/${item.id}`).set('Cookie', grace.cookie).expect(404);

      const mine = await http.get(`/learning/${item.id}`).set('Cookie', ada.cookie).expect(200);
      expect(mine.body).toMatchObject({ title: 'NestJS Fundamentals', skills: [{ name: 'NestJS' }] });
      // Grace's refused update created no skill for anyone.
      expect(await skillsOf(grace.id)).toEqual([]);
      expect(await skillsOf(ada.id)).toEqual([{ name: 'NestJS' }]);
    });

    it("never shares a skill between users, even with the same name", async () => {
      const adas = await createItem(ada, { title: 'NestJS Fundamentals', skills: ['TypeScript'] });
      const graces = await createItem(grace, { title: 'Effective TypeScript', kind: 'book', skills: ['typescript'] });

      expect(graces.skills).toEqual([{ id: expect.any(String), name: 'typescript' }]);
      expect(graces.skills[0].id).not.toBe(adas.skills[0].id);
      expect(await skillsOf(ada.id)).toEqual([{ name: 'TypeScript' }]);
      expect(await skillsOf(grace.id)).toEqual([{ name: 'typescript' }]);
      // Checked in the table too: the API's answer alone could hide a wrong link.
      await update(grace, graces.id, { skills: ['TypeScript', 'NestJS'] }).expect(200);
      expect(await crossUserLinks()).toBe(0);
    });

    it("keeps the admin out of other users' items too", async () => {
      const item = await createItem(ada, { title: 'NestJS Fundamentals' });
      await dataSource.getRepository(User).update({ id: grace.id }, { role: 'admin' });

      await http.get(`/learning/${item.id}`).set('Cookie', grace.cookie).expect(404);
      expect((await http.get('/learning').set('Cookie', grace.cookie).expect(200)).body).toEqual([]);
    });
  });
});
