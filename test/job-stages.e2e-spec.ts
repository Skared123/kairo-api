import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { DataSource } from 'typeorm';
import { createTestApp } from './create-test-app.js';
import { createTwoUsers, type SignedInUser } from './two-users.js';

type StageChange = { fromStatus: string | null; toStatus: string; changedAt: string };

/** Decision 028: stages move through one endpoint, and every move is kept. */
describe('Job stages (e2e)', () => {
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

  async function createJob(fields: Record<string, unknown> = {}): Promise<string> {
    const res = await http
      .post('/jobs')
      .set('Cookie', ada.cookie)
      .send({ company: 'Acme', title: 'Engineer', ...fields })
      .expect(201);
    return res.body.id;
  }

  const moveTo = (id: string, status: string, user = ada) =>
    http.post(`/jobs/${id}/status`).set('Cookie', user.cookie).send({ status });

  async function history(id: string): Promise<Pick<StageChange, 'fromStatus' | 'toStatus'>[]> {
    const res = await http.get(`/jobs/${id}/history`).set('Cookie', ada.cookie).expect(200);
    return (res.body as StageChange[]).map(({ fromStatus, toStatus }) => ({ fromStatus, toStatus }));
  }

  it('records the first stage when the job is created', async () => {
    const id = await createJob();
    expect(await history(id)).toEqual([{ fromStatus: null, toStatus: 'to_review' }]);

    const applied = await createJob({ status: 'applied' });
    expect(await history(applied)).toEqual([{ fromStatus: null, toStatus: 'applied' }]);
  });

  it('moves a job between any stages and keeps every move in order', async () => {
    const id = await createJob();
    const res = await moveTo(id, 'applied').expect(200);
    expect(res.body.status).toBe('applied');
    await moveTo(id, 'interviewing').expect(200);
    await moveTo(id, 'rejected').expect(200);
    // Back again: a company can reopen a process.
    await moveTo(id, 'interviewing').expect(200);

    expect(await history(id)).toEqual([
      { fromStatus: null, toStatus: 'to_review' },
      { fromStatus: 'to_review', toStatus: 'applied' },
      { fromStatus: 'applied', toStatus: 'interviewing' },
      { fromStatus: 'interviewing', toStatus: 'rejected' },
      { fromStatus: 'rejected', toStatus: 'interviewing' },
    ]);
    const job = await http.get(`/jobs/${id}`).set('Cookie', ada.cookie).expect(200);
    expect(job.body.status).toBe('interviewing');
  });

  it('records nothing when the job is already in that stage', async () => {
    const id = await createJob();
    await moveTo(id, 'to_review').expect(200);
    expect(await history(id)).toHaveLength(1);
  });

  it('records the right "from" stage when two moves race', async () => {
    const id = await createJob();
    await Promise.all([moveTo(id, 'applied'), moveTo(id, 'discarded')]);

    // Whatever the order, each move starts where the previous one left the job.
    const moves = await history(id);
    expect(moves).toHaveLength(3);
    expect(moves[2].fromStatus).toBe(moves[1].toStatus);
  });

  it('refuses an unknown stage', async () => {
    const id = await createJob();
    await moveTo(id, 'hired').expect(400);
    await http.post(`/jobs/${id}/status`).set('Cookie', ada.cookie).send({}).expect(400);
  });

  it("deletes a job's history with the job", async () => {
    const id = await createJob();
    await moveTo(id, 'applied').expect(200);
    await http.delete(`/jobs/${id}`).set('Cookie', ada.cookie).expect(204);

    const [{ count }] = await dataSource.query<{ count: number }[]>(
      'SELECT count(*)::int AS count FROM job_stage_changes WHERE job_id = $1',
      [id],
    );
    expect(count).toBe(0);
  });

  it("never lets one user move or read the history of another user's job", async () => {
    const id = await createJob();

    await moveTo(id, 'discarded', grace).expect(404);
    await http.get(`/jobs/${id}/history`).set('Cookie', grace.cookie).expect(404);

    // Nothing changed for Ada.
    expect(await history(id)).toEqual([{ fromStatus: null, toStatus: 'to_review' }]);
  });
});
