import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { DataSource } from 'typeorm';
import { User } from '../src/users/user.entity.js';
import { createTestApp } from './create-test-app.js';
import { createTwoUsers, type SignedInUser } from './two-users.js';

interface InteractionBody {
  id: string;
  occurredOn: string;
  channel: string;
  note: string | null;
}

describe('Contact interactions (e2e)', () => {
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

  async function createContact(user: SignedInUser, name = 'Margaret Hamilton'): Promise<string> {
    return (await http.post('/contacts').set('Cookie', user.cookie).send({ name }).expect(201)).body.id as string;
  }

  async function logInteraction(
    user: SignedInUser,
    contactId: string,
    fields: Record<string, unknown>,
  ): Promise<InteractionBody> {
    const res = await http
      .post(`/contacts/${contactId}/interactions`)
      .set('Cookie', user.cookie)
      .send(fields)
      .expect(201);
    return res.body as InteractionBody;
  }

  const listInteractions = (user: SignedInUser, contactId: string) =>
    http.get(`/contacts/${contactId}/interactions`).set('Cookie', user.cookie);

  const interactionCount = async () =>
    (await dataSource.query<{ count: number }[]>('SELECT count(*)::int AS count FROM contact_interactions'))[0].count;

  it('logs conversations, lists them latest first, and shows the latest day on the contact', async () => {
    const contact = await createContact(ada);
    const before = await http.get(`/contacts/${contact}`).set('Cookie', ada.cookie).expect(200);
    expect(before.body.lastInteractionOn).toBeNull();

    const first = await logInteraction(ada, contact, { occurredOn: '2026-11-02', channel: 'linkedin', note: '' });
    expect(first).toMatchObject({ occurredOn: '2026-11-02', channel: 'linkedin', note: null });
    const latest = await logInteraction(ada, contact, {
      occurredOn: '2026-11-20',
      channel: 'call',
      note: 'Talked about the team and the second round',
    });
    // Logged later, but about an earlier day.
    const middle = await logInteraction(ada, contact, { occurredOn: '2026-11-10', channel: 'email' });

    const list = await listInteractions(ada, contact).expect(200);
    expect(list.body.map((interaction: InteractionBody) => interaction.id)).toEqual([latest.id, middle.id, first.id]);

    const after = await http.get(`/contacts/${contact}`).set('Cookie', ada.cookie).expect(200);
    expect(after.body.lastInteractionOn).toBe('2026-11-20');
    const all = await http.get('/contacts').set('Cookie', ada.cookie).expect(200);
    expect(all.body[0].lastInteractionOn).toBe('2026-11-20');
  });

  it('rejects invalid fields', async () => {
    const contact = await createContact(ada);
    const send = (fields: Record<string, unknown>) =>
      http.post(`/contacts/${contact}/interactions`).set('Cookie', ada.cookie).send(fields);
    await send({ channel: 'call' }).expect(400);
    await send({ occurredOn: '2026-11-20' }).expect(400);
    await send({ occurredOn: '2026-11-31', channel: 'call' }).expect(400);
    await send({ occurredOn: '2026-11-20', channel: 'whatsapp' }).expect(400);
    await send({ occurredOn: '2026-11-20', channel: 'call', contactId: contact }).expect(400);
  });

  it('edits and deletes a conversation', async () => {
    const contact = await createContact(ada);
    const interaction = await logInteraction(ada, contact, { occurredOn: '2026-11-20', channel: 'call' });

    const changed = await http
      .patch(`/contacts/${contact}/interactions/${interaction.id}`)
      .set('Cookie', ada.cookie)
      .send({ channel: 'meeting', note: 'In person, at their office' })
      .expect(200);
    expect(changed.body).toMatchObject({
      occurredOn: '2026-11-20',
      channel: 'meeting',
      note: 'In person, at their office',
    });
    await http
      .patch(`/contacts/${contact}/interactions/${interaction.id}`)
      .set('Cookie', ada.cookie)
      .send({})
      .expect(400);

    await http.delete(`/contacts/${contact}/interactions/${interaction.id}`).set('Cookie', ada.cookie).expect(204);
    await http.delete(`/contacts/${contact}/interactions/${interaction.id}`).set('Cookie', ada.cookie).expect(404);
    expect((await listInteractions(ada, contact).expect(200)).body).toEqual([]);
  });

  it('answers 404 for a contact that does not exist, or a conversation of another contact', async () => {
    const margaret = await createContact(ada);
    const barbara = await createContact(ada, 'Barbara Liskov');
    const interaction = await logInteraction(ada, margaret, { occurredOn: '2026-11-20', channel: 'call' });

    await listInteractions(ada, randomUUID()).expect(404);
    await http
      .post(`/contacts/${randomUUID()}/interactions`)
      .set('Cookie', ada.cookie)
      .send({ occurredOn: '2026-11-20', channel: 'call' })
      .expect(404);
    // Margaret's conversation through Barbara's URL.
    await http
      .patch(`/contacts/${barbara}/interactions/${interaction.id}`)
      .set('Cookie', ada.cookie)
      .send({ note: 'Moved' })
      .expect(404);
    await http.delete(`/contacts/${barbara}/interactions/${interaction.id}`).set('Cookie', ada.cookie).expect(404);
    expect(await interactionCount()).toBe(1);
  });

  it('deletes the conversations with the contact', async () => {
    const contact = await createContact(ada);
    await logInteraction(ada, contact, { occurredOn: '2026-11-20', channel: 'call' });
    await http.delete(`/contacts/${contact}`).set('Cookie', ada.cookie).expect(204);
    expect(await interactionCount()).toBe(0);
  });

  describe('isolation (CLAUDE.md, hard rules)', () => {
    it("never lets one user list, log, change or delete another user's conversations", async () => {
      const contact = await createContact(ada);
      const interaction = await logInteraction(ada, contact, {
        occurredOn: '2026-11-20',
        channel: 'call',
        note: 'Salary range shared',
      });
      const url = `/contacts/${contact}/interactions`;

      await listInteractions(grace, contact).expect(404);
      await http.post(url).set('Cookie', grace.cookie).send({ occurredOn: '2026-11-21', channel: 'email' }).expect(404);
      await http.patch(`${url}/${interaction.id}`).set('Cookie', grace.cookie).send({ note: 'Hijacked' }).expect(404);
      await http.delete(`${url}/${interaction.id}`).set('Cookie', grace.cookie).expect(404);

      // Through Grace's own contact: still not found.
      const gracesContact = await createContact(grace, 'Barbara Liskov');
      await http
        .patch(`/contacts/${gracesContact}/interactions/${interaction.id}`)
        .set('Cookie', grace.cookie)
        .send({ note: 'Hijacked' })
        .expect(404);

      const mine = await listInteractions(ada, contact).expect(200);
      expect(mine.body).toMatchObject([{ id: interaction.id, note: 'Salary range shared' }]);
    });

    it("keeps the admin out of other users' conversations too", async () => {
      const contact = await createContact(ada);
      await logInteraction(ada, contact, { occurredOn: '2026-11-20', channel: 'call' });
      await dataSource.getRepository(User).update({ id: grace.id }, { role: 'admin' });

      await listInteractions(grace, contact).expect(404);
    });
  });
});
