import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobStageChange } from './job-stage-change.entity.js';
import { Job } from './job.entity.js';
import { JobsController } from './jobs.controller.js';
import { JobsService } from './jobs.service.js';

/** v0.2 Jobs: every posting the user tracks (docs/design/v0.2-jobs.md). */
@Module({
  imports: [TypeOrmModule.forFeature([Job, JobStageChange])],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}
