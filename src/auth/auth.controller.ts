import { CurrentUser, Public, SessionService, SignInService } from '@nestjs/authentication';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { authUserSchema, toAuthUser, type AuthUser } from './auth-user.js';
import {
  changePasswordSchema,
  setupSchema,
  setupStatusSchema,
  signInSchema,
  type ChangePasswordDto,
  type SetupDto,
  type SetupStatus,
  type SignInDto,
} from './auth.schemas.js';
import { CredentialsService } from './credentials.service.js';
import { AllowPendingPasswordChange } from './password-change.guard.js';

/** Signs users in and out. SignInService sets and clears the session cookie on the response itself. */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly credentials: CredentialsService,
    private readonly signInService: SignInService,
    private readonly sessions: SessionService,
  ) {}

  @Public()
  @Get('setup')
  @ApiOkResponse({ standardSchema: setupStatusSchema })
  async setupStatus(): Promise<SetupStatus> {
    return { needsSetup: await this.credentials.needsSetup() };
  }

  /** Creates the first admin and signs them in. Closed for good once any user exists (decision 010). */
  @Public()
  @Post('setup')
  @ApiCreatedResponse({ standardSchema: authUserSchema })
  @ApiConflictResponse({ description: 'Setup is already complete' })
  async setup(@Body({ schema: setupSchema }) body: SetupDto): Promise<AuthUser> {
    const user = await this.credentials.setup(body);
    await this.signInService.signIn(user.id, { method: 'setup' });
    return toAuthUser(user);
  }

  @Public()
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ standardSchema: authUserSchema })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  async signIn(@Body({ schema: signInSchema }) body: SignInDto): Promise<AuthUser> {
    const user = await this.credentials.verify(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    await this.signInService.signIn(user.id, { method: 'password' });
    return toAuthUser(user);
  }

  /**
   * Changes the signed-in user's password. Whoever knew the old one may still be signed in somewhere, so this
   * browser's session gets a new id and every other session of the account ends.
   */
  @AllowPendingPasswordChange()
  @Post('password')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ standardSchema: authUserSchema })
  @ApiBadRequestResponse({ description: 'Current password is incorrect' })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body({ schema: changePasswordSchema }) body: ChangePasswordDto,
  ): Promise<AuthUser> {
    const user = await this.credentials.changePassword(userId, body);

    const rotated = await this.signInService.rotateSession();
    if (!rotated) {
      // This session was revoked while the password changed (another request signed it out). The new password is
      // saved; end the other sessions anyway and ask this browser to sign in again.
      await this.sessions.revokeAll(userId);
      throw new UnauthorizedException('Password changed, but this session ended. Sign in again.');
    }
    await this.sessions.revokeAll(userId, { except: rotated.session.id });
    return toAuthUser(user);
  }

  /** Ends this browser's session and clears its cookie. */
  @AllowPendingPasswordChange()
  @Post('sign-out')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async signOut(): Promise<void> {
    await this.signInService.signOut();
  }

  @AllowPendingPasswordChange()
  @Get('me')
  @ApiOkResponse({ standardSchema: authUserSchema })
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
}
