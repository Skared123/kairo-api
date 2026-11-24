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
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  createInteractionSchema,
  interactionSchema,
  toInteractionResponse,
  updateInteractionSchema,
  type CreateInteractionDto,
  type InteractionResponse,
  type UpdateInteractionDto,
} from './contact-interactions.schemas.js';
import { ContactInteractionsService } from './contact-interactions.service.js';

/**
 * The log of conversations with one of the user's contacts (decision 038). Another user's contact, or a conversation
 * of another contact, answers 404.
 */
@ApiTags('contacts')
@Can.Anyone()
@Controller('contacts/:contactId/interactions')
export class ContactInteractionsController {
  constructor(private readonly interactions: ContactInteractionsService) {}

  @Get()
  @ApiOkResponse({ standardSchema: interactionSchema, isArray: true })
  @ApiNotFoundResponse({ description: 'Contact not found' })
  async list(
    @CurrentUser('id') userId: string,
    @Param('contactId', new ParseUUIDPipe()) contactId: string,
  ): Promise<InteractionResponse[]> {
    return (await this.interactions.list(userId, contactId)).map(toInteractionResponse);
  }

  @Post()
  @ApiCreatedResponse({ standardSchema: interactionSchema })
  @ApiNotFoundResponse({ description: 'Contact not found' })
  async create(
    @CurrentUser('id') userId: string,
    @Param('contactId', new ParseUUIDPipe()) contactId: string,
    @Body({ schema: createInteractionSchema }) body: CreateInteractionDto,
  ): Promise<InteractionResponse> {
    return toInteractionResponse(await this.interactions.create(userId, contactId, body));
  }

  @Patch(':id')
  @ApiOkResponse({ standardSchema: interactionSchema })
  @ApiNotFoundResponse({ description: 'Contact or interaction not found' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('contactId', new ParseUUIDPipe()) contactId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body({ schema: updateInteractionSchema }) body: UpdateInteractionDto,
  ): Promise<InteractionResponse> {
    return toInteractionResponse(await this.interactions.update(userId, contactId, id, body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Contact or interaction not found' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('contactId', new ParseUUIDPipe()) contactId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.interactions.remove(userId, contactId, id);
  }
}
