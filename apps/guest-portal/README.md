# Guest Portal Current Runtime Truth

This file is the current source-of-truth note for `apps/guest-portal`.
Older specification files in this directory are historical unless they are
verified against the active code.

## Runtime Boundary

- Guest Portal source does not own local `app/api` route handlers.
- Browser calls use `/api/v1/*` and Next rewrites them to the Fastify API Gateway.
- Server-rendered public pages use `lib/api/server.js` to call the gateway directly.
- Auth is cookie/CSRF backed through Fastify routes, not Firebase client SDK auth.
- Large browser flows still exist for checkout, tickets, profile editing, discovery
  filtering, queue/waitlist UI, and venue interactions.

## Production Readiness Rules

- `next build` must fail on TypeScript errors.
- Gateway rewrites must use `GUEST_API_GATEWAY_URL` or `NEXT_PUBLIC_API_BASE_URL`
  before falling back to local development defaults.
- User-facing pages must not render hard-coded sample data when gateway data is
  unavailable.
- Ticket share/transfer OTP calls must use the Fastify auth schema:
  `{ type: "email", recipient, code? }`.

## Stale Docs Warning

The following docs may still describe older Firebase/direct-API behavior and
should be treated as historical until reconciled:

- `APP_SPECIFICATION.md`
- `USER_SIDE_SPECIFICATION.md`
- `USER_FRIENDLY_FEATURES.md`
- `FIREBASE_RULES_UPDATE.md`
- `HOST_SETUP.md`
- `SECURITY_MATRIX.md`
