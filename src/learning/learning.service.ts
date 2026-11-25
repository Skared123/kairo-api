import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, type EntityManager, type Repository } from 'typeorm';
import { LearningItemSkill } from './learning-item-skill.entity.js';
import { LearningItem } from './learning-item.entity.js';
import type { LearningStatus } from './learning.enums.js';
import type { CreateLearningItemDto, ListLearningQuery, UpdateLearningItemDto } from './learning.schemas.js';
import { cleanSkillName, Skill, skillKey } from './skill.entity.js';

/** The statuses that end an item: they clear its focus (decision 042). */
const FINISHED: LearningStatus[] = ['done', 'dropped'];

/**
 * The current user's learning items (docs/design/v0.5-learning.md). Every method takes the user's id and filters by
 * it; an item that is not theirs is "not found". Skills come by name and are matched or created among the same user's
 * skills only (decision 040).
 */
@Injectable()
export class LearningService {
  constructor(
    @InjectRepository(LearningItem) private readonly items: Repository<LearningItem>,
    private readonly dataSource: DataSource,
  ) {}

  /** The focus first, then in progress, to start, done and dropped; latest change first within each. */
  list(userId: string, { status, skillId }: ListLearningQuery): Promise<LearningItem[]> {
    const query = this.withSkills(userId)
      .orderBy('item.isFocus', 'DESC')
      .addOrderBy(
        "CASE item.status WHEN 'in_progress' THEN 0 WHEN 'to_start' THEN 1 WHEN 'done' THEN 2 ELSE 3 END",
        'ASC',
      )
      .addOrderBy('item.updatedAt', 'DESC');
    if (status) {
      query.andWhere('item.status = :status', { status });
    }
    if (skillId) {
      // A subquery, not the join: the items found still show all their skills.
      query.andWhere(
        'EXISTS (SELECT 1 FROM learning_item_skills lis WHERE lis.item_id = item.id AND lis.skill_id = :skillId)',
        { skillId },
      );
    }
    return query.getMany();
  }

  async create(
    userId: string,
    { skills = [], status, isFocus, ...fields }: CreateLearningItemDto,
  ): Promise<LearningItem> {
    const { id } = await this.dataSource.transaction(async (manager) => {
      const item = this.items.create({ ...fields, userId });
      applyStatus(item, status);
      await this.applyFocus(manager, item, isFocus);
      await manager.save(item);
      await this.setSkills(manager, userId, item.id, skills);
      return item;
    });
    return this.findOne(userId, id);
  }

  async findOne(userId: string, id: string): Promise<LearningItem> {
    const item = await this.withSkills(userId).andWhere('item.id = :id', { id }).getOne();
    if (!item) {
      throw new NotFoundException('Learning item not found');
    }
    return item;
  }

  async update(
    userId: string,
    id: string,
    { skills, status, isFocus, ...changes }: UpdateLearningItemDto,
  ): Promise<LearningItem> {
    await this.dataSource.transaction(async (manager) => {
      const item = await manager.findOneBy(LearningItem, { id, userId });
      if (!item) {
        throw new NotFoundException('Learning item not found');
      }
      Object.assign(item, changes);
      applyStatus(item, status);
      await this.applyFocus(manager, item, isFocus);
      await manager.save(item);
      if (skills) {
        await this.setSkills(manager, userId, id, skills);
      }
    });
    return this.findOne(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    const { affected } = await this.items.delete({ id, userId });
    if (!affected) {
      throw new NotFoundException('Learning item not found');
    }
  }

  /**
   * Makes the item the user's focus, or takes it away (decision 042). Moving the focus clears the previous one in the
   * same transaction, after locking the user's row: two moves at once run one after the other instead of tripping on
   * the one-focus index. A finished item never keeps the focus.
   */
  private async applyFocus(manager: EntityManager, item: LearningItem, isFocus: boolean | undefined): Promise<void> {
    if (FINISHED.includes(item.status)) {
      if (isFocus) {
        throw new BadRequestException('A done or dropped item cannot be the focus');
      }
      item.isFocus = false;
      return;
    }
    if (isFocus === undefined) {
      return;
    }
    if (isFocus) {
      await manager.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [item.userId]);
      await manager.update(
        LearningItem,
        { userId: item.userId, isFocus: true, ...(item.id ? { id: Not(item.id) } : {}) },
        { isFocus: false },
      );
    }
    item.isFocus = isFocus;
  }

  /**
   * Replaces the item's skills with these names: each is matched to one of the user's skills by its key, or created.
   * Two names with the same key are one skill.
   */
  private async setSkills(manager: EntityManager, userId: string, itemId: string, names: string[]): Promise<void> {
    const byKey = new Map<string, string>();
    for (const name of names) {
      const key = skillKey(name);
      if (!byKey.has(key)) {
        byKey.set(key, cleanSkillName(name));
      }
    }
    await manager.delete(LearningItemSkill, { itemId });
    if (byKey.size === 0) {
      return;
    }
    const keys = [...byKey.keys()];
    // Create the missing ones; a skill created meanwhile by the same user is simply kept.
    await manager
      .createQueryBuilder()
      .insert()
      .into(Skill)
      .values(keys.map((key) => ({ userId, key, name: byKey.get(key)! })))
      .orIgnore()
      .execute();
    const skills = await manager.findBy(Skill, { userId, key: In(keys) });
    await manager.insert(
      LearningItemSkill,
      skills.map((skill) => ({ itemId, skillId: skill.id })),
    );
  }

  /**
   * The user's items with their skills. The join repeats the owner check, so a link could never show another user's
   * skill even if one existed.
   */
  private withSkills(userId: string) {
    return this.items
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.skillLinks', 'link')
      .leftJoinAndSelect('link.skill', 'skill', 'skill.userId = item.userId')
      .where('item.userId = :userId', { userId });
  }
}

/** Moving to done records when; leaving it forgets (decision 041). Done again keeps the first moment. */
function applyStatus(item: LearningItem, status: LearningStatus | undefined): void {
  if (status === undefined) {
    return;
  }
  if (status === 'done') {
    item.finishedAt = item.status === 'done' && item.finishedAt ? item.finishedAt : new Date();
  } else {
    item.finishedAt = null;
  }
  item.status = status;
}
