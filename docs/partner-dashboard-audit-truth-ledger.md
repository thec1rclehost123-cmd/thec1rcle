# Partner Dashboard Audit Truth Ledger

Last updated: 2026-05-01

## Baseline

- Route baseline is frozen by `scripts/partner-dashboard-hardening-baseline.mjs`.
- Characterization lock:
  - Host BFF routes: `41`
  - Venue BFF routes: `92`
  - Promoter BFF routes: `21`
  - Cross-role promoter BFF routes: `7`
  - Unified `/api/partners` catch-all routes: `1`
- Manual verification for this slice lives in [partner-dashboard-manual-qa.md](./partner-dashboard-manual-qa.md).

## Truth Ledger

| Finding | State | Owner | Observed control path | Rollback / guard |
| --- | --- | --- | --- | --- |
| Venue guest-ops event-scope is not enforced on unified partner routes | `confirmed` | `apps/partner-dashboard` BFF guard, then `apps/api-gateway` | Browser -> `/api/partners/venues/guest-ops/*` -> unified catch-all -> Fastify | Keep URL stable; deny out-of-scope access before proxying |
| Venue guestlist read-only staff can still attempt guest mutations through unified partner routes | `confirmed` | `apps/partner-dashboard` BFF guard | Browser -> `/api/partners/venues/guest-ops/*` | Enforce guestlistScope before proxy |
| Venue walk-ins root access allows event-scoped staff to query without narrowing to one event | `confirmed` | `apps/partner-dashboard` BFF guard | Browser -> `/api/partners/venues/walk-ins` | Require explicit allowed `eventId` when staff is event-scoped |
| Host verification form submit references undefined `idUrl` and `instaUrl` | `confirmed` | `apps/partner-dashboard` | Browser -> `components/HostVerificationForm.jsx` -> `/api/auth/host-verification` | Upload assets first, validate files, then submit |
| Host and promoter membership auth re-read Firestore on every uncached BFF access | `confirmed` | `apps/partner-dashboard` | Next BFF `requireHostAccess` / `requirePromoterAccess` | Add short-lived in-process cache with no contract change |
| Promoter click tracking has no idempotency support in the live gateway/core path | `confirmed` | `apps/api-gateway` + `packages/core` | Guest -> `/api/v1/promoter/links/click` -> `trackPromoterLinkClick()` | Add optional idempotency key, default-safe legacy contract |
| Host overview still carries V1 + compare branches | `confirmed` | `apps/partner-dashboard` | Browser -> `app/host/PageClient.tsx` | Do not remove until parity is proven |
| Direct browser-to-Storage uploads exist across host, venue, and shared editors | `confirmed` | `apps/partner-dashboard` | Client components using `uploadBytes*` / `getDownloadURL` | Inventory first, then migrate surface-by-surface |
| `walkInStore.ts`, `eventIntelligenceStore.ts`, and `promoterFinanceStore.ts` are still present but are not the active route owners for the main unified partner flows | `stale_or_shadow` | `apps/partner-dashboard` | Legacy/local store files with low or zero runtime imports | Keep documented until removed; avoid spending parity effort on dead paths |
| Host auth writes an audit row on every request | `already-fixed` | `apps/partner-dashboard` | `lib/server/hostAuthMiddleware.ts` | No per-request audit call is present in the live guard |
| Route-family duplication is only partially retired | `confirmed` | `apps/partner-dashboard` | `/host/discover`, `/host/network`, `/venue/partners`, `/venue/connections`, `/promoter/partners`, `/promoter/connections` | Redirect proof before deletion |

## Phase mapping

- Phase 1-2:
  - Baseline script/test
  - This truth ledger
  - Manual QA guide
- Phase 3:
  - Venue partner-route enforcement
  - Venue event-scope and guestlistScope hardening
- Phase 4:
  - Host verification fix
  - Host auth cache
- Phase 5:
  - Promoter click idempotency
  - Promoter finance/link live-path follow-ups
- Phase 6+:
  - Direct upload migration
  - Legacy route retirement
  - Shared auth/audit/settings consolidation
