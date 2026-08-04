# Guest Portal Business Logic Inventory

Updated 2026-07-29.

## Guest Portal owns

- Rendering, accessibility, navigation, and interaction state.
- Page composition and response-to-view-model normalization.
- Typed API invocation through `lib/api`.
- React Query lifecycle for authenticated remote state.
- Ephemeral checkout selection before a reservation is requested.
- Razorpay SDK presentation after the gateway returns an authoritative order.
- Safe display of gateway error codes and recovery actions.

## Fastify and `packages/core` own

- Identity verification, session cookies, CSRF, RBAC, and membership resolution.
- Event visibility, price, capacity, tier limits, and inventory authority.
- Checkout quote, reservation TTL, initiation, verification, and recovery.
- Razorpay signature verification and webhook idempotency.
- Order state, single ticket fulfillment, wallet eligibility, and QR claims.
- Finance entries, analytics, attendee state, and promoter attribution.
- Firestore, Redis, Storage, and provider credentials.

## Data paths

| Surface | Browser/RSC seam | Gateway owner |
|---|---|---|
| Discovery | `guestApi.public` | `/api/v1/public/*` |
| Auth | `guestApi.auth` | `/api/v1/auth/*` |
| Profiles | `guestApi.profiles` | `/api/v1/profiles/*` |
| Checkout | `guestApi.checkout` | `/api/v1/checkout/*` |
| Orders | `guestApi.orders` | `/api/v1/orders/*` |
| Tickets | `guestApi.tickets` | `/api/v1/tickets/*` |
| Notifications | `guestApi.notifications` | `/api/v1/notifications/*` |
| Referral | `guestApi.referrals` | `/api/v1/referrals/*` |

## Forbidden Guest runtime ownership

- Direct Firestore/Firebase Admin access.
- Local forwarding/proxy routes.
- Payment verification or fulfillment.
- Independent price, inventory, finance, or attribution calculations.
- Parallel feature-flagged API implementations.

See `docs/architecture/guest-portal-target-architecture.md` for the full target.
