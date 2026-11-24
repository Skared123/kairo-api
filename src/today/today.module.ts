import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job } from '../jobs/job.entity.js';
import { Task } from '../tasks/task.entity.js';
import { TodayController } from './today.controller.js';
import { TodayService } from './today.service.js';

/** v0.3 Today: what to do today, from the user's tasks and follow-ups (docs/design/v0.3-today.md). */
@Module({
  imports: [TypeOrmModule.forFeature([Task, Job])],
  controllers: [TodayController],
  providers: [TodayService],
})
export class TodayModule {}
