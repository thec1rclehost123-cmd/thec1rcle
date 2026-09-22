import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    exclude: ['dist/**', 'node_modules/**'],
    env: {
      // src/lib/encryption.ts throws at module-import time (by design — see
      // its own comment) if this is unset, so any test file that transitively
      // imports a route module using encrypt()/decrypt() fails before a
      // single test runs, even if that test never exercises the encrypted
      // code path. Every route touching real encrypt()/decrypt() operates on
      // fastify.db, which is a plain in-memory mock in every current test —
      // no test hits real Firestore or round-trips real ciphertext, so this
      // placeholder never has anything real to protect. Mirrors the
      // REDIS_URL placeholder pattern in packages/core/vitest.config.ts.
      ENCRYPTION_KEY: 'test-only-encryption-key-do-not-use-in-production',
      // src/config/index.ts validates the env at import time. V2 partner
      // routes build their services via lib/v2-services.ts, which reads
      // coreConfig from there — so any suite touching a V2 route needs a
      // FIREBASE_PROJECT_ID. Tests only use the memory repositories; nothing
      // real is created or contacted.
      FIREBASE_PROJECT_ID: 'test-project',
    },
  },
  coverage: {
    provider: 'v8',
  },
});
