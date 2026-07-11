import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@c1rcle/core/onboarding-service': `${repoRoot}/packages/core/onboarding-service.js`,
      '@c1rcle/core/recommendation-engine': `${repoRoot}/packages/core/recommendation-engine.js`,
      '@c1rcle/core/user-service': `${repoRoot}/packages/core/user-service.js`,
    },
  },
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
