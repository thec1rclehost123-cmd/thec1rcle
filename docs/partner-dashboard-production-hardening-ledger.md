# Partner Dashboard Production Hardening Ledger

Last updated: 2026-04-30

## Target boundary

- Keep dashboard page URLs stable.
- Keep thin Next.js BFF routes only as authenticated bridges.
- Route business-heavy partner reads and writes through `apps/api-gateway`.
- Use unified services as the default owners for finance, scheduling, and partner-scoped data integrity.

## Surface ledger

| Surface | Stable frontend/BFF path | Trusted gateway owner | Service / logic owner | Migration state |
| --- | --- | --- | --- | --- |
| Host finance overview, payouts, disputes, bank accounts | `/api/partners/hosts/finance/*` and legacy `/api/host/finance/*` bridges | `/api/v1/partners/hosts/finance/*` | `FinanceService` plus host finance presenters in `routes/v1/partners/hosts.ts` | Repointed |
| Venue finance overview, payouts, disputes, bank accounts | `/api/partners/venues/finance/*` and legacy `/api/venue/finance/*` bridges | `/api/v1/partners/venues/finance/*` | `FinanceService` plus venue finance presenters in `routes/v1/partners/venues.ts` | Repointed |
| Venue split-payout pages | `/api/partners/venues/finance/venue-payouts`, `/host-payouts`, `/promoter-payouts` | `/api/v1/partners/venues/finance/*` | Venue finance presenters in `routes/v1/partners/venues.ts` | Unified owner |
| Host venue calendar | `/api/partners/hosts/calendar` | `/api/v1/partners/hosts/calendar` | Partnership check in `routes/v1/partners/hosts.ts` + `SchedulingService` + event read model | Unified owner |
| Venue calendar reads | `/api/partners/venues/calendar` | `/api/v1/partners/venues/calendar` | `routes/v1/partners/venues.ts` + `SchedulingService` | Unified owner |
| Venue slot block / unblock / request review | `/api/partners/venues/slots`, `/api/venue/slots`, `/api/partners/venues/calendar*` | `/api/v1/partners/venues/slots*` and `/api/v1/partners/venues/calendar*` | `SchedulingService` | Repointed |
| Host event detail reads | `/api/partners/hosts/events/:eventId` | `/api/v1/partners/hosts/events/:eventId` | `HostService.getEvent()` | Hardened |
| Host event resubmit | `/api/partners/hosts/events/:eventId/resubmit` and legacy `/api/host/events/:id/resubmit` bridge | `/api/v1/partners/hosts/events/:eventId/resubmit` | Host route presenter + resubmission patch allowlist | Hardened |
| Bank account creation across host / venue / promoter | Role-specific finance endpoints above | Unified and legacy finance bridges | `buildPayoutAccountRecord()` | Hardened |
| Promoter link creation | `/api/v1/partners/promoters/links` and legacy promoter link routes | `routes/v1/partners/promoters.ts`, `routes/v1/promoters.ts` | `normalizePromoterCommissionRate()` | Hardened |

## Retirement targets

- Retire legacy `/api/v1/host/finance/*` usage after dashboard smoke coverage stays green on the repointed bridges.
- Retire legacy `/api/v1/venue/finance/*` usage after venue finance and split-payout pages are verified against unified contracts.
- Retire legacy `/api/v1/venue/slots*` usage after slot approval / rejection / block flows are fully exercised on unified routes.

## Audit acceptance checkpoints

- No finance page should consume a legacy gateway namespace.
- No scheduling write path should bypass `SchedulingService`.
- No bank-account writer should persist plaintext account or card numbers.
- No host event detail read should succeed across partner boundaries.
- No host venue calendar read should succeed without an active partnership.
