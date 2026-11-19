import { CurrentUser, Public, SignInService } from '@nestjs/authentication';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, UnauthorizedException } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { authUserSchema, toAuthUser, type AuthUser } from './auth-user.js';
import {
  setupSchema,
  setupStatusSchema,
  signInSchema,
  type SetupDto,
  type SetupStatus,
  type SignInDto,
} from './auth.schemas.js';
import { CredentialsService } from './credentials.service.js';

/** Signs users in and out. SignInService sets and clears the session cookie on the response itself. */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly credentials: CredentialsService,
    private readonly signInService: SignInService,
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

  /** Ends this browser's session and clears its cookie. */
  @Post('sign-out')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async signOut(): Promise<void> {
    await this.signInService.signOut();
  }

  @Get('me')
  @ApiOkResponse({ standardSchema: authUserSchema })
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
}
