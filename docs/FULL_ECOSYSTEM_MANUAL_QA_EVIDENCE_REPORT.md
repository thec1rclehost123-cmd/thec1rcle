# THE C1RCLE Full Ecosystem Manual QA Evidence Report

## 1. Audit control

| Field | Evidence |
|---|---|
| Audit started | 2026-07-25T18:17:13Z |
| Authoritative checkout | `/Users/aayushdivase/Desktop/thec1rcle` |
| Branch | `codex/full-ecosystem-launch-qa` |
| Frozen remediation source SHA | `aea059421d4808c5b070524d02216493da555cbe` |
| Integrated upstream baseline | `origin/pre-staging` at `7eadeabb96230a1606e44ef7a9479f06e7528395` |
| Required runtime | Node 20 LTS / npm 10.8.2 |
| Evidence rule | No observed evidence means no PASS |
| Current launch verdict | **NO-GO — QA execution in progress on re-frozen baseline** |

The worktree contained a pre-existing modification to
`apps/guest-portal/next-env.d.ts` and multiple untracked archive/recovery
directories before this run. The audit does not treat those artifacts as QA
changes and will not modify or delete them.

### Baseline drift and re-freeze

The audit originally started at
`ef354d5eeda2e563de56b8785b8111b37d953532`. While live QA was in progress,
local and remote `pre-staging` advanced to
`bce259da564bf2c66de2cef8252b0e7930fa5de6` through the commit
`style: fix prettier formatting across 25 files`. All remaining evidence is
controlled by the newer SHA. Automated gates are being rerun because results
from the earlier SHA cannot authorize promotion of the current branch.

### Resume authority checkpoint — 2026-07-27

- Protected the uncommitted QA remediation state on
  `codex/full-ecosystem-launch-qa` at base SHA
  `bce259da564bf2c66de2cef8252b0e7930fa5de6`.
- Refreshed `origin/pre-staging`; it has advanced to
  `7eadeabb96230a1606e44ef7a9479f06e7528395` through nine additional commits.
- The QA remediation patch was checkpointed with the repository's real
  pre-commit hook, then rebased onto that upstream baseline. Upstream overlaps
  in:
  - `apps/api-gateway/src/routes/v1/partners/venues.ts`
  - `apps/api-gateway/src/routes/v1/venues.ts`
  integrated cleanly without merge conflicts.
- The resulting frozen remediation source is
  `aea059421d4808c5b070524d02216493da555cbe`.
- The hook received only the 53 reviewed staged source, test, documentation,
  script, and manifest files. It did not enumerate or scan `node_modules`,
  quarantined dependencies, backup checkouts, or raw QA runtime artifacts.
- Post-rebase validation on the frozen remediation source:
  - root type-check: `9/9` packages passed;
  - root tests: `7/7` configured workspaces passed;
  - no merge-conflict markers remained in the integrated files.
- An earlier attempt ran the full root type-check and test graph concurrently.
  Partner and Gateway tests timed out under local CPU/memory contention. That
  run is classified as invalid environmental evidence, not a product failure.
  Every affected suite passed when rerun sequentially, and the full sequential
  root graph then exited zero.
- Current G0 status: **IN PROGRESS — source SHA frozen and upstream integrated;
  exhaustive manifest execution/classification is still incomplete**.

## 2. Frozen journey matrix

| ID | Journey | Required evidence | Status |
|---|---|---|---|
| QA-AUTO-01 | Root type-check | Node 20 command output; all workspaces; zero errors | PASS |
| QA-AUTO-02 | Root tests | Node 20 command output; all configured workspaces; zero failures | PASS |
| QA-ENV-01 | Android USB authorization | `adb devices -l`, model and authorization state | PASS |
| QA-ENV-02 | Redis connectivity | `redis-cli PING` | PASS |
| QA-ENV-03 | Local Gateway | Health response and startup log on port 4000 | PASS |
| QA-ENV-04 | Guest Portal | Browser and HTTP proof on port 3000 | PASS |
| QA-ENV-05 | Partner Dashboard | Browser and HTTP proof on port 3001 | PASS |
| QA-AUTH-01 | Guest email/password | Account, session, reload persistence | PASS |
| QA-AUTH-02 | Guest OTP | OTP dispatch and verified session | PASS with QA-only OTP control logged below |
| QA-AUTH-03 | Partner Venue | Signup/login, onboarding, membership | PASS |
| QA-AUTH-04 | Partner Host | Signup/login, onboarding, membership | PASS |
| QA-AUTH-05 | Partner Promoter | Signup/login, onboarding, membership | PASS |
| QA-AUTH-06 | Workspace switching | Venue and Host membership switch | Pending |
| QA-AUTH-07 | Android onboarding | Physical-device profile, photos, vibes, vitals, preferences | Partial PASS — canonical first-run flow passed; photo/vitals/edit-profile proof pending |
| QA-EVENT-01 | Create and publish | V2 wizard, two tiers, authoritative event ID | PASS |
| QA-EVENT-02 | Guest propagation | Event, image, lifecycle, prices, availability | PASS |
| QA-EVENT-03 | Mobile propagation | Same event and tier contract on Android | Partial PASS — title, image, venue, ₹499 floor, lifecycle, and 21:00 IST render passed; checkout tier selection remains pending |
| QA-PAY-01 | Guest or Mobile purchase | Reservation timer, Razorpay test capture, confirmation | Pending |
| QA-PAY-02 | Atomic fulfillment | Order, tickets, entitlements, inventory, ledger, outbox | Pending |
| QA-WALLET-01 | Mobile wallet | Purchased units visible and owned by QA Guest | Pending |
| QA-WALLET-02 | Rotating QR | Signed payload rotates at 15 seconds without flicker | Pending |
| QA-SCAN-01 | Door admission | Authorized device/staff; atomic 2/2 consumption | Pending |
| QA-SCAN-02 | Replay denial | Re-scan returns explicit already-consumed refusal | Pending |
| QA-COVER-01 | Cover Wallet issuance | Paid cover package atomically issues exact wallet value | Blocked — provider capture not completed |
| QA-COVER-02 | Cover debit lifecycle | Bound session; debit/replay/velocity/state controls | Partial PASS — live synthetic wallet lifecycle only |
| QA-COVER-03 | Cover supervisor controls | PIN, role, reverse, top-up, freeze, unfreeze | PASS through live Gateway/Core lifecycle |
| QA-COVER-04 | Cover guest privacy | Balance/history visibility flags | PASS through live authenticated API |
| QA-COVER-05 | Cover physical Scanner | Installed app, assigned event/session, camera, online-only debit | Partial — live camera proven; QR debit unavailable |
| QA-COVER-06 | Cover reconciliation | Core replay, stored report, Partner and Guest agree to paise | Partial — live Core/Gateway difference is zero; UI/payment proof pending |
| QA-FIN-01 | Overview KPIs | Sold count and gross revenue update with measured latency | Pending |
| QA-FIN-02 | Canonical ledger | Exact paise reconciliation and partner balance | Pending |
| QA-FIN-03 | Attendee operations | QA Guest visible with correct check-in state | Pending |
| QA-PROMO-01 | Referral attribution | Link click, order attribution, conversion | Pending |
| QA-PROMO-02 | Commission ledger | Exact server-owned commission posting | Pending |
| QA-PERF-01 | Partner interactions | Measured tab-switch latency and responsiveness | Pending |
| QA-PERF-02 | Guest delivery | HTTP timings and optimized image responses | Pending |
| QA-PERF-03 | Android rendering | Physical-device frame timing evidence | Pending |

## 3. Prerequisite evidence

### QA-MANIFEST-01 — Exhaustive source-surface inventory

- Added a deterministic generator:
  `scripts/generate-launch-surface-manifests.mjs`.
- The generator scans only explicit application source roots and excludes
  `node_modules`, dependency quarantines, builds, caches, native build trees,
  and backup checkouts.
- Generated coverage:
  - Partner Dashboard: 328 rows (120 pages, 208 BFF routes).
  - Guest Portal: 55 rows (34 pages, 21 BFF routes).
  - Mobile App: 109 rows (95 screens, 14 layouts).
  - Scanner App: 9 rows (7 screens, 2 layouts).
  - Gateway: 543 rows (523 declared routes, 20 modules requiring review).
  - Frontend-to-endpoint references: 299 rows.
- Total source coverage rows: 1,343.
- Current status: all rows are `PENDING` until persona, auth, action, endpoint,
  negative, recovery, and evidence classifications are populated and executed.
- Validation: every generated JSON artifact parsed successfully; zero generated
  rows referenced `node_modules`, backup module trees, or `.nosync`.
- Evidence:
  - `qa-artifacts/manifests/coverage-summary.json`
  - the six route/endpoint manifests in `qa-artifacts/manifests/`
- Verdict: **PASS for source discovery; execution coverage remains pending.**

### QA-ENV-01 — Physical Android device

- Command: `adb devices -l`
- Observed device: `RF8N3166GEW`
- Model: `SM_G980F`
- Transport: USB
- Authorization state: `device`
- Verdict: **PASS**

### QA-ENV-02 — Redis

- Observed listener: `127.0.0.1:6379`
- Command response: `PONG`
- Docker Desktop daemon: not running at audit start.
- Local Redis is available independently of Docker.
- Verdict: **PASS for local Redis connectivity**

### QA-ENV-06 — Toolchain

- Shell default: Node `v25.1.0`, npm `11.6.2`
- Repository contract: Node `20`, npm `10.8.2`
- Approved binaries found: Node `v20.20.2`, npm `10.8.2`
- Execution decision: all release checks and application processes must be
  launched with `/opt/homebrew/opt/node@20/bin` first in `PATH`.
- Verdict: **PASS with explicit Node 20 path; default shell remains non-compliant**

### QA-ENV-07 — Staging configuration

- The authoritative root checkout has no runtime `.env.development` files.
- An existing ignored runtime checkout contains matching `c1rcle-staging`
  Firebase configuration and Razorpay test-mode credentials.
- Required server credentials were presence-checked without printing values.
- Runtime decision: load those ignored staging environment files into root
  processes without committing or reporting secrets.
- Verdict: **PASS for configuration presence; live connectivity still unproven**

## 4. Automated gate evidence

### QA-AUTO-01 — Root type-check

- Command: `npm run type-check`
- Toolchain: Node `v20.20.2`, npm `10.8.2`
- Frozen source: `aea059421d4808c5b070524d02216493da555cbe`
- Turbo result: `9 successful, 9 total`
- Errors: `0`
- Execution policy: run sequentially from the repository root so the result is
  not distorted by a concurrent full test graph.
- Verdict: **PASS**

### QA-AUTO-02 — Root test orchestration

- Command: `npm test`
- Toolchain: Node `v20.20.2`, npm `10.8.2`
- Frozen source: `aea059421d4808c5b070524d02216493da555cbe`
- Turbo result: `7 successful, 7 total`
- Failed suites: `0`
- Mobile evidence: `51` suites and `409` assertions passed.
- Core evidence: `35` files and `215` assertions passed, including `30` Cover
  Charge engine assertions.
- Gateway evidence: `34` files and `175` assertions passed, including the
  existing Cover Charge security suite.
- Partner evidence: `13` files and `38` assertions passed.
- Focused post-contention proof: Partner `5` files / `11` assertions and
  Gateway `2` files / `24` assertions passed sequentially before the full root
  rerun.
- The run emitted expected negative-path logs from mocked Redis, provider,
  boundary, and error-state tests. The root command exited zero.
- Verdict: **PASS for the configured root test graph**

## 5. Live runtime and workflow evidence

### QA-RUNTIME-01 — Clean production-mode surface health

- Guest Portal: `GET http://localhost:3000/explore` returned `200` in
  `186.796ms`.
- Partner Dashboard: `GET http://localhost:3001/` returned `200` in `32.844ms`.
- API Gateway: `GET http://localhost:4000/health` returned `status=ok` with
  Firestore `healthy` and Redis `healthy`.
- Firebase environment reported by the Gateway: `c1rcle-staging`.
- Runtime mode note: the two Next.js applications are running their clean
  production builds. The Gateway remains in development/watch mode so narrowly
  scoped QA fixes can be validated without restarting the entire test stack.
- Verdict: **PASS for process reachability and dependency health.** This is not
  yet a PASS for authenticated journeys or cross-surface business workflows.

### QA-AUTH-LIVE-01 — Guest signup and session creation

- Executed the actual Guest Portal signup UI twice in isolated Chrome sessions:
  `qa_guest_2026@test.c1rcle.com` and
  `qa_guest_secondary_2026@test.c1rcle.com`.
- Both journeys called the real OTP send, OTP verification, registration, and
  session-establishment routes. The primary run completed in approximately
  `24.6s`; the secondary run completed in approximately `23.9s`.
- The primary registration response completed in approximately `5.1s` and
  navigation ended on the new authenticated profile.
- Session and CSRF cookies were present after registration.
- Screenshots and network summaries are stored under
  `qa-artifacts/guest-signup-journey` and
  `qa-artifacts/guest-signup-qa_guest_secondary_2026`.
- Verdict: **PARTIAL PASS.** Real account/session creation is proven. Reload
  persistence, logout/revocation, password login, and negative credential tests
  remain in the active Guest authentication gate.

### QA-AUTH-LIVE-02 — Partner role onboarding and tagged fixtures

- Executed the Partner Dashboard onboarding UI for the exact Venue, Host, and
  Promoter QA emails.
- Venue onboarding initially reproduced the KYC proxy 401. After the scoped
  proxy correction and production rebuild, the same account resumed its
  existing onboarding state, uploaded both required KYC artifacts with 200
  responses, and submitted successfully.
- Host and Promoter completed email OTP, phone OTP, account creation, KYC
  uploads, and onboarding submission through the UI.
- After the real onboarding submissions, a staging-only fixture script approved
  the three exact tagged QA partner applications and created the Door Staff
  membership required for scanner testing. It did not approve arbitrary users.
- Exact fixture identities:
  - Venue owner: `qa_venue_2026@test.c1rcle.com`,
    partner `venue_tEnPagMv`.
  - Host owner: `qa_host_2026@test.c1rcle.com`,
    partner `host_89zVPTET`.
  - Promoter: `qa_promoter_2026@test.c1rcle.com`,
    partner `promoter_ACKUnmLK`.
  - Door staff: `qa_door_2026@test.c1rcle.com`, assigned to
    `venue_tEnPagMv` with scan permission.
- All records are tagged `[QA-TEST-2026]`; fixture IDs are retained for final
  cleanup.
- Evidence is stored under `qa-artifacts/partner-onboarding-venue`,
  `qa-artifacts/partner-onboarding-host`, and
  `qa-artifacts/partner-onboarding-promoter`.
- Verdict: **PARTIAL PASS.** Account creation, onboarding persistence, KYC
  submission, memberships, and role login are proven. Full role navigation,
  authorization matrices, and organization switching remain active.

### QA-GUEST-LIVE-01 — Corrected authentication and public navigation

- Executed the primary Guest account's canonical email/password login through
  the production build. The login route returned 200 without calling the
  retired `/api/v1/auth/check` route.
- Proved authenticated profile and ticket-wallet access, reloaded the browser,
  and confirmed that the session persisted.
- Executed logout, confirmed the session and CSRF cookies were cleared, checked
  that `/api/v1/auth/me` returned `authenticated: false`, and proved that the
  protected `/profile` route redirected to `/login`.
- Reran eleven public journeys with a strict runner that fails on navigation
  errors, API failures, resource failures, console errors, page errors, route
  mismatches, or missing expected content:
  `/explore`, event detail, anonymous queue protection, public Host profile,
  public Venue profile, Venue menu, Host/Venue directories, About, Privacy, and
  Terms.
- All `11/11` public journeys returned their expected 200/redirect behavior
  with zero API failures, zero resource failures, zero console errors, and zero
  page errors.
- Evidence:
  - `qa-artifacts/guest-login-session/result.json`
  - `qa-artifacts/guest-public-navigation/result.json`
  - screenshots under the corresponding artifact directories.
- Verdict: **PASS for Guest authentication/session lifecycle and the tested
  public navigation set.** Authenticated queue, checkout, wallet mutations, and
  commerce recovery remain covered by their dedicated journeys.

### QA-PARTNER-LIVE-01 — Role navigation defect discovery

- Isolated Venue, Host, and Promoter browser sessions successfully authenticated
  against the production-mode Partner Dashboard and loaded their role shells.
- Venue navigation proved Events, Payouts, Orders, Guest Operations, Staff, and
  Settings pages reachable, and exposed two protected tables calls returning
  401.
- Host navigation proved Overview, Events, Analytics, Team, and Settings
  reachable, and exposed the shared Studio Venue-route error, payout-config
  split authentication, the unimplemented transfer dialog, and an unavailable
  canonical finance projection.
- Promoter navigation proved Overview, Events, Links, Analytics, Finance,
  Guests, and Settings reachable, and exposed payout-history 429 responses
  caused by the global five-request IP limiter.
- These runs are defect-discovery evidence, not final PASS evidence. The
  production build must be regenerated from the corrected source and every role
  route rerun in isolated pages.

### QA-PARTNER-LIVE-02 — Corrected production role navigation

- Rebuilt the complete Partner Dashboard in production mode after the scoped
  auth, routing, finance, tables, and payout-control corrections.
- Reran every role in a separate authenticated browser context and opened every
  page in its own isolated tab so delayed requests could not contaminate the
  next route's evidence.
- Venue: all `59` filesystem-discovered renderable routes returned 200 with
  zero API failures, console errors, page errors, or broken images in
  `244,951 ms`. The slowest page was `/venue/analytics/live` at `5,443 ms`.
  `/venue/staff/profiles/[profileId]` remains explicitly untested because the
  staging account has no authoritative staff-profile fixture.
- Host: all `27` filesystem-discovered renderable routes returned 200 with zero
  API failures, console errors, page errors, or broken images in `109,463 ms`.
  The slowest page was `/host/ops` at `4,030 ms`.
  `/host/events/[id]` and `/host/events/[id]/analytics` remain explicitly
  untested because the new QA Host has no Host-owned event fixture.
- Promoter: all `21` filesystem-discovered renderable routes returned 200 with
  zero API failures, console errors, page errors, or broken images in
  `351,156 ms`. `/promoter/finance/payouts` redirected to the canonical
  `/promoter/payouts` route as required.
  `/promoter/events/[assignmentId]` remains explicitly untested because the QA
  Promoter has no authoritative assignment fixture.
- Host finance's final regression depended on QA-EDIT-08 and returned the
  legitimate zero canonical balance for the new Host, not a raw-order fallback.
- Evidence:
  - `qa-artifacts/partner-login-venue/result.json`
  - `qa-artifacts/partner-login-host/result.json`
  - `qa-artifacts/partner-login-promoter/result.json`
- Verdict: **FUNCTIONAL PASS / PERFORMANCE AND FIXTURE EVIDENCE INCOMPLETE.**
  The exhaustive render matrix is clean, but `/promoter/analytics` measured
  `46,679 ms` in the browser run and is not accepted as performance-ready.
  Dynamic Host event, Promoter assignment, and Venue staff-profile journeys
  remain gated by authoritative fixtures. Individual create/edit/mutation
  workflows remain gated by their dedicated journeys.

### QA-EVENT-LIVE-01 — Venue creation, publication, and Guest propagation

- Executed the production `CreateEventWizardV2` as the tagged Venue owner,
  including venue calendar selection, time selection, image crop/upload, event
  identity, description, settings, two ticket tiers, promoter compensation,
  review, and publication.
- Authoritative event:
  `d6b896a2-9f8c-4c27-89f1-33930aab64bd`.
- Title: `[QA-TEST-2026] Launch E2E 1785069125016`.
- Ticket tiers:
  - Early Bird: ₹499, quantity 100.
  - VIP: ₹999, quantity 50.
- The final publish command returned 200 and the public Gateway detail/list
  contracts returned the scheduled event with `priceMin=499`,
  `priceMax=999`, the exact two tiers, and the uploaded Firebase Storage poster.
- Guest Portal event detail rendered the title, venue, lifecycle, image,
  “Tickets start at ₹499”, Early Bird ₹499, and VIP ₹999.
- Guest Explore search returned exactly one matching card with “From ₹499” and
  linked it to the authoritative event ID.
- Evidence:
  - `qa-artifacts/partner-create-event/result.json`
  - `qa-artifacts/partner-create-event/pricing-repair.json`
  - screenshots under `qa-artifacts/partner-create-event`
  - `qa-artifacts/event-propagation/guest-event-detail.png`
  - `qa-artifacts/event-propagation/guest-explore-search.png`
- Verdict: **PASS for Venue creation/publication and Guest propagation.**
  Android propagation, checkout-time inventory authority, cancellation/edit
  convergence, and measured propagation SLA remain separate gates.

### QA-COVER-LIVE-01 — Cover Charge automated and live subsystem proof

- Focused Node 20 validation after the Cover Charge remediation:
  - Core: `5` files and `69` assertions passed.
  - Gateway/security: `5` files and `35` assertions passed.
  - Mobile Scanner/Guest-wallet mapping: `2` suites and `5` assertions passed.
  - Standalone Scanner: `4` assertions passed.
  - Core, Gateway, Mobile, Partner Dashboard, and Scanner type-checks all exited
    zero.
- A dry run of the termination timestamp migration against
  `c1rcle-staging` scanned four Cover Wallets, found zero invalid records and
  required zero updates. It did not mutate staging.
- Physical standalone Scanner evidence on Android `RF8N3166GEW`:
  - the debug APK installed and launched;
  - the tagged Door account authenticated;
  - the assigned Cover Charge event appeared;
  - the Gateway issued an event/venue/device-bound session with
    `canCharge=true`;
  - the event-scoped live camera screen opened.
- The live, authenticated Gateway/Core lifecycle used only tagged synthetic
  staging wallets and proved:
  - owner balance visibility and private-wallet balance/history redaction;
  - authorized Venue visibility of a private Guest wallet;
  - bound charge-session and by-order scope;
  - exact ₹500 debit from 50,000 to 45,000 paise;
  - same-UUID replay without a second mutation;
  - three permitted device debits and a fourth `429 VELOCITY_EXCEEDED`;
  - Door reversal refusal (`403`);
  - supervisor PIN configuration, invalid-PIN refusal (`401`), and exact
    reversal;
  - idempotent top-up;
  - freeze, frozen debit refusal (`423`), unfreeze, and post-unfreeze debit;
  - final balance of 45,000 paise with six immutable transactions;
  - reconciliation over four tagged wallets with a zero-paise difference and
    zero exceptions.
- The live lifecycle exposed and then verified the repair of a split authority:
  the Gateway correctly minted staff charge sessions, but Core attempted to
  validate only legacy event codes. Core now reads and validates the exact
  `scanner_auth_sessions/{sessionId}` record inside the transaction before
  permitting a staff debit.
- A real cover-enabled event propagated through Gateway and Guest Portal. A
  real quote, reservation, internal order, and Razorpay test order were also
  created with immutable host/venue attribution and a 50,000-paise Cover
  snapshot.
- The Razorpay payment was not captured. Therefore atomic provider-funded
  issuance of the order, ticket, entitlement, ledger rows, and Cover Wallet is
  **not proven**.
- A physical camera scan and physical offline debit could not be completed
  because the run had one USB device and no second display presenting the
  wallet QR. Automated UI tests prove the client refuses to submit while
  offline, but that is not physical-device E2E evidence.
- Observed live timings also fail the launch SLA: session mint and first debit
  each took approximately `5.6s`; reconciliation took approximately `3.3s`.
  No p95 claim is made from a single lifecycle.
- Evidence:
  - `qa-artifacts/mobile-manual-qa/cover-charge/core-tests.log`
  - `qa-artifacts/mobile-manual-qa/cover-charge/gateway-security-tests.log`
  - `qa-artifacts/mobile-manual-qa/cover-charge/mobile-scanner-tests.log`
  - `qa-artifacts/mobile-manual-qa/cover-charge/scanner-app-tests.log`
  - `qa-artifacts/mobile-manual-qa/cover-charge/typechecks.log`
  - `qa-artifacts/mobile-manual-qa/cover-charge/termination-backfill-dry-run.log`
  - `qa-artifacts/mobile-manual-qa/cover-charge/e2e-correlation.json`
  - `qa-artifacts/mobile-manual-qa/cover-charge/reconciliation.json`
  - `qa-artifacts/mobile-manual-qa/cover-charge/live-wallet-lifecycle/lifecycle.json`
  - screenshots under
    `qa-artifacts/mobile-manual-qa/cover-charge/device-and-offline-evidence`
- Verdict: **PARTIAL PASS / LAUNCH NO-GO.** The audited arithmetic, Core state
  machine, route security, live API mutations, privacy, idempotency, device
  velocity limit, and reconciliation pass. Provider-funded atomic issuance,
  physical QR debit/offline denial, Partner/Guest post-purchase UI convergence,
  and the required latency sample remain blocked or unproven.

### QA-MOBILE-LIVE-01 — Canonical Android bootstrap, first run, and realtime

- Device: physical Samsung `SM_G980F`, serial `RF8N3166GEW`, USB-authorized.
- Runtime transport: ADB reverse for Gateway `tcp:4000` and Metro
  `tcp:8082`; current root Mobile source bundle.
- Initial observed failures:
  - `POST /api/v1/auth/sync` returned 500 because the Gateway-imported Core
    `user-service` subpath was not exported.
  - `GET /api/v1/users/me/onboarding` and
    `GET /api/v1/users/me/subscription` returned 404 because the Mobile
    contracts had no Gateway/Core implementation.
  - Mobile requested `POST /realtime/session`, while the Gateway exposed
    `POST /api/v1/realtime/session`.
  - The authenticated WebSocket upgrade crashed because the handler used the
    removed `connection.socket` shape instead of the installed
    `@fastify/websocket` v11 direct socket argument.
  - Explore requested `contract=v2`, but the strict recommendations schema
    rejected the query with 400.
- Remediation proof:
  - Auth sync now returns 200 with canonical profile, onboarding,
    requirements, subscription, usage, and server-owned limits.
  - Subscription fetch returns 200; the free daily-like limit is 10 at both
    the Mobile display boundary and Core dating enforcement.
  - Physical-device first run completed:
    recovery-email skip → identity and 18+ date validation → Pune city →
    three nightlife tastes → discovery intent → Explore.
  - Every first-run mutation and final completion returned 200 through the
    authenticated Gateway/Core transaction path.
  - Relaunch persisted the completed state and returned directly to Explore.
  - Realtime session mint returned 200, the WebSocket upgrade remained open,
    and the Gateway recorded `Realtime client authenticated` for the physical
    device user.
  - The v2 recommendation request returned 200 with the item/reason envelope.
- Focused validation:
  - Core onboarding/subscription/export tests: `9/9` PASS.
  - Gateway recommendation contract tests: `2/2` PASS.
  - Mobile auth/realtime/recommendation tests: `25/25` PASS.
  - Core, Gateway, and Mobile affected type-checks: PASS.
- Performance observations:
  - Auth sync response: about 5.2–6.1 seconds end-to-end on cold local
    staging-backed startup.
  - First-run writes: about 1.9–2.4 seconds each.
  - Cold recommendation v2 response: about 7.9 seconds.
  - These timings are functional evidence, not a performance PASS.
- Evidence:
  - `qa-artifacts/mobile-manual-qa/runtime-contracts/mobile-canonical-bootstrap.png`
  - `qa-artifacts/mobile-manual-qa/runtime-contracts/mobile-onboarding-complete.png`
  - UIAutomator XML snapshots in the same directory
  - `qa-artifacts/mobile-manual-qa/runtime-contracts/android-canonical-bootstrap.log`
- Verdict: **FUNCTIONAL PASS / PERFORMANCE NO-GO.** Canonical bootstrap,
  subscription, first-run persistence, recommendation, and authenticated
  realtime now connect. Photo/vitals/edit-profile, chat subscription/message
  delivery, and performance gates remain pending.

### QA-MOBILE-EVENT-LIVE-01 — Physical Android event contract replay

- Opened authoritative event
  `d6b896a2-9f8c-4c27-89f1-33930aab64bd` through the installed Android
  development build on USB device `RF8N3166GEW`.
- The first replay exposed four disconnected runtime contracts:
  - event time rendered as `5:30 am` because the public projection emitted a
    date-only start instant;
  - `GET /api/v1/users/me/follows` returned 404;
  - `GET /api/v1/events/:id/interested` returned 404;
  - `POST /api/v1/users/me/recommendation-signals` returned 404.
- After QA-EDIT-21 through QA-EDIT-23, the same cold/reload journey rendered:
  - exact event title and Venue;
  - `Saturday, 29 August at 9:00 pm`;
  - the canonical ₹499 ticket floor;
  - no follow or interested-user error surface.
- Android network telemetry then recorded 200 for the follow list, interested
  users, recommendation signal, viewer state, wallet, and recommendation v2
  requests.
- Evidence:
  - `qa-artifacts/mobile-manual-qa/runtime-contracts/mobile-event-time-follow-fixed-live.png`
  - `qa-artifacts/mobile-manual-qa/runtime-contracts/mobile-event-time-follow-fixed-live.xml`
  - `qa-artifacts/mobile-manual-qa/runtime-contracts/android-event-contracts-after-fix.log`
- Performance remained outside launch quality: interested users took about
  0.99 seconds end-to-end, the signal mutation about 1.48 seconds, and the
  personalized recommendation response about 10.1 seconds.
- Verdict: **PARTIAL PASS.** Event display and the four runtime contracts are
  connected. Tier-selection checkout, captured payment, wallet issuance,
  scanning, and performance remain separate blockers.

## 6. Defects and blockers

| ID | Severity | Finding | Impact | Status |
|---|---|---|---|---|
| QA-BLOCK-01 | P1 | Docker Desktop daemon was not running at audit start. | `npm run docker:up` could not initially execute. Docker Desktop was subsequently started; the active QA stack intentionally uses the healthy native Redis instance on port 6379. | Mitigated for this run |
| QA-CONFIG-01 | P1 | Default shell is Node 25/npm 11 rather than repository-pinned Node 20/npm 10. | Commands run without explicit toolchain selection are not reproducible release evidence. | Mitigated for this run |
| QA-RUNTIME-01 | P0 | Gateway `/health` reported Redis `degraded` while the same host returned `PONG`. The lazy Gateway Redis client was never connected before its proxy suppressed commands. | Cache invalidation, realtime acceleration, and health evidence were not production-ready even though durable Firestore reads remained available. | Fixed locally; regression evidence captured |
| QA-AUTH-01 | P0 | Partner KYC BFF routes performed a second local Firebase Admin authentication check before proxying a valid Bearer token to the Gateway. The production-mode Partner server had no independent Admin credential and returned 401 for valid Venue, Host, and Promoter onboarding uploads. | Partner onboarding stopped at identity verification even though the canonical Gateway authentication boundary was healthy. | Fixed locally; route tests, type-check, and live resumed onboarding passed |
| QA-AUTH-02 | P0 | Venue tables called protected Partner APIs without a Bearer token. | The live Venue tables screen returned 401 for both table inventory and event selection. | Fixed; production rebuild and authenticated Venue regression passed |
| QA-AUTH-03 | P1 | Shared Studio event loading always called the Venue events API even for Host and Promoter roles. | Host analytics generated a cross-role 403 and could not reliably load the role's event selector. | Fixed; production rebuild and authenticated Host/Promoter regression passed |
| QA-FIN-UI-01 | P0 | Host and Venue finance exposed “Transfer Balance” dialogs that waited one second and displayed success without making a payout API request. Promoter finance exposed a Transfer button whose modal was permanently disabled in code. | A user could be shown a false financial-success state or a visible dead control. | Fixed by removing payout actions while payout mutations remain launch-disabled; production browser regression passed |
| QA-FIN-RATE-01 | P1 | The global Gateway limiter applied a five-requests-per-minute threshold to authenticated Promoter payout history GETs, keyed by IP before authentication. | Ordinary navigation and refresh produced 429 responses and shared the limit among users behind the same IP. | Fixed by restricting the high-risk threshold to payout mutations; live authenticated regression passed |
| QA-FIN-DATA-01 | P0 | A new Host finance account received `FINANCE_DATA_UNAVAILABLE`/503 because the finance overview bundled a disputes query whose required Firestore composite index was absent. | A zero-activity Host could not load finance even though canonical ledger balance reads were healthy. | Fixed locally; focused test and live 200 probe passed |
| QA-GUEST-AUTH-01 | P1 | Guest Login called the deliberately removed `/api/v1/auth/check` account-enumeration route before attempting canonical login. | Every valid login emitted a 404 and succeeded only through error fallback behavior. | Fixed; generated contract regenerated and live login/session regression passed |
| QA-GUEST-EVENT-01 | P1 | Guest event detail emitted `type: impression`, while the Gateway tracking schema rejected that Core-supported interaction type. | Every event-detail impression returned 400 and polluted browser telemetry. | Fixed; Core/Gateway tests and production browser regression passed |
| QA-GUEST-DATA-01 | P1 | Public event social proof exposed an Android `file://` avatar path stored on a user profile. | Web browsers attempted to load device-local paths and generated repeated security/resource errors. | Fixed by public HTTP(S)-only photo normalization; production browser regression passed |
| QA-GUEST-ASSET-01 | P1 | Guest Tickets and related surfaces depended on `https://grainy-gradients.vercel.app/noise.svg`, which returns 404. | Normal authenticated navigation emitted console errors and relied on an unowned third-party asset. | Fixed with a bundled static SVG; production browser regression passed |
| QA-GUEST-ASSET-02 | P1 | Guest About used Next Image with `/events/rave.jpg`, but that file did not exist in the public bundle. | About returned a 400 image optimization request and emitted a browser console error. | Fixed with the existing owned nightlife image; strict production browser regression passed |
| QA-EVENT-CALENDAR-01 | P0 | The Venue calendar excluded draft events while the event-creation conflict check counted them as blocking reservations. | The calendar presented a date as available, but the V2 wizard then rejected the same slot as overlapping; failed QA retries accumulated draft records. | Fixed with one shared blocking-lifecycle predicate; unit tests, Gateway type-check, and live creation passed |
| QA-EVENT-PRICE-01 | P0 | Event creation defaulted the persisted public price summary to zero and Guest discovery trusted that stale summary instead of authoritative ticket tiers. | A correctly configured ₹499/₹999 event propagated as a ₹0 event in public list/detail contracts. | Fixed at write and read boundaries; 10 focused Core assertions, Core/Gateway type-checks, canonical event repair, and live Guest UI passed |
| QA-EVENT-TIME-01 | P0 | Event creation stored date/time fragments without canonical instants, while the public read model published a date-only `startAt`. | The physical Android app rendered an intended 21:00 IST event as 05:30 IST and downstream lifecycle consumers could disagree on the event boundary. | Fixed at the writer and defensive read projection; 25 focused Core assertions and physical Android 21:00 render passed |
| QA-RELEASE-DATA-01 | P0 | The staging public event collection still contains 13 `demo-event-*` records and Guest Explore displays them beside real events. | Demo/showcase inventory is visible in a launch-candidate environment and violates the signed-build/demo-off invariant. | Open; requires ownership confirmation, tagged cleanup, cache invalidation, and zero-demo regression evidence |
| QA-COVER-01 | P0 | The standalone Scanner rewrote an explicit localhost Gateway URL to the Metro LAN host and called `/scan/*` outside the canonical `/api/v1` prefix. | A correctly ADB-reversed device could not establish the canonical scanner/charge session. | Fixed; Scanner security contract, type-check, installed-device login, event list, and bound session passed |
| QA-COVER-02 | P0 | Core Cover debit validation accepted only a legacy event code while the Gateway correctly issued `scanner_auth_sessions` for staff operators. | Every live staff Cover debit failed `CHARGE_CONTEXT_MISMATCH` after Gateway authorization. | Fixed; transactionally verified staff-session regression test and complete live debit lifecycle passed |
| QA-COVER-03 | P0 | Cover credit could exceed the effective paid tier value when configuration and discounts were combined. | The system could issue stored-value liability not funded by the ticket sale. | Fixed; checkout and publication reject unfunded cover liability and persist the paise snapshot |
| QA-COVER-04 | P0 | A real Razorpay Cover Charge order remains `payment_pending`; provider capture and atomic wallet issuance are unproven. | Launch cannot prove that paid value creates exactly one ticket, entitlement, ledger posting, and Cover Wallet. | Open provider/device blocker; synthetic wallet lifecycle is explicitly not payment proof |
| QA-COVER-05 | P0 | Physical QR debit and physical offline hard-denial were not executed because no second QR display was available. | Automated refusal does not prove the installed Scanner cannot accept or queue an offline real-device debit. | Open physical-device blocker |
| QA-COVER-06 | P1 | Live charge-session mint and first debit each took about 5.6 seconds. | Door/POS responsiveness exceeds the approved sub-3-second operational target. | Open performance blocker; ten-run p95 evidence required |
| QA-COVER-07 | P1 | The Cover expiry query requires the new Firestore composite index; repository configuration alone does not prove it is deployed. | Scheduled expiry/refund processing can fail in staging or production despite passing unit tests. | Open environment gate; dry-run data migration passed with zero invalid records |
| QA-MOBILE-AUTH-01 | P0 | Gateway auth sync dynamically imported `@c1rcle/core/user-service`, but Core did not export that runtime subpath. | Every authenticated Mobile startup failed with 500 before the user could enter the app. | Fixed; package-contract test and physical Android auth-sync 200 passed |
| QA-MOBILE-ONBOARD-01 | P0 | Mobile's canonical onboarding read/write routes had no Gateway/Core implementation and relied on 404 compatibility fallbacks/local state. | Onboarding persistence and completion could diverge across relaunches or devices. | Fixed with transactional Core service, strict Gateway schemas, fail-closed age/phone rules, and physical-device completion |
| QA-MOBILE-SUB-01 | P1 | Mobile called a missing subscription route and displayed a 10-like free limit while Core independently enforced 50. | Paywall state and server allowance disagreed, and startup logged an integration error. | Fixed; server-owned subscription context is shared with dating enforcement and live route returned 200 |
| QA-REALTIME-01 | P0 | Mobile requested `/realtime/session` outside the Gateway's `/api/v1` route. | No authenticated realtime session token could be minted; chat and live updates could not connect. | Fixed; Mobile contract test and physical-device session mint 200 passed |
| QA-REALTIME-02 | P0 | The Gateway WebSocket handler used the pre-v11 `connection.socket` shape against `@fastify/websocket` v11. | Every socket upgrade threw, entered a reconnect storm, and realtime chat/updates were unavailable. | Fixed; Gateway type-check and physical-device authenticated socket handshake passed |
| QA-REALTIME-03 | P0 | Gateway restart telemetry intermittently reports Redis pub/sub connection timeout and disables distributed broadcast. | A single-process socket may work while multi-instance chat and live-update fan-out silently diverge. | Open environment/runtime blocker; Redis pub/sub connectivity and multi-instance delivery proof required |
| QA-RECOMMEND-01 | P1 | Mobile requested the enabled `contract=v2` recommendation envelope while the strict Gateway schema rejected `contract` entirely. | Explore silently fell back to local recommendations after a 400 response. | Fixed; Gateway v2 contract tests, Mobile contract tests, and live Android 200 passed |
| QA-RECOMMEND-02 | P1 | Mobile posted category-browse signals to a missing route, and Core recommendations had no persisted browse-signal input. | Personalization silently discarded current-user browsing behavior. | Fixed with a strict authenticated route, deterministic Core aggregate, scorer integration, focused tests, and Android 200 proof |
| QA-MOBILE-FOLLOW-01 | P1 | Mobile requested a missing aggregate follow route and host toggles had no canonical bidirectional route. | Event/profile follow state logged 404 and could not survive relaunch consistently. | Fixed with one transactional Core follow graph, authenticated list/host/venue routes, 32 focused assertions, and Android 200 proof |
| QA-MOBILE-INTEREST-01 | P1 | Mobile requested a missing authenticated event-interested route despite an existing privacy-safe Core projection. | Event detail logged a 404 and could not populate social proof. | Fixed by exposing the existing Core projection through a strict route; focused tests and Android 200 proof passed |
| QA-PERF-04 | P1 | Staging-backed auth, onboarding, event, social-proof, wallet, and personalized recommendation requests take roughly 0.5–10.1 seconds with high variance. | First-run, Explore, event detail, and wallet do not meet launch-quality responsiveness or the operational SLA. | Open performance blocker; trace, query optimization, stable Redis, and ten-run p95 proof required |
| QA-MOBILE-WARN-01 | P2 | Mobile runtime reports deprecated SafeAreaView and React Native Firebase namespaced APIs, a BlurView missing its required blur target, and Reanimated layout/transform collisions. | These are forward-compatibility and visual-smoothness risks even though the tested journey completed. | Open; inventory and migrate without changing launch behavior |
| QA-MOBILE-LOCATION-01 | P2 | Event detail attempts native geocoding when location permission is not authorized and logs a rejected operation. | A normal permission-denied user receives avoidable warning telemetry and may miss derived location metadata. | Open; gate geocoding on permission and preserve event-provided coordinates/address |

### 🛠️ WORKAROUNDS & CODE EDITS APPLIED DURING QA

#### QA-WA-01 — Runtime configuration injection

- **Triggering Issue / Error:** The authoritative root checkout intentionally
  contains no `.env.development` files, so live services cannot boot directly.
- **Workaround Applied:** Loaded the ignored `c1rcle-staging` environment files
  from the existing `.nosync` runtime checkout into each process at launch.
  Secret values were neither printed nor copied into tracked files.
- **Files Modified:** None.
- **Original Behavior vs Post-Workaround Status:** Gateway and both Next.js
  surfaces could not initialize from the root checkout; after runtime-only
  injection, all three listened successfully on ports 4000, 3000, and 3001.

#### QA-WA-02 — Temporary local encryption key

- **Triggering Issue / Error:** Gateway startup failed closed with
  `ENCRYPTION_KEY environment variable is required`; the older staging runtime
  file predates that required variable.
- **Workaround Applied:** Passed a QA-local, process-only encryption key for
  this audit. It was not written to source or environment files.
- **Files Modified:** None.
- **Original Behavior vs Post-Workaround Status:** Gateway crashed during module
  initialization; after the process-only value, Firebase, repositories,
  services, and the HTTP server initialized. Existing encrypted financial
  values are not considered verified because the production/staging key was not
  supplied.

#### QA-WA-03 — Local browser-control fallback

- **Triggering Issue / Error:** The in-app browser returned
  `ERR_CONNECTION_REFUSED` for both `localhost` and the Mac LAN address while
  `curl` proved all local services reachable.
- **Workaround Applied:** Use the locally installed Chrome executable through
  an isolated QA browser context for localhost interaction, screenshots,
  network capture, and timing evidence.
- **Files Modified:** None.
- **Original Behavior vs Post-Workaround Status:** In-app browser UI automation
  could not begin. The local Chrome context can access the same host namespace
  as the services and keeps authentication isolated from the user's browser
  profile.

#### QA-EDIT-01 — Redis readiness and scanner fail-closed enforcement

- **Triggering Issue / Error:** Gateway health reported Redis `degraded` while
  the configured local Redis returned `PONG`. Inspection proved that
  `lazyConnect: true` was combined with a proxy that suppressed every command
  until the client was ready, leaving the client permanently disconnected.
  The scanner event-code route also skipped brute-force rate limiting whenever
  Redis failed.
- **Workaround Applied:** The Gateway Redis plugin now explicitly connects and
  pings before decorating Fastify, disables offline command queuing, and exposes
  rejecting fail-closed methods if initialization fails. Scanner event-code
  authentication now returns a retryable `503
  SCANNER_AUTH_RATE_LIMIT_UNAVAILABLE` rather than bypassing its limiter.
- **Files Modified:**
  - `apps/api-gateway/src/plugins/redis.ts`
  - `apps/api-gateway/src/routes/v1/scan.ts`
- **Original Behavior vs Post-Workaround Status:** Original Gateway health was
  permanently degraded and scanner authentication could run without its shared
  limiter. Post-edit validation must prove Redis `healthy`, successful cache
  commands, and scanner denial when Redis is unavailable.

Validation evidence:

- Gateway type-check: PASS.
- Gateway tests: `33` files and `163` tests passed.
- Live `/health`: `status=ok`, Firestore `healthy`, Redis `healthy`.

#### QA-WA-04 — Clean Guest incremental cache restart

- **Triggering Issue / Error:** `/explore` returned the application's 404 page
  even though `app/explore/page.js` existed and both generated app-path
  manifests contained `/explore/page`. The active Next process had remained
  alive while `pre-staging` advanced underneath it.
- **Workaround Applied:** Stopped only the Guest Portal dev process, moved its
  generated `.next` directory to
  `qa-artifacts/guest-next-cache-stale-20260726`, and restarted the Guest Portal
  from the re-frozen SHA.
- **Files Modified:** No source files. Generated cache was preserved as an
  artifact rather than deleted.
- **Original Behavior vs Post-Workaround Status:** `/explore` returned 404
  before the restart. The clean route returned 200. Its first development
  compile/fetch took `68.279s`; the warmed request returned 200 in `592.725ms`.
  The warmed Gateway event query returned 200 with five events in `8.431ms`.

#### QA-WA-05 — Replace unstable development shells with clean production builds

- **Triggering Issue / Error:** The isolated localhost Chrome session exposed
  stale development-runtime behavior: cross-origin HMR handshakes failed when
  the browser origin differed from Next's configured origin, a Guest
  authentication chunk returned 404, and the Partner shell remained on
  `AUTHORIZING ACCESS`. These symptoms were development-cache/runtime defects,
  not acceptable evidence of the compiled launch artifacts.
- **Workaround Applied:** Stopped only the Guest and Partner development
  processes, preserved their generated `.next` directories in
  `qa-artifacts/guest-next-dev-20260726` and
  `qa-artifacts/partner-next-dev-20260726`, built both applications cleanly with
  the staging runtime configuration under Node 20, and started them using
  `next start` on `localhost:3000` and `localhost:3001`.
- **Files Modified:** No source files. Only generated build/cache artifacts were
  replaced and the prior caches were preserved.
- **Original Behavior vs Post-Workaround Status:** The development browser
  shells could not produce trustworthy auth evidence. Both production builds
  completed successfully; Guest `/explore` and Partner `/` now return 200.
  Browser-level authentication and navigation evidence is the next active gate.

#### QA-WA-06 — Exact-account OTP control for local staging QA

- **Triggering Issue / Error:** The staging runtime has no Resend credential, so
  the real email OTP endpoint creates a challenge but cannot deliver the code to
  the dedicated test mailbox.
- **Workaround Applied:** The automation first called the real OTP-send route.
  For only the exact `qa_*@test.c1rcle.com` accounts listed in this report, the
  QA harness replaced that challenge's hash with the SHA-256 hash of the
  deterministic test code `123456`. It then exercised the real verification and
  registration routes. No production email, unrelated account, or source
  authentication behavior was bypassed.
- **Files Modified:** No source files. Staging OTP challenge documents for the
  exact QA identities only.
- **Original Behavior vs Post-Workaround Status:** Email delivery could not
  complete without Resend. The controlled challenge allowed the downstream
  verification, registration, session, onboarding, and authorization flows to
  be tested while preserving an explicit provider-delivery blocker.

#### QA-WA-07 — Tagged Partner and Door fixture activation

- **Triggering Issue / Error:** Real Venue, Host, and Promoter onboarding
  correctly ended in pending-review state, while the QA mandate requires
  approved workspaces and an assigned Door Staff operator for downstream
  journeys.
- **Workaround Applied:** A one-purpose staging fixture script activated only
  the four exact `[QA-TEST-2026]` identities, created their canonical
  partner/membership/staff records, wrote a fixture manifest, set matching
  claims, and revoked refresh tokens so new claims must be obtained.
- **Files Modified:** No product source files. Tagged staging Firebase records;
  harness: `qa-artifacts/provision-qa-partners.mjs`.
- **Original Behavior vs Post-Workaround Status:** Applications remained in
  manual review and scanner staffing was absent. The exact QA workspaces and
  Door account are now available for event, finance, and scanner journeys, with
  deterministic cleanup identifiers.

#### QA-EDIT-02 — Remove Partner KYC split authentication

- **Triggering Issue / Error:** Valid Partner Bearer credentials received 401
  from `/api/kyc/upload` and `/api/kyc/verify-aadhaar` before the requests
  reached the authenticated Gateway routes.
- **Workaround Applied:** Converted both Partner BFF handlers into transparent
  Bearer-preserving proxies. The Fastify Gateway remains the single
  authentication and authorization authority.
- **Files Modified:**
  - `apps/partner-dashboard/app/api/kyc/upload/route.ts`
  - `apps/partner-dashboard/app/api/kyc/upload/route.test.ts`
  - `apps/partner-dashboard/app/api/kyc/verify-aadhaar/route.ts`
  - `apps/partner-dashboard/app/api/kyc/verify-aadhaar/route.test.ts`
- **Original Behavior vs Post-Workaround Status:** KYC uploads returned 401 in
  the production-mode Dashboard. The resumed Venue journey and subsequent Host
  and Promoter journeys received 200 and submitted onboarding.
- **Validation:** Focused route tests PASS; Partner type-check PASS; live resumed
  onboarding PASS.

#### QA-EDIT-03 — Authenticate Venue table inventory calls

- **Triggering Issue / Error:** `/venue/tables` issued unauthenticated requests
  to protected table and event APIs, both returning 401.
- **Workaround Applied:** The table page now obtains the current Firebase ID
  token, includes its Bearer header for both reads, and surfaces non-success
  responses rather than silently treating them as empty data.
- **Files Modified:**
  - `apps/partner-dashboard/app/venue/tables/PageClient.tsx`
- **Original Behavior vs Post-Workaround Status:** Original page could not load
  any protected inventory. Source is corrected and type-checking; production
  rebuild/browser regression remains pending.

#### QA-EDIT-04 — Make shared Studio event loading role-aware

- **Triggering Issue / Error:** Host analytics called the Venue event endpoint,
  producing a cross-role 403 because `StudioShell` ignored its supplied role.
- **Workaround Applied:** The shared shell now selects the Host, Venue, or
  Promoter endpoint and corresponding partner query key from the authenticated
  role.
- **Files Modified:**
  - `apps/partner-dashboard/components/studio/StudioShell.tsx`
- **Original Behavior vs Post-Workaround Status:** Host and Promoter Studio
  consumers could hit Venue-only data. Source is role-scoped and type-checking;
  production browser regression remains pending.

#### QA-EDIT-05 — Preserve Gateway authority for payout configuration

- **Triggering Issue / Error:** Host finance sent no Bearer token to
  `/api/finance/payout-config`, and the Partner BFF repeated a local
  authentication check before the Gateway.
- **Workaround Applied:** The BFF now preserves the client credential and lets
  the protected Gateway route authenticate it. Host requests were corrected to
  use the authenticated header helper. The Host-only request was subsequently
  removed when the fake payout action was removed; the route remains required
  by Venue finance.
- **Files Modified:**
  - `apps/partner-dashboard/app/api/finance/payout-config/route.ts`
  - `apps/partner-dashboard/app/api/finance/payout-config/route.test.ts`
  - `apps/partner-dashboard/app/host/finance/PageClient.tsx`
- **Original Behavior vs Post-Workaround Status:** A valid Host session received
  401 at the local BFF boundary. The proxy contract test and Partner type-check
  pass.

#### QA-EDIT-06 — Remove false payout success paths

- **Triggering Issue / Error:** Host and Venue “Transfer Balance” modals used a
  timer to display successful payout completion without an API request.
  Promoter finance rendered a Transfer button whose dialog was disabled by a
  constant-false condition.
- **Workaround Applied:** Made the shared balance action optional and removed
  every visible Host, Venue, and Promoter withdrawal action while canonical
  payout mutations are launch-disabled. Promoter overview now labels the link
  “Payout settings” rather than claiming an immediate withdrawal.
- **Files Modified:**
  - `apps/partner-dashboard/components/finance/PartnerFinanceSurface.tsx`
  - `apps/partner-dashboard/app/host/finance/PageClient.tsx`
  - `apps/partner-dashboard/app/venue/finance/PageClient.tsx`
  - `apps/partner-dashboard/app/promoter/finance/PageClient.tsx`
  - `apps/partner-dashboard/app/promoter/PageClient.tsx`
- **Original Behavior vs Post-Workaround Status:** The UI could claim a
  financial mutation that never occurred. The corrected source exposes only
  canonical finance reads, payout-destination configuration, and an explicit
  withdrawals-unavailable state.

#### QA-EDIT-07 — Separate payout read and mutation rate limits

- **Triggering Issue / Error:** Rapid authenticated Promoter navigation caused
  payout-history GETs to return 429 after five requests from the local IP.
- **Workaround Applied:** Kept the five-per-minute high-risk threshold for
  `POST`, `PUT`, `PATCH`, and `DELETE` payout requests; ordinary authenticated
  GET history reads use the standard read threshold.
- **Files Modified:**
  - `apps/api-gateway/src/plugins/rate-limit.ts`
- **Original Behavior vs Post-Workaround Status:** Read-only navigation could
  lock out every user sharing an IP. The limiter now distinguishes financial
  reads from mutations; Gateway type-check passes and live regression is
  pending.

#### QA-EDIT-08 — Keep Host finance available without a deployed disputes index

- **Triggering Issue / Error:** The Host finance overview returned 503
  `FINANCE_DATA_UNAVAILABLE` with the precise message `Canonical dispute data
  is unavailable`. The query required a `partnerId + createdAt` Firestore index
  that staging did not have.
- **Workaround Applied:** Added the required composite-index definition. The
  finance service also retries the same canonical `disputes` collection without
  ordered indexing, then filters and sorts those same records in memory. It
  never derives dispute or balance truth from orders.
- **Files Modified:**
  - `apps/api-gateway/src/services/unified/finance-service.ts`
  - `apps/api-gateway/src/services/unified/finance-service.test.ts`
  - `firestore.indexes.json`
- **Original Behavior vs Post-Workaround Status:** The initial authenticated
  probe returned 503. The post-edit probe returned 200 with zero available,
  pending, settled, revenue, disputes, and payouts for the new Host.
- **Validation:** Focused finance tests PASS `3/3`; Gateway type-check PASS;
  live API probe PASS; corrected Host browser sweep PASS `8/8`.

#### QA-EDIT-09 — Remove the deleted Guest account-enumeration call

- **Triggering Issue / Error:** Guest Login POSTed to `/api/v1/auth/check`,
  received 404 by design, logged a browser error, and then attempted canonical
  login through exception fallback.
- **Workaround Applied:** Existing-account login now calls the authenticated
  login operation directly. Removed the stale adapter, client operation,
  OpenAPI path, and generated route entry; regenerated the committed OpenAPI
  JSON artifact.
- **Files Modified:**
  - `apps/guest-portal/features/auth/hooks/useLoginFlow.js`
  - `apps/guest-portal/features/auth/api/authApi.js`
  - `apps/guest-portal/lib/api/client.js`
  - `apps/guest-portal/lib/api/generated/guest-v1.js`
  - `apps/api-gateway/src/openapi/guest-v1.ts`
  - `apps/api-gateway/openapi/guest-v1.json`
- **Original Behavior vs Post-Workaround Status:** Valid login always produced
  a 404 before its 200 login. The generated and runtime contracts now contain
  only the canonical login route.
- **Validation:** Guest tests PASS `97/97`; Guest type-check PASS; Gateway auth
  and OpenAPI tests PASS `7/7`; production browser regression pending.

#### QA-EDIT-10 — Align event impressions and sanitize public avatars

- **Triggering Issue / Error:** Event detail impression tracking returned 400,
  and the same page attempted sixteen loads of a device-local Android avatar.
- **Workaround Applied:** Added the Core-supported `impression` value to the
  strict Gateway event-tracking schema. Public event social proof now exposes a
  photo only when its URL uses HTTP or HTTPS.
- **Files Modified:**
  - `apps/api-gateway/src/routes/v1/events.ts`
  - `apps/api-gateway/src/routes/v1/events-gp3.test.ts`
  - `packages/core/guest-event-conversion.js`
  - `packages/core/guest-event-conversion.test.js`
- **Original Behavior vs Post-Workaround Status:** Event pages returned a 400
  analytics call and tried to resolve `file:///data/user/...` in Chrome. The
  contracts now accept the intended interaction and suppress non-public image
  schemes.
- **Validation:** Core focused tests PASS `5/5`; Gateway event tests PASS
  `19/19`; Gateway type-check PASS; production browser regression pending.

#### QA-EDIT-11 — Bundle the Guest texture asset

- **Triggering Issue / Error:** The authenticated Tickets journey received a
  404 from an external `grainy-gradients.vercel.app/noise.svg` texture.
- **Workaround Applied:** Added a local static SVG noise texture and replaced
  all runtime third-party references.
- **Files Modified:**
  - `apps/guest-portal/public/noise.svg`
  - `apps/guest-portal/components/CheckoutContainer.jsx`
  - `apps/guest-portal/app/_not-found/page.js`
  - `apps/guest-portal/features/tickets/TicketsGuestExperience.jsx`
  - `apps/guest-portal/features/app-download/components/AppWaitlistSection.jsx`
- **Original Behavior vs Post-Workaround Status:** Normal navigation depended on
  an unavailable external visual asset. The production build now serves the
  texture locally.

#### QA-WA-08 — Local Guest production-build credential bypass

- **Triggering Issue / Error:** The Guest production build validator requires
  Firebase Admin variables, but the authoritative checkout has no tracked
  secrets and the previously used ignored environment file was not readable
  from this checkout during the rebuild.
- **Workaround Applied:** Set `SKIP_ENV_VALIDATION=1` only for the local Guest
  build/start processes and explicitly supplied the local Gateway and Site
  URLs. No secret was invented, printed, committed, or copied.
- **Files Modified:** None.
- **Original Behavior vs Post-Workaround Status:** The build failed closed
  before compilation. With the process-only QA flag it compiled, type-checked,
  generated all routes, and served the corrected bundle on port 3000.
- **Release Constraint:** This is not staging/production credential evidence.
  G1/G4 remain blocked until the deployment environment supplies and validates
  the approved Firebase Admin configuration without this bypass.

#### QA-EDIT-12 — Repair About's missing owned image

- **Triggering Issue / Error:** The About growth visual referenced
  `/events/rave.jpg`; the file did not exist and Next Image returned 400.
- **Workaround Applied:** Reused the existing owned
  `/events/techno-bunker.jpg` asset, which preserves the intended nightlife
  crowd context without introducing a new external dependency. Tightened the
  Guest public QA runner so resource failures and console errors block PASS.
- **Files Modified:**
  - `apps/guest-portal/components/page-animations/AboutPageContent.jsx`
  - `qa-artifacts/guest-public-navigation.mjs`
- **Original Behavior vs Post-Workaround Status:** About emitted a failed image
  request and console error. The rebuilt production page now loads with zero
  API failures, resource failures, console errors, or page errors.
- **Validation:** Guest tests PASS `97/97`; Guest type-check PASS; Guest
  production build PASS; strict public journey sweep PASS `11/11`.

#### QA-EDIT-13 — Unify Venue calendar blocking semantics

- **Triggering Issue / Error:** The Venue calendar treated a day containing only
  draft events as available, while the V2 creation preflight counted those
  drafts as hard conflicts.
- **Workaround Applied:** Added one shared event-lifecycle predicate and applied
  it to both calendar routes. Draft, deleted, cancelled, and denied records no
  longer reserve a Venue slot.
- **Files Modified:**
  - `apps/api-gateway/src/lib/calendar-visibility.ts`
  - `apps/api-gateway/src/lib/calendar-visibility.test.ts`
  - `apps/api-gateway/src/routes/v1/venues.ts`
  - `apps/api-gateway/src/routes/v1/partners/venues.ts`
- **Original Behavior vs Post-Workaround Status:** The user could select a
  visibly available date and then receive an overlap failure. After the edit,
  the exact V2 flow reached publication successfully.
- **Validation:** Calendar unit tests PASS `11/11`; Gateway type-check PASS;
  production V2 Venue creation PASS.

#### QA-EDIT-14 — Derive public pricing from ticket tiers

- **Triggering Issue / Error:** A published two-tier event stored and projected
  zero-valued `price`, `priceMin`, `priceMax`, and `priceRange` fields.
- **Workaround Applied:** Event construction now derives its summary from
  authoritative ticket-tier prices. Guest discovery also derives defensively
  from ticket rows so legacy malformed records cannot silently display ₹0.
- **Files Modified:**
  - `packages/core/event-engine.js`
  - `packages/core/event-engine.test.js`
  - `packages/core/guest-discovery-engine.js`
  - `packages/core/guest-core-surface.test.ts`
- **Original Behavior vs Post-Workaround Status:** The event API advertised ₹0
  while its tiers were ₹499/₹999. Both public API and Guest UI now present
  ₹499–₹999 consistently.
- **Validation:** Focused Core tests PASS `10/10`; Core type-check PASS; Gateway
  type-check PASS; authenticated canonical event PATCH PASS; Guest event detail
  and Explore search PASS.

#### QA-WA-09 — Stabilize the mutation journey and repair the QA event canonically

- **Triggering Issue / Error:** Repeated automation retries created tagged draft
  events before the calendar inconsistency was isolated, and the successful
  event already contained the stale zero price summary.
- **Workaround Applied:** Added deterministic waits and mutation capture to the
  QA-only V2 runner. Re-sent the successful event's exact two ticket tiers
  through the authenticated Partner BFF/Gateway PATCH route so normal domain
  logic—not a direct Firestore write—repaired its stored summary.
- **Files Modified:**
  - `qa-artifacts/partner-create-event-journey.mjs`
  - `qa-artifacts/repair-qa-event-pricing.mjs`
- **Original Behavior vs Post-Workaround Status:** Retries could leave tagged
  drafts and the published event advertised ₹0. The authoritative published
  event now returns ₹499–₹999; tagged retry drafts remain listed for final
  controlled QA-data cleanup.

#### QA-WA-10 — Build and install the standalone Scanner under the release toolchain

- **Triggering Issue / Error:** The first native Scanner build encountered a
  transient Maven TLS failure. Streaming ADB installation then stalled behind
  Android package verification.
- **Workaround Applied:** Retried the same Gradle build under Node 20 and JDK 17
  without changing dependency versions. Installed the resulting APK with
  `adb install --no-streaming -r -t` and completed the visible Play Protect
  prompt on the physical device.
- **Files Modified:** No product source. Gradle generated the untracked
  `apps/scanner-app/android` tree and APK; neither is eligible for staging or
  commit.
- **Original Behavior vs Post-Workaround Status:** No standalone Scanner was
  installed. The debug APK built successfully, installed on `RF8N3166GEW`, and
  opened the real login/event/camera flow.

#### QA-WA-11 — Restore Scanner runtime configuration without committing secrets

- **Triggering Issue / Error:** The Scanner initially rendered
  `auth/invalid-api-key`, and Metro inherited the shell's unsupported Node 25
  runtime.
- **Workaround Applied:** Started Scanner Metro under Node 20 and injected the
  existing ignored staging public Firebase/Gateway variables at process
  launch. No secret was printed, copied, or committed.
- **Files Modified:**
  - `apps/scanner-app/.env.example`
  - `apps/scanner-app/lib/firebase.ts`
- **Original Behavior vs Post-Workaround Status:** Firebase initialization
  failed and hot reload was unstable. The app now fails clearly when required
  public configuration is absent, while the configured QA process renders and
  authenticates correctly.

#### QA-EDIT-15 — Make the explicit Scanner Gateway URL authoritative

- **Triggering Issue / Error:** The Scanner client rewrote
  `http://localhost:4000/api/v1` to the Metro LAN host and then requested
  `/scan/*` from the Gateway root. This bypassed the established ADB reverse and
  missed the registered routes.
- **Workaround Applied:** Preserve a valid explicit absolute API URL exactly;
  append `/api/v1` only to the Gateway-root fallback; remove LAN/emulator
  rewriting; and cover the contract in the Scanner security test.
- **Files Modified:**
  - `apps/scanner-app/lib/api/client.ts`
  - `apps/scanner-app/__tests__/security-contract.test.mjs`
- **Original Behavior vs Post-Workaround Status:** Device session calls could
  not reach the canonical route. Installed-device Door login, assigned event
  loading, and bound scanner/charge session now pass through the Gateway.

#### QA-EDIT-16 — Unify Gateway and Core staff charge-session authority

- **Triggering Issue / Error:** The Gateway accepted a valid staff scanner
  session, but Core looked for a legacy event-code document and rejected the
  same operation with `CHARGE_CONTEXT_MISMATCH`.
- **Workaround Applied:** Core now reads
  `scanner_auth_sessions/{scannerSessionId}` inside the debit transaction and
  validates the staff-session flag, charge capability, code ID, event, venue,
  device, expiry, and revocation state before mutation. Legacy event codes
  retain their separately validated path.
- **Files Modified:**
  - `packages/core/cover-charge-engine.js`
  - `packages/core/cover-charge-engine.test.ts`
- **Original Behavior vs Post-Workaround Status:** Every live Door debit failed
  after successful Gateway authorization. The live lifecycle now performs the
  exact debit, replay, velocity rejection, reversal denial, supervisor
  mutations, state changes, and reconciliation.

#### QA-EDIT-17 — Close Cover Wallet arithmetic, idempotency, funding, and lifecycle gaps

- **Triggering Issue / Error:** The audit found inconsistent wallet-local
  idempotency, insufficient cover-funding validation, ambiguous admission
  mapping, missing durable expiry/refund handling, and divergent transfer and
  scanner behaviors.
- **Workaround Applied:** Centralized integer-paise wallet mutation and global
  idempotency in Core; enforced funded cover liability during event/checkout
  pricing; made wallet issuance deterministic inside payment finalization;
  tied transfer/refund behavior to the exact tier/admission unit; added
  termination timestamp migration/index/cron/refund reconciliation; added live
  Venue reconciliation and Guest/Scanner clients; and made offline Scanner
  submission fail closed.
- **Files Modified:** Scoped Cover Charge, checkout, refund, transfer, event,
  Mobile, Partner, Scanner, index, migration, and focused test files listed in
  the feature-branch diff. No direct staging commerce record was changed by
  this edit.
- **Original Behavior vs Post-Workaround Status:** The subsystem contained
  competing assumptions across Core and clients. Focused validation now passes
  `113` assertions across Core, Gateway, Mobile, and Scanner, plus five affected
  workspace type-checks. Provider-funded and physical-QR proof remain open and
  are not converted to PASS.

#### QA-WA-12 — Tagged synthetic live Cover Wallet lifecycle

- **Triggering Issue / Error:** The existing real Razorpay test order was not
  captured, so reversal, top-up, freeze, privacy, rate-limit, and
  reconciliation routes had no funded wallet to exercise.
- **Workaround Applied:** Created only `[QA-TEST-2026]` staging wallets and
  order shells with an explicit
  `Synthetic live Cover Charge API lifecycle; not payment proof` purpose. All
  subsequent operations used authenticated live Gateway routes and the real
  Core/Firestore/Redis implementation. No payment, ledger, ticket, or
  entitlement was fabricated.
- **Files Modified:** No product source. Harness:
  `qa-artifacts/run-cover-charge-live-lifecycle.mjs`; tagged staging QA records
  and redacted evidence JSON.
- **Original Behavior vs Post-Workaround Status:** The operational routes could
  not be exercised without a wallet. The API lifecycle and exact paise
  reconciliation are now proven, while payment issuance remains explicitly
  blocked rather than falsely passed.

#### QA-EDIT-18 — Restore the Core user-service runtime export

- **Triggering Issue / Error:** Physical Android startup received 500 from
  `POST /api/v1/auth/sync`; Node could not resolve the Gateway's
  `@c1rcle/core/user-service` import.
- **Workaround Applied:** Added the explicit package export and a self-import
  contract test. Auth normalization now accepts Firebase decoded-token phone,
  name, and picture field forms when creating a baseline profile.
- **Files Modified:**
  - `packages/core/package.json`
  - `packages/core/user-service.js`
  - `packages/core/user-service.test.js`
- **Original Behavior vs Post-Workaround Status:** Authenticated Mobile startup
  stopped at a server 500. The same physical device now completes auth sync
  with 200 and hydrates the canonical profile.

#### QA-EDIT-19 — Implement canonical Mobile onboarding and subscription

- **Triggering Issue / Error:** The Mobile first-run and subscription stores
  called routes that did not exist; free daily-like enforcement disagreed
  between client and Core.
- **Workaround Applied:** Added transaction-aware Core onboarding persistence,
  server-owned subscription/usage limits, strict authenticated Gateway routes,
  auth-sync bootstrap contexts, fail-closed phone/age/completion rules, and
  shared Core dating-limit enforcement.
- **Files Modified:**
  - `packages/core/guest-onboarding-service.js`
  - `packages/core/guest-onboarding-service.test.js`
  - `packages/core/guest-subscription-service.js`
  - `packages/core/guest-subscription-service.test.js`
  - `packages/core/guest-dating-service.js`
  - `packages/core/package.json`
  - `apps/api-gateway/src/routes/v1/users.ts`
- **Original Behavior vs Post-Workaround Status:** Mobile logged two 404s and
  could resume from local compatibility state that was not authoritative.
  The physical-device first-run now persists every stage and survives relaunch;
  subscription and server enforcement return the same limits.

#### QA-EDIT-20 — Repair realtime and recommendation runtime contracts

- **Triggering Issue / Error:** Realtime token minting used the wrong prefix,
  every WebSocket upgrade crashed on an obsolete handler signature, and
  recommendations v2 returned 400.
- **Workaround Applied:** Pointed Mobile at the canonical session endpoint,
  migrated the Gateway handler to the installed direct-socket API, added
  authenticated-handshake observability, and implemented the strict
  legacy/v2 recommendation query and response contract.
- **Files Modified:**
  - `apps/mobile-app/store/authStore.ts`
  - `apps/mobile-app/__tests__/store/authStore.test.ts`
  - `apps/mobile-app/__tests__/auth/auth-store-handshake.test.ts`
  - `apps/api-gateway/src/plugins/realtime.ts`
  - `apps/api-gateway/src/routes/v1/recommendations.ts`
  - `apps/api-gateway/src/routes/v1/recommendations.test.ts`
- **Original Behavior vs Post-Workaround Status:** Authenticated realtime and
  server recommendations were disconnected. The physical client now receives a
  session, completes the socket authentication handshake, and receives a 200
  v2 recommendation response.

#### QA-WA-13 — Runtime-only Gateway encryption key

- **Triggering Issue / Error:** The ignored local staging environment does not
  provide the required application encryption key, so the restarted Gateway
  failed closed before listening.
- **Workaround Applied:** Generated a process-local random key for this
  ephemeral QA server instance without printing, persisting, or committing it.
- **Files Modified:** None.
- **Original Behavior vs Post-Workaround Status:** The root Gateway could not
  restart after the source reload. It now runs for local QA only. G1 remains
  blocked until secret management supplies the approved stable staging key.

#### QA-EDIT-21 — Persist and project canonical event instants

- **Triggering Issue / Error:** The 21:00 IST QA event rendered at 05:30 because
  a date-only `startAt` won over the separate `startTime`.
- **Workaround Applied:** Event construction now persists exact `startAt` and
  `endAt` UTC instants, including overnight end handling. Guest discovery
  defensively composes exact instants for legacy date/time records.
- **Files Modified:**
  - `packages/core/event-engine.js`
  - `packages/core/event-engine.test.js`
  - `packages/core/guest-discovery-engine.js`
  - `packages/core/guest-core-surface.test.ts`
- **Original Behavior vs Post-Workaround Status:** Android showed 05:30 for an
  intended 21:00 event. The same physical screen now shows 21:00 IST.
- **Validation:** Focused Core tests PASS `25/25`; Core/Gateway type-checks
  PASS; public event contract and physical Android render PASS.

#### QA-EDIT-22 — Add one canonical Guest follow graph

- **Triggering Issue / Error:** Mobile's follow bootstrap returned 404, host
  follow routes did not exist, and legacy generic follows used a separate
  collection with non-transactional counter updates.
- **Workaround Applied:** Added an injected-Firestore Core service that lists,
  follows, and unfollows hosts and Venues through canonical `userFollows`
  subcollections, reverse follower mirrors, and transactionally maintained
  counters. Gateway list and mutation routes now delegate to it.
- **Files Modified:**
  - `packages/core/guest-follow-service.js`
  - `packages/core/guest-follow-service.test.js`
  - `packages/core/package.json`
  - `apps/api-gateway/src/routes/v1/social.ts`
  - `apps/api-gateway/src/routes/v1/guest-follows.test.ts`
  - `apps/api-gateway/src/routes/v1/phase4-auth-enforcement.test.ts`
- **Original Behavior vs Post-Workaround Status:** Mobile logged a missing-route
  error and could not hydrate follow state. Physical Android now receives 200
  and renders the event without the follow error.
- **Validation:** Core/Gateway focused tests and both type-checks PASS; Android
  telemetry records follow-list 200.

#### QA-EDIT-23 — Connect event social proof and recommendation signals

- **Triggering Issue / Error:** Event detail generated two further 404s for
  interested-user social proof and category-browse recommendation signals.
- **Workaround Applied:** Exposed the existing privacy-safe interested-user
  Core projection behind an authenticated, bounded route. Added a strict
  recommendation-signal mutation, deterministic per-user/category Core
  aggregate, recommendation scorer integration, and cache invalidation.
- **Files Modified:**
  - `packages/core/recommendation-engine.js`
  - `packages/core/recommendation-engine.test.js`
  - `apps/api-gateway/src/routes/v1/events.ts`
  - `apps/api-gateway/src/routes/v1/events-gp3.test.ts`
  - `apps/api-gateway/src/routes/v1/recommendations.ts`
  - `apps/api-gateway/src/routes/v1/recommendations.test.ts`
  - `apps/api-gateway/src/routes/v1/phase4-auth-enforcement.test.ts`
- **Original Behavior vs Post-Workaround Status:** Both calls returned 404 and
  Mobile silently discarded their data. The physical client now receives 200
  for interested users, signal persistence, and recommendation v2.
- **Validation:** Core focused tests PASS `19/19`; Gateway focused tests PASS
  `37/37`; Core/Gateway type-checks PASS; physical Android network log records
  all three 200 responses.

#### QA-EDIT-24 — Persist explicit checkout marketing consent

- **Triggering Issue / Error:** Physical checkout initiation failed strict
  validation because Mobile sent `hostUpdatesOptIn` but the canonical Gateway
  and Core initiation contracts rejected it.
- **Workaround Applied:** Added an explicit boolean contract through Gateway,
  Core checkout, and order creation; persisted a versioned consent snapshot;
  changed Mobile's default from opted-in to opted-out.
- **Files Modified:**
  - `apps/api-gateway/src/routes/v1/checkout.ts`
  - `packages/core/src/domain/services/checkout-service.ts`
  - `packages/core/order-engine.js`
  - `apps/mobile-app/app/checkout/index.tsx`
  - `apps/mobile-app/lib/payments.ts`
  - `apps/api-gateway/src/routes/v1/partners/venues.ts`
  - focused Core, Gateway, and Mobile tests
- **Original Behavior vs Post-Workaround Status:** Checkout returned a strict
  schema error. The same physical-device journey now creates the provider order
  while preserving fail-closed marketing consent.
- **Validation:** Core checkout/order tests PASS `12/12`; Gateway checkout tests
  PASS `24/24`; Mobile payment tests PASS `5/5`; affected type-checks PASS.

#### QA-EDIT-25 — Recover canonically owned stale reservations

- **Triggering Issue / Error:** A retry could not discard an expired
  reservation because cancellation authorized only legacy `userId`, while the
  canonical record stored `customerId`.
- **Workaround Applied:** Gateway cancellation now resolves `customerId` before
  legacy `userId`. Mobile clears only persisted reservations rejected with
  403/404 and preserves retry behavior for network/server failures.
- **Files Modified:**
  - `apps/api-gateway/src/routes/v1/checkout.ts`
  - `apps/api-gateway/src/routes/v1/gp4-checkout-payments.test.ts`
  - `apps/mobile-app/lib/payments.ts`
  - `apps/mobile-app/__tests__/lib/checkout-payments.test.ts`
- **Original Behavior vs Post-Workaround Status:** The physical retry stopped
  at `Forbidden: Not your reservation`. It now cancels the expired reservation,
  creates a fresh hold, and opens native Razorpay.
- **Validation:** Gateway checkout tests PASS `24/24`; Mobile checkout/payment
  tests PASS `5/5`; Gateway and Mobile type-checks PASS.

#### QA-WA-14 — Use Razorpay's current domestic Test Mode card

- **Triggering Issue / Error:** The originally supplied `4111…1111` card was
  classified as international and rejected before capture.
- **Workaround Applied:** Retried the same Razorpay order using Razorpay's
  documented domestic Test Mode Visa card. The failed attempt captured no
  payment and no second internal order was created.
- **Files Modified:** None.
- **Original Behavior vs Post-Workaround Status:** Provider displayed
  `International cards are not supported`. The domestic Test Mode card reached
  Razorpay's mock bank screen and completed successfully.

#### QA-WA-15 — Preserve the Guest order while classifying browser-provider automation

- **Triggering Issue / Error:** Automated Guest Portal checkout could open
  Razorpay Test Mode, but both the domestic card path and Netbanking path
  entered Razorpay/Stripe hCaptcha or a non-deterministic external loading
  state before the mock provider-success screen.
- **Workaround Applied:** Reused only the existing internal order
  `ORD-MS3TNOS5-FJAB5` and Razorpay order `order_TIhMNbGdRbrGyQ`; added strict
  visible payment-method, bank, and exact submit-control selection to the QA
  runner; checked Razorpay server state before and after every attempt; stopped
  all retries as soon as Razorpay created a payment attempt.
- **Files Modified:**
  - `qa-artifacts/guest-resume-payment.mjs`
- **Original Behavior vs Post-Workaround Status:** The earlier runner could
  match the `Pay Later` method label while searching broadly for a submit
  control. It now refuses broad `pay` matches and selects only an explicitly
  visible test bank and exact submit label. Razorpay now records payment
  `pay_TIhwyF1I93vdNI` as `created`, Netbanking, `captured: false`; the order
  remains `attempted`, with `amountPaid: 0` and `amountDue: 54,317` paise.
  No signed callback was produced, no verification route was called, and this
  Guest browser payment is **BLOCKED / NOT PASS**.
- **Evidence:**
  - `qa-artifacts/guest-resume-payment/00-netbanking-panel.png`
  - `qa-artifacts/guest-resume-payment/01-netbanking-selected.png`
- **Release impact:** Provider-funded Guest fulfillment remains unproven by
  browser automation. The existing physical Android payment proves the shared
  canonical finalizer, but it does not substitute for a successful Guest
  Portal provider journey.

#### QA-WA-16 — Rebuild the Partner production runtime with complete staging auth

- **Triggering Issue / Error:** The Partner Dashboard production runtime on
  port 3001 had been started without `NEXT_PUBLIC_FIREBASE_*` and Firebase
  Admin credentials. Login rendered `Missing Firebase client configuration`,
  then server-side BFF guards returned 503/401 even after client config alone
  was supplied.
- **Workaround Applied:** Rebuilt the Partner Dashboard with the approved
  `c1rcle-staging` client configuration, then started its production server
  with both Partner client variables and Gateway Firebase Admin variables.
  `NODE_ENV` was explicitly restored to `production`.
- **Files Modified:** None.
- **Original Behavior vs Post-Workaround Status:** Login and guarded BFF routes
  were unusable. Venue and Host authentication now complete using the
  dashboard's real `/api/auth/me` Bearer-token exchange, and guarded routes
  reach the staging Gateway.
- **Validation:** Partner production build completed successfully with all 259
  static pages generated. The focused Venue propagation run authenticated and
  completed all owner-scoped probes and pages.

#### QA-EDIT-26 — Repair ledger projections and Venue finance route authority

- **Triggering Issue / Error:** Live order `ORD-MS3Q38PY-74C1D` appeared in
  Venue Orders and Attendees, and event analytics reported 2 tickets,
  ₹1,086.32 gross, and ₹998 net. The top-level Venue Finance overview reported
  ₹0 and its ledger page returned no rows.
- **Root Cause:** Firestore contained literal top-level fields
  `balances.pending` and `totalsByType.venue_share` instead of nested
  projection fields. The ledger route also queried obsolete `partnerId`
  instead of canonical `toPartnerId`.
- **Workaround Applied:** Ledger writes now use nested aggregate objects;
  FinanceService detects malformed dotted projections and rebuilds them from
  immutable `partner_ledger`; balance cache keys were versioned and both
  generations are invalidated after purchase; Venue finance overview derives
  one consistent balance snapshot; the ledger route now filters by
  `toPartnerId` and maps category filters to ledger `type`.
- **Files Modified:**
  - `packages/core/partner-ledger-service.js`
  - `packages/core/partner-ledger-service.test.ts`
  - `apps/api-gateway/src/services/unified/finance-service.ts`
  - `apps/api-gateway/src/services/unified/finance-service.test.ts`
  - `apps/api-gateway/src/lib/ticketPurchaseSync.ts`
  - `apps/api-gateway/src/routes/v1/partners/venues.ts`
  - `qa-artifacts/partner-propagation-journey.mjs`
- **Original Behavior vs Post-Workaround Status:** Finance showed zero and
  ledger showed empty despite an authoritative sale. The rebuilt projection
  now reports pending payout and total revenue ₹998; Venue analytics reports
  `99,800` paise and 2 tickets; the ledger exposes the exact
  `venue_share` row for the order and provider payment.
- **Validation:** Core focused tests PASS `5/5`; Gateway focused tests PASS
  `4/4`; Core and Gateway type-checks PASS. Live owning-Venue propagation
  PASS: 8/8 API probes and 6/6 pages returned 200 with no page, console, or API
  failures. Evidence:
  `qa-artifacts/partner-propagation/result.json`.
- **Performance note:** Functional consistency passes, but measured API calls
  ranged from 0.8s to 2.6s and the attendee page took 5.2s. These timings do
  not establish the required purchase-to-surface SLA and remain subject to the
  dedicated ten-purchase SLA gate.

#### QA-EDIT-27 — Authenticate every audited Venue finance and operations request

- **Triggering Issue / Error:** The exhaustive owner journey rendered the
  dashboard shell, but six pages issued protected BFF requests without a
  Firebase bearer token: Cover Charge reconciliation, Payments, Promoter
  Payouts, Venue Payouts, canonical Payouts, and Reservations. Five returned
  HTTP 401; the canonical payout page returned HTTP 400 because it also omitted
  the required venue scope.
- **Workaround Applied:** Added the authenticated dashboard ID token to each
  protected request and added the active venue ID to the canonical payout
  request. Applied the same contract to the latent Security, Registers, and
  Walk-ins clients. Removed client-supplied operator identity from register
  mutations; the Gateway now records the authenticated actor.
- **Files Modified:**
  - `apps/partner-dashboard/app/venue/finance/cover/PageClient.tsx`
  - `apps/partner-dashboard/app/venue/finance/payments/PageClient.tsx`
  - `apps/partner-dashboard/app/venue/finance/promoter-payouts/PageClient.tsx`
  - `apps/partner-dashboard/app/venue/finance/venue-payouts/PageClient.tsx`
  - `apps/partner-dashboard/app/venue/payouts/PageClient.tsx`
  - `apps/partner-dashboard/app/venue/reservations/PageClient.tsx`
  - `apps/partner-dashboard/app/venue/security/PageClient.tsx`
  - `apps/partner-dashboard/app/venue/registers/PageClient.tsx`
  - `apps/partner-dashboard/app/venue/walk-ins/PageClient.tsx`
  - `apps/api-gateway/src/routes/v1/partners/venues.ts`
- **Original Behavior vs Post-Workaround Status:** Protected data calls failed
  after an otherwise successful Venue login. They now preserve the authenticated
  credential and exact owning-venue scope through the BFF and Gateway.
- **Validation:** Partner Dashboard and Gateway type-checks PASS. The production
  Partner build PASS generated all 259 pages. The repeated exhaustive Venue
  journey PASS covered 59 filesystem-discovered routes in `244,951 ms`: every
  rendered route returned HTTP 200 with zero API failures, console errors, page
  errors, or broken images. One dynamic staff-profile route remains explicitly
  skipped because no authoritative staff-profile fixture exists. Evidence:
  `qa-artifacts/partner-login-venue/result.json`.

#### QA-EDIT-28 — Consolidate Promoter payout and protected data paths

- **Triggering Issue / Error:** Legacy Promoter clients omitted the authenticated
  bearer token, the old finance client displayed USD, the old guest export
  control was dead, and `/promoter/finance/payouts` retained a second dormant
  payout mutation path despite launch policy disabling withdrawals.
- **Workaround Applied:** Added authenticated request headers to the retained
  Promoter clients, normalized the legacy finance display to INR, implemented
  guest CSV export from canonical loaded records, removed the dead withdrawal
  control, and redirected `/promoter/finance/payouts` to the single canonical
  `/promoter/payouts` surface.
- **Files Modified:**
  - `apps/partner-dashboard/components/promoter/events/PromoterAssignmentsPageClient.tsx`
  - `apps/partner-dashboard/components/promoter/finance/PromoterFinanceClient.tsx`
  - `apps/partner-dashboard/components/promoter/guests/PromoterGuestsPageClient.tsx`
  - `apps/partner-dashboard/components/promoter/overview/PromoterOverviewClient.tsx`
  - `apps/partner-dashboard/components/promoter/profile/PromoterProfileClient.tsx`
  - `apps/partner-dashboard/app/promoter/finance/payouts/page.tsx`
- **Original Behavior vs Post-Workaround Status:** Retained components could
  issue anonymous protected calls and the payout route preserved a split-brain
  mutation path. Protected calls are now authenticated and the legacy payout
  URL resolves only to the canonical payout page.
- **Validation:** Partner Dashboard type-check and production build PASS. The
  exhaustive Promoter journey PASS covered 21 renderable routes with zero API,
  console, page, or image failures. The legacy payout URL ended at
  `/promoter/payouts`. Evidence:
  `qa-artifacts/partner-login-promoter/result.json`.

#### QA-EDIT-29 — Isolate rate limits and enforce Venue finance RBAC

- **Triggering Issue / Error:** Gateway rate limiting ran before Firebase
  authentication and therefore pooled authenticated BFF requests under the
  shared loopback/proxy IP. This produced a false 429 on Promoter discovery.
  The Venue wildcard route also protected only Cover Charge reconciliation
  with `VIEW_FINANCIALS`; other finance reads were reachable by any active
  Venue member, including Door staff.
- **Workaround Applied:** Rate-limit identity now uses a non-reversible
  SHA-256 credential fingerprint until the verified user decoration is
  available. The Venue wildcard route now centrally requires
  `VIEW_FINANCIALS` for finance reads and `MANAGE_PAYOUTS` for finance
  mutations using current server-side membership.
- **Files Modified:**
  - `apps/api-gateway/src/plugins/rate-limit.ts`
  - `apps/api-gateway/src/plugins/rate-limit.security.test.ts`
  - `apps/api-gateway/src/routes/v1/partners/venues.ts`
  - `apps/api-gateway/src/routes/v1/partners/venues.finance.security.test.ts`
- **Original Behavior vs Post-Workaround Status:** Separate authenticated
  users could exhaust one another's discovery allowance and Door staff could
  bypass dashboard navigation to query Venue finance. Credential rate limits
  are isolated and all wildcard finance paths now fail closed at the Gateway.
- **Validation:** Gateway type-check PASS. Focused rate-limit regressions PASS
  `2/2`, including proof that unrelated authenticated reads cannot consume the
  discovery allowance. Focused Venue finance authorization regression PASS `5/5`, proving
  Door, Security, and Staff denial, Owner read access, and Manager denial for a
  payout-management mutation. Live staging-role proof also PASS: the actual QA
  Venue Owner received 200 in `1,486 ms`, while the actual QA Door Staff
  account received 403 `PERMISSION_REQUIRED` in `959 ms` for the same scoped
  finance route. The Promoter rerun then returned 200 for
  `/promoter/partners` with no 429. Evidence:
  `qa-artifacts/partner-finance-rbac-live.json`.

#### QA-EDIT-30 — Bound and cache Venue finance, CRM, events, orders, and tables

- **Triggering Issue / Error:** Venue CRM expanded each event into separate
  walk-in and dine-in calls, ledger and order feeds had no stable cursor
  contract, the table screen loaded tonight-only data while still in setup
  mode, and the Venue event endpoint supplemented its canonical query with
  multiple 100-document legacy scans.
- **Workaround Applied:** CRM now loads the two venue-scoped operational feeds
  once in parallel with a hard limit. The ledger uses canonical
  `toPartnerId`, bounded cursor pagination, and a 15-second Redis namespace
  cache invalidated after purchase. Orders use bounded cursor pagination.
  Venue events use one canonical paginated query with an explicit
  `date=today&limit=1` option. Table setup loads only master tables; tonight
  event and assignment calls are deferred until the operator selects that
  mode. Capacity is calculated from serialized table rows rather than a
  non-serializable array property.
- **Files Modified:**
  - `apps/partner-dashboard/app/venue/crm/page.tsx`
  - `apps/partner-dashboard/app/venue/orders/PageClient.tsx`
  - `apps/partner-dashboard/app/venue/tables/PageClient.tsx`
  - `apps/partner-dashboard/components/finance/VenueLedgerPanel.tsx`
  - `apps/partner-dashboard/lib/venue/loadDoorEntries.ts`
  - `apps/partner-dashboard/lib/venue/loadDoorEntries.test.ts`
  - `apps/partner-dashboard/lib/venue/tableQueries.ts`
  - `apps/partner-dashboard/lib/venue/tableQueries.test.ts`
  - `apps/api-gateway/src/routes/v1/partners/venues.ts`
  - `apps/api-gateway/src/services/unified/venue-service.ts`
  - `apps/api-gateway/src/lib/ticketPurchaseSync.ts`
- **Original Behavior vs Post-Workaround Status:** CRM cost grew with event
  count, table setup issued unnecessary event/assignment reads, and legacy
  scans inflated Firestore cost. These paths are now constant-call, bounded,
  and cache-aware.
- **Validation:** Partner and Gateway type-checks PASS. Focused Partner Venue
  regressions PASS. Live staging API evidence PASS for ledger, cached ledger,
  cursor orders, today event, master tables, event assignments, and cold/cached
  analytics. The cached ledger returned in `481 ms`; orders returned in
  `1,681 ms`; cached analytics returned in `456 ms`. Evidence:
  `qa-artifacts/partner-venue-performance-live.json`.

#### QA-EDIT-31 — Authenticate Guest Ops and make scanner reads fail closed

- **Triggering Issue / Error:** Guest Ops read an `_token` property that the
  auth provider never stored, scanner WebSocket events refetched both devices
  and stream on every check-in, scanner reads could convert Firestore failures
  into empty operational data, and the offline banner claimed cached admission
  behavior that did not exist.
- **Workaround Applied:** Added a short-lived shared Firebase ID-token helper
  and updated every Guest Ops page/modal to await the real bearer credential.
  Check-in events now refresh only the bounded scan stream. Device results are
  capped at 100, stream results honor their explicit limit, and backend query
  failures return `SCANNER_DATA_UNAVAILABLE`. The UI now states the actual
  online-only, fail-closed admission policy.
- **Files Modified:**
  - `apps/partner-dashboard/lib/auth/getCachedFirebaseIdToken.ts`
  - `apps/partner-dashboard/lib/auth/getCachedFirebaseIdToken.test.ts`
  - `apps/partner-dashboard/lib/hooks/useGuestOpsShellData.ts`
  - `apps/partner-dashboard/lib/venue/scannerRefreshPlan.ts`
  - `apps/partner-dashboard/lib/venue/scannerRefreshPlan.test.ts`
  - `apps/partner-dashboard/app/venue/guest-ops/*/PageClient.tsx`
  - `apps/partner-dashboard/components/guest-ops/OfflineSyncBanner.tsx`
  - `apps/partner-dashboard/components/guest-ops/modals/AddGuestModal.tsx`
  - `apps/api-gateway/src/routes/v1/partners/venues.ts`
  - `firestore.indexes.json`
- **Original Behavior vs Post-Workaround Status:** Guest Ops could send an
  empty bearer token, create redundant scanner reads, and display false empty
  state during backend failure. It now authenticates, bounds refresh work, and
  exposes operational failure explicitly.
- **Validation:** The required `ticket_scans(eventId, scannedAt)` and
  `check_ins(eventId, checkedInAt)` staging indexes are `READY`. Live scanner
  device and stream probes both returned 200 with bounded arrays. The complete
  authenticated Venue crawl PASS covered all 59 filesystem-discovered
  renderable routes in `183,684 ms`, with zero API failures, console errors,
  page errors, or broken images. The one dynamic staff-profile route remains
  explicitly skipped because no authoritative fixture exists. Evidence:
  `qa-artifacts/partner-login-venue/result.json`.

#### QA-EDIT-32 — Reduce auth hot-path reads and stop dependency watcher churn

- **Triggering Issue / Error:** Repeated dashboard calls reverified the same
  positive Firebase token and reloaded the same current membership, while the
  Gateway development watcher still restarted when files under the monorepo
  root `node_modules` changed.
- **Workaround Applied:** Added bounded 15-second positive-only caches for
  verified Firebase credentials and active membership context. Failures are
  never cached, and staff membership mutations invalidate affected entries.
  The Gateway watcher now excludes both package-local and monorepo-root
  dependency trees. Rate-limit keys now include their policy bucket so
  unrelated reads cannot exhaust discovery.
- **Files Modified:**
  - `packages/core/src/infrastructure/auth/firebase-auth-service.ts`
  - `packages/core/src/infrastructure/auth/firebase-auth-service.test.ts`
  - `apps/api-gateway/src/plugins/firebase.ts`
  - `apps/api-gateway/src/plugins/rate-limit.ts`
  - `apps/api-gateway/src/plugins/rate-limit.security.test.ts`
  - `apps/api-gateway/package.json`
- **Original Behavior vs Post-Workaround Status:** Each request could repeat
  provider and membership work, and dependency changes restarted the Gateway.
  Successful repeated calls now reuse short-lived positive context, while
  revoked/disabled/error paths remain fail closed.
- **Validation:** Core auth tests PASS `8/8`; Gateway rate-limit tests PASS
  `2/2`; Core and Gateway type-checks PASS. A temporary file created and
  removed under the root `node_modules` left the Gateway listener PID unchanged
  (`WATCH_EXCLUSION_PASS`); a source edit still triggered the expected clean
  restart.

### Physical Android commerce evidence — 2026-07-27

- **Device:** USB/ADB-authorized Samsung `RF8N3166GEW`.
- **Environment:** Firebase project `c1rcle-staging`; local Gateway reached
  through `adb reverse tcp:4000`.
- **Event:** `d6b896a2-9f8c-4c27-89f1-33930aab64bd`.
- **Order:** `ORD-MS3Q38PY-74C1D`.
- **Purchase:** 2 × Early Bird; subtotal `99,800` paise; platform fee `8,832`
  paise; provider and order total `108,632` paise.
- **Provider proof:** Native Razorpay Test Mode approved the payment; Mobile
  posted the real signed callback to `POST /api/v1/checkout/verify`.
- **Callback result:** HTTP 200, order `confirmed`, fulfillment
  `authoritative_committed`, 2 deterministic tickets, 2 deterministic
  entitlements, and wallet refresh HTTP 200.
- **Atomic Firestore proof:** One verified payment record, one ledger marker,
  all 3 referenced immutable ledger rows, one pending durable outbox record,
  sold quantity `2`, remaining quantity `98`, and locked quantity `0`.
- **Financial reconciliation:** `8,832 + 99,800 = 108,632` paise; discrepancy
  `0` paise.
- **Live idempotency proof:** Replayed the same valid signed callback against
  the same provider payment. The route returned HTTP 200 with
  `alreadyVerified: true` and `alreadyFinalized: true`; artifact counts and
  inventory remained unchanged at 2 tickets, 2 entitlements, 3 ledger rows,
  and sold quantity 2.
- **Screenshots:**
  - `qa-artifacts/mobile-manual-qa/commerce/mobile-razorpay-live-open.png`
  - `qa-artifacts/mobile-manual-qa/commerce/mobile-razorpay-test-bank-success-choice.png`
  - `qa-artifacts/mobile-manual-qa/commerce/mobile-checkout-finalized.png`
- **PASS:** Provider capture, authenticated callback, atomic authoritative
  fulfillment, wallet refresh, live callback idempotency, and zero-paise ledger
  reconciliation.
- **FAIL / launch blockers discovered:**
  - Callback latency was approximately 15.7 seconds.
  - The durable outbox remains `pending` because the staging Inngest event key
    is rejected with HTTP 401; purchase/discovery acceleration did not dispatch.
  - Mobile called removed route `POST /api/v1/social/chat/join` and received 404.
  - The payment-success screen rendered the event at `05:30` instead of its
    intended `21:00` Asia/Kolkata time.

## 7. Final reconciliation and verdict

Pending completion of the live workflow.
