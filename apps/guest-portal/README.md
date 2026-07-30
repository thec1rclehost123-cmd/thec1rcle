# Guest Portal Runtime Truth

`apps/guest-portal` is a Next.js UI and server-rendering shell backed by the
Fastify API Gateway.

## Runtime boundary

- Browser requests use the typed helpers in `lib/api` and call `/api/v1/*`.
- `next.config.mjs` rewrites `/api/v1/*` to the configured Fastify gateway.
- React Server Components call the gateway through `lib/api/server.js`.
- Authentication is an HttpOnly session-cookie plus CSRF contract owned by Fastify.
- Business rules, persistence, payment verification, fulfillment, and inventory
  remain gateway/core responsibilities.
- Local route handlers are limited to the internal revalidation hook and the
  development-only email preview. There is no Guest Portal BFF/proxy namespace.

## State ownership

- React Query owns remote authenticated state such as wallet and notifications.
- Page server data seeds public discovery and detail routes.
- Component state owns ephemeral UI state.
- Compatibility stores must not become a second server-state authority.

## Development

Use the repository runtime from `.nvmrc`:

```sh
nvm use
npm run dev -w @c1rcle/api-gateway
npm run dev -w @c1rcle/guest-portal
```

Guest Portal: `http://localhost:3000`

API Gateway: `http://localhost:4000`

Never expose environment secrets in browser bundles. Use
`GUEST_API_GATEWAY_URL` for server-side gateway resolution and
`NEXT_PUBLIC_API_BASE_URL` only for a public browser base when required.

## Validation

Run focused tests while editing. Batch the workspace test, lint, type-check, and
production build at architecture checkpoints.
