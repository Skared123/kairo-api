import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { DataSource } from 'typeorm';
import { User } from '../src/users/user.entity.js';
import { createTestApp } from './create-test-app.js';
import { createTwoUsers, type SignedInUser } from './two-users.js';

interface TodayBody {
  tasks: { id: string; title: string; doneAt: string | null }[];
  followUps: { job: { id: string; company: string; title: string; status: string }; on: string; note: string | null }[];
  contactFollowUps: {
    contact: { id: string; name: string; company: string | null };
    on: string;
    note: string | null;
  }[];
  focus: {
    id: string;
    title: string;
    kind: string;
    url: string | null;
    status: string;
    skills: { name: string }[];
  } | null;
}

describe('Today (e2e)', () => {
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

  async function today(user: SignedInUser): Promise<TodayBody> {
    return (await http.get('/today').set('Cookie', user.cookie).expect(200)).body as TodayBody;
  }

  async function createJob(user: SignedInUser, fields: Record<string, unknown>): Promise<string> {
    const res = await http
      .post('/jobs')
      .set('Cookie', user.cookie)
      .send({ title: 'Engineer', ...fields })
      .expect(201);
    return res.body.id as string;
  }

  async function createContact(user: SignedInUser, fields: Record<string, unknown>): Promise<string> {
    return (await http.post('/contacts').set('Cookie', user.cookie).send(fields).expect(201)).body.id as string;
  }

  async function createItem(user: SignedInUser, fields: Record<string, unknown>): Promise<string> {
    const res = await http
      .post('/learning')
      .set('Cookie', user.cookie)
      .send({ kind: 'course', ...fields })
      .expect(201);
    return res.body.id as string;
  }

  async function createTask(user: SignedInUser, fields: Record<string, unknown>): Promise<string> {
    return (await http.post('/tasks').set('Cookie', user.cookie).send(fields).expect(201)).body.id as string;
  }

  /** Marks the task done that long ago, standing in for the clock. */
  async function doneAgo(id: string, interval: string): Promise<void> {
    await dataSource.query(`UPDATE tasks SET done_at = now() - $2::interval WHERE id = $1`, [id, interval]);
  }

  it('is empty for a new account', async () => {
    expect(await today(ada)).toEqual({ tasks: [], followUps: [], contactFollowUps: [], focus: null });
  });

  it('lists open tasks with or without a day, and those done in the last 48 hours', async () => {
    const someday = await createTask(ada, { title: 'Whenever' });
    const overdue = await createTask(ada, { title: 'Overdue', dueOn: '2020-01-01' });
    const future = await createTask(ada, { title: 'Next year', dueOn: '2099-01-01' });
    const doneToday = await createTask(ada, { title: 'Done a moment ago' });
    await http.patch(`/tasks/${doneToday}`).set('Cookie', ada.cookie).send({ done: true }).expect(200);
    const doneYesterday = await createTask(ada, { title: 'Done yesterday' });
    await doneAgo(doneYesterday, '30 hours');
    const doneLastWeek = await createTask(ada, { title: 'Done last week' });
    await doneAgo(doneLastWeek, '3 days');

    // Not filtered by day: the browser decides what "today" is (decision 035).
    const { tasks } = await today(ada);
    expect(tasks.map((task) => task.id)).toEqual([overdue, future, someday, doneToday, doneYesterday]);
  });

  it('lists the follow-ups of jobs in an open stage, soonest first, with their note', async () => {
    const later = await createJob(ada, { company: 'Globex', nextFollowUpOn: '2026-12-20' });
    const sooner = await createJob(ada, {
      company: 'Acme',
      status: 'interviewing',
      nextFollowUpOn: '2026-12-01',
      nextFollowUpNote: 'Ask about the second round',
    });
    await createJob(ada, { company: 'Initech' });

    const { followUps } = await today(ada);
    expect(followUps).toEqual([
      {
        job: { id: sooner, company: 'Acme', title: 'Engineer', status: 'interviewing' },
        on: '2026-12-01',
        note: 'Ask about the second round',
      },
      { job: { id: later, company: 'Globex', title: 'Engineer', status: 'to_review' }, on: '2026-12-20', note: null },
    ]);
  });

  it('leaves out the jobs in a closed stage (decision 034)', async () => {
    for (const status of ['accepted', 'rejected', 'discarded']) {
      await createJob(ada, { company: `Closed ${status}`, status, nextFollowUpOn: '2026-12-01' });
    }
    const open = await createJob(ada, { company: 'Acme', status: 'offer', nextFollowUpOn: '2026-12-01' });

    const { followUps } = await today(ada);
    expect(followUps.map((followUp) => followUp.job.id)).toEqual([open]);

    // Closing it takes it out of Today.
    await http.post(`/jobs/${open}/status`).set('Cookie', ada.cookie).send({ status: 'rejected' }).expect(200);
    expect((await today(ada)).followUps).toEqual([]);
  });

  it('lists the contacts to write to again, soonest first, with their note (decision 037)', async () => {
    const later = await createContact(ada, { name: 'Barbara Liskov', nextFollowUpOn: '2026-12-20' });
    const sooner = await createContact(ada, {
      name: 'Margaret Hamilton',
      company: 'Acme Robotics',
      nextFollowUpOn: '2026-12-01',
      nextFollowUpNote: 'Send the portfolio',
    });
    await createContact(ada, { name: 'Dennis Ritchie' });

    const { contactFollowUps } = await today(ada);
    expect(contactFollowUps).toEqual([
      {
        contact: { id: sooner, name: 'Margaret Hamilton', company: 'Acme Robotics' },
        on: '2026-12-01',
        note: 'Send the portfolio',
      },
      { contact: { id: later, name: 'Barbara Liskov', company: null }, on: '2026-12-20', note: null },
    ]);

    // Done, as Today sends it: the contact leaves Today.
    await http
      .patch(`/contacts/${sooner}`)
      .set('Cookie', ada.cookie)
      .send({ nextFollowUpOn: null, nextFollowUpNote: null })
      .expect(200);
    expect((await today(ada)).contactFollowUps.map((followUp) => followUp.contact.id)).toEqual([later]);
  });

  it('shows the study item marked as focus, with its skills, and nothing once it is done (decision 042)', async () => {
    await createItem(ada, { title: 'Effective TypeScript', kind: 'book' });
    expect((await today(ada)).focus).toBeNull();

    const focus = await createItem(ada, {
      title: 'NestJS Fundamentals',
      url: 'https://example.com/nestjs',
      status: 'in_progress',
      skills: ['TypeScript', 'NestJS'],
      isFocus: true,
    });
    expect((await today(ada)).focus).toEqual({
      id: focus,
      title: 'NestJS Fundamentals',
      kind: 'course',
      url: 'https://example.com/nestjs',
      status: 'in_progress',
      skills: [
        { id: expect.any(String), name: 'NestJS' },
        { id: expect.any(String), name: 'TypeScript' },
      ],
    });

    await http.patch(`/learning/${focus}`).set('Cookie', ada.cookie).send({ status: 'done' }).expect(200);
    expect((await today(ada)).focus).toBeNull();
  });

  describe('isolation (CLAUDE.md, hard rules)', () => {
    it("never shows another user's tasks or follow-ups", async () => {
      await createTask(ada, { title: 'Prepare the interview', dueOn: '2026-12-01' });
      await createJob(ada, { company: 'Acme', nextFollowUpOn: '2026-12-01' });
      await createContact(ada, { name: 'Margaret Hamilton', nextFollowUpOn: '2026-12-01' });
      await createItem(ada, { title: 'NestJS Fundamentals', isFocus: true });

      expect(await today(grace)).toEqual({ tasks: [], followUps: [], contactFollowUps: [], focus: null });
      expect(await today(ada)).toMatchObject({ tasks: [{}], followUps: [{}], contactFollowUps: [{}], focus: {} });
    });

    it("keeps the admin out of other users' Today too", async () => {
      await createTask(ada, { title: 'Prepare the interview' });
      await createJob(ada, { company: 'Acme', nextFollowUpOn: '2026-12-01' });
      await createContact(ada, { name: 'Margaret Hamilton', nextFollowUpOn: '2026-12-01' });
      await createItem(ada, { title: 'NestJS Fundamentals', isFocus: true });
      await dataSource.getRepository(User).update({ id: grace.id }, { role: 'admin' });

      expect(await today(grace)).toEqual({ tasks: [], followUps: [], contactFollowUps: [], focus: null });
    });
  });
});
