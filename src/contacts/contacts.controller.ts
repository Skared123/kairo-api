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
  Put,
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
  @ApiBadRequestResponse({ description: "Invalid fields, or a job that is not one of the user's (job_not_found)" })
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

  /** Links the contact to one of the user's jobs; linking twice changes nothing (decision 036). */
  @Put(':id/jobs/:jobId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Contact or job not found' })
  async link(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
  ): Promise<void> {
    await this.contacts.link(userId, id, jobId);
  }

  @Delete(':id/jobs/:jobId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Contact or job not found' })
  async unlink(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
  ): Promise<void> {
    await this.contacts.unlink(userId, id, jobId);
  }
}
