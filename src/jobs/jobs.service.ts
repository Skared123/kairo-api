import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type Repository } from 'typeorm';
import { JobStageChange } from './job-stage-change.entity.js';
import type { JobStatus } from './job.enums.js';
import { Job } from './job.entity.js';
import type { CreateJobDto, ListJobsQuery, UpdateJobDto } from './jobs.schemas.js';

/**
 * The current user's jobs. Every method takes the user's id and filters by it, so an id from the URL can never reach
 * another user's row; a job that is not theirs is "not found" (docs/design/v0.2-jobs.md).
 */
@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(JobStageChange) private readonly stageChanges: Repository<JobStageChange>,
    private readonly dataSource: DataSource,
  ) {}

  /** Creates the job and its first history entry together (decision 028). */
  async create(userId: string, dto: CreateJobDto): Promise<Job> {
    const job = this.jobs.create({ ...dto, userId });
    assertSalaryIsComplete(job);
    return this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(job);
      await manager.insert(JobStageChange, { jobId: saved.id, fromStatus: null, toStatus: saved.status });
      return saved;
    });
  }

  /**
   * Moves the job to another stage and records the move in the same transaction, so no change escapes the history
   * (decision 028). The row is locked first: two concurrent moves record the right "from" stage one after the other.
   * Moving to the current stage changes nothing and records nothing.
   */
  async changeStatus(userId: string, id: string, status: JobStatus): Promise<Job> {
    return this.dataSource.transaction(async (manager) => {
      const job = await manager.findOne(Job, { where: { id, userId }, lock: { mode: 'pessimistic_write' } });
      if (!job) {
        throw new NotFoundException('Job not found');
      }
      if (job.status === status) {
        return job;
      }
      await manager.insert(JobStageChange, { jobId: job.id, fromStatus: job.status, toStatus: status });
      job.status = status;
      return manager.save(job);
    });
  }

  /** The job's moves, oldest first. Checks ownership first, like every other method. */
  async history(userId: string, id: string): Promise<JobStageChange[]> {
    await this.findOne(userId, id);
    return this.stageChanges.find({ where: { jobId: id }, order: { changedAt: 'ASC' } });
  }

  list(userId: string, { status, q }: ListJobsQuery): Promise<Job[]> {
    const query = this.jobs
      .createQueryBuilder('job')
      .where('job.userId = :userId', { userId })
      .orderBy('job.updatedAt', 'DESC');
    if (status) {
      query.andWhere('job.status = :status', { status });
    }
    if (q) {
      // The search text is matched literally: % and _ lose their LIKE meaning.
      const pattern = `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
      query.andWhere('(job.company ILIKE :pattern OR job.title ILIKE :pattern)', { pattern });
    }
    return query.getMany();
  }

  async findOne(userId: string, id: string): Promise<Job> {
    const job = await this.jobs.findOneBy({ id, userId });
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    return job;
  }

  async update(userId: string, id: string, changes: UpdateJobDto): Promise<Job> {
    const job = await this.findOne(userId, id);
    Object.assign(job, changes);
    // Checked on the merged job: a change to one salary field must still fit the others.
    assertSalaryIsComplete(job);
    return this.jobs.save(job);
  }

  async remove(userId: string, id: string): Promise<void> {
    const { affected } = await this.jobs.delete({ id, userId });
    if (!affected) {
      throw new NotFoundException('Job not found');
    }
  }
}

/** An amount needs its currency and period, and the range must be in order (decision 029; the table checks it too). */
function assertSalaryIsComplete(job: Job): void {
  const hasAmount = job.salaryMin != null || job.salaryMax != null;
  if (hasAmount && (!job.salaryCurrency || !job.salaryPeriod)) {
    throw new BadRequestException('A salary needs its currency and period');
  }
  if (job.salaryMin != null && job.salaryMax != null && job.salaryMin > job.salaryMax) {
    throw new BadRequestException('salaryMin must not be greater than salaryMax');
  }
}
