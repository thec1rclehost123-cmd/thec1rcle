# THE C1RCLE Master Launch Remediation Implementation Plan

**Authority:** `docs/FULL_ECOSYSTEM_AUDIT_REPORT.md`  
**Repository:** `/Users/aayushdivase/Desktop/thec1rcle`  
**Release branch:** `pre-staging`  
**Frozen implementation baseline:** `01fa230d9b0b3fe4208b947ef895edfe0bd78795`  
**Remote baseline at freeze:** `e1bf2d346eb5f84adb9d3ce38547984b7caa10de`  
**Implementation branch:** `codex/master-launch-remediation-2026-07-24`  
**Verdict until G12:** **NO-GO**

## 1. Controlling launch contract

- Node 20 LTS and npm 10 are mandatory.
- Fastify routes validate inputs with Zod and delegate domain writes to `packages/core`.
- Firebase authentication, current membership, explicit permissions, and tenant scope are mandatory.
- `partner_ledger` is the sole financial authority. `partner_finance_aggregates` is rebuildable.
- Razorpay payment, Firestore commerce state, inventory, tickets, entitlements, and ledger must reconcile exactly.
- Scanner authorization is distinct from ordinary Firebase authentication.
- Any open, blocked, waived, untested, or environment-unproven P0/P1 is NO-GO.
- Every test, type-check, guardrail, and build command is blocking.
- No evidence means no PASS.

## 2. Defect execution ledger

| Workstream | Audit IDs | Closure requirement |
|---|---|---|
| Authentication and roles | T1-01–T1-06 | Typed credential verification, revocation, disabled-account enforcement, current membership, finance permissions, logout revocation, canonical roles |
| Events and discovery | T2-01–T2-08 | Server-derived ownership, command schemas, atomic lifecycle/availability, durable cache invalidation, Guest/Mobile propagation |
| Inventory | T3-01–T3-13 | Aggregated quantities, one counter authority, owned reservations, safe Redis locks, strict fail-closed inventory, TTL/reconciliation |
| Payment, ledger, refunds | T4-01–T4-09 | Captured-only finalization, durable recovery, exact refund reversals, complete replay validation, canonical webhook |
| Scanner | T5-01–T5-12 | Staff/event/venue/device sessions, JWT-only QR, 15-second rotation, ACTIVE entitlements, atomic couple grant, offline deny, route/device evidence |
| Finance and payouts | T6-01–T6-11 | Ledger-backed views, canonical RazorpayX payout state machine, no fixtures, projection rebuild, 3/5/15-second SLA |
| Realtime and chat | T7-01–T7-13 | Authorized topics, one handshake, one chat authority, durable unlock, entitlement access, stable cursors, reconnect proof |
| Dating and safety | T8-01–T8-15 | Server eligibility, atomic reactions/matches, protected profiles, symmetric blocks, moderation, pagination, two-device evidence |
| Transfers and operations | T9-01–T9-17 | Atomic transfer, approved promoter terms, cover/table authority, onboarding/follows, SOS/location/push receipts, Admin role matrix |

An audit ID closes only after code, automated tests, staging proof, observability, and rollback evidence are attached.

## 3. Phase A — Authentication, RBAC, scanner, and type safety

### A1. Credential and session authority

Target `packages/core/src/infrastructure/auth/firebase-auth-service.ts`,
`apps/api-gateway/src/plugins/firebase.ts`, the Guest auth route, and shared auth context.

- Bind Bearer credentials to `verifyIdToken(token, true)`.
- Bind `__session` cookies to `verifySessionCookie(cookie, true)`.
- Reject simultaneous Bearer and cookie credentials with `AUTH_CREDENTIAL_AMBIGUOUS`.
- Return typed revoked, disabled, expired, malformed, and mismatch failures.
- Resolve memberships from current server state and fail closed when unavailable.
- Revoke Firebase refresh tokens on Guest logout before reporting full success.
- Normalize `door`, `DOOR`, and `door_staff` to the canonical server role.

### A2. Finance RBAC

Target `apps/api-gateway/src/routes/v1/partners/finance.ts`.

- Require `VIEW_FINANCIALS` for every finance read.
- Require `MANAGE_PAYOUTS` for bank account, payout, retry, cancel, and provider mutations.
- Resolve the exact partner from current active membership.
- Deny door, security, general staff, inactive members, and other tenants.
- Return non-enumerating 404 where resource existence is sensitive.

### A3. Scanner authority

Target the Gateway scan routes, Core ticket wallet service, Scanner App API/session storage,
and Mobile/Guest wallet QR consumers.

- Require active verified venue staff with scan permission.
- Bind sessions to one user, event, venue, device, role, and short expiry.
- Require SecureStore device identity and server-side device registration.
- Accept only the canonical signed ticket JWT.
- Return `410 LEGACY_QR_RETIRED` for raw IDs, order QR, entitlement HMAC, and sentinel payloads.
- Generate owner-authenticated `no-store` wallet JWTs with a 15-second lifetime.
- Scan only `ACTIVE` entitlements belonging to the current ticket owner.
- Preview couple tickets without writes and consume both admissions in one confirmation transaction.
- Deny scans while offline and show an explicit connectivity incident.
- Preserve wrong-event, replay, revoked, expired, transferred, consumed, and device denial codes.

### A4. Type and package gates

- Align the repository on TypeScript 5.9.3.
- Regenerate Expo Router types from the real Mobile route tree.
- Eliminate the audited Mobile, Partner, and Scanner compiler failures without suppressions.
- Add Gateway `type-check`, Scanner tests, and Admin tests to root orchestration.
- Keep release verification on Node 20/npm 10.

## 4. Phase B — Atomic commerce and financial truth

### B1. Inventory

- Reject duplicate ticket-tier rows and enforce limits after aggregation.
- Use one deterministic sold/reserved counter model and deterministic shards.
- Standardize reservation owner as `customerId`.
- Standardize reservation TTL at 10 minutes.
- Use random Redis lock tokens with compare-renew and compare-delete Lua scripts.
- Fail finite inventory with a typed 503 when Redis authority is unavailable.
- Convert free, RSVP, paid, cover, and table admissions through authoritative inventory.
- Reconcile Firestore/Redis divergence and prove `sold <= capacity` under concurrency.

### B2. Payment finalization

All verification entry points delegate to `finalizeTicketPayment()`.

- Require captured provider state and exact amount/currency.
- Reject payment reuse and cross-user order verification.
- Atomically convert inventory, confirm order/payment, issue tickets/entitlements, post the
  complete ledger set, create the idempotency marker, and write the outbox event.
- Validate every marker-referenced artifact on replay.
- Recover `payment_received_finalization_pending` without requesting another charge.
- Keep transactions below Firestore’s write limit with a pre-payment order maximum.

### B3. Ledger

- Store all money in integer paise.
- Persist immutable host, venue, promoter, promoter-link, and split snapshots before provider order creation.
- Use one `partner_ledger_idempotency/{orderId}` convention.
- Remove background commission and competing ledger writers.
- Read financial totals only from ledger rows or `partner_finance_aggregates`.
- Return `FINANCE_DATA_UNAVAILABLE`, never fake zero, on authoritative read failure.

### B4. Refunds

- Route Admin refunds through the permission-protected Gateway.
- Confirm provider state or persist an explicit provider-pending state.
- Reverse the exact original entries and buckets with `originalEntryId`.
- Map partial refunds to exact tickets/entitlements.
- Revoke only refunded admissions.
- Model goodwill adjustments separately.

## 5. Phase C — Events, finance, realtime, and social

### C1. Events

- Redirect `/create` to the role-specific V2 wizard.
- Derive actor, partner, host, venue, lifecycle, and visibility server-side.
- Require `MANAGE_EVENTS`.
- Replace arbitrary patches with explicit draft, tier, submit, approve, publish, and cancel commands.
- Commit availability slot and publication state atomically.
- Use one durable public-discovery invalidation event.
- Invalidate Guest tags and Mobile event caches after committed mutations.

### C2. Payouts and analytics

- Use one payout state machine:
  `pending_review → approved → submitted → processing → settled|failed|reversed`.
- Reserve settled balance transactionally before RazorpayX submission.
- Use deterministic provider idempotency and webhook reconciliation.
- Remove all payout fixtures and dashboard-local provider writes.
- Rebuild finance projections with a checkpointed ledger replay.
- Meet p95 synchronization: door under 3 seconds, KPI under 5 seconds, graph under 15 seconds.

### C3. Chat and realtime

- Make `/api/v1/chats` plus `guest-chat-service` canonical.
- Use a short-lived Gateway WebSocket session token and authorized topic subscriptions.
- Require subscription acknowledgement and cursor catch-up.
- Never downgrade failed authentication to anonymous.
- Derive access from current entitlement ownership and current participants.
- Make unlock, unread, and read-receipt projections durable and replayable.

### C4. Dating and moderation

- Enforce adult, active, consent, profile, privacy, block, moderation, and shared-context eligibility.
- Validate issued candidates and reject self-actions.
- Commit reaction, limits, like, match, conversation, result, and outbox idempotently.
- Protect public profiles with relationship or opaque-reference authority.
- Make block edges symmetric and immediately revoke matching/chat/profile access.
- Add typed report/moderation cases, stable cursors, indexed buckets, and two-device proof.

## 6. Phase D — Transfers and operational subsystems

- Transfer ticket and entitlement ownership atomically using hashed tokens and one active transfer.
- Resolve promoter links and commission terms only from approved assignments.
- Bind cover wallets and debits to canonical scanner sessions and deterministic wallet IDs.
- Consolidate table quote, hold, checkout, assignment, ledger, and cancellation.
- Persist onboarding progress in the Core profile state machine and resume across devices.
- Make follows one edge/counter transaction with block checks and rebuild support.
- Deliver SOS through durable MSG91, Expo, and operator outbox records with truthful receipts.
- Implement authorized, expiring, revocable location-sharing grants.
- Enforce an explicit Admin role matrix and remove direct commerce Firestore mutations.
- Keep deprecated routes read-only with observable 410 telemetry until zero traffic, then remove them.

## 7. Data migrations

Every migration must provide dry run, checkpoint, resume, reconciliation totals, a high-water mark,
catch-up processing, rollback pointer, and evidence output.

Required migrations cover memberships/roles, events/slots, reservation ownership and TTL,
paise fields and attribution, ledger/refund links, ticket/entitlement ACTIVE ownership, payout state,
chat, blocks/dating, promoter assignments, cover wallets, tables, onboarding, follows,
emergency contacts, SOS, notification receipts, and location grants.

## 8. Blocking verification

```bash
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
node --version
npm --version
npm ci
npm run format:check
npm run lint
npm run stylelint:check
npm run type-check
npm test -w packages/core
npm test -w apps/api-gateway
npm test -w apps/guest-portal
npm test -w apps/partner-dashboard
npm test -w apps/mobile-app -- --runInBand --watchman=false
npm test -w apps/scanner-app
npm test -w apps/admin-console
npm run test:guardrails
npm run guardrails:check
npm run build
npm run prepush
```

Every command must exit zero. Physical Android, Firebase, Redis, Razorpay, RazorpayX, webhook,
Expo, MSG91, cross-tenant, recovery, concurrency, and SLA evidence remain mandatory.

## 9. G0–G12

| Gate | PASS evidence |
|---|---|
| G0 | Exact SHA, branch, tracked state, and defect map frozen |
| G1 | Node/npm and approved staging/provider/device configuration |
| G2 | Clean install, lockfile provenance, dependency review |
| G3 | All static, test, guardrail, and build commands pass |
| G4 | Firebase, Redis, Gateway, webhooks, surfaces, providers, device connected |
| G5 | Auth, revocation, RBAC, scanner, Admin, and cross-tenant evidence |
| G6 | Event lifecycle and cache propagation |
| G7 | Guest and physical Android parity |
| G8 | Atomic inventory/payment/order/ticket/entitlement/ledger/refund/transfer/table/cover |
| G9 | Provider/Firestore/Redis/wallet/scanner/finance/payout/analytics/notification reconciliation |
| G10 | Tampering, replay, expiry, duplicate, bypass, and escalation tests |
| G11 | Restart, timeout, webhook delay, capture recovery, Redis/cache/realtime/provider failure |
| G12 | Evidence audit, QA cleanup, zero open P0/P1, rollback/runbooks, signed decision |

## 10. Absolute NO-GO

Launch remains blocked by any open or unproven P0/P1, compiler failure, omitted workspace,
non-blocking test failure, auth/RBAC bypass, commerce atomicity gap, one-paise discrepancy,
unrecoverable capture, invalid scan acceptance, forged attribution, cross-surface pricing mismatch,
fixture financial data, unauthorized realtime topic, false SOS success, mutating legacy route,
missing physical-device/provider evidence, or failed 3/5/15-second SLA.
