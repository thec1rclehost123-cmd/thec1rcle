/**
 * Global ambient type declarations for THE C1RCLE API Gateway.
 *
 * The @c1rcle/core/* packages are plain JavaScript modules with no TypeScript
 * declaration files. This wildcard module declaration tells TypeScript to
 * treat all imports from those packages as `any`, suppressing TS7016 errors
 * while keeping strict type-checking for all our own TypeScript source files.
 */
declare module "@c1rcle/core/*";
