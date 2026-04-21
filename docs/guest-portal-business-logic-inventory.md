# Guest Portal Business Logic Inventory

This document is the preservation baseline for Guest Portal migration work.

The rule for all future migration work is:

1. No guest-facing business rule gets deleted because it is in the wrong layer.
2. Every current logic unit must be either:
   - preserved in place temporarily, or
   - rehomed into `apps/api-gateway` + `packages/core` with parity.
3. Any migration PR must say which items below it preserves, rehomes, or explicitly defers.

## Migration Status

- GP-1 migrated canonical guest identity/session bootstrap to Fastify-backed auth/profile bridges.
- GP-2 migrated public discovery browse reads to Fastify-backed public discovery bridges.
- GP-3 migrated event detail/conversion reads plus RSVP, queue, waitlist, view, and track to Fastify-backed ownership.
- The Guest Portal still contains substantial legacy business logic in local API routes and local server modules. That logic must be preserved and rehomed, not rewritten from memory.

## A. Guest Portal Business Domains

These are the business domains currently implemented inside the Guest Portal codebase.

1. Guest identity, session, route access, onboarding, OTP verification
2. Homepage curation and public discovery browse
3. Event detail, public conversion, RSVP, queue, waitlist, event tracking
4. Personalized recommendations and similar-event ranking
5. Venue profiles, venue follow, venue follow-status, reservations
6. Host profiles, host discovery, host follow
7. Guest public profiles and participation history
8. Checkout pricing, cart reservation, promo validation, payment initiation
9. Order creation, confirmation, cancellation, refund, webhook reconciliation
10. Tickets, QR generation, wallet passes, downloads
11. Ticket sharing, claim flows, transfers, couple tickets, reclaim/cancel flows
12. Ticket scan validation and entry processing
13. Notifications, follow graph, event update fanout
14. Promoter attribution, vanity links, conversion recording
15. Payment risk/fraud hooks, rate limiting, auth/security blocking
16. Platform/admin support logic currently colocated with guest modules

## B. Page And Surface Inventory

These pages are not all business logic by themselves, but each is a guest-facing business surface that depends on logic below.

### Public shell and auth

- `/` homepage: [apps/guest-portal/app/page.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/page.js)
- `/login`: [apps/guest-portal/app/login/page.jsx](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/login/page.jsx)
- `/auth`: [apps/guest-portal/app/auth/page.jsx](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/auth/page.jsx)
- `/auth/callback`: [apps/guest-portal/app/auth/callback/page.jsx](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/auth/callback/page.jsx)
- `/forgot-password`: [apps/guest-portal/app/forgot-password/page.jsx](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/forgot-password/page.jsx)

### Discovery and profile surfaces

- `/explore`: [apps/guest-portal/app/explore/page.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/explore/page.js)
- `/hosts`: [apps/guest-portal/app/hosts/page.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/hosts/page.js)
- `/host/[slug]`: [apps/guest-portal/app/host/[slug]/page.jsx](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/host/[slug]/page.jsx)
- `/venue/[slug]`: [apps/guest-portal/app/venue/[slug]/page.jsx](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/venue/[slug]/page.jsx)
- `/venue/[slug]/menu`: [apps/guest-portal/app/venue/[slug]/menu/page.jsx](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/venue/[slug]/menu/page.jsx)
- `/profile`: [apps/guest-portal/app/profile/page.jsx](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/profile/page.jsx)
- `/profile/[userId]`: [apps/guest-portal/app/profile/[userId]/page.jsx](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/profile/[userId]/page.jsx)
- `/[handle]`: [apps/guest-portal/app/[handle]/page.jsx](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/[handle]/page.jsx)

### Event and conversion surfaces

- `/event/[eventId]`: [apps/guest-portal/app/event/[eventId]/page.jsx](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/event/[eventId]/page.jsx)
- `/event/[eventId]/queue`: [apps/guest-portal/app/event/[eventId]/queue/page.jsx](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/event/[eventId]/queue/page.jsx)
- `/e/[eventId]`: [apps/guest-portal/app/e/[eventId]/page.jsx](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/e/[eventId]/page.jsx)
- `/[handle]/[eventSlug]`: [apps/guest-portal/app/[handle]/[eventSlug]/page.jsx](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/[handle]/[eventSlug]/page.jsx)

### Commerce and tickets

- `/checkout/[eventId]`: [apps/guest-portal/app/checkout/[eventId]/page.jsx](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/checkout/[eventId]/page.jsx)
- `/confirmation/[orderId]`: [apps/guest-portal/app/confirmation/[orderId]/page.jsx](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/confirmation/[orderId]/page.jsx)
- `/tickets`: [apps/guest-portal/app/tickets/page.jsx](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/tickets/page.jsx)
- `/tickets/claim/[token]`: [apps/guest-portal/app/tickets/claim/[token]/page.jsx](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/tickets/claim/[token]/page.jsx)
- `/tickets/pair/[token]`: [apps/guest-portal/app/tickets/pair/[token]/page.jsx](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/tickets/pair/[token]/page.jsx)

## C. API Route Inventory

These are the Guest Portal app-local API routes that currently carry or bridge business behavior.

### Auth and session

- `GET /api/auth/me`: [apps/guest-portal/app/api/auth/me/route.ts](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/auth/me/route.ts)
- `GET|POST /api/auth/profile`: [apps/guest-portal/app/api/auth/profile/route.ts](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/auth/profile/route.ts)
- `POST /api/auth/check`: [apps/guest-portal/app/api/auth/check/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/auth/check/route.js)
- `POST /api/auth/otp/send`: [apps/guest-portal/app/api/auth/otp/send/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/auth/otp/send/route.js)
- `POST /api/auth/otp/verify`: [apps/guest-portal/app/api/auth/otp/verify/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/auth/otp/verify/route.js)
- `POST /api/auth/onboard`: [apps/guest-portal/app/api/auth/onboard/route.ts](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/auth/onboard/route.ts)
- `POST /api/auth/host-verification`: [apps/guest-portal/app/api/auth/host-verification/route.ts](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/auth/host-verification/route.ts)
- `POST|DELETE /api/auth/session`: [apps/guest-portal/app/api/auth/session/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/auth/session/route.js)

### Public discovery

- `GET /api/events`: [apps/guest-portal/app/api/events/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/events/route.js)
- `GET /api/events/nearby`: [apps/guest-portal/app/api/events/nearby/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/events/nearby/route.js)
- `GET /api/events/[eventId]`: [apps/guest-portal/app/api/events/[eventId]/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/events/[eventId]/route.js)
- `GET /api/hosts`: [apps/guest-portal/app/api/hosts/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/hosts/route.js)
- `GET /api/hosts/[slug]`: [apps/guest-portal/app/api/hosts/[slug]/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/hosts/[slug]/route.js)
- `GET /api/venues`: [apps/guest-portal/app/api/venues/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/venues/route.js)
- `GET /api/venues/[venueId]`: [apps/guest-portal/app/api/venues/[venueId]/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/venues/[venueId]/route.js)
- `GET /api/search`: [apps/guest-portal/app/api/search/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/search/route.js)
- `GET /api/recommendations`: [apps/guest-portal/app/api/recommendations/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/recommendations/route.js)

### Event conversion

- `POST /api/events/[eventId]/view`: [apps/guest-portal/app/api/events/[eventId]/view/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/events/[eventId]/view/route.js)
- `POST /api/events/[eventId]/track`: [apps/guest-portal/app/api/events/[eventId]/track/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/events/[eventId]/track/route.js)
- `POST /api/events/[eventId]/rsvp`: [apps/guest-portal/app/api/events/[eventId]/rsvp/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/events/[eventId]/rsvp/route.js)
- `GET|POST /api/events/[eventId]/queue`: [apps/guest-portal/app/api/events/[eventId]/queue/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/events/[eventId]/queue/route.js)
- `GET|POST /api/waitlist`: [apps/guest-portal/app/api/waitlist/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/waitlist/route.js)

### Social and relationship actions

- `GET|POST|DELETE /api/follow`: [apps/guest-portal/app/api/follow/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/follow/route.js)
- `POST /api/venues/[venueId]/follow`: [apps/guest-portal/app/api/venues/[venueId]/follow/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/venues/[venueId]/follow/route.js)
- `GET /api/venues/[venueId]/follow-status`: [apps/guest-portal/app/api/venues/[venueId]/follow-status/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/venues/[venueId]/follow-status/route.js)

### Reservations

- `GET|POST /api/reservations`: [apps/guest-portal/app/api/reservations/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/reservations/route.js)
  - currently a BFF proxy to Fastify venue reservation endpoints
  - still guest-facing behavior and request/response contract must be preserved

### Checkout, payments, orders

- `POST /api/checkout/calculate`: [apps/guest-portal/app/api/checkout/calculate/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/checkout/calculate/route.js)
- `POST /api/checkout/promo`: [apps/guest-portal/app/api/checkout/promo/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/checkout/promo/route.js)
- `POST /api/checkout/reserve`: [apps/guest-portal/app/api/checkout/reserve/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/checkout/reserve/route.js)
- `POST /api/checkout/initiate`: [apps/guest-portal/app/api/checkout/initiate/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/checkout/initiate/route.js)
- `POST /api/checkout/cancel`: [apps/guest-portal/app/api/checkout/cancel/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/checkout/cancel/route.js)
- `POST /api/checkout/failure`: [apps/guest-portal/app/api/checkout/failure/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/checkout/failure/route.js)
- `GET|POST|PATCH /api/payments`: [apps/guest-portal/app/api/payments/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/payments/route.js)
- `GET|POST /api/orders`: [apps/guest-portal/app/api/orders/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/orders/route.js)
- `GET|POST /api/orders/[orderId]/cancel`: [apps/guest-portal/app/api/orders/[orderId]/cancel/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/orders/[orderId]/cancel/route.js)
- `POST /api/webhooks/payment`: [apps/guest-portal/app/api/webhooks/payment/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/webhooks/payment/route.js)

### Tickets and entitlements

- `GET /api/tickets`: [apps/guest-portal/app/api/tickets/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/tickets/route.js)
- `GET|POST /api/tickets/share`: [apps/guest-portal/app/api/tickets/share/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/tickets/share/route.js)
- `GET|POST /api/tickets/claim`: [apps/guest-portal/app/api/tickets/claim/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/tickets/claim/route.js)
- `GET|POST|PATCH|DELETE /api/tickets/transfer`: [apps/guest-portal/app/api/tickets/transfer/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/tickets/transfer/route.js)
- `GET /api/tickets/transfer/pending`: [apps/guest-portal/app/api/tickets/transfer/pending/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/tickets/transfer/pending/route.js)
- `GET|DELETE /api/tickets/couple`: [apps/guest-portal/app/api/tickets/couple/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/tickets/couple/route.js)
- `GET /api/tickets/download`: [apps/guest-portal/app/api/tickets/download/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/tickets/download/route.js)
- `GET /api/tickets/cover-wallet`: [apps/guest-portal/app/api/tickets/cover-wallet/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/tickets/cover-wallet/route.js)
- `POST /api/tickets/scan`: [apps/guest-portal/app/api/tickets/scan/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/tickets/scan/route.js)
- `GET /api/entitlements/[id]/qr`: [apps/guest-portal/app/api/entitlements/[id]/qr/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/entitlements/[id]/qr/route.js)
- `GET /api/passes/apple`: [apps/guest-portal/app/api/passes/apple/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/passes/apple/route.js)
- `GET /api/passes/google`: [apps/guest-portal/app/api/passes/google/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/passes/google/route.js)

### Profiles, notifications, promoter attribution, background

- `GET /api/profile/[userId]`: [apps/guest-portal/app/api/profile/[userId]/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/profile/[userId]/route.js)
- `GET|PATCH /api/notifications`: [apps/guest-portal/app/api/notifications/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/notifications/route.js)
- `POST /api/promoter/links/click`: [apps/guest-portal/app/api/promoter/links/click/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/promoter/links/click/route.js)
- `GET /api/email-preview`: [apps/guest-portal/app/api/email-preview/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/email-preview/route.js)
- `GET|POST|PUT /api/inngest`: [apps/guest-portal/app/api/inngest/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/inngest/route.js)

## D. Server Module Inventory

This is the actual business-logic core currently living in the Guest Portal app.

### D1. Identity, auth, OTP, bootstrap

#### [lib/server/auth.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/auth.js)

- `verifyAuth(request)`
  - verifies Firebase bearer token or `__session` cookie
  - resolves client IP from `x-real-ip` or `x-forwarded-for`
  - checks blocked IP and blocked user state via `@c1rcle/core/security-state`
  - uses degraded in-memory rate limiting when Redis/security-state is degraded
  - fails closed when Firebase is unavailable

#### [lib/server/verification.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/verification.js)

- `sendEmailOtp(email, type)`
  - generates 6-digit OTP
  - hashes OTP before persistence
  - applies resend cooldown using `otps` collection
  - stores attempt counter and expiry
  - sends via Resend when configured
- `verifyEmailOtp(email, code, type)`
  - checks existence, expiry, max attempts, hash match
  - increments failed attempts
  - deletes OTP on success
- `sendSmsOtp(phone)`
  - Msg91 dispatch, with mock development path
- `verifySmsOtp(phone, code)`
  - Msg91 verify path, with development bypass

#### [lib/server/guestBootstrap.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/guestBootstrap.js)

- guest bootstrap from current session for page access and shell hydration

#### [lib/auth/guestRouteAccess.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/auth/guestRouteAccess.js)

- guest route access rules for public pages, auth pages, and protected guest pages

### D2. Public discovery, homepage, event read models

#### [lib/homepageData.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/homepageData.js)

- homepage event grid and hero-card curation
- featured event selection for hero
- category derivation
- selects/interviews content loading from `homepage_selects` and `homepage_interviews`
- homepage stats rollup from event grid content

#### [lib/server/publicDiscoveryBridge.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/publicDiscoveryBridge.js)

- thin guest-facing bridge helpers to Fastify public discovery
- functions:
  - `fetchPublicEvents`
  - `fetchFeaturedEvents`
  - `fetchPublicEvent`
  - `fetchPublicHosts`
  - `fetchPublicHost`
  - `fetchPublicVenues`
  - `fetchPublicVenue`
  - `searchPublicDiscovery`

#### [lib/server/publicDiscoveryAdapters.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/publicDiscoveryAdapters.js)

- adapts Fastify list/search responses to legacy guest shapes
- preserves `events`, `venues`, `hosts`, `hits`, `totalHits`, `suggestions`

#### Legacy discovery still present and must be preserved until fully retired

##### [lib/server/eventStore.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/eventStore.js)

- `listEvents({ city, limit, sort, search, host })`
  - public event listing with fallback seed mode
  - city inference and normalization
  - heat/new/soonest/price sorting
  - Algolia-aware search path
  - fallback event filtering excludes past events
  - Redis list caching
- `createEvent(payload)`
  - guest-local event creation helper still exists
- `getCategoryFilters(events)`
  - homepage/discovery category extraction
- `getEvent(identifier)`
  - fetch by ID or slug with caching
- `getEventInterested(eventId, limit)`
  - social proof from `likes` plus `users`
- `getEventGuestlist(eventId, limit)`
  - guestlist aggregation from `orders`, `rsvp_orders`, `ticket_assignments`, `users`

##### [lib/server/featuredFeed.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/featuredFeed.js)

- spotlight-driven featured event curation
- pinned featured IDs from `platform_settings/spotlights`
- automatic heat-based featured fallback
- future/live-eligible event filtering
- de-duplication of pinned and heat lists

##### [lib/server/featuredFeedUtils.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/featuredFeedUtils.js)

- `mergePinnedAndHeatEvents`

##### [lib/server/recommendations.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/recommendations.js)

- content-based recommendation scoring
- derives user taste from past orders
- match signals:
  - tag affinity
  - host affinity
  - city affinity
  - event heat
  - negative weight for already attended events
- outputs:
  - `getRecommendedEvents(userId, limit)`
  - `getSimilarEvents(eventId, limit)`

### D3. Event conversion: views, track, RSVP, queue, waitlist

#### Current Fastify-bridged GP-3 routes

- `/api/events/[eventId]`
- `/api/events/[eventId]/view`
- `/api/events/[eventId]/track`
- `/api/events/[eventId]/rsvp`
- `/api/events/[eventId]/queue`
- `/api/waitlist`

These now bridge to Fastify ownership but the legacy business behavior below remains the preservation source.

#### [lib/server/queueStore.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/queueStore.js)

- `joinQueue(eventId, userId, deviceId)`
  - queue tiering using `@c1rcle/core` surge engine
  - loyalty lookback over 120 days
  - loyalty score from orders:
    - attended confirmed orders boost score
    - refunds penalize score
    - no-shows penalize score
  - verified-email bonus
  - new-account penalty
  - promotes to `LOYAL` tier when attendance and score conditions are met
- `getQueueStatus(queueId)`
- `admitUsers(eventId, count, source)`
- `validateAdmission(eventId, userId, token)`
- `consumeAdmission(queueId)`
- `flagPaymentFailure(queueId)`

#### [lib/server/waitlistStore.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/waitlistStore.js)

- `joinWaitlist({ eventId, ticketId, userId, email, phone })`
  - dedupes active waiting entries by event and email
  - supports ticket-specific or any-tier waitlist
- `getEventWaitlist(eventId)`
  - ordered active waitlist
- `processWaitlist(eventId, ticketId)`
  - notifies next eligible person
  - assigns 15-minute purchase window
- `verifyWaitlistAccess(eventId, email)`
  - access only when status is `notified` and not expired

### D4. Venue, host, public profile, social graph

#### [lib/server/venueStore.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/venueStore.js)

- `listVenues({ area, vibe, search, tablesOnly })`
  - public-profile-only venue listing
  - area, vibe, search, tables-only filtering
  - fallback venue catalog
  - caching
- `getVenueBySlug(slug)`
  - slug lookup with direct-ID fallback
- `followVenue(venueId, userId)`
  - venue-specific follow creation
- `unfollowVenue(venueId, userId)`
  - venue-specific unfollow
- `isFollowingVenue(venueId, userId)`
  - relationship status

#### [lib/server/hostStore.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/hostStore.js)

- `listHosts({ search, role, vibe, status, time, sort })`
  - role/vibe/status/search filters
  - “Most followed” and “Soonest event” sort
  - public-profile-only host listing
- `getHostByHandle(handle)`
- `getHostBySlug(slug)`
- `followHost(hostId)`

#### [lib/server/publicProfile.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/publicProfile.js)

- canonical public-profile gate
- checks `publicProfileEnabled`
- checks `presenceConfig.publicProfileEnabled`

#### [lib/server/notificationStore.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/notificationStore.js)

- `createNotification`
- `createBulkNotifications`
- `getFollowers(targetId, targetType)`
- `notifyNewEvent(event)`
  - host followers and venue followers
  - dedupes overlapping follower audiences
- `notifyEventUpdate(eventId, updateType, message, affectedUserIds)`
  - defaults target audience to ticket-holders for event
- `notifyTicketPurchase(order)`
- `notifyRefundProcessed(order)`
- `getUserNotifications(userId, options)`
- `markNotificationRead(notificationId)`
- `markAllNotificationsRead(userId)`
- `getUnreadCount(userId)`
- `followEntity(followerId, targetId, targetType)`
- `unfollowEntity(followerId, targetId, targetType)`
- `isFollowing(followerId, targetId)`

### D5. Profile, guest history, participation, tickets aggregation

#### [lib/server/profileStore.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/profileStore.js)

- `getUserProfile(userId)`
  - user profile read from `users`
  - Firebase Auth photo fallback when Firestore photo/avatar missing
  - serializes timestamps
- `findUserByEmail(email)`
- `getUserEvents(profileUserId, viewerUserId)`
  - merges participation from:
    - ticket orders
    - RSVP history
    - partner memberships
    - hosted/venue-created events
  - participation precedence:
    - hosted/owned overrides ticket/RSVP
    - confirmed ticket overrides RSVP
  - public privacy rule:
    - self can see more
    - others see only public lifecycle or completed events
  - splits into upcoming vs attended
- `getUserTickets(userId)`
  - aggregates orders, RSVP orders, couple assignments, entitlements, ticket scans, users, events
  - caches ticket payload
- `invalidateTicketsCache(userId)`

### D6. Checkout, pricing, promo, reservation

#### [lib/server/checkoutService.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/checkoutService.js)

- reservation window is 10 minutes
- reservation truth stored in `cart_reservations`
- `createCartReservation(eventId, customerId, deviceId, items, options)`
  - reserves inventory for checkout
  - ties reservation to event, device, customer, and line items
- `releaseReservation(reservationId)`
- `calculatePricing(eventId, items, options)`
  - computes checkout totals
- `validateAndCalculatePromoDiscount(eventId, code, items, userId)`
  - promo validation and discount application
- `getReservation(reservationId)`
- `initiateCheckout(reservationId, userId, userDetails, options)`
  - converts reservation to checkout intent
- `completeCheckout(orderId, paymentDetails)`
- `cleanupExpiredReservations()`

#### Route-level checkout logic that must be preserved

##### [app/api/checkout/reserve/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/checkout/reserve/route.js)

- auth-aware reserve flow
- request rate limiting
- surge status integration
- queue-admission validation before reserve

##### [app/api/checkout/initiate/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/checkout/initiate/route.js)

- auth-aware checkout start
- event read
- order creation
- Razorpay order creation
- rate limiting
- loads user profile for checkout context

##### [app/api/checkout/promo/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/checkout/promo/route.js)

- promo validation with optional auth context

##### [app/api/checkout/calculate/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/checkout/calculate/route.js)

- pricing calculation with reservation reconciliation

##### [app/api/checkout/cancel/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/checkout/cancel/route.js)

- auth-gated order cancellation path

##### [app/api/checkout/failure/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/checkout/failure/route.js)

- queue-payment-failure feedback path

### D7. Orders, payments, webhooks

#### [lib/server/orderStore.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/orderStore.js)

- collections:
  - `orders`
  - `rsvp_orders`
- `createRSVPOrder(payload)`
  - persists RSVP-style orders
- `createOrder(payload)`
  - paid order creation
- `getOrderById(orderId)`
- `getUserOrders(userId, limit)`
- `checkExistingRSVP(eventId, { userId, email })`
  - duplicate RSVP protection
- `getUserTicketCountForEvent(eventId, { userId, email })`
  - ticket ownership and per-event counting
- `getOrderByReservationId(reservationId)`
- `getEventOrders(eventId, limit)`
- `getEventSalesStats(eventId)`
- `cancelOrder(orderId)`
  - cancels order and related ticket assets
- `updateOrderStatus(orderId, status, paymentDetails)`
- `confirmOrder(orderId, paymentDetails)`
  - final confirmation and downstream issuance
- `cleanupStaleOrders(userId)`
- `wasWebhookProcessed(paymentId)`
  - webhook idempotency
- `logWebhookProcessed(paymentId, orderId, status)`
  - webhook audit log in `payment_webhook_logs`
- `updateOrderRefundStatus(paymentId, eventType, data)`
  - refund state propagation
- side effects observed in module:
  - event updates
  - share bundle invalidation
  - ticket assignment invalidation
  - entitlement invalidation
  - promoter conversion outbox writes
  - cover-wallet issuance failure logging

#### [lib/server/payments/razorpay.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/payments/razorpay.js)

- Razorpay order creation
- refund initiation
- payment provider integration details

#### [app/api/payments/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/payments/route.js)

- payment fetch/create/update endpoints
- blocked-user gating via `@c1rcle/core/security-state`
- payment logging hooks

#### [app/api/webhooks/payment/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/webhooks/payment/route.js)

- payment webhook verification and reconciliation
- webhook idempotency checks
- order confirmation/update paths
- refund status propagation
- payment event logging
- payment fraud check hook via `@c1rcle/core/attack-detection`
- refund notification path

### D8. Tickets, entitlements, scan, passes

#### [lib/server/ticketShareStore.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/ticketShareStore.js)

- collections:
  - `orders`
  - `share_bundles`
  - `ticket_assignments`
  - `transfers`
  - `entitlements`
  - `ticket_scans`
  - `couple_assignments`
  - `couple_claims`
- token and share bundle logic:
  - `verifyTicketToken`
  - `createShareBundle`
  - `getShareBundleByToken`
  - `claimTicketSlot`
  - `getOrderShareBundles`
  - `getOrderAssignments`
  - `cancelShareBundle`
  - `reclaimUnclaimedSlot`
- scan and QR logic:
  - `validateAndScanTicket`
  - `validateShortQR`
- user ticket relationship logic:
  - `getUserClaimedTickets`
- couple ticket logic:
  - `getCoupleAssignment`
  - `assignPartner`
  - `createPartnerClaimLink`
  - `claimPartnerSlot`
  - `getCoupleTicketStatus`
  - `cancelPartnerSlot`
  - `transferCoupleTicket`
- transfer logic:
  - `initiateTransfer`
  - `acceptTransfer`
  - `getPendingTransfers`
  - `cancelTransfer`
- order cleanup:
  - `invalidateOrderTickets(orderId, reason)`
- audit behavior:
  - writes audit logs for ticket-share actions

#### Ticket-facing route logic that must be preserved

- [app/api/tickets/share/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/tickets/share/route.js)
  - auth-gated share-bundle create/read
  - rate limiting
- [app/api/tickets/claim/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/tickets/claim/route.js)
  - GET bundle preview
  - POST claim execution
  - rate limiting
- [app/api/tickets/transfer/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/tickets/transfer/route.js)
  - transfer lifecycle CRUD
- [app/api/tickets/transfer/pending/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/tickets/transfer/pending/route.js)
  - pending sent/received transfer fetch
- [app/api/tickets/couple/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/tickets/couple/route.js)
  - couple-ticket status and cancel flow
  - rate limiting on destructive path
- [app/api/tickets/scan/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/tickets/scan/route.js)
  - auth-gated scan validation
  - QR verification
  - entitlement-engine entry processing
  - scan and auth logging
- [app/api/entitlements/[id]/qr/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/entitlements/[id]/qr/route.js)
  - auth-gated entitlement QR generation
- [app/api/tickets/download/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/tickets/download/route.js)
  - order, event, and profile-based ticket PDF generation
- [app/api/tickets/cover-wallet/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/tickets/cover-wallet/route.js)
  - cover-wallet lookup by order
- [app/api/passes/apple/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/passes/apple/route.js)
  - Apple wallet pass generation inputs
- [app/api/passes/google/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/passes/google/route.js)
  - Google wallet pass generation inputs

### D9. Promoter attribution and conversion

#### [lib/server/promoterStore.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/promoterStore.js)

- collections:
  - `promoter_links`
  - `promoter_commissions`
- `getPromoterLinkByCode(code)`
- `getPromoterByUsername(username)`
- `getPromoterLinkByVanityAlias(handle, alias)`
- `getPromoterActiveEvents(promoterId)`
- `recordConversion(linkId, orderId, orderAmount, ticketTierId)`
  - commission write path
  - transaction-based conversion integrity

#### [app/api/promoter/links/click/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/promoter/links/click/route.js)

- promoter click resolution by link code
- event resolution for clicked promoter links

### D10. Notifications and follow graph

#### [app/api/notifications/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/notifications/route.js)

- GET user notifications
- PATCH mark-one or mark-all read behavior

#### [app/api/follow/route.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/app/api/follow/route.js)

- generic follow status read
- generic follow create/delete
- currently local notification-graph backed behavior
- explicit auth requirement for follow/unfollow mutations
- target type validation limited to `venue` or `host`

### D11. Security, rate limiting, logging, infrastructure

#### [lib/server/rateLimit.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/rateLimit.js)

- per-route request limiting wrapper

#### [lib/server/logger.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/logger.js)

- request IDs
- auth logs
- payment logs
- scan logs

#### [lib/server/redisCache.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/redisCache.js)

- cache get/set/delete
- deterministic cache key building

#### [lib/server/security.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/security.js)

- OTP/security config values used by verification flows

#### [lib/server/qrStore.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/qrStore.js)

- QR payload verification for scan flows

#### [lib/server/apiClient.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/apiClient.js)

- guest-local API client construction helpers
- `getApiClient(token)`
- `getSystemApiClient()`

### D12. Shared ticketing helpers and support modules

#### [lib/server/ticketingLogic.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/ticketingLogic.js)

- shared helper logic used by checkout/ticket-share/order flows
- `isCoupleTicket(ticket)`
- `buildStoredOrderTicket(selectedTicket, eventTicket)`
- `getBundleInventoryMode(order)`
- `shouldReduceInventoryOnBundleCreation(inventoryMode, hasOwnerClaimed)`
- `shouldReduceInventoryOnBundleClaim(inventoryMode)`
- `parseDirectTicketId(ticketId)`
- `deriveDirectTransferMetadata(ticketId, order, event)`

#### [lib/server/partnerProfileStore.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/partnerProfileStore.js)

- supporting public-profile content blocks
- `getProfilePosts(profileId, type, limit)`
- `getProfileHighlights(profileId, type)`
- `getProfileStats(profileId, type)`

### D13. Platform and admin support logic still colocated in guest codebase

These are not core guest-user flows, but they are still part of the Guest Portal app-local business layer and must not be silently dropped if referenced during migration.

#### [lib/server/discoveryEngine.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/discoveryEngine.js)

- `discoveryEngine`
  - discovery curation/admin support behavior
  - writes to `events` and `admin_logs`

#### [lib/server/adminStore.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/adminStore.js)

- governance/action allowlists
- tiered privileged action model:
  - `ALLOWLIST_ACTIONS`
  - `TIER2_ACTIONS`
  - `TIER3_ACTIONS`
- `adminStore`
  - admin proposal, governance, venue, event, user, and financial support actions

#### [lib/server/notificationCampaigns.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/notificationCampaigns.js)

- `campaignStore`
  - notification campaign creation/update/audience selection behavior

#### [lib/server/experimentEngine.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/experimentEngine.js)

- `experimentEngine`
  - platform experiment creation
  - feature-flag sync
  - admin log writes

#### [lib/server/platformSeeder.js](/Users/aayushdivase/Desktop/thec1rcle/thec1rcle/apps/guest-portal/lib/server/platformSeeder.js)

- `seedPlatformSettings()`
  - seeds platform defaults and stats docs used by guest/platform flows

## E. Firestore Collections Touched By Guest Portal Logic

This list is derived from current guest-local server modules and app routes.

- `users`
- `events`
- `likes`
- `orders`
- `rsvp_orders`
- `cart_reservations`
- `ticket_assignments`
- `share_bundles`
- `transfers`
- `entitlements`
- `ticket_scans`
- `couple_assignments`
- `couple_claims`
- `waitlist`
- `otps`
- `notifications`
- `follows`
- `venue_follows`
- `partner_memberships`
- `venues`
- `hosts`
- `promoter_links`
- `promoter_commissions`
- `promoter_conversion_outbox`
- `platform_settings`
- `homepage_selects`
- `homepage_interviews`
- `cover_wallets`
- `cover_wallet_issuance_failures`
- `payment_webhook_logs`
- `notification_campaigns`
- `admin_logs`
- `audit_logs`
- `platform_experiments`
- `platform_stats`
- `admin_proposed_actions`
- `host_applications`

## F. Preservation Rules Per Domain

For every migration, preserve the exact business decision points below.

### Identity and auth

- cookie + bearer token auth compatibility
- blocked-IP and blocked-user checks
- degraded-mode limiter when Redis/security is unavailable
- OTP cooldown, expiry, max attempts, and hashed storage

### Discovery

- public lifecycle gating
- city normalization and legacy sort aliases
- featured-feed pinning + heat fallback
- homepage curated event grid and category extraction
- search response compatibility

### Event conversion

- view and track should remain lightweight and non-blocking
- RSVP duplicate/idempotent behavior must remain stable
- queue loyalty scoring inputs must stay intact
- queue admission token must remain compatible with checkout reserve validation
- waitlist duplicate-entry prevention and 15-minute notified window must remain

### Checkout and payments

- reservation TTL
- surge and queue gate before reserve
- promo validation semantics
- pricing calculation semantics
- payment initiation shape and provider linkage
- order status transitions and webhook idempotency
- refund propagation

### Tickets

- share bundle ownership rules
- claim token validation
- transfer pending/accept/cancel semantics
- couple-ticket partner claim/cancel semantics
- scan validation, duplicate scan handling, and entry recording
- pass generation inputs
- order cancellation/refund invalidates ticket artifacts

### Notifications and follow graph

- follow graph remains source for host/venue event fanout
- host + venue follower deduplication on new event notifications
- ticket-purchase and refund notifications remain emitted

### Promoter attribution

- vanity alias/code resolution
- conversion recording must remain transactional
- promoter conversion outbox semantics must stay intact

## G. What Is Already Rehomed Vs Still Local

### Already rehomed or bridged to Fastify

- GP-1 auth/profile canonical truth
- GP-2 public browse and public host/venue discovery
- GP-3 event detail read, track/view, RSVP, queue, waitlist

### Still local and must be preserved before rehoming

- homepage curation behavior
- recommendations
- reservations
- follow graph and follow-status
- notifications
- profile/tickets aggregation
- checkout and pricing
- orders and payment reconciliation
- ticket share/claim/transfer/couple logic
- ticket scan and entitlement QR
- wallet passes
- promoter attribution

## H. Operational Rule For Future Migration PRs

Every Guest Portal migration PR should include:

1. Business logic units from this document being moved
2. Exact old files and exact new files
3. Preserved rules, validations, and side effects
4. Collections touched before and after
5. Auth/RBAC/scope changes
6. Tests added for parity
7. Manual verification steps for guest flows

## I. Immediate Recommendation

Do not continue Guest Portal migration with ad hoc scope.

Work phase by phase from this inventory:

1. Checkout and order lifecycle
2. Ticket ownership/share/transfer/couple flows
3. Notifications and follow graph
4. Recommendations and homepage curation
5. Profile/tickets aggregation

Each phase should start by mapping the old local module exports above into target `packages/core` services and thin Fastify routes, with a parity checklist built from this file.
