import { AuthenticationModule } from '@nestjs/authentication';
import { AuthorizationModule } from '@nestjs/authorization';
import { Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { ContactsModule } from './contacts/contacts.module.js';
import { envSchema, type Env } from './config/env.schema.js';
import { buildDataSourceOptions } from './database/database.config.js';
import { JobsModule } from './jobs/jobs.module.js';
import { TasksModule } from './tasks/tasks.module.js';
import { TodayModule } from './today/today.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    // The app refuses to start when an environment variable is missing or invalid.
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        buildDataSourceOptions(config.get('DATABASE_URL', { infer: true })),
    }),
    // Registers a global guard: every route needs a signed-in user unless it is marked @Public() (decision 008).
    AuthenticationModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        session: {
          // Signed out after 14 days however active, or after 3 days without a request (decision 014).
          absoluteTtl: '14d',
          idleTtl: '3d',
          // kairo-web runs on another origin than the API; the same list as enableCsrfProtection() in app.setup.ts.
          trustedOrigins: [config.get('WEB_ORIGIN', { infer: true })],
          // Kept with each session for a future "where you're signed in" page.
          metadata: (request) => ({ userAgent: request.headers['user-agent'] }),
        },
      }),
    }),
    // Deny by default: every route needs @Can(), @Can.Anyone() or @Public(). It must come after AuthenticationModule,
    // whose guard sets the user it checks; the module refuses to start otherwise.
    AuthorizationModule.forRoot(),
    AuthModule,
    UsersModule,
    JobsModule,
    TasksModule,
    TodayModule,
    ContactsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Registered here rather than in main.ts so end-to-end tests, which skip main.ts, validate requests too.
    { provide: APP_PIPE, useValue: new StandardSchemaValidationPipe() },
  ],
})
export class AppModule {}
