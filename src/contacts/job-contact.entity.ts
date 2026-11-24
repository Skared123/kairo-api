import { CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { Job } from '../jobs/job.entity.js';
import { Contact } from './contact.entity.js';

/**
 * A contact linked to a job (decision 036): any number of jobs per contact, and of contacts per job. Both ends are
 * always the same user's; the service checks it on every link. Deleting either end removes the link only.
 */
@Entity('job_contacts')
@Index('job_contacts_contact_id_idx', ['contactId'])
export class JobContact {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'job_contacts_pkey' })
  jobId: string;

  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'job_contacts_pkey' })
  contactId: string;

  @ManyToOne(() => Job, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id', foreignKeyConstraintName: 'job_contacts_job_id_fkey' })
  job?: Job;

  @ManyToOne(() => Contact, (contact) => contact.jobLinks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contact_id', foreignKeyConstraintName: 'job_contacts_contact_id_fkey' })
  // Relation<>: the two entities import each other, and ESM must not read Contact before it exists.
  contact?: Relation<Contact>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
