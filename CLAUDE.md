# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Auto-loaded working instructions for the C1RCLE monorepo.
> If this file and the live code disagree, trust the live code and current guardrail docs.
> Refreshed against the repo on 2026-06-16.

## Canonical Repo Root

- The active product monorepo is the nested folder: `thec1rcle/thec1rcle`
- Most architecture, scripts, apps, and packages live under that nested root
- Run repo commands from the nested root unless a task clearly targets the parent wrapper folder

## Working Posture

- Preserve working behavior first; migrate ownership second
- Inspect the live code before changing architecture, contracts, or ownership claims
- Make the smallest change that fixes the real problem
- Do not generalize one app's pattern to another app
- When docs disagree, prefer:
  1. live code
  2. `docs/` truth docs and guardrail files
  3. historical notes

## Current Repo Snapshot

### Apps

- `apps/guest-portal` - public guest-facing Next.js app
- `apps/partner-dashboard` - venue, host, and promoter dashboard Next.js app
- `apps/admin-console` - internal admin Next.js app
- `apps/api-gateway` - Fastify backend
- `apps/mobile-app` - primary Expo mobile app
- `apps/scanner-app` - separate Expo scanner workspace

### Packages

- `packages/core` - shared business logic, domain services, repositories, infra helpers
- `packages/ui` - shared UI exports
- `packages/types` - shared types package

### Current Stack

- Web apps: Next.js `16.1.7`
- Gateway: Fastify `5.2.2`
- Web React: React `18`
- Mobile app: Expo `55`, React Native `0.83`
- Scanner app: Expo `52`, React Native `0.76`
- Data and infra: Firebase Auth, Firestore, Storage, Redis, Inngest, Sentry

### Dev Ports

| App | Command | Port |
|---|---|---|
| guest-portal | `npm run dev:guest` | 3000 |
| partner-dashboard | `npm run dev:partner` | 3001 |
| admin-console | `npm run dev:admin` | 3002 |
| api-gateway | `npm run dev -w apps/api-gateway` | 3005 (default) |
| mobile-app | `npm run dev:mobile` | 8082 |

The api-gateway dev script uses `tsx watch --env-file=.env.development src/app.ts`. Web apps copy `.env.development` → `.env.local` on start.

### Common Commands

```bash
# Run all apps in parallel (Turborepo)
npm run dev

# Build all workspaces
npm run build

# Lint + type-check + test all workspaces
npm run lint
npm run type-check
npm test

# Single workspace lint / type-check
npm run lint --workspace=apps/guest-portal
npm run type-check --workspace=apps/partner-dashboard
npm run type-check --workspace=apps/api-gateway

# Run tests for a specific workspace
npm test --workspace=apps/api-gateway         # vitest
npm test --workspace=packages/core            # vitest
npm run test --workspace=apps/guest-portal    # node --test
npm test --workspace=apps/mobile-app -- --runInBand  # jest (scanner tests only)

# Run a single test file (api-gateway / core — vitest)
npx vitest run --workspace=apps/api-gateway src/path/to/file.test.ts

# Guardrails and architecture checks
npm run guardrails:check      # backend boundary violations
npm run test:guardrails       # boundary checker unit tests
npm run architecture:guest    # guest-portal BFF surface tests

# Format check
npm run format:check
npm run stylelint:check
```

### Git Conventions

Commits are enforced by commitlint (`@commitlint/config-conventional`). Format:

```
type(scope): subject
```

Valid scopes: `guest-portal`, `partner-dashboard`, `admin-console`, `api-gateway`, `mobile-app`, `scanner-app`, `core`, `ui`, `types`, `functions`, `infra`, `ci`, `deps`, `docs`, `root`

Rules: lowercase subject, no trailing period, header ≤ 72 chars, scope is required.

### Git Hooks

- **pre-commit**: runs `lint-staged` — prettier + eslint auto-fix on staged files, stylelint on CSS
- **pre-push**: runs the full `prepush` suite: lint → stylelint → type-check → test → build → guardrails:check

### Useful Root Scripts

- `npm run dev`
- `npm run dev:guest`
- `npm run dev:partner`
- `npm run dev:admin`
- `npm run dev:mobile`
- `npm run guardrails:check`
- `npm run test:guardrails`
- `npm run architecture:guest`

## Architecture Rule

Frontend asks.  
Backend decides.  
Database remembers.

For C1RCLE, that means:

- `apps/api-gateway` is the main product backend entry point
- `packages/core` is where reusable business rules and service orchestration belong
- Next.js `app/api/*` routes are allowed only when they are:
  - web-only helpers
  - thin migration bridges
  - approved page/BFF adapters
- Direct protected business ownership should not grow inside frontend apps

## High-Level Shape

1. UI apps render screens, collect input, and manage local UX state
2. App-local BFF or proxy routes may adapt web concerns when needed
3. Fastify owns authenticated product APIs and business decisions
4. `packages/core` owns reusable business logic and domain services
5. Firebase, Redis, payments, and async workflows sit underneath gateway/core

## App-Specific Truth

### Guest Portal

Current state:

- Guest Portal is no longer the old catch-all proxy model
- It is now a UI-first Next.js app with an approved BFF namespace at `app/api/app/*`
- Browser runtime should use:
  - `lib/bff/*` for page-oriented BFF surfaces
  - `lib/api/*` for gateway contract access
- `next.config.mjs` rewrites `/api/v1/:path*` to the gateway

Approved BFF surface:

- Current snapshot: `15` approved route handlers under `apps/guest-portal/app/api/app`
- Surfaces include:
  - home overview
  - explore feed
  - event detail
  - checkout summary, quote, reserve, initiate, verify, recover
  - tickets overview
  - profile overview and update
  - public profile detail
  - notifications summary
  - order confirmation

BFF contract rules:

- BFF responses use the envelope `{ ok, data, error, meta }`
- Request and response validation live in `apps/guest-portal/lib/bff/contracts.js`
- Server helpers live in `apps/guest-portal/lib/bff/server.js`
- Client helpers live in `apps/guest-portal/lib/bff/client.js`

Guest Portal guardrails:

- No ad hoc guest business routes outside `app/api/app/*`
- Do not reintroduce deleted guest `lib/server` business modules
- Do not add direct Firebase Admin or protected Firestore access in guest runtime routes
- New guest runtime work should extend existing BFFs or move behavior into gateway/core

Current guardrail signal:

- `scripts/check-backend-boundaries.mjs` classifies all current guest route handlers as allowed
- `governance/backend-boundary-exceptions.json` currently has no Guest Portal exceptions

### Partner Dashboard

Current state:

- Partner Dashboard remains a large transitional app
- It is not a pure thin client yet, but it is also no longer accurate to describe it as mostly direct Firestore route logic
- Live snapshot from the route checker: `208` route handlers under `apps/partner-dashboard/app/api`
- Many dashboard routes already proxy through `apps/partner-dashboard/lib/server/apiGateway.ts`

Important nuance:

- "Proxies to gateway" does not automatically mean "migration finished"
- The dashboard still carries migration debt, compatibility surface, and preserved legacy behavior
- `governance/backend-boundary-exceptions.json` currently contains `175` Partner Dashboard exception entries
- `npm run guardrails:check` is not fully green today; the current repo still reports stale Partner Dashboard exceptions and a small set of unmanifested `promoterAuthMiddleware` route violations

What to do in dashboard work:

- Prefer thin app routes that forward auth, scope headers, and `x-request-id`
- Keep backend ownership in Fastify and `packages/core`
- Preserve working venue, host, and promoter behavior while re-homing
- Do not expand direct Firebase/Admin usage for protected product flows
- Treat remaining local auth/session helpers as legacy residue unless the task explicitly moves them

What not to assume:

- Do not assume the dashboard has the same runtime rules as Guest Portal
- Do not assume a proxy route is already fully normalized or phase-complete
- Do not assume old route counts or old ownership writeups are still current

### API Gateway

Current state:

- The gateway registers `54` top-level files in `apps/api-gateway/src/routes/v1`
- It also hosts OpenAPI and SEO routes outside `routes/v1`
- The gateway is the main place for:
  - auth and RBAC
  - checkout and payments
  - tickets and cover charge
  - public discovery
  - partner operations
  - notifications
  - scan and door flows

Current plugin stack in `apps/api-gateway/src/app.ts`:

- firebase
- cache
- redis
- realtime
- rbac
- rate-limit
- validate
- feature-flags
- cache-control
- inngest

Gateway expectations:

- Preserve `x-request-id`
- Preserve the standard JSON error envelope
- Keep validation at the route boundary
- Push reusable decision logic into `packages/core`
- Avoid frontend-specific DTO shaping unless it is part of a deliberate API contract

### packages/core

Current state:

- `packages/core` remains the main shared business layer
- It contains both older engine-style modules and newer typed domain services

Current typed service layer under `packages/core/src/domain/services` includes:

- billing
- cancellation
- checkout
- event
- fulfillment
- idempotency
- inventory
- matching
- moderation
- notification
- payment
- profile
- public discovery
- workspace

Current Firebase repository layer under `packages/core/src/infrastructure/repositories/firebase` includes:

- event
- matching
- notification
- order
- profile
- report
- workspace

Core has two export layers — do not confuse them:

- **Engine exports** (legacy, e.g. `@c1rcle/core/scan-engine`, `@c1rcle/core/ticket-engine`) — older module-style exports at the root of `packages/core`
- **Typed domain exports** (newer, e.g. `@c1rcle/core/checkout-service`, `@c1rcle/core/profile-repo`) — resolve into `dist/domain/services/*` and `dist/infrastructure/repositories/*`

Core rules:

- Move reusable business rules here
- Do not move page-only DTO shaping here
- Do not duplicate logic between gateway routes and core helpers if the behavior can be shared

### Mobile App and Scanner App

- `apps/mobile-app` is still the main Expo app and still contains active scanner and door-ops related code — **Expo 55 / React Native 0.83 / React 19**
- `apps/scanner-app` exists as a separate workspace, but do not assume it has replaced every scanner flow in `mobile-app` — **Expo 56 / React Native 0.76**
- The two apps run different Expo versions; do not apply patterns from one to the other without checking version compatibility
- Before writing any Expo-specific code, read the versioned Expo docs for the target app (`v55` for mobile-app, `v56` for scanner-app)
- Scanner and door work must stay reliability-first and gateway-backed
- Avoid broad scanner rewrites without device/runtime validation
- mobile-app dev requires `NODE_OPTIONS=--max-old-space-size=8192` (already set in npm scripts)

### Admin Console

- `apps/admin-console` is an internal app
- Do not use admin-console patterns as the default boundary model for guest or partner work
- If admin behavior needs backend logic, it should still follow the same gateway/core direction unless there is a strong app-specific reason

## Migration Direction

### Guest Portal Plan

- Keep the incremental BFF rollout
- Preserve gateway contracts while page DTOs move behind `app/api/app/*`
- Favor stabilize-first work:
  - validation
  - parity logging
  - adapter cleanup
  - manual QA
- Do not rebuild Guest Portal from scratch

### Partner Dashboard Plan

- Continue one flow at a time
- Preserve behavior while migrating venue, host, and promoter surfaces
- Prefer thin proxies/BFFs over app-local business logic
- Retire exception-manifest routes gradually, not via big-bang rewrite

### Backend Plan

- Keep business decisions concentrated in Fastify and `packages/core`
- Freeze contracts when multiple clients already depend on them
- Move shared data access and orchestration into typed services and repositories when it improves reuse without changing behavior

## Guardrails And Source Docs

Trust these files first when architecture questions come up:

- `docs/guest-portal-architecture-truth.md`
- `docs/guest-portal-business-logic-inventory.md`
- `docs/guest-portal-route-ownership-matrix.md`
- `docs/phase-0-backend-boundary-guardrails.md`
- `docs/backend-boundary-pr-checklist.md`
- `docs/phase-0-api-route-inventory.json`
- `governance/backend-boundary-exceptions.json`
- `scripts/check-backend-boundaries.mjs`

Current guardrail reality:

- A failing or noisy Partner Dashboard boundary check may reflect existing migration debt, not your current edit
- Treat the guardrail output as routing evidence and cleanup inventory, not as proof that a new change caused every reported issue

## Route Change Rules

Before adding or changing a route, answer:

1. Why is this not a Fastify route?
2. Is this route a web helper, thin bridge, or approved BFF?
3. Which current behavior must be preserved exactly?
4. Which app, gateway route, and core module own the flow before and after the change?
5. Which tests or manual checks prove parity?

Additional Guest Portal rule:

- If you add a guest BFF route, it must live under `app/api/app/*`
- Update boundary coverage such as:
  - `tests/guest-bff-surface.test.js`
  - `tests/ghost-bridge-boundaries.test.js`
- Update the relevant guest docs if the route becomes part of the supported surface

Additional Partner Dashboard rule:

- If you touch a legacy exception route, preserve current business behavior before trying to "clean it up"
- If you convert a route into a thinner proxy, update any related migration documentation or exception notes

## Working Rules For Claude

- Read the current implementation before suggesting a fix
- Trace the real path end to end for bugs and missing data
- Prefer minimal, parity-safe migration slices
- Do not widen scope just because a surface looks messy
- Do not present target-state architecture as if it is already fully landed
- When architecture is mixed, separate:
  - what is live now
  - what is transitional
  - what is still the intended destination

## Verification Commands

From the nested repo root:

```bash
npm run guardrails:check
npm run test:guardrails
npm run architecture:guest
npm run dev:guest
npm run dev:partner
npm run dev:admin
npm run dev --workspace=apps/api-gateway
npm run type-check --workspace=apps/guest-portal
npm run type-check --workspace=apps/partner-dashboard
npm run test --workspace=apps/guest-portal
npm test --workspace=apps/mobile-app -- --runInBand
```

## Final Reminder

- Guest Portal is now an approved BFF-fronted UI app, not the old deleted-bridge model
- Partner Dashboard is a large transitional proxy/BFF surface, not a completed thin frontend
- Fastify plus `packages/core` is still the intended long-term backend center
- Preserve working behavior, verify with live code, and migrate ownership deliberately
