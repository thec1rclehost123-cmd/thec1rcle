/**
 * Global ambient type declarations for THE C1RCLE API Gateway.
 *
 * The @c1rcle/core/* packages are plain JavaScript modules with no TypeScript
 * declaration files. This wildcard module declaration tells TypeScript to
 * treat all imports from those packages as `any`, suppressing TS7016 errors
 * while keeping strict type-checking for all our own TypeScript source files.
 *
 * NOTE: Do NOT add `declare module 'fastify'` here — in an ambient script file
 * (no top-level import/export), `declare module 'fastify'` creates a NEW module
 * declaration that shadows the real fastify module instead of augmenting it.
 * Put Fastify augmentations in a separate file with a top-level import.
 */
declare module '@c1rcle/core/*';
