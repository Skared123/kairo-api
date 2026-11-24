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
import { Job } from '../jobs/job.entity.js';
import { User } from '../users/user.entity.js';

/**
 * Something the user has to do, written by hand (decision 033). Every row belongs to one user, and every query filters
 * by it (CLAUDE.md, hard rules). See docs/design/v0.3-today.md.
 */
@Entity('tasks')
@Index('tasks_user_id_idx', ['userId'])
@Index('tasks_job_id_idx', ['jobId'])
export class Task {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'tasks_pkey' })
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'tasks_user_id_fkey' })
  user?: User;

  /** The job it belongs to, always one of the same user's. Deleting the job keeps the task, unlinked. */
  @Column({ type: 'uuid', nullable: true })
  jobId: string | null;

  @ManyToOne(() => Job, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'job_id', foreignKeyConstraintName: 'tasks_job_id_fkey' })
  job?: Job | null;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** The day it is due, as YYYY-MM-DD: a calendar day, with no time zone. */
  @Column({ type: 'date', nullable: true })
  dueOn: string | null;

  /** When it was marked done; null while it is open. Done tasks are kept. */
  @Column({ type: 'timestamptz', nullable: true })
  doneAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
