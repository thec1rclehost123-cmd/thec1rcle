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
│   └── mobile-app/            # Expo React Native app for guests and event staff scanner flows
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

## Partner Dashboard — UI Design System

**This design system governs ALL pages in `apps/partner-dashboard/` — venue, host, and promoter sections must be visually identical in structure, spacing, color, and component usage. Never deviate from these patterns.**

### Shell Architecture

Every section runs inside a shell wrapper that forces dark mode:

```
.venue-shell.dark
├── AppleSidebar (280px desktop, collapsible to 80px)
│   brandLetter="C" brandLabel="Venue" | "Host" | "Promoter"
├── Mobile header (lg:hidden) + animated overlay drawer
├── Main content area (lg:pl-[280px], transition-all)
│   ├── AppleTopBar
│   └── <main class="p-4 sm:p-6 lg:p-8 xl:p-10">
│       └── <motion.div> page content
└── <AssistantButton /> floating AI trigger
```

- Venue: `VenueClientWrapper` → `components/layout/VenueClientWrapper.tsx`
- Host: `HostClientWrapper` → `components/layout/HostClientWrapper.tsx`
- Promoter: `PromoterClientWrapper` / `PromoterSidebarWrapper` → `components/layout/`

### Color System — CSS Variables

All colors use CSS custom properties. The `.venue-shell` scope forces dark on everything:

```css
/* Brand */
--c1rcle-orange: #F44A22
--c1rcle-orange-glow: rgba(244, 74, 34, 0.25)
--c1rcle-orange-dim: #CC3311
--c1rcle-orange-light: #FF6B4A

/* Surfaces (dark mode / venue-shell forced) */
--surface-base: #0A0A0B
--surface-secondary: #111113
--surface-tertiary: #18181B
--surface-elevated: #1C1C1F
--surface-overlay: rgba(0,0,0,0.8)

/* Venue shell scoped variables */
--v-canvas: #111113
--v-card: #1a1a1d
--v-card-hover: #1e1e22
--v-hero: #0D0D0F
--v-elevated: #222226
--v-border: rgba(255,255,255,0.08)

/* Text */
--text-primary: #FAFAFA
--text-secondary: #D1D1D6
--text-tertiary: #A1A1AA
--text-placeholder: #52525B

/* Semantic */
--state-success: #34D399   --v-success: #34D399   --v-success-bg: rgba(52,211,153,0.08)
--state-warning: #FBBF24   --v-warning: #FBBF24   --v-warning-bg: rgba(251,191,36,0.08)
--state-error:   #F87171   --v-error:   #F87171   --v-error-bg: rgba(248,113,113,0.08)
--state-info:    #818CF8   --v-info:    #818CF8   --v-info-bg: rgba(129,140,248,0.08)
--v-orange: var(--c1rcle-orange)
--v-orange-glow: var(--c1rcle-orange-glow)

/* Borders */
--border-subtle:  rgba(255,255,255,0.04)
--border-default: rgba(255,255,255,0.08)
--border-strong:  rgba(255,255,255,0.12)

/* Shadows */
--v-shadow-card:  0 1px 3px rgba(0,0,0,0.40), 0 1px 2px rgba(0,0,0,0.30)
--v-shadow-hover: 0 8px 24px rgba(0,0,0,0.50)
--v-shadow-hero:  0 24px 64px rgba(0,0,0,0.60)
--shadow-glow:    0 0 30px rgba(244, 74, 34, 0.3)

/* Transitions */
--transition-fast:   100ms ease
--transition-base:   150ms ease
--transition-smooth: 200ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-spring: 300ms cubic-bezier(0.34, 1.56, 0.64, 1)
```

### Typography Scale

```
/* Headlines */
.text-display-xl  → 56px, 700, -0.03em  (mobile: 36px)
.text-display     → 40px, 700, -0.025em (mobile: 28px)
.text-display-sm  → 32px, 600, -0.02em  (mobile: 24px)
.text-headline    → 28px, 600, -0.02em  (mobile: 22px)
.text-headline-sm → 22px, 600, -0.015em

/* Financial / KPI — tabular-nums, tnum feature */
.text-stat-hero → 64px, 600, -0.03em  (mobile: 48px)
.text-stat-xl   → 48px, 600, -0.025em (mobile: 36px)
.text-stat-lg   → 36px, 600, -0.02em  (mobile: 28px)
.text-stat      → 28px, 600, -0.015em (mobile: 24px)
.text-stat-sm   → 22px, 600
.text-stat-xs   → 18px, 600

/* Venue shell helpers */
.v-text-hero    → var(--v-hero-size) [48-80px], 700, tabular-nums
.v-text-title   → var(--v-title-size) [28-40px], 600
.v-text-section → 20px, 600, -0.01em
.v-label        → 11px, 600, 0.12em, uppercase

/* Body */
.text-body-lg  → 17px, -0.01em, 1.6lh
.text-body     → 15px, -0.01em, 1.6lh
.text-body-sm  → 14px, var(--text-secondary)
.text-caption  → 13px, var(--text-tertiary)
.text-label    → 11px, 600, 0.04em, uppercase
.text-label-sm → 10px, 700, 0.06em, uppercase
```

Raw Tailwind equivalents used throughout:
- Page hero titles: `text-3xl font-black tracking-tighter` or `text-4xl font-black tracking-tight`
- Section labels: `text-[10px] font-bold uppercase tracking-widest text-[var(--v-text-tertiary)]` or `v-label uppercase tracking-widest text-[9px]`
- Stat values: `text-2xl font-black tabular-nums` / `text-[36px] font-bold`
- Body copy: `text-[13px] font-medium` / `text-[12px] font-semibold`

### Card & Surface Components

```
/* Global card classes */
.card               → surface-elevated, border-subtle, border-radius-xl, transition
.card-interactive   → cursor-pointer, hover translateY(-2px), active scale(0.995)
.card-glass         → rgba(255,255,255,0.03), backdrop-filter: blur(20px)
.card-glow          → border: orange, box-shadow: shadow-glow

/* Venue shell bento cards */
.v-bento            → var(--v-card) bg, rounded-xl, shadow-card, hover: card-hover + shadow-hover + translateY(-2px)
.v-hero-card        → var(--v-hero) bg, shadow-hero

/* BentoCard component (components/ui/BentoCard.tsx) */
<BentoCard padding="md|lg|sm" title="" subtitle="" icon={} headerRight={}>
  content
</BentoCard>

/* Inline card patterns */
rounded-[32px] | rounded-[40px] | rounded-[2.5rem] | rounded-[2rem]  ← all valid; use 32-40px for hero cards
bg-[var(--v-card)] border border-[var(--v-border)]
```

### Page Shell Component

Every page body wraps with `VenuePageShell`:
```tsx
<VenuePageShell title="Page Title" subtitle="subtitle text" actions={<>...</>}>
  {/* page content */}
</VenuePageShell>
```
Located at `components/venue-layout/VenuePageShell.tsx`.

### Grid & Layout Patterns

```
/* Hero row: identity + primary KPI */
grid grid-cols-1 lg:grid-cols-3 gap-3|gap-4|gap-6

/* KPI strip */
grid grid-cols-2 lg:grid-cols-4 gap-3

/* Main content + sidebar */
grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8
  xl:col-span-2  ← main content
  (last col)     ← sidebar

/* Guest ops KPI grid */
grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3

/* Charts */
grid lg:grid-cols-12 gap-6
  lg:col-span-8 ← primary chart
  lg:col-span-4 ← secondary

/* Page max width */
max-w-[1600px] mx-auto
```

### Button Styles

```
/* Base */
.btn              → inline-flex, 14px, 600 weight, 44px min-height, radius-lg
.btn:focus-visible → box-shadow: 0 0 0 3px var(--c1rcle-orange-glow)

/* Variants */
.btn-primary      → bg: var(--c1rcle-orange), color: white
  :hover          → bg: var(--c1rcle-orange-dim), box-shadow: shadow-glow
  :active         → transform: scale(0.98)
.btn-secondary    → transparent, border-default, color-primary
  :hover          → bg-secondary, border-strong
.btn-ghost        → transparent, color-secondary, px-4 py-2.5
  :hover          → bg-secondary, color-primary
.btn-success      → bg: state-success, white text
.btn-danger       → bg: state-error, white text

/* Sizes */
.btn-sm  → 13px, p: 8px 14px, min-h: 36px, radius-md
.btn-lg  → 15px, p: 16px 28px, min-h: 52px, radius-xl
.btn-xl  → 16px, p: 20px 36px, min-h: 60px, radius-2xl
.btn-icon → 44px square, radius-lg
.btn-icon-sm → 36px square, radius-md

/* Interactive micro-animation used across pages */
hover:scale-105 active:scale-95
```

`VenueActionButton` component (`components/venue-layout/VenueSidebar.tsx` or similar) wraps these with `variant="primary"|"secondary"`.

### Badge & Status Classes

```
/* Badges */
.badge            → inline-flex, gap: 6px, px: 10px, py: 4px, radius-full, 12px
.badge-neutral    → bg-tertiary, color-secondary
.badge-success    → bg-success-bg, color-success
.badge-warning    → bg-warning-bg, color-warning
.badge-error      → bg-error-bg, color-error
.badge-info       → bg-info-bg, color-info
.badge-accent     → bg-orange-glow, color-orange

/* Status dots */
.status-dot       → 8px circle
.status-dot-success/.warning/.error/.info/.neutral → semantic colors
.status-dot-pulse → animation: pulse-dot 2s infinite

/* Venue shell status pills */
.v-status-pill    → inline-flex, gap: 5px, px: 10px, py: 3px, radius-full, 11px
.v-status-live    → color: var(--v-success), bg: var(--v-success-bg)
.v-status-pending → color: var(--v-warning), bg: var(--v-warning-bg)
.v-status-error   → color: var(--v-error), bg: var(--v-error-bg)
.v-status-info    → color: var(--v-info), bg: var(--v-info-bg)
.v-status-neutral → color: text-tertiary, bg: rgba(255,255,255,0.06)

/* Venue shell trend chips */
.v-trend-chip     → inline-flex, gap: 3px, px: 8px, py: 2px, radius-full, 11px
.v-trend-up       → color: var(--v-up), bg: var(--v-up-bg)
.v-trend-down     → color: var(--v-down), bg: var(--v-down-bg)
.v-trend-neutral  → color: text-tertiary, bg: rgba(255,255,255,0.06)

/* Inline Tailwind status pills used in tables */
/* Approved/Checked-in */  bg-emerald-50 text-emerald-600 border border-emerald-100 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest
/* Pending */               bg-indigo-50  text-indigo-600  border border-indigo-100
/* Rejected/Error */        bg-red-50     text-red-600     border border-red-100
/* Neutral */               bg-surface-tertiary text-text-tertiary
```

### Input & Form Styles

```
.input            → 100% width, bg-secondary, border-subtle, p: 14px 16px, radius-xl
.input:hover      → border-default
.input:focus      → bg-base, border-orange, box-shadow: 0 0 0 3px orange-glow, outline: none
.input-label      → 13px, 600, text-secondary, mb: 8px
.input-error      → border: state-error

/* Inline input style pattern (used in settings) */
style={{
  background: "var(--v-elevated)",
  border: "1px solid var(--v-border)",
  borderRadius: 12,
  padding: "9px 14px",
  fontSize: 13,
  outline: "none",
  width: "100%",
  color: "var(--v-text-primary)"
}}

/* Tab navigation pattern */
<div class="flex p-1 rounded-xl gap-0.5" style={{ background: "var(--v-card)", border: "1px solid var(--v-border)" }}>
  /* inactive */ text-[var(--v-text-tertiary)]
  /* active */   style={{ background: "var(--v-elevated)" }} text-[var(--v-text-primary)]
</div>
```

### KPI Components

```
/* KPIBento (components/ui/AppleHeroStat.tsx or similar) */
<KPIBento label="UPCOMING" value={n} subtext="30-Day Window" icon={CalendarDays} />

/* KPICard inline pattern (guest-ops) */
<div class="p-4 rounded-xl border flex flex-col gap-2">
  <div class="w-8 h-8 rounded-lg flex items-center justify-center {colorBg}">
    <Icon size={16} className={colorText} />
  </div>
  <div class="text-[11px] text-[var(--v-text-muted)]">{label}</div>
  <div class="text-2xl font-bold tabular-nums {emphasized ? 'text-green-600' : ''}">{value}</div>
</div>

/* Icon color mapping for KPI cards */
blue:   bg-blue-50   dark:bg-blue-900/20   text-blue-500
green:  bg-green-50  dark:bg-green-900/20  text-green-500
red:    bg-red-50    dark:bg-red-900/20    text-red-500
amber:  bg-amber-50  dark:bg-amber-900/20  text-amber-500
purple: bg-purple-50 dark:bg-purple-900/20 text-purple-500
orange: bg-orange-50 dark:bg-orange-900/20 text-orange-500
teal:   bg-teal-50   dark:bg-teal-900/20   text-teal-500
slate:  bg-slate-50  dark:bg-slate-800/50  text-slate-400
```

### Finance Patterns

```
/* Primary metric card with accent border */
.v-hero-card.border-l-[3px].border-l-[var(--v-orange)].shadow-lg.ring-1.ring-[var(--v-orange)]/10

/* Currency formatting */
formatINR(amount)        → full rupee format  e.g. "₹1,24,500"
formatINRCompact(amount) → compact            e.g. "₹2.4K"

/* Payout alert banner */
background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)"
icon color: #F87171

/* Info/indigo alert */
background: "var(--v-info-bg)", border: "1px solid rgba(129,140,248,0.2)"
```

### Table Patterns

```
/* Table container */
.table-container → overflow-x auto, rounded-xl, border-subtle
bg-surface-elevated rounded-[2.5rem] border border-[var(--v-border)] shadow-sm overflow-hidden

/* Table header */
bg-surface-tertiary border-b border-border-subtle p-6|p-10

/* Table header cells */
.table th → bg-secondary, p: 14px 16px, 12px uppercase font-size

/* Table rows */
.table tr:hover td → bg-secondary
hover:bg-surface-tertiary/50 transition-all group

/* Sticky header */
bg-surface-elevated/80 backdrop-blur-md

/* Search input in tables */
pl-14 pr-8 py-5 w-full md:w-80 bg-surface-elevated border rounded-2xl
focus:ring-8 focus:ring-slate-100
```

### Toggle / Switch

```
/* CSS class */
.toggle          → 48px × 28px, radius: 14px, bg-tertiary
.toggle-active   → bg-success, border-success
.toggle-knob     → 20px circle, bg-white, shadow-sm, transition: transform spring
.toggle-active .toggle-knob → translateX(20px)

/* Color when active */
background: "var(--c1rcle-orange)" (for settings toggles)
```

### Skeleton Loading

```
.skeleton        → bg-tertiary, radius-md, shimmer after-pseudo
.skeleton-text   → h: 16px
.skeleton-title  → h: 24px, w: 60%
.skeleton-stat   → h: 36px, w: 50%
.skeleton-avatar → 40px square, 50% radius
.skeleton-card   → h: 120px

/* Venue shell variant */
.v-skeleton → linear-gradient shimmer, animation: v-shimmer 1.4s infinite
```

### Animation Patterns

```
/* Framer Motion — standard page entry */
initial={{ opacity: 0, y: 16 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.4, delay: 0.12 }}

/* Always use useReducedMotion() to gate animations */
const rm = useReducedMotion();
animate={rm ? {} : { opacity: 1, y: 0 }}

/* Tab content transitions */
<AnimatePresence>
  <motion.div
    initial={{ opacity: 0, x: 10 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -10 }}
  />
</AnimatePresence>

/* Staggered grid children */
.stagger-children > *:nth-child(n) → delay: n*50ms, animation: slide-up 0.3s backwards

/* CSS keyframes available */
shimmer, float, pulse-glow, fade-in, slide-up, slide-down, scale-in, pulse-dot
v-shimmer, v-pulse, slide-in-right, progress-stripes

/* Micro-interactions */
hover:scale-105 active:scale-95           ← buttons, action items
hover:brightness-110                      ← card actions
hover:translate-x-1 transition-all        ← arrow icons in link cards
group-hover:translate-x-1                ← arrow within .group parent
```

### Empty & Error States

```
/* Empty state */
.empty-state → flex column centered, p: 64px 32px, text-align center
.empty-state-icon → 64px sq, radius-xl, bg-secondary, flex centered, mb: 24px, color-placeholder

/* Inline empty (inside tables/lists) */
py-16 text-center border-2 border-dashed border-[var(--v-border)] rounded-2xl
<ScanLine size={32} className="text-[var(--v-text-muted)]" />

/* Error banner */
p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 font-medium
```

### Modal & Overlay Patterns

```
.modal-overlay  → fixed inset-0, bg-overlay, backdrop-filter: blur(4px), z-100
.modal-content  → bg-base, radius-2xl, border-subtle, shadow-xl, max-w-[560px], 90vw
.modal-header   → p-6, border-bottom-subtle
.modal-body     → p-6, overflow-y auto
.modal-footer   → p-6, border-top-subtle, flex justify-end gap-3
```

### Header / Breadcrumb Patterns

```
/* Section breadcrumb tag */
px-3 py-1 bg-indigo-500/10 rounded-full text-indigo-600 text-xs uppercase tracking-widest border border-indigo-500/20

/* Page title */
text-4xl font-black text-text-primary tracking-tight

/* Filter tab strip */
flex p-1 bg-surface-secondary rounded-2xl border border-border-default
  inactive: text-text-tertiary hover:text-text-secondary px-4 py-2 rounded-xl text-sm
  active:   bg-surface-elevated text-text-primary shadow-sm
  count:    ml-1.5 px-1.5 py-0.5 rounded-full text-[8px] bg-surface-tertiary
```

### Tailwind Config — Custom Extensions

```javascript
// tailwind.config.js theme.extend
colors: {
  "c1rcle-orange": "#F44A22",
  iris: { DEFAULT: "#F44A22", glow: "#FF6B4A", dim: "#CC3311" },
  text: { primary, secondary, tertiary, placeholder, inverse },
  border: { subtle, default, strong, focus },
  surface: { base, secondary, tertiary, elevated },
  accent: { primary, glow, dim, light },
  obsidian: { base, surface, sidebar, elevated },
}
borderRadius: {
  bubble: "32px", dash: "40px", pill: "9999px",
  xl: "16px", "2xl": "20px", "3xl": "24px", "4xl": "32px",
}
fontFamily: {
  heading: ["var(--font-system)", "SF Pro Display", "Inter", "sans-serif"],
  mono:    ["var(--font-mono)", "SF Mono", "Fira Code", "monospace"],
}
transitionTimingFunction: {
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
}
backgroundImage: {
  "hero-fade":      "linear-gradient(180deg, rgba(10,10,11,0) 0%, #0A0A0B 100%)",
  "glass-gradient": "linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))",
  "holographic":    "linear-gradient(135deg, rgba(244,74,34,0.2), rgba(254,248,232,0.2), rgba(168,170,172,0.2))",
  "glow-radial":    "radial-gradient(circle at center, rgba(244,74,34,0.15) 0%, transparent 70%)",
}
screens: { xs: "480px" }
spacing: { gutter: "min(6vw, 3.5rem)", 18: "4.5rem", 22: "5.5rem" }
```

### Icon Library

- **Lucide React only** — 16px body, 20px nav, 24px section headers, 32px empty states
- Color always tied to semantic CSS variable, never hardcoded hex
- Icon box (KPI): `w-8 h-8 rounded-lg flex items-center justify-center` with semantic bg

### Scrollbar

```
/* Default */
::-webkit-scrollbar: 10px, track transparent, thumb border-default radius-5px

/* Custom scrollbar helper */
.custom-scrollbar → scrollbar-width: thin, thumb: rgba(255,255,255,0.1)
.scrollbar-hide   → no scrollbar
```

### Responsive Breakpoints

```
xs:  480px  (custom)
sm:  640px  → mobile-first card stacking
md:  768px  → 2-column layouts activate
lg:  1024px → 3-column layouts, sidebar shows
xl:  1280px → 3-column with xl:col-span-2 pattern
2xl: 1536px → max-width container expansions
```

Touch device override: `min-height: 48px` for all interactive elements. No hover transforms on touch (`@media (hover: none)`).

Reduced motion: all animation/transition inside `.venue-shell` collapses to `0.01ms` when user prefers reduced motion.

---

## Golden Rule

**If the request is unclear, ask one focused clarifying question before touching any code.**

Do not assume the scope of a change. A request to "fix events not loading" does not authorize you to:
- Refactor the store
- Change unrelated API routes
- Add new dependencies
- Modify authentication

Confirm scope. Make the minimal fix. Explain what changed.
