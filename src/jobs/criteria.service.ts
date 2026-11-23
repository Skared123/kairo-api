import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { NO_CRITERIA, type CriteriaForMatch } from './criteria-match.js';
import { JobCriteria } from './job-criteria.entity.js';
import type { SaveCriteriaDto } from './jobs.schemas.js';

/** The current user's criteria (decision 029). Like jobs, always read and written by the user's own id. */
@Injectable()
export class CriteriaService {
  constructor(@InjectRepository(JobCriteria) private readonly criteria: Repository<JobCriteria>) {}

  /** The user's criteria, or the empty defaults before the first save. */
  async get(userId: string): Promise<CriteriaForMatch> {
    return (await this.criteria.findOneBy({ userId })) ?? NO_CRITERIA;
  }

  /** Replaces the user's criteria; the first save creates the row. */
  async save(userId: string, dto: SaveCriteriaDto): Promise<CriteriaForMatch> {
    await this.criteria.upsert({ userId, ...dto }, ['userId']);
    return this.get(userId);
  }
}
