import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      // Prevents real Redis connection attempts during tests.
      // Modules that check REDIS_URL === 'PLACEHOLDER' return null early;
      // individual test files mock getRedisClient() for the actual calls.
      REDIS_URL: 'PLACEHOLDER',
    },
    forks: { isolate: true },
    // Build output must never be collected as tests: dist/*.test.js resolves
    // source-relative paths that only exist under src/, so a stale local
    // build would fail. Mirrors apps/api-gateway/vitest.config.mjs.
    exclude: ['dist/**', 'node_modules/**'],
  },
});
