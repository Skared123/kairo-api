import { defineConfig } from 'vitest/config';
import { testDatabaseUrl } from './test/test-env.js';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Builds the app and migrates the test database once before the suite (decision 013).
    globalSetup: ['./test/global-setup.ts'],
    // The app reads these before .env, so every e2e test talks to the test database.
    env: { NODE_ENV: 'test', DATABASE_URL: testDatabaseUrl() },
    // Test files share one database, so they run one after another.
    fileParallelism: false,
  },
});
