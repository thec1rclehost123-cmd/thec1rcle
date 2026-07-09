import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    exclude: ['dist/**', 'node_modules/**'],
    env: {
      RAZORPAY_WEBHOOK_SECRET: 'ci-test-webhook-secret',
    },
  },
  coverage: {
    provider: 'v8',
  },
});
