import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CriteriaController } from './criteria.controller.js';
import { CriteriaService } from './criteria.service.js';
import { JobCriteria } from './job-criteria.entity.js';
import { JobStageChange } from './job-stage-change.entity.js';
import { Job } from './job.entity.js';
import { JobsController } from './jobs.controller.js';
import { JobsService } from './jobs.service.js';

/** v0.2 Jobs: every posting the user tracks (docs/design/v0.2-jobs.md). */
@Module({
  imports: [TypeOrmModule.forFeature([Job, JobStageChange, JobCriteria])],
  controllers: [JobsController, CriteriaController],
  providers: [JobsService, CriteriaService],
})
export class JobsModule {}
