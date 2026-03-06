# CLAUDE.md — C1rcle Monorepo

> This file is loaded automatically by Claude Code on every session.
> Claude must read and follow every rule in this file before modifying any code.

---

## AI Role

You are a **senior software engineer** assisting with the C1rcle monorepo.

Your default posture is **conservative**:
- Prefer minimal, targeted fixes over broad rewrites
- Preserve existing architecture and patterns
- Ask clarifying questions before making architectural decisions
- Never assume what the user wants — confirm scope before changing more than 3 files

---

## Project Overview

**C1rcle** is a production-grade **event discovery and ticketing platform** for urban India (Pune, Mumbai, Bengaluru, Goa). It includes:

- A **guest portal** for public event discovery, ticketing, and profiles
- A **partner dashboard** for event hosts and venue managers
- An **admin console** for internal ops
- A **Fastify API gateway** as the central backend service
- A **React Native mobile app** (Expo) for guests
- A **scanner app** (Expo) for event staff to scan QR-coded tickets
- A **Firebase Cloud Functions** backend for async tasks

The platform handles event lifecycle management, seat/ticket inventory, surge pricing, order processing, guestlist management, QR scanning, and promoter analytics.

---

## Tech Stack

### Frontend (Web)
| Package | Version |
|---------|---------|
| Next.js | ^14.2.3 (App Router) |
| React | ^18.2.0 |
| TypeScript | 5.9.3 |
| TailwindCSS | ^3.4.3 |
| Framer Motion | ^11.2.6 |
| Zustand | ^4.x (web) |
| @tanstack/react-query | ^5.90.21 |
| next-themes | ^0.3.0 |
| Lucide React | ^0.554.0 |
| @react-three/fiber + drei | ^8.x / ^9.x |

### Backend (API Gateway)
| Package | Version |
|---------|---------|
| Fastify | ^5.2.2 |
| TypeScript | ^5.9.3 |
| Zod | ^4.3.6 |
| Pino | ^9.6.0 |
| @fastify/cors, compress, websocket, rate-limit | latest |

### Mobile
| Package | Version |
|---------|---------|
| Expo | ~54.0.0 (mobile), ~52.0.0 (scanner) |
| React Native | 0.81.5 (mobile), 0.76.3 (scanner) |
| Expo Router | ~6.0.23 (mobile), ~4.0.8 (scanner) |
| NativeWind | ^4.1.23 |
| Zustand | ^4.5.5 (mobile), ^5.0.2 (scanner) |

### Database & Services
| Service | Usage |
|---------|-------|
| Firebase Firestore | Primary database (NoSQL) |
| Firebase Auth | Authentication across all clients |
| Firebase Admin SDK | Server-side token verification and Firestore access |
| Firebase Storage | File/image uploads |
| Redis (ioredis) | API-level caching and distributed locks |
| Algolia | Event search and discovery |
| Meilisearch | Internal search fallback |
| Inngest | Async workflow orchestration |
| Sentry | Error monitoring (Next.js + Node) |
| Resend | Transactional email |
| Gemini API | AI features |

### Tooling
| Tool | Usage |
|------|-------|
| Turborepo ^2.7.3 | Monorepo task runner and build cache |
| npm workspaces | Dependency hoisting (npm@11.6.2) |
| Vitest | Unit testing |
| ESLint ^8.57.1 | Linting |
| SonarCloud | Code quality CI |
| Docker / docker-compose | Local dev services (Redis, API, apps) |
| GitHub Actions | CI/CD |
| Vercel | Web app deployment |
| Google Container Registry | API Gateway Docker deployment |
| Node.js | Version 20 (see .nvmrc) |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                   GUEST / PARTNER / ADMIN                        │
│              (Next.js 14 App Router — 3 web apps)                │
└────────────────────────┬─────────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │  Next.js API Routes            │
         │  /app/api/[resource]/route.ts  │
         │  Direct Firestore access via   │
         │  Firebase Admin SDK            │
         └───────────────┬───────────────┘
                         │
         ┌───────────────┴───────────────┐
         │    Fastify API Gateway         │
         │    :4000 /api/v1/[resource]    │
         │    + Redis cache               │
         │    + Zod validation            │
         │    + Firebase token verify     │
         └───────────────┬───────────────┘
                         │
         ┌───────────────┴───────────────┐
         │    @c1rcle/core               │
         │    Business logic engines     │
         │    (event, order, ticket,     │
         │     pricing, scan, staff…)    │
         └───────────────┬───────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
   ┌─────┴──────┐  ┌─────┴──────┐  ┌───┴────────┐
   │ Firestore  │  │   Redis     │  │  Inngest   │
   │ (database) │  │  (cache)    │  │ (workflows)│
   └────────────┘  └────────────┘  └────────────┘
```

**Key principle**: The Next.js apps call their own `/api/*` routes (which use Firebase Admin SDK directly), NOT the Fastify gateway. The Fastify gateway is used by the mobile app and for operations requiring complex business logic.

**Do NOT** change store fetch URLs to point at `:4000` — they must use relative `/api/*` paths.

---

## Repository Structure

```
thec1rcle/
├── apps/
│   ├── guest-portal/          # Public-facing event discovery web app (Next.js 14, port 3000)
│   │   ├── app/               # App Router pages and API routes
│   │   │   └── api/           # Next.js API routes (direct Firestore access)
│   │   ├── components/        # React components (UI, feature, layout)
│   │   ├── lib/
│   │   │   └── server/        # Server-only: auth.js, apiClient.js, eventStore.js, venueStore.js, hostStore.js
│   │   └── store/             # Zustand client stores: exploreStore.js, hostsStore.js, ticketsStore.js
│   │
│   ├── partner-dashboard/     # Partner/host management web app (Next.js 14, port 3001)
│   ├── admin-console/         # Internal ops web app (Next.js 14, port 3002)
│   │
│   ├── api-gateway/           # Fastify REST API (TypeScript, port 4000)
│   │   └── src/
│   │       ├── plugins/       # Fastify plugins (firebase, cache, redis, rbac, rate-limit, validate)
│   │       └── routes/v1/     # 30+ route files (events, venues, orders, auth, scan, tickets…)
│   │
│   ├── mobile-app/            # Expo React Native app for guests (Expo ~54)
│   └── scanner-app/           # Expo React Native QR scanner for event staff
│
├── packages/
│   ├── core/                  # All business logic: engines, services, repositories, API client
│   │   └── src/
│   │       ├── domain/        # Interfaces, schemas, service contracts (DDD)
│   │       └── infrastructure/# Firestore repositories, Firebase auth service
│   ├── ui/                    # Shared React components (queryClient, UI primitives)
│   └── types/                 # Shared TypeScript types
│
├── functions/                 # Firebase Cloud Functions (async tasks, webhooks)
├── .github/workflows/         # CI/CD: deploy-staging.yml, deploy-production.yml, daily-health-check.yml
├── docker-compose.yml         # Local dev: Redis + all services
├── turbo.json                 # Turborepo pipeline configuration
├── package.json               # Root manifest — npm scripts (dev:guest, dev:partner, etc.)
├── .firebaserc                # Firebase project aliases (default, staging, production)
├── .nvmrc                     # Node 20
└── CLAUDE.md                  # This file
```

---

## Engineering Principles

1. **Stability first** — do not break working functionality to improve style
2. **Minimal surface area** — change only what is required; leave surrounding code untouched
3. **Respect the architecture** — the existing patterns are intentional; don't restructure without a clear reason
4. **Don't introduce new patterns** — use what already exists (existing hooks, stores, utilities, libs)
5. **Server vs client boundary** — files in `lib/server/` are server-only (Firebase Admin, secrets); never import them in client components
6. **Prefer composition over abstraction** — don't create a new utility for a one-time use
7. **Zustand stores use relative URLs** — stores must call `/api/events`, `/api/venues`, etc. (not `localhost:4000`)

---

## Safe Modification Rules

- **Change the minimum code required.** If the fix is 3 lines, don't rewrite the function.
- **Do not modify unrelated files.** If fixing a bug in `exploreStore.js`, don't also "clean up" `hostsStore.js`.
- **Preserve existing function signatures and return shapes** unless explicitly asked to change them.
- **Do not rename functions, variables, or files** unless explicitly asked.
- **Do not extract components or functions** into new files unless the file genuinely exceeds maintainable size or it's requested.
- **Do not switch between `.js` and `.ts`** in existing files without explicit instruction.
- **Do not add or remove `"use client"` / `"use server"` directives** unless that's the stated goal.
- **Do not change environment variable names** — they are used across CI/CD and multiple apps.
- **API route response shapes** — if you change a route's response shape, update every store/component that consumes it.

---

## Performance Guidelines

- **Avoid unnecessary re-renders** — check `useCallback`, `useMemo`, and dependency arrays before adding state
- **Zustand stores** use stale-while-revalidate with `CACHE_TTL_MS = 5 * 60 * 1000`; preserve this pattern
- **Defer non-critical work** with `requestIdleCallback` (see `CacheWarmer.js`)
- **GPU-accelerate heavy CSS** (blur, opacity) using `will-change: filter` + `transform: translateZ(0)`
- **Lenis smooth scroll** must use a single RAF loop with `cancelAnimationFrame` on cleanup
- **React Query** default: `staleTime: 5min`, `gcTime: 15min`, `refetchOnWindowFocus: false`, `refetchOnReconnect: false`
- **Never introduce polling loops** — use WebSocket or server-sent events (Fastify has `@fastify/websocket`)
- **Avoid blocking `await`** in the main render path — defer with `useEffect` or `startTransition`
- **Bundle size** — do not add new npm packages without explicit approval; prefer existing deps

---

## Debugging Methodology

When asked to fix a bug, follow this sequence:

1. **Read the failing code first** — do not guess; use `Read` to inspect the actual file
2. **Identify the root cause** — trace the data flow from component → store → API route → Firestore
3. **Explain the issue clearly** before writing any fix
4. **Propose the minimal fix** — a single-line change is better than a function rewrite if it solves the problem
5. **Show exactly what changed** — do not output the entire file; highlight the diff

When a network error occurs (`ERR_CONNECTION_REFUSED`, 4xx, 5xx):
- Check if the URL in the store points to `:4000` (gateway) vs `/api/*` (Next.js route)
- Check if the Next.js API route uses `getApiClient` which proxies to `:4000`
- Check if Firebase Admin env vars are set (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`)
- Check if `isFirebaseConfigured()` returns false — if so, seed/fallback data is used

---

## Forbidden Changes

**Do NOT modify the following unless explicitly instructed:**

| Area | Files / Locations |
|------|-------------------|
| CI/CD pipelines | `.github/workflows/` |
| Deployment configs | `Dockerfile`, `docker-compose.yml`, `fly.toml`, Vercel configs |
| Environment variable names | Any `.env.*` file variable keys |
| Firebase project config | `.firebaserc`, `firebase.json` |
| Authentication core | `packages/core/src/infrastructure/auth/`, `packages/core/admin.js` |
| API Gateway Fastify plugins | `apps/api-gateway/src/plugins/` |
| Turborepo configuration | `turbo.json` |
| Database schema / collection names | Firestore collection names in `*Store.js` files |
| Shared package public API | `packages/core/**`, `packages/ui/**` exports |

---

## Dependency Rules

- **Do not add new npm packages** without explicit user approval
- **Use existing utilities first**: lodash equivalents exist natively, date utilities are in `@c1rcle/core/time`
- **Firebase Admin** is already available in all server-side contexts via `@c1rcle/core/admin`
- **Zod** is already available in the API gateway and core — use it for validation
- **Framer Motion** is already available in web apps — use it for animations instead of CSS-only transitions
- **Lucide React** is the icon library — do not add heroicons, react-icons, etc.

---

## Code Style Guidelines

### General

- `async/await` over `.then().catch()` chains
- Descriptive variable names — `isLoading` not `l`, `eventList` not `data`
- Avoid deeply nested conditionals — early return / guard clauses preferred
- No `console.log` in committed code unless it's a `console.error` or `console.warn` with context

### TypeScript (API Gateway + Core Package)

- Strict mode is ON (`strict: true` in `tsconfig.json`)
- Use `z.object(...)` (Zod) for runtime validation in API gateway routes
- Use named interfaces with `I` prefix for contracts: `IAuthService`, `IEventRepository`
- Types in `@c1rcle/types` or co-located `.types.ts` files

### JavaScript (Next.js Apps — Relaxed TS)

- `allowJs: true` — both `.js` and `.tsx` files exist; don't convert without reason
- Components: PascalCase files (`EventCard.tsx`, `ShimmerImage.jsx`)
- Utilities: camelCase files (`authStore.js`, `apiClient.js`)
- Stores: camelCase + `Store` suffix (`exploreStore.js`)

### React (All Web Apps)

- Functional components only — no class components
- Hooks for all state and side effects
- Keep components small — extract if a component exceeds ~200 lines
- `"use client"` directive required for components that use hooks or browser APIs
- Server Components by default in App Router — opt in to client only when necessary

### API Routes (Next.js)

```javascript
// Standard pattern for all /app/api/*/route.js files:
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    // ... extract params
    const data = await libFunction(params);
    return NextResponse.json({ key: data, hasMore: false, nextCursor: null });
  } catch (error) {
    console.error("GET /api/resource error", error);
    return NextResponse.json({ error: "Failed to load resource" }, { status: 500 });
  }
}
```

### Fastify Routes (API Gateway)

```typescript
// Standard pattern for all /src/routes/v1/*.ts files:
export default async function resourceRoutes(fastify: FastifyInstance) {
  fastify.get('/resource', {
    preHandler: [fastify.validate({ querystring: Schema })]
  }, async (request: any, reply) => {
    try {
      const cached = await fastify.cache.get('resource:list', cacheKey);
      if (cached) return cached;
      const result = await fastify.resourceService.list(query);
      await fastify.cache.set('resource:list', cacheKey, result, 60);
      return result;
    } catch (error: any) {
      fastify.log.error(`Error: ${error.message}`);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  });
}
```

### Zustand Stores (Client)

```javascript
// Standard pattern: persist + stale-while-revalidate
const CACHE_TTL_MS = 5 * 60 * 1000;
export const useResourceStore = create(
  persist(
    (set, get) => ({
      items: [],
      status: "idle", // 'idle' | 'loading' | 'ready' | 'error'
      revalidating: false,
      lastFetchedAt: null,
      fetchItems: async () => {
        const { lastFetchedAt, items, revalidating, status } = get();
        if (status === "loading" || revalidating) return;
        const isFresh = lastFetchedAt && Date.now() - lastFetchedAt < CACHE_TTL_MS;
        if (isFresh) {
          if (status === "idle" && items.length > 0) set({ status: "ready" });
          return;
        }
        if (items.length > 0) {
          set({ revalidating: true }); // stale-while-revalidate
        } else {
          set({ status: "loading" });
        }
        const res = await fetch("/api/resource");
        const payload = await res.json();
        set({ items: payload.items || [], status: "ready", revalidating: false, lastFetchedAt: Date.now() });
      }
    }),
    { name: "resource-cache", storage: createJSONStorage(() => localStorage) }
  )
);
```

---

## Testing Guidelines

- Unit tests live alongside source files or in `__tests__/` directories
- Test runner: **Vitest** (not Jest)
- Before suggesting a fix, verify it doesn't break existing tests
- Do not modify test files unless the fix explicitly changes a tested interface
- Suggest new tests only when introducing new logic that has no existing coverage
- Integration tests are not present — do not write mock-heavy integration tests; prefer light unit tests

---

## Response Format

When suggesting code changes:

1. **State the root cause** in one sentence
2. **List the files that need to change** before making any edits
3. **Show minimal diffs** — do not rewrite entire files
4. **Explain what changed and why**, not just paste code
5. If more than 3 files need changing: **ask for confirmation** before proceeding

---

## Development Commands

```bash
# Run only the guest portal (most common)
cd thec1rcle && npm run dev:guest          # port 3000

# Run all web apps + API
cd thec1rcle && npm run dev

# Run individual apps
npm run dev:partner   # partner dashboard, port 3001
npm run dev:admin     # admin console, port 3002
npm run dev:mobile    # Expo mobile app, port 8082

# Build
npm run build

# Lint + type-check
npm run lint
npm run type-check

# Tests
npm run test
```

---

## Environment Variables Reference

Key variables required for the guest portal to function:

```
# Firebase Client (public, safe for browser)
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID

# Firebase Admin SDK (server-only, never expose to browser)
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY           # PEM format, \n in env = actual newlines in code

# Feature toggles
DEV_TOY_MODE=false             # true = use seed data instead of Firestore

# External services (not required for basic dev)
NEXT_PUBLIC_GATEWAY_URL=http://localhost:4000   # Fastify API (optional for guest portal)
NEXT_PUBLIC_ALGOLIA_APP_ID
NEXT_PUBLIC_ALGOLIA_SEARCH_KEY
GEMINI_API_KEY
```

---

## Known Architecture Decisions

| Decision | Reason |
|----------|--------|
| Zustand stores call `/api/*` (Next.js), NOT `:4000` | Fastify gateway is not always running in dev; Next.js API routes use Firebase Admin directly |
| `/api/events` returns `{ events, hasMore, nextCursor }` | Matches store's `payload.events` consumption pattern |
| `/api/venues` returns `{ hosts, hasMore, nextCursor }` | Matches `hostsStore`'s `payload.hosts` consumption pattern |
| `/api/hosts` returns `{ hosts, hasMore, nextCursor }` | Same as venues, unified by `hostsStore` |
| `CacheWarmer.js` uses `requestIdleCallback` | Defers prefetch until after First Contentful Paint |
| Blur layers use `will-change: filter` + `translateZ(0)` | Promotes to GPU compositor, prevents layout repaint on scroll |
| `AuthProvider` uses `profileRef` to break dep cycle | Prevents `updateEventList` from recreating on every profile change |

---

## Golden Rule

**If the request is unclear, ask one focused clarifying question before touching any code.**

Do not assume the scope of a change. A request to "fix events not loading" does not authorize you to:
- Refactor the store
- Change unrelated API routes
- Add new dependencies
- Modify authentication

Confirm scope. Make the minimal fix. Explain what changed.
