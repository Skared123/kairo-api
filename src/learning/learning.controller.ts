import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  createLearningItemSchema,
  learningItemSchema,
  toLearningItemResponse,
  updateLearningItemSchema,
  type CreateLearningItemDto,
  type LearningItemResponse,
  type UpdateLearningItemDto,
} from './learning.schemas.js';
import { LearningService } from './learning.service.js';

/**
 * The signed-in user's learning items. Any account may use these routes, for its own items only: another user's item
 * answers 404, never 403.
 */
@ApiTags('learning')
@Can.Anyone()
@Controller('learning')
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  @Get()
  @ApiOkResponse({ standardSchema: learningItemSchema, isArray: true })
  async list(@CurrentUser('id') userId: string): Promise<LearningItemResponse[]> {
    return (await this.learning.list(userId)).map(toLearningItemResponse);
  }

  @Post()
  @ApiCreatedResponse({ standardSchema: learningItemSchema })
  async create(
    @CurrentUser('id') userId: string,
    @Body({ schema: createLearningItemSchema }) body: CreateLearningItemDto,
  ): Promise<LearningItemResponse> {
    return toLearningItemResponse(await this.learning.create(userId, body));
  }

  @Get(':id')
  @ApiOkResponse({ standardSchema: learningItemSchema })
  @ApiNotFoundResponse({ description: 'Learning item not found' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<LearningItemResponse> {
    return toLearningItemResponse(await this.learning.findOne(userId, id));
  }

  /** Changes any field; `skills` replaces the whole set. */
  @Patch(':id')
  @ApiOkResponse({ standardSchema: learningItemSchema })
  @ApiNotFoundResponse({ description: 'Learning item not found' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body({ schema: updateLearningItemSchema }) body: UpdateLearningItemDto,
  ): Promise<LearningItemResponse> {
    return toLearningItemResponse(await this.learning.update(userId, id, body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Learning item not found' })
  async remove(@CurrentUser('id') userId: string, @Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.learning.remove(userId, id);
  }
}
