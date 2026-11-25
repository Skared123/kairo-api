import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { User } from '../users/user.entity.js';
import { LearningItemSkill } from './learning-item-skill.entity.js';
import { LEARNING_KINDS, LEARNING_STATUSES, type LearningKind, type LearningStatus } from './learning.enums.js';

/**
 * Something the user studies or builds: a video, a course, an article, a book, a project. Every row belongs to one
 * user, and every query filters by it (CLAUDE.md, hard rules). See docs/design/v0.5-learning.md.
 */
@Entity('learning_items')
@Index('learning_items_user_id_idx', ['userId'])
// At most one focus per user, enforced by the database (decision 042).
@Index('learning_items_one_focus_per_user', ['userId'], { unique: true, where: '"is_focus"' })
export class LearningItem {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'learning_items_pkey' })
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'learning_items_user_id_fkey' })
  user?: User;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'enum', enum: LEARNING_KINDS, enumName: 'learning_item_kind' })
  kind: LearningKind;

  @Column({ type: 'text', nullable: true })
  url: string | null;

  @Column({ type: 'enum', enum: LEARNING_STATUSES, enumName: 'learning_item_status', default: 'to_start' })
  status: LearningStatus;

  /** When it moved to done; null otherwise (decision 041). */
  @Column({ type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  /** The one item Today shows (decision 042). */
  @Column({ type: 'boolean', default: false })
  isFocus: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** The skills it trains (decision 040). Loaded only when asked for. */
  @OneToMany(() => LearningItemSkill, (link) => link.item)
  skillLinks?: Relation<LearningItemSkill[]>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
