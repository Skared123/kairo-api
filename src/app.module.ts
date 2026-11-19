import { Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { envSchema, type Env } from './config/env.schema.js';
import { buildDataSourceOptions } from './database/database.config.js';

@Module({
  imports: [
    // The app refuses to start when an environment variable is missing or invalid.
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        buildDataSourceOptions(config.get('DATABASE_URL', { infer: true })),
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Registered here rather than in main.ts so end-to-end tests, which skip main.ts, validate requests too.
    { provide: APP_PIPE, useValue: new StandardSchemaValidationPipe() },
  ],
})
export class AppModule {}
