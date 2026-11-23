import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  changeStatusSchema,
  createdJobSchema,
  createJobSchema,
  jobSchema,
  listJobsQuerySchema,
  stageChangeSchema,
  toJobResponse,
  toPossibleDuplicate,
  toStageChangeResponse,
  updateJobSchema,
  type ChangeStatusDto,
  type CreatedJobResponse,
  type CreateJobDto,
  type JobResponse,
  type ListJobsQuery,
  type StageChangeResponse,
  type UpdateJobDto,
} from './jobs.schemas.js';
import { CriteriaService } from './criteria.service.js';
import { JobsService } from './jobs.service.js';

/**
 * The signed-in user's jobs. Any account may use these routes, for its own jobs only: the service scopes every query
 * to the user, and another user's job answers 404, never 403, so its existence is not revealed.
 */
@ApiTags('jobs')
@Can.Anyone()
@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobs: JobsService,
    private readonly criteria: CriteriaService,
  ) {}

  @Get()
  @ApiOkResponse({ standardSchema: jobSchema, isArray: true })
  async list(
    @CurrentUser('id') userId: string,
    @Query({ schema: listJobsQuerySchema }) query: ListJobsQuery,
  ): Promise<JobResponse[]> {
    const [jobs, criteria] = await Promise.all([this.jobs.list(userId, query), this.criteria.get(userId)]);
    return jobs.map((job) => toJobResponse(job, criteria));
  }

  /** Creates the job and lists the user's jobs that may be the same posting (decision 031). */
  @Post()
  @ApiCreatedResponse({ standardSchema: createdJobSchema })
  @ApiBadRequestResponse({ description: 'Invalid fields, or a salary without its currency and period' })
  async create(
    @CurrentUser('id') userId: string,
    @Body({ schema: createJobSchema }) body: CreateJobDto,
  ): Promise<CreatedJobResponse> {
    const job = await this.jobs.create(userId, body);
    const [duplicates, criteria] = await Promise.all([
      this.jobs.findPossibleDuplicates(userId, job),
      this.criteria.get(userId),
    ]);
    return { ...toJobResponse(job, criteria), possibleDuplicates: duplicates.map(toPossibleDuplicate) };
  }

  @Get(':id')
  @ApiOkResponse({ standardSchema: jobSchema })
  @ApiNotFoundResponse({ description: 'Job not found' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<JobResponse> {
    return toJobResponse(await this.jobs.findOne(userId, id), await this.criteria.get(userId));
  }

  @Patch(':id')
  @ApiOkResponse({ standardSchema: jobSchema })
  @ApiNotFoundResponse({ description: 'Job not found' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body({ schema: updateJobSchema }) body: UpdateJobDto,
  ): Promise<JobResponse> {
    return toJobResponse(await this.jobs.update(userId, id, body), await this.criteria.get(userId));
  }

  /** Moves the job to another stage; the move is recorded in its history (decision 028). */
  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ standardSchema: jobSchema })
  @ApiNotFoundResponse({ description: 'Job not found' })
  async changeStatus(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body({ schema: changeStatusSchema }) { status }: ChangeStatusDto,
  ): Promise<JobResponse> {
    return toJobResponse(await this.jobs.changeStatus(userId, id, status), await this.criteria.get(userId));
  }

  @Get(':id/history')
  @ApiOkResponse({ standardSchema: stageChangeSchema, isArray: true })
  @ApiNotFoundResponse({ description: 'Job not found' })
  async history(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<StageChangeResponse[]> {
    return (await this.jobs.history(userId, id)).map(toStageChangeResponse);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Job not found' })
  async remove(@CurrentUser('id') userId: string, @Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.jobs.remove(userId, id);
  }
}
