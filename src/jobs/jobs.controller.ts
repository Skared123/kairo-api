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
  createJobSchema,
  jobSchema,
  listJobsQuerySchema,
  toJobResponse,
  updateJobSchema,
  type CreateJobDto,
  type JobResponse,
  type ListJobsQuery,
  type UpdateJobDto,
} from './jobs.schemas.js';
import { JobsService } from './jobs.service.js';

/**
 * The signed-in user's jobs. Any account may use these routes, for its own jobs only: the service scopes every query
 * to the user, and another user's job answers 404, never 403, so its existence is not revealed.
 */
@ApiTags('jobs')
@Can.Anyone()
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  @ApiOkResponse({ standardSchema: jobSchema, isArray: true })
  async list(
    @CurrentUser('id') userId: string,
    @Query({ schema: listJobsQuerySchema }) query: ListJobsQuery,
  ): Promise<JobResponse[]> {
    return (await this.jobs.list(userId, query)).map(toJobResponse);
  }

  @Post()
  @ApiCreatedResponse({ standardSchema: jobSchema })
  @ApiBadRequestResponse({ description: 'Invalid fields, or a salary without its currency and period' })
  async create(@CurrentUser('id') userId: string, @Body({ schema: createJobSchema }) body: CreateJobDto) {
    return toJobResponse(await this.jobs.create(userId, body));
  }

  @Get(':id')
  @ApiOkResponse({ standardSchema: jobSchema })
  @ApiNotFoundResponse({ description: 'Job not found' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<JobResponse> {
    return toJobResponse(await this.jobs.findOne(userId, id));
  }

  @Patch(':id')
  @ApiOkResponse({ standardSchema: jobSchema })
  @ApiNotFoundResponse({ description: 'Job not found' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body({ schema: updateJobSchema }) body: UpdateJobDto,
  ): Promise<JobResponse> {
    return toJobResponse(await this.jobs.update(userId, id, body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Job not found' })
  async remove(@CurrentUser('id') userId: string, @Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.jobs.remove(userId, id);
  }
}
