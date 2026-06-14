# Partner API Parity Ledger

Date: 2026-04-29

## Legacy Route Inventory

### Host routes (`apps/api-gateway/src/routes/v1/host.ts`)

| Legacy route | Functionality | Unified route | Status | Notes |
| --- | --- | --- | --- | --- |
| `GET /api/v1/host/overview` | Host dashboard overview | `GET /api/v1/partners/hosts/overview` | PARTIAL | Explicit unified handler exists, but it is a native unified contract rather than an exact legacy payload bridge. |
| `GET /api/v1/host/profile` | Host profile details | `GET /api/v1/partners/hosts/profile` | COMPLETE | Covered by `/partners/hosts/*` bridge. |
| `PATCH /api/v1/host/profile` | Update host profile | `PATCH /api/v1/partners/hosts/profile` | COMPLETE | Covered by `/partners/hosts/*` bridge. |
| `GET /api/v1/host/partnerships` | Host partnership list | `GET /api/v1/partners/hosts/partnerships` | COMPLETE | Covered by bridge. |
| `PATCH /api/v1/host/partnerships/:partnershipId` | Update partnership status | `PATCH /api/v1/partners/hosts/partnerships/:partnershipId` | COMPLETE | Covered by bridge. |
| `GET /api/v1/host/notifications` | Host notification list | `GET /api/v1/partners/hosts/notifications` | COMPLETE | Covered by bridge. |
| `PATCH /api/v1/host/notifications/read` | Mark notifications read | `PATCH /api/v1/partners/hosts/notifications/read` | COMPLETE | Covered by bridge. |
| `GET /api/v1/host/orders` | Host order list | `GET /api/v1/partners/hosts/orders` | COMPLETE | Covered by bridge. |
| `GET /api/v1/host/finance/disputes` | Host dispute list | `GET /api/v1/partners/hosts/finance/disputes` | COMPLETE | Covered by bridge. |
| `GET /api/v1/host/finance/payouts` | Host payout history | `GET /api/v1/partners/hosts/finance/payouts` | COMPLETE | Covered by bridge. |
| `GET /api/v1/host/finance/bank-accounts` | Host bank account list | `GET /api/v1/partners/hosts/finance/bank-accounts` | COMPLETE | Covered by bridge. |
| `POST /api/v1/host/finance/bank-accounts` | Add host bank account | `POST /api/v1/partners/hosts/finance/bank-accounts` | COMPLETE | Covered by bridge. |
| `DELETE /api/v1/host/finance/bank-accounts` | Delete host bank account | `DELETE /api/v1/partners/hosts/finance/bank-accounts` | COMPLETE | Covered by bridge. |
| `GET /api/v1/host/overview/summary` | Host summary cards | `GET /api/v1/partners/hosts/overview/summary` | COMPLETE | Covered by bridge. |
| `GET /api/v1/host/team` | Host team list | `GET /api/v1/partners/hosts/team` | PARTIAL | Explicit unified handler exists; payload is partner-native. |
| `PATCH /api/v1/host/team/:memberId` | Update host team member | `PATCH /api/v1/partners/hosts/team/:memberId` | PARTIAL | Explicit unified handler narrows accepted fields to role and active state. |
| `DELETE /api/v1/host/team/:memberId` | Remove host team member | `DELETE /api/v1/partners/hosts/team/:memberId` | PARTIAL | Explicit unified handler exists with simplified success payload. |
| `GET /api/v1/host/promoters` | Host promoter list | `GET /api/v1/partners/hosts/promoters` | COMPLETE | Covered by bridge. |
| `GET /api/v1/host/events/:id/tickets` | Host event ticket settings | `GET /api/v1/partners/hosts/events/:id/tickets` | COMPLETE | Covered by bridge. |
| `PATCH /api/v1/host/events/:id/tickets` | Update host event ticket settings | `PATCH /api/v1/partners/hosts/events/:id/tickets` | COMPLETE | Covered by bridge. |
| `POST /api/v1/host/events/:id/submit` | Submit host event for review | `POST /api/v1/partners/hosts/events/:id/submit` | COMPLETE | Covered by bridge. |
| `PATCH /api/v1/host/events/:id/resubmit` | Resubmit host event | `PATCH /api/v1/partners/hosts/events/:id/resubmit` | COMPLETE | Covered by bridge. |
| `GET /api/v1/host/events` | Host event list | `GET /api/v1/partners/hosts/events` | PARTIAL | Explicit unified handler exists with unified pagination and filters. |
| `GET /api/v1/host/analytics/time-series` | Host analytics series | `GET /api/v1/partners/hosts/analytics/time-series` | COMPLETE | Covered by bridge. |
| `GET /api/v1/host/venue-calendar` | Host venue calendar | `GET /api/v1/partners/hosts/venue-calendar` | COMPLETE | Covered by bridge. |
| `GET /api/v1/host/finance/overview` | Host finance overview | `GET /api/v1/partners/hosts/finance/overview` | COMPLETE | Covered by bridge. |

### Venue routes (`apps/api-gateway/src/routes/v1/venues.ts`)

| Legacy route | Functionality | Unified route | Status | Notes |
| --- | --- | --- | --- | --- |
| `GET /api/v1/venue/profile` | Venue profile details | `GET /api/v1/partners/venues/profile` | COMPLETE | Covered by `/partners/venues/*` bridge. |
| `PATCH /api/v1/venue/profile` | Update venue profile | `PATCH /api/v1/partners/venues/profile` | COMPLETE | Covered by bridge. |
| `GET /api/v1/venue/partnerships` | Venue partnerships | `GET /api/v1/partners/venues/partnerships` | PARTIAL | Explicit unified handler exists with partner-native payload. |
| `PATCH /api/v1/venue/partnerships/:partnershipId` | Update partnership status | `PATCH /api/v1/partners/venues/partnerships/:partnershipId` | PARTIAL | Explicit unified handler exists with simplified mutation contract. |
| `GET /api/v1/venue/notifications` | Venue notifications | `GET /api/v1/partners/venues/notifications` | COMPLETE | Covered by bridge. |
| `PATCH /api/v1/venue/notifications/read` | Mark venue notifications read | `PATCH /api/v1/partners/venues/notifications/read` | COMPLETE | Covered by bridge. |
| `GET /api/v1/venue/orders` | Venue order list | `GET /api/v1/partners/venues/orders` | COMPLETE | Covered by bridge. |
| `GET /api/v1/venue/analytics/time-series` | Venue analytics series | `GET /api/v1/partners/venues/analytics/time-series` | COMPLETE | Covered by bridge. |
| `GET /api/v1/venue/overview/summary` | Venue summary cards | `GET /api/v1/partners/venues/overview/summary` | COMPLETE | Covered by bridge. |
| `GET /api/v1/venue/overview` | Venue overview | `GET /api/v1/partners/venues/overview` | PARTIAL | Explicit unified overview remains a native unified contract. |
| `GET /api/v1/venue/overview/tonight` | Tonight guest operations snapshot | `GET /api/v1/partners/venues/overview/tonight` | COMPLETE | Covered by bridge. |
| `GET /api/v1/venue/page` | Venue page settings | `GET /api/v1/partners/venues/page` | COMPLETE | Covered by bridge. |
| `POST /api/v1/venue/page` | Save venue page settings | `POST /api/v1/partners/venues/page` | COMPLETE | Covered by bridge. |
| `GET /api/v1/venue/crm/online` | Online CRM list | `GET /api/v1/partners/venues/crm/online` | COMPLETE | Covered by bridge. |
| `GET /api/v1/venue/events` | Venue event list | `GET /api/v1/partners/venues/events` | PARTIAL | Explicit unified list exists with unified pagination and filters. |
| `PATCH /api/v1/venue/events` | Bulk event updates | `PATCH /api/v1/partners/venues/events` | COMPLETE | Covered by bridge. |
| `GET /api/v1/venue/events/requests` | Incoming event requests | `GET /api/v1/partners/venues/events/requests` | COMPLETE | Covered by bridge. |
| `GET /api/v1/venue/orders/latest` | Latest orders | `GET /api/v1/partners/venues/orders/latest` | COMPLETE | Covered by bridge. |
| `GET /api/v1/venue/staff` | Venue staff list | `GET /api/v1/partners/venues/staff` | COMPLETE | Covered by bridge. |
| `GET /api/v1/venue/staff-profiles` | Staff profile list | `GET /api/v1/partners/venues/staff-profiles` | COMPLETE | Covered by bridge. |
| `GET /api/v1/venue/staff-profiles/assignments` | Staff assignments | `GET /api/v1/partners/venues/staff-profiles/assignments` | COMPLETE | Covered by bridge. |
| `POST /api/v1/venue/staff-profiles/assign` | Assign staff profile | `POST /api/v1/partners/venues/staff-profiles/assign` | COMPLETE | Covered by bridge. |
| `POST /api/v1/venue/staff` | Add venue staff member | `POST /api/v1/partners/venues/staff` | COMPLETE | Covered by bridge. |
| `PATCH /api/v1/venue/staff` | Bulk update venue staff | `PATCH /api/v1/partners/venues/staff` | COMPLETE | Covered by bridge. |
| `DELETE /api/v1/venue/staff` | Bulk remove venue staff | `DELETE /api/v1/partners/venues/staff` | COMPLETE | Covered by bridge. |
| `PATCH /api/v1/venue/staff/:memberId` | Update venue staff member | `PATCH /api/v1/partners/venues/staff/:memberId` | COMPLETE | Covered by bridge. |
| `DELETE /api/v1/venue/staff/:memberId` | Remove venue staff member | `DELETE /api/v1/partners/venues/staff/:memberId` | COMPLETE | Covered by bridge. |
| `GET /api/v1/venue/events/:id/tickets` | Venue ticket breakdown | `GET /api/v1/partners/venues/events/:id/tickets` | COMPLETE | Covered by bridge. |
| `GET /api/v1/slots` | Venue slot list | `GET /api/v1/partners/venues/slots` | COMPLETE | Routed through venue bridge to legacy `/slots`. |
| `GET /api/v1/slots/:id` | Slot detail | `GET /api/v1/partners/venues/slots/:id` | COMPLETE | Routed through venue bridge to legacy `/slots/:id`. |
| `PATCH /api/v1/slots/:id` | Approve or reject slot | `PATCH /api/v1/partners/venues/slots/:id` | COMPLETE | Routed through venue bridge to legacy `/slots/:id`. |
| `GET /api/v1/venues` | Public venue directory | `GET /api/v1/partners/venues/directory` | COMPLETE | Explicit parity route added. |
| `GET /api/v1/venues/:id` | Public venue detail | `GET /api/v1/partners/venues/directory/:id` | COMPLETE | Explicit parity route added. |
| `GET /api/v1/venue/finance/cover-recon` | Cover reconciliation | `GET /api/v1/partners/venues/finance/cover-recon` | COMPLETE | Covered by bridge. |
| `GET /api/v1/venue/calendar` | Venue calendar view | `GET /api/v1/partners/venues/calendar` | PARTIAL | Explicit unified calendar now uses `availability_slots`, but payload differs from legacy multi-source shape. |
| `POST /api/v1/venue/calendar` | Add manual venue block | `POST /api/v1/partners/venues/calendar` | COMPLETE | Covered by bridge into legacy route; unified scheduling service also supports slot creation under `/calendar/slots`. |
| `DELETE /api/v1/venue/calendar` | Remove manual venue block | `DELETE /api/v1/partners/venues/calendar` | COMPLETE | Covered by bridge. |
| `POST /api/v1/venue/staff/accept` | Accept venue staff invite | `POST /api/v1/partners/venues/staff/accept` | COMPLETE | Covered by bridge. |
| `POST /api/v1/venue/upload` | Venue asset upload | `POST /api/v1/partners/venues/upload` | COMPLETE | Explicit parity route added. |
| `GET /api/v1/venue/presence` | Venue door presence summary | `GET /api/v1/partners/venues/presence` | COMPLETE | Covered by bridge. |

### Promoter routes (`apps/api-gateway/src/routes/v1/promoters.ts`)

| Legacy route | Functionality | Unified route | Status | Notes |
| --- | --- | --- | --- | --- |
| `GET /api/v1/connections` | Public promoter network list | `GET /api/v1/partners/promoters/network/connections` | COMPLETE | Explicit parity route added. |
| `POST /api/v1/connect` | Public promoter connect action | `POST /api/v1/partners/promoters/network/connect` | COMPLETE | Explicit parity route added. |
| `GET /api/v1/stats/:id` | Public promoter stats | `GET /api/v1/partners/promoters/stats/:id` | COMPLETE | Explicit parity route added. |
| `GET /api/v1/partner/promoter/profile` | Promoter profile | `GET /api/v1/partners/promoters/profile` | COMPLETE | Covered by `/partners/promoters/*` bridge. |
| `PUT /api/v1/partner/promoter/profile` | Update promoter profile | `PUT /api/v1/partners/promoters/profile` | COMPLETE | Covered by bridge. |
| `GET /api/v1/partner/promoter/overview` | Promoter overview | `GET /api/v1/partners/promoters/overview` | PARTIAL | Explicit unified handler exists with native unified payload. |
| `GET /api/v1/stats` | Authenticated promoter stats | `GET /api/v1/partners/promoters/stats` | COMPLETE | Covered by bridge. |
| `POST /api/v1/links` | Create promoter link | `POST /api/v1/partners/promoters/links` | PARTIAL | Explicit unified handler exists with normalized payload. |
| `GET /api/v1/promoter/links` | List promoter links | `GET /api/v1/partners/promoters/links` | PARTIAL | Explicit unified handler exists with unified pagination. |
| `POST /api/v1/promoter/links` | Create promoter link | `POST /api/v1/partners/promoters/links` | PARTIAL | Explicit unified handler exists with native response shape. |
| `PATCH /api/v1/promoter/links/:id` | Update promoter link | `PATCH /api/v1/partners/promoters/links/:id` | PARTIAL | Explicit unified handler exists with normalized response. |
| `GET /api/v1/promoter/links/:id/analytics` | Link analytics | `GET /api/v1/partners/promoters/links/:id/analytics` | PARTIAL | Explicit unified handler exists with normalized analytics payload. |
| `POST /api/v1/promoter/links/click` | Track promoter link click | `POST /api/v1/partners/promoters/links/click` | COMPLETE | Explicit parity route added. |
| `GET /api/v1/partner/promoter/analytics` | Promoter analytics overview | `GET /api/v1/partners/promoters/analytics` | PARTIAL | Explicit unified analytics route exists. |
| `GET /api/v1/promoter/analytics/:type` | Typed promoter analytics | `GET /api/v1/partners/promoters/analytics/:type` | COMPLETE | Covered by bridge. |
| `GET /api/v1/promoter/events` | Promoter event list | `GET /api/v1/partners/promoters/events` | PARTIAL | Explicit unified handler exists with unified pagination. |
| `GET /api/v1/partner/promoter/events` | Partner promoter events | `GET /api/v1/partners/promoters/events` | PARTIAL | Served by explicit unified events handler. |
| `GET /api/v1/partner/promoter/events/:id` | Promoter event detail | `GET /api/v1/partners/promoters/events/:id` | COMPLETE | Covered by bridge. |
| `GET /api/v1/promoter/connections` | Promoter connections | `GET /api/v1/partners/promoters/connections` | PARTIAL | Explicit unified handler exists with normalized payload. |
| `POST /api/v1/promoter/connections` | Request promoter connection | `POST /api/v1/partners/promoters/connections/request` | PARTIAL | Explicit unified handler uses `request` suffix and native payload. |
| `PATCH /api/v1/promoter/connections` | Respond to promoter connection | `PATCH /api/v1/partners/promoters/connections/:connectionId` | PARTIAL | Explicit unified handler uses path param instead of legacy body contract. |
| `GET /api/v1/promoter/guests` | Promoter guest list | `GET /api/v1/partners/promoters/guests` | COMPLETE | Covered by bridge. |
| `GET /api/v1/partner/promoter/guests` | Partner promoter guests | `GET /api/v1/partners/promoters/guests` | COMPLETE | Covered by bridge. |

### Finance routes (`apps/api-gateway/src/routes/v1/finance.ts`)

| Legacy route | Functionality | Unified route | Status | Notes |
| --- | --- | --- | --- | --- |
| `GET /api/v1/summary` | Generic finance summary | `GET /api/v1/partners/finance/summary` | COMPLETE | Covered by `/partners/finance/*` bridge. |
| `GET /api/v1/history` | Generic finance history | `GET /api/v1/partners/finance/history` | COMPLETE | Covered by bridge. |
| `POST /api/v1/refund` | Issue refund | `POST /api/v1/partners/finance/refund` | COMPLETE | Covered by bridge. |
| `GET /api/v1/promoter/balance/:promoterId` | Promoter payout balance | `GET /api/v1/partners/finance/promoter/balance` | COMPLETE | Bridge injects promoter identity. |
| `POST /api/v1/promoter/payout` | Create promoter payout | `POST /api/v1/partners/finance/promoter/payout` | COMPLETE | Covered by bridge. |
| `GET /api/v1/promoter/payouts/:promoterId` | Promoter payout history by id | `GET /api/v1/partners/finance/promoter/payouts` | COMPLETE | Bridge injects promoter identity. |
| `GET /api/v1/promoter/payouts` | Promoter payout list | `GET /api/v1/partners/finance/promoter/payouts` | COMPLETE | Covered by bridge. |
| `POST /api/v1/promoter/payouts` | Create payout request | `POST /api/v1/partners/finance/promoter/payouts` | COMPLETE | Covered by bridge. |
| `DELETE /api/v1/promoter/payouts` | Delete payout request | `DELETE /api/v1/partners/finance/promoter/payouts` | COMPLETE | Covered by bridge. |
| `GET /api/v1/promoter/finance/bank-accounts` | Promoter bank accounts | `GET /api/v1/partners/finance/promoter/bank-accounts` | COMPLETE | Covered by bridge. |
| `POST /api/v1/promoter/finance/bank-accounts` | Add promoter bank account | `POST /api/v1/partners/finance/promoter/bank-accounts` | COMPLETE | Covered by bridge. |
| `DELETE /api/v1/promoter/finance/bank-accounts` | Delete promoter bank account | `DELETE /api/v1/partners/finance/promoter/bank-accounts` | COMPLETE | Covered by bridge. |
| `GET /api/v1/partner/promoter/finance` | Promoter finance overview | `GET /api/v1/partners/finance/promoter/finance` | COMPLETE | Covered by bridge. |
| `GET /api/v1/venue/finance/overview` | Venue finance overview | `GET /api/v1/partners/finance/venue/overview` | COMPLETE | Covered by bridge. |
| `GET /api/v1/wallet` | Generic wallet summary | `GET /api/v1/partners/finance/wallet` | COMPLETE | Covered by bridge. |
| `GET /api/v1/payout-balance` | Generic payout balance | `GET /api/v1/partners/finance/payout-balance` | COMPLETE | Covered by bridge. |
| `GET /api/v1/venue/finance/payouts` | Venue payouts | `GET /api/v1/partners/finance/venue/payouts` | COMPLETE | Covered by bridge. |
| `GET /api/v1/payout-history` | Generic payout history | `GET /api/v1/partners/finance/payout-history` | COMPLETE | Covered by bridge. |
| `GET /api/v1/subscription` | Subscription details | `GET /api/v1/partners/finance/subscription` | COMPLETE | Covered by bridge. |
| `GET /api/v1/billing-methods` | Billing methods | `GET /api/v1/partners/finance/billing-methods` | COMPLETE | Covered by bridge. |
| `GET /api/v1/invoices` | Invoice list | `GET /api/v1/partners/finance/invoices` | COMPLETE | Covered by bridge. |
| `GET /api/v1/venue/finance/bank-accounts` | Venue bank accounts | `GET /api/v1/partners/finance/venue/bank-accounts` | COMPLETE | Covered by bridge. |
| `GET /api/v1/venue/finance/disputes` | Venue disputes | `GET /api/v1/partners/finance/venue/disputes` | COMPLETE | Covered by bridge. |
| `GET /api/v1/finance/payout-config` | Payout config | `GET /api/v1/partners/finance/payout-config` | COMPLETE | Covered by bridge. |
| `GET /api/v1/venue/finance/ledger` | Venue ledger | `GET /api/v1/partners/finance/venue/ledger` | COMPLETE | Covered by bridge. |
| `GET /api/v1/venue/finance/host-payouts` | Venue host payouts | `GET /api/v1/partners/finance/venue/host-payouts` | COMPLETE | Covered by bridge. |
| `GET /api/v1/venue/finance/promoter-payouts` | Venue promoter payouts | `GET /api/v1/partners/finance/venue/promoter-payouts` | COMPLETE | Covered by bridge. |

## Parity Status

- Scoped legacy routes inventoried: `116`
- Scoped legacy routes with a unified `/api/v1/partners/*` equivalent: `116 / 116`
- Status breakdown:
  - `COMPLETE`: `94`
  - `PARTIAL`: `22`
  - `MISSING`: `0`

Two useful completeness views:

1. Route-addressability parity: `100%`
2. Native contract parity: `81.0%`

The gap between those numbers is intentional. The partner namespace can now reach every scoped legacy behavior, but `22` legacy routes still land on native unified payloads instead of exact legacy response contracts.

## Missing Endpoints

No scoped legacy route remains unmapped under `/api/v1/partners/*`.

The following unified partner endpoints were added in this parity pass:

- `ALL /api/v1/partners/hosts/*`
- `GET /api/v1/partners/venues/directory`
- `GET /api/v1/partners/venues/directory/:id`
- `POST /api/v1/partners/venues/upload`
- `ALL /api/v1/partners/venues/*`
- `GET /api/v1/partners/promoters/stats/:id`
- `GET /api/v1/partners/promoters/network/connections`
- `POST /api/v1/partners/promoters/network/connect`
- `ALL /api/v1/partners/promoters/*`
- `ALL /api/v1/partners/finance/*`

## Implementation Plan

Implemented routes:

- Added a shared in-process bridge helper in `apps/api-gateway/src/routes/v1/partners/legacy-bridge.ts`.
- Added host wildcard partner parity in `apps/api-gateway/src/routes/v1/partners/hosts.ts`.
- Added venue directory, upload, and wildcard partner parity in `apps/api-gateway/src/routes/v1/partners/venues.ts`.
- Added promoter public-network parity plus wildcard partner parity in `apps/api-gateway/src/routes/v1/partners/promoters.ts`.
- Added finance wildcard partner parity in `apps/api-gateway/src/routes/v1/partners/finance.ts`.

Unified service work completed:

- `SchedulingService` now reads and writes only `availability_slots`.
- `FinanceService` reads only `partner_ledger` for unified ledger flows.
- `PromoterService.computeStats()` now reads promoter commissions from `partner_ledger`.

Exact remaining normalization targets for a later cutover phase:

- `GET /api/v1/partners/hosts/overview`
- `GET /api/v1/partners/hosts/events`
- `GET /api/v1/partners/hosts/team`
- `PATCH /api/v1/partners/hosts/team/:memberId`
- `DELETE /api/v1/partners/hosts/team/:memberId`
- `GET /api/v1/partners/venues/overview`
- `GET /api/v1/partners/venues/calendar`
- `GET /api/v1/partners/venues/events`
- `GET /api/v1/partners/venues/partnerships`
- `PATCH /api/v1/partners/venues/partnerships/:partnershipId`
- `GET /api/v1/partners/promoters/overview`
- `GET /api/v1/partners/promoters/analytics`
- `GET /api/v1/partners/promoters/events`
- `GET /api/v1/partners/promoters/connections`
- `POST /api/v1/partners/promoters/connections/request`
- `PATCH /api/v1/partners/promoters/connections/:connectionId`
- `GET /api/v1/partners/promoters/links`
- `POST /api/v1/partners/promoters/links`
- `PATCH /api/v1/partners/promoters/links/:id`
- `GET /api/v1/partners/promoters/links/:id/analytics`

Those are not missing anymore, but they are the routes that still need explicit contract alignment if the final cutover needs legacy-identical response bodies instead of bridge-backed reachability.

## Data Model Issues

Inside `apps/api-gateway/src/routes/v1/partners` and `apps/api-gateway/src/services/unified`:

- No live unified reads remain against `venue_calendar`.
- No live unified reads remain against `slot_requests`.
- No live unified reads remain against `ledger_entries`.
- No live unified reads remain against `partner_settlements`.
- No live unified reads remain against `promoter_commissions`.

Current unified sources:

- Scheduling: `availability_slots`
- Finance ledger: `partner_ledger`
- Promoter commission aggregation: `partner_ledger`

Legacy route files still reference older models in places. That is intentionally unchanged in this phase because the goal here was additive partner parity, not legacy deletion.

## Final Parity Score

- Route coverage under `/api/v1/partners/*`: `116 / 116` = `100%`
- Exact-contract confidence under canonical explicit unified handlers: `94 / 116` = `81.0%`
- Touched-file gateway typecheck: clean for `partners/*`, `legacy-bridge.ts`, `scheduling-service.ts`, `finance-service.ts`, and `promoter-service.ts`
