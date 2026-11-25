import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contact } from '../contacts/contact.entity.js';
import { Job } from '../jobs/job.entity.js';
import { LearningItem } from '../learning/learning-item.entity.js';
import { Task } from '../tasks/task.entity.js';
import { TodayController } from './today.controller.js';
import { TodayService } from './today.service.js';

/**
 * Today: what to do today, from the user's tasks, the follow-ups of jobs and contacts, and the study focus
 * (docs/design/v0.3-today.md, v0.4-contacts.md, v0.5-learning.md).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Task, Job, Contact, LearningItem])],
  controllers: [TodayController],
  providers: [TodayService],
})
export class TodayModule {}
