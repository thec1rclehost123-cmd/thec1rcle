# THE C1RCLE Pre-Staging Strict Integration QA Plan

## 1. Document control

| Field | Value |
|---|---|
| Plan type | Full-stack integration, transaction, security, and release audit |
| Execution mode | Audit only: observe, test, reproduce, and report; do not fix during the run |
| Authoritative checkout | `/Users/aayushdivase/Desktop/thec1rcle` |
| Authoritative branch | `pre-staging` |
| Baseline observed while planning | `e1bf2d346eb5f84adb9d3ce38547984b7caa10de` |
| Primary systems | API gateway, core, partner dashboard, guest portal, Android mobile app |
| Supporting systems | Firebase Auth, Firestore, Storage, Redis, Razorpay test mode, admin approval path, scanner ticket validation |
| Required device | Physical Android connected by USB |
| Production data | Prohibited |
| Real payments | Prohibited |

The commit above is a planning baseline, not a permanent test target. The execution lead must record the exact local and remote commit at the start of every run. If the commit changes after Gate G0, the run is invalid and must restart from G0.

## 2. Mission

Prove, with correlated evidence, that one real test event can move through the entire system:

```text
Partner authentication
  -> partner onboarding and authorization
  -> event and ticket-tier creation
  -> approval/publication
  -> guest and mobile discovery
  -> authoritative quote and inventory reservation
  -> Razorpay test checkout
  -> server-side payment verification
  -> order and ticket issuance
  -> mobile wallet and guest-portal visibility
  -> partner attendee/order/finance visibility
  -> database and Redis reconciliation
  -> scanner validation
```

The audit must also prove that invalid, unauthorized, duplicated, expired, and tampered operations fail safely.

## 3. Non-negotiable operating rules

1. Only the authoritative root checkout may run the audited services.
2. No nested repository, recovery directory, backup, old worktree, or alternate branch may provide code or dependencies during the run.
3. No product-code fix, dependency upgrade, configuration correction, schema migration, index deployment, or pipeline edit may be performed during audit execution.
4. Test fixtures may be created only through the normal application or API process unless a test explicitly requires controlled database setup.
5. Only dedicated QA identities, events, orders, payments, tickets, and test-provider credentials may be used.
6. The Firebase project, Razorpay key, webhook endpoint, API host, and app environment must be proven non-production before any mutation.
7. A UI screenshot alone never proves a backend operation.
8. A successful API response alone never proves persistence, idempotency, authorization, or cross-surface propagation.
9. A database record alone never proves the user journey or gateway boundary.
10. A test receives `PASS` only when every required evidence layer exists.
11. A blocked critical-path test is a release blocker, not an assumed pass.
12. Retries are separate attempts. Evidence from failed attempts must never be overwritten.
13. Any manual database alteration must be recorded in the mutation ledger with actor, reason, before-state, after-state, and cleanup status.
14. Secrets, full tokens, private keys, OTP values, payment signatures, and personal data must be redacted from evidence.
15. Test data must use the run prefix defined in Section 8.
16. Audit findings are reported immediately but remain unfixed until the audit report is reviewed and the audit phase is formally closed.

The controlling rule is: **no evidence = no PASS**.

## 4. Strict status model

Every gate and test case must have exactly one status:

- `NOT STARTED`: no execution attempt exists.
- `IN PROGRESS`: an attempt is actively being executed.
- `PASS`: expected result occurred and all required evidence is attached.
- `FAIL`: execution completed and actual behavior differed from the expected result.
- `BLOCKED`: execution could not proceed because a prerequisite or dependency failed.
- `NOT APPLICABLE`: the test cannot apply to the approved fixture; justification is mandatory.
- `INVALIDATED`: evidence became unreliable because the commit, build, environment, account state, or backend changed.

The words “looks good,” “probably,” “seems connected,” and “works from code inspection” are not valid statuses.

## 5. Severity model

| Severity | Definition | Examples | Release effect |
|---|---|---|---|
| `P0` | Security compromise, real-money risk, cross-tenant access, unrecoverable data corruption, or systemic overselling | Forged payment accepted; buyer reads another buyer’s ticket; duplicate issuance; production key used | Stop the run immediately; automatic `NO-GO` |
| `P1` | Critical journey broken or authoritative state incorrect | Cannot publish event; valid payment does not issue ticket; inventory or partner finance is wrong | Dependent tests stop; automatic `NO-GO` |
| `P2` | Major functionality degraded with a viable workaround or limited scope | One surface fails to refresh until relaunch; structured error contract missing | Must be triaged before promotion |
| `P3` | Minor functional, content, accessibility, or visual defect | Copy issue; low-impact layout problem | May proceed only with documented owner and acceptance |

Severity is based on impact, not implementation difficulty.

## 6. Immediate stop conditions

Stop all mutating tests immediately if any of the following occurs:

1. A production Firebase project, production Razorpay key, production webhook, or production API host is detected.
2. A real charge or non-test payment is initiated.
3. A test operation modifies a non-QA account, event, order, ticket, or partner record.
4. One successful payment produces more than one order, entitlement, ticket, inventory decrement, or partner revenue entry.
5. An invalid signature or client-modified price is accepted.
6. A user can access another user’s private order, ticket, profile, or payment data.
7. A partner can access another partner’s event, attendees, finance, or operational data.
8. Inventory becomes negative or cannot be reconciled.
9. The authoritative commit, runtime configuration, or deployed backend changes during the run.
10. Evidence begins exposing secrets or personal information.
11. Database state cannot be attributed to one test attempt.
12. The gateway is bypassed for an audited business mutation that is required to pass through the gateway.

After a stop, preserve logs and state, mark the active test `FAIL` or `BLOCKED`, create an incident entry, and do not resume until the QA lead authorizes a new isolated run.

## 7. Roles and control

One person may hold multiple roles, but each responsibility must be explicit.

| Role | Responsibility |
|---|---|
| QA lead | Freezes the build, controls phase order, assigns final status/severity, and signs the release verdict |
| Environment controller | Starts services, verifies test configuration, captures health and version evidence, and prevents configuration drift |
| Partner operator | Executes partner authentication, onboarding, event, ticket, attendee, order, and finance paths |
| Buyer operator | Executes guest and physical-Android buyer journeys |
| Data observer | Captures gateway, Firestore, Redis, and Razorpay evidence without changing business state |
| Evidence controller | Maintains the manifest, correlation ledger, defect ledger, coverage matrix, and redaction review |

Only one operator may control the physical Android device at a time.

## 8. Test identity and artifact contract

### 8.1 Run identity

Use:

```text
Run ID: PS-E2E-<YYYYMMDD>-<HHMM>-<short-commit>
Fixture prefix: E2E_<Run-ID>
Partner email/display name: E2E_<Run-ID>_PARTNER
Buyer A email/display name: E2E_<Run-ID>_BUYER_A
Buyer B email/display name: E2E_<Run-ID>_BUYER_B
Event title: E2E_<Run-ID>_EVENT
Ticket tier: E2E_<Run-ID>_TIER
```

Use dedicated test phone numbers or provider-approved test OTP identities. Never place OTP secrets in the report.

### 8.2 Artifact directory

Create one immutable directory per run:

```text
qa-artifacts/pre-staging-integration/<Run-ID>/
  00-manifest/
  01-authority/
  02-environment/
  03-automated-gates/
  04-service-health/
  05-auth-partner/
  06-event-lifecycle/
  07-discovery-parity/
  08-checkout/
  09-reconciliation/
  10-negative-security/
  11-resilience/
  12-device/
  13-cleanup/
  14-final-report/
```

### 8.3 File naming

```text
<CASE-ID>_<attempt>_<surface-or-layer>_<UTC-timestamp>.<ext>
```

Examples:

```text
PAY-VERIFY-01_A1_gateway_20260724T021533Z.log
PAY-VERIFY-01_A1_mobile_20260724T021540Z.png
PAY-VERIFY-01_A1_firestore_20260724T021548Z.json
```

### 8.4 Required manifest fields

- Run ID
- Git root, branch, local SHA, remote SHA, and dirty-state summary
- Build identifier and installation source
- Node, npm, Java, Android SDK, ADB, Expo, Docker, and Redis versions
- API gateway, partner, guest, Metro, and Redis addresses
- Firebase project ID, with secrets omitted
- Razorpay mode and public key fingerprint, with full key omitted
- Device serial, model, Android version, app ID, app version, and build profile
- QA account UIDs and roles
- Test event, tier, reservation, order, payment, ticket, entitlement, and scanner IDs
- Start/end timestamps
- Operator names or role labels

## 9. Evidence standard

### 9.1 Evidence layers

Each critical happy-path mutation requires:

1. `UI`: before, action, and resulting state.
2. `NETWORK`: request method, path, status, sanitized request/response, and request/correlation ID.
3. `GATEWAY`: matching log entry proving the request reached the API gateway.
4. `CORE`: service/operation identifier where observable.
5. `DATABASE`: before/after state and document identifiers.
6. `CACHE`: Redis key/TTL/lock state when inventory or checkout is involved.
7. `PROVIDER`: Razorpay test order/payment/webhook state for payment cases.
8. `CROSS-SURFACE`: matching result in every required application.

### 9.2 PASS rule

A critical test is `PASS` only if:

- the expected UI behavior occurred;
- the expected gateway request occurred exactly as designed;
- the authenticated principal and authorization decision are correct;
- persistence matches the request exactly once;
- all identifiers and monetary values reconcile;
- dependent surfaces show the same authoritative state;
- no unexpected error appears in application, gateway, device, or provider logs;
- evidence filenames and timestamps point to the same attempt.

Missing one mandatory evidence layer means `BLOCKED`, not `PASS`.

### 9.3 Correlation ledger

Maintain one row per attempt:

| Attempt | Request ID | UID | Partner/host ID | Event ID | Tier ID | Reservation ID | Internal order ID | Razorpay order ID | Razorpay payment ID | Ticket/entitlement ID | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|

All money must be reconciled using the smallest currency unit, including base price, quantity, subtotal, fees, taxes, discount, and final total.

## 10. Gate sequence

Gates are sequential. A failed or blocked hard gate prevents all dependent gates.

| Gate | Name | Hard exit requirement |
|---|---|---|
| G0 | Authority freeze | Exact local/remote commit match; intended source tree established; no alternate checkout in runtime path |
| G1 | Toolchain and configuration | One approved Node/toolchain contract; all non-production environment inputs validated |
| G2 | Clean dependency installation | Lockfile install completes in an isolated clean state; dependency provenance recorded |
| G3 | Automated release checks | Required lint, type-check, tests, builds, guardrails, and mobile release checks pass |
| G4 | Service topology | Redis, API gateway, partner, guest, Metro, Firebase, and Razorpay test connectivity are healthy |
| G5 | Identity and authorization | Required QA identities and roles authenticate; unauthorized controls fail closed |
| G6 | Event lifecycle | Partner event and ticket tier move through the canonical lifecycle and become public |
| G7 | Cross-surface discovery | Same event and ticket data appear consistently in guest and physical Android |
| G8 | Payment and issuance | Razorpay test transaction verifies server-side and issues exactly one order/ticket |
| G9 | Reconciliation | Mobile, guest, partner, Firestore, Redis, and provider state match |
| G10 | Negative/security | Tampering, duplicate, expiry, and cross-account cases fail safely |
| G11 | Resilience and recovery | Restart, offline, timeout, webhook delay, and relaunch behavior preserve truth |
| G12 | Cleanup and report | Test data disposition, evidence audit, defect ledger, and release verdict are complete |

## 11. Phase 0 — Gate G0: authority freeze

### Required checks

| ID | Check | Expected |
|---|---|---|
| AUTHORITY-01 | Record `pwd` and Git top level | Both point to the authoritative root |
| AUTHORITY-02 | Record branch | `pre-staging` |
| AUTHORITY-03 | Fetch remote without mutation and record local/remote SHA | SHAs match |
| AUTHORITY-04 | Record worktree list | Alternate worktrees identified and excluded |
| AUTHORITY-05 | Record tracked dirty state | No unapproved tracked modification |
| AUTHORITY-06 | Record untracked directories affecting scans/builds | Known and excluded from audited dependency/runtime path |
| AUTHORITY-07 | Review unresolved old-worktree intent differences | Every difference is accepted as superseded or separately logged |
| AUTHORITY-08 | Freeze commit and prohibit pulls/merges during run | Freeze acknowledged |

### Hard fail

- Local and remote SHAs differ.
- A tracked change is unexplained.
- A runtime path resolves into a nested or alternate checkout.
- The unresolved old-worktree review is incomplete.

## 12. Phase 1 — Gates G1 and G2: toolchain, secrets, and installation

### 12.1 Toolchain decision

The repository currently presents a conflict: `.nvmrc` and mobile scripts select Node 20, while GitHub workflows select Node 24. Before execution, the engineering owner must declare one approved version for this audit. The choice and rationale must be recorded; QA must not silently choose.

Record:

- Node and npm versions
- Lockfile hash
- CPU architecture
- Java and Gradle versions
- Android SDK/build-tools versions
- Expo CLI and SDK versions
- Docker and Redis versions

### 12.2 Configuration validation

Validate presence and non-production identity without printing secret values:

- `apps/api-gateway/.env.development`
- partner dashboard local/development configuration
- guest portal local/development configuration
- mobile development configuration
- Firebase Admin project identity
- mobile Firebase application identity
- Redis URL
- Razorpay test public key and server secret pairing
- webhook secret and reachable callback
- QR/ticket signing secret
- API base URLs
- CORS origins
- application environment and demo/showcase flags
- Sentry environment

### 12.3 Hard configuration rules

- Razorpay key must be test mode.
- Firebase project must be an approved QA/staging project.
- QR signing must not use a development fallback for staging proof.
- Mobile, guest, partner, and gateway must target the same approved environment.
- Demo/personal-fixture modes must be off for transaction proof.
- No local service may silently fall back to an old or production URL.
- No secret may be committed or copied into the report.

### 12.4 Installation acceptance

- Use the committed lockfile.
- Do not reuse dependencies from nested or parent directories.
- Record `npm` resolution and native binary architecture.
- Verify Next SWC loads natively.
- Verify no duplicate React/React Native/type-package identity is resolved from an external `node_modules`.
- Verify Expo native modules required by checkout are installed.

Any corrupted binary, duplicate dependency identity, missing native module, or external dependency resolution blocks G2.

## 13. Phase 2 — Gate G3: automated release checks

Run from the authoritative root using the approved toolchain.

### Required root checks

```text
npm run format:check
npm run lint
npm run stylelint:check
npm run type-check
npm test
npm run build
npm run guardrails:check
npm run test:guardrails
```

### Required workspace checks

```text
npm test -w packages/core
npm run type-check -w packages/core
npm run build -w packages/core
npm test -w apps/api-gateway
npm test -w apps/guest-portal
npm run type-check -w apps/guest-portal
npm test -w apps/partner-dashboard
npm run type-check -w apps/partner-dashboard
npm test -w apps/mobile-app -- --runInBand
npm run type-check -w apps/mobile-app
npm run lint -w apps/mobile-app
npm run doctor -w apps/mobile-app
npm run release:config:test -w apps/mobile-app
npm run launch:readiness -w apps/mobile-app
npm run release:android:inspect -w apps/mobile-app
npm run type-check -w apps/scanner-app
```

If a command is invalid for the approved environment, mark it `BLOCKED` and log the mismatch. Do not replace it with a weaker command and call it a pass.

### G3 exit criteria

- Zero failing required commands.
- Zero skipped critical suites.
- Zero unexpected warnings involving auth, payment, ticket signing, database, or release configuration.
- GitHub checks for the frozen SHA are green.
- Local results and remote results refer to the same SHA.

## 14. Phase 3 — Gate G4: service topology and gateway proof

### Required services

| Service | Default local target | Required proof |
|---|---|---|
| Redis | `127.0.0.1:6379` | `PING`, clean test namespace, TTL support |
| API gateway | `127.0.0.1:4000` | `/health`, `/api/v1/health`, startup logs |
| Guest portal | `127.0.0.1:3000` | rendered page, gateway-backed request |
| Partner dashboard | `127.0.0.1:3001` | rendered page, gateway-backed request |
| Metro | `127.0.0.1:8082` | bundle served to authorized device |
| Firebase | approved QA project | auth and Firestore connectivity |
| Razorpay | test environment | order API and webhook connectivity |

### Required topology assertions

1. Guest business operations terminate at the API gateway.
2. Partner business operations terminate at the API gateway.
3. Mobile business operations terminate at the API gateway.
4. The API gateway delegates business behavior to the canonical core layer.
5. Redis is used for checkout reservations/locks where designed.
6. Protected routes verify Firebase identity.
7. No audited client can directly create authoritative orders, payments, tickets, entitlements, finance, or inventory state.
8. A gateway outage produces an honest unavailable/error state, never mock success.

Capture a request from each surface and match it to the gateway log before G4 can pass.

## 15. Phase 4 — Gate G5: identity, session, and role matrix

### Identity fixtures

- Partner owner or authorized host
- Buyer A
- Buyer B
- Unauthenticated user
- Unrelated partner
- Scanner/operator role if scanner validation is in scope
- Admin/approver fixture if publication requires approval

### Required cases

| ID | Path | Expected |
|---|---|---|
| AUTH-01 | Partner registration/login | Correct Firebase identity and partner session |
| AUTH-02 | Partner onboarding | Canonical partner/host record persisted |
| AUTH-03 | Partner reload/logout/login | Session and role remain correct |
| AUTH-04 | Buyer A registration/login on Android | Firebase identity synced through gateway |
| AUTH-05 | Buyer A login on guest portal | Same intended user identity or documented separate identity |
| AUTH-06 | Buyer B registration/login | Isolated account and state |
| AUTH-07 | Protected API without token | `401`, no data |
| AUTH-08 | Invalid/expired token | `401`, no state mutation |
| AUTH-09 | Buyer calls partner endpoint | `403` or safe `404` |
| AUTH-10 | Partner calls unrelated partner resource | `403` or safe `404` |
| AUTH-11 | User switch on device | No prior user ticket/profile/cache leakage |
| AUTH-12 | Logout/relaunch | Protected state is unavailable |

## 16. Phase 5 — Gate G6: partner event lifecycle

Use one paid event with at least two ticket tiers and a deliberately small capacity suitable for reconciliation.

### Required lifecycle cases

| ID | Action | Required proof |
|---|---|---|
| EVENT-01 | Open create-event flow | Partner UI and authenticated gateway traffic |
| EVENT-02 | Enter title, description, media, date, venue, policy, and organizer data | UI values and submitted payload summary |
| EVENT-03 | Add Tier A and Tier B with capacity and price | UI, payload, smallest-unit price |
| EVENT-04 | Save draft | Gateway request, event ID, Firestore draft |
| EVENT-05 | Reload and edit draft | Persisted values match |
| EVENT-06 | Confirm draft is not publicly discoverable | Guest/mobile/API absence |
| EVENT-07 | Submit for approval or publish through canonical process | Lifecycle request and authorization |
| EVENT-08 | Execute required admin approval | Approver identity and transition evidence |
| EVENT-09 | Confirm public event read model | Public gateway response with same event ID |
| EVENT-10 | Confirm update propagation | Edited public-safe field matches across surfaces |
| EVENT-11 | Confirm unrelated partner cannot modify event | Denial and unchanged DB |
| EVENT-12 | Confirm invalid lifecycle transition fails | Denial and unchanged lifecycle |

Record every lifecycle timestamp and actor.

## 17. Phase 6 — Gate G7: discovery and data parity

### Guest portal

- Home/explore loads through the gateway.
- Search locates the exact QA event.
- Filters preserve correct inclusion/exclusion.
- Event detail shows the correct title, date, timezone, venue, organizer, media, tiers, price, fees, and availability.
- Refresh and new session show the same authoritative state.

### Physical Android

- Device is `authorized` in `adb devices -l`.
- Required reverse routes are recorded, including gateway and Metro.
- Native build launches; Expo Go is not accepted for native Razorpay proof.
- First-run/auth flow completes using real QA services.
- Explore locates the exact QA event.
- Event detail matches the guest portal and gateway.
- No demo or showcase data is mistaken for QA state.

### Parity table

For every displayed event/tier field, record:

| Field | Gateway | Firestore | Partner | Guest | Android | Result |
|---|---|---|---|---|---|---|

Any disagreement in identifier, lifecycle, price, capacity, availability, date/time, or venue is at least `P1`.

## 18. Phase 7 — Gate G8: Razorpay test checkout

Execute one full successful purchase from physical Android. If the guest portal supports purchase, execute an additional isolated guest-portal purchase with a different buyer or tier.

### Successful transaction cases

| ID | Action | Required evidence |
|---|---|---|
| CHECKOUT-01 | Select tier and quantity | UI and selected canonical tier ID |
| CHECKOUT-02 | Request server quote | Gateway request/response and full amount breakdown |
| CHECKOUT-03 | Reserve inventory | Reservation ID, Redis key/lock/TTL, DB reservation state |
| CHECKOUT-04 | Initiate order | Internal order ID and Razorpay test order ID |
| CHECKOUT-05 | Open native Razorpay | Physical-device screenshot/recording showing test mode |
| CHECKOUT-06 | Complete test payment | Razorpay test payment ID and provider state |
| CHECKOUT-07 | Verify server-side | Gateway verification request and signature result |
| CHECKOUT-08 | Issue order/ticket | Exactly one confirmed order and expected ticket quantity |
| CHECKOUT-09 | Refresh wallet | Ticket appears through canonical wallet API |
| CHECKOUT-10 | Relaunch app | Order and ticket survive relaunch |

### Transaction invariants

- Client price is never authoritative.
- Currency is consistent.
- Amounts match exactly in the smallest unit.
- The reservation belongs to the correct UID, event, tier, quantity, and attempt.
- The Razorpay order was created by the server in test mode.
- Payment verification occurs only on the server.
- One provider payment maps to one internal confirmed order.
- Ticket quantity equals purchased quantity.
- Inventory decreases exactly once by purchased quantity.
- Redis reservation/lock reaches the expected terminal state.
- Duplicate verification is idempotent.
- Failed verification issues no ticket and records no partner revenue.

## 19. Phase 8 — Gate G9: full reconciliation

### Cross-surface checks

| ID | Surface | Expected |
|---|---|---|
| RECON-01 | Mobile success state | Correct order, event, amount, quantity |
| RECON-02 | Mobile wallet | Correct ticket/entitlement and status |
| RECON-03 | Guest account orders/tickets | Correct order/ticket if the account owns the purchase |
| RECON-04 | Partner attendee list | Correct buyer and ticket quantity |
| RECON-05 | Partner orders | Correct internal/provider IDs and state |
| RECON-06 | Partner finance | Correct gross, fees, tax, discount, and net semantics |
| RECON-07 | Partner overview analytics | Expected before/after delta |
| RECON-08 | Firestore | Event, inventory, reservation, order, payment, entitlement/ticket records reconcile |
| RECON-09 | Redis | No stale active lock after terminal success |
| RECON-10 | Razorpay test dashboard/API | Order/payment state matches internal state |
| RECON-11 | Scanner | Valid ticket is recognized through the canonical token/entitlement path |
| RECON-12 | Second scan | Duplicate-use behavior follows policy and is recorded |

### Database audit

Capture sanitized before/after snapshots for the exact canonical documents involved. The data observer must confirm:

- ownership and tenant fields;
- event and tier linkage;
- provider identifiers;
- state-machine transitions;
- immutable versus mutable fields;
- created/updated/confirmed timestamps;
- quantities and inventory counters;
- price, fees, taxes, discounts, totals, and currency;
- ticket/entitlement status and QR/token metadata;
- absence of duplicate documents;
- absence of orphaned reservations or orders.

Do not infer collection names or record semantics. Record the actual canonical paths used by the frozen build.

## 20. Phase 9 — Gate G10: negative, authorization, and abuse tests

Each negative test requires proof of both rejection and absence of unauthorized state.

### Payment and inventory

| ID | Test | Expected |
|---|---|---|
| NEG-PAY-01 | Modify client amount | Server rejects/ignores it and uses canonical price |
| NEG-PAY-02 | Modify tier/event IDs | Request rejected; no cross-event purchase |
| NEG-PAY-03 | Invalid payment signature | Rejected; no ticket, revenue, or inventory decrement |
| NEG-PAY-04 | Reuse valid verification request | Idempotent result; no duplicate issuance |
| NEG-PAY-05 | Concurrent final-unit reservations | At most available capacity is sold |
| NEG-PAY-06 | Reservation expires before payment | Inventory/lock releases correctly |
| NEG-PAY-07 | Payment succeeds after local timeout | Recovery converges to provider/server truth |
| NEG-PAY-08 | Provider/webhook repeats | Idempotent state transition |
| NEG-PAY-09 | Abandon checkout | No confirmed order or ticket |
| NEG-PAY-10 | Network drops during verification | Retry/recovery does not duplicate |

### Authorization and tenancy

| ID | Test | Expected |
|---|---|---|
| NEG-AUTH-01 | Buyer A requests Buyer B order | `403`/safe `404`; no data |
| NEG-AUTH-02 | Buyer A requests Buyer B ticket | `403`/safe `404`; no data |
| NEG-AUTH-03 | Unrelated partner requests QA event finance | `403`/safe `404`; no data |
| NEG-AUTH-04 | Unrelated partner edits QA event | Rejected; event unchanged |
| NEG-AUTH-05 | Buyer calls publish/approval operation | Rejected |
| NEG-AUTH-06 | Expired/revoked token calls protected API | `401`; no state mutation |
| NEG-AUTH-07 | Raw object/document ID guessing | No cross-user or cross-tenant disclosure |
| NEG-AUTH-08 | Scanner without correct role | Rejected |

### Validation and lifecycle

| ID | Test | Expected |
|---|---|---|
| NEG-VAL-01 | Malformed body | Structured validation error |
| NEG-VAL-02 | Negative/zero/unsafe quantity | Rejected |
| NEG-VAL-03 | Unsafe integer money value | Rejected |
| NEG-VAL-04 | Draft event public access | Hidden or denied |
| NEG-VAL-05 | Past/non-saleable event checkout | Rejected |
| NEG-VAL-06 | Sold-out tier checkout | Rejected without oversell |
| NEG-VAL-07 | Invalid lifecycle transition | Rejected; state unchanged |
| NEG-VAL-08 | Gateway unavailable | Honest error; no fake success |

## 21. Phase 10 — Gate G11: resilience, restart, and observability

### Required resilience cases

1. Restart guest and partner frontends; sessions recover or fail honestly.
2. Restart API gateway between read operations; clients recover without fabricated state.
3. Restart gateway during a controlled checkout before provider payment.
4. Simulate Android offline before quote, during reservation, and after provider success.
5. Background and foreground the Android app during checkout.
6. Kill and relaunch the app with a pending transaction.
7. Delay provider callback/webhook in the approved test mechanism.
8. Confirm duplicate webhook delivery remains idempotent.
9. Confirm expired reservation cleanup and cart edit/retry behavior.
10. Confirm Redis restart behavior does not create false availability or duplicate purchase.
11. Confirm errors contain a trace/correlation identifier suitable for support.
12. Inspect Android logs for fatal exceptions and ANRs.
13. Inspect gateway/frontend logs for unhandled rejections, secret leakage, and raw stack traces exposed to clients.

Any resilience test that could create ambiguous payment state must use a fresh attempt and must be fully reconciled before the next test begins.

## 22. Phase 11 — mobile device quality requirements

The payment journey is not complete until it is proven on the authorized physical Android device.

### Mandatory device evidence

- `adb devices -l` showing `device`, not `unauthorized`
- `adb reverse --list`
- App ID/version/build profile
- Metro connection
- API gateway reachability from the device
- Screen recording of discovery through checkout completion
- Scoped device logs covering the same timestamps
- Relaunch persistence
- Offline/recovery behavior
- No fatal exception or ANR

### Explicit limitations

- Expo Go is insufficient for native Razorpay proof.
- Emulator-only execution is insufficient for Android release confidence.
- Android evidence cannot prove iOS readiness.
- A development bundle cannot prove release-signing, production manifest, deep-link, push, or store-delivery behavior.

## 23. Phase 12 — Gate G12: cleanup and final report

### Test-data cleanup

Cleanup is a test, not an informal delete step.

1. List every QA-created identity and resource.
2. Define whether each resource must be retained for defect investigation or removed.
3. Use normal supported lifecycle/delete operations where available.
4. Never manually delete financial/audit records merely to make the database look clean.
5. Record cleanup request, response, DB result, and remaining provider state.
6. Confirm no active Redis reservation/lock remains.
7. Confirm retained fixtures are labeled and isolated.

### Final report contents

1. Executive verdict: `GO`, `CONDITIONAL GO`, or `NO-GO`
2. Frozen commit/build/environment identity
3. Gate results G0–G12
4. Full path coverage matrix
5. Defect ledger sorted by severity
6. Blocked and untested risk register
7. Transaction correlation ledger
8. Money and inventory reconciliation
9. Gateway-boundary proof
10. Database and Redis evidence index
11. Physical-device evidence index
12. Security/negative-test results
13. Cleanup ledger
14. Promotion recommendation and exact blockers

### Defect record template

```text
Defect ID:
Title:
Severity:
Status:
Environment:
Commit/build:
Account/role:
Event/order/ticket IDs:
Preconditions:
Steps:
Expected:
Actual:
Frequency:
First observed:
Last reproduced:
UI evidence:
Network/gateway evidence:
Database/Redis/provider evidence:
Security/data/payment impact:
Dependent cases:
Workaround:
Owner:
```

## 24. Promotion policy

### Automatic NO-GO

- Any open `P0` or `P1`
- Any blocked critical path
- Any unproven server-side payment verification
- Any unresolved amount or inventory mismatch
- Any duplicate order, ticket, entitlement, revenue, or inventory transition
- Any unproven authorization boundary
- Any audited business mutation bypassing the required API gateway
- Any use of production data or credentials
- Any missing physical-Android checkout proof
- Any environment or commit drift
- Any missing database/Redis reconciliation

### Conditional GO

Allowed only when:

- zero `P0` and zero `P1`;
- every critical path is `PASS`;
- every payment, authorization, inventory, and persistence case is `PASS`;
- remaining findings are `P2`/`P3` with documented scope, owner, acceptance, and rollback;
- no `BLOCKED` case can affect launch safety;
- QA lead and engineering owner both sign the exception list.

### GO

Requires:

- G0–G12 all `PASS`;
- 100% critical-path coverage;
- 100% required evidence coverage;
- zero open `P0`/`P1`;
- zero unexplained `P2`;
- zero critical `BLOCKED` or `INVALIDATED` tests;
- exact transaction and inventory reconciliation;
- successful physical-device proof;
- approved cleanup state;
- repeatable green automated gates for the frozen SHA.

## 25. Promotion sequence after audit

1. Close the audit and review every defect.
2. Create a separate remediation plan.
3. Fix approved defects in controlled changes.
4. Run focused regression for each fix.
5. Repeat G0–G12 on the new frozen `pre-staging` SHA.
6. Promote exact SHA from `pre-staging` to `staging`.
7. Repeat automated gates and critical E2E against deployed staging.
8. Run a staging soak with monitoring and provider webhooks.
9. Approve rollback procedure and release owner.
10. Promote exact approved staging SHA to `main`/production.
11. Run non-destructive production smoke checks.
12. Monitor payment, ticket issuance, inventory, auth, and error telemetry.

No environment may be promoted on the strength of a report from a different commit.

## 26. Current known blockers to clear before execution

These are inherited audit observations and must be revalidated at the start of the run:

1. Local runtime configuration files were absent.
2. The Android device was connected but unauthorized.
3. The installed Next SWC native binary was unreadable.
4. Local dependency resolution showed duplicate or external type identities.
5. Mobile native/type dependencies were not reproducible in the dirty local installation.
6. The Node contract conflicts between `.nvmrc`/mobile scripts and CI workflows.
7. QR signing used a development fallback in an earlier automated staging gate.
8. Root-wide guardrail scanning was affected by untracked recovery/backup trees.
9. Guest gateway-unavailable responses were less structured than partner responses.
10. Final intent review of older differing mobile worktree files remained outstanding.

Clearing a blocker means proving the prerequisite now works. It does not mean fixing product defects during the audit.

## 27. Execution start checklist

The QA lead must check every item before authorizing G0:

- [ ] Engineering owner confirms the authoritative `pre-staging` commit.
- [ ] Old-worktree intent review is signed off.
- [ ] Approved Node/toolchain version is declared.
- [ ] Approved Firebase QA/staging project is identified.
- [ ] Razorpay test credentials and test webhook are available.
- [ ] QR signing secret is configured without fallback.
- [ ] Partner and buyer QA identities are available or may be created.
- [ ] Admin approval role is available if required.
- [ ] Physical Android is connected, unlocked, and ADB-authorized.
- [ ] Second isolated buyer session/device is available for cross-account tests.
- [ ] Evidence storage location has sufficient space.
- [ ] Production hosts, keys, and data are explicitly excluded.
- [ ] Audit-only boundary is acknowledged.
- [ ] Stop conditions are acknowledged.
- [ ] No code/config/deployment changes are scheduled during the run.

If any box remains unchecked, the audit may perform read-only diagnostics but may not start mutating end-to-end tests.
