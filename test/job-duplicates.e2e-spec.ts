import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { createTestApp } from './create-test-app.js';
import { createTwoUsers, type SignedInUser } from './two-users.js';

interface Created {
  id: string;
  possibleDuplicates: { id: string; company: string; title: string; url: string | null; status: string }[];
}

const posting = {
  company: 'Acme Robotics',
  title: 'Senior Fullstack Engineer',
  url: 'https://jobs.example.com/acme/123',
};

/** Duplicate detection (decision 031): POST /jobs answers the user's jobs that may be the same posting. */
describe('Job duplicates (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let ada: SignedInUser;
  let grace: SignedInUser;

  beforeEach(async () => {
    ({ app } = await createTestApp());
    http = request(app.getHttpServer());
    ({ ada, grace } = await createTwoUsers(app));
  });

  afterEach(async () => {
    await app.close();
  });

  async function createJob(user: SignedInUser, fields: Record<string, unknown>): Promise<Created> {
    const res = await http.post('/jobs').set('Cookie', user.cookie).send(fields).expect(201);
    return res.body as Created;
  }

  const duplicateIds = (job: Created) => job.possibleDuplicates.map((duplicate) => duplicate.id);

  it('finds nothing for the first job', async () => {
    expect((await createJob(ada, posting)).possibleDuplicates).toEqual([]);
  });

  it('finds a job with the same URL', async () => {
    const first = await createJob(ada, posting);
    const second = await createJob(ada, { company: 'Totally Different', title: 'Designer', url: posting.url });
    expect(second.possibleDuplicates).toEqual([
      { id: first.id, company: posting.company, title: posting.title, url: posting.url, status: 'to_review' },
    ]);

    // Two jobs without a URL never match on it.
    await createJob(ada, { company: 'Initech', title: 'Designer' });
    expect((await createJob(ada, { company: 'Globex', title: 'Analyst' })).possibleDuplicates).toEqual([]);
  });

  it('finds a job whose company and title are written differently but are the same posting', async () => {
    const first = await createJob(ada, { company: 'Acme Robotics', title: 'Senior Fullstack Engineer' });
    const second = await createJob(ada, { company: 'ACME Robotics Inc.', title: 'Senior Full-Stack Engineer' });
    expect(duplicateIds(second)).toEqual([first.id]);

    const third = await createJob(ada, { company: 'acme', title: 'Fullstack Engineer (Senior)' });
    expect(duplicateIds(third)).toEqual(expect.arrayContaining([first.id, second.id]));
  });

  it('does not flag a different role at the same company', async () => {
    await createJob(ada, { company: 'Acme Robotics', title: 'Senior Fullstack Engineer' });
    const backend = await createJob(ada, { company: 'Acme Robotics', title: 'Senior Backend Engineer' });
    expect(backend.possibleDuplicates).toEqual([]);

    // Nor the same role at another company.
    const elsewhere = await createJob(ada, { company: 'Globex', title: 'Senior Fullstack Engineer' });
    expect(elsewhere.possibleDuplicates).toEqual([]);
  });

  it('does not list the new job among its own duplicates', async () => {
    const first = await createJob(ada, posting);
    const second = await createJob(ada, posting);
    expect(duplicateIds(second)).toEqual([first.id]);
  });

  it('returns the closest matches first, and only a few', async () => {
    const sameUrl = await createJob(ada, { company: 'Initech', title: 'Designer', url: posting.url });
    const sameText = await createJob(ada, { company: posting.company, title: posting.title });
    const similar = await createJob(ada, { company: 'ACME Robotics Inc.', title: 'Senior Full-Stack Engineer' });
    for (let i = 0; i < 4; i++) {
      await createJob(ada, { company: 'Acme', title: 'Fullstack Engineer' });
    }

    const created = await createJob(ada, posting);
    expect(created.possibleDuplicates).toHaveLength(5);
    expect(duplicateIds(created).slice(0, 3)).toEqual([sameUrl.id, sameText.id, similar.id]);
  });

  it('still creates the job: a duplicate warns, never blocks', async () => {
    await createJob(ada, posting);
    const again = await createJob(ada, posting);
    expect(again.possibleDuplicates).toHaveLength(1);

    await http.get(`/jobs/${again.id}`).set('Cookie', ada.cookie).expect(200);
    const list = await http.get('/jobs').set('Cookie', ada.cookie).expect(200);
    expect(list.body).toHaveLength(2);
  });

  it("never lists another user's jobs (createTwoUsers)", async () => {
    const adas = await createJob(ada, posting);

    // The same posting, URL and all: Grace's answer must not reveal that Ada saved it.
    expect((await createJob(grace, posting)).possibleDuplicates).toEqual([]);

    // And Ada only sees her own.
    expect(duplicateIds(await createJob(ada, posting))).toEqual([adas.id]);
  });
});
