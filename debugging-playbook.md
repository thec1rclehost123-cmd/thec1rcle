# Debugging Philosophy

Debugging at C1rcle is about **precision and root-cause identification**. We do not "patch" symptoms; we find why the data flow was interrupted and fix the source.

*   **Evidence-Based**: Use logs and traces instead of guessing.
*   **Trace the Chain**: Follow data from UI → Store → API → Core → Firestore.
*   **Minimal Intervention**: The best fix is the one that changes the least amount of stable code.

# Standard Debugging Workflow

1.  **Reproduce**: Confirm the issue consistently. Note the specific environment (dev, staging, prod).
2.  **Isolate**: Check if the bug is UI-only, API-linked, or a logic error in `@c1rcle/core`.
3.  **Analyze Logs**: 
    *   Web: Check browser console and Vercel logs.
    *   Gateway: Check Pino logs in the terminal or GCP.
    *   Functions: Check Firebase console logs.
4.  **Identify Root Cause**: Determine if it's a code bug, missing env var, or a database state issue.
5.  **Implement Fix**: Propose and apply the smallest possible fix.
6.  **Verify**: Re-run the reproduction steps and ensure no regressions.

# Frontend Debugging

*   **State Issues**: Use React DevTools/Zustand devtools to inspect store state.
*   **Rendering**: Use "Highlight Updates" in React DevTools to find unnecessary re-renders causing lag.
*   **Network**: Check the "Network" tab. Is it calling `:4000` (wrong) or `/api/*` (correct)? Check the response payload shape.
*   **Animations**: If an animation is stuttering, check for layout thrashing or lack of GPU acceleration.

# Backend Debugging

*   **API Gateway**: All routes use Zod. If a call is failing with 400, your request body/params don't match the schema in `routes/v1/`.
*   **Auth Failure**: Ensure `Authorization: Bearer <token>` is present. Check if `firebase-admin` is initialized correctly on the server.
*   **Timeouts**: Often caused by slow Firestore queries or missing indices. Check the logs for `DEADLINE_EXCEEDED`.

# Database Debugging

*   **Firestore Rules**: If you get a "Permission Denied," check `firestore.rules`.
*   **Data Structure**: Check the actual document in the Firebase Console. Is a field missing or of the wrong type (e.g., string vs timestamp)?
*   **Indices**: If a query is complex, ensure the composite index is created in `firestore.indexes.json`.

# Performance Debugging

*   **Heavy Logs**: Excessive logging in high-frequency loops.
*   **React Query**: Check if `staleTime` is too low, causing constant refetching.
*   **Redis**: If the Gateway is slow, verify if Redis is reachable and if `fastify.cache.get` is actually returning hits.
*   **Layout Thrashing**: Using `getBoundingClientRect()` inside a scroll listener without throttling or standard observers.

# Logging Guidelines

*   **Context is King**: Never log `console.error("error")`. Log `console.error("[FeatureName] Failed to load data", { error, params })`.
*   **Levels**:
    *   `INFO`: Flow tracking (low frequency).
    *   `WARN`: Non-breaking issues (e.g., fallback data used).
    *   `ERROR`: Breaking issues requiring developer attention.
*   **PII**: Never log user passwords, emails, or phone numbers in plaintext.

# Safe Fix Strategy

*   **Don't Refactor**: If you're fixing a bug, do not rename the function just because it "looks better."
*   **Test**: Run `npm run test` after applying a fix to ensure business logic in `core` is intact.
*   **Comments**: If the fix is a workaround for a third-party bug or a temporary platform quirk, add a `// TODO: [Context]` or `// FIXME: [Reason]` comment.

# Common Issue Patterns

*   **Connection Refused**: Usually means the Gateway (:4000) or Redis isn't running locally. Run `docker-compose up`.
*   **Circular Dependencies**: Importing from `packages/core` into its own sub-files inappropriately.
*   **Environment Mismatch**: `isFirebaseConfigured()` returning `false` because of a missing `.env.local` file.
*   **Hydration Mismatch**: Caused by browser-only code (Three.js/GSAP) running on the server without a `useEffect` or `"use client"` guard.
