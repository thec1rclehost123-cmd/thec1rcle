# Phase 0 Backend Boundary Guardrails

## Canonical Direction
- `apps/api-gateway` is the only product backend entry point for C1RCLE.
- `apps/guest-portal` and `apps/partner-dashboard` are frontends. Their `app/api/*` routes may exist only for web-specific concerns and temporary migration bridges.
- `packages/core` is where business rules, use-cases, repositories, and infra orchestration belong.
- Preserve parity when re-homing logic: behavior first, relocation second.

## Route Classes

| Class | What it means | Allowed in `app/api/*` |
| --- | --- | --- |
| `allowed_web_helper` | Web/runtime-only helper | Yes |
| `temporary_bridge` | Thin Next route that forwards to Fastify | Yes, temporarily |
| `legacy_backend_logic` | App-local route still acting like a backend | No new usage; allowed only through the Phase 0 exception manifest |

## What Stays In Next.js `app/api/*`
- Session or cookie helpers that are truly web-runtime specific
- Webhook handlers that belong close to the app runtime
- Edge/runtime helpers
- Thin migration bridges that forward auth/context to Fastify

## What Must Move To Fastify + `packages/core`
- Protected business reads and writes
- Pricing, payouts, commissions, finance, and permissions logic
- Protected analytics and Firestore-heavy dashboard queries
- Scanner decisions and anti-abuse logic
- Cross-entity workflows that combine multiple repositories or services

## Temporary Bridge Contract
- Verify or obtain the web auth context only when the app runtime needs it
- Forward the Firebase ID token to Fastify in `Authorization`
- Forward the request correlation id in `x-request-id`
- Forward scope headers only when the route contract documents them
- Validate only web-shape concerns at the edge
- Call Fastify through the app `lib/server/apiClient` helper
- Optionally adapt response shape for backward compatibility
- Do not make business decisions
- Do not read or write Firestore directly for protected product flows

## Gateway Base URL Rule
- Both web apps should resolve the gateway through `NEXT_PUBLIC_GATEWAY_URL`, `NEXT_PUBLIC_API_BASE_URL`, or `PUBLIC_API_URL`
- App-side API clients normalize those values to the canonical `/api/v1` base automatically
- New bridge routes should use the existing app `lib/server/apiClient` helper instead of hand-building gateway URLs

## Gateway Contracts Frozen In Phase 0
- Auth context: verified Firebase identity plus resolved internal memberships on `request.authContext`
- RBAC/scope: route checks should call shared helpers instead of handwritten per-route logic
- Validation: Zod at the route boundary only
- Error DTO: `{ error: { code, message, details?, requestId } }`
- Success DTOs: frontend-ready payloads, no raw Firestore leakage by default
- Audit logging: mutating routes should use the shared gateway audit helper
- Caching: public cache/rate-limit logic stays in Fastify; dashboards read bounded read models

## Current Known Gaps
- Route error shapes are still inconsistent outside the Phase 0-touched surfaces
- Partner membership and RBAC logic still exists in multiple app-local middlewares
- Some gateway routes still access Firestore directly instead of going through a cleaner service/repository boundary

## Phase 0 Enforcement Files
- Exception manifest: [governance/backend-boundary-exceptions.json](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/governance/backend-boundary-exceptions.json)
- Route inventory: [docs/phase-0-api-route-inventory.json](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/docs/phase-0-api-route-inventory.json)
- Checker: [scripts/check-backend-boundaries.mjs](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/scripts/check-backend-boundaries.mjs)

## Enforcement Mode
- Phase 0 is `block new only`
- Existing legacy routes are preserved through the exception manifest and migration inventory
- New legacy backend logic in frontend apps is a CI failure
