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
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  contactSchema,
  createContactSchema,
  listContactsQuerySchema,
  toContactResponse,
  updateContactSchema,
  type ContactResponse,
  type CreateContactDto,
  type ListContactsQuery,
  type UpdateContactDto,
} from './contacts.schemas.js';
import { ContactsService } from './contacts.service.js';

/**
 * The signed-in user's contacts. Any account may use these routes, for its own contacts only: another user's contact
 * answers 404, never 403.
 */
@ApiTags('contacts')
@Can.Anyone()
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  @ApiOkResponse({ standardSchema: contactSchema, isArray: true })
  async list(
    @CurrentUser('id') userId: string,
    @Query({ schema: listContactsQuerySchema }) query: ListContactsQuery,
  ): Promise<ContactResponse[]> {
    return (await this.contacts.list(userId, query)).map(toContactResponse);
  }

  @Post()
  @ApiCreatedResponse({ standardSchema: contactSchema })
  async create(
    @CurrentUser('id') userId: string,
    @Body({ schema: createContactSchema }) body: CreateContactDto,
  ): Promise<ContactResponse> {
    return toContactResponse(await this.contacts.create(userId, body));
  }

  @Get(':id')
  @ApiOkResponse({ standardSchema: contactSchema })
  @ApiNotFoundResponse({ description: 'Contact not found' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ContactResponse> {
    return toContactResponse(await this.contacts.findOne(userId, id));
  }

  /** Changes any field, including the next follow-up. */
  @Patch(':id')
  @ApiOkResponse({ standardSchema: contactSchema })
  @ApiNotFoundResponse({ description: 'Contact not found' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body({ schema: updateContactSchema }) body: UpdateContactDto,
  ): Promise<ContactResponse> {
    return toContactResponse(await this.contacts.update(userId, id, body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Contact not found' })
  async remove(@CurrentUser('id') userId: string, @Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.contacts.remove(userId, id);
  }
}
