import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { DataSource } from 'typeorm';
import { User } from '../src/users/user.entity.js';
import { createTestApp } from './create-test-app.js';
import { createTwoUsers, type SignedInUser } from './two-users.js';

interface TaskBody {
  id: string;
  title: string;
  notes: string | null;
  dueOn: string | null;
  job: { id: string; company: string; title: string } | null;
  doneAt: string | null;
}

describe('Tasks (e2e)', () => {
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

  async function createJob(user: SignedInUser) {
    const res = await http
      .post('/jobs')
      .set('Cookie', user.cookie)
      .send({ company: 'Acme Robotics', title: 'Senior Fullstack Engineer' })
      .expect(201);
    return res.body as { id: string };
  }

  async function createTask(user: SignedInUser, fields: Record<string, unknown>): Promise<TaskBody> {
    const res = await http.post('/tasks').set('Cookie', user.cookie).send(fields).expect(201);
    return res.body as TaskBody;
  }

  const update = (user: SignedInUser, id: string, changes: Record<string, unknown>) =>
    http.patch(`/tasks/${id}`).set('Cookie', user.cookie).send(changes);

  describe('create and read', () => {
    it('creates an open task with only what the user wrote', async () => {
      const task = await createTask(ada, { title: ' Write a LinkedIn post ', notes: '' });
      expect(task).toMatchObject({ title: 'Write a LinkedIn post', notes: null, dueOn: null, job: null, doneAt: null });
      expect(task).not.toHaveProperty('userId');

      await http.get(`/tasks/${task.id}`).set('Cookie', ada.cookie).expect(200, task);
    });

    it("links a task to one of the user's jobs and shows the job", async () => {
      const job = await createJob(ada);
      const task = await createTask(ada, { title: 'Prepare the interview', dueOn: '2026-12-01', jobId: job.id });
      expect(task).toMatchObject({
        dueOn: '2026-12-01',
        job: { id: job.id, company: 'Acme Robotics', title: 'Senior Fullstack Engineer' },
      });
    });

    it('rejects invalid fields', async () => {
      const send = (fields: Record<string, unknown>) => http.post('/tasks').set('Cookie', ada.cookie).send(fields);
      await send({ notes: 'No title' }).expect(400);
      await send({ title: '  ' }).expect(400);
      await send({ title: 'Bad day', dueOn: '2026-13-01' }).expect(400);
      await send({ title: 'Bad job', jobId: 'not-a-uuid' }).expect(400);
      await send({ title: 'Already done', done: true }).expect(400);
      await send({ title: 'Owner', userId: grace.id }).expect(400);
    });

    it('answers 400 job_not_found for a job that does not exist', async () => {
      const res = await http
        .post('/tasks')
        .set('Cookie', ada.cookie)
        .send({ title: 'Prepare', jobId: randomUUID() })
        .expect(400);
      expect(res.body.error).toBe('job_not_found');
    });
  });

  describe('list', () => {
    it('lists open tasks by due day, those without one last, then the done ones; and filters by job', async () => {
      const job = await createJob(ada);
      const later = await createTask(ada, { title: 'Later', dueOn: '2026-12-10' });
      const noDay = await createTask(ada, { title: 'Whenever' });
      const done = await createTask(ada, { title: 'Done', dueOn: '2026-11-01' });
      await update(ada, done.id, { done: true }).expect(200);
      const soon = await createTask(ada, { title: 'Soon', dueOn: '2026-12-01', jobId: job.id });

      const all = await http.get('/tasks').set('Cookie', ada.cookie).expect(200);
      expect(all.body.map((task: TaskBody) => task.id)).toEqual([soon.id, later.id, noDay.id, done.id]);

      const forJob = await http.get('/tasks').query({ jobId: job.id }).set('Cookie', ada.cookie).expect(200);
      expect(forJob.body.map((task: TaskBody) => task.id)).toEqual([soon.id]);

      await http.get('/tasks?jobId=nope').set('Cookie', ada.cookie).expect(400);
    });
  });

  describe('update and delete', () => {
    it('updates fields, clears them, and links or unlinks a job', async () => {
      const job = await createJob(ada);
      const task = await createTask(ada, { title: 'Prepare', notes: 'Questions about the team', dueOn: '2026-12-01' });

      const linked = await update(ada, task.id, { title: 'Prepare the interview', jobId: job.id }).expect(200);
      expect(linked.body).toMatchObject({ title: 'Prepare the interview', job: { id: job.id } });

      const cleared = await update(ada, task.id, { notes: '', dueOn: null, jobId: null }).expect(200);
      expect(cleared.body).toMatchObject({ notes: null, dueOn: null, job: null });

      await update(ada, task.id, {}).expect(400);
      await update(ada, task.id, { jobId: randomUUID() }).expect(400);
    });

    it('marks a task done, keeps when it was first done, and opens it again', async () => {
      const task = await createTask(ada, { title: 'Send the CV' });

      const done = await update(ada, task.id, { done: true }).expect(200);
      expect(done.body.doneAt).toEqual(expect.any(String));

      const again = await update(ada, task.id, { done: true }).expect(200);
      expect(again.body.doneAt).toBe(done.body.doneAt);

      const reopened = await update(ada, task.id, { done: false }).expect(200);
      expect(reopened.body.doneAt).toBeNull();
    });

    it('deletes a task', async () => {
      const task = await createTask(ada, { title: 'Send the CV' });
      await http.delete(`/tasks/${task.id}`).set('Cookie', ada.cookie).expect(204);
      await http.get(`/tasks/${task.id}`).set('Cookie', ada.cookie).expect(404);
      await http.delete(`/tasks/${task.id}`).set('Cookie', ada.cookie).expect(404);
    });

    it('keeps the tasks of a deleted job, unlinked (decision 033)', async () => {
      const job = await createJob(ada);
      const task = await createTask(ada, { title: 'Prepare the interview', jobId: job.id });
      await http.delete(`/jobs/${job.id}`).set('Cookie', ada.cookie).expect(204);

      const res = await http.get(`/tasks/${task.id}`).set('Cookie', ada.cookie).expect(200);
      expect(res.body).toMatchObject({ title: 'Prepare the interview', job: null });
    });

    it("deletes a user's tasks with the user", async () => {
      await createTask(ada, { title: 'Send the CV' });
      await dataSource.getRepository(User).delete({ id: ada.id });
      const [{ count }] = await dataSource.query<{ count: number }[]>(
        'SELECT count(*)::int AS count FROM tasks WHERE user_id = $1',
        [ada.id],
      );
      expect(count).toBe(0);
    });
  });

  describe('isolation (CLAUDE.md, hard rules)', () => {
    it("never lets one user list, read, change or delete another user's task", async () => {
      const task = await createTask(ada, { title: 'Prepare the interview' });

      expect((await http.get('/tasks').set('Cookie', grace.cookie).expect(200)).body).toEqual([]);

      // 404, not 403: Grace cannot even tell the task exists.
      await http.get(`/tasks/${task.id}`).set('Cookie', grace.cookie).expect(404);
      await update(grace, task.id, { title: 'Hijacked' }).expect(404);
      await update(grace, task.id, { done: true }).expect(404);
      await http.delete(`/tasks/${task.id}`).set('Cookie', grace.cookie).expect(404);

      const mine = await http.get(`/tasks/${task.id}`).set('Cookie', ada.cookie).expect(200);
      expect(mine.body).toMatchObject({ title: 'Prepare the interview', doneAt: null });
    });

    it("never lets a task point to another user's job, nor tells that the job exists", async () => {
      const adasJob = await createJob(ada);
      const missing = await http
        .post('/tasks')
        .set('Cookie', grace.cookie)
        .send({ title: 'Peek', jobId: randomUUID() })
        .expect(400);

      // The same answer as for a job that does not exist.
      const foreign = await http
        .post('/tasks')
        .set('Cookie', grace.cookie)
        .send({ title: 'Peek', jobId: adasJob.id })
        .expect(400);
      expect(foreign.body).toEqual(missing.body);

      const gracesTask = await createTask(grace, { title: 'Peek' });
      const linked = await update(grace, gracesTask.id, { jobId: adasJob.id }).expect(400);
      expect(linked.body).toEqual(missing.body);

      // Filtering by Ada's job shows Grace nothing.
      await createTask(ada, { title: 'Prepare the interview', jobId: adasJob.id });
      const filtered = await http.get('/tasks').query({ jobId: adasJob.id }).set('Cookie', grace.cookie).expect(200);
      expect(filtered.body).toEqual([]);
    });

    it("keeps the admin out of other users' tasks too", async () => {
      const task = await createTask(ada, { title: 'Prepare the interview' });
      await dataSource.getRepository(User).update({ id: grace.id }, { role: 'admin' });

      await http.get(`/tasks/${task.id}`).set('Cookie', grace.cookie).expect(404);
      expect((await http.get('/tasks').set('Cookie', grace.cookie).expect(200)).body).toEqual([]);
    });
  });
});
