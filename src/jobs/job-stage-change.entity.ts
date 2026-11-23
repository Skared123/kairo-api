import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { JOB_STATUSES, type JobStatus } from './job.enums.js';
import { Job } from './job.entity.js';

/**
 * One move of a job between stages (decision 028). Written in the same transaction as the move, never edited, and
 * deleted with its job. Metrics (v0.9) read time in each stage from here.
 */
@Entity('job_stage_changes')
@Index('job_stage_changes_job_id_idx', ['jobId'])
export class JobStageChange {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'job_stage_changes_pkey' })
  id: string;

  @Column({ type: 'uuid' })
  jobId: string;

  @ManyToOne(() => Job, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id', foreignKeyConstraintName: 'job_stage_changes_job_id_fkey' })
  job?: Job;

  /** Null for the first entry, written when the job is created. */
  @Column({ type: 'enum', enum: JOB_STATUSES, enumName: 'job_status', nullable: true })
  fromStatus: JobStatus | null;

  @Column({ type: 'enum', enum: JOB_STATUSES, enumName: 'job_status' })
  toStatus: JobStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  changedAt: Date;
}
