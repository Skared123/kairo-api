import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type Repository } from 'typeorm';
import { JobStageChange } from './job-stage-change.entity.js';
import type { JobStatus } from './job.enums.js';
import { Job } from './job.entity.js';
import type { CreateJobDto, ListJobsQuery, UpdateJobDto } from './jobs.schemas.js';

/** How similar a company and a title must both be to flag a possible duplicate, from 0 to 1 (decision 031). */
const SIMILAR_ENOUGH = 0.6;
/** The most possible duplicates POST /jobs lists. */
const MAX_DUPLICATES = 5;

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

  /**
   * The user's other jobs that may be the same posting as `job`, which was just saved (decision 031). Warns, never
   * blocks: POST /jobs answers them as `possibleDuplicates`.
   *
   * A job is a possible duplicate when it has the same URL, or when both its company and its title are similar to
   * `job`'s according to pg_trgm (https://www.postgresql.org/docs/current/pgtrgm.html), which compares the
   * three-letter pieces of each text, ignoring case and punctuation:
   * - The company uses `word_similarity` in both directions, so "Acme" matches "Acme Robotics Inc.".
   * - The title uses `similarity`, which weighs the whole text: "Senior Full-Stack Engineer" matches
   *   "Senior Fullstack Engineer" (0.86), "Senior Backend Engineer" does not (0.52).
   * Both must reach SIMILAR_ENOUGH, so another role at the same company is not flagged. Same URL first, then the most
   * similar, at most MAX_DUPLICATES.
   *
   * No trigram index: the user's own jobs (a few hundred at most, found through jobs_user_id_idx) are the only rows
   * compared, and a GIN index would not serve these expressions anyway.
   */
  async findPossibleDuplicates(userId: string, job: Job): Promise<Job[]> {
    const sameUrl = 'job.url = :url';
    const company = 'GREATEST(word_similarity(:company, job.company), word_similarity(job.company, :company))';
    const title = 'similarity(:title, job.title)';
    return this.jobs
      .createQueryBuilder('job')
      .where('job.userId = :userId', { userId })
      .andWhere('job.id <> :id', { id: job.id })
      // A null URL never matches: in SQL, `NULL = NULL` is not true.
      .andWhere(`(${sameUrl} OR (${company} >= :threshold AND ${title} >= :threshold))`)
      .orderBy(sameUrl, 'DESC', 'NULLS LAST')
      .addOrderBy(`${company} + ${title}`, 'DESC')
      .addOrderBy('job.updatedAt', 'DESC')
      .setParameters({ url: job.url, company: job.company, title: job.title, threshold: SIMILAR_ENOUGH })
      .limit(MAX_DUPLICATES)
      .getMany();
  }

  /** The job's moves, oldest first. Checks ownership first, like every other method. */
  async history(userId: string, id: string): Promise<JobStageChange[]> {
    await this.findOne(userId, id);
    return this.stageChanges.find({ where: { jobId: id }, order: { changedAt: 'ASC' } });
  }

  list(userId: string, { status, q, sort }: ListJobsQuery): Promise<Job[]> {
    const query = this.jobs.createQueryBuilder('job').where('job.userId = :userId', { userId });
    if (sort === 'followUp') {
      query.orderBy('job.nextFollowUpOn', 'ASC', 'NULLS LAST').addOrderBy('job.updatedAt', 'DESC');
    } else {
      query.orderBy('job.updatedAt', 'DESC');
    }
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
