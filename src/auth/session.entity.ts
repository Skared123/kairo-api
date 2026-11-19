import type { MfaState } from '@nestjs/authentication';
import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * A signed-in browser session, written and read only by TypeOrmSessionStore.
 * The row shape follows SessionRecord from @nestjs/authentication (decision 008).
 */
@Entity('sessions')
@Index('sessions_user_id_idx', ['userId'])
// Expired sessions are purged by expiry when new ones are created.
@Index('sessions_expires_at_idx', ['expiresAt'])
@Check('sessions_mfa_valid', `"mfa" IN ('pending', 'verified')`)
export class Session {
  /** SHA-256 of the cookie token. The token itself is never stored. */
  @PrimaryColumn({ type: 'text', primaryKeyConstraintName: 'sessions_pkey' })
  id: string;

  /**
   * Text without a foreign key to users (decision 008): the library's contract suite uses ids that are not
   * users, and deactivating an account deletes its sessions in code.
   */
  @Column({ type: 'text' })
  userId: string;

  // The three timestamps come from the library's clock, never the database's, so none has a default.
  @Column({ type: 'timestamptz' })
  createdAt: Date;

  /** Absolute expiry: activity never extends a session past it. */
  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  /** Last activity, for the idle timeout. */
  @Column({ type: 'timestamptz' })
  lastActiveAt: Date;

  @Column({ type: 'text', nullable: true })
  mfa: MfaState | null;

  /** App data such as the user agent, for a future "where you're signed in" page. */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
