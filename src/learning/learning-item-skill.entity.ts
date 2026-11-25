import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { LearningItem } from './learning-item.entity.js';
import { Skill } from './skill.entity.js';

/** A skill a learning item trains (decision 040). Both are always the same user's. */
@Entity('learning_item_skills')
@Index('learning_item_skills_skill_id_idx', ['skillId'])
export class LearningItemSkill {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'learning_item_skills_pkey' })
  itemId: string;

  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'learning_item_skills_pkey' })
  skillId: string;

  // Relation<>: the two entities import each other, and ESM must not read LearningItem before it exists.
  @ManyToOne(() => LearningItem, (item) => item.skillLinks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id', foreignKeyConstraintName: 'learning_item_skills_item_id_fkey' })
  item?: Relation<LearningItem>;

  @ManyToOne(() => Skill, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skill_id', foreignKeyConstraintName: 'learning_item_skills_skill_id_fkey' })
  skill?: Skill;
}
