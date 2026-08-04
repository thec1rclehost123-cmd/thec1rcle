# THE C1RCLE Final Production Launch Implementation Plan

This file is the controlling production-launch execution artifact. It replaces
all earlier implementation plans for this baseline.

## 0. Control contract

| Field | Requirement |
|---|---|
| Authoritative checkout | `/Users/aayushdivase/Desktop/thec1rcle` |
| Authoritative branch | `pre-staging` only |
| Planning baseline | `e1bf2d346eb5f84adb9d3ce38547984b7caa10de` |
| Release path | `pre-staging` -> `staging` -> repeat full E2E -> `main`/production |
| Checkout authority | Fastify API Gateway only |
| Financial authority | `partner_ledger` is the only partner-money source of truth |
| Toolchain | Node 20 LTS across local, CI, Docker, and release checks |
| Evidence rule | No evidence = no PASS. A P0/P1 is automatic NO-GO. |
| Legacy Functions | Retain explicit 410 guards for 14 days after cutover; remove only after zero-traffic evidence. |
| Production proof | Staging Firebase, Redis, Razorpay test mode, deployed gateway, and physical Android evidence are mandatory. |

This is an execution plan, not a claim that the system is launch-ready. Work is complete only when its acceptance behavior and verification evidence both pass on the frozen commit.

## Execution ledger

| Workstream | Code state | Production evidence state |
|---|---|---|
| G0 release snapshot | Implementation is present in the working tree on baseline `e1bf2d3`; no release commit was created by this execution | BLOCKED until reviewed changes are selectively committed and a new frozen SHA is recorded |
| Atomic order/payment/ticket/entitlement/ledger finalization | Implemented; automated and emulator validation required | BLOCKED pending approved staging Firebase/Razorpay |
| Checkout attribution before provider-order creation | Implemented | BLOCKED pending staging E2E |
| Venue/host/promoter split snapshot | Implemented in integer paise; venue-owned events allocate net revenue to the venue, host-owned events to the host, and an explicit `financialSplitRules.venueShareBps` overrides the default | BLOCKED pending production-event split-rule audit/backfill |
| Callback/webhook single authority | Implemented | BLOCKED pending simultaneous provider trace |
| Refund ledger/revocation finalization | Implemented through one transactionally idempotent provider-confirmation path | BLOCKED pending Razorpay processed/failed/replayed webhook traces |
| Refund approval authority | Admin Console approve/reject now proxies the API Gateway; direct Admin Firestore mutation throws; approval quorum and order restoration are transactional | BLOCKED pending two-admin Razorpay staging trace |
| Per-ticket JWT scanner redemption | Implemented | BLOCKED pending physical-device/scanner trace |
| Paid door sales | Cash payment record, order, inventory, per-admission ticket/entitlement/scan, ledger rows/marker, aggregates, and outbox now commit atomically under a required idempotency key | BLOCKED pending door-device and reconciliation trace |
| Ledger-backed payout UI and finance cache invalidation | Implemented | BLOCKED pending staging ledger reconciliation |
| Finance money-unit contract | Implemented with explicit display-rupee and canonical integer-paise fields; payout/refund decisions consume paise only | BLOCKED pending API contract and one-paise staging reconciliation |
| Legacy finance/refund/payout engines | Reads moved to `partner_ledger`; direct refund, settlement, and payout mutations fail closed | Verification pending |
| Payout withdrawals/webhooks | Fail-closed in API, ignored without mutation in the legacy webhook path, and hidden in Partner UI until provider/ledger reservation is approved | BLOCKED; do not enable `C1RCLE_PAYOUT_MUTATIONS_ENABLED` |
| Post-event payout queue | Implemented from ledger allocations with transactionally protected retries; pending-review rows may reconcile before provider submission but progressed rows fail on conflict | BLOCKED pending provider adapter and reconciliation proof |
| Partner `/create` V2 routing | Implemented | Verification pending |
| Partner direct order cancellation | Unsafe controls removed and route fails closed; it cannot alter paid state without canonical refund orchestration | Deliberately unavailable for launch |
| Legacy paid-order/event cancellation | Direct paid-order cancellation and legacy order confirmation throw; the old event-cancellation worker is an observable fail-closed guard | Canonical event-wide refund orchestration remains a release blocker |
| Event propagation writes | Public read-model and promoter attribution synchronization are awaited and surface failures | BLOCKED pending Mobile/Guest staging parity proof |
| Mobile notification/follow/wallet recovery | Implemented | Physical Android proof pending |
| Demo/showcase signed-build guard | Implemented | EAS secret/environment proof pending |
| Legacy commerce `410 Gone` telemetry guards | Implemented | 14-day zero-traffic clock not started |
| Node 20 CI/Docker contract | Implemented in tracked configuration | Current local shell is not Node 20; G1 remains blocked |

No row in this ledger is a production PASS until its evidence gate is attached
to the frozen release SHA.

### Local verification record — 2026-07-24

| Check | Result |
|---|---|
| Core type-check | PASS |
| API Gateway type-check | PASS, including removal of `app.ts` `@ts-nocheck` |
| Guest Portal type-check | PASS |
| Core tests | PASS — 31 files, 193 tests |
| API Gateway tests | PASS — 29 files, 151 tests |
| Guest Portal tests | PASS — 97 tests |
| Partner Dashboard tests | PASS — 10 files, 35 tests |
| Mobile tests | PASS — 51 suites, 409 tests |
| Mobile release-configuration tests | PASS — 4 tests |
| Functions Node 20 bundle | PASS |
| Repository lint | PASS with existing warnings |
| Tracked CSS stylelint | PASS |
| Partner Dashboard type-check | FAIL — pre-existing generated Next `PageProps` drift, untyped tier-reducer calls, and duplicate `csstype` dependency identity in `KPIStrip.tsx` |
| Mobile type-check | FAIL — pre-existing duplicate React Native dependency identities, generated route drift, NativeWind declarations, and missing `expo-audio` |
| Production build | FAIL — corrupt/unloadable local Next SWC native binding; Partner Webpack fallback exhausts the Node 25 heap; Guest build correctly fails closed without production Firebase credentials |
| Full guardrail/format globs | BLOCKED — large unrelated untracked checkout trees make repository-wide globs non-terminating; `git diff --check` and exact tracked-CSS stylelint pass |
| Node runtime | FAIL — local Node 25.1.0/npm 11.6.2; required runtime is Node 20/npm 10 |
| Staging credentials | BLOCKED — required Firebase, Redis, Razorpay, webhook, cron, and approved-origin variables are absent |
| Physical Android | BLOCKED — ADB is installed but reports no authorized device |

This record is local code evidence only. It is not G1–G12 staging evidence and
does not change the launch verdict from **NO-GO**.

### Implemented production behavior

1. Checkout initiation persists immutable event, partner, buyer, ticket, money,
   source-channel, and split-rule snapshots before a Razorpay order is created.
2. Client callback and webhook verification delegate to
   `finalizeTicketPayment()`. That transaction confirms payment/order,
   consumes inventory, issues deterministic tickets and entitlements, posts
   ledger rows and aggregates, and creates the outbox record together.
3. A replay returns the existing complete result only when payment, order,
   tickets, entitlements, and ledger marker match. Conflicts fail closed.
4. Provider-confirmed refunds delegate to `finalizeProcessedRefund()`. The
   refund request, order status, ticket/entitlement revocation, proportional
   ledger reversal, aggregate update, and refund marker commit together.
5. Partner balances, finance time series, event revenue, and net-revenue KPIs
   use ledger entries. Ticket counts use canonical ticket state.
6. Withdrawal mutations and legacy payout webhook writes remain deliberately
   disabled. Enabling them before the provider adapter reserves and settles
   specific ledger rows is prohibited.
7. Partner order cancellation and cancellation/relist controls remain absent
   until they can atomically coordinate provider refund, inventory, ticket
   revocation, order status, and ledger reversal.
8. Admin refund approval cannot mark an order refunded directly. Approval
   quorum is recorded by the Gateway, and only provider-confirmed completion
   can finalize the order and ledger.

## 1. Non-negotiable release invariants

1. One confirmed payment produces exactly one confirmed order, one inventory sale, one ticket per purchased seat, one immutable ledger posting set, and one fulfillment event.
2. No order can be `confirmed` unless its `partner_ledger_idempotency/{orderId}` record and all required `partner_ledger` entries are committed in the same Firestore transaction.
3. Partner finance and payouts read only `partner_ledger`/its transactionally-maintained aggregates; they never derive money from raw orders.
4. Partner attribution (`hostId`, `venueId`, promoter/link attribution) is immutable on the order before payment verification can occur.
5. Door/guest operations see a confirmed sale in under 3 seconds. Overview KPIs refresh in 5 seconds. Heavy graphs refresh in 15 seconds or on explicit refetch.
6. Mobile and Guest Portal use authoritative gateway availability, pricing, reservation, and verification routes; demo data is disabled in every signed launch build.
7. Gateway is the only checkout authority. Legacy Functions return 410 during the approved cutover window and cannot mutate commerce state.

## 2. P0: atomic ticket, order, and financial posting

### L0-01 — Make ledger persistence part of payment finalization

| Field | Requirement |
|---|---|
| Priority | P0 — blocks all paid-ticket launch traffic |
| Owner files | `packages/core/workflows/ticketing.js`, `apps/api-gateway/src/services/unified/finance-service.ts`, `apps/api-gateway/src/routes/v1/checkout.ts`, `apps/api-gateway/src/routes/v1/payments.ts` |
| Current defect | `verifyCheckoutPayment()` confirms orders and creates tickets, while `FinanceService.recordTicketSale()` has no production caller. A paid order can therefore exist without canonical partner finance records. |

**Change**

1. Extract the ledger-entry calculation and Firestore transaction writer from `FinanceService.recordTicketSale()` into a core-owned module, for example `packages/core/partner-ledger-service.js`. The module must accept an already-open Firestore transaction; route code must not write the ledger.
2. In `packages/core/workflows/ticketing.js`, inside the existing Firestore transaction in `verifyCheckoutPayment()`, resolve the immutable order/event attribution and call the core ledger writer before `transaction.update(order, { status: 'confirmed' })` completes.
3. Use `partner_ledger_idempotency/{orderId}` as the transaction marker. On first confirmation, create exactly these entries in paise: platform ticket revenue, platform fee, host payout, venue share, and eligible promoter commission. Store `eventId`, `referenceId: orderId`, `fromPartnerId`, `toPartnerId`, currency, status, and timestamps on every entry.
4. If the idempotency marker already exists, validate that the existing entry count and participant IDs match the order. Return the existing result only when they match; otherwise return a `CONFLICT` and alert.
5. If ledger computation, attribution, or transaction write fails, do not mark the order confirmed, do not mark payment verified, do not issue tickets, and return a retry-safe error. Razorpay payment IDs remain reusable only for the same pending order.
6. Refactor `FinanceService.recordTicketSale()` into a compatibility wrapper around the shared core writer or remove it after all callers and tests use the shared implementation. It must never become a second ledger-write path.

**Success behavior**

For one successful payment, Firestore atomically contains a confirmed order, verified payment, ticket documents, one ledger idempotency marker, and the expected ledger rows. A retry, webhook replay, or client retry produces no additional ticket or ledger entry.

**Required tests**

- Add focused core tests in `packages/core/checkout-payment-verification.test.ts` for success, duplicate verify, ledger failure rollback, attribution mismatch, and promoter/no-promoter splits.
- Extend `apps/api-gateway/src/routes/v1/gp4-checkout-payments.test.ts` with `server.inject()` proof that the endpoint returns failure when the ledger transaction fails and success only after all writes commit.
- Verify all money in integer paise; assert `gross = platformFee + venueShare + hostPayout + promoterCommission`.

### L0-02 — Persist attribution before payment can confirm

| Field | Requirement |
|---|---|
| Priority | P0 |
| Owner files | `packages/core/src/domain/services/checkout-service.ts`, order repository used by that service, `apps/api-gateway/src/routes/v1/checkout.ts` |
| Current defect | `checkout.ts` currently attempts host/venue/link denormalization after initiation through an unawaited fire-and-forget promise. Dashboard order, analytics, and finance queries rely on those fields. |

**Change**

1. In `CheckoutService.initiateCheckout()`, read the authoritative event within the order-creation transaction and persist immutable `hostId`, `venueId`, `promoterLinkId`, `promoterId`, `sourceChannel`, ticket rows, `totalPaise`, and currency on the new order.
2. Delete the post-initiation fire-and-forget denormalization block in `apps/api-gateway/src/routes/v1/checkout.ts`.
3. Reject initiation if a paid event lacks required host/venue attribution. Allow only explicitly documented platform-owned exceptions.

**Success behavior**

Immediately after checkout initiation, the order has the same partner IDs used by finance, guest-list, order-history, and analytics queries. No dashboard state depends on a background mutation.

**Verification**

Create an order, immediately query host orders, venue orders, event attendees, and the order document; all return the same order ID and attribution before payment verification.

### L0-03 — One finalization authority and webhook parity

| Field | Requirement |
|---|---|
| Priority | P0 |
| Owner files | `apps/api-gateway/src/routes/v1/checkout.ts`, `apps/api-gateway/src/routes/v1/payments.ts`, `packages/core/workflows/ticketing.js`, `packages/core/ticket-checkout-wallet-service.js` |

**Change**

1. Choose one core finalization function for both client verification and Razorpay webhook verification. It must own signature checks, payment/order ownership validation, transaction, ticket issuance, ledger posting, reservation release, cache invalidation, and fulfillment event dispatch.
2. Make `/api/v1/checkout/verify`, `PATCH /api/v1/payments/verify`, and the webhook delegate to that function rather than maintaining divergent ticket/payment paths.
3. Preserve explicit route contracts during migration; document which client surface calls which route. Do not leave one route confirming an order without tickets/ledger entries.

**Success behavior**

Client callback first, webhook first, duplicate webhook, and retry all converge on one idempotent finalization result for the same order/payment.

## 3. P0: live state propagation, cache, and operational SLAs

### L0-04 — Invalidate and publish purchase state

| Owner files | `packages/core/workflows/ticketing.js`, `apps/api-gateway/src/plugins/realtime.ts`, `apps/api-gateway/src/routes/v1/partners/hosts.ts`, `apps/api-gateway/src/routes/v1/partners/venues.ts`, `apps/api-gateway/src/services/unified/finance-service.ts` |

**Change**

1. After the payment transaction commits, publish one idempotent `ticket.purchase.confirmed` domain event containing order, event, partner, ticket-count, and request IDs—never raw payment secrets.
2. Consume the event to invalidate host/venue/promoter finance balance keys, host/venue overview keys, host/venue time-series keys, event attendee/guest-list keys, and ticket availability keys.
3. Broadcast a scoped realtime update to authenticated dashboard/scanner subscribers. Realtime is an acceleration only; every consumer must refetch authoritative data after receiving it.
4. Reduce cache TTLs to the approved SLA: guest/door operational reads no more than 3 seconds; overview KPI reads no more than 5 seconds; heavy time series no more than 15 seconds. Cache keys must include partner identity and query range.

**Success behavior**

A sale is visible in the event guest list and scanner operations in <3 seconds, dashboard KPI cards in <5 seconds, and historical graphs in <15 seconds. On WebSocket failure, the same SLA is met by polling/refetch.

**Verification**

Capture timestamps for payment confirmation, cache invalidation, realtime broadcast, dashboard/door visibility, and graph refresh for ten test purchases. The p95 must meet the stated SLA.

### L0-05 — Preserve public discovery correctness

| Owner files | `apps/api-gateway/src/routes/v1/events.ts`, `packages/core/src/domain/services/public-discovery-service.ts`, `apps/guest-portal/lib/bff/events.js`, `apps/guest-portal/lib/bff/checkout.js`, `apps/mobile-app/store/eventsStore.ts` |

**Change**

1. Keep event creation/publish/edit/cancel cache invalidation and public read-model synchronization awaited before returning success.
2. Tag Guest Portal event/discovery BFF fetches and revalidate the corresponding tag after publish/update/cancel. Do not use a long ISR response for ticket availability or checkout pricing.
3. Ensure Mobile pull-to-refresh bypasses stale list cache and uses canonical public event status, tier availability, and price fields.

**Success behavior**

Published events appear on Mobile and Guest Portal without stale visibility state; checkout always re-quotes/reserves against live inventory even when a discovery card is cached.

## 4. P1: platform wiring corrections

### L1-01 — Repair Partner legacy event creation or retire it

| Owner files | `apps/partner-dashboard/app/api/events/route.js`, `apps/partner-dashboard/components/CreateEventForm.jsx`, `apps/partner-dashboard/app/api/events/create/route.ts` |

**Change**

Choose one path before launch:

- Preferred: migrate `CreateEventForm.jsx` to `/api/events/create`, then remove/hide the legacy form route.
- Compatibility option: implement authenticated `POST /api/events` as a thin proxy to the canonical creation route, with the same body schema and error contract.

**Success behavior**

No visible event creation CTA returns 405. Every UI creation surface reaches `POST /api/v1/partner/events/create` and records a lifecycle-valid event.

### L1-02 — Repair Mobile notification navigation and host follow

| Owner files | `apps/mobile-app/app/_layout.tsx`, `apps/mobile-app/components/ui/HostSheet.tsx`, `apps/mobile-app/lib/social/*`, corresponding gateway social/public-host route files |

**Change**

1. Replace `/(tabs)/notifications` with `/notifications` in the notification response handler.
2. Replace HostSheet’s nonexistent `GET /api/v1/hosts/:id` request with the canonical public-host lookup contract; use an ID route only if the gateway explicitly supports it.
3. Replace the local-only follow toggle with a persisted authenticated follow mutation and server-derived initial follow status. Surface errors instead of swallowing them.

**Success behavior**

Notification taps always open the notification screen. Host details and follow state survive app restart and match Guest Portal/gateway state.

### L1-03 — Remove production mock and dead finance controls

| Owner files | `apps/partner-dashboard/app/venue/payouts/PageClient.tsx`, `apps/partner-dashboard/components/promoter/finance/PromoterFinanceClient.tsx`, `apps/partner-dashboard/app/venue/finance/payouts/PageClient.tsx`, relevant `/api/venue/finance/*` and `/api/promoter/*` route handlers |

**Change**

1. Replace `MOCK_PAYOUTS` with an authenticated, loading/error/empty-state aware gateway query.
2. Wire withdrawal/payout CTA handlers only to an implemented, role-authorized backend operation. If payouts are not launch-supported, remove the CTA and show an explicit unavailable state; never leave a dead button.
3. Backend payout actions must create auditable, idempotent records and must never directly mutate balances outside `partner_ledger` settlement rules.

**Success behavior**

The Finance UI displays only canonical backend data. Every visible CTA either completes an authorized operation with an audit record or is intentionally absent.

### L1-04 — Checkout client convergence and wallet refresh

| Owner files | `apps/mobile-app/lib/api.ts`, `apps/mobile-app/lib/payments.ts`, mobile checkout screen/store, `apps/guest-portal/features/checkout/api/checkoutApi.js`, `apps/guest-portal/lib/bff/checkout.js`, `apps/guest-portal/lib/api/client.js` |

**Change**

1. Document and enforce one exact endpoint mapping: calculate -> `/checkout/calculate`; reserve -> `/checkout/reserve`; initiate -> `/checkout/initiate`; client payment verification -> the chosen canonical verification route.
2. Keep Guest Portal BFF input validation and automatic CSRF forwarding; do not add a second manual CSRF mechanism.
3. On successful finalization, invalidate/refetch mobile and guest ticket-wallet state before navigating to confirmation. Add recovery by order ID for interrupted callbacks.

**Success behavior**

The buyer sees the issued ticket/order without app restart; a network interruption after payment recovers the same order without double charging or duplicate tickets.

## 5. P1: safety, schema, and production configuration

### L1-05 — Demo, environment, and provider hardening

| Owner files | `apps/mobile-app/lib/demo/index.ts`, mobile `.env.*` and EAS configuration, `apps/api-gateway/src/config*`, `apps/guest-portal/next.config.mjs`, Partner environment configuration |

**Change**

1. Preserve the current explicit-only `DEMO_MODE === 'true'` behavior. Add release-build validation that fails if `EXPO_PUBLIC_DEMO_MODE` or public showcase mode is enabled.
2. Add a deployment-time configuration validator that proves all three frontends target the approved gateway and Firebase project; no implicit localhost, production, or stale nested-checkout fallback.
3. Require Razorpay test keys in staging and production keys only in the final production promotion job. Validate webhook secret presence and callback reachability without logging secrets.
4. Ensure physical Android uses a LAN-reachable staging gateway or verified `adb reverse`; `127.0.0.1` is not valid from the phone.

**Success behavior**

Signed staging/release builds display real gateway data, never demo data; every surface reaches the intended non-production environment during QA.

### L1-06 — Type, schema, and route contract enforcement

| Owner files | `apps/api-gateway/src/app.ts`, all modified gateway route files, `apps/api-gateway/src/routes/openapi.ts`, Guest generated API contract files/tests |

**Change**

1. Remove `// @ts-nocheck` from `app.ts` in a dedicated typed cleanup, replacing `any` only where Fastify decorations are properly declared.
2. Keep Zod validation on every mutation; add response schemas for checkout, finance, and realtime payloads.
3. Regenerate/verify Guest API operations from the gateway contract after route changes. Add contract tests for method/path/schema mismatches.

**Success behavior**

Type-check passes without entrypoint suppression; no frontend can call an endpoint/method that the gateway does not expose.

## 6. Legacy Functions migration

### L2-01 — Keep guards, measure traffic, then remove

| Owner files | `functions/src/index.ts`, gateway/middleware telemetry, deployment configuration |

**Phase 1: 14-day cutover**

- Retain legacy checkout HTTP endpoints as explicit, observable `410 Gone` responses.
- Attach sanitized route/version telemetry and an update-required response; do not invoke gateway checkout, Firestore, or payment code.
- Dashboard tracks every legacy hit by route and client app version.

**Phase 2: removal**

- Require fourteen consecutive days of zero traffic, confirmed mobile minimum-version adoption, and no external webhook dependency before undeploying.
- Remove functions, deployment references, tests, docs, and monitoring only in one reviewed change.

**Success behavior**

During cutover, legacy clients fail closed and observably. Afterwards, no obsolete deployed checkout mutation endpoint remains.

## 7. Required test inventory

### Automated mandatory suites

Run from the frozen `pre-staging` SHA:

```bash
npm run lint
npm run type-check
npm test -w packages/core
npm test -w apps/api-gateway
npm test -w apps/guest-portal
npm test -w apps/partner-dashboard
npm test -w apps/mobile-app -- --runInBand --watchman=false
npm run guardrails:check
npm run build
```

Add tests for every L0/L1 item before implementation is considered complete. Tests must cover happy path, retry/idempotency, unauthorized actor, invalid payload/signature, provider webhook replay, and injected dependency failure.

### Staging E2E transaction test

Use one isolated QA event and correlate request ID, user ID, partner IDs, event/tier/reservation/order IDs, Razorpay order/payment IDs, ticket IDs, and ledger IDs.

1. Partner creates and publishes event with at least two tiers and known split rules.
2. Verify identical public availability/pricing on Guest Portal and physical Android.
3. Purchase on Guest Portal; verify the resulting order, tickets, ledger entries, dashboard guest list, order history, finance view, operational door list, and graphs meet the SLA.
4. Purchase on physical Android; repeat the same reconciliation.
5. Replay client verification and webhook; prove no duplicate order, ticket, inventory decrement, ledger row, or fulfillment message.
6. Test expired reservation, changed price, invalid signature, cross-user order access, cross-partner attendee/finance access, and offline/relaunch recovery.
7. Scan each issued ticket independently; prove one ticket cannot check in the whole order and the scanner accepts the wallet QR contract.

## 8. Release gates and exit criteria

| Gate | Exit criteria |
|---|---|
| G0 Authority | `pre-staging` local/remote SHA frozen; no unapproved tracked changes; runtime paths proven. |
| G1 Environment | Firebase staging project, Redis, gateway, Razorpay test keys/webhook, CORS, and demo-off signed build proven. |
| G2 Build | Clean lockfile installation and approved Node contract. |
| G3 Automation | Mandatory commands and all new tests pass. |
| G4 Services | Gateway/Firestore/Redis/provider health and logs proven. |
| G5 Authorization | Buyer/partner/scanner roles work; cross-tenant and cross-user requests fail closed. |
| G6 Event lifecycle | Create, approve/publish, edit, cancel, and public read-model propagation pass. |
| G7 Parity | Guest and physical Android match canonical event/tier availability and pricing. |
| G8 Payment | Client and webhook finalization prove atomic order/tickets/ledger; no duplicates. |
| G9 Reconciliation | Ledger, balances, dashboard guest/order/finance, wallet, scanner, provider, and inventory reconcile in paise. |
| G10 Security | Tampering, expiry, replay, unauthorized, and route-bypass cases fail safely. |
| G11 Resilience | Restart, delayed webhook, timeout, offline/relaunch, cache/realtime fallback pass. |
| G12 Release record | Evidence, cleanup, known defects, 14-day legacy telemetry plan, and explicit GO/NO-GO signed. |

## 9. Absolute NO-GO conditions

- A confirmed paid order lacks its matching ledger marker/entries.
- Ledger, ticket, order, inventory, or provider reconciliation is not exact in paise.
- Any duplicate payment finalization issues a second ticket or ledger posting.
- Door/guest-list SLA exceeds 3 seconds, KPI SLA exceeds 5 seconds, or graph SLA exceeds 15 seconds without approved remediation.
- Demo data, production credentials, wrong Firebase project, localhost mobile gateway, missing Razorpay webhook proof, or physical-device evidence is present.
- Any active checkout path bypasses the gateway or any legacy function performs a commerce mutation.
- Any P0/P1 is open, blocked, or lacks reproducible verification evidence.
