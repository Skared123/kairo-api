import { Module } from '@nestjs/common';
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
  providers: [AppService],
})
export class AppModule {}
