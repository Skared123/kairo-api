import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { isUniqueViolation } from '../database/postgres-errors.js';
import { LearningItemSkill } from './learning-item-skill.entity.js';
import { cleanSkillName, Skill, skillKey } from './skill.entity.js';

/**
 * The current user's skills (decision 040). Every method filters by the user; a skill that is not theirs is "not
 * found". Skills are created through learning items; here they are listed, renamed and deleted.
 */
@Injectable()
export class SkillsService {
  constructor(
    @InjectRepository(Skill) private readonly skills: Repository<Skill>,
    @InjectRepository(LearningItemSkill) private readonly links: Repository<LearningItemSkill>,
  ) {}

  /** By name, ignoring case, each with how many items train it. */
  async list(userId: string): Promise<{ skill: Skill; itemCount: number }[]> {
    const skills = await this.skills
      .createQueryBuilder('skill')
      .where('skill.userId = :userId', { userId })
      .orderBy('LOWER(skill.name)', 'ASC')
      .getMany();
    const counts = await this.links
      .createQueryBuilder('link')
      .select('link.skillId', 'skillId')
      .addSelect('COUNT(*)::int', 'count')
      .innerJoin('link.skill', 'skill')
      .where('skill.userId = :userId', { userId })
      .groupBy('link.skillId')
      .getRawMany<{ skillId: string; count: number }>();
    const countOf = new Map(counts.map(({ skillId, count }) => [skillId, count]));
    return skills.map((skill) => ({ skill, itemCount: countOf.get(skill.id) ?? 0 }));
  }

  /**
   * Renames the skill; every item that trains it shows the new name. A name another of the user's skills already has
   * answers 409 skill_exists: two skills are never merged silently.
   */
  async rename(userId: string, id: string, name: string): Promise<{ skill: Skill; itemCount: number }> {
    const skill = await this.skills.findOneBy({ id, userId });
    if (!skill) {
      throw new NotFoundException('Skill not found');
    }
    skill.name = cleanSkillName(name);
    skill.key = skillKey(name);
    try {
      await this.skills.save(skill);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ statusCode: 409, error: 'skill_exists', message: 'Skill already exists' });
      }
      throw error;
    }
    return { skill, itemCount: await this.links.countBy({ skillId: id }) };
  }

  /** Deletes the skill; its items stay, without it. */
  async remove(userId: string, id: string): Promise<void> {
    const { affected } = await this.skills.delete({ id, userId });
    if (!affected) {
      throw new NotFoundException('Skill not found');
    }
  }
}
