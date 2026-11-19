import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './config/env.schema.js';

/**
 * HTTP settings that main.ts and the end-to-end tests share, so the tests run the same CORS and CSRF rules as the
 * real server. Call it right after creating the app, before init() or listen().
 */
export function configureApp(app: INestApplication): void {
  const config: ConfigService<Env, true> = app.get(ConfigService);
  const webOrigin = config.get('WEB_ORIGIN', { infer: true });

  // Refuses state-changing requests from other origins' pages, on every route, public ones included.
  // kairo-web runs on another origin than the API, so it is trusted, as in session.trustedOrigins.
  app.enableCsrfProtection({ trustedOrigins: [webOrigin] });

  // Only kairo-web may call the API from a browser, with the session cookie. Never `origin: true` with credentials.
  app.enableCors({ origin: webOrigin, credentials: true });
}
