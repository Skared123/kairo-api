import { AuthenticationStorage, type SessionRecord, type SessionStore } from '@nestjs/authentication';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, LessThanOrEqual, type QueryDeepPartialEntity, type Repository } from 'typeorm';
import { Session } from './session.entity.js';

/**
 * Keeps @nestjs/authentication's sessions in PostgreSQL (decision 008).
 * Every write is a single statement, so concurrent requests cannot bring back a session that was just deleted.
 * The library's contract suite checks these rules in test/typeorm-session.store.e2e-spec.ts.
 */
@Injectable()
export class TypeOrmSessionStore implements SessionStore {
  constructor(
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    storage: AuthenticationStorage,
  ) {
    storage.registerSource({ sessions: this });
  }

  async getSession(id: string): Promise<SessionRecord | undefined> {
    const session = await this.sessions.findOneBy({ id });
    return session ? toRecord(session) : undefined;
  }

  async createSession(record: SessionRecord): Promise<void> {
    // Keeps the table bounded. The cutoff is the library's clock (record.createdAt), never the database's.
    await this.sessions.delete({ expiresAt: LessThanOrEqual(record.createdAt) });
    // `extra` is read with a session, never stored.
    const session: Session = {
      id: record.id,
      userId: record.userId,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      lastActiveAt: record.lastActiveAt,
      mfa: record.mfa ?? null,
      metadata: record.metadata ?? null,
    };
    // TypeORM's insert type cannot express `unknown` inside a jsonb column, so the typed row is widened here.
    await this.sessions.insert(session as QueryDeepPartialEntity<Session>);
  }

  async touchSession(id: string, lastActiveAt: Date): Promise<void> {
    // One conditional UPDATE: a deleted session stays deleted, and activity only moves forward.
    await this.sessions.update({ id, lastActiveAt: LessThan(lastActiveAt) }, { lastActiveAt });
  }

  async deleteSession(id: string): Promise<boolean> {
    // The row count tells which of two concurrent deletes (a sign-out and a rotation) won.
    const { affected } = await this.sessions.delete({ id });
    return (affected ?? 0) > 0;
  }

  async listUserSessions(userId: string): Promise<SessionRecord[]> {
    const sessions = await this.sessions.findBy({ userId });
    return sessions.map(toRecord);
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await this.sessions.delete({ userId });
  }
}

/** Optional fields come back absent, never null, as SessionStore requires. */
function toRecord(session: Session): SessionRecord {
  return {
    id: session.id,
    userId: session.userId,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    lastActiveAt: session.lastActiveAt,
    ...(session.mfa !== null && { mfa: session.mfa }),
    ...(session.metadata !== null && { metadata: session.metadata }),
  };
}
