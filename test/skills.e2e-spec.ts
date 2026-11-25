import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { DataSource } from 'typeorm';
import { User } from '../src/users/user.entity.js';
import { createTestApp } from './create-test-app.js';
import { createTwoUsers, type SignedInUser } from './two-users.js';

interface SkillBody {
  id: string;
  name: string;
  itemCount: number;
}

describe('Skills (e2e)', () => {
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

  async function createItem(user: SignedInUser, title: string, skills: string[]): Promise<string> {
    const res = await http
      .post('/learning')
      .set('Cookie', user.cookie)
      .send({ title, kind: 'course', skills })
      .expect(201);
    return res.body.id as string;
  }

  const listSkills = async (user: SignedInUser) =>
    (await http.get('/skills').set('Cookie', user.cookie).expect(200)).body as SkillBody[];

  const skillId = async (user: SignedInUser, name: string) =>
    (await listSkills(user)).find((skill) => skill.name === name)!.id;

  const rename = (user: SignedInUser, id: string, name: string) =>
    http.patch(`/skills/${id}`).set('Cookie', user.cookie).send({ name });

  it('lists the skills by name, ignoring case, with how many items train each', async () => {
    expect(await listSkills(ada)).toEqual([]);
    await createItem(ada, 'NestJS Fundamentals', ['TypeScript', 'NestJS']);
    await createItem(ada, 'Effective TypeScript', ['typescript', 'algorithms']);
    const item = await createItem(ada, 'Docker basics', ['Docker']);
    // A skill no item trains any more stays, with zero.
    await http.patch(`/learning/${item}`).set('Cookie', ada.cookie).send({ skills: [] }).expect(200);

    expect(await listSkills(ada)).toEqual([
      { id: expect.any(String), name: 'algorithms', itemCount: 1 },
      { id: expect.any(String), name: 'Docker', itemCount: 0 },
      { id: expect.any(String), name: 'NestJS', itemCount: 1 },
      { id: expect.any(String), name: 'TypeScript', itemCount: 2 },
    ]);
  });

  it('renames a skill everywhere, a change of case included', async () => {
    const item = await createItem(ada, 'Algorithms course', ['algorithms']);
    const id = await skillId(ada, 'algorithms');

    const renamed = await rename(ada, id, '  Algorithms   and data structures ').expect(200);
    expect(renamed.body).toEqual({ id, name: 'Algorithms and data structures', itemCount: 1 });
    const read = await http.get(`/learning/${item}`).set('Cookie', ada.cookie).expect(200);
    expect(read.body.skills).toEqual([{ id, name: 'Algorithms and data structures' }]);

    // The same skill with other capitals is still a rename.
    await rename(ada, id, 'ALGORITHMS AND DATA STRUCTURES').expect(200);

    // And later items find it by its new name.
    await createItem(ada, 'Grokking Algorithms', ['algorithms and data structures']);
    expect(await listSkills(ada)).toEqual([{ id, name: 'ALGORITHMS AND DATA STRUCTURES', itemCount: 2 }]);
  });

  it('refuses a name another skill already has, without merging them', async () => {
    await createItem(ada, 'NestJS Fundamentals', ['TypeScript', 'NestJS']);
    const nest = await skillId(ada, 'NestJS');

    const res = await rename(ada, nest, ' typescript ').expect(409);
    expect(res.body.error).toBe('skill_exists');
    expect((await listSkills(ada)).map((skill) => skill.name)).toEqual(['NestJS', 'TypeScript']);

    await rename(ada, nest, '').expect(400);
    await rename(ada, nest, 'x'.repeat(51)).expect(400);
    await http.patch(`/skills/${nest}`).set('Cookie', ada.cookie).send({ name: 'Nest', key: 'nest' }).expect(400);
  });

  it('deletes a skill, keeping its items', async () => {
    const item = await createItem(ada, 'NestJS Fundamentals', ['TypeScript', 'NestJS']);
    const nest = await skillId(ada, 'NestJS');

    await http.delete(`/skills/${nest}`).set('Cookie', ada.cookie).expect(204);
    await http.delete(`/skills/${nest}`).set('Cookie', ada.cookie).expect(404);
    const read = await http.get(`/learning/${item}`).set('Cookie', ada.cookie).expect(200);
    expect(read.body.skills.map((skill: { name: string }) => skill.name)).toEqual(['TypeScript']);
  });

  it('answers 404 for a skill that does not exist', async () => {
    await rename(ada, randomUUID(), 'NestJS').expect(404);
    await http.delete(`/skills/${randomUUID()}`).set('Cookie', ada.cookie).expect(404);
    await rename(ada, 'nope', 'NestJS').expect(400);
  });

  describe('isolation (CLAUDE.md, hard rules)', () => {
    it("never lets one user list, rename or delete another user's skills", async () => {
      await createItem(ada, 'NestJS Fundamentals', ['NestJS']);
      const adas = await skillId(ada, 'NestJS');
      // Grace has her own NestJS, with its own count.
      await createItem(grace, 'NestJS for teams', ['nestjs']);
      await createItem(grace, 'NestJS testing', ['NestJS']);

      expect(await listSkills(grace)).toEqual([{ id: expect.any(String), name: 'nestjs', itemCount: 2 }]);
      await rename(grace, adas, 'Hijacked').expect(404);
      await http.delete(`/skills/${adas}`).set('Cookie', grace.cookie).expect(404);

      expect(await listSkills(ada)).toEqual([{ id: adas, name: 'NestJS', itemCount: 1 }]);
      // Renaming her own skill to a name only Ada has is no conflict.
      await createItem(ada, 'Docker basics', ['Docker']);
      await rename(grace, await skillId(grace, 'nestjs'), 'Docker').expect(200);
    });

    it("keeps the admin out of other users' skills too", async () => {
      await createItem(ada, 'NestJS Fundamentals', ['NestJS']);
      const adas = await skillId(ada, 'NestJS');
      await dataSource.getRepository(User).update({ id: grace.id }, { role: 'admin' });

      expect(await listSkills(grace)).toEqual([]);
      await http.delete(`/skills/${adas}`).set('Cookie', grace.cookie).expect(404);
    });
  });
});
