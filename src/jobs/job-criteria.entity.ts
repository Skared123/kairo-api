import { Check, Column, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity.js';
import { CONTRACT_TYPES, SALARY_PERIODS, type ContractType, type SalaryPeriod } from './job.enums.js';

/**
 * What a user looks for in a job: one row per user, created on the first save. Every job is compared with it
 * (decision 029). The salary target lives only here, in the database, never in the repository.
 */
@Entity('job_criteria')
@Check('job_criteria_currency_format', `"currency" ~ '^[A-Z]{3}$'`)
// A target salary needs its currency and period, or none of the three is set.
@Check(
  'job_criteria_salary_complete',
  '("min_salary" IS NULL AND "currency" IS NULL AND "period" IS NULL) OR ' +
    '("min_salary" IS NOT NULL AND "currency" IS NOT NULL AND "period" IS NOT NULL)',
)
export class JobCriteria {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'job_criteria_pkey' })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'job_criteria_user_id_fkey' })
  user?: User;

  /** Whole units of `currency` per `period`. */
  @Column({ type: 'integer', nullable: true })
  minSalary: number | null;

  @Column({ type: 'char', length: 3, nullable: true })
  currency: string | null;

  @Column({ type: 'enum', enum: SALARY_PERIODS, enumName: 'salary_period', nullable: true })
  period: SalaryPeriod | null;

  @Column({ type: 'boolean', default: false })
  remoteOnly: boolean;

  /** The contract types the user accepts; empty means any. */
  @Column({ type: 'enum', enum: CONTRACT_TYPES, enumName: 'job_contract_type', array: true, default: '{}' })
  contractTypes: ContractType[];

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
