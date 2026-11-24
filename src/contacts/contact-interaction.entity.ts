import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Contact } from './contact.entity.js';
import { INTERACTION_CHANNELS, type InteractionChannel } from './contact.enums.js';

/**
 * One conversation with a contact (decision 038), logged by hand. Its owner is the contact's: every query reaches it
 * through one of the user's contacts. Deleted with the contact.
 */
@Entity('contact_interactions')
// Serves a contact's log, latest first, and its latest day (Contact.lastInteractionOn).
@Index('contact_interactions_contact_id_occurred_on_idx', ['contactId', 'occurredOn'])
export class ContactInteraction {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'contact_interactions_pkey' })
  id: string;

  @Column({ type: 'uuid' })
  contactId: string;

  @ManyToOne(() => Contact, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contact_id', foreignKeyConstraintName: 'contact_interactions_contact_id_fkey' })
  contact?: Relation<Contact>;

  /** The day it took place, as YYYY-MM-DD. */
  @Column({ type: 'date' })
  occurredOn: string;

  @Column({ type: 'enum', enum: INTERACTION_CHANNELS, enumName: 'contact_interaction_channel' })
  channel: InteractionChannel;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
