import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LearningItemSkill } from './learning-item-skill.entity.js';
import { LearningItem } from './learning-item.entity.js';
import { LearningController } from './learning.controller.js';
import { LearningService } from './learning.service.js';
import { Skill } from './skill.entity.js';
import { SkillsController } from './skills.controller.js';
import { SkillsService } from './skills.service.js';

/** v0.5 Learning: what the user studies and the skills it trains (docs/design/v0.5-learning.md). */
@Module({
  imports: [TypeOrmModule.forFeature([LearningItem, Skill, LearningItemSkill])],
  controllers: [LearningController, SkillsController],
  providers: [LearningService, SkillsService],
})
export class LearningModule {}
