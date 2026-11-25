import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, type EntityManager, type Repository } from 'typeorm';
import { LearningItemSkill } from './learning-item-skill.entity.js';
import { LearningItem } from './learning-item.entity.js';
import type { CreateLearningItemDto, UpdateLearningItemDto } from './learning.schemas.js';
import { cleanSkillName, Skill, skillKey } from './skill.entity.js';

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

  /** Latest change first, each with its skills. */
  list(userId: string): Promise<LearningItem[]> {
    return this.withSkills(userId).orderBy('item.updatedAt', 'DESC').getMany();
  }

  async create(userId: string, { skills = [], ...fields }: CreateLearningItemDto): Promise<LearningItem> {
    const { id } = await this.dataSource.transaction(async (manager) => {
      const item = await manager.save(this.items.create({ ...fields, userId }));
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

  async update(userId: string, id: string, { skills, ...changes }: UpdateLearningItemDto): Promise<LearningItem> {
    await this.dataSource.transaction(async (manager) => {
      const item = await manager.findOneBy(LearningItem, { id, userId });
      if (!item) {
        throw new NotFoundException('Learning item not found');
      }
      Object.assign(item, changes);
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
