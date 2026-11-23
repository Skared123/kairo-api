import {
  Check,
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
import {
  CONTRACT_TYPES,
  JOB_SOURCES,
  JOB_STATUSES,
  SALARY_PERIODS,
  WORK_MODES,
  type ContractType,
  type JobSource,
  type JobStatus,
  type SalaryPeriod,
  type WorkMode,
} from './job.enums.js';

/**
 * A posting the user tracks. Every row belongs to one user, and every query filters by it (CLAUDE.md, hard rules).
 * See docs/design/v0.2-jobs.md.
 */
@Entity('jobs')
@Index('jobs_user_id_idx', ['userId'])
@Check('jobs_salary_range', '"salary_min" IS NULL OR "salary_max" IS NULL OR "salary_min" <= "salary_max"')
@Check('jobs_salary_currency_format', `"salary_currency" ~ '^[A-Z]{3}$'`)
// An amount needs its currency and period to mean anything (decision 029).
@Check(
  'jobs_salary_complete',
  '("salary_min" IS NULL AND "salary_max" IS NULL) OR ("salary_currency" IS NOT NULL AND "salary_period" IS NOT NULL)',
)
export class Job {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'jobs_pkey' })
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'jobs_user_id_fkey' })
  user?: User;

  @Column({ type: 'text' })
  company: string;

  @Column({ type: 'text' })
  title: string;

  /** The posting's link. */
  @Column({ type: 'text', nullable: true })
  url: string | null;

  @Column({ type: 'enum', enum: JOB_SOURCES, enumName: 'job_source', nullable: true })
  source: JobSource | null;

  @Column({ type: 'enum', enum: WORK_MODES, enumName: 'job_work_mode', nullable: true })
  workMode: WorkMode | null;

  /** City or country, free text. */
  @Column({ type: 'text', nullable: true })
  location: string | null;

  /** Working hours or time zone overlap, free text; not compared automatically. */
  @Column({ type: 'text', nullable: true })
  timeZoneNotes: string | null;

  @Column({ type: 'enum', enum: CONTRACT_TYPES, enumName: 'job_contract_type', nullable: true })
  contractType: ContractType | null;

  /** Whole units of `salaryCurrency` per `salaryPeriod` (decision 029). */
  @Column({ type: 'integer', nullable: true })
  salaryMin: number | null;

  @Column({ type: 'integer', nullable: true })
  salaryMax: number | null;

  /** ISO 4217, such as MXN or USD. */
  @Column({ type: 'char', length: 3, nullable: true })
  salaryCurrency: string | null;

  @Column({ type: 'enum', enum: SALARY_PERIODS, enumName: 'salary_period', nullable: true })
  salaryPeriod: SalaryPeriod | null;

  /** The posting, pasted. */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'enum', enum: JOB_STATUSES, enumName: 'job_status', default: 'to_review' })
  status: JobStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
