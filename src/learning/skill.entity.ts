import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity.js';

/**
 * A skill the user trains, saved once per user (decision 040). `key` is how two names are compared: "TypeScript" and
 * " typescript" are the same skill. Every query filters by the user.
 */
@Entity('skills')
// Also serves every lookup of a user's skills.
@Index('skills_user_id_key_key', ['userId', 'key'], { unique: true })
export class Skill {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'skills_pkey' })
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'skills_user_id_fkey' })
  user?: User;

  /** As the user wrote it the first time. */
  @Column({ type: 'text' })
  name: string;

  /** `name` trimmed and lowercased; set by the service, see skillKey(). */
  @Column({ type: 'text' })
  key: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

/** A skill name as saved: without the spaces around it, and one space between words. */
export function cleanSkillName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/** How skill names are compared: ignoring case and the spaces around and between words. */
export function skillKey(name: string): string {
  return cleanSkillName(name).toLowerCase();
}
