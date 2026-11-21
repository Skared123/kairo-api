import { Can } from '@nestjs/authorization';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccountPolicy } from './account.policy.js';
import {
  accountSchema,
  createAccountSchema,
  createdAccountSchema,
  temporaryPasswordSchema,
  toAccount,
  updateAccountSchema,
  type Account,
  type CreateAccountDto,
  type CreatedAccount,
  type TemporaryPassword,
  type UpdateAccountDto,
} from './accounts.schemas.js';
import { AccountsService } from './accounts.service.js';

/** Account management, for admins only. Returns accounts, never what their users keep in the app. */
@ApiTags('admin')
@ApiForbiddenResponse({ description: 'Not an admin' })
@Can(AccountPolicy, 'manage')
@Controller('admin/users')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  @ApiOkResponse({ standardSchema: accountSchema, isArray: true })
  async list(): Promise<Account[]> {
    return (await this.accounts.list()).map(toAccount);
  }

  /** The temporary password is shown in this response only; the user must change it at the first sign-in. */
  @Post()
  @ApiCreatedResponse({ standardSchema: createdAccountSchema })
  @ApiConflictResponse({ description: 'An account with this email already exists' })
  async create(@Body({ schema: createAccountSchema }) body: CreateAccountDto): Promise<CreatedAccount> {
    const { user, temporaryPassword } = await this.accounts.create(body);
    return { account: toAccount(user), temporaryPassword };
  }

  @Patch(':id')
  @ApiOkResponse({ standardSchema: accountSchema })
  @ApiNotFoundResponse({ description: 'Account not found' })
  @ApiConflictResponse({ description: 'There must be at least one active admin' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body({ schema: updateAccountSchema }) body: UpdateAccountDto,
  ): Promise<Account> {
    return toAccount(await this.accounts.update(id, body));
  }

  /** For a forgotten password: a new temporary one, shown once, and the account's sessions end. */
  @Post(':id/password')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ standardSchema: temporaryPasswordSchema })
  @ApiNotFoundResponse({ description: 'Account not found' })
  async resetPassword(@Param('id', new ParseUUIDPipe()) id: string): Promise<TemporaryPassword> {
    return { temporaryPassword: await this.accounts.resetPassword(id) };
  }
}
