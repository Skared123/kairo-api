import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { DataSource } from 'typeorm';
import { User } from '../src/users/user.entity.js';
import { createTestApp } from './create-test-app.js';
import { createTwoUsers, type SignedInUser } from './two-users.js';

interface ContactBody {
  id: string;
  name: string;
  jobs: { id: string; company: string; title: string; status: string }[];
}

describe('Contacts and jobs (e2e)', () => {
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

  async function createJob(user: SignedInUser, company: string, status?: string): Promise<string> {
    const res = await http
      .post('/jobs')
      .set('Cookie', user.cookie)
      .send({ company, title: 'Senior Fullstack Engineer', status })
      .expect(201);
    return res.body.id as string;
  }

  async function createContact(user: SignedInUser, fields: Record<string, unknown>): Promise<ContactBody> {
    return (await http.post('/contacts').set('Cookie', user.cookie).send(fields).expect(201)).body as ContactBody;
  }

  const getContact = async (user: SignedInUser, id: string) =>
    (await http.get(`/contacts/${id}`).set('Cookie', user.cookie).expect(200)).body as ContactBody;

  const link = (user: SignedInUser, contactId: string, jobId: string) =>
    http.put(`/contacts/${contactId}/jobs/${jobId}`).set('Cookie', user.cookie);

  const unlink = (user: SignedInUser, contactId: string, jobId: string) =>
    http.delete(`/contacts/${contactId}/jobs/${jobId}`).set('Cookie', user.cookie);

  const linkCount = async () =>
    (await dataSource.query<{ count: number }[]>('SELECT count(*)::int AS count FROM job_contacts'))[0].count;

  it('links a contact to jobs and unlinks it, twice changing nothing', async () => {
    const acme = await createJob(ada, 'Acme Robotics', 'interviewing');
    const globex = await createJob(ada, 'Globex');
    const contact = await createContact(ada, { name: 'Margaret Hamilton' });
    expect(contact.jobs).toEqual([]);

    await link(ada, contact.id, acme).expect(204);
    await link(ada, contact.id, acme).expect(204);
    await link(ada, contact.id, globex).expect(204);
    expect((await getContact(ada, contact.id)).jobs).toEqual([
      { id: acme, company: 'Acme Robotics', title: 'Senior Fullstack Engineer', status: 'interviewing' },
      { id: globex, company: 'Globex', title: 'Senior Fullstack Engineer', status: 'to_review' },
    ]);

    await unlink(ada, contact.id, acme).expect(204);
    await unlink(ada, contact.id, acme).expect(204);
    expect((await getContact(ada, contact.id)).jobs.map((job) => job.id)).toEqual([globex]);
  });

  it('answers 404 for a contact or a job that does not exist', async () => {
    const job = await createJob(ada, 'Acme Robotics');
    const contact = await createContact(ada, { name: 'Margaret Hamilton' });
    await link(ada, randomUUID(), job).expect(404);
    await link(ada, contact.id, randomUUID()).expect(404);
    await unlink(ada, contact.id, randomUUID()).expect(404);
    await link(ada, contact.id, 'nope').expect(400);
  });

  it('creates a contact already linked, and refuses a job that does not exist', async () => {
    const acme = await createJob(ada, 'Acme Robotics');
    const contact = await createContact(ada, { name: 'Margaret Hamilton', jobIds: [acme, acme] });
    expect(contact.jobs.map((job) => job.id)).toEqual([acme]);

    const res = await http
      .post('/contacts')
      .set('Cookie', ada.cookie)
      .send({ name: 'Nobody', jobIds: [acme, randomUUID()] })
      .expect(400);
    expect(res.body.error).toBe('job_not_found');
    // Nothing was saved: the contact and its links go together.
    const all = await http.get('/contacts').set('Cookie', ada.cookie).expect(200);
    expect(all.body.map((found: ContactBody) => found.name)).toEqual(['Margaret Hamilton']);
  });

  it("filters by job, each contact still showing all its jobs", async () => {
    const acme = await createJob(ada, 'Acme Robotics');
    const globex = await createJob(ada, 'Globex');
    const margaret = await createContact(ada, { name: 'Margaret Hamilton', jobIds: [acme] });
    const barbara = await createContact(ada, { name: 'Barbara Liskov', jobIds: [globex, acme] });
    await createContact(ada, { name: 'Dennis Ritchie' });

    const res = await http.get('/contacts').query({ jobId: acme }).set('Cookie', ada.cookie).expect(200);
    expect(res.body).toMatchObject([
      { id: barbara.id, jobs: [{ id: globex }, { id: acme }] },
      { id: margaret.id, jobs: [{ id: acme }] },
    ]);
    await http.get('/contacts?jobId=nope').set('Cookie', ada.cookie).expect(400);
  });

  it('removes only the link when either end is deleted (decision 036)', async () => {
    const acme = await createJob(ada, 'Acme Robotics');
    const globex = await createJob(ada, 'Globex');
    const margaret = await createContact(ada, { name: 'Margaret Hamilton', jobIds: [acme, globex] });

    await http.delete(`/jobs/${acme}`).set('Cookie', ada.cookie).expect(204);
    expect((await getContact(ada, margaret.id)).jobs.map((job) => job.id)).toEqual([globex]);

    await http.delete(`/contacts/${margaret.id}`).set('Cookie', ada.cookie).expect(204);
    await http.get(`/jobs/${globex}`).set('Cookie', ada.cookie).expect(200);
    expect(await linkCount()).toBe(0);
  });

  describe('isolation (CLAUDE.md, hard rules)', () => {
    it("never links or unlinks another user's contact or job, nor tells that they exist", async () => {
      const adasJob = await createJob(ada, 'Acme Robotics');
      const adasContact = await createContact(ada, { name: 'Margaret Hamilton', jobIds: [adasJob] });
      const gracesJob = await createJob(grace, 'Globex');
      const gracesContact = await createContact(grace, { name: 'Barbara Liskov' });

      // Ada's contact, with Grace's job or Ada's own: not found either way.
      const missing = await link(grace, gracesContact.id, randomUUID()).expect(404);
      await link(grace, adasContact.id, gracesJob).expect(404);
      await unlink(grace, adasContact.id, adasJob).expect(404);
      // Grace's contact with Ada's job: the same answer as a job that does not exist.
      const foreign = await link(grace, gracesContact.id, adasJob).expect(404);
      expect(foreign.body).toEqual(missing.body);

      const created = await http
        .post('/contacts')
        .set('Cookie', grace.cookie)
        .send({ name: 'Peek', jobIds: [adasJob] })
        .expect(400);
      expect(created.body.error).toBe('job_not_found');

      // Filtering by Ada's job shows Grace nothing.
      const filtered = await http.get('/contacts').query({ jobId: adasJob }).set('Cookie', grace.cookie).expect(200);
      expect(filtered.body).toEqual([]);

      // Ada's link is untouched, and Grace's contact has no job.
      expect((await getContact(ada, adasContact.id)).jobs.map((job) => job.id)).toEqual([adasJob]);
      expect((await getContact(grace, gracesContact.id)).jobs).toEqual([]);
    });

    it("keeps the admin out of other users' links too", async () => {
      const adasJob = await createJob(ada, 'Acme Robotics');
      const adasContact = await createContact(ada, { name: 'Margaret Hamilton', jobIds: [adasJob] });
      await dataSource.getRepository(User).update({ id: grace.id }, { role: 'admin' });

      await unlink(grace, adasContact.id, adasJob).expect(404);
      expect(await linkCount()).toBe(1);
    });
  });
});
