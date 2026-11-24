import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity.js';
import { CONTACT_KINDS, type ContactKind } from './contact.enums.js';

/**
 * Someone the user talks to during the search: a recruiter, a hiring manager, a friend who refers them. Every row
 * belongs to one user, and every query filters by it (CLAUDE.md, hard rules). Other people's personal data: it lives
 * only in the database. See docs/design/v0.4-contacts.md.
 */
@Entity('contacts')
@Index('contacts_user_id_idx', ['userId'])
@Index('contacts_user_id_next_follow_up_on_idx', ['userId', 'nextFollowUpOn'])
export class Contact {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'contacts_pkey' })
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'contacts_user_id_fkey' })
  user?: User;

  @Column({ type: 'text' })
  name: string;

  /** Free text, like a job's company (decision 039). */
  @Column({ type: 'text', nullable: true })
  company: string | null;

  /** Their job title, such as "Talent Partner". */
  @Column({ type: 'text', nullable: true })
  role: string | null;

  @Column({ type: 'enum', enum: CONTACT_KINDS, enumName: 'contact_kind', nullable: true })
  kind: ContactKind | null;

  @Column({ type: 'text', nullable: true })
  email: string | null;

  /** As the user writes it. */
  @Column({ type: 'text', nullable: true })
  phone: string | null;

  /** A link the user typed. Kairo never fetches it: no LinkedIn automation (CLAUDE.md, hard rules). */
  @Column({ type: 'text', nullable: true })
  linkedinUrl: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** When to write again, as YYYY-MM-DD (decision 037). */
  @Column({ type: 'date', nullable: true })
  nextFollowUpOn: string | null;

  /** What to write about. */
  @Column({ type: 'text', nullable: true })
  nextFollowUpNote: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
