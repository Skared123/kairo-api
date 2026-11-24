import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { OPEN_STATUSES } from '../jobs/job.enums.js';
import { Job } from '../jobs/job.entity.js';
import { Task } from '../tasks/task.entity.js';

/**
 * Done tasks stay in Today's answer this long: a "done today" in any time zone began less than 24 hours ago, so 48
 * leaves room for every one of them (decision 035).
 */
const RECENTLY_DONE = '48 hours';

/** What Today shows (docs/design/v0.3-today.md). Both queries filter by the user, like every other one. */
@Injectable()
export class TodayService {
  constructor(
    @InjectRepository(Task) private readonly tasks: Repository<Task>,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
  ) {}

  /** Open tasks by due day (those without one last), then the recently done ones. */
  tasksFor(userId: string): Promise<Task[]> {
    return this.tasks
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.job', 'job')
      .where('task.userId = :userId', { userId })
      .andWhere(`(task.doneAt IS NULL OR task.doneAt > now() - interval '${RECENTLY_DONE}')`)
      .orderBy('task.doneAt IS NOT NULL', 'ASC')
      .addOrderBy('task.dueOn', 'ASC', 'NULLS LAST')
      .addOrderBy('task.createdAt', 'ASC')
      .getMany();
  }

  /** The jobs in an open stage that have a follow-up, soonest first. */
  followUpsFor(userId: string): Promise<Job[]> {
    return this.jobs
      .createQueryBuilder('job')
      .where('job.userId = :userId', { userId })
      .andWhere('job.nextFollowUpOn IS NOT NULL')
      .andWhere('job.status IN (:...open)', { open: OPEN_STATUSES })
      .orderBy('job.nextFollowUpOn', 'ASC')
      .addOrderBy('job.company', 'ASC')
      .getMany();
  }
}
