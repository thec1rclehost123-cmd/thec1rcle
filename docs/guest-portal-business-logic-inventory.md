# Guest Portal Business Logic Inventory

Refreshed for the stabilize-first Ghost Bridge state on 2026-04-23.

## Current Architecture Truth

The Guest Portal is now a UI-first Next.js app that talks to the Fastify API Gateway through `/api/v1/*`.

- `apps/guest-portal/app/api` has no local `route.js`, `route.jsx`, `route.ts`, or `route.tsx` handlers.
- `apps/guest-portal/lib/server` is no longer a guest business-logic runtime bucket. The only remaining file is `publicDiscoveryAdapters.js`, which is a display adapter.
- Deleted local server modules and deleted local API routes must not be listed as current ownership.
- Frontend runtime still owns UI orchestration, auth/session hydration, client-side state, validation prompts, payment-provider handoff, QR display, and optimistic UX.
- Fastify owns guest business decisions, data reads/writes, pricing, payment verification, ticket ownership, profile mutation, public discovery, promoter attribution, relationship actions, reservations, waitlist, notifications, and entitlement operations.
- `packages/core` owns shared domain engines and reusable business helpers used by the gateway.

## Live Guest Domains

These are the current guest-facing business surfaces and their backend ownership.

1. Guest identity and profile completion: frontend prompts and auth state live in Guest Portal; profile writes and profile reads are gateway-owned.
2. Public discovery and homepage: frontend renders discovery/homepage cards; active event, host, venue, search, featured, selects, and interview reads are gateway-owned.
3. Event detail and conversion: frontend renders event detail and queue/RSVP states; event reads, view/track, RSVP, queue, waitlist, and reservation decisions are gateway-owned.
4. Checkout and payments: frontend owns cart UI and Razorpay handoff; pricing, promo, reservation, order initiation, payment config, payment order creation, and payment verification are gateway-owned.
5. Tickets and wallet: frontend renders wallet, QR, share, claim, pair, transfer, pass, download, and cover-wallet UI; ticket ownership and mutations are gateway-owned.
6. Social and promoter attribution: frontend triggers follow and vanity-link flows; relationship writes, promoter link resolution, click tracking, and referral attribution are gateway-owned.
7. Notifications and guest profiles: frontend renders notification/profile views; notification state and public guest profile reads are gateway-owned.

## Canonical Contracts

All guest runtime callers should use logical gateway paths that resolve to `/api/v1/*`; callers should not hit legacy `/api/*` business routes.

- Checkout calculation: `POST /api/v1/checkout/calculate`
- Promo validation: `POST /api/v1/checkout/promo`
- Inventory reservation: `POST /api/v1/checkout/reserve`
- Checkout initiation: `POST /api/v1/checkout/initiate`
- Payment config: `GET /api/v1/payments/config`
- Payment order creation: `POST /api/v1/payments/order`
- Payment verification: `PATCH /api/v1/payments/verify`
- Tickets wallet: `GET /api/v1/tickets`
- Ticket share, claim, pair, transfer, cover-wallet, download, and passes: `/api/v1/tickets/*`, `/api/v1/transfer*`, `/api/v1/cover-wallet`, and `/api/v1/passes/*`
- Profile mutation: `POST /api/v1/users/profile`
- Auth/profile compatibility reads and writes: logical `/auth/profile` is intentionally mapped in `lib/client/gateway.js` and covered by tests.
- Public events: `GET /api/v1/public/events`
- Featured events: `GET /api/v1/public/events/featured`
- Event detail: `GET /api/v1/public/events/:eventId`
- Hosts and venues: `GET /api/v1/public/hosts*` and `GET /api/v1/public/venues*`
- Public search: `GET /api/v1/public/search`
- Homepage selects and interviews: `GET /api/v1/public/homepage/selects` and `GET /api/v1/public/homepage/interviews`
- Promoter vanity links: `GET /api/v1/public/promoters/:username/links/:alias`
- Promoter click tracking: `POST /api/v1/promoter/links/click`
- Recommendations: `GET /api/v1/recommendations`
- Notifications: `/api/v1/guest-notifications`

## Intentional Compatibility Layer

`apps/guest-portal/lib/client/gateway.js` is still allowed to keep explicit compatibility mappings while the UI is stabilized. Each mapping must be treated as contract surface, not a hidden patch.

- Any intentional mapping must have a boundary test in `apps/guest-portal/tests/gateway-path-boundaries.test.js`.
- New hidden rewrites should not be added just to mask a broken caller.
- Payment callers must use explicit logical payment routes: `/payments/config`, `/payments/order`, and `/payments/verify`.
- Bare logical `/payments` is not a valid runtime payment caller for checkout.

## Guardrails

The stabilize-first pass protects the current architecture with tests instead of large UI refactors.

- `apps/guest-portal/tests/ghost-bridge-boundaries.test.js` keeps guest `app/api` free of local route handlers and fails on source-level duplicate/backup runtime artifacts such as `* 2.*`, `.bak`, and `.old`.
- `apps/guest-portal/tests/gp4-checkout-boundaries.test.js` fences checkout/payment endpoint contracts.
- `apps/guest-portal/tests/gateway-path-boundaries.test.js` documents intentional gateway path compatibility mappings.
- `apps/guest-portal/tests/removed-runtime-modules.test.js` prevents deleted local backend modules from being restored.
- `docs/phase-0-api-route-inventory.json` is repo-wide and generated from live `app/api` route files. Guest Portal should remain absent from that route list unless an approved web-specific helper is intentionally introduced.
- `governance/backend-boundary-exceptions.json` should not contain Guest Portal `app/api` exceptions while Guest Portal has zero local route handlers.

## Known Stabilize-First Debt

These are intentionally deferred from this pass.

- `components/CheckoutContainer.jsx` and `app/tickets/PageClient.jsx` remain large UI orchestration files.
- Full UI atomization and component decomposition are later premium-cleanup work.
- A generated typed OpenAPI client is still future work; current protection is explicit gateway mapping tests.
- Manual QA is still required for paid checkout, free/RSVP checkout, payment confirmation redirect, tickets, ticket share/claim/pair, profile update, vanity link redirect, explore, and homepage featured content.
