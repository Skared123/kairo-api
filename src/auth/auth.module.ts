import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity.js';
import './auth-types.js';
import { AuthController } from './auth.controller.js';
import { CredentialsService } from './credentials.service.js';
import { SessionAuth } from './session-auth.provider.js';
import { Session } from './session.entity.js';
import { TypeOrmSessionStore } from './typeorm-session.store.js';

/**
 * The app's side of authentication. AuthenticationModule (imported in AppModule) provides the guard, the session
 * service and the password hasher; the store and the provider here register themselves with it.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User, Session])],
  controllers: [AuthController],
  providers: [TypeOrmSessionStore, SessionAuth, CredentialsService],
})
export class AuthModule {}
