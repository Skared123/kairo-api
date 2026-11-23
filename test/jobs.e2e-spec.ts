import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { DataSource } from 'typeorm';
import { User } from '../src/users/user.entity.js';
import { createTestApp } from './create-test-app.js';
import { createTwoUsers, type SignedInUser } from './two-users.js';

const posting = {
  company: 'Acme Robotics',
  title: 'Senior Fullstack Engineer',
  url: 'https://jobs.example.com/acme/123',
  source: 'linkedin',
  workMode: 'remote',
  contractType: 'contractor',
  salaryMin: 4000,
  salaryMax: 6000,
  salaryCurrency: 'usd',
  salaryPeriod: 'month',
};

describe('Jobs (e2e)', () => {
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

  async function createJob(user: SignedInUser, fields: Record<string, unknown> = posting) {
    const res = await http.post('/jobs').set('Cookie', user.cookie).send(fields).expect(201);
    return res.body as { id: string } & Record<string, unknown>;
  }

  describe('create and read', () => {
    it('creates a job in "to_review" with only what the user wrote', async () => {
      const job = await createJob(ada, { company: ' Acme ', title: 'Engineer', notes: '' });
      expect(job).toMatchObject({
        company: 'Acme',
        title: 'Engineer',
        url: null,
        notes: null,
        status: 'to_review',
      });
      expect(job).not.toHaveProperty('userId');

      await http.get(`/jobs/${job.id}`).set('Cookie', ada.cookie).expect(200, job);
    });

    it('normalizes the salary currency and keeps the whole posting', async () => {
      const job = await createJob(ada);
      expect(job).toMatchObject({ ...posting, salaryCurrency: 'USD' });
    });

    it('can start in another stage', async () => {
      const job = await createJob(ada, { company: 'Acme', title: 'Engineer', status: 'applied' });
      expect(job.status).toBe('applied');
    });

    it('rejects invalid fields', async () => {
      const send = (fields: Record<string, unknown>) => http.post('/jobs').set('Cookie', ada.cookie).send(fields);
      await send({ title: 'No company' }).expect(400);
      await send({ ...posting, url: 'ftp://example.com/job' }).expect(400);
      await send({ ...posting, salaryCurrency: 'dollars' }).expect(400);
      await send({ ...posting, status: 'hired' }).expect(400);
      await send({ ...posting, userId: grace.id }).expect(400);
    });

    it('needs a currency and a period with a salary, and an ordered range', async () => {
      const send = (fields: Record<string, unknown>) =>
        http.post('/jobs').set('Cookie', ada.cookie).send({ company: 'Acme', title: 'Engineer', ...fields });
      await send({ salaryMin: 1000 }).expect(400);
      await send({ salaryMin: 1000, salaryCurrency: 'MXN' }).expect(400);
      await send({ salaryMin: 9000, salaryMax: 5000, salaryCurrency: 'MXN', salaryPeriod: 'month' }).expect(400);
      await send({ salaryMin: 5000, salaryCurrency: 'MXN', salaryPeriod: 'month' }).expect(201);
    });
  });

  describe('list', () => {
    it('lists the newest change first, filtered by stage and searched by company or title', async () => {
      const first = await createJob(ada, { company: 'Acme', title: 'Backend Engineer' });
      const second = await createJob(ada, { company: 'Globex', title: 'Fullstack Developer', status: 'applied' });
      await createJob(ada, { company: 'Initech', title: 'Frontend 100% Remote' });

      const all = await http.get('/jobs').set('Cookie', ada.cookie).expect(200);
      expect(all.body.map((job: { company: string }) => job.company)).toEqual(['Initech', 'Globex', 'Acme']);

      const applied = await http.get('/jobs?status=applied').set('Cookie', ada.cookie).expect(200);
      expect(applied.body.map((job: { id: string }) => job.id)).toEqual([second.id]);

      const search = await http.get('/jobs?q=BACKEND').set('Cookie', ada.cookie).expect(200);
      expect(search.body.map((job: { id: string }) => job.id)).toEqual([first.id]);

      // The search text is literal: "100%" matches only the title that contains it.
      const literal = await http.get('/jobs').query({ q: '100%' }).set('Cookie', ada.cookie).expect(200);
      expect(literal.body.map((job: { company: string }) => job.company)).toEqual(['Initech']);

      await http.get('/jobs?status=hired').set('Cookie', ada.cookie).expect(400);
    });
  });

  describe('update and delete', () => {
    it('updates fields, clears them with null, and checks the salary on the merged job', async () => {
      const job = await createJob(ada);

      const res = await http
        .patch(`/jobs/${job.id}`)
        .set('Cookie', ada.cookie)
        .send({ title: 'Staff Engineer', url: null, notes: 'Referred by a former colleague' })
        .expect(200);
      expect(res.body).toMatchObject({ title: 'Staff Engineer', url: null, notes: 'Referred by a former colleague' });

      // Removing the currency would leave the amounts without one.
      await http.patch(`/jobs/${job.id}`).set('Cookie', ada.cookie).send({ salaryCurrency: null }).expect(400);
      await http.patch(`/jobs/${job.id}`).set('Cookie', ada.cookie).send({ salaryMin: 7000 }).expect(400);
    });

    it('leaves the status to its own endpoint and refuses an empty change', async () => {
      const job = await createJob(ada);
      await http.patch(`/jobs/${job.id}`).set('Cookie', ada.cookie).send({ status: 'offer' }).expect(400);
      await http.patch(`/jobs/${job.id}`).set('Cookie', ada.cookie).send({}).expect(400);
    });

    it('deletes a job', async () => {
      const job = await createJob(ada);
      await http.delete(`/jobs/${job.id}`).set('Cookie', ada.cookie).expect(204);
      await http.get(`/jobs/${job.id}`).set('Cookie', ada.cookie).expect(404);
      await http.delete(`/jobs/${job.id}`).set('Cookie', ada.cookie).expect(404);
    });

    it("deletes a user's jobs with the user", async () => {
      await createJob(ada);
      await dataSource.getRepository(User).delete({ id: ada.id });
      const [{ count }] = await dataSource.query<{ count: number }[]>(
        'SELECT count(*)::int AS count FROM jobs WHERE user_id = $1',
        [ada.id],
      );
      expect(count).toBe(0);
    });
  });

  describe("isolation (CLAUDE.md, hard rules)", () => {
    it("never lets one user list, read, change or delete another user's job", async () => {
      const job = await createJob(ada);

      const list = await http.get('/jobs').set('Cookie', grace.cookie).expect(200);
      expect(list.body).toEqual([]);
      const search = await http.get('/jobs?q=Acme').set('Cookie', grace.cookie).expect(200);
      expect(search.body).toEqual([]);

      // 404, not 403: Grace cannot even tell the job exists.
      await http.get(`/jobs/${job.id}`).set('Cookie', grace.cookie).expect(404);
      await http.patch(`/jobs/${job.id}`).set('Cookie', grace.cookie).send({ title: 'Hijacked' }).expect(404);
      await http.delete(`/jobs/${job.id}`).set('Cookie', grace.cookie).expect(404);

      // Ada's job is untouched.
      const mine = await http.get(`/jobs/${job.id}`).set('Cookie', ada.cookie).expect(200);
      expect(mine.body.title).toBe(posting.title);
    });

    it('keeps the admin out of other users\' jobs too', async () => {
      const job = await createJob(ada);
      await dataSource.getRepository(User).update({ id: grace.id }, { role: 'admin' });

      await http.get(`/jobs/${job.id}`).set('Cookie', grace.cookie).expect(404);
      expect((await http.get('/jobs').set('Cookie', grace.cookie).expect(200)).body).toEqual([]);
    });
  });
});
