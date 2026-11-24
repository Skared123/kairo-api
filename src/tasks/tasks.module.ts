import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job } from '../jobs/job.entity.js';
import { Task } from './task.entity.js';
import { TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';

/** v0.3 Today: the user's tasks (docs/design/v0.3-today.md). */
@Module({
  imports: [TypeOrmModule.forFeature([Task, Job])],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
