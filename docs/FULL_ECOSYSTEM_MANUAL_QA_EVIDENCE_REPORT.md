# THE C1RCLE Full Ecosystem Manual QA Evidence Report

## 1. Audit control

| Field | Evidence |
|---|---|
| Audit started | 2026-07-25T18:17:13Z |
| Authoritative checkout | `/Users/aayushdivase/Desktop/thec1rcle` |
| Branch | `pre-staging` |
| Frozen test SHA | `bce259da564bf2c66de2cef8252b0e7930fa5de6` |
| Remote parity | `origin/pre-staging` resolved to the same SHA at audit start |
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
- Upstream overlaps the local QA patch in:
  - `apps/api-gateway/src/routes/v1/partners/venues.ts`
  - `apps/api-gateway/src/routes/v1/venues.ts`
- The QA patch must be validated and checkpointed before integrating those
  commits by intent. Existing live PASS evidence remains historical evidence
  for the tested base; it cannot authorize the eventual merged SHA.
- Current G0 status: **IN PROGRESS — new authoritative merged SHA not frozen**.

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
| QA-AUTH-07 | Android onboarding | Physical-device profile, photos, vibes, vitals, preferences | Pending |
| QA-EVENT-01 | Create and publish | V2 wizard, two tiers, authoritative event ID | PASS |
| QA-EVENT-02 | Guest propagation | Event, image, lifecycle, prices, availability | PASS |
| QA-EVENT-03 | Mobile propagation | Same event and tier contract on Android | Pending |
| QA-PAY-01 | Guest or Mobile purchase | Reservation timer, Razorpay test capture, confirmation | Pending |
| QA-PAY-02 | Atomic fulfillment | Order, tickets, entitlements, inventory, ledger, outbox | Pending |
| QA-WALLET-01 | Mobile wallet | Purchased units visible and owned by QA Guest | Pending |
| QA-WALLET-02 | Rotating QR | Signed payload rotates at 15 seconds without flicker | Pending |
| QA-SCAN-01 | Door admission | Authorized device/staff; atomic 2/2 consumption | Pending |
| QA-SCAN-02 | Replay denial | Re-scan returns explicit already-consumed refusal | Pending |
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
- Turbo result: `8 successful, 8 total`
- Errors: `0`
- Runtime: `4.285s`
- Verdict: **PASS**

### QA-AUTO-02 — Root test orchestration

- Command: `npm test`
- Toolchain: Node `v20.20.2`, npm `10.8.2`
- Turbo result: `7 successful, 7 total`
- Failed suites: `0`
- Mobile evidence: `51` suites and `409` assertions passed.
- The run emitted expected negative-path logs from mocked Redis, provider,
  boundary, and error-state tests. The root command exited zero.
- Runtime: `4.3s` with Turbo cache reuse.
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
- Venue: `10/10` tested routes returned 200 with zero API failures, console
  errors, or page errors. This includes Overview, Events, Analytics, Finance,
  Payout Settings, Orders, Door/Guest Operations, Tables, Staff, and Settings.
- Host: `8/8` supported routes returned 200 with zero API failures, console
  errors, or page errors. This includes Overview, Events, Analytics, Finance,
  Payout Settings, Promoters/Partners, Team, and Settings.
- Promoter: `8/8` tested routes returned 200 with zero API failures, console
  errors, or page errors. This includes Overview, Events, Links, Analytics,
  Finance, Payout Settings, Guests, and Settings.
- Host finance's final regression depended on QA-EDIT-08 and returned the
  legitimate zero canonical balance for the new Host, not a raw-order fallback.
- Evidence:
  - `qa-artifacts/partner-login-venue/result.json`
  - `qa-artifacts/partner-login-host/result.json`
  - `qa-artifacts/partner-login-promoter/result.json`
- Verdict: **PASS for the tested authenticated role navigation set.** Individual
  create/edit/mutation workflows remain gated by their dedicated journeys.

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
| QA-RELEASE-DATA-01 | P0 | The staging public event collection still contains 13 `demo-event-*` records and Guest Explore displays them beside real events. | Demo/showcase inventory is visible in a launch-candidate environment and violates the signed-build/demo-off invariant. | Open; requires ownership confirmation, tagged cleanup, cache invalidation, and zero-demo regression evidence |

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

## 7. Final reconciliation and verdict

Pending completion of the live workflow.
