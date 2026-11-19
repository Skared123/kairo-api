import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import type { Env } from './config/env.schema.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const config: ConfigService<Env, true> = app.get(ConfigService);

  // Swagger UI at /docs; kairo-web generates its API types from /docs/openapi.json (decisions 003 and 007).
  const openApi = new DocumentBuilder().setTitle('Kairo API').setVersion('0.1.0').build();
  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, openApi), {
    jsonDocumentUrl: 'docs/openapi.json',
  });

  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
