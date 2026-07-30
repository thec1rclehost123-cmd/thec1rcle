# Guest Portal Architecture Truth

Updated 2026-07-29.

The Guest Portal has one backend boundary:

```text
Browser -> typed guestApi -> /api/v1 rewrite -> Fastify -> packages/core -> Redis/Firestore/providers
RSC     -> server guestApi ------------------> Fastify -> packages/core -> Redis/Firestore/providers
```

## Decisions

- The former `app/api/app/*` and `lib/bff/*` rollout is removed.
- Fastify is the only public business API and security authority.
- The UI must not own Firestore, Firebase Admin, payment verification,
  fulfillment, inventory, finance, or promoter-conversion logic.
- The browser uses generated operation metadata and shared request helpers.
- Public server reads use bounded caching/revalidation; inventory and checkout
  mutations are never ISR-cached.
- Auth restoration is profile-critical. Notification count is loaded through its
  feature-owned query and does not delay session restoration.
- Ticket wallet data is route-owned and is not globally prefetched.

## Allowed local route handlers

- `apps/guest-portal/app/api/internal/revalidate/route.ts`
- `apps/guest-portal/app/api/dev/email-preview/route.js`

The first is an authenticated internal cache invalidation seam. The second is
development-only and must fail closed outside development.

## Guardrails

- `tests/single-gateway-surface.test.js` blocks restoration of Guest BFF routes,
  feature flags, and duplicate rollout paths.
- `tests/ghost-bridge-boundaries.test.js` restricts local route handlers to
  value-adding internal/development surfaces.
- Direct Firebase SDK/Admin and raw business fetches are forbidden from the
  Guest browser runtime.

Historical documents that describe `app/api/app/*` as the target architecture
are superseded by this file and
`docs/architecture/guest-portal-target-architecture.md`.
