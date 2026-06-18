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
  },
});
