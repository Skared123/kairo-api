import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { DataSource } from 'typeorm';
import { User } from '../src/users/user.entity.js';
import { createTestApp } from './create-test-app.js';
import { createTwoUsers, type SignedInUser } from './two-users.js';

const remoteContract = {
  company: 'Acme',
  title: 'Senior Fullstack Engineer',
  workMode: 'remote',
  contractType: 'contractor',
  salaryMin: 4000,
  salaryMax: 6000,
  salaryCurrency: 'USD',
  salaryPeriod: 'month',
};

const target = { minSalary: 5000, currency: 'usd', period: 'month', remoteOnly: true, contractTypes: ['contractor'] };

describe('Follow-ups and criteria (e2e)', () => {
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

  async function createJob(fields: Record<string, unknown>, user = ada) {
    const res = await http.post('/jobs').set('Cookie', user.cookie).send(fields).expect(201);
    return res.body as { id: string } & Record<string, unknown>;
  }

  const saveCriteria = (body: Record<string, unknown>, user = ada) =>
    http.put('/criteria').set('Cookie', user.cookie).send(body);

  describe('next follow-up', () => {
    it('keeps a calendar day and a note, and clears them', async () => {
      const job = await createJob({
        company: 'Acme',
        title: 'Engineer',
        nextFollowUpOn: '2026-12-01',
        nextFollowUpNote: 'Write to the recruiter',
      });
      expect(job).toMatchObject({ nextFollowUpOn: '2026-12-01', nextFollowUpNote: 'Write to the recruiter' });

      const cleared = await http
        .patch(`/jobs/${job.id}`)
        .set('Cookie', ada.cookie)
        .send({ nextFollowUpOn: null, nextFollowUpNote: '' })
        .expect(200);
      expect(cleared.body).toMatchObject({ nextFollowUpOn: null, nextFollowUpNote: null });
    });

    it('accepts only a real calendar day', async () => {
      for (const nextFollowUpOn of ['2026-02-30', '01/12/2026', '2026-12-01T10:00:00Z']) {
        await http
          .post('/jobs')
          .set('Cookie', ada.cookie)
          .send({ company: 'Acme', title: 'Engineer', nextFollowUpOn })
          .expect(400);
      }
    });

    it('sorts by the soonest follow-up, jobs without one last', async () => {
      await createJob({ company: 'None', title: 'Engineer' });
      await createJob({ company: 'Later', title: 'Engineer', nextFollowUpOn: '2026-12-20' });
      await createJob({ company: 'Sooner', title: 'Engineer', nextFollowUpOn: '2026-12-02' });

      const res = await http.get('/jobs?sort=followUp').set('Cookie', ada.cookie).expect(200);
      expect(res.body.map((job: { company: string }) => job.company)).toEqual(['Sooner', 'Later', 'None']);
      await http.get('/jobs?sort=salary').set('Cookie', ada.cookie).expect(400);
    });
  });

  describe('criteria', () => {
    it('starts empty and saves the whole set', async () => {
      const empty = await http.get('/criteria').set('Cookie', ada.cookie).expect(200);
      expect(empty.body).toEqual({
        minSalary: null,
        currency: null,
        period: null,
        remoteOnly: false,
        contractTypes: [],
      });

      const saved = await saveCriteria(target).expect(200);
      expect(saved.body).toEqual({ ...target, currency: 'USD' });
      await http.get('/criteria').set('Cookie', ada.cookie).expect(200, saved.body);

      // A second save replaces the first.
      const replaced = await saveCriteria({ ...target, minSalary: null, currency: null, period: null }).expect(200);
      expect(replaced.body).toMatchObject({ minSalary: null, remoteOnly: true });
    });

    it('needs the salary target, currency and period together', async () => {
      await saveCriteria({ ...target, currency: null }).expect(400);
      await saveCriteria({ ...target, period: null }).expect(400);
      await saveCriteria({ ...target, minSalary: null }).expect(400);
      await saveCriteria({ ...target, contractTypes: ['contractor', 'contractor'] }).expect(400);
      await saveCriteria({ remoteOnly: true }).expect(400);
    });
  });

  describe('match', () => {
    it('compares nothing until the user sets criteria', async () => {
      const job = await createJob(remoteContract);
      expect(job.criteria).toEqual({ salary: null, remote: null, contract: null });
    });

    it('shows how each job compares, and follows a change of criteria', async () => {
      await saveCriteria(target).expect(200);
      const fits = await createJob(remoteContract);
      const pesos = await createJob({
        ...remoteContract,
        salaryCurrency: 'MXN',
        salaryMax: 90_000,
        workMode: 'hybrid',
      });
      const vague = await createJob({ company: 'Globex', title: 'Engineer' });

      const list = await http.get('/jobs').set('Cookie', ada.cookie).expect(200);
      const byId = Object.fromEntries(
        list.body.map((job: { id: string; criteria: unknown }) => [job.id, job.criteria]),
      );
      expect(byId[fits.id]).toEqual({ salary: 'meets', remote: 'meets', contract: 'meets' });
      expect(byId[pesos.id]).toEqual({ salary: 'not_comparable', remote: 'misses', contract: 'meets' });
      expect(byId[vague.id]).toEqual({ salary: 'unknown', remote: 'unknown', contract: 'unknown' });

      await saveCriteria({ ...target, minSalary: 7000 }).expect(200);
      const after = await http.get(`/jobs/${fits.id}`).set('Cookie', ada.cookie).expect(200);
      expect(after.body.criteria.salary).toBe('misses');
    });
  });

  describe('isolation (CLAUDE.md, hard rules)', () => {
    it("keeps each user's criteria their own, and compares jobs with their owner's", async () => {
      await saveCriteria(target).expect(200);

      const theirs = await http.get('/criteria').set('Cookie', grace.cookie).expect(200);
      expect(theirs.body).toEqual({
        minSalary: null,
        currency: null,
        period: null,
        remoteOnly: false,
        contractTypes: [],
      });

      // Grace's job is compared with Grace's (empty) criteria, never with Ada's.
      const job = await createJob(remoteContract, grace);
      expect(job.criteria).toEqual({ salary: null, remote: null, contract: null });

      // Grace's save never touches Ada's criteria.
      await saveCriteria({ ...target, minSalary: 1 }, grace).expect(200);
      const mine = await http.get('/criteria').set('Cookie', ada.cookie).expect(200);
      expect(mine.body.minSalary).toBe(5000);
    });

    it("deletes a user's criteria with the user", async () => {
      await saveCriteria(target).expect(200);
      await dataSource.getRepository(User).delete({ id: ada.id });
      const [{ count }] = await dataSource.query<{ count: number }[]>(
        'SELECT count(*)::int AS count FROM job_criteria WHERE user_id = $1',
        [ada.id],
      );
      expect(count).toBe(0);
    });
  });
});
