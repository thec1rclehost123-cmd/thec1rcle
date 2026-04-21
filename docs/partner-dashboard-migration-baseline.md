# Partner Dashboard Migration Baseline

## Purpose

This document explains:

- what is happening in the current `apps/partner-dashboard`
- why the current shape is not aligned with the target architecture
- where business logic is currently living
- how the Partner Dashboard should connect to the backend
- which phases we should use to migrate it safely
- how to execute the migration without losing working business behavior

This is the baseline for Partner Dashboard migration work.

## One-Line Architecture Rule

The frontend asks for things.  
The backend decides things.  
The database remembers things.

For C1RCLE, that means:

- `apps/partner-dashboard` should render screens, collect input, call APIs, and show loading/error/success states
- `apps/api-gateway` should be the real backend front door
- `packages/core` should hold the reusable business logic and domain services
- Firebase/Firestore/Redis/payment providers/jobs should sit underneath the gateway and services

## The Intended Architecture

Think of C1RCLE as one business with 4 front doors:

1. Guest Portal
2. Partner Dashboard, Venue
3. Partner Dashboard, Host
4. Partner Dashboard, Promoter

All 4 front doors should not talk directly to Firebase for protected business actions.

The clean shape is:

Users  
-> Frontends  
-> Next.js API routes or server actions, only when needed for web app concerns  
-> Fastify API Gateway  
-> Domain services / business layer  
-> Firebase / Redis / external services  
-> Response back to frontend

## What the Partner Dashboard Looks Like Today

### High-level reality

The Partner Dashboard is currently a hybrid:

- part frontend
- part app-local backend
- part gateway client

It is not yet a thin frontend over one central backend.

In practice, the dashboard is still doing a lot of backend work inside:

- `app/api/*` route handlers inside the Next.js app
- `lib/server/*` helper/store files inside the dashboard app
- some client-side components that fetch many app-local routes and shape data for UI use

This means the Partner Dashboard is still acting like a second backend in many areas.

## Current Codebase Facts

These numbers come from the current repo state under `apps/partner-dashboard`.

### API surface size

- Total app-local API route files in `apps/partner-dashboard/app/api`: `204`
- Top-level route family counts:
  - `venue`: `91`
  - `host`: `42`
  - `promoter`: `22`
  - `partner`: `7`
  - `auth`: `8`
  - plus smaller families like `events`, `payments`, `scan`, `slots`, `profile`, `discovery`, `setup`

### Backend ownership split inside the dashboard app

- Routes with direct Firebase Admin / Firestore access: `97`
- Routes with explicit gateway references: `26`

This means the dashboard still has far more app-local backend ownership than gateway ownership.

### Frontend behavior complexity

Scanning `apps/partner-dashboard/app` showed:

- files with `fetch(...)`: `82`
- files with `getIdToken`: `63`
- route/page/component files under:
  - `venue`: `127`
  - `host`: `49`
  - `promoter`: `31`

This is not automatically bad, but it shows the dashboard currently has a wide and active API-consumption surface with a lot of token-driven request flow.

### App-local server layer size

The dashboard also has a large app-local server layer in `apps/partner-dashboard/lib/server`, including files like:

- `eventStore.js`
- `orderStore.js`
- `financeStore.js`
- `hostStore.js`
- `promoterFinanceStore.ts`
- `promoterLinkStore.js`
- `staffProfileStore.ts`
- `venueSettingsStore.ts`
- `walkInStore.ts`
- `ticketingService.js`
- `aggregation-engine.ts`
- `analytics-rollup-engine.js`

This confirms the dashboard app still contains a large amount of backend data access and business workflow code locally.

## What Is Happening Right Now

### 1. The dashboard already knows about the API gateway

`apps/partner-dashboard/next.config.mjs` rewrites:

- `/api/v1/:path*` -> `http://localhost:4000/api/v1/:path*`

So the app is already prepared to speak to Fastify.

### 2. Some routes already behave like thin BFF proxies

There are routes that mostly do auth/scope checks and then proxy to the gateway.

Examples:

- `app/api/host/overview/route.ts`
- `app/api/venue/overview/summary/route.ts`
- `app/api/venue/finance/overview/route.ts`

These are good transitional patterns because the dashboard keeps the frontend contract stable while moving real backend ownership toward Fastify.

### 3. Many routes are still doing direct Firestore work inside the dashboard app

Representative examples:

- `app/api/venue/orders/route.ts`
  - reads directly from `orders`, `rsvp_orders`, and `events`
  - contains local fallback and shaping logic
  - applies response masking locally

- `app/api/partner/promoter/overview/route.ts`
  - directly queries Firestore collections
  - aggregates links, assignments, events, conversion stats, and leaderboard data locally
  - calculates KPIs in the dashboard app

- `app/api/venue/events/[id]/finance/route.ts`
  - directly reads orders, refunds, host earnings, settlements, and assignments
  - computes event finance response locally

- `app/api/venue/events/[id]/overview/route.ts`
  - directly reads events, orders, and guest list data
  - computes operational event summary locally

- `app/api/venue/staff/route.ts`
  - directly reads venue staff and user docs
  - performs membership and data shaping locally

This is the exact pattern we are trying to reduce.

### 4. The dashboard still uses Firebase Auth on the client

That part is fine.

The correct rule is:

- frontend can use Firebase Auth as identity
- frontend should send token to backend
- backend should verify token and decide business access

`components/providers/DashboardAuthProvider.tsx` currently:

- restores Firebase auth state
- fetches `/api/auth/me`
- reads profile/membership state
- exposes `getIdToken()`

That is expected for identity bootstrap.

The problem is not client auth itself.
The problem is that too many protected business flows still terminate in app-local Next.js API routes and app-local Firestore logic instead of the Fastify gateway.

## The Real Current Problem

The main issue is not "the UI exists" or "the frontend makes requests."

The real issue is this:

### The dashboard is still doing too much backend work inside the app layer

That includes:

- app-local API routes making business decisions
- app-local server helpers reading and writing Firestore directly
- operational summaries being computed in the dashboard app
- finance and analytics logic being partly implemented in the dashboard app
- partner-surface logic being duplicated across venue, host, and promoter areas

This creates several problems:

1. The dashboard becomes a second backend.
2. Business rules become harder to control.
3. Host, venue, and promoter logic drift apart.
4. Auth and RBAC decisions are split across too many places.
5. Analytics and finance are at risk of becoming query-heavy and inconsistent.
6. It becomes hard to reason about the one true source of business behavior.

## What We Mean by "Business Logic on the Frontend"

Strictly speaking, the current issue is not only React components doing business logic.

The current issue is broader:

- some logic is in client components
- some logic is in Next.js API routes
- some logic is in `lib/server/*` inside the dashboard app

So when we say "business logic is on the frontend," the more accurate version is:

The Partner Dashboard app is still carrying too much product logic and protected data logic inside the frontend codebase instead of delegating it to Fastify and shared core services.

## What the Partner Dashboard Should Become

The Partner Dashboard should become:

- one frontend app
- with venue mode
- host mode
- promoter mode

Its job should be:

- render shell, layouts, forms, tables, charts
- call backend APIs
- pass auth tokens
- show loading/error/empty/success states
- hold small UI state

It should not be the place that owns:

- event ownership rules
- payout logic
- settlement logic
- promoter commission truth
- guest list business rules
- analytics rollups
- permission truth
- Firestore-heavy protected reads

That ownership should move to:

- `apps/api-gateway`
- `packages/core`

## Target Connection Model for Partner Dashboard

### Venue

Partner Dashboard Venue should call authenticated Fastify partner routes.

Examples:

- `GET /api/v1/partner/venue/:venueId/overview`
- `GET /api/v1/partner/venue/:venueId/events`
- `GET /api/v1/partner/venue/:venueId/analytics`
- `POST /api/v1/partner/venue/:venueId/events`
- `POST /api/v1/partner/venue/:venueId/staff/invite`
- `POST /api/v1/partner/venue/:venueId/payouts/initiate`

### Host

Partner Dashboard Host should call authenticated Fastify partner routes.

Examples:

- `GET /api/v1/partner/host/:hostId/overview`
- `GET /api/v1/partner/host/:hostId/events`
- `POST /api/v1/partner/host/:hostId/events`
- `GET /api/v1/partner/host/:hostId/analytics`
- `POST /api/v1/partner/host/:hostId/venue-partnership-requests`

### Promoter

Partner Dashboard Promoter should call authenticated Fastify partner routes.

Examples:

- `GET /api/v1/partner/promoter/:promoterId/overview`
- `GET /api/v1/partner/promoter/:promoterId/links`
- `GET /api/v1/partner/promoter/:promoterId/commissions`
- `GET /api/v1/partner/promoter/:promoterId/analytics`

## Rules for Next.js API Routes in Partner Dashboard

The end state is:

- all real product APIs live in `apps/api-gateway`
- `apps/partner-dashboard/app/api/*` is not a second backend

Next.js API routes are still allowed, but only for:

- small web-specific helpers
- temporary migration bridges
- SSR helpers when truly needed
- app-specific webhooks or edge/runtime concerns

They are not allowed to become long-term homes for:

- pricing logic
- payout logic
- order truth
- analytics truth
- permission truth
- large protected Firestore data access
- duplicated venue/host/promoter business workflows

### What "thin bridge" means

A thin bridge route may:

- read the request
- forward auth and partner context
- call Fastify
- normalize minor response shape differences during migration
- preserve an old frontend contract temporarily

A thin bridge route may not become the long-term owner of:

- business rules
- protected Firestore queries
- pricing or payout math
- analytics calculations
- workflow/state transitions
- partner permission decisions beyond basic pass-through checks

### The practical rule

If a route exists because the web app needs a small adapter layer, it can stay temporarily.

If a route exists because "this is where the business logic currently lives," it must move to Fastify.

## Thin Frontend Rules

The Partner Dashboard should be a thin frontend, not a business backend.

### The frontend is allowed to do

- render layouts, forms, tables, charts, and interaction states
- call backend APIs
- pass Firebase ID tokens to backend APIs
- keep small UI state
- manage filters, tabs, pagination controls, local drafts, and display formatting
- render ready-to-use DTOs returned by the backend

### The frontend should not do

- compute major finance truth
- compute payout or settlement logic
- compute permissions or role scope
- derive large analytics from raw records
- merge multiple protected collections to create business truth
- directly read protected Firestore data for partner workflows
- become the place where venue, host, or promoter business rules live

### The component rule

React components may contain presentation logic.

They should not become the final decision-maker for:

- what a user is allowed to do
- what something costs
- whether a ticket/order/payout is valid
- what counts as the official venue/host/promoter truth

## Refresh and Realtime Policy

The default Partner Dashboard behavior should be refresh-driven, not realtime-driven.

### Default rule

Use manual refresh, timed refresh, or short-lived cache revalidation for most dashboard surfaces.

Do not default to persistent realtime listeners for large or broad dashboard pages.

### When realtime is acceptable

Realtime is acceptable only for small, critical, operational values such as:

- active check-in counts
- scanner session status
- venue door capacity indicators
- live queue/check-in state when latency matters operationally

### When realtime should be avoided

Avoid realtime listeners for:

- broad analytics pages
- finance dashboards
- large lists
- historical reporting
- multi-card overview pages that can refresh on interval

### Preferred refresh model

- overview pages: cached backend responses plus manual refresh or timed refresh
- analytics: cached rollups with explicit refresh
- finance: private cached summaries with manual refresh
- live ops: targeted polling or very small realtime surfaces only

This keeps cost, complexity, and browser work under control.

## Performance and Read Model Rules

The dashboard should consume small, ready-to-render backend responses.

### Query rules

- do not run full collection scans on request paths
- paginate all large lists
- always query with indexes and limits
- prefer read models and summary docs over raw aggregation
- avoid pulling large sets into the dashboard app just to compute totals

### Backend response rules

- return clean DTOs ready for rendering
- keep payloads small
- avoid over-fetching
- aggregate on the backend, not in React
- use read models for overview, finance, and analytics surfaces

### Caching rules

- cache partner summary responses briefly when safe
- use Redis for speed when the route is hot
- keep Firestore as truth, not cache
- use stale-while-revalidate or timed refresh where appropriate

### Analytics rules

- precompute rollups
- do not compute heavy analytics live from raw orders on every request
- keep chart endpoints small and purpose-built

## Safe Rollout and Cutover Rules

Every migration slice should move ownership safely without breaking the page.

### Safe cutover pattern

1. Build the Fastify-backed owner first.
2. Keep the old dashboard route as a thin bridge if needed.
3. Preserve the current frontend contract where possible.
4. Verify parity.
5. Remove old app-local business logic.
6. Remove the bridge only after the new backend path is stable.

### What not to do

- do not rewrite the entire page and backend at once
- do not delete working business logic before the new owner is proven
- do not move multiple unrelated surfaces in one risky cutover
- do not keep duplicate business owners around for long once parity is proven

## Phase Entry and Exit Criteria

Each phase should have explicit entry and exit criteria.

### Entry criteria for a phase

- the previous phase is stable enough to build on
- the pages and routes in scope are inventoried
- the current business logic has been identified
- the target backend owner is defined
- the manual test plan for the phase is written down

### Exit criteria for a phase

- Fastify and shared services own the business logic for that slice
- app-local routes are thin bridges or removed
- protected Firestore business logic is no longer owned by the dashboard app for that slice
- auth/RBAC/scope checks are verified
- loading/error/empty states are verified
- performance is acceptable
- manual QA has passed
- rollback/cutover risk is understood

## What to Preserve During Migration

This migration is not a rewrite-from-memory.

Many of the current business rules in the dashboard app may already be correct and relied on by the business.

That means:

- preserve working behavior
- re-home the logic into the right layer
- do not simplify away important rules
- do not lose product nuance

For every feature we migrate, we must ask:

1. What logic already exists here?
2. Is it correct and used in production behavior?
3. Should it move into Fastify route orchestration, `packages/core`, or repository/read-model layer?
4. How do we prove parity after moving it?

## Partner Dashboard Migration Phases

These are the Partner Dashboard phases we should work in.

### Phase 0: Platform Guardrails

Purpose:

- freeze the architecture direction
- stop new app-local backend debt from being introduced
- define what belongs in Next.js API routes vs Fastify
- define parity and review standards

Outputs:

- documented migration rules
- documented route ownership rules
- documented auth/RBAC/context rules
- documented logging/error/caching conventions
- documented "thin bridge only" rule for temporary app routes

### V-1: Venue Foundation

Scope:

- `/venue`
- venue layout
- venue shell
- venue auth/session bootstrap
- route protection
- staff bootstrap context

Goal:

- one reliable venue access context
- one reliable role-aware shell
- no inconsistent venue membership truth

### V-2: Venue Core Workspace

Scope:

- `/venue/page`
- `/venue/events`
- `/venue/events/[id]`
- `/venue/calendar`
- `/venue/orders`
- `/venue/reservations`
- `/venue/registers`
- `/venue/tables`
- `/venue/walk-ins`

Goal:

- move venue operational truth to Fastify
- remove app-local Firestore-heavy ops routes as business owners

### V-3: Venue Guest Ops and Door

Scope:

- `/venue/guest-ops`
- `/venue/guest-ops/overview`
- `/venue/guest-ops/list`
- `/venue/guest-ops/rules`
- `/venue/guest-ops/scanner`
- `/venue/guest-ops/exceptions`
- `/venue/door`
- `/venue/door/sell`
- `/venue/door/dinein`

Goal:

- centralize scanner, guest list mutations, exceptions, and door rules in the backend

### V-4: Venue Staff and Permissions

Scope:

- `/venue/staff`
- `/venue/staff/profiles`
- staff detail/profile pages
- assignment/security screens

Goal:

- centralize staff RBAC, profile enforcement, audit trail, and PII policy

### V-5: Venue Finance

Scope:

- `/venue/finance`
- `/venue/finance/ledger`
- `/venue/finance/payments`
- `/venue/finance/payouts`
- `/venue/finance/venue-payouts`
- `/venue/finance/host-payouts`
- `/venue/finance/promoter-payouts`
- `/venue/finance/revenue-splits`
- `/venue/finance/reports`
- `/venue/finance/records`
- `/venue/finance/cover`
- `/venue/payouts`

Goal:

- move finance truth into gateway + shared services
- stop frontend/app-local routes from computing finance truth

### V-6: Venue Analytics

Scope:

- `/venue/analytics`
- `/venue/analytics/overview`
- `/venue/analytics/live`
- `/venue/analytics/events`
- `/venue/analytics/hosts`
- `/venue/analytics/history`
- `/venue/analytics/advanced`

Goal:

- serve analytics from read models and cached summaries
- avoid heavy raw aggregation inside app-local API routes

### V-7: Venue Growth, Relationships, and Settings

Scope:

- `/venue/marketing`
- `/venue/connections`
- `/venue/connections/requests`
- `/venue/connections/partners`
- `/venue/partners`
- `/venue/partnerships`
- `/venue/page-management`
- `/venue/presence`
- `/venue/menu`
- `/venue/settings`
- `/venue/security`

Goal:

- centralize settings and relationship workflow ownership

### H-1: Host Foundation

Scope:

- `/host`
- host layout
- host shell
- host auth/session bootstrap
- host route protection

Goal:

- one reliable host context and access model

### H-2: Host Core Operations

Scope:

- `/host/page`
- `/host/events`
- `/host/events/[id]`
- `/host/create`
- `/host/create/select-venue`
- `/host/calendar`
- `/host/ops`
- `/host/team`
- `/host/profile`
- `/host/page-management`

Goal:

- centralize event creation, edit rules, venue associations, and team permissions

### H-3: Host Audience, Network, and Partnerships

Scope:

- `/host/audience`
- `/host/network`
- `/host/discover`
- `/host/promoters`
- `/host/partners/[id]`
- `/host/partnerships`
- `/host/presence`
- `/host/reviews`

Goal:

- centralize audience/privacy/partnership logic in the backend

### H-4: Host Finance

Scope:

- `/host/finance`
- host event-level finance views

Goal:

- centralize host earnings, settlements, and payouts

### H-5: Host Analytics

Scope:

- `/host/analytics`
- `/host/analytics/[category]`

Goal:

- move analytics to rollup-backed backend responses

### H-6: Host Settings

Scope:

- `/host/settings`

Goal:

- centralize settings ownership and audit history

### P-1: Promoter Foundation

Scope:

- `/promoter`
- promoter layout
- promoter shell
- promoter auth/session bootstrap
- route protection

Goal:

- one reliable promoter assignment context

### P-2: Promoter Core Operations

Scope:

- `/promoter/events`
- `/promoter/events/[assignmentId]`
- `/promoter/links`
- `/promoter/guests`
- `/promoter/partners`
- `/promoter/partners/[id]`
- `/promoter/partnerships`
- `/promoter/persona`

Goal:

- centralize assignment, attribution, links, and guest visibility logic

### P-3: Promoter Finance

Scope:

- `/promoter/finance`
- `/promoter/finance/commissions`
- `/promoter/finance/payouts`
- `/promoter/payouts`

Goal:

- centralize commission truth and payout logic

### P-4: Promoter Analytics

Scope:

- `/promoter/analytics`
- `/promoter/analytics/[category]`

Goal:

- move promoter analytics onto backend rollups and stable DTOs

### P-5: Promoter Settings

Scope:

- `/promoter/settings`

Goal:

- centralize settings/privacy/preferences/account config

## Recommended Order of Work

Use this order:

1. Phase 0
2. V-1
3. H-1
4. P-1
5. V-2
6. H-2
7. P-2
8. V-3
9. V-4
10. V-5
11. H-4
12. P-3
13. V-6
14. H-5
15. P-4
16. V-7
17. H-3
18. H-6
19. P-5

Why this order:

- foundation and auth/scope first
- core operations before finance/analytics
- finance after operational truth is stable
- analytics after read models and operational truth are stable
- settings/growth late unless a business priority pulls them earlier

## How to Work on the Migration

Do not migrate randomly page by page.

Migrate by backend ownership and feature family.

For each phase, use the same execution loop.

### Step 1: Inventory the phase

For the phase you are working on, list:

- every page in scope
- every app-local API route it calls
- every server helper/store/repository it depends on
- every Firestore collection touched
- every current auth/RBAC rule

Output expected:

- one feature inventory table
- one route ownership list

### Step 2: Classify every route

For each route in that phase, decide:

- keep as thin bridge temporarily
- move ownership to new Fastify route
- retire/delete later

This should be explicit.

Every route needs:

- current owner
- target owner
- transition method
- deletion plan

### Step 3: Extract and preserve working business logic

Read the current route and helper/store logic carefully.

Document:

- existing validations
- state transitions
- computed fields
- fallbacks
- audit behavior
- permission checks
- hidden business assumptions

Do not throw this away.

Move it into:

- Fastify route orchestration if it is HTTP/surface-specific
- `packages/core` if it is reusable business logic
- repository/read-model layer if it is data access

### Step 4: Define the target API contract

Before changing the frontend, define:

- request shape
- response DTO
- auth requirements
- role/scope requirements
- pagination/filter rules
- cache rules
- audit/logging expectations

This prevents accidental contract drift.

### Step 5: Implement the backend owner first

Add or improve the Fastify route and service layer first.

Preferred shape:

- Fastify route validates input
- Fastify attaches auth context
- Fastify checks scope
- Fastify calls service/use case
- service calls shared repositories
- response returns clean DTO

Do not move heavy business logic into long Fastify route files.

### Step 6: Keep the dashboard stable with thin bridges

If the UI currently calls `/api/...`, do not break it immediately.

Instead:

- keep the app-local route
- reduce it to auth + proxy + minor normalization if needed
- forward to Fastify

This gives safe migration without a big frontend rewrite.

### Step 7: Update page consumers only when needed

Once the backend ownership is moved:

- keep frontend contracts stable where possible
- only update pages if contract improvements are worth the change
- remove client-side shaping that is now redundant

The goal is not UI churn.
The goal is backend ownership transfer.

### Step 8: Verify auth, RBAC, and scope

For every migrated route, test:

- correct partner access
- wrong partner denied
- wrong role denied
- staff permission subsets enforced
- PII masking behavior
- inactive membership behavior
- cross-entity access blocked

### Step 9: Verify data shape and performance

Check:

- Firestore query shape
- indexes needed
- pagination
- no full scans on hot paths
- read models vs raw truth
- denormalized summary usage
- response payload size
- unnecessary client recomputation

### Step 10: Verify UX states

Every migrated page must be checked for:

- loading states
- error states
- empty states
- partial failure behavior
- optimistic update safety
- mobile behavior
- hydration/render stability

### Step 11: Verify observability

Each slice should have:

- structured errors
- audit logs for sensitive writes
- request logging where useful
- clear failure paths

### Step 12: Add tests

At minimum:

- route contract tests
- permission tests
- regression tests for core business behavior
- smoke coverage for key flows

### Step 13: Manually test before moving on

Do not advance the phase until the phase is manually verifiable.

Manual test result should confirm:

- same user-facing behavior
- no obvious regression
- backend ownership now lives in Fastify/shared services
- app-local route is either a thin bridge or removed

## Detailed Phase-by-Phase Implementation Pattern

Use this exact sequence for every phase.

### A. Discovery pass

1. List all pages in the phase.
2. List all routes each page calls.
3. List all `lib/server/*` dependencies.
4. List all collections queried.
5. Mark which routes are already gateway-backed and which are direct Firestore.

### B. Ownership design

1. Write target Fastify route list.
2. Map old route -> new owner.
3. Decide shared service boundaries in `packages/core`.
4. Decide whether a temporary app-local proxy route is needed.

### C. Backend implementation

1. Build or improve the Fastify route.
2. Move/reuse business logic in `packages/core`.
3. Add repository/read-model access.
4. Add auth/scope enforcement.
5. Add audit logging.
6. Add DTO normalization.

### D. Bridge and client cutover

1. Turn existing app-local route into thin proxy if needed.
2. Keep response shape stable.
3. Remove duplicate local business logic.
4. Keep the page working.

### E. Verification

1. Check runtime behavior.
2. Check route contract.
3. Check wrong-role access.
4. Check empty/loading/error states.
5. Check logs and audit records.
6. Check performance.

### F. Cleanup

1. Delete no-longer-needed app-local helper logic.
2. Delete dead routes.
3. Update documentation.
4. Lock the new phase baseline before moving on.

## What "Done" Means for a Phase

A phase is done only when:

- the business logic for that slice is owned by Fastify and shared services
- the dashboard page behavior still matches the product expectation
- app-local routes are thin bridges or removed
- direct protected Firestore logic has been removed from the dashboard for that slice
- auth/RBAC/scope is verified
- manual QA passed

## Immediate Main Focus

The main focus should not be redesigning the entire dashboard UI.

The main focus should be:

1. stop adding new app-local backend debt
2. move operational ownership out of `apps/partner-dashboard/app/api/*`
3. preserve working behavior
4. centralize rules into Fastify and `packages/core`

## Blunt Summary

The Partner Dashboard already has the shell of the right architecture:

- one dashboard app
- one API gateway app
- shared packages
- some BFF/proxy routes already in place

But in practice, it is still carrying too much backend responsibility locally.

Right now:

- Fastify is a backend
- not yet the backend

The migration job is to make Partner Dashboard behave like a real frontend over one central backend without losing the business logic that already works.

## Suggested First Execution Milestone

The best first Partner Dashboard milestone is:

1. Phase 0 completed
2. V-1 completed
3. H-1 completed
4. P-1 completed

That gives:

- stable partner auth/session bootstrap
- stable membership truth
- stable role-aware shell
- clear rules for all future slices

After that, move into:

- V-2
- H-2
- P-2

Only then move deeper into finance and analytics.
