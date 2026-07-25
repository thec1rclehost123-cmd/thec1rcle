# THE C1RCLE Full Ecosystem Audit Report

## Audit control record

| Control | Evidence |
|---|---|
| Authoritative checkout | `/Users/aayushdivase/Desktop/thec1rcle` |
| Branch | `pre-staging` |
| Audited commit | `01fa230d9b0b3fe4208b947ef895edfe0bd78795` |
| Recorded `origin/pre-staging` | `e1bf2d346eb5f84adb9d3ce38547984b7caa10de` |
| Runtime | Node `v20.20.2` from `/opt/homebrew/opt/node@20/bin` |
| Audit mode | Source read-only; only this report is written |
| Evidence rule | No evidence means no PASS |
| Release rule | Any open P0 or P1 means NO-GO |

The audited checkout is one local commit ahead of the recorded remote `pre-staging` ref. All findings and command results in this document apply to the audited commit above, not automatically to any later branch state.

## Severity and verdict rules

- **P0 — launch blocker:** exploitable authorization or financial-integrity failure, duplicate/oversold admission, invalid scanner acceptance, unrecoverable paid order, cross-tenant mutation, or a critical-path failure capable of stopping operations.
- **P1 — release blocker:** broken or partial production flow, material confidentiality/integrity weakness, stale operational state outside the required SLA, failed production typecheck, or missing mandatory recovery behavior.
- **PASS:** code path, negative behavior, and relevant empirical validation are all proven.
- **FAIL:** at least one in-scope P0/P1 exists or required environment/device evidence is absent.

## Topic 1 — Authentication, authorization, roles, and sessions

**Verdict: FAIL**

Topic 1 was completed before this continuous Topic 2–8 run. Its controlling findings are retained here so the final launch decision has one defect ledger.

### Topic 1 blocking findings

| ID | Severity | Finding |
|---|---:|---|
| T1-01 | P0 | The Partner Dashboard BFF performs fine-grained finance authorization, but the API Gateway bank-account mutations only require authentication plus partner-context resolution. Any active venue staff identity, including door-level staff, can bypass the dashboard and directly call `POST`/`DELETE /api/v1/partners/finance/bank-accounts`. |
| T1-02 | P1 | `FirebaseAuthService` attempts both Firebase ID-token and session-cookie verification regardless of the credential's source; bearer and cookie credentials are not type-bound. |
| T1-03 | P1 | Bearer verification uses `verifyIdToken(token)` without revocation checking while session cookies use `verifySessionCookie(token, true)`, producing inconsistent revoked-session behavior. |
| T1-04 | P1 | Partner permission resolution can fail open to default permissions, partner-context failures are swallowed, and authorization can rely on stale membership claims. |
| T1-05 | P1 | Guest logout clears browser cookies but does not revoke the underlying Firebase session/token. |
| T1-06 | P1 | Staff-role vocabulary is inconsistent (`DOOR` versus `door_staff`), so route/UI checks can disagree. |

### Topic 1 empirical record

- API Gateway focused typecheck: PASS.
- Guest Portal typecheck: PASS, with `MODULE_TYPELESS_PACKAGE_JSON` warnings.
- Partner Dashboard typecheck: FAIL with 7 errors.
- Mobile App typecheck: FAIL with 202 errors.
- Focused tests passed: API Gateway 20, Guest Portal 14, Partner Dashboard 3, Mobile App 51.

### Topic 1 required remediation

1. Enforce fine-grained permissions at every Gateway mutation; BFF checks are defense-in-depth only.
2. Bind bearer headers to ID-token verification and session cookies to session-cookie verification.
3. Apply an explicit revoked-credential policy consistently.
4. Resolve membership and permissions from authoritative server state; fail closed on missing or malformed context.
5. Revoke guest sessions on logout.
6. Normalize the staff-role enum across storage, claims, Gateway, BFF, and UI.
7. Add direct-Gateway negative tests for each role and cross-partner target.

---

## Topic 2 — Event creation, approval, and Redis cache invalidation

**Verdict: FAIL — 3 P0, 5 P1**

### Stage A — Individual surfaces

#### Partner Dashboard

Primary evidence:

- `apps/partner-dashboard/components/wizard/CreateEventWizardV2.tsx:420-529` performs a debounced client-side availability check.
- `apps/partner-dashboard/components/wizard/CreateEventWizardV2.tsx:532-575` creates a draft through `POST /api/events/create`.
- `apps/partner-dashboard/components/wizard/CreateEventWizardV2.tsx:1192-1304` submits hosts through the host route but sends venue-created events directly to the shared create/update routes.
- `apps/partner-dashboard/app/api/events/create/route.ts:14-22` uses `withAuth` only and proxies the client payload to `POST /api/v1/partner/events/create`; it does not enforce `MANAGE_EVENTS`.
- `apps/partner-dashboard/app/api/events/[id]/route.ts:19-42` validates authentication but does not enforce a partner permission before proxying update/delete operations.
- The host submit BFF correctly applies `requireHostAccess(req, 'MANAGE_EVENTS')`; the venue/shared create and edit seams do not have equivalent authorization.

Result: **FAIL.** The UI has useful availability feedback, but it is not an authority boundary. Low-privilege partner identities can bypass intended UI permissions and call the BFF or Gateway directly.

#### Guest Portal

Primary evidence:

- `apps/guest-portal/lib/bff/events.js:82-88` caches event detail for 15 seconds with `guest-events` and `guest-event:{id}` tags.
- `apps/guest-portal/lib/bff/explore.js:86-100` caches event discovery/featured results for 15 seconds.
- `apps/guest-portal/app/page.js:27-44` applies 60-second Next fetch revalidation to event feeds.
- `apps/guest-portal/app/explore/page.js:32-40` applies 60-second Next fetch revalidation to Explore feeds.
- `apps/guest-portal/app/event/[eventId]/page.jsx:13-32` has an additional 30-second event-detail cache.
- The only discovered `revalidateTag('guest-events', ...)` call is in `apps/guest-portal/lib/bff/checkout.js:297-299`; event publication, edit, cancellation, and approval do not invalidate Guest Portal tags.

Result: **FAIL.** Gateway Redis invalidation cannot invalidate the Guest Portal's Next Data Cache. Newly published, edited, or cancelled events can remain stale for 15–60 seconds.

#### Mobile App

Primary evidence:

- `apps/mobile-app/store/eventsStore.ts:398-427` suppresses same-city event-list fetches for two minutes.
- `apps/mobile-app/store/eventsStore.ts:432-440` bypasses the Gateway cache only when callers explicitly pass `force=true`.
- `apps/mobile-app/store/eventsStore.ts:566-580` returns cached event detail immediately and performs background refresh.
- `apps/mobile-app/app/(tabs)/explore.tsx:503-521` supports force refresh, but normal foreground/bootstrap reads are cache eligible.
- No event-store subscription consumes the Gateway's workspace-scoped `EVENT_UPDATED` broadcast for public discovery.

Result: **FAIL.** Pull-to-refresh can recover, but passive cross-surface convergence can take two minutes and exceeds the production SLA.

### Stage B — Cross-system connection review

#### T2-01 — Arbitrary authenticated venue publication

**Severity: P0**

`apps/api-gateway/src/routes/v1/events.ts:2923-2961` trusts `creatorRole`, `creatorId`, `hostId`, and `venueId` from the request. It skips `verifyPartnerAccess` when the claimed creator/host ID equals the caller UID. At `:2973-2983`, authoritative venue-context resolution occurs only when a venue creator did **not** supply `venueId`. At `:3081-3089`, any request claiming venue/club is forced to `scheduled` plus `visibility='public'`.

Exploit: any authenticated ordinary account can submit its own UID as `creatorId`, set `creatorRole='venue'`, supply a victim `venueId`, and publish a public event attributed to that venue. There is no authoritative venue membership/type check on this branch.

Required remediation:

1. Ignore client `creatorId`, `hostId`, `venueId`, `creatorRole`, lifecycle, visibility, and workspace authority fields.
2. Resolve actor partner, type, partner ID, and permissions from authoritative membership state.
3. Require `MANAGE_EVENTS`.
4. Derive creator/host/venue/workspace fields server-side.
5. Add negative tests for ordinary users, door staff, staff from another partner, mismatched role, and supplied victim venue IDs.

Success behavior: a caller can only create for the exact authorized partner context; cross-partner or role-spoofed attempts return 403 and create no event, slot, read model, cache event, or notification.

#### T2-02 — Shared event update is over-permissive

**Severity: P0**

`apps/api-gateway/src/routes/v1/events.ts:128-136` accepts either a wrapped or flat arbitrary `z.record(unknown)` patch. `:2526-2565` establishes only coarse partner access, not `MANAGE_EVENTS`. `:2577-2745` permits lifecycle and rich event mutations; `packages/core/src/domain/services/event-service.ts:58-74` merges those fields into the persisted event. A low-privilege member with coarse partner access can publish/cancel or change attribution-sensitive fields such as creator, host, venue, and ticket configuration.

Required remediation:

1. Replace the arbitrary patch schema with an allowlisted command schema.
2. Separate draft content edits, publish, cancel, venue approval, ticket-tier changes, and attribution changes into explicit commands.
3. Require the exact permission and lifecycle precondition per command.
4. Make ownership/attribution immutable after creation except through an audited administrative migration.

Success behavior: unknown/protected fields fail validation; low-privilege members receive 403; illegal lifecycle transitions return 409; permitted edits cannot reassign financial or tenant ownership.

#### T2-03 — Venue self-publication does not reserve availability

**Severity: P0**

`apps/api-gateway/src/routes/v1/events.ts:3036-3059` preflights `availability_slots`, but `:3143-3197` creates a slot record only for host-originated, non-draft events. Venue-originated scheduled/public events write only the event. Therefore the first venue event does not become an availability authority and a second overlapping venue event can pass both the preflight and transaction.

Required remediation:

1. Represent every blocked, pending, approved, and venue-self-booked interval in `availability_slots`.
2. In one transaction, query/recheck conflicts and create both the venue `booked` slot and event.
3. Use a deterministic slot ID tied to the event and idempotency key.
4. Add simultaneous venue-create tests against the same venue/date/range; exactly one must commit and the other must return 409.

Success behavior: no event can become scheduled/public without a corresponding authoritative booked/approved slot, and concurrent overlaps cannot both commit.

#### T2-04 — Approval publication is not atomic

**Severity: P1**

`apps/api-gateway/src/routes/v1/partners/venues.ts:3721-3817` correctly performs conflict recheck, slot transition, and lifecycle update in a Firestore transaction. However, `:3831-3838` updates event visibility to public in a separate write and swallows any failure with `.catch(() => {})`. The route can return success with an approved slot and scheduled event that remains private and absent from discovery.

Required remediation: write `visibility='public'`, lifecycle, approval metadata, and slot status inside the same transaction. Return an idempotent success only when the complete state matches. Do not swallow publication or read-model errors.

Success behavior: approval commits all authoritative publication fields together or commits none.

#### T2-05 — Public-cache invalidation is internally inconsistent

**Severity: P1**

- `packages/core/src/domain/services/public-discovery-service.ts:819-845` updates the event-card read model and bumps `events`/`search` cache versions only on the public upsert path. Non-public/deleted events return after read-model deletion at `:825-835`, before version bumps.
- Redis version-bump errors are logged and swallowed at `:839-844`.
- `apps/api-gateway/src/plugins/firebase.ts:131-137` sends `discovery/sync`, but `packages/core/inngest-client.js:53` and `packages/core/workflows/discovery-sync.js:10-20` register `discovery/sync-read-models`. The decorated invalidator therefore emits an unhandled event name.
- Gateway event mutations often also call synchronous read-model sync, which masks the broken asynchronous invalidator on some paths but not all.

Required remediation:

1. Use the exported `PUBLIC_DISCOVERY_SYNC` event constant everywhere.
2. Bump cache versions after both upsert and delete/non-public transitions.
3. Treat failed authoritative read-model synchronization/invalidation as a retryable mutation/outbox failure, not a swallowed success.
4. Add tests proving cancellation/removal invalidates list, featured, map, search, and detail caches.

Success behavior: every publish/edit/cancel/delete transition has one observable, retryable invalidation path and cannot serve a removed event from a prior cache version.

#### T2-06 — Guest Portal ISR/tag cache has no event-mutation invalidation

**Severity: P1**

The Guest Portal has its own tagged Next cache and 15–60 second revalidation windows, but there is no authenticated revalidation endpoint/event consumer connected to Gateway event mutations.

Required remediation: implement a signed internal revalidation command or event consumer that invalidates `guest-events` and `guest-event:{id}` after committed event mutations. Keep TTL as fallback, not the primary propagation mechanism.

Success behavior: Guest Portal event list/detail reflects committed publication/edit/cancellation within the agreed event propagation SLA.

#### T2-07 — Mobile event synchronization exceeds SLA

**Severity: P1**

The two-minute in-memory list cache and lack of a public event-update subscription permit Mobile to disagree with Guest Portal and Gateway after publication, price/tier changes, or cancellation.

Required remediation:

1. Consume a public event invalidation/version signal or refetch on foreground/focus.
2. Invalidate affected event detail/list/tier caches after the signal.
3. Preserve force-refresh as a manual recovery path.
4. Test background-to-foreground recovery and cancellation while an event detail is cached.

Success behavior: Mobile converges inside the approved SLA without requiring app relaunch or manual pull-to-refresh.

#### T2-08 — Authenticated partner event-list query leaks other partners' drafts

**Severity: P1**

`apps/api-gateway/src/routes/v1/events.ts:1655-1718` treats the presence of `lifecycle` or `creatorId` as a partner/draft query, requires only an authenticated UID, then queries the caller-supplied `creatorId`/`venueId`. It does not verify access to that partner before returning draft/submitted events.

Required remediation: derive partner scope from authoritative context, require event-read permission, reject requested partner IDs outside that scope, and add cross-tenant enumeration tests.

Success behavior: another authenticated tenant cannot enumerate draft, submitted, denied, or private event records.

### Stage C — Node 20 empirical validation

Commands ran with Node `v20.20.2`.

#### Typechecks

| Surface | Result | Evidence |
|---|---:|---|
| `packages/core` | PASS | `tsc --noEmit` |
| API Gateway | PASS | `tsc -p apps/api-gateway/tsconfig.json --noEmit` |
| Guest Portal | PASS | `tsc --noEmit` |
| Partner Dashboard | FAIL | 7 errors: two Next generated `PageProps` mismatches and five duplicated-`csstype`/Lucide component incompatibilities |
| Mobile App | FAIL | Existing large error set, including invalid typed routes, duplicate React Native type trees, unsupported `className` props, missing `expo-audio`, Firebase Storage declarations, and notification permission type mismatches |

The API Gateway package has no `type-check` script; the equivalent project `tsc --noEmit` command was run directly.

#### Focused tests

| Surface | Result |
|---|---:|
| Core calendar and guest event conversion | 2 files, 8 tests PASS |
| API Gateway event route and public discovery | 2 files, 35 tests PASS |
| Partner create and host-submit BFF routes | 2 files, 4 tests PASS |
| Guest discovery/event/homepage boundaries | 4 tests PASS, with module-type warnings |
| Mobile event store | 1 suite, 28 tests PASS |
| **Total** | **79/79 focused tests PASS** |

Coverage limitation: these suites validate happy-path contracts and client seams. They do not exercise arbitrary authenticated venue impersonation, low-permission edits, cross-tenant draft reads, simultaneous venue creates, partial approval failure, delete-path cache versioning, Next tag invalidation, or measured cross-surface propagation.

### Stage D — strict verdict and release gate

Topic 2 is **FAIL**. Event creation and approval are not production-safe. The P0 authorization and double-booking defects permit hostile or concurrent creation of invalid public events, while the P1 atomicity/cache defects make successful approvals and cross-surface state inconsistent. Topic 2 cannot pass until all T2 findings are remediated, the Partner/Mobile typechecks pass, adversarial and concurrency tests are added, and staging propagation evidence proves the required SLA.

---

## Topic 3 — Ticket purchasing, Redis inventory locks, and anti-overselling

**Verdict: FAIL — 5 P0, 8 P1**

### Stage A — Individual surfaces

#### Partner Dashboard

The Partner Dashboard is not a buyer in this flow, but its event tier/capacity configuration is an upstream input to `event.tickets`/`event.ticketCatalog.tiers`. Topic 2 established that the shared event patch accepts arbitrary fields and lacks `MANAGE_EVENTS`; therefore low-privilege mutations can alter the very inventory inputs consumed here. No independent dashboard proof establishes that capacity, `strictInventory`, sale windows, and per-order limits are protected commands.

Result: **FAIL by dependency.** Inventory enforcement cannot be production-safe while its capacity and strict-mode configuration can be changed through an over-permissive event mutation.

#### Guest Portal

Primary evidence:

- `apps/guest-portal/features/checkout/hooks/useCheckoutSession.js:329-429` synchronizes an authoritative quote and clears stale reservation state on an expired reservation response.
- `:618-795` serializes a checkout attempt, reuses a fresh quote, reserves with an idempotency key, initiates with another idempotency key, persists order recovery state, and delegates Razorpay verification.
- `apps/guest-portal/features/checkout/api/checkoutApi.js:20-60` can call the BFF quote seam and then performs a second legacy Gateway quote for parity telemetry.
- `:67-95` routes reserve/initiate through typed BFF or generated Gateway operations and treats non-2xx responses as failures.

Result: the client orchestration is substantially wired, but **FAIL** because it depends on unsafe backend inventory semantics. Client-side quantity constraints cannot prevent crafted duplicate rows or direct Gateway calls.

#### Mobile App

Primary evidence:

- `apps/mobile-app/app/checkout/index.tsx:35-60` caches a displayed pricing result for 30 seconds.
- `:280-337` requests backend pricing; `:467-520` delegates the authoritative operation to `processFullCheckout`.
- `apps/mobile-app/lib/payments.ts:185-279` reserves, persists the reservation, initiates the order, and uses phase-specific idempotency keys.
- `apps/mobile-app/app/checkout/index.tsx:257-267` and `:849-864` display the server-issued reservation expiry.
- `apps/mobile-app/lib/payments.ts:156-172` attempts backend cancellation before clearing local recovery state.

Result: the main path is real, not a mock. It is still **FAIL** because the backend cancel ownership field is mismatched, the inventory authority can oversell, and a 30-second displayed quote may be stale until the reserve step rejects it.

### Stage B — Cross-system connection review

#### T3-01 — Duplicate tier rows bypass quantity and inventory enforcement

**Severity: P0**

`apps/api-gateway/src/routes/v1/checkout.ts:46-49,83-90` validates each item but does not require unique `tierId` values or impose an aggregate quantity cap. `packages/core/inventory-engine.js:477-520` validates each row independently against the same availability and per-tier limit. `:371-373` subtracts reserved inventory using `reservation.items.find(...)`, so only the first duplicate row is counted.

Exploit: submit the same tier up to 20 times. Each row can independently pass `quantity <= available` and `quantity <= maxPerOrder`, while subsequent availability reads subtract only one row. The reservation and eventual order can represent far more admissions than available.

Required remediation:

1. Normalize and aggregate items by tier at the Gateway boundary.
2. Reject duplicate tier IDs rather than silently trusting the array.
3. Enforce event-wide and tier-wide aggregate maxima before reservation.
4. Sum all matching reservation items in every inventory calculation.
5. Persist only normalized unique order rows.

Success behavior: duplicate-tier payloads return 400; normalized total quantity cannot exceed event/tier limits; the reserved quantity subtracted from availability exactly equals the order quantity.

#### T3-02 — Reservation enforcement ignores Firestore ticket shards

**Severity: P0**

`calculateEffectiveInventory()` supports an optional Firestore database and reads `ticket_shards` at `packages/core/inventory-engine.js:311-344`. However `createReservation()` calls `validatePurchase(event, items, { strictMode })` without `db` at `:597-603`. `InventoryService.reserve()` at `packages/core/src/domain/services/inventory-service.ts:26-36` does not provide a database either.

For events whose sold state is authoritative in `ticket_shards` and not mirrored into the event tier, reservation checks see stale document-level inventory and can sell units already counted as sold.

Required remediation: inject Firestore into the inventory service, read the authoritative counter state under the reservation operation, and test a tier where event-level sold is zero but shard sold is near capacity.

Success behavior: reservation availability is calculated from exactly the same authoritative sold source used by finalization; shard-only sales can never be ignored.

#### T3-03 — Payment finalization can oversell after a hold expires

**Severity: P0**

The Redis reservation expires after its TTL, making its units available to another buyer. Yet `packages/core/workflows/ticketing.js:636-643` calls `commitInventory()` during payment finalization without verifying the reservation is still active or asserting capacity. `packages/core/inventory-engine.js:683-751` decrements standard remaining with `Math.max(0, remaining - quantity)` and increments sharded sold counts without a capacity precondition.

Failure sequence:

1. Buyer A initiates payment while its reservation is active.
2. The Redis hold expires before provider callback/webhook finalization.
3. Buyer B reserves or buys the released capacity.
4. Buyer A's late captured payment finalizes.
5. Both orders can be confirmed; remaining is clamped to zero rather than rejecting the second authoritative sale.

Required remediation:

1. Establish an explicit payment-grace ownership record before opening Razorpay.
2. In finalization, read and validate the reservation/payment hold and authoritative sold/capacity state in the same transaction.
3. Use a transactional capacity precondition; never clamp a negative result.
4. Define provider-captured/no-inventory recovery, including automatic refund or secured replacement inventory, without confirming an invalid ticket.
5. Test late callback, delayed webhook, hold expiry, and a competing buyer.

Success behavior: two finalizations can never make sold exceed capacity; a captured late payment enters an explicit recoverable/refund state rather than issuing an oversold entitlement.

#### T3-04 — Free/RSVP confirmation skips inventory commit

**Severity: P0**

`packages/core/order-engine.js:248-259` adjusts inventory only when an `inventoryEngine` argument is supplied. `CheckoutService.initiateCheckout()` calls `executeOrderCreation()` at `packages/core/src/domain/services/checkout-service.ts:485-490` without that dependency. Free/RSVP orders are immediately marked confirmed at `packages/core/order-engine.js:261-287`, and fulfillment is invoked at `checkout-service.ts:500-503`.

Result: a free finite tier can create confirmed orders without decrementing authoritative inventory. The Redis hold eventually expires/releases, enabling repeated issuance beyond capacity.

Required remediation: make inventory conversion mandatory for every finite admission, paid or free, in the same transaction that confirms the order. Only truly unlimited tiers may skip capacity deduction.

Success behavior: every confirmed free/RSVP admission consumes one authoritative unit; concurrent final claims result in exactly capacity successes and deterministic sold-out failures.

#### T3-05 — Redis mutex is not ownership-safe

**Severity: P0**

`packages/core/inventory-engine.js:544-555` acquires `inv:lock:{eventId}` with the constant value `locked` and a five-second TTL. `:640-646` releases it with unconditional `DEL`.

If a reservation operation exceeds five seconds, the lock expires and another process can acquire it. The first process then unconditionally deletes the second owner's lock. Multiple reservation critical sections can run concurrently.

Required remediation:

1. Use a cryptographically random lock token.
2. Release through an atomic compare-and-delete Lua script.
3. Renew ownership while the critical section is active or make the critical operation bounded below the lease.
4. Prefer an atomic Redis script that calculates/commits the reservation per tier without a process-level mutex.
5. Add a deterministic lease-expiry interleaving test.

Success behavior: one request can never release another request's lease, and concurrent reservations cannot both observe the same final unit.

#### T3-06 — Reservation ownership is not enforced during quote/initiation

**Severity: P1**

`POST /checkout/calculate` is public and accepts `reservationId`; `apps/api-gateway/src/routes/v1/checkout.ts:262-277` loads the Firestore reservation without checking `customerId` against the caller. More critically, `CheckoutService.initiateCheckout()` at `packages/core/src/domain/services/checkout-service.ts:285-315` validates status/expiry but never checks `reservation.customerId === userId`.

A caller possessing another reservation ID can inspect it and convert the held inventory into an order under their own identity.

Required remediation: require authentication for reservation-based quotes, enforce ownership and event binding on quote/initiate/cancel, and return 404 for foreign reservation IDs to avoid an oracle.

Success behavior: only the reservation owner can quote, convert, release, or recover the hold.

#### T3-07 — Legitimate reservation cancellation checks the wrong field

**Severity: P1**

`InventoryService.reserve()` persists `customerId` at `packages/core/src/domain/services/inventory-service.ts:39-51`. `POST /checkout/cancel` checks `resDoc.data().userId` at `apps/api-gateway/src/routes/v1/checkout.ts:994-1006`. Standard reservations therefore have no matching `userId`, and the legitimate owner receives 403. Mobile edit/promo flows then cannot release the hold and intentionally refuse to clear local state.

Required remediation: standardize one canonical owner field, migrate old reservations, and use the same ownership helper on every reservation route.

Success behavior: the owner can release a hold exactly once; other users cannot; Mobile and Guest can edit a cart without waiting for TTL.

#### T3-08 — Redis and Firestore reservation writes can diverge

**Severity: P1**

`createReservation()` commits the hold to Redis first. `InventoryService.reserve()` then writes `cart_reservations` to Firestore at `inventory-service.ts:39-52`. A Firestore failure returns an error after Redis has consumed inventory; there is no compensating Redis release or durable outbox.

Required remediation: implement a reservation state machine with compensation. On Firestore persistence failure, atomically delete the Redis reservation/index memberships; on uncertain failure, reconcile by reservation ID.

Success behavior: a failed API call leaves neither a phantom Redis hold nor an orphan Firestore reservation.

#### T3-09 — Redis cleanup reports success despite failure and tier indexes never expire

**Severity: P1**

- `releaseReservation()` catches `multi.exec()` failure at `packages/core/inventory-engine.js:671-675` and still returns `{ success: true }`.
- Tier membership sets written at `:618-627` receive no TTL; only reservation data and the per-user set expire.
- Missing reservation data is cleaned with an unawaited `srem` at `:364-369`.

Required remediation: fail the release response when deletion is not confirmed, add bounded expiry/reconciliation for tier indexes, and emit metrics for orphan entries.

Success behavior: the client only clears its hold when the backend confirms release; Redis indexes remain bounded and converge automatically.

#### T3-10 — Sharded sold-count semantics are inconsistent

**Severity: P1**

`calculateEffectiveInventory()` comments that shards override document sold, but `packages/core/inventory-engine.js:324-343` subtracts both document sold and shard sold. `commitInventory()` checks only whether any shard exists, chooses a random shard, and calls `transaction.update()` even if the chosen shard document does not exist at `:701-741`. This can understate availability or fail finalization depending on how counters are populated.

Required remediation: define one counter model, deterministic shard IDs, create-or-increment semantics, and a tested aggregation formula that never double-counts.

Success behavior: base plus shard values have one documented meaning; replay/rebuild yields the same sold and remaining quantities.

#### T3-11 — Abuse guard fails open

**Severity: P1**

The intended one-active-reservation-per-user check catches and only warns on any Redis failure at `packages/core/inventory-engine.js:559-594`, then continues. A partial Redis incident can therefore allow a user to accumulate multiple holds. The event-wide lock also has no bounded retry/backoff; benign contention is returned as a generic 409.

Required remediation: make the per-user cap part of the same atomic Redis script as reservation creation, fail closed when it cannot be evaluated, and return a typed retryable contention response.

Success behavior: one user cannot hold multiple selections for the same event, including during partial Redis failures.

#### T3-12 — Reservation TTL contract differs by public route

**Severity: P1**

The standard reserve path uses the ten-minute default at `packages/core/inventory-engine.js:82-83,528-533`. `POST /checkout/intent` explicitly requests five minutes at `apps/api-gateway/src/routes/v1/checkout.ts:503-523` and `CheckoutService.createCheckoutIntent()` defaults to five at `checkout-service.ts:105-114`.

Required remediation: select and document one launch TTL or a deliberate route-specific contract, return it in API metadata, and ensure all clients/recovery jobs use the same policy.

Success behavior: the displayed timer, Redis expiry, Firestore expiry, provider payment window, and late-payment policy agree for each supported flow.

#### T3-13 — Quote availability fails open when Redis is unavailable

**Severity: P1**

`buildCheckoutQuote()` calls `calculateEffectiveInventory()` without strict mode at `apps/api-gateway/src/routes/v1/checkout.ts:145-175`. The non-strict engine returns Firestore-only counts on Redis/circuit failure at `packages/core/inventory-engine.js:346-400`. Reservation creation later fails closed, so this should not directly oversell, but both buyer surfaces can display purchasable inventory and a pay CTA during an inventory outage, then fail at reserve.

Required remediation: use the same fail-closed inventory availability policy for authoritative checkout quotes, return a typed 503, and let clients render inventory temporarily unavailable.

Success behavior: a quote never claims a quantity is purchasable when the reservation authority cannot verify it.

### Stage C — Node 20 empirical validation

Commands ran with Node `v20.20.2`.

#### Typechecks

| Surface | Result |
|---|---:|
| `packages/core` | PASS |
| API Gateway (`tsc -p`) | PASS |
| Guest Portal | PASS |
| Partner Dashboard | FAIL with the same 7 errors recorded in Topic 2 |
| Mobile App | FAIL with the same large typed-route/dependency/type-tree error set recorded in Topic 2 |

#### Focused tests

| Surface | Result |
|---|---:|
| Core inventory unit/integration and checkout service | 3 files, 23 tests PASS |
| API Gateway checkout/payment route | 1 file, 22 tests PASS |
| Guest checkout/orchestration boundaries | 4 tests PASS, with module-type warnings |
| Mobile cart/money/payment | 3 suites, 10 tests PASS |
| **Total** | **59/59 focused tests PASS** |

The Mobile payment suite passed while logging repeated wallet-refresh failures because its API mock does not provide `apiFetch`; the production function catches and swallows that failure. This weakens the suite's value as proof that post-checkout wallet refresh works.

Coverage limitation: no focused test covers duplicate tier rows, aggregate order limits, shard-only sold state during reservation, free-order inventory conversion, late payment after hold expiry, capacity assertion in finalization, lock lease expiry/ownership, foreign reservation initiation, the cancel owner-field mismatch, or Redis/Firestore compensation.

### Stage D — strict verdict and release gate

Topic 3 is **FAIL**. The current inventory system can confirm more admissions than capacity through multiple independent paths. Passing happy-path tests do not satisfy the anti-overselling invariant. Topic 3 remains a hard NO-GO until every finite admission is converted transactionally, duplicate/aggregate payloads are normalized and rejected, the sharded authority is consistent, lock ownership is safe, late-payment handling is defined, and concurrency tests prove `sold <= capacity` under reservation expiry, Redis failure, and simultaneous buyers.

---

## Topic 4 — Razorpay, atomic ledger, refunds, and payouts

### Stage A — Surface and feature trace

#### Partner Dashboard and Admin Console

Primary evidence:

- `apps/partner-dashboard/app/venue/finance/payouts/PageClient.tsx:51-75` loads only the overview endpoint. It never loads the payout-history route and never calls `setPayouts`.
- `:155-187` exposes a `Withdraw Now` link to `#`, hardcodes `Weekly (Mon)` and `HDFC •••• 8821`, and renders the permanently empty payout array.
- `:306-410` repeats the hardcoded bank identity and changes the payout schedule only in local React state.
- `:416-472` exposes nonfunctional export and receipt-download buttons.
- `apps/admin-console/app/payments/page.jsx:243-255` exposes a real `FINANCIAL_REFUND` control and promises that money will be returned to the customer.
- `apps/admin-console/app/api/actions/route.js:278-280` sends that action to `adminStore.financialRefund()`.
- `apps/admin-console/lib/server/adminStore.js:651-680` directly marks the Firestore order `refunded`; it does not call Razorpay, create a refund document, reverse `partner_ledger`, or revoke tickets/entitlements.

Result: **FAIL**. The venue payout experience presents fixture data and dead financial controls, while the Admin Console exposes a materially false refund operation that changes internal status without moving money.

#### Guest Portal

Primary evidence:

- `apps/guest-portal/features/checkout/api/checkoutApi.js:97-109` sends verification through the Guest BFF `/checkout/verify`, or the generated payment operation when the BFF flag is off.
- `apps/guest-portal/features/checkout/hooks/useRazorpayCheckout.js:60-83` forwards the Razorpay order, payment, and signature response to verification using an idempotency key.
- `apps/guest-portal/features/checkout/hooks/useCheckoutSession.js:750-795` persists the internal order before opening Razorpay and attempts order recovery if verification throws.

Result: the buyer-side callback is genuinely wired and has local recovery state, but **FAIL** because an authorized-but-not-captured provider payment can be fulfilled and server-side finalization recovery is not durable.

#### Mobile App

Primary evidence:

- `apps/mobile-app/lib/api.ts:382-395` calls `POST /api/v1/checkout/verify`.
- `apps/mobile-app/lib/payments.ts:307-360` persists the pending order, opens the native Razorpay SDK with integer paise, and submits the provider response with a payment-derived idempotency key.
- `:362-390` queries the order after a verification error and clears recovery/cart state only after confirmed success.

Result: the native callback is wired and the app attempts recovery, but **FAIL** for the same backend settlement and recovery defects. No physical Razorpay device run was available, so the client path is code-proven only.

### Stage B — Cross-system connection review

#### Verified positive architecture

The primary checkout routes do converge on one finalizer:

- `packages/core/workflows/ticketing.js:494-723` validates callback/webhook context, payment ownership, provider order/amount/currency, deterministic ticket and entitlement documents, payment reuse, and ledger idempotency.
- `:541-723` commits inventory, ledger rows and marker, tickets, entitlements, verified payment state, confirmed order state, and an outbox record in one Firestore transaction.
- `packages/core/ticket-checkout-wallet-service.js:441-459` makes the webhook wrapper delegate to the same `finalizeTicketPayment()` workflow.
- `packages/core/partner-ledger-service.js:204-245` writes immutable sale entries, partner aggregates, and `partner_ledger_idempotency/{orderId}` within the caller's transaction.
- `packages/core/partner-ledger-service.js:38-148` rejects non-integer money and rejects any split that does not reconcile exactly to gross paise.

These are meaningful controls, but they are not sufficient to pass Topic 4 because the following independent launch blockers remain.

#### T4-01 — Merely authorized payments are treated as successful and fulfilled

**Severity: P0**

`packages/core/workflows/ticketing.js:337-353` explicitly accepts both `authorized` and `captured`. The finalizer then confirms the order, issues tickets/entitlements, posts revenue, and marks the payment verified. There is no synchronous provider capture call in this workflow.

An authorization is not settled money. It can expire or fail capture after C1RCLE has issued valid admission and recorded partner revenue.

Required remediation:

1. Require provider status `captured` before authoritative finalization.
2. If manual capture is the selected Razorpay mode, call capture server-side for the exact `totalPaise` and currency, then re-fetch and require `captured`.
3. Persist `authorized_pending_capture` separately without inventory conversion, tickets, entitlements, or ledger revenue.
4. Add tests for authorized, captured, capture-failed, capture-timeout, and authorized-then-webhook-captured.

Success behavior: no order, admission, or ledger sale becomes authoritative until Razorpay proves the exact payment is captured.

#### T4-02 — Captured-payment recovery has no durable retry executor

**Severity: P0**

`packages/core/workflows/ticketing.js:724-773` labels a failed finalization as `payment_received_finalization_pending` and returns `FINALIZATION_RETRY_REQUIRED`. Repository-wide search found no scheduled worker, queue consumer, or reconciliation job that selects this state and retries `finalizeTicketPayment()`.

If both the client callback and webhook attempt encounter a transient Firestore failure, the customer can be charged indefinitely without tickets. A future callback may recover it, but no system component guarantees that future callback.

Required remediation:

1. Create a deterministic recovery outbox record as soon as a captured payment is known.
2. Add a Node 20 worker that leases pending records, re-fetches provider state, and calls the same finalizer.
3. Use bounded exponential backoff, idempotent leases, terminal/manual-review states, age/SLA alarms, and an operations replay endpoint.
4. Reconcile provider-captured payments against internal orders on a schedule.
5. Prove recovery after Firestore timeout, process crash, delayed webhook, duplicate delivery, and a lost client callback.

Success behavior: every captured provider payment reaches exactly one confirmed fulfillment or a visible operator-owned terminal resolution without requesting a second charge.

#### T4-03 — Admin “Manual Refund” bypasses Razorpay, ledger, and entitlement revocation

**Severity: P0**

The visible control at `apps/admin-console/app/payments/page.jsx:243-255` reaches the action switch at `apps/admin-console/app/api/actions/route.js:278-280`, then `apps/admin-console/lib/server/adminStore.js:651-680` only updates the order status.

This can tell staff and customers that a refund occurred when no money was returned. It also leaves partner balances and valid admission artifacts intact.

Required remediation:

1. Remove `FINANCIAL_REFUND` from the generic direct-Firestore action dispatcher immediately.
2. Route the Admin Console through the authenticated Gateway refund request/approval API.
3. Require provider refund identity and processed status before final internal settlement.
4. Invoke the canonical transactional refund finalizer to update refund/order state, post ledger reversals, and revoke applicable tickets/entitlements.
5. Add an end-to-end test beginning at the Admin button and reconcile Razorpay, refund document, order, tickets, entitlements, ledger rows, marker, and partner aggregates.

Success behavior: the Admin Console cannot display success until the provider-confirmed refund and every canonical internal reversal have committed.

#### T4-04 — Refunds decrement a different balance bucket from the original sale

**Severity: P0**

Sale allocation rows are created with `status: pending` in `packages/core/partner-ledger-service.js:61-76`. Aggregate writes increment `balances.${entry.status}` at `:164-182`. Refund rows are always created with `status: settled` at `:324-347`, so a refund decrements `balances.settled` even when the original sale still remains in `balances.pending`.

This creates impossible balances, can understate settled money while leaving pending payout eligibility untouched, and breaks exact financial reconciliation.

Required remediation:

1. Define ledger account semantics independently from provider workflow status.
2. Reverse the exact original entry/account bucket, or settle/move the original allocation before applying its reversal.
3. Store `originalEntryId` and original balance bucket on every reversal and enforce that the cumulative reversal cannot exceed that entry.
4. Rebuild partner aggregates by replaying canonical ledger rows after deploying the corrected model.
5. Test refunds against pending, settled, partially settled, partially refunded, and already paid-out allocations.

Success behavior: sale plus refund net to the exact remaining liability in the same accounting buckets, and no balance differs by one paise.

#### T4-05 — Idempotent replay trusts the marker without reading the ledger rows

**Severity: P1**

`packages/core/workflows/ticketing.js:608-627` reads the ledger marker, tickets, and entitlements, but not the marker's referenced `partner_ledger` documents. `packages/core/partner-ledger-service.js:228-236` returns `alreadyPosted` when marker fields match.

A deleted, partially migrated, or corrupt ledger row can therefore coexist with a “complete” confirmed replay. The required invariant says the complete entry set must exist.

Required remediation: read every deterministic entry referenced by the marker in the transaction, verify identity/amount/participant/schema against the expected posting, and fail closed on any missing or mismatched row.

Success behavior: replay succeeds only when the order, payment, marker, every ledger row, every ticket, and every entitlement form one complete matching set.

#### T4-06 — Recovery status writes are best-effort and misclassify non-retryable failures

**Severity: P1**

`packages/core/workflows/ticketing.js:724-750` uses `Promise.allSettled()` and discards both results. It writes the pending-finalization state before checking the non-retryable code set at `:752-764`. An attribution conflict, amount mismatch, or ledger conflict can therefore be labelled like a transient retry, while a failed status write leaves no recovery marker at all.

Required remediation: classify the error first, persist recoverable state through a durable write/queue with checked results, persist non-retryable exceptions as manual-review incidents, and alert when recovery-state persistence itself fails.

Success behavior: retryable and terminal failures have distinct durable states, and no captured-payment failure disappears silently.

#### T4-07 — Webhook HMAC comparison is not constant-time and has two implementations

**Severity: P1**

`packages/core/ticket-checkout-wallet-service.js:230-238` compares the computed Razorpay HMAC with `expected !== signature`. The second webhook route contains a separate timing-safe implementation. Maintaining two verifiers creates security drift, and the checkout webhook currently uses the weaker helper.

Required remediation: expose one shared verifier that validates encoding/length and uses `timingSafeEqual`; make every Razorpay webhook route delegate to it; retain one canonical webhook URL unless an externally verified compatibility dependency requires both.

Success behavior: all webhook signatures are checked by one constant-time, byte-exact implementation and route parity tests prove identical rejection behavior.

#### T4-08 — Venue payout history and controls are fixture/dead UI

**Severity: P1**

`apps/partner-dashboard/app/venue/finance/payouts/PageClient.tsx:42-75` initializes `payouts` but never populates it. `:155-187,306-410,416-472` exposes a `#` withdrawal link, hardcoded bank/schedule state, local-only schedule buttons, and buttons with no handlers. Fetch errors are swallowed and rendered as defaults.

Required remediation:

1. Load `/api/venue/finance/payouts` and canonical bank/settings endpoints with authenticated, role-bound requests.
2. Populate payout rows and bank/schedule values solely from the response.
3. Add explicit loading, empty, permission, provider-unavailable, and retry states.
4. Implement authorized withdrawal, schedule, export, receipt, and add-account operations; otherwise remove those controls for launch.
5. Add a fixture-string/dead-control test and UI tests for each response state.

Success behavior: every displayed rupee, account label, schedule, payout, and visible action is canonical and operational.

#### T4-09 — Partial refunds are not mapped to specific admissions

**Severity: P1**

The refund ledger supports arbitrary partial paise allocation, but ticket/entitlement revocation is order-level or explicitly requested rather than tied to refunded ticket units. A staff member can refund the price of one ticket in a multi-ticket order while every ticket remains usable.

Required remediation: require a refund allocation by ticket/entitlement ID for admission refunds, validate its amount against immutable order rows, and revoke those exact artifacts atomically with the ledger reversal. Keep explicitly documented goodwill/price-adjustment refunds as a separate non-admission category.

Success behavior: a ticket refund revokes exactly the corresponding admission; a financial adjustment never silently changes admission rights.

### Stage C — Node 20 empirical validation

Commands ran with Node `v20.20.2`.

#### Typechecks

| Surface | Result |
|---|---:|
| `packages/core` | PASS |
| API Gateway (`tsc -p`) | PASS |
| Partner Dashboard | FAIL with 7 existing Next page-prop and duplicate `csstype`/Lucide errors |

#### Focused tests

| Surface | Result |
|---|---:|
| Core checkout verification, ledger, ticketing workflow, and payment service | 4 files, 10 tests PASS |
| API Gateway checkout/payment and refund ledger | 2 files, 23 tests PASS |
| **Total** | **33/33 focused tests PASS** |

Coverage limitation: no focused test requires provider status `captured`, runs a durable finalization retry worker, starts from the Admin Console refund control, reconciles refund aggregate buckets, verifies replayed ledger documents, checks constant-time webhook parity, or exercises the venue payout controls.

### Stage D — strict verdict and release gate

Topic 4 is **FAIL** with **4 P0** and **5 P1** defects. The primary finalizer has a strong atomic transaction and exact-paise split validation, but it still fulfills authorized funds, has no guaranteed captured-payment retry, exposes a refund bypass that does not move money, and corrupts balance buckets on reversals. Any one of those is a financial launch blocker. Topic 4 remains a hard NO-GO until provider capture, recovery, refunds, ledger aggregates, and payout interfaces reconcile end to end under real Razorpay Test Mode evidence.

---

## Topic 5 — Door Scanner and dynamic ticket QR security

### Stage A — Surface and feature trace

#### Mobile App

Primary evidence:

- `apps/mobile-app/app/ticket/[id].tsx:104-138` raises screen brightness when the QR is shown and restores the prior level on hide/unmount. This part is wired.
- `apps/mobile-app/store/ticketsStore.ts:214-217` returns a cached order without refreshing its QR.
- `apps/mobile-app/app/ticket/[id].tsx:184-194,531-540` renders that cached `activeQr.qrCode` unchanged. There is no timer, expiry check, or per-window refetch.
- `packages/core/ticket-checkout-wallet-service.js:8,241-265` generates 60-second wallet JWTs, so a QR can already be expired when the cached ticket screen is opened and always expires if it remains open.

Result: brightness support is real, but the core rotating-QR behavior is **FAIL**. The screen displays a static snapshot and labels it “Ready to scan” without validating expiry.

#### Guest Portal

Primary evidence:

- `apps/guest-portal/app/ticket/[id]/PageClient.jsx:28-41` fetches the ticket once.
- `:68-80,153-160` renders/downloads the initial `qrPayload`, falling back to the raw deterministic entitlement ID.
- The Gateway explicitly rejects bare `ENT-` IDs at `apps/api-gateway/src/routes/v1/scan.ts:343-366`.

Result: **FAIL**. An owner QR generated by `generateEntitlementQR()` becomes stale after the server grace window, and the fallback QR is guaranteed to be rejected. A downloaded short-lived QR also expires.

#### Partner Dashboard and ticket email generation

Primary evidence:

- `apps/partner-dashboard/lib/server/qrStore.js` still generates legacy order-based HMAC QR payloads.
- `apps/partner-dashboard/lib/email/index.js:176-178` can place those payloads into ticket emails.
- The active scanner retains a separate legacy order-based verifier and does not reconcile those payloads to canonical ticket/entitlement state.

Result: **FAIL**. Partner-generated tickets can use a different QR authority from Mobile wallet JWTs and entitlement HMACs.

#### Scanner App

Primary evidence:

- `apps/scanner-app/app/(event)/scan.tsx:94-123` sends every scan immediately to the Gateway.
- `apps/scanner-app/lib/api/scan.ts:35-45` sends only `qrData` and `eventId`; it omits the event code, gate, device ID, and any offline sequence identity.
- No SQLite dependency, queue schema, reconciliation worker, network-state handling, or queued-result UI exists in `apps/scanner-app`.
- `apps/scanner-app/app/(event)/scan.tsx:109-160` commits the server scan before asking whether both members of a couple are present.

Result: **FAIL**. Online scanning is wired, but offline queuing does not exist, bound-device enforcement is bypassed by omission, and couple confirmation is ordered incorrectly.

### Stage B — Cross-system connection review

#### Verified positive architecture

- `packages/core/ticket-checkout-wallet-service.js:37-90` verifies HS256, `kid`, issuer, audience, type, required identity claims, `nbf`, and `exp` with a constant-time signature comparison.
- `:93-203` reads the canonical ticket and its single entitlement and updates ticket, entitlement, and deterministic scan record in one Firestore transaction.
- `apps/api-gateway/src/routes/v1/scan.ts:453-465` broadcasts `TICKET_CHECKED_IN` after a successful JWT scan.
- `packages/core/entitlement-engine.js:193-345` transactionally enforces event binding and scan-count consumption for the entitlement-HMAC format.

Those controls are valid only when the canonical branches are reached by an authorized scanner. The same route exposes several independent bypasses.

#### T5-01 — Public staff-session route mints a full scanner credential

**Severity: P0**

`POST /api/v1/scan/staff/session` at `apps/api-gateway/src/routes/v1/scan.ts:2494-2585` has schema validation but no authentication or authorization pre-handler. It trusts client-supplied `eventId`, `venueId`, `userId`, and `role`, creates a 12-hour `codeType: full` session, and returns `canScan: true` and `canDoorEntry: true`.

Required remediation:

1. Require Firebase authentication.
2. Resolve the staff identity from the verified token; accept no client-supplied user/role authority.
3. Load one active verified `venue_staff` membership and enforce event-to-venue binding.
4. Mint a least-privilege, device-bound, event-bound session with revocation and short renewal.
5. Add unauthenticated, wrong-venue, removed-staff, forged-role, and replay tests.

Success behavior: only an active staff member assigned to the event's venue can mint a scanner session, and every session is bound to one event, role, and registered device.

#### T5-02 — Any Firebase user is scanner-authorized for any event

**Severity: P0**

`validateScannerAccess()` at `apps/api-gateway/src/routes/v1/scan.ts:218-249` returns authorized for any valid Firebase ID token. `matchesScannerContext()` at `:258-269` returns `true` for every Firebase-authenticated request without verifying staff membership, role, venue, event, or device.

Required remediation: separate ordinary user authentication from scanner authorization. Resolve an active staff assignment/session and require event, venue, permission, and device claims on every scanner mutation.

Success behavior: an attendee's valid Firebase token receives 403 from every scanner/guest-list/door mutation.

#### T5-03 — Literal `jwt_verified` bypasses legacy QR signature validation

**Severity: P0**

The order-QR branch at `apps/api-gateway/src/routes/v1/scan.ts:616-650` treats `payload.sig === 'jwt_verified'` as a valid signature. No preceding code writes that sentinel into the parsed JSON path; a caller can submit it directly with a guessed order ID and arbitrary ticket identity.

Required remediation:

1. Delete the sentinel bypass.
2. Do not translate verified JWTs into JSON sentinel payloads; process JWTs only in the canonical branch.
3. Retire the legacy order-based mutation path after migration telemetry.
4. Add a regression test proving every sentinel/unsigned/altered JSON payload is rejected without writes.

Success behavior: no client-controlled field can bypass cryptographic verification.

#### T5-04 — Legacy order QR grants entry without canonical ticket or entitlement state

**Severity: P0**

After legacy HMAC verification, `apps/api-gateway/src/routes/v1/scan.ts:717-785` loads only the order and scan record. It creates a valid scan even when the order is pending, cancelled, or refunded; the order status check merely decides whether to update the order. It never reads ticket/entitlement revocation, transfer ownership, `scanCountAllowed`, or `scanCountUsed`.

Required remediation:

1. Make the signed ticket JWT plus canonical ticket/entitlement transaction the only launch scan authority.
2. During an explicitly bounded legacy migration, map a valid legacy payload to exact ticket/entitlement documents and apply the same state machine.
3. Reject non-confirmed orders, revoked/refunded/transferred tickets, wrong owners/events, and ambiguous tier-level QRs.
4. Remove legacy QR generation from Partner email and Guest order engines.

Success behavior: every granted entry atomically consumes one exact entitlement; no order-level payload can bypass revocation or consume a group implicitly.

#### T5-05 — Buyer QR rotation is internally contradictory and operationally broken

**Severity: P0**

There are three incompatible lifetimes:

- finalization JWTs last until event end plus 12 hours in `packages/core/workflows/ticketing.js:83-101,107-175`;
- wallet JWTs last 60 seconds in `packages/core/ticket-checkout-wallet-service.js:8,241-265`;
- entitlement HMACs rotate every 30 seconds with a 65-second freshness window in `packages/core/entitlement-engine.js:136-186`.

The directive requires a 15-second rotating QR. Mobile and Guest render one fetched value without rotation. This produces both long-lived screenshot replay exposure and legitimate expired QRs at the door.

Required remediation:

1. Select one canonical QR contract and a single 15-second window/grace policy.
2. Return a short-lived signed token through an owner-authenticated no-store endpoint.
3. Refresh before expiry while the QR is visible; pause when backgrounded and refresh immediately on resume.
4. Display a countdown/offline state and never render a raw ID fallback.
5. Revoke cached/downloaded long-lived QR artifacts and migrate email tickets to an authenticated wallet/deep link.

Success behavior: Mobile and Guest always display a currently valid token, screenshots expire within the approved window, and scanner verification uses the same key registry and claims.

#### T5-06 — Couple confirmation consumes admission before staff confirmation

**Severity: P0**

The Gateway transaction increments `scanCountUsed` before responding. Only after that successful mutation does `apps/scanner-app/app/(event)/scan.tsx:109-160` open the couple-presence modal. Choosing “partner not present” merely changes the UI; the first scan has already been granted. Choosing “present” does not perform a second authoritative mutation.

Required remediation:

1. Decide whether couple admissions are sequential scans or one explicit two-person grant.
2. For two-person grant, add a preview endpoint that performs no mutation, then submit a confirmation token to one atomic consume operation.
3. For sequential entry, remove the modal and show authoritative `scanCountUsed/scanCountAllowed`.
4. Add cancel, timeout, simultaneous scanner, first/second partner, and replay tests.

Success behavior: UI approval exactly matches the committed admission count; dismissing/rejecting a prompt consumes nothing.

#### T5-07 — Scanner device binding is optional and the app never sends a device ID

**Severity: P1**

The Gateway validates a bound device only when `deviceId` is supplied. `apps/scanner-app/lib/api/scan.ts:39-45` omits it, so the active app never executes device validation.

Required remediation: provision a SecureStore device identity during authorized setup, bind it server-side to venue/staff, require it in the scanner session and every mutation, and reject omission.

Success behavior: a copied staff token cannot scan from an unregistered device.

#### T5-08 — Offline SQLite queue is absent

**Severity: P1**

`apps/scanner-app/package.json:14-40` contains no SQLite or network-state dependency, and repository search found no offline queue/reconciliation code. A transient network failure stops door operations and returns only “Unable to connect to server.”

Required remediation:

1. Define the offline security model before implementation; offline acceptance cannot guarantee cross-device single use.
2. Cache a signed, bounded event manifest and revocation snapshot.
3. Store attempts in encrypted SQLite with device ID, monotonic sequence, token hash, local decision, timestamps, and sync state.
4. Sync idempotently on reconnect and surface conflicts rather than rewriting history.
5. If risk policy forbids offline grants, implement an explicit offline-deny mode and operational connectivity fallback instead of implying queue support.

Success behavior: network loss produces a documented, tested door mode with no silent data loss and deterministic reconciliation.

#### T5-09 — Entitlement state machine does not require `ACTIVE`

**Severity: P1**

Finalization creates entitlements in `ISSUED` at `packages/core/workflows/ticketing.js:223-246`. Both scanner engines reject terminal states but allow `ISSUED`; the promised `ACTIVE → CONSUMED` transition is not enforced. Transfer creates another `ISSUED` entitlement, increasing ambiguity over claim/activation.

Required remediation: define and enforce exactly when ownership makes an entitlement `ACTIVE`; scan only `ACTIVE`; migrate existing issued-but-owned tickets; test every state transition.

Success behavior: only an active, currently owned entitlement can be consumed.

#### T5-10 — Scanner response mapping collapses door-critical denial reasons

**Severity: P1**

Gateway denials commonly return HTTP 400 with `result`. `apps/scanner-app/lib/api/scan.ts:81-93` catches all 400/403/404 responses and hardcodes `result: invalid`, discarding `wrong_event`, `already_scanned`, `revoked`, and `not_confirmed`. The operator loses the precise safe action and previous-scan warning styling.

Required remediation: map the canonical error envelope in both resolved and thrown cases, preserve previous scan identity/time, and add UI tests for every denial code.

Success behavior: staff receive an unambiguous red/amber decision matching the authoritative backend result.

#### T5-11 — Event enumeration endpoint is unauthenticated

**Severity: P1**

`GET /api/v1/scan/events` at `apps/api-gateway/src/routes/v1/scan.ts:2461-2491` accepts any `venueId` and returns non-draft event operational data without authentication or venue membership checks.

Required remediation: require verified staff authentication and bind the requested venue to that staff assignment; return only fields needed for event selection.

Success behavior: unauthorized callers cannot enumerate venue operations or select foreign events.

#### T5-12 — No active-route test or physical-device proof exists

**Severity: P1**

Core primitive tests cover signature and entitlement functions, but no test mounts `apps/api-gateway/src/routes/v1/scan.ts`. The Scanner App has no tests. No physical Android scan, brightness restore, camera, QR rotation, concurrent replay, or offline trace was available.

Required remediation: add Fastify injection tests for every auth/QR/state branch, Scanner App component/API tests, emulator concurrency tests, and mandatory physical-device evidence against staging.

Success behavior: the exact production route rejects all bypass payloads and physical devices prove valid, invalid, replayed, wrong-event, revoked, transferred, expired, couple, and network-loss behavior.

### Stage C — Node 20 empirical validation

Commands ran with Node `v20.20.2`.

#### Typechecks

| Surface | Result |
|---|---:|
| `packages/core` | PASS |
| API Gateway (`tsc -p`) | PASS |
| Scanner App | FAIL |
| Guest Portal | PASS from the current frozen-SHA run |
| Mobile App | FAIL with the previously recorded typed-route/dependency/type-tree errors |
| Partner Dashboard | FAIL with the previously recorded 7 errors |

Scanner-specific failures:

- The installed root TypeScript is `5.3.3`, while `apps/scanner-app/package.json:47` declares `~5.9.2`; Expo's base config is not accepted by the installed compiler.
- `apps/scanner-app/app/(event)/_layout.tsx:84-109` has eight implicit-any destructuring errors.

#### Focused tests

| Surface | Result |
|---|---:|
| Core scan, entitlement, entitlement-token, and ticket JWT workflow | 4 files, 13 tests PASS |
| API Gateway ticket/public-entitlement routes | 1 file, 9 tests PASS |
| Active Gateway scan route | **No test file exists** |
| Scanner App | **No test files exist** |
| **Executed total** | **22/22 focused tests PASS** |

Passing primitive tests do not exercise the public session mint, Firebase authorization bypass, `jwt_verified` sentinel, legacy state bypass, or Scanner App behavior.

### Stage D — strict verdict and release gate

Topic 5 is **FAIL** with **6 P0** and **6 P1** defects. An unauthenticated caller can mint a full scanner session; an ordinary Firebase user is treated as scanner staff; a literal client value bypasses QR signature validation; and legacy scanning ignores canonical admission state. Simultaneously, legitimate buyer QRs do not rotate correctly and couple confirmation can disagree with committed entry state. Topic 5 is an absolute NO-GO until one ticket/entitlement authority, one QR contract, strict staff/device/event RBAC, route-level adversarial tests, and physical Android evidence are complete.

---

## Topic 6 — Partner Finance, Ledger Aggregates, Payouts, and Revenue Analytics

### Stage A — Surface inventory

#### Partner Dashboard

Primary evidence:

- `apps/partner-dashboard/app/venue/finance/PageClient.tsx:99-126` and `apps/partner-dashboard/app/host/finance/PageClient.tsx:114-141` expose an “Initiate Payout” modal whose submit handler only waits one second and displays success.
- `apps/partner-dashboard/app/venue/finance/venue-payouts/PageClient.tsx:167-190` exposes a Withdraw control, but the `showWithdrawModal` state is never rendered and no mutation is invoked.
- `apps/partner-dashboard/components/analytics/VenueCrossEventClient.tsx:240-303` configures all finance/analytics queries with `staleTime: Infinity`, no focus/reconnect refetch, and no interval.
- `apps/partner-dashboard/app/venue/StreamingDashboard.tsx:98,462-463` and `apps/partner-dashboard/app/host/PageClient.tsx:101,521-522` refresh the one-day series every 60 seconds, not the required 5/15-second windows.
- `apps/partner-dashboard/lib/server/splitFinanceStore.ts:28-49,55-99,230-267` returns hardcoded wallet/subscription/balance data when Firebase is unavailable or requests fail.

Result: **FAIL**. Read surfaces are partially wired, but visible payout controls are false or inert, fixture finance can appear under configuration failure, and dashboard refresh behavior cannot meet the launch contract.

#### Guest Portal

Guest has no partner payout control. Its relevant responsibility is that purchases generate the exact attributed order and ledger rows consumed by Partner finance. That atomic sale posting was validated structurally in Topics 1 and 4, but Topic 6 cannot pass because the downstream settlement and dashboard paths stop before payout completion.

#### Mobile App

Mobile likewise has no partner payout surface. Its paid checkout reaches the shared finalization path, but there is no evidence that the resulting pending partner allocation reaches a provider-confirmed payout or a sub-5-second Partner KPI.

### Stage B — Gateway, Firestore, Redis, and synchronization review

#### Verified positive architecture

- The live aggregate collection is consistently named `partner_finance_aggregates`; the directive's `partner_ledger_aggregates` name is not present. `packages/core/partner-ledger-service.js:164-198` updates the partner aggregate and daily bucket in the same sale transaction.
- `apps/api-gateway/src/services/unified/finance-service.ts:21,564-622` reads balance and time-series projections from those ledger aggregates.
- `packages/core/workflows/ticketing.js:1165-1259` calculates settlement inputs from `partner_ledger` and uses deterministic `payout_queue/{eventId}__{partnerId}` documents with entry-set conflict checking.
- `apps/api-gateway/src/routes/v1/partners/venues.ts:1667-1733` builds venue revenue from ledger rows and ticket counts from ticket documents.
- Focused finance tests confirm integer-paise split reconciliation and legacy payout mutations fail closed.

These are valid foundations, but they do not constitute an operational payout lifecycle.

#### T6-01 — No executable payout lifecycle reaches provider-confirmed settlement

**Severity: P0**

`processEventSettlement` listens for `Events.EVENT_ENDED`, but repository-wide search found no producer of that event. Even if invoked manually, it only creates `payout_queue` rows with `status: pending_review`. No queue consumer exists. The active Razorpay webhook explicitly ignores `payout.processed`, `payout.failed`, and `payout.reversed` in `apps/api-gateway/src/routes/v1/payments.ts:515-532`. `packages/core/payout-engine.js:13-18,102-104,126-128` disables settlement and payout mutations. Therefore allocation rows remain pending and no immutable provider result moves them to settled/reversed.

Required remediation:

1. Emit an idempotent event-ended command from an authoritative event lifecycle scheduler, with event/state/version validation.
2. Create one core payout request state machine: `pending_review → approved → submitted → processing → settled|failed|reversed`.
3. Consume deterministic queue rows with a transaction/lease and provider idempotency key derived from queue ID.
4. Persist provider request/response identity without secrets and reconcile webhook results transactionally to queue, payout, and exact ledger entry IDs.
5. Update aggregate status buckets in the same transaction as ledger state changes.
6. Add retry, dead-letter, operator review, reconciliation, and alerting.

Success behavior: every eligible allocation has one traceable queue record, one provider payout at most, and a terminal ledger state exactly matching the provider.

#### T6-02 — Visible payout controls report success without a financial mutation

**Severity: P0**

Both primary Host and Venue finance pages display “Payout initiated successfully” after a timer without calling any API. The dedicated Venue Payouts page opens state for a withdrawal modal that is never rendered. A financial UI may therefore assure an operator that money moved when nothing was written or submitted.

Required remediation:

1. Until T6-01 is launch-complete, remove every transfer/withdraw control and display an explicit unavailable state.
2. When enabled, call one authenticated, role-authorized Gateway mutation accepting integer paise and a client idempotency key.
3. Validate amount against settled available balance inside a Firestore transaction and create the payout request/hold atomically.
4. Display success only from the canonical response and refetch balance/history.
5. Add double-click, replay, insufficient balance, forbidden role, provider timeout, and recovery tests.

Success behavior: no UI can claim payout success without a durable canonical request, and repeated submission cannot reserve or pay twice.

#### T6-03 — Finance/KPI/graph synchronization cannot meet the launch SLA

**Severity: P0**

`/partners/finance/overview` caches for 120 seconds at `apps/api-gateway/src/routes/v1/partners/finance.ts:231-242`. `publishTicketPurchaseSync()` invalidates only Redis `finance:balance:*` plus event caches, not `partners:finance:overview`, host/venue/promoter analytics namespaces, or browser query caches. Venue/Host dashboards poll at 60 seconds, while cross-event analytics never refetch automatically. A broadcast is emitted but these finance clients do not consume it to invalidate authoritative queries.

Required remediation:

1. After the finalization transaction, invalidate partner overview, balance, event attendee, and host/venue/promoter analytics cache keys for every attributed partner.
2. Subscribe Partner clients to `ticket.purchase.confirmed` and invalidate exact query keys.
3. Retain fallback polling at guest list ≤3 seconds, KPI ≤5 seconds, and aggregate graph ≤15 seconds.
4. Remove conflicting 120-second client/proxy freshness for launch-critical metrics.
5. Instrument commit and visibility timestamps and enforce p95 SLAs in staging.

Success behavior: a confirmed purchase appears in operational lists within 3 seconds, KPI cards within 5 seconds, and graphs within 15 seconds even when realtime delivery is dropped.

#### T6-04 — Host revenue time series violates the canonical ledger invariant

**Severity: P0**

`apps/api-gateway/src/routes/v1/partners/hosts.ts:1190-1251` queries confirmed/paid orders and sums `order.amount || order.total`. This bypasses `partner_ledger`, can mix rupee and paise fields, ignores ledger refunds/status, and differs from the venue implementation.

Required remediation: replace the order-derived series with a shared ledger/ticket projection used by all partner types. Revenue must use the partner's exact allocation rows in integer paise; tickets sold must count canonical ticket/entitlement state. Add host/venue/promoter parity, refunds, commissions, and unit-conversion tests.

Success behavior: every financial series reconciles exactly to ledger entries for the same partner, event, period, and status.

#### T6-05 — Aggregate rebuild can overwrite concurrent truth and retain stale daily buckets

**Severity: P1**

`apps/api-gateway/src/services/unified/finance-service.ts:651-747` reads the full ledger and later rewrites the aggregate in multiple independent batches without a version fence or lock. A concurrent ledger transaction can update the aggregate between read and rewrite and then be lost. The rebuild overwrites only dates present in the replay and does not delete obsolete daily documents.

Required remediation: run rebuild into a versioned shadow aggregate, capture a ledger high-water mark, replay the tail, validate totals, then atomically switch the active version. Delete obsolete versioned buckets after cutover.

Success behavior: concurrent sales/refunds cannot disappear during rebuild and no historical daily bucket survives unless backed by ledger rows.

#### T6-06 — Payout history maps canonical paise rows incorrectly

**Severity: P1**

`FinanceService.docToPayout()` at `apps/api-gateway/src/services/unified/finance-service.ts:547-558` reads only `d.amount`, while newer payout/queue contracts use `amountPaise`. Canonical paise-only records can render as zero.

Required remediation: make `amountPaise` required in the canonical payout schema, convert once at the API display boundary, migrate legacy `amount`, and add contract tests for both migration and final schema.

Success behavior: displayed payout amount equals the stored/provider amount to the paise.

#### T6-07 — Venue payout history and pagination use incompatible collections/contracts

**Severity: P1**

The split store calls `/finance/payout-history`, which reads `payout_requests` with a `venueId`; unified finance reads `payouts` by `partnerId`; the Venue route reads `payouts` by `recipientId`. Other UI clients send page numbers while Gateway paths expect cursors or ignore pagination. This can produce empty, duplicated, or zero-valued histories for the same partner.

Required remediation: select one payout collection and canonical schema, expose one cursor contract, migrate both IDs/amount fields, and make all Host/Venue/Promoter BFFs generated clients of that route.

Success behavior: every partner surface returns the same ordered payout set with stable, non-repeating cursors.

#### T6-08 — Dormant second payout architecture is non-idempotent and returns placeholders

**Severity: P1**

`apps/partner-dashboard/lib/server/payments/payoutJobs.ts` and `razorpayXPayouts.ts` form a dashboard-local payout architecture. Queue insertion does not use the canonical deterministic queue identity, and provider submission returns `payout_pending_*` placeholders. It has no active caller, yet feature documentation labels parts complete.

Required remediation: delete this path or reduce it to a typed Gateway client after the canonical core workflow exists. No Next.js server module may write finance collections or call the payout provider independently.

Success behavior: repository search finds one payout writer, one provider adapter, and one idempotency convention.

#### T6-09 — Finance configuration failures can display fixture money

**Severity: P1**

`apps/partner-dashboard/lib/server/splitFinanceStore.ts` returns large hardcoded wallets, balances, subscription, and billing methods when Firebase is unconfigured or a request throws. This violates the signed-build no-demo invariant and can mask a production outage.

Required remediation: delete financial fixtures from production code paths; return a typed unavailable error, render a blocking error/retry state, and make release configuration fail before build/deploy.

Success behavior: missing configuration never renders invented money, accounts, subscriptions, or payout availability.

#### T6-10 — Finance read failures collapse to authoritative-looking empty data

**Severity: P1**

Several finance helpers catch Firestore/index errors and return empty payout/settlement arrays or zero totals. Operators cannot distinguish “nothing owed” from “finance unavailable.”

Required remediation: fail closed with a typed `FINANCE_DATA_UNAVAILABLE`, emit structured alerts, preserve the last explicitly stale snapshot only with a timestamp/banner, and test missing-index/provider/database failures.

Success behavior: a failed financial read is visibly unavailable and can never be interpreted as a zero balance or completed obligation.

#### T6-11 — Generic ticket totals are host-only

**Severity: P1**

`FinanceService.getFinanceSummary()` queries tickets by `hostId` regardless of partner context. Venue and promoter summaries can therefore report zero sold tickets while their ledger contains allocations.

Required remediation: use the partner-type identity field or a shared commerce projection and define promoter “tickets sold” as attributed tickets only.

Success behavior: Host, Venue, and Promoter summary counts match their documented attribution semantics and canonical tickets.

### Stage C — Node 20 empirical validation

Commands ran with Node `v20.20.2`.

#### Typechecks

| Surface | Result |
|---|---:|
| `packages/core` | PASS |
| API Gateway (`tsc -p`) | PASS |
| Guest Portal | PASS from the current frozen-SHA run |
| Mobile App | FAIL with the previously recorded typed-route/dependency/type-tree errors |
| Partner Dashboard | FAIL with the previously recorded 7 errors |

#### Focused tests

| Surface | Result |
|---|---:|
| Core payout, partner-ledger, finance, and ledger engines | 4 files, 13 tests PASS |
| API Gateway unified finance service | 1 file, 2 tests PASS |
| Payout queue consumer/provider/webhook reconciliation | **No implementation or test exists** |
| Partner payout UI and realtime SLA | **No focused tests exist** |
| **Executed total** | **15/15 focused tests PASS** |

The first attempted Vitest invocation used unsupported Jest flag `--runInBand`; it was corrected and both suites passed. Passing unit tests do not exercise event-ended emission, provider payout execution, webhook settlement, fake UI success, cache invalidation, concurrent aggregate rebuild, or SLA behavior.

### Stage D — strict verdict and release gate

Topic 6 is **FAIL** with **4 P0** and **7 P1** defects. Atomic sale-ledger posting is a valid foundation, but the ecosystem has no executable provider payout lifecycle, visible financial controls can claim success without a mutation, Host revenue bypasses the ledger, and KPI/graph synchronization misses the contract by orders of magnitude. Topic 6 is an absolute NO-GO until payout execution and webhook reconciliation are canonical and idempotent, false financial UI is removed, every revenue series is ledger-backed, financial outages fail visibly, and measured staging data proves the 3/5/15-second SLAs.

---

## Topic 7 — Realtime Chat, WebSockets, and Automatic Unlock

### Stage A — Surface inventory

#### Mobile App

Primary evidence:

- `apps/mobile-app/app/chat/[id].tsx:350-421` and `app/social/group/[eventId].tsx:286-380` use `lib/social/groupChat.ts`.
- `apps/mobile-app/app/social/dm/[id].tsx:213-285` uses `lib/social/privateDM.ts`.
- Those helpers call the legacy `/api/v1/social/chat*` and `/api/v1/social/dm*` routes, not the canonical `/api/v1/chats*` routes backed by `guest-chat-service`.
- `apps/mobile-app/lib/websocket.ts:103-145` opens `/ws/updates`, then sends an in-band `AUTH` frame and waits for `AUTH_SUCCESS`.
- `apps/mobile-app/store/chatStore.ts:250-269` suppresses the 120-second fallback whenever the TCP WebSocket is open, without checking authenticated/subscribed state.

Result: **FAIL**. The UI is real, but its route authority and realtime transport are not the secured canonical implementation.

#### Guest Portal

Repository search found no Guest Portal attendee chat, inbox, message history, or ticket-unlock implementation. The only chat claim is marketing copy in `features/app-download/components/AppMarketingExperience.jsx`.

Result: **N/A for a Guest chat product surface**, but no Guest parity should be claimed.

#### Partner Dashboard

Partner Dashboard has attendee/CRM presentation and moderation-adjacent controls, but no canonical event-chat inbox. Event mute/remove mutations live in the Gateway. This does not repair the Mobile route bypasses or provide an operator moderation queue.

Result: **PARTIAL**. Partner event ownership checks exist for mute/remove, but chat operations are not managed through one authority.

### Stage B — Gateway, Firestore, Redis, and WebSocket review

#### Verified positive architecture

- `packages/core/guest-chat-service.js:486-523` verifies canonical chat membership and accepted direct-conversation status before send.
- `:550-588` implements bounded message history with an explicit pagination envelope.
- `:629-731` creates the canonical message and chat preview in one batch.
- `packages/core/workflows/ticketing.js:602-720` creates a deterministic ticket-purchase outbox in the finalization transaction.
- `:939-952` retries event-chat membership creation in the ticket-fulfillment workflow.
- `apps/api-gateway/src/routes/v1/chats.ts` is authenticated, Zod-validated, and delegates to core.

The active Mobile paths bypass much of this design.

#### T7-01 — WebSocket topics have no authorization boundary

**Severity: P0**

`apps/api-gateway/src/plugins/realtime.ts:53-88` permits anonymous WebSocket connections, treats an invalid query token as anonymous, and accepts arbitrary `SUBSCRIBE` topic strings without resolving membership. Any network client can subscribe to guessed `event:*`, `partner:*`, `event-chat:*`, or `dm:*` topics and receive matching broadcasts.

Required remediation:

1. Require authentication before accepting any private subscription.
2. Define a strict topic schema and authorize each topic against current event membership, direct-chat participation, or partner membership.
3. Bind subscriptions to token expiry/revocation and reauthorize on reconnect.
4. Close invalid-auth connections with a stable code; never downgrade to anonymous.
5. Add cross-user, cross-chat, cross-event, cross-partner, expired-token, and forged-topic tests.

Success behavior: a client receives only topics it is authorized for, and invalid authentication cannot establish a private subscription.

#### T7-02 — Mobile and Gateway implement incompatible WebSocket authentication

**Severity: P0**

The Gateway reads `?token=` only during the HTTP upgrade and has no `AUTH` frame handler or `AUTH_SUCCESS` response. Mobile deliberately omits the query token, sends `{type:"AUTH"}` after open, and refuses to subscribe until `AUTH_SUCCESS`. Therefore the actual client remains unauthenticated and sends no subscriptions.

Worse, Mobile's `isConnected` means only `readyState === OPEN`. Group and DM fallbacks stop polling while the unauthenticated socket is open, causing silent stale chats.

Required remediation: choose one handshake contract, preferably a short-lived WebSocket session token conveyed through a supported authenticated upgrade/subprotocol. Track distinct `connecting`, `authenticated`, and `subscribed` states. Poll until the required subscription is acknowledged, and force a catch-up fetch after every reconnect/foreground.

Success behavior: Mobile proves authentication and topic acknowledgement before suppressing fallback, and reconnects without a message gap.

#### T7-03 — Legacy event chat permits non-attendee read/write and role spoofing

**Severity: P0**

`POST /api/v1/social/chat` at `apps/api-gateway/src/routes/v1/social.ts:327-373` requires only a Firebase user. It does not verify a ticket, entitlement, chat membership, removal, mute, event state, or block. It spreads client-controlled metadata. Mobile's announcement helper submits `senderBadge` and `isAnnouncement`, so any authenticated attendee—or any non-attendee—can create content rendered as a Host/Venue announcement.

`GET /api/v1/social/chat/:eventId` at `:1516-1557` claims “only attendees” but performs no entitlement/membership check.

Required remediation: remove these legacy mutations/reads after migrating Mobile to `/api/v1/chats`. If compatibility is temporarily required, make them thin delegates to `guest-chat-service`, derive badges/announcement authority server-side, and enforce membership, moderation, lifecycle, and block state.

Success behavior: non-members cannot read or write; only verified event operators can create announcements; muted/removed/blocked identities fail closed.

#### T7-04 — Legacy DM send accepts any authenticated sender for any known conversation ID

**Severity: P0**

`POST /api/v1/social/dm/:id/send` at `apps/api-gateway/src/routes/v1/social.ts:1255-1318` checks that the conversation exists, but never verifies that the caller is a participant or that its status is accepted/open. An authenticated attacker with a leaked/guessed ID can inject messages and replace inbox previews.

Required remediation: delete the handler or delegate to canonical `sendChatMessage()`. Enforce participant membership, accepted state, expiry, blocks, sender identity, content schema, and an idempotent client message ID in one transaction.

Success behavior: non-participants and pending/declined/expired/blocked conversations cannot be mutated.

#### T7-05 — Two live route/collection authorities produce contradictory chat state

**Severity: P0**

Canonical routes write `chatMessages` plus compatibility collections and enforce `chatMembers`. Legacy Social routes write only `eventGroupMessages` or `directMessages`, skip canonical preview/unread/moderation behavior, and never call `fastify.broadcast`. Mobile reads those legacy collections while its inbox is assembled by `/social/my-chats`/canonical membership. This is a split-brain persistence model.

Required remediation:

1. Select `/api/v1/chats` plus `guest-chat-service` as the sole writer.
2. Migrate Mobile and any external client to generated canonical contracts.
3. Backfill/deduplicate messages by stable ID and preserve moderation state.
4. Remove direct Firestore chat writes from `social.ts`.
5. Publish an authorized post-commit message event from the canonical route/outbox.

Success behavior: one send creates one canonical message, one preview update, one realtime event, and consistent history on every surface.

#### T7-06 — Paid chat unlock is not a guaranteed completed side effect

**Severity: P0**

After committing payment, `packages/core/workflows/ticketing.js:777-797` attempts membership creation but catches and suppresses failure. The outbox can retry it via Inngest, and a cron retry route exists, but no deployed scheduler evidence was available. A confirmed buyer can therefore receive `chatUnlocked:false` and remain locked indefinitely after a transient failure.

Required remediation:

1. Keep commerce finalization independent, but make chat unlock a durable outbox projection with explicit `pending|completed|failed` state.
2. Schedule and monitor the retry worker, not merely expose a secret cron endpoint.
3. Make membership creation idempotent and emit `chat.membership.unlocked` after commit.
4. Have Mobile refetch chats after payment and on the unlock event.
5. Alert on age/retry thresholds and provide an operator replay command.

Success behavior: every eligible confirmed order reaches one active chat membership within the declared SLA, or produces an observable incident—never a silent permanent lock.

#### T7-07 — Entitlement checks use mutable orders rather than current ticket ownership

**Severity: P1**

`hasActiveEventEntitlement()` at `packages/core/guest-chat-service.js:234-263` authorizes from confirmed orders, RSVP orders, or guest list. It does not use the current ticket/entitlement owner or revocation/transfer state. A buyer who transfers every ticket can retain chat self-heal access, while the recipient's access depends on unrelated repair paths.

Required remediation: authorize paid access from current active entitlements and explicitly define RSVP/guest-list access. Revoke or retain chat membership according to a documented transfer/refund policy and test full/partial transfer.

Success behavior: chat access matches current admission ownership and the approved lifecycle policy.

#### T7-08 — Room capacity assignment has a race and lost counts

**Severity: P1**

`resolveEventChatForNewMember()` counts a room, then `ensureEventChatMembership()` writes membership/count later in a batch. Concurrent purchasers can select the same near-full room, exceed 250, and overwrite `roomMemberCount` with the same value.

Required remediation: allocate room membership transactionally using a sharded/atomic capacity counter and deterministic membership document; retry on capacity conflict.

Success behavior: no room exceeds capacity and concurrent joins produce exact counts.

#### T7-09 — Pagination cursors are timestamp-only and legacy history has no stable envelope

**Severity: P1**

Canonical history filters with `createdAt < before` and returns only the last timestamp. Messages sharing a timestamp can be skipped between pages. Legacy group history uses `startAfter(lastTimestamp)` and returns no `hasMore/nextCursor`; legacy DM accepts an unbounded/coerced query value and returns descending data unlike group chat.

Required remediation: order by `(createdAt, documentId)`, return an opaque signed cursor containing both values, cap all limits through Zod, and normalize ordering/envelopes.

Success behavior: paging through concurrent messages yields every message exactly once in deterministic order.

#### T7-10 — Unread state is never incremented for recipients

**Severity: P1**

The canonical sender resets only its own `chatMembers.unreadCount`. No code increments other active members, and legacy sends touch no membership rows. `totalUnread` is therefore structurally stale/zero.

Required remediation: derive unread from per-member last-read cursors plus message sequence, or update recipient projections asynchronously with deterministic sequence IDs; avoid per-message fan-out for large rooms.

Success behavior: inbox unread totals survive restart, reconcile across devices, and clear only when that user reads the chat.

#### T7-11 — Typing presence leaks chat participation and accepts unauthorized writes

**Severity: P1**

`POST /social/typing` does not verify chat membership and trusts client `userName`. `GET /social/typing/:chatId` is unauthenticated and returns every typing document for a supplied ID. Records have no enforced TTL cleanup.

Required remediation: authorize against the canonical chat, derive identity server-side, use Redis ephemeral presence with TTL, and authorize reads through the same WebSocket topic.

Success behavior: presence is private to current members, cannot be forged, and expires automatically.

#### T7-12 — Attendee discovery is not restricted to attendees

**Severity: P1**

`GET /api/v1/events/:id/attendees` requires authentication but `getEventAttendees()` grants full identities based solely on the viewer having Premium—not attendance at that event. A Premium user can enumerate another event's attendee list.

Required remediation: require current event entitlement or verified event-operator access before any attendee response; apply block/privacy settings and minimize returned fields.

Success behavior: unrelated users cannot enumerate event attendees regardless of subscription tier.

#### T7-13 — Realtime/legacy-route empirical coverage is absent

**Severity: P1**

Core tests exercise canonical membership/history/message logic, and Mobile unit tests mock transport. No Gateway test mounts the WebSocket plugin or adversarial legacy Social chat/DM routes. No multi-instance Redis Pub/Sub, background/foreground, token expiry, reconnect gap, duplicate delivery, or physical-device trace was available.

Required remediation: add authenticated WebSocket integration tests, route-level access matrix tests, Redis multi-instance tests, Mobile transport state tests, and staging device evidence with forced disconnects.

Success behavior: empirical tests prove confidentiality, ordered catch-up, no duplicate/lost messages, and recovery across process/device lifecycle.

### Stage C — Node 20 empirical validation

Commands ran with Node `v20.20.2`.

#### Typechecks

| Surface | Result |
|---|---:|
| `packages/core` | PASS |
| API Gateway (`tsc -p`) | PASS |
| Guest Portal | PASS from the current frozen-SHA run |
| Mobile App | FAIL with the previously recorded typed-route/dependency/type-tree errors |
| Partner Dashboard | FAIL with the previously recorded 7 errors |

#### Focused tests

| Surface | Result |
|---|---:|
| Core `guest-chat-service` | 1 file, 6 tests PASS |
| Mobile chat store, DM contract, and swipe layout | 3 suites, 13 tests PASS |
| Gateway canonical chat routes | **No focused route test exists** |
| WebSocket plugin and Redis multi-instance fanout | **No test exists** |
| Legacy Social chat/DM authorization | **No adversarial test exists** |
| **Executed total** | **19/19 focused tests PASS** |

Passing tests do not exercise the active Mobile/Gateway handshake, arbitrary topic subscription, non-attendee Social routes, cross-user DM injection, outbox scheduling, or reconnect catch-up.

### Stage D — strict verdict and release gate

Topic 7 is **FAIL** with **6 P0** and **7 P1** defects. The WebSocket boundary exposes arbitrary subscriptions yet is protocol-incompatible with Mobile; Mobile's active legacy group and DM routes bypass canonical authorization; two collection authorities diverge; and paid chat unlock is best-effort without deployed retry proof. Topic 7 is an absolute NO-GO until one chat service/route authority is enforced, every realtime topic is authorized, the handshake and fallback state machine are aligned, DM/group bypasses are removed, unlock is a monitored durable projection, and reconnect/device evidence proves no confidentiality or message-loss failure.

---

## Topic 8 — Dating and Social Matching Engine

### Stage A — Surface inventory

#### Mobile App

Primary evidence:

- The directive's `apps/mobile-app/app/dating/index.tsx` does not exist. The active feed is `apps/mobile-app/app/(tabs)/dating.tsx`; profile and match screens are `app/dating/[id].tsx` and `app/dating/match.tsx`.
- `apps/mobile-app/store/datingStore.ts:337-388` calls `GET /api/v1/social/discover`.
- `:457-529,591-649` calls `POST /api/v1/social/swipe`; likes send an idempotency header, prompt/photo replies send unsupported action `askOut`.
- Neither active dating screen exposes a block/report control, despite safety guidance stating those controls exist.
- Account isolation and stale-response guards in `datingStore` are materially sound.

Result: **FAIL**. The deck is connected, but critical eligibility, safety, ask-out, and persistence contracts are broken.

#### Guest Portal

No Guest Portal dating/matching surface was found. Public profile viewing is outside dating consent enforcement and is addressed below because the Gateway route is reachable by any caller.

#### Partner Dashboard

No Partner dating surface is expected. Moderation/admin processing is not exposed here; the active report service only persists pending documents.

### Stage B — Gateway, Firestore, Redis, and notification review

#### Verified positive architecture

- Mobile scopes deck/match state to the authenticated account and rejects stale responses after account switching.
- `packages/core/guest-dating-service.js:400-448` uses deterministic match/conversation IDs.
- `:178-274` responds to a received like with ownership checking and one batch for like, match, and conversation.
- Matching route requests pass through the global sensitive-route rate limiter.
- Received-like routes require authentication and verify that only the target user can accept/reject.

Those controls are not consistently used in discovery and swipe creation.

#### T8-01 — Discovery ignores block, safety, adult, and shared-context eligibility

**Severity: P0**

`getDiscoverProfiles()` at `packages/core/guest-dating-service.js:273-330` selects the first 100 `datingActive` users and excludes only prior swipes/self. It does not:

- exclude blocks in either direction;
- exclude suspended/deleted/reported profiles;
- require the viewer's dating opt-in/consent;
- enforce both users are adults;
- enforce current profile completeness;
- require an actual shared event despite the product's shared-event context;
- apply requested filters or workspace/region boundaries.

Required remediation:

1. Define one server-owned dating eligibility policy for viewer and candidate.
2. Enforce verified 18+ date of birth, active/not-deleted/not-suspended state, dating consent, profile completeness, and privacy.
3. Exclude both directions of blocks and moderation exclusions before scoring.
4. Require a valid shared event/approved discovery context if that is the product promise.
5. Return only the minimum public fields approved for that viewer.

Success behavior: no blocked, underage, opted-out, suspended, deleted, unrelated, or ineligible identity can enter the candidate deck.

#### T8-02 — Swipe accepts self, blocked, inactive, and nonexistent targets

**Severity: P0**

`processSwipeAction()` validates only non-empty IDs and `like|pass`. It never loads or validates the target. A direct API caller can self-like, like a blocked/deleted/minor/opted-out user, or create durable swipes/likes for a nonexistent ID. A self-like can observe its own swipe as the mutual swipe and create a self-match/conversation.

Required remediation: inside the authoritative transaction, reject self, load both profiles, enforce T8-01 eligibility, verify the target was in an issued candidate page/session, and recheck blocks/moderation immediately before write.

Success behavior: only a currently eligible candidate issued to that user can be swiped.

#### T8-03 — Swipe, limit, like, and match writes are not atomic or retry-safe

**Severity: P0**

The free-like counter transaction, `userSwipes` write, `userLikes` write, mutual read, and match batch are separate operations. Failure after the swipe write poisons retries because the next call returns “already swiped,” leaving a consumed limit, missing like, or missing match permanently. Concurrent duplicate requests can increment the daily limit twice. Mobile sends `X-Idempotency-Key` and retries three times, but the route never reads or stores that key.

Required remediation:

1. Require an idempotency key and persist a deterministic result record.
2. Read daily limit, current/opposite swipe, blocks, eligibility, existing match, and idempotency marker in one Firestore transaction.
3. Write the counter, swipe, like, deterministic match/conversation, and result atomically.
4. Return the original result on replay and fail conflicts closed.
5. Publish notifications only after commit through an outbox.

Success behavior: any retry/concurrent double-swipe produces one counter increment, one swipe, one like, one match/conversation at most, and the same response.

#### T8-04 — Prompt/photo “Ask Out” is a dead production action

**Severity: P0**

`datingStore.sendAskOut()` sends `{action:"askOut", message, eventId}`. The Gateway `SwipeBody` at `apps/api-gateway/src/routes/v1/social.ts:47-52` is strict and allows only `like|pass`, so every prompt/photo reply is rejected before core. The UI can animate/remove the card and then quietly restore/fail without delivering the message.

Required remediation: define an explicit canonical reaction contract (`like`, `pass`, `comment`, `super_like`) with validated message length/event/profile context and entitlement limits. Implement it in the same atomic workflow as T8-03, persist the comment on the like request, and test all client actions.

Success behavior: a prompt/photo reply creates one visible received-like request with the exact sanitized message, or the UI shows a clear failure without losing the card.

#### T8-05 — Public dating profiles bypass authentication, opt-in, and blocks

**Severity: P0**

`GET /api/v1/users/:id` at `apps/api-gateway/src/routes/v1/social.ts:1811-1845` has validation but no authentication. `getPublicUserProfile()` returns first name, age, photos, prompts, upcoming events, and dating status even when the target has disabled dating, blocked the requester, or is deleted/suspended. Raw user IDs are enumerable privacy handles.

Required remediation: require authentication, viewer eligibility, issued-candidate/match/event relationship, two-way block checks, target opt-in, and field-level privacy. Use an opaque profile reference where practical.

Success behavior: an unrelated/blocked/anonymous caller receives 404 without learning whether the user or dating profile exists.

#### T8-06 — Blocking has two storage authorities and does not enforce separation

**Severity: P0**

`POST /social/block` adds a random `userBlocks` document; `/users/me/block/:targetUserId` mutates `users.blockedUsers`. Discovery/swipe/matches use neither. Blocking does not invalidate feed caches, remove pending likes/swipes/matches, close conversations, revoke WebSocket topics, or prevent the blocked party from rediscovering/liking/messaging.

Required remediation:

1. Select one deterministic symmetric block-edge schema and one core mutation.
2. In one transaction, create the block, close/archive shared dating conversations and matches per policy, reject pending likes, and create a revocation event.
3. Enforce both directions in discovery, swipe, profiles, matches, DMs, attendee lists, and realtime authorization.
4. Invalidate all related caches and client decks.

Success behavior: after block commit, neither party can discover, inspect, like, match, message, or subscribe to the other through any route.

#### T8-07 — Report flow is unavailable from dating and its client contract fails validation

**Severity: P0**

The active dating screens have no report/block menu. The shared Mobile `reportUser()` helper sends a `metadata` property, while strict Gateway `ReportBody` accepts only `targetId`, `targetType`, `reason`, and `details`; it returns 400. `reportMessage()` sends several additional unsupported properties. Therefore the advertised in-app safety path is absent/broken.

Required remediation: add an always-visible profile/match safety menu, align one typed report contract, attach server-derived context, allow “block and report” atomically, provide emergency escalation language, and test from the exact screens.

Success behavior: a user can block/report from every dating profile/match, receives a durable report ID, and loses all contact immediately.

#### T8-08 — Candidate pagination and filters are placebo

**Severity: P1**

Mobile sends `cursor`, vibe, intent, height, and verification filters. `/social/discover` has no query schema and ignores all of them. Core always reads up to 100 users and returns 15 with no `nextCursor/hasMore`, so the client sets `hasMore:false` after the first page.

Required remediation: add a strict filter/query schema, indexed cursor pagination, stable score/tie-break ordering, and truthful `nextCursor/hasMore`. Unsupported filters must be absent, not displayed.

Success behavior: changing a filter changes server results, and paging never repeats/skips eligible candidates.

#### T8-09 — Candidate query is unbounded per-user and not launch-scalable

**Severity: P1**

Every feed fetch reads all of the caller's swipe documents, then up to 100 broad user documents, converts/sorts in memory, and performs no Redis cache or precomputed candidate index. At growth, latency/read cost grows with swipe history and the first 100 documents starve later candidates.

Required remediation: maintain indexed eligibility/geohash/event buckets, page exclusions with deterministic cursors, cap/history-compaction, and cache only after incorporating block/profile version keys. Load-test candidate p95 and Firestore reads.

Success behavior: feed latency/read count remains bounded as users and swipe history grow.

#### T8-10 — No server-side new-like or new-match notification is triggered

**Severity: P1**

Repository search found no notification, push, or outbox dispatch in `processSwipeAction()` or `respondToLikeRequest()`. The target receives no authoritative like notification; matched users receive no server push. Client-local state can inform only the second swiper while the app is open.

Required remediation: create deterministic post-commit `dating.like.received` and `dating.match.created` outbox events, honor both users' notification settings/blocks, and deep-link to a server-authorized match.

Success behavior: each eligible new like/match generates at most one notification per recipient, respects preferences, and never notifies after block/rollback.

#### T8-11 — Secondary matching architecture is incompatible and can misclassify interactions

**Severity: P1**

`/api/v1/matching` uses `MatchingService`, while Mobile uses `guest-dating-service`. The former returns no user candidates (`type:user` resolves to an empty array), saves non-deterministic interaction documents, does not create matches on swipe, and `checkMutualMatch()` checks interacted IDs without filtering direction—passes count as positive interaction. Its Zod schemas accept arbitrary strings for type/direction.

Required remediation: retire this path or make it a thin adapter to the one canonical dating workflow. Remove the second collection/model and validate enums.

Success behavior: repository search finds one candidate, swipe, mutual-match, and block policy implementation.

#### T8-12 — Activity/date handling can exclude valid candidates unpredictably

**Severity: P1**

Discovery performs `new Date(data.lastActiveAt)`. Firestore Timestamp values are not normalized with `toDate()`, and missing activity becomes epoch, excluding the profile. There is no canonical server-maintained activity field/TTL contract.

Required remediation: normalize Firestore/ISO timestamps, define when activity is updated and disclosed, and distinguish missing data migration from true inactivity.

Success behavior: eligibility is deterministic across stored timestamp formats and never exposes exact activity unintentionally.

#### T8-13 — Match lists do not re-evaluate safety or lifecycle state

**Severity: P1**

`getUserMatches()` returns every match for the user and enriches the other profile without filtering match status, blocks, deletion, suspension, dating opt-out, or conversation closure. It also performs one profile read per match with no pagination.

Required remediation: query active matches with cursor pagination, batch profiles, recheck block/safety state, and return tombstoned/closed state according to policy rather than live PII.

Success behavior: blocked/deleted/suspended matches cannot expose live profile data or reopen contact.

#### T8-14 — Moderation threshold has no enforcement or operational escalation

**Severity: P1**

`ModerationService.reportItem()` persists a pending report and, after five reports, only logs to stdout. It does not create a review queue/alert, quarantine discovery, rate-limit malicious reports, preserve evidence policy, or enforce an admin SLA.

Required remediation: define severity/category schema, deduplicate/rate-limit reports, create an audited moderation case, quarantine under an approved rule, alert operators, and connect resolution to profile/match/chat enforcement.

Success behavior: every high-risk report enters an owned review workflow with timestamps, evidence, actions, appeal, and measurable SLA.

#### T8-15 — Active dating route and concurrency coverage is absent

**Severity: P1**

Existing core tests cover the unused `MatchingService` and generic moderation service. Mobile tests cover account isolation. No focused test exercises `guest-dating-service` discovery/swipe, `/social/discover`, `/social/swipe`, public profile privacy, blocks, simultaneous swipes, idempotent retry, push, or report contracts.

Required remediation: add core transaction tests, Fastify injection access matrices, emulator concurrency/property tests, Mobile contract tests for every action, and staging device evidence with two real accounts.

Success behavior: two-device tests prove discovery eligibility, mutual match exactly once, notification delivery, block immediacy, and report escalation.

### Stage C — Node 20 empirical validation

Commands ran with Node `v20.20.2`.

#### Typechecks

| Surface | Result |
|---|---:|
| `packages/core` | PASS |
| API Gateway (`tsc -p`) | PASS |
| Guest Portal | PASS from the current frozen-SHA run |
| Mobile App | FAIL with the previously recorded typed-route/dependency/type-tree errors |
| Partner Dashboard | FAIL with the previously recorded 7 errors |

#### Focused tests

| Surface | Result |
|---|---:|
| Core secondary matching and moderation services | 2 files, 10 tests PASS |
| Mobile dating account isolation | 1 suite, 6 tests PASS |
| Active `guest-dating-service` | **No focused test exists** |
| Active Social discovery/swipe/profile/block/report routes | **No focused route test exists** |
| Concurrent two-user matching and push | **No test exists** |
| **Executed total** | **16/16 focused tests PASS** |

Passing tests do not exercise the production Mobile dating backend, and therefore do not offset any P0 above.

### Stage D — strict verdict and release gate

Topic 8 is **FAIL** with **7 P0** and **8 P1** defects. The active candidate feed fails fundamental eligibility/block/adult/privacy gates; swipe-to-match is not atomic or idempotent; Ask Out is dead; public dating data is enumerable; block/report controls do not enforce immediate safety; and no authoritative push path exists. Topic 8 is an absolute NO-GO until one canonical matching workflow enforces server-side eligibility and blocks, mutual match commits exactly once, public profiles fail closed, safety controls work from the real screens, and two-device adversarial evidence proves the entire lifecycle.

---

## Topic 9 — Ticket Transfers, Promoter Networks, Cover Charges, Profiles, Safety, and Admin Operations

### Stage A — Surface inventory

#### Mobile App

Primary evidence:

- `apps/mobile-app/lib/transfers.ts` delegates formal transfer creation, acceptance, cancellation, and pending-transfer reads to the Gateway.
- `apps/mobile-app/store/firstRunStore.ts:109-345` calls a canonical-looking `/api/v1/users/me/onboarding...` route family for bootstrap, identity, city, preferences, email prompt, and completion.
- `apps/mobile-app/lib/safety.ts:14-225` calls profile, live-location, and SOS routes and presents a local success notification.
- `apps/mobile-app/lib/notifications.ts` registers account-scoped Expo tokens and revokes them on logout.
- `apps/mobile-app/app/safety/index.tsx` exposes emergency-contact editing and SOS controls, but the active screen does not typecheck.

Result: **FAIL**. Transfer UI reaches live routes, but onboarding and safety depend on missing or schema-incompatible Gateway contracts. Passing Mobile unit tests mock those contracts and do not prove runtime integration.

#### Guest Portal

Primary evidence:

- Guest venue reservations are submitted by `features/venues/hooks/useVenueReservationFlow.js` through `POST /api/v1/venue-settings/venue/reservations`.
- Event table/package identity, tier identity, table price, and tier price are sent by the client.
- Guest cover-wallet reads use the Gateway wallet endpoint.
- Public ticket-share views redact the active credential, but the owner share-token repair write is fire-and-forget.

Result: **FAIL**. The reservation UI is connected to a request-record endpoint, not an authoritative table inventory, quote, payment, ledger, or fulfillment workflow.

#### Partner Dashboard

Primary evidence:

- `CreateEventWizardV2` and `TableBookingStep.tsx` persist table configuration on events.
- Promoter V2 pages consume authenticated V2 read endpoints.
- Venue table operations use a separate `table_assignments`/venue-subcollection model.
- Refunds are visible to a `finance` role in Admin Console navigation, but the backing `/api/admin/refunds...` handlers use the middleware's default `admin` requirement.

Result: **FAIL**. Configuration and read surfaces exist, but promoter commission authority, table commerce, cover-wallet tenant isolation, and finance-admin role wiring are unsafe or incomplete.

### Stage B — Gateway, Firestore, Redis, provider, and governance review

#### Verified positive architecture

- Formal transfer tokens use cryptographically strong randomness and have expiry.
- Bundle claims use a Firestore transaction for slot, assignment, inventory, and entitlement changes.
- Checkout snapshots validated promoter-link attribution and posts promoter commission through the canonical partner ledger.
- Promoter V2 finance reads are ledger-backed.
- Cover-wallet debit arithmetic is integer-paise based, checks preset items and balance, and uses Firestore transactions.
- Admin refund approval/rejection delegates mutations to the API Gateway rather than writing refunds directly from the Admin Console.
- Admin middleware verifies Firebase tokens, checks revocation outside development, enforces a role hierarchy, rejects stale sessions, and checks suspension state.

These controls are real, but several trust-boundary gaps bypass their intended guarantees.

#### T9-01 — Formal transfer acceptance is not transactionally locked by token

**Severity: P0**

`acceptTransfer()` at `packages/core/ticket-share-engine.js:1453-1471` begins a transaction but, after the document-ID lookup misses, resolves the transfer token with a plain `db.collection(...).get()` rather than `transaction.get(query)`. That transfer state is not conflict-tracked. Two simultaneous token claims can both observe `pending`; a transfer without a linked entitlement can create two active assignments before both mark the transfer accepted.

Required remediation:

1. Resolve the token to a deterministic transfer document before the transaction, then re-read that exact document with `transaction.get`, or use `transaction.get(tokenQuery)`.
2. Store a deterministic token hash/index and deterministic recipient assignment ID.
3. Read transfer, canonical ticket, entitlement, assignment, scan/revocation state, and recipient eligibility before writes.
4. Commit ownership handoff, old-credential revocation, new ticket/entitlement identity, transfer result, and outbox event atomically.
5. Return the stored result on idempotent replay; reject a different recipient with `TRANSFER_ALREADY_CLAIMED`.

Success behavior: 100 concurrent claims produce exactly one recipient, one assignment, one active entitlement, one audit/outbox event, and 99 stable already-claimed/conflict responses.

#### T9-02 — Targeted transfer identity is not enforced and canonical ownership can diverge

**Severity: P0**

`initiateTransfer()` stores `recipientEmail`, but `acceptTransfer()` receives only `recipientId` and never compares the authenticated user's verified email to the intended email. Any authenticated user holding a leaked targeted link can claim it. The handoff updates assignment/entitlement state but does not prove one canonical `tickets/{ticketId}` owner/status update. Several QR calls also invoke `signTicketPayload(assignmentId)` without its required `userId` (`ticket-share-engine.js:648,1560`), producing a credential bound to the literal value `undefined`.

Required remediation:

1. Pass the authenticated principal, including verified email, into the core workflow.
2. Bind targeted transfers to normalized verified email or a server-owned recipient UID; do not accept client-declared email identity.
3. Select `tickets` plus `entitlements` as the canonical ownership pair and update both in the same transaction.
4. Revoke every prior QR/JWT and generate the new scanner credential through the canonical ticket JWT signer.
5. Remove the legacy HMAC ticket token format from transfer and scan paths.
6. Enforce two-way blocks, refund/revocation, event lock time, and per-ticket consumed state at acceptance.

Success behavior: a leaked targeted link is useless to another account, the sender loses wallet/scanner access immediately, and every buyer/recipient/scanner read resolves the same owner and status.

#### T9-03 — Transfer initiation, audit, and legacy authorities are race-prone

**Severity: P1**

The pending-transfer check and random transfer creation at `ticket-share-engine.js:1387-1434` are separate operations, so concurrent initiation can create multiple live links. `logAuditEvent()` writes directly outside the caller's Firestore transaction and is awaited inside transaction callbacks (`:190-200,693-702,1542-1547,1604-1613`); transaction retries can duplicate audit records or record a handoff that rolls back. Ticket routes expose group transfer, formal transfer, share bundle, pair claim, and legacy transfer authorities without one canonical lifecycle.

Required remediation: create a deterministic active-transfer key per ticket, move audit/outbox writes into the transaction, retire legacy credential/transfer writers, and define one state machine covering `active → pending_transfer → transferred|cancelled|expired|used|revoked`.

Success behavior: one ticket has at most one active transfer and one auditable state transition per idempotency key.

#### T9-04 — Promoters can self-issue commission-bearing links for arbitrary events

**Severity: P0**

`POST /api/v1/promoter-links/create` accepts client-supplied `eventId`, `commissionRate`, and arbitrary `commissionType` (`apps/api-gateway/src/routes/v1/promoter-links.ts:6-17`). If `request.user.uid === promoterId`, the route skips event-owner authorization (`:93-116`) and persists those financial terms (`:136-155`). Checkout later snapshots the active link's rate/type and the canonical ledger uses that snapshot. A promoter can therefore create a self-authored link against an arbitrary event and influence the commission split.

Required remediation:

1. Remove all commission fields from promoter-authored input.
2. Require an active event-promoter assignment approved by the event's authoritative host/venue.
3. Resolve rate, type, eligible tiers, validity window, and promoter identity exclusively from that assignment inside a transaction.
4. Permit link creation only for the assigned promoter/event/tier set.
5. Version and sign the financial attribution snapshot; reject legacy links missing an approved assignment version.
6. Quarantine/review existing links whose creator, event ownership, and financial terms cannot be proven.

Success behavior: changing request JSON cannot alter a promoter's commission by one paise or create attribution for an unassigned event.

#### T9-05 — Promoter V2 pagination is non-functional and performs broad ledger reads

**Severity: P1**

The V2 route validates `cursor`, but `PromoterServiceV2.listLinks()` ignores it and always returns `nextCursor:null` (`apps/api-gateway/src/services/promoter-v2.ts:290-324,401-415`). Each link read also loads every ledger row for the promoter and aggregates in memory. Parallel legacy promoter routes and collections remain reachable, exposing incompatible finance/stat shapes.

Required remediation: implement indexed cursor pagination, query transactionally maintained ledger aggregates by promoter/link, return truthful page metadata, and make legacy promoter endpoints thin adapters or remove them.

Success behavior: large promoters page deterministically without full-ledger scans, duplicates, omissions, or cross-route financial drift.

#### T9-06 — Cover-charge debit authorization accepts ordinary users and unbound event codes

**Severity: P0**

`validateScannerToken()` returns true for any valid Firebase ID token without checking staff role, venue membership, event assignment, or charge permission (`apps/api-gateway/src/routes/v1/cover-charge.ts:103-118`). Scanner-session identity is recorded but never bound to the body `eventCodeId`. Debit verifies only that the supplied code exists, is type `charge`, and is not expired/revoked; it does not prove the code's event/venue matches the wallet. A valid user or scanner credential plus known IDs can debit a wallet outside its event/venue.

Required remediation:

1. Replace the validator with one canonical staff/scanner authorization context.
2. Bind session, charge-code ID, device, operator, venue, event, and permitted operation server-side.
3. Load wallet and code in the debit transaction and require exact event/venue equality.
4. Derive operator ID/role/device from the authenticated context, never the body.
5. Authorize preset item and amount from the wallet snapshot.
6. Add cross-event, cross-venue, ordinary-user, revoked-code, and stolen-session tests.

Success behavior: only an authorized charge-mode session for that exact event/venue can debit that wallet.

#### T9-07 — Cover-wallet privileged mutations trust client roles and ignore tenant scope

**Severity: P0**

Reverse and top-up check that `operatorId` equals the authenticated UID, then pass client-supplied `operatorRole` to Core (`cover-charge.ts:297-377`). Any ordinary authenticated user can claim `manager`, `host`, or `admin` and satisfy Core's role list. Freeze/unfreeze, arbitrary wallet reads by any `staff|manager|host`, and reconciliation validate a global role but never verify the wallet/event/venue belongs to the actor (`:401-535`).

Required remediation:

1. Require Firebase/partner authentication on every route.
2. Resolve effective role and active membership from server auth context.
3. Load the wallet first, then call `verifyPartnerAccess` for its venue/event.
4. Require a separate server-verified supervisor approval for reversals.
5. Remove `operatorRole`, `frozenBy`, and `unfrozenBy` from client authority; derive them.
6. Key reconciliation by event plus venue and authorize before cache lookup.

Success behavior: changing body role/actor IDs never grants permission, and staff from venue A cannot read or mutate one paise of venue B's wallet.

#### T9-08 — Cover-wallet issuance is post-confirmation, non-durable, and not concurrency-safe

**Severity: P0**

`packages/core/guest-order-engine.js:1224-1263` launches wallet issuance in a detached async loop after order confirmation. Failure writes another best-effort failure document. `issueWallet()` checks for an existing wallet with a normal query before optionally writing through a transaction and then creates a random wallet ID (`packages/core/cover-charge-engine.js:137-224`). A confirmed order can have no wallet, and concurrent retries can create multiple active wallets with duplicated opening balances.

Required remediation:

1. Make cover-wallet entitlement part of canonical payment finalization or create a deterministic transactional outbox item in that transaction.
2. Use deterministic wallet ID `cover_wallet/{orderId}:{tierId}:{unitIndex}` and a transaction read of that document.
3. Store one wallet per eligible admission unit or an explicitly modeled shared allowance.
4. Fail finalization or enter a monitored `fulfillment_pending` state until every required wallet exists.
5. Add retry worker, alerting, reconciliation, and duplicate-wallet repair.

Success behavior: every confirmed cover-charge ticket has exactly one expected wallet immediately/recoverably, and replay cannot mint additional balance.

#### T9-09 — VIP table reservation is a request form, not a commerce workflow

**Severity: P0**

`POST /venue-settings/venue/reservations` trusts client table/tier names and prices and creates a random pending document without reading the event, table, availability, capacity, authoritative price, or hold (`apps/api-gateway/src/routes/v1/venue-settings.ts:296-363`). Status update accepts any string and emits no `table/confirmed` event (`:400-448`), so the only table guest-record workflow is never triggered. No table quote, reservation lock, Razorpay payment, partner-ledger posting, refund, or deterministic table assignment connects the wizard's table packages to Guest or Mobile checkout.

Required remediation:

1. Define canonical event table inventory with deterministic event/table IDs, capacity, price in paise, tax/fee rules, availability, and version.
2. Add authenticated quote and atomic hold endpoints; never accept client price/name as authority.
3. Integrate table payment with the canonical checkout finalizer and `partner_ledger`.
4. Commit order, table assignment, guest allowance, ledger, and fulfillment outbox atomically.
5. Emit idempotent `table.confirmed`, `table.cancelled`, and `table.refunded` events.
6. Expose the same availability/price on Guest and Mobile or remove the launch CTA.

Success behavior: two users cannot reserve the same table, paid table revenue reconciles by one paise, and a confirmed booking appears in assignments and guest operations exactly once.

#### T9-10 — Table storage and Partner operations have split authorities and silent failures

**Severity: P1**

Core uses top-level `venue_tables`; Gateway uses `venues/{venueId}/tables`; event packages use `events.tables`; reservations use `table_reservations`; assignments use `table_assignments`. The active table route defines schemas but does not apply them to GET/POST, returns an empty booking state on Firestore errors, and DELETE always returns 501 (`apps/api-gateway/src/routes/v1/tables.ts:1-178`).

Required remediation: migrate to one table catalog plus event inventory model, apply strict schemas/enums, remove empty-on-error behavior, implement scoped deletion/retirement, and add migration/reconciliation tooling.

Success behavior: one table definition and one event-state record drive wizard, public inventory, reservations, floor operations, guest list, and finance.

#### T9-11 — Active first-run onboarding calls nonexistent routes and rejected fallbacks

**Severity: P0**

`firstRunStore` calls `/users/me/onboarding`, `/identity`, `/city`, `/preferences`, `/email-prompt`, and `/complete` (`apps/mobile-app/store/firstRunStore.ts:109-345`). Repository search found no Gateway registration for that route family. Its 404 fallback sends `dateOfBirth`, completion flags, `vibeTags`, `intents`, and `onboardingComplete` to `/users/me/settings`, but the strict `UserSettingsBody` does not allow those fields (`apps/api-gateway/src/routes/v1/users.ts:16-42`). The flow cannot canonically persist or complete identity/taste/intent state.

Required remediation:

1. Implement the exact authenticated onboarding route family as thin Zod routes over one Core onboarding service.
2. Persist a server-owned snapshot/state machine, date-only DOB, verified age policy, city ID, tastes, intents, email-prompt state, schema version, and completion timestamp.
3. Make each step idempotent and enforce legal transitions while permitting safe revisits.
4. Remove the legacy fallback after migration; local storage may resume UI only, never declare server completion.
5. Add Gateway injection tests matching every Mobile request and physical-device relaunch/offline recovery evidence.

Success behavior: a new account completes first run once, relaunches at the correct step, and discovery/profile reads return the exact saved tastes and intents.

#### T9-12 — Follow counters are not idempotent and ignore target/block lifecycle

**Severity: P1**

`followEntity()` uses deterministic follow IDs but always increments `followersCount` after a merge; retries or duplicate follows inflate the count. `unfollowEntity()` always decrements even when no edge existed, allowing negative/drifting counts (`packages/core/follow-graph-engine.js:8-62`). It does not validate target existence/type, block relationships, deletion, or suspension. Counter failures are swallowed.

Required remediation: transactionally read edge and target, increment only on create, decrement only on delete, enforce valid target and two-way blocks, emit an outbox event, and make counts rebuildable from edges.

Success behavior: unlimited follow/unfollow retries preserve a count equal to the exact number of valid follow edges.

#### T9-13 — Emergency contacts cannot be saved and SOS reports false delivery

**Severity: P0**

Mobile saves `{emergencyContacts}` through `PUT /api/v1/users/me` (`apps/mobile-app/lib/safety.ts:25-39`), but strict `ProfileUpdateBody` rejects that field (`apps/api-gateway/src/routes/v1/users.ts:5-14`). On SOS, the Gateway only adds `sosAlerts` and contains the explicit placeholder “In production, trigger SMS/Push here” (`social.ts:1040-1080`). Mobile opens an SMS composer for only the first contact—without proof the user sent it—then displays “Emergency contacts have been notified” (`safety.ts:192-225`).

Required remediation:

1. Add a dedicated encrypted/least-privilege emergency-contact API with phone validation, ownership, limits, and audit.
2. Implement one server-side SOS workflow with deterministic incident ID, provider delivery to every configured contact, escalation target, retry, delivery receipt, and operator alert.
3. Persist consent and minimize location retention/access.
4. Return `accepted`, not `notified`, until delivery receipts exist; show each delivery state in Mobile.
5. Add provider sandbox and physical-device tests, including no-location and provider-failure cases.

Success behavior: the app never claims notification without provider evidence, every configured contact is attempted, failures are visible/retried, and operators receive an auditable incident.

#### T9-14 — Live-location sharing cannot be consumed or stopped

**Severity: P0**

Mobile polls `GET /social/location/:id` and stops with `POST /social/location/:id/stop` (`safety.ts:145-190`), but the Gateway implements only start and owner PATCH (`apps/api-gateway/src/routes/v1/social.ts:913-1038`). New sessions set `sharedWith:[]`, and there is no invitation/authorization mutation. Mobile's passing safety tests mock endpoints that do not exist.

Required remediation:

1. Define explicit invite/accept/revoke access grants with opaque session capability IDs.
2. Add authorized GET and idempotent stop/revoke routes.
3. Validate coordinate ranges, duration bounds, expiry, owner status, and recipient membership on every read/update.
4. Automatically expire and delete precise location according to a documented retention policy.
5. Add two-device tests for authorized recipient, unrelated user, revoked access, expiry, owner stop, and account block.

Success behavior: only accepted contacts see current location, access ends immediately on stop/revoke/block/expiry, and no stale coordinate remains publicly retrievable.

#### T9-15 — Push delivery reports success without checking Expo results

**Severity: P1**

`NotificationService.sendPushToFollowers()` does not require a successful response, parse Expo ticket errors, store receipt IDs, or remove invalid tokens. It increments a local counter after any non-throwing HTTP response and ultimately returns `tokens.length` rather than the computed success count (`packages/core/src/domain/services/notification-service.ts:59-93`). Multiple route-local and Mobile-local push implementations remain.

Required remediation: centralize push in an outbox worker, check HTTP and per-ticket results, persist provider ticket IDs, poll receipts, quarantine invalid tokens, retry transient failures, respect preferences/blocks, and return accepted/delivered/failed counts truthfully.

Success behavior: dashboards and alerts never label rejected Expo requests as sent, and every message has an idempotent delivery record.

#### T9-16 — Admin refund role contract contradicts the visible governance model

**Severity: P1**

Admin navigation exposes Refunds at `minRole:'finance'` (`AdminConsoleShell.jsx:81-86`), but all three `/api/admin/refunds...` exports call `withAdminAuth(handler)` without the required role. The middleware default is `admin`, whose hierarchy value is 100, while `finance` is 60 (`adminMiddleware.js:41,91-129`). A valid finance administrator sees the feature but receives an obscured 404. The list route also reads Firestore directly while mutations use Gateway, leaving a split admin data boundary.

Required remediation: declare `withAdminAuth(handler, 'finance')`, move canonical refund reads behind the Gateway with the same authorization/audit contract, keep dual approval server-owned, and add role-matrix tests for readonly/support/content/finance/ops/admin/super.

Success behavior: finance and higher roles can list/respond according to policy; lower roles get a uniform denial; all reads and mutations are auditable through one authority.

#### T9-17 — Topic 9 adversarial and route-contract coverage is incomplete

**Severity: P1**

There is no focused `ticket-share-engine` concurrency/security suite, no active cover-charge route authorization suite, no Gateway test for the Mobile onboarding route family, no real location/SOS route test, no promoter self-authored commission attack test, no table checkout/inventory test, and no Admin refund role-matrix test. Existing safety tests mock missing routes, while cover tests exercise Core arithmetic rather than caller authorization.

Required remediation: add Firestore-emulator concurrency tests, Fastify/Next route injection access matrices, provider sandbox tests, and physical-device/two-account journeys for every P0 above.

Success behavior: each exploit is represented by a test that fails before remediation and passes only through the canonical production route.

### Stage C — Node 20 empirical validation

Commands ran with Node `v20.20.2`.

#### Typechecks

| Surface | Result |
|---|---:|
| `packages/core` | PASS |
| API Gateway (`tsc --noEmit`) | PASS |
| Mobile App | **FAIL**; includes active safety-screen `className` errors, notification-permission type errors, typed-route errors, missing `expo-audio`, and duplicate React Native type trees |
| Partner Dashboard | **FAIL**; 7 previously recorded Next/Lucide/type-tree errors |
| Admin Console | PASS |

The API Gateway package has no `type-check` script; direct Node 20 `tsc --noEmit` passed.

#### Focused tests

| Surface | Result |
|---|---:|
| Core cover charge and guest wallet/profile/notification | 2 files, 36 tests PASS |
| Gateway promoter context, Promoter V2, guest links/follows/profile/notifications | 5 files, 18 tests PASS |
| Mobile first run, notifications, safety, cover charge, and follow store | 10 suites, 98 tests PASS |
| Ticket transfer concurrency/recipient binding | **No focused test exists** |
| Cover-charge route authorization/tenant isolation | **No focused test exists** |
| Real onboarding route contract | **No route exists/test exists** |
| Real location/SOS delivery | **No route/provider E2E exists** |
| Table inventory/payment/ledger | **No workflow/test exists** |
| Admin refund role matrix | **No focused test exists** |
| **Executed total** | **152/152 focused tests PASS** |

Passing tests prove isolated helpers and mocked client behavior, not the active trust boundaries. They do not offset any P0 above.

### Stage D — strict verdict and release gate

Topic 9 is **FAIL** with **10 P0** and **7 P1** defects. Transfer claims are not fully transactional or recipient-bound; promoter commission can be self-authored; cover wallets permit role/tenant bypass and non-atomic issuance; VIP table commerce is not implemented; first-run onboarding calls nonexistent contracts; and SOS/location safety can report success without real delivery or access control. Admin finance roles are also mismatched.

Topic 9 is an absolute NO-GO until:

1. transfer ownership and credentials move atomically through one canonical ticket/entitlement workflow;
2. promoter financial terms are event-owner approved and immutable;
3. every cover-wallet mutation is server-role- and venue/event-bound;
4. cover-wallet issuance and table commerce are deterministic, ledger-backed, and retry-safe;
5. the real onboarding route family persists and reloads canonical taste/intent state;
6. emergency contacts, SOS provider delivery, and live-location sharing work end to end without false success;
7. Admin refund permissions match the declared finance governance model; and
8. emulator, provider-sandbox, physical-device, and multi-account evidence proves every P0 exploit is closed.

---

## Consolidated launch decision

### Defect ledger

| Topic | Verdict | P0 | P1 |
|---|---:|---:|---:|
| 1. Authentication, authorization, roles, sessions | FAIL | 1 | 5 |
| 2. Event creation, approval, cache propagation | FAIL | 3 | 5 |
| 3. Ticket inventory, reservations, overselling | FAIL | 5 | 8 |
| 4. Checkout, payment finalization, refunds | FAIL | 4 | 5 |
| 5. Tickets, entitlements, wallet QR, scanner | FAIL | 6 | 6 |
| 6. Ledger, finance, payouts, analytics | FAIL | 4 | 7 |
| 7. Chat, WebSockets, automatic unlock | FAIL | 6 | 7 |
| 8. Dating, matching, blocks, reports | FAIL | 7 | 8 |
| 9. Transfers, promoters, cover/tables, onboarding, safety, admin | FAIL | 10 | 7 |
| **Total** | **NO-GO** | **46** | **58** |

There are **104 open release-blocking findings** in this audited snapshot. The ecosystem is not production-ready. This is a code-grounded NO-GO even before the missing staging-provider, Redis, webhook, load, and physical-device evidence is considered.

### Mandatory implementation order

Dependencies make the following order non-negotiable:

1. **Freeze authority and eliminate bypasses**
   - Freeze a new `pre-staging` SHA.
   - Select one route/core authority for event mutations, checkout/finalization, refunds, scanning, transfers, chat, matching, promoter attribution, cover wallets, table commerce, and admin financial actions.
   - Enforce authoritative membership, permission, tenant, event, and resource checks at Gateway/Core boundaries.
   - Disable or return observable `410 Gone` from every conflicting legacy mutation until removed.

2. **Restore atomic commerce invariants**
   - Repair inventory/reservation conversion, captured-payment recovery, refund/provider settlement, ledger aggregates, ticket/entitlement issuance, transfer ownership, cover-wallet issuance, and table booking.
   - Use deterministic IDs and idempotency markers.
   - Make all money integer paise and reconcile every order/refund/payout exactly.
   - No UI or asynchronous projection may create financial/admission truth.

3. **Unify credentials and operational state**
   - One signed rotating ticket JWT and scanner verifier.
   - One staff/scanner session authorization context.
   - One ticket/entitlement owner and admission state.
   - One realtime authorization protocol with polling/refetch fallback.
   - Immediate invalidation on refund, transfer, block, revoke, cancel, or role removal.

4. **Repair production surface contracts**
   - Implement and test the actual Mobile onboarding APIs.
   - Align Guest and Mobile event/tier/table/checkout schemas.
   - Remove dead buttons, mock financial states, unsupported actions, and false success messages.
   - Make every visible control execute a canonical operation or remove it from launch.

5. **Complete safety and governance**
   - Enforce dating/profile privacy and two-way blocks everywhere.
   - Implement durable report/moderation ownership.
   - Implement emergency contacts, SOS provider delivery/receipts, and live-location grants/revocation.
   - Align Admin role matrices and route all governed finance actions through the Gateway.

6. **Make build quality enforceable**
   - Restore clean Node 20 typechecks for Mobile and Partner Dashboard.
   - Add missing route, access-matrix, concurrency, idempotency, provider, cache, and failure-recovery tests.
   - Prevent signed builds when typecheck, release guard, demo-off, environment-consistency, or schema-generation checks fail.

7. **Prove the integrated system in staging**
   - Supply approved Firebase, Redis, Razorpay Test Mode, webhook, Gateway, frontend, and physical Android configuration.
   - Run simultaneous buyer, callback/webhook race, refund, transfer, scanner, block/report, table, cover-wallet, SOS, and recovery journeys.
   - Retain provider IDs, Firestore/ledger documents, Redis/cache evidence, device recordings, authorization traces, and timestamps.
   - Prove door `<3s`, KPI `<5s`, and graph `<15s` p95 over at least ten purchases.

8. **Promote only after zero blockers**
   - Re-audit the frozen remediation SHA from Topic 1 through Topic 9.
   - Any open, blocked, waived, untested, or environment-unproven P0/P1 remains NO-GO.
   - Promote `pre-staging → staging`, repeat the full E2E suite, then promote the exact verified artifact to production.

### Required proof before GO

- Zero open P0/P1 findings.
- Clean required lint, typecheck, test, guardrail, and production-build commands.
- Exact-paise order/refund/payout/commission reconciliation.
- No oversell, duplicate finalization, duplicate transfer, duplicate wallet, or duplicate table booking under concurrency.
- Cross-tenant and ordinary-user attacks fail closed on every critical mutation/read.
- Invalid/replayed/refunded/transferred/revoked/wrong-event credentials never admit or debit.
- Guest, Mobile, Partner, Admin, scanner, provider, ledger, and cache state reconcile.
- Physical Android Razorpay, ticket wallet, scanner, notification, onboarding, safety, offline/relaunch, and recovery evidence.
- Named owners, rollback procedures, observability alerts, and signed release approval.

**Final verdict: NO-GO.**
