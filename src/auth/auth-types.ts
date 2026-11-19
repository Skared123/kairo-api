import type { AuthUser } from './auth-user.js';

// Tells @nestjs/authentication the app's user type, so @CurrentUser('key') and AuthenticationContext are typed.
declare module '@nestjs/authentication' {
  interface AuthenticationTypes {
    user: AuthUser;
  }
}
