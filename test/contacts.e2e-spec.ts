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
  company: string | null;
  role: string | null;
  kind: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  notes: string | null;
  nextFollowUpOn: string | null;
  nextFollowUpNote: string | null;
}

describe('Contacts (e2e)', () => {
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

  async function createContact(user: SignedInUser, fields: Record<string, unknown>): Promise<ContactBody> {
    const res = await http.post('/contacts').set('Cookie', user.cookie).send(fields).expect(201);
    return res.body as ContactBody;
  }

  const list = async (user: SignedInUser, query: Record<string, string> = {}) =>
    (await http.get('/contacts').query(query).set('Cookie', user.cookie).expect(200)).body as ContactBody[];

  const update = (user: SignedInUser, id: string, changes: Record<string, unknown>) =>
    http.patch(`/contacts/${id}`).set('Cookie', user.cookie).send(changes);

  describe('create and read', () => {
    it('creates a contact with only a name, the rest empty', async () => {
      const contact = await createContact(ada, { name: ' Linus Torvalds ', company: '', notes: '' });
      expect(contact).toMatchObject({
        name: 'Linus Torvalds',
        company: null,
        role: null,
        kind: null,
        email: null,
        phone: null,
        linkedinUrl: null,
        notes: null,
        nextFollowUpOn: null,
        nextFollowUpNote: null,
      });
      expect(contact).not.toHaveProperty('userId');

      await http.get(`/contacts/${contact.id}`).set('Cookie', ada.cookie).expect(200, contact);
    });

    it('keeps every field the user writes', async () => {
      const contact = await createContact(ada, {
        name: 'Margaret Hamilton',
        company: 'Acme Robotics',
        role: 'Talent Partner',
        kind: 'recruiter',
        email: 'margaret@example.com',
        phone: '+52 55 1234 5678',
        linkedinUrl: 'https://www.linkedin.com/in/example',
        notes: 'Met at a meetup',
        nextFollowUpOn: '2026-12-01',
        nextFollowUpNote: 'Ask about the second round',
      });
      expect(contact).toMatchObject({
        company: 'Acme Robotics',
        role: 'Talent Partner',
        kind: 'recruiter',
        email: 'margaret@example.com',
        phone: '+52 55 1234 5678',
        linkedinUrl: 'https://www.linkedin.com/in/example',
        notes: 'Met at a meetup',
        nextFollowUpOn: '2026-12-01',
        nextFollowUpNote: 'Ask about the second round',
      });
    });

    it('rejects invalid fields', async () => {
      const send = (fields: Record<string, unknown>) => http.post('/contacts').set('Cookie', ada.cookie).send(fields);
      await send({ company: 'No name' }).expect(400);
      await send({ name: '  ' }).expect(400);
      await send({ name: 'Ada', kind: 'friend' }).expect(400);
      await send({ name: 'Ada', email: 'not-an-email' }).expect(400);
      await send({ name: 'Ada', linkedinUrl: 'javascript:alert(1)' }).expect(400);
      await send({ name: 'Ada', nextFollowUpOn: '2026-13-01' }).expect(400);
      await send({ name: 'Ada', userId: grace.id }).expect(400);
    });
  });

  describe('list', () => {
    it('lists by name ignoring case, and searches name or company literally', async () => {
      const zed = await createContact(ada, { name: 'Zed Shaw', company: 'Initech' });
      const alan = await createContact(ada, { name: 'alan Kay', company: 'Acme Robotics' });
      const barbara = await createContact(ada, { name: 'Barbara Liskov', company: '100% Remote Co' });
      // Has "100" but not "100%": a search that took % as a wildcard would find him too.
      const dennis = await createContact(ada, { name: 'Dennis Ritchie', company: 'Top 100 Startups' });

      expect((await list(ada)).map((contact) => contact.id)).toEqual([alan.id, barbara.id, dennis.id, zed.id]);
      expect((await list(ada, { q: 'acme' })).map((contact) => contact.id)).toEqual([alan.id]);
      expect((await list(ada, { q: 'shaw' })).map((contact) => contact.id)).toEqual([zed.id]);
      // "%" is literal: only the company that contains it.
      expect((await list(ada, { q: '100%' })).map((contact) => contact.id)).toEqual([barbara.id]);
    });
  });

  describe('update and delete', () => {
    it('updates fields, sets and clears the next follow-up', async () => {
      const contact = await createContact(ada, { name: 'Margaret Hamilton', company: 'Acme Robotics' });

      const changed = await update(ada, contact.id, {
        role: 'Engineering Manager',
        kind: 'hiring_manager',
        nextFollowUpOn: '2026-12-01',
        nextFollowUpNote: 'Send the portfolio',
      }).expect(200);
      expect(changed.body).toMatchObject({
        name: 'Margaret Hamilton',
        company: 'Acme Robotics',
        role: 'Engineering Manager',
        kind: 'hiring_manager',
        nextFollowUpOn: '2026-12-01',
        nextFollowUpNote: 'Send the portfolio',
      });

      // What Today's "Done" sends (decision 037).
      const cleared = await update(ada, contact.id, { nextFollowUpOn: null, nextFollowUpNote: null }).expect(200);
      expect(cleared.body).toMatchObject({ nextFollowUpOn: null, nextFollowUpNote: null, company: 'Acme Robotics' });

      await update(ada, contact.id, {}).expect(400);
      await update(ada, contact.id, { name: '' }).expect(400);
    });

    it('deletes a contact', async () => {
      const contact = await createContact(ada, { name: 'Margaret Hamilton' });
      await http.delete(`/contacts/${contact.id}`).set('Cookie', ada.cookie).expect(204);
      await http.get(`/contacts/${contact.id}`).set('Cookie', ada.cookie).expect(404);
      await http.delete(`/contacts/${contact.id}`).set('Cookie', ada.cookie).expect(404);
    });

    it("deletes a user's contacts with the user", async () => {
      await createContact(ada, { name: 'Margaret Hamilton' });
      await dataSource.getRepository(User).delete({ id: ada.id });
      const [{ count }] = await dataSource.query<{ count: number }[]>(
        'SELECT count(*)::int AS count FROM contacts WHERE user_id = $1',
        [ada.id],
      );
      expect(count).toBe(0);
    });
  });

  describe('isolation (CLAUDE.md, hard rules)', () => {
    it("never lets one user list, search, read, change or delete another user's contact", async () => {
      const contact = await createContact(ada, { name: 'Margaret Hamilton', company: 'Acme Robotics' });

      expect(await list(grace)).toEqual([]);
      expect(await list(grace, { q: 'Margaret' })).toEqual([]);

      // 404, not 403: Grace cannot even tell the contact exists.
      await http.get(`/contacts/${contact.id}`).set('Cookie', grace.cookie).expect(404);
      await update(grace, contact.id, { name: 'Hijacked' }).expect(404);
      await update(grace, contact.id, { nextFollowUpOn: null }).expect(404);
      await http.delete(`/contacts/${contact.id}`).set('Cookie', grace.cookie).expect(404);

      const mine = await http.get(`/contacts/${contact.id}`).set('Cookie', ada.cookie).expect(200);
      expect(mine.body).toMatchObject({ name: 'Margaret Hamilton', company: 'Acme Robotics' });
    });

    it("keeps the admin out of other users' contacts too", async () => {
      const contact = await createContact(ada, { name: 'Margaret Hamilton' });
      await dataSource.getRepository(User).update({ id: grace.id }, { role: 'admin' });

      await http.get(`/contacts/${contact.id}`).set('Cookie', grace.cookie).expect(404);
      expect(await list(grace)).toEqual([]);
    });
  });
});
