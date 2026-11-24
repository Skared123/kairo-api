import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { isForeignKeyViolation, jobNotFound } from '../jobs/job-not-found.js';
import { Job } from '../jobs/job.entity.js';
import { Task } from './task.entity.js';
import type { CreateTaskDto, ListTasksQuery, UpdateTaskDto } from './tasks.schemas.js';

/**
 * The current user's tasks (decision 033). Every method takes the user's id and filters by it, and a task's job must
 * be one of the same user's jobs: an id from the request is never trusted alone.
 */
@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task) private readonly tasks: Repository<Task>,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
  ) {}

  /** Open tasks first, by due day (tasks without one last), then the done ones. */
  list(userId: string, { jobId }: ListTasksQuery): Promise<Task[]> {
    const query = this.tasks
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.job', 'job')
      .where('task.userId = :userId', { userId })
      .orderBy('task.doneAt IS NOT NULL', 'ASC')
      .addOrderBy('task.dueOn', 'ASC', 'NULLS LAST')
      .addOrderBy('task.createdAt', 'ASC');
    if (jobId) {
      query.andWhere('task.jobId = :jobId', { jobId });
    }
    return query.getMany();
  }

  async create(userId: string, { jobId, ...fields }: CreateTaskDto): Promise<Task> {
    await this.assertOwnJob(userId, jobId);
    const task = await this.saveLinked(this.tasks.create({ ...fields, jobId: jobId ?? null, userId }));
    return this.findOne(userId, task.id);
  }

  async findOne(userId: string, id: string): Promise<Task> {
    const task = await this.tasks.findOne({ where: { id, userId }, relations: { job: true } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  async update(userId: string, id: string, { done, jobId, ...fields }: UpdateTaskDto): Promise<Task> {
    const task = await this.findOne(userId, id);
    Object.assign(task, fields);
    if (jobId !== undefined) {
      await this.assertOwnJob(userId, jobId);
      task.jobId = jobId;
      // The loaded relation would win over jobId when saving.
      delete task.job;
    }
    if (done !== undefined) {
      // Marking a done task done again keeps when it was first done.
      task.doneAt = done ? (task.doneAt ?? new Date()) : null;
    }
    await this.saveLinked(task);
    return this.findOne(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    const { affected } = await this.tasks.delete({ id, userId });
    if (!affected) {
      throw new NotFoundException('Task not found');
    }
  }

  /** A missing job and another user's job get the same answer, so the answer reveals nothing. */
  private async assertOwnJob(userId: string, jobId: string | null | undefined): Promise<void> {
    if (jobId && !(await this.jobs.existsBy({ id: jobId, userId }))) {
      throw jobNotFound();
    }
  }

  /** Saves the task; the job deleted since it was checked gets the same answer as a missing one. */
  private async saveLinked(task: Task): Promise<Task> {
    try {
      return await this.tasks.save(task);
    } catch (error) {
      throw isForeignKeyViolation(error) ? jobNotFound() : error;
    }
  }
}
