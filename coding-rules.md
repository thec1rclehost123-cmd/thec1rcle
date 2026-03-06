# Coding Philosophy

The C1rcle codebase is built on the foundation of **stability, maintainability, and visual excellence**. We prioritize robust, predictable code over experimental patterns.

*   **Stability First**: Do not break working functionality to improve style.
*   **Conservative Changes**: Prefer minimal, targeted fixes over broad rewrites.
*   **Respect Architecture**: Use existing patterns (hooks, stores, utilities) instead of introducing new ones.
*   **Visual Polish**: We are a premium platform; smooth animations and high-quality UI are non-negotiable.

# General Development Rules

*   **Change the minimum code required**. If a fix is 3 lines, don't rewrite the entire function.
*   **Do not modify unrelated files**. Avoid "cleaning up" files outside the scope of your current task.
*   **Preserve signatures**: Do not change function signatures or return shapes of existing utilities.
*   **No placeholders**: Use real data or calculated fallbacks. Do not use generic placeholders in UI.

# File Organization

*   **Apps**: `apps/` contains deployable units.
*   **Packages**: `packages/` contains shared code.
*   **Domain Logic**: All business logic must reside in `@c1rcle/core`.
*   **Components**: Extracted components belong in `components/` (app-specific) or `@c1rcle/ui` (shared).
*   **Server Logic**: Files in `lib/server/` are server-only. **Never** import them in client components.

# Naming Conventions

*   **React Components**: PascalCase (`EventCard.tsx`, `ShimmerImage.jsx`).
*   **Stores**: camelCase with `Store` suffix (`exploreStore.js`).
*   **Utilities/Hooks**: camelCase (`useAuth.js`, `apiClient.js`).
*   **Constants**: UPPER_SNAKE_CASE (`CACHE_TTL_MS`).
*   **TypeScript Interfaces**: `I` prefix for contracts (`IAuthService`).

# JavaScript / TypeScript Rules

*   **Async/Await**: Prefer `async/await` over `.then().catch()` chains.
*   **Small Functions**: Keep functions focused. Extract if they grow too complex.
*   **Descriptive Variables**: `isLoading` instead of `l`, `eventList` instead of `data`.
*   **No Console Logs**: Remove `console.log` before committing. Use `console.error` for actual errors with context.
*   **Runtime Validation**: Use **Zod** for any data entering the system via APIs.
*   **Strict Types**: In TS-enabled packages, `strict: true` is mandatory.

# React Rules

*   **Functional Components**: Use functional components and hooks exclusively.
*   **Small Components**: Extract components if they exceed ~200 lines.
*   **Server Components**: We use Next.js App Router; keep components as Server Components by default. Use `"use client"` only when necessary (hooks, browser APIs).
*   **Optimization**: Use `useMemo` and `useCallback` judiciously to prevent expensive re-renders in visual-heavy components.
*   **Prop Drilling**: Prefer Zustand stores or Context Providers for deep state prop-drilling.

# API Coding Rules

*   **Next.js API Routes**: Follow the standard pattern:
    ```javascript
    export async function GET(request) {
      try {
        const data = await libFunction(params);
        return NextResponse.json({ data, hasMore: false });
      } catch (error) {
        console.error("API Error", error);
        return NextResponse.json({ error: "Context message" }, { status: 500 });
      }
    }
    ```
*   **Response Shape**: Standardize on `{ data, hasMore, nextCursor }` for paginated lists.

# Error Handling Standards

*   All API and core logic must be wrapped in `try/catch`.
*   Log errors with context using the platform's logger (Pino in Gateway, console on Web).
*   Provide user-friendly error messages in the UI while logging technical details to the server.

# Performance Rules

*   **Caching**: Respect `CACHE_TTL_MS` (default 5 minutes) in Zustand stores.
*   **GPU Acceleration**: Use `will-change` and `translateZ(0)` for heavy animations/blurs to offload work to the GPU.
*   **Deferral**: Use `requestIdleCallback` (see `CacheWarmer.js`) for non-critical prefetching.
*   **No Polling**: Use WebSockets (Fastify) or Firestore real-time listeners; avoid manual `setInterval` polling for data.

# Dependency Rules

*   **Approval Required**: Do not add new npm packages without explicit approval.
*   **Use Existing**: Leverage existing utilities in `@c1rcle/core` (e.g., `time` utilities) instead of adding libraries like `moment` or `dayjs`.
*   **Primary Libs**: 
    - Icons: Lucide React.
    - Animation: Framer Motion / GSAP.
    - Validation: Zod.

# Code Review Guidelines

Before submitting or approving a PR, verify:
1.  Does it follow the existing architectural pattern?
2.  Is it a minimal fix, or is it an unnecessary refactor?
3.  Are there any `console.log` statements left?
4.  Does it break existing TypeScript types or unit tests?
5.  Is the UI performant (no unnecessary re-renders)?
