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
  createTaskSchema,
  listTasksQuerySchema,
  taskSchema,
  toTaskResponse,
  updateTaskSchema,
  type CreateTaskDto,
  type ListTasksQuery,
  type TaskResponse,
  type UpdateTaskDto,
} from './tasks.schemas.js';
import { TasksService } from './tasks.service.js';

/**
 * The signed-in user's tasks. Any account may use these routes, for its own tasks only: another user's task answers
 * 404, never 403, and another user's job is "not found" too.
 */
@ApiTags('tasks')
@Can.Anyone()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @ApiOkResponse({ standardSchema: taskSchema, isArray: true })
  async list(
    @CurrentUser('id') userId: string,
    @Query({ schema: listTasksQuerySchema }) query: ListTasksQuery,
  ): Promise<TaskResponse[]> {
    return (await this.tasks.list(userId, query)).map(toTaskResponse);
  }

  @Post()
  @ApiCreatedResponse({ standardSchema: taskSchema })
  @ApiBadRequestResponse({ description: "Invalid fields, or a job that is not one of the user's (job_not_found)" })
  async create(
    @CurrentUser('id') userId: string,
    @Body({ schema: createTaskSchema }) body: CreateTaskDto,
  ): Promise<TaskResponse> {
    return toTaskResponse(await this.tasks.create(userId, body));
  }

  @Get(':id')
  @ApiOkResponse({ standardSchema: taskSchema })
  @ApiNotFoundResponse({ description: 'Task not found' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<TaskResponse> {
    return toTaskResponse(await this.tasks.findOne(userId, id));
  }

  /** Changes any field, or marks the task done (`done: true`) or open again (`done: false`). */
  @Patch(':id')
  @ApiOkResponse({ standardSchema: taskSchema })
  @ApiBadRequestResponse({ description: "Invalid fields, or a job that is not one of the user's (job_not_found)" })
  @ApiNotFoundResponse({ description: 'Task not found' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body({ schema: updateTaskSchema }) body: UpdateTaskDto,
  ): Promise<TaskResponse> {
    return toTaskResponse(await this.tasks.update(userId, id, body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Task not found' })
  async remove(@CurrentUser('id') userId: string, @Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.tasks.remove(userId, id);
  }
}
