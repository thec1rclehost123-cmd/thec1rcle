# THE C1RCLE — Mobile Launch Readiness Audit: Android, iOS, Google Play, App Store, and India

Last updated: 2026-07-19

Official policy/legal source review: 2026-07-17

Audit owner: Mobile launch team

Runtime authority: `c1rcle-staging`

Runtime checkout: `/Users/aayushdivase/Desktop/thec1rcle/thec1rcle.nosync`

Primary device: Samsung SM-G980F, Android 13, 1080 × 2400, font scale 1.0

Build audited: Expo development client, clean Metro 8081 bundle, local API gateway 4000

Package and bundle ID: `com.c1rcle.app`

App version inspected: `1.0.0`

Market in scope: India

Release decision: **NO-GO for production promotion**

## 0. Document contract

This file is the single launch-readiness source of truth for the consumer mobile app. It covers product QA, Android engineering, iOS engineering, Google Play, Apple App Store, payments, privacy, user-generated content, India legal/regulatory readiness, security, operations, cost controls, and staged rollout. Update the status here whenever a gate is completed, regresses, or is formally accepted as a known risk.

This is an engineering and operational compliance audit, not legal or tax advice. India counsel, a chartered accountant, and the authorized company signatory must approve the legal, tax, entity, consumer, intermediary, and contract sections before launch.

Status meanings:

- **PASS** — verified with evidence in the environment stated above.
- **PARTIAL** — primary path passed, but required edge, device, or release-build proof remains.
- **BLOCKED** — required launch proof is missing or a known defect remains.
- **DEFERRED** — intentionally outside this mobile phase and must be tracked in its own release audit.
- **NOT APPLICABLE** — excluded only with written rationale and approver; absence of evidence is never treated as not applicable.

Important scope boundary:

- The separately built scanner product is **deferred**. This phase does not modify or certify scanner-app functionality.
- Ticket state checks already performed during mobile QA are recorded only as mobile ticket-lifecycle evidence. End-to-end scanner-product certification will happen later against the scanner version already maintained in GitHub.
- Temporary scanner changes started during this audit were removed.

## Master launch checklist — execution board

This is the operational checklist to use until launch. The detailed gate rows in Sections 4 and 13–28 define the evidence required to check an item. A source edit, debug build, verbal confirmation, or passing happy path is not enough unless the stated release-candidate and environment evidence also exists.

Checklist rules:

- Complete phases in dependency order. Preparation may run in parallel, but a later phase cannot receive PASS before its dependencies.
- Mark an item complete only with owner, timestamp, exact build/backend identity, environment, artifact or console evidence, expected result, actual result, and reviewer.
- Any changed binary, backend, schema, rule, index, payment configuration, privacy declaration, or policy invalidates the affected evidence.
- P0 defects cannot be accepted for public launch. A P1 exception requires a named owner, mitigation, monitoring, rollback trigger, deadline, and written approval.
- Production payments remain disabled until Phase 2 passes. Scanner remains DEFERRED and outside this checklist.

Current decision: **NO-GO**. Android development-build Phase 1 has no known P0 in the exercised scope, but payment/inventory integrity, signed release builds, production infrastructure, two-device QA, legal/security, stores, and launch operations remain blocking.

### Phase 0 — Control the release

- [x] ~~Confirm runtime authority: `c1rcle-staging`.~~
- [x] ~~Confirm runtime checkout: `/Users/aayushdivase/Desktop/thec1rcle/thec1rcle.nosync`.~~
- [x] ~~Confirm consumer package/bundle ID: `com.c1rcle.app`.~~
- [x] ~~Keep scanner functionality deferred and untouched.~~
- [ ] Name accountable owners for mobile, Android, iOS, backend, payments, QA, security, privacy, trust and safety, operations, finance, legal, support, release management, and executive GO.
- [ ] Freeze scope for the first public release, including whether premium subscriptions and cover charge ship.
- [ ] Create one clean release branch/commit from the intended changes; remove unrelated dirty-worktree material and record the commit SHA.
- [ ] Make CI fail closed for tests, type checks, lint, security, configuration, artifact validation, and submission.
- [ ] Separate consumer build/sign/submit jobs, credentials, and artifacts from the deferred scanner pipeline.
- [ ] Define P0/P1/P2 severity, triage SLA, launch stop thresholds, rollback authority, and exception signatories.
- [ ] Keep production checkout disabled until every Phase 2 exit gate passes.

Phase 0 exit gate: clean reproducible source authority, named owners, frozen scope, blocking CI, scanner isolation, payment kill switch, and approved severity/rollback process.

### Phase 1 — Finish Android functional QA

- [x] ~~Connect and authorize Samsung SM-G980F; restore ADB reverse for API 4000 and Metro 8082.~~
- [x] ~~Verify staging gateway health with Firestore and Redis healthy.~~
- [x] ~~Seed and validate the canonical 13-event demo fixture set and future event dates.~~
- [x] ~~Verify OTP authentication, onboarding completion, session restoration, logout/re-login, and returning-user profile restoration on Android staging.~~
- [x] ~~Verify Explore Pune cold-start filtering, event details, Interested mutation, search, NOWL venue search, host/venue navigation, and deep-link single-flight/back behavior.~~
- [x] ~~Verify accepted DM history, send, back, reopen persistence, and independent history hydration.~~
- [x] ~~Verify exact two-decimal INR presentation through pre-payment checkout.~~
- [x] ~~Verify signed-out wallet explanation and authenticated return to the correct wallet.~~
- [x] ~~Retain the five-step Nightlife wizard for first-time creation and the single-page screen only for active-profile editing.~~
- [x] ~~Verify Android Nightlife create/upload, basic-profile photo isolation, editor persistence, offline draft/retry, pause/re-enable, normal Pause/Keep Active routing, and physical A→B→A account isolation.~~
- [x] ~~Pass the current consolidated Android-development validation: 19 suites/112 tests plus mobile/gateway TypeScript and focused native/deep-link tests.~~
- [x] ~~On the resumed Samsung run, physically revoke and recover Location and Notifications through the app/native settings path; final OS and in-app state is Enabled for both.~~
- [x] ~~Physically save/reopen a reversible basic-profile bio marker, then remove/reopen it and prove the original empty value restored.~~
- [x] ~~Physically logout the prior test identity, authenticate the supplied `+1 5555555555` account with the approved test OTP, route directly to Deepak/Pune Explore, force-stop/reconnect and prove session restoration with exactly one auth-sync fetch.~~
- [x] ~~On the 19 July clean-bundle regression, remove the private-DM inverted-list swipe wrapper that exposed Report/Delete panes by default; retain swipe-to-reply plus long-press moderation, send `QA-PHASE1-DM-20260719-0316`, leave/reopen, and prove backend persistence without exposed action panes.~~
- [x] ~~Fix the Venues discovery contract to use the canonical profile city, prevent stale all-city responses, single-flight identical reads, cache fresh Pune venue/event discovery for two minutes, preserve explicit refresh, and physically prove Explore → Venues makes one city-filtered venue/event read.~~
- [x] ~~Retest the previously failed `c1rcle://settings/permissions` route on the connected Samsung; it opens the real Permissions screen and reports Location Enabled, Notifications Enabled, Camera Disabled, and Contacts Not available.~~
- [x] ~~Fix event date/time formatting so venue-local timezone, with an `Asia/Kolkata` India fallback, is stable regardless of device timezone; pass 30 focused mobile tests, mobile TypeScript, and physical Arizona-device proof rendering the stored instant as `Monday, 3 August at 1:30 am`.~~
- [ ] Review every seeded event, host, venue, poster, date/time, location, ticket tier, fee, checkout row, ticket, wallet entry, and receipt against the canonical fixture matrix.
- [ ] Test all location/notification/media permission states: first ask, allow, deny, deny permanently, settings recovery, revoked while backgrounded, and revoked after upgrade.
- [ ] Test clean new user, returning user, incomplete user, expired session, account switch, rapid switch during requests, force-stop, process death, reinstall, and upgrade.
- [ ] Test profile editing for name, photo, DOB boundary, email, phone, city, preferences, validation failures, upload failures, offline recovery, cancel/revert, and persistence.
- [ ] Test every Nightlife Vitals/Prompt/Vibe/Photo/Anthem editor sheet, validation error, draft recovery, timeout, process death, disable/re-enable, deletion, moderation, and discovery rendering.
- [ ] Test Explore/search empty, slow, offline, 4xx, 5xx, retry, pagination, cancellation, duplicate response, change-city persistence, and location denial.
- [ ] Test event detail/interested/share/deep-link behavior from cold, warm, background, signed-out, auth-interrupted, and notification states.
- [ ] Test event chat and private-chat pagination, reconnect, duplicate ordering, failed send/retry, unread, block/report, background notification, and deep-link return.
- [ ] Test Tickets true-empty, signed-out, loading, error, transferred, shared, revoked, expired, refunded, cancelled, and cross-account states.
- [ ] Test settings, notification preferences, blocked users, privacy controls, support, legal links, logout, account deletion, and deletion cancellation/re-authentication.
- [ ] Run physical Android accessibility: 100%/200% font, TalkBack, contrast, touch targets, keyboard, safe areas, gesture navigation, rotation, small/tall screens, low memory, low storage, and poor network.

Phase 1 exit gate: every functional row passes on the connected Android development build with no unresolved P0; all remaining signed-RC, iOS, accessibility, and two-device proof stays explicitly open for Phases 3, 5, and 7.

### Phase 2 — Payment, inventory, ticket, refund, and ownership integrity

#### 2A. Inventory authority and migration

- [x] ~~Define the finite inventory invariant: capacity = remaining + allocated + sold + active holdbacks; keep Redis cart reservations outside durable conservation.~~
- [x] ~~Implement feature-gated Inventory V2 transactional primitives with deterministic mutation keys, explicit parent/shard authority, mirror synchronization, replay protection, and fail-closed ambiguity guards.~~
- [x] ~~Run read-only Evidence 95 against staging and verify its checksum: 70 events, 105 finite tiers, 19 balanced, 86 persisted-data failures, 292 unaccounted units, and no data writes.~~
- [x] ~~Complete and independently validate lifecycle-aware Evidence 96 against actual public-inventory and checkout lifecycle/cutoff behavior: 20 saleable tiers, 18 balanced, exactly 2 failing with 6 unaccounted units, 79 non-saleable, 6 ambiguous, checksum recorded, and no data writes.~~
- [ ] Cross-reconcile every tier against orders, payment records, tickets, entitlements, assignments, shares, refunds, holdbacks, and shards; classify the authoritative sold quantity and every discrepancy.
- [x] ~~Run a sanitized read-only application-ledger trace for the two failing saleable tiers (Evidence 97); verify confirmed order/payment/ticket/entitlement parity, identify the stale payment-pending/converted-reservation state, and block automated repair because seeded historical sold totals lack an immutable baseline/provider/finance ledger.~~
- [ ] Produce reviewed report-only proposed repairs with before/after values, reason, source evidence, deterministic operation key, checksum, and rollback record.
- [ ] Back up affected staging documents and prove restore before mutation.
- [ ] Apply idempotent staging backfill with checkpoints, counts, checksums, retry proof, and zero unexplained difference.
- [ ] Wire Inventory V2 dual-write behind disabled-by-default flags for checkout, capture, verified failure/expiry, free/RSVP confirmation, processed full refund, share/revoke/reclaim, and cancellation.
- [ ] Shadow-read old and new inventory, alert on divergence, then enable controlled V2 reads only after the comparison window passes.
- [ ] Pass concurrent purchase, retry, duplicate callback, expired hold, refund, RSVP, share, revoke, and reclaim tests with no oversell or double restoration.
- [ ] Rehearse V2 rollback and document the exact disable/backout commands and owner.

#### 2B. Captured-payment truth and finalization

- [x] ~~Implement the pure provider-truth contract and deterministic callback/webhook/reconciler finalization identity.~~
- [x] ~~Implement the transactional finalization record, provider-order claim, webhook-event ledger, and one fulfill/release outbox intent foundation.~~
- [x] ~~Implement and locally validate the leased payment outbox worker primitive with stale-lease protection, bounded retry, dead-letter behavior, and injected handlers; keep it unwired from live routes.~~
- [ ] Verify callback signatures and fetch authenticated provider truth; do not treat a client callback, timeout, authorized status, or local signature alone as captured settlement.
- [ ] Require and transactionally deduplicate Razorpay webhook event IDs only after raw-body signature verification.
- [ ] Route app callback, webhook, and scheduled reconciler through the same finalization service.
- [ ] Implement idempotent fulfillment and release consumers that use Inventory V2 and durable ownership mutations.
- [ ] Add outbox scheduling, indexes, lease monitoring, retry metrics, dead-letter alerts, replay tooling, retention, and runbooks.
- [ ] Prove callback/webhook/reconciler reorder, duplicate, crash, concurrent delivery, provider outage, and worker restart on the Firestore emulator and staging.
- [ ] Ensure a captured payment can never be locally cancelled or have inventory released because of app timeout, offline state, process death, or response loss.

#### 2C. Refund and cancellation lifecycle

- [x] ~~Harden refund-request creation for owner/admin authority, exact paise, captured-payment evidence, processed-only refundable balance, deterministic idempotency, active conflicts, and atomic order pointer.~~
- [x] ~~Harden approval/rejection with transactional state transitions, self/duplicate approval prevention, one/two distinct authorized approvers, safe rejection restoration, and one deterministic provider-job outbox.~~
- [ ] Finish and independently validate the Razorpay refund provider client and refund outbox worker; partial/unreviewed source is not accepted as complete.
- [ ] Require captured provider payment truth immediately before refund execution and use Razorpay refund idempotency with the same key and payload on every retry.
- [ ] Implement `approved → processing` claim with lease, uncertain-result reconciliation, provider refund identity, and retry/dead-letter monitoring.
- [ ] Verify signed `refund.processed` and `refund.failed` webhooks and provider polling through one reconciler.
- [ ] Keep pending/uncertain refunds non-terminal; never show success or restore inventory before processed provider truth.
- [ ] On processed full refund, atomically record finance state, void tickets/QRs, assignments, active shares, entitlements and entry eligibility, restore Inventory V2 exactly once, and terminalize the order.
- [ ] On processed partial refund, record exact cumulative paise without invalidating/restoring the full order unless the approved product policy explicitly maps quantities.
- [ ] Replace the unsafe legacy cancellation path so missing payment IDs, provider failures, mock refunds, or response errors cannot mark a paid order cancelled.
- [ ] Reconcile pending audit markers into an idempotent audit store; alert on missing audit evidence.
- [ ] Pass owner/admin abuse, amount boundary, dual approval, rejection, provider 4xx/5xx/409, timeout, pending, processed, failed, webhook duplicate, crash, retry, partial/full, and concurrent refund tests.

#### 2D. Stale cart, payment, issuance, transfer, and share recovery

- [ ] Reconcile stale order `ORD-MR4A01JE-QP89X` against provider/payment/ticket truth; document the resolution before changing it.
- [ ] Implement scheduled stale payment/order cleanup with provider-truth lookup, safe reservation release, retry, alerting, and user-visible recovery.
- [ ] Prove cart edit/re-entry after expiry and eliminate phantom pending orders, tickets, and reservations.
- [ ] Ensure ticket issuance, booking codes, entitlements, wallet rows, chat membership, notifications, and finance ledger are idempotent and recoverable after post-commit failure.
- [ ] Model transfer, share, claim, decline, expiry, revoke, reclaim, link cancellation, RSVP and free-ticket capacity/ownership transitions with durable operation keys and outbox events.
- [ ] Pass simultaneous recipient claim/revoke/reclaim, sender cancellation, duplicate link open, expired link, already-used link, blocked user, account deletion, and crash recovery.
- [ ] Reconcile all historical staging orders/tickets/assignments/shares and attach counts/checksums.

#### 2E. Razorpay and subscription release configuration

- [ ] Remove `rzp_test_DEVELOPMENT` and every test-key fallback from production profiles, EAS configuration, backend startup, artifacts, logs, and fallback branches.
- [ ] Make production build/start fail closed unless approved restricted live public key, server secret, and webhook secret are present in the correct secret store.
- [ ] Restrict secret access, rotate exposed/test-mixed credentials, document owners, and scan source/history/artifacts/logs without printing secret values.
- [ ] Run signed-RC Razorpay test-mode matrix: success, user cancel, rejection, incorrect OTP, timeout, slow bank, offline, app kill, response loss, duplicate callback, webhook delay/reorder, provider outage, and retry.
- [ ] Run one controlled low-value live purchase and full refund only after legal/finance/operations approval, production monitoring, and rollback are active.
- [ ] If premium launches, configure store billing/RevenueCat products, entitlement webhook truth, restore purchases, upgrades/downgrades, cancellation, grace/billing retry, refund/revoke, account switch, and store review proof; otherwise remove or disable every purchase entry point.

Phase 2 exit gate: zero oversell; one canonical inventory authority; no double charge, ticket, refund, finalizer, ownership assignment, or inventory restoration; no captured-payment cancellation; every stale state reconciled; provider and local ledgers agree; production has no test fallback; rollback is proven.

### Phase 3 — Two-user physical-device QA

- [ ] Prepare Android User A and iPhone User B with separate accounts, verified phones, push tokens, and a recorded starting backend state.
- [ ] Event chat: join, history, simultaneous send, ordering, retry, duplicate suppression, unread, background notification, deep link, reconnect, and block/report.
- [ ] Private chat: request, accept, reject, pending restrictions, simultaneous action, message send, unread, background push, block/unblock, deletion and account switch.
- [ ] Nightlife: discovery visibility, request/like/match, profile edits, photo propagation, pause/re-enable, block/report, stale cache, and A/B account isolation.
- [ ] Transfer: sender initiates, recipient accepts/declines, expiry, cancel/retry, background notification/deep link, wallet removal/addition, QR/entitlement authority, and backend consistency.
- [ ] Share: link creation, OS share, cold/warm open, signed-out auth return, claim, duplicate claim, decline, expiry, revoke, reclaim, link cancellation, simultaneous recipients, and sender/recipient wallet sync.
- [ ] Verify every mutation across both screens, Firestore/order/ticket/entitlement/share records, notifications, and API logs.
- [ ] Repeat critical flows with devices backgrounded, force-stopped, offline/reconnected, and on different networks.

Phase 3 exit gate: all chat, Nightlife, transfer/share/claim, notification, deep-link, and wallet states converge across Android, iPhone, and backend with no privacy leak, duplicate ownership, or stale authority.

### Phase 4 — Backend performance, reliability, and cost

- [x] ~~Make measured auth synchronization single-flight and remove measured recommendation/host/venue/follow duplicate requests in Android staging.~~
- [x] ~~Capture a new connected-Android staging request/latency profile across the resumed QA window, with explicit qualification that repeated reloads are not one journey and slow-sample means are not production p95/p99.~~
- [ ] Instrument per-route Firestore reads/writes, Redis commands/bytes, Storage egress, SMS sends, provider calls, log bytes, CPU/memory, and external API usage.
- [ ] Define p50/p95/p99, error-rate, availability, payload-size, cache-hit, operation-count, and per-user cost budgets for every launch journey.
- [ ] Optimize cold boot, auth, Explore, recommendations, event detail, venue/host, profile, subscription, notifications, inbox/history, wallet, and cover-charge fan-out.
- [ ] Resolve the measured 10.84-second recommendation path and remaining multi-second event/subscription/auth paths.
- [ ] Add pagination, bounded payloads, compression, caching, cache invalidation, request coalescing, backpressure, timeouts, circuit breakers, and retry budgets where measured.
- [ ] Load test realistic browse/chat/checkout/share traffic plus spikes, hot events, cache loss, Redis failure, provider slowness, and webhook bursts.
- [ ] Calculate expected Firestore, Redis, Storage, SMS, logging, payment, and observability cost per daily/monthly active user and at launch-growth scenarios.
- [ ] Configure actual and forecast billing alerts, quotas, SMS spend limits, log-volume alerts, anomaly detection, automated notifications, and tested responder escalation.
- [ ] Record dashboards, alert tests, incident owner, capacity headroom, and cost-based launch stop thresholds.

Phase 4 exit gate: production-like load meets agreed SLO and per-user cost ceilings; cache/failure modes are safe; billing and anomaly alerts are tested with named responders.

### Phase 5 — Signed Android and iOS release candidates

#### Android

- [ ] Replace debug release signing; configure protected upload key and Play App Signing with documented recovery/access.
- [ ] Set immutable version name/code, production application ID, API origin, Firebase project, EAS channel/runtime, and commit provenance.
- [ ] Remove development launcher/tools, debug permissions, test behavior, placeholder credentials, and scanner-related consumer copy/configuration.
- [ ] Build signed AAB; record SHA-256, EAS/build ID, signing certificate, merged manifest, dependency lock, symbols, mapping, and environment manifest.
- [ ] Verify target/compile/min SDK, API 36 behavior, 16 KB native-page support, release shrinking/obfuscation, backup rules, edge-to-edge, predictive back, and Play-delivered install.
- [ ] Restrict Firebase/Google/OAuth/Maps credentials to production package and signing certificate.
- [ ] Verify FCM permission, channels, token rotation, logout cleanup, background delivery, and App Links from the signed build.
- [ ] Test Android 10/13/15/16, Samsung/Pixel/India-common OEM, low RAM, poor network, tablet/foldable or formally document supported form factors.

#### iOS

- [ ] Install/select supported full Xcode and required iOS SDK; remove development-client metadata.
- [ ] Configure App Store distribution certificate/profile, production APNs entitlement, bundle/version identity, associated domains, Keychain groups, capabilities, and export compliance.
- [ ] Audit `Info.plist`, usage descriptions, entitlements, privacy manifest, required-reason APIs, ATT decision, backup/keychain behavior, URL schemes, and universal links.
- [ ] Restrict Firebase/OAuth/Maps/provider credentials to production iOS identity.
- [ ] Archive and validate a distribution-signed IPA/TestFlight build; record archive checksum, symbols/dSYMs, build number, commit, environment, and signing identity.
- [ ] Verify APNs token registration/rotation/logout, background push, notification deep links, universal links, process death, Keychain restoration, and direct app startup.
- [ ] Test current supported iOS versions on small and large iPhones with 100%/200% text and VoiceOver.

Phase 5 exit gate: signed Android and iOS artifacts install from their distribution channels, launch directly into the consumer app, prove production identity/configuration, contain no test/debug/scanner behavior, and have reproducible provenance.

### Phase 6 — Production infrastructure, public policies, and deep links

- [ ] Restore production API DNS, TLS, health, Firebase/Redis/Storage access, WAF/rate limits, capacity, and monitoring from multiple Indian networks.
- [ ] Version and deploy production Firestore schema, rules, indexes, Storage rules, migrations, and compatibility window after backup/restore rehearsal.
- [x] ~~Prepare source routes for Privacy, Terms, Refund/Cancellation and Account Deletion; normalize the public support address and add footer discovery links. Guest-portal TypeScript and the Webpack production build pass, statically generating all four routes. Desktop and 390 × 844 browser checks pass one-main-landmark, no-overflow, readable text and link/email semantics after correcting nested landmarks and invalid opacity classes. This is source evidence only, not publication or legal approval.~~
- [x] ~~Add the current Next.js Sentry request-error hook, client/router initialization and App Router global error boundary. Guest-portal TypeScript and Webpack build pass without the prior missing-hook/global-handler warnings. Live DSN, symbolication, PII, retention and alert proof remain open.~~
- [ ] Publish production Privacy Policy, Terms, Refund/Cancellation Policy, Community Guidelines, Support, Grievance, and Account Deletion pages under the verified company domain.
- [ ] Make in-app and store policy/deletion/support links return 200 and match the current product/data practices.
- [ ] Publish Android `assetlinks.json` with the production signing certificate and Apple AASA with exact app/team IDs and paths.
- [ ] Maintain one typed deep-link registry across mobile, Android intent filters, iOS associated domains, backend links, notifications, and web fallbacks.
- [ ] Configure production FCM/APNs, crash/error reporting, source maps/symbols, analytics consent, PII scrubbing, retention, and alert routing.
- [ ] Enable production App Check/device attestation with Play Integrity and App Attest; remove debug tokens and test failure UX.
- [ ] Configure backups, restore validation, secrets management/rotation, kill switches, feature flags, deployment rollback, and incident runbooks.
- [ ] Verify every production endpoint, policy URL, App Link, Universal Link, notification, and deletion path from both signed RCs.

Phase 6 exit gate: production services and public URLs are healthy/monitored, associations and push pass from signed builds, data changes are rehearsed, and backup/rollback are proven.

### Phase 7 — Complete release-candidate QA

- [ ] Record exact Android/iOS RC commit, version/build, package/bundle, environment, API origin, Firebase project, signing identity, store track, and install source.
- [ ] Run clean install, upgrade from prior supported version, reinstall, logout/re-login, expired session, process death, background/foreground, reboot, low storage, and low memory.
- [ ] Run new user, returning user, incomplete user, auth interruption, onboarding, profile, permissions, Explore, search, event, Interested, checkout, wallet, tickets, chats, Nightlife, settings, support, legal, deletion, and deletion proof.
- [ ] Run normal, slow, lossy, offline/reconnect, DNS failure, TLS failure, provider timeout, API 4xx/5xx, Redis/cache failure, and retry behavior.
- [ ] Run the complete Phase 2 payment/ticket/refund/ownership negative and recovery matrix on both RCs.
- [ ] Run the complete Phase 3 two-user matrix on both physical devices.
- [ ] Pass 100%/200% fonts, TalkBack, VoiceOver, contrast, touch targets, focus order, dynamic content, safe areas, keyboard, rotation, RTL smoke, and screen-reader labels.
- [ ] Review crashes, ANRs, native logs, JS errors, API 5xx/4xx anomalies, payment mismatches, ticket mismatches, push failures, and data/cost deltas after every run.
- [ ] Resolve every P0; document every accepted P1 with owner, mitigation, monitoring, rollback trigger, and deadline.

Phase 7 exit gate: Android and iOS store-delivered RC matrices pass with no fatal crash, no unresolved P0, no payment/ownership inconsistency, and complete evidence.

### Phase 8 — Privacy, security, UGC, India legal, tax, and operations approval

#### Privacy and data rights

- [ ] Complete data/SDK/processor inventory for identity, contacts, location, DOB/age, Nightlife, photos, chat, tickets, payment metadata, notifications, diagnostics, analytics, and support.
- [ ] Map purpose, lawful basis/consent, collection screen, storage, encryption, access, sharing, retention, deletion, export, backup, processor, and cross-border transfer for every data element.
- [ ] Implement versioned Terms/Privacy/Community acceptance, consent withdrawal, notification/marketing preferences, data export, account deletion, deletion cascade, processor propagation, retention exceptions, and completion proof.
- [ ] Align runtime, privacy policy, Google Data Safety, Apple App Privacy, privacy manifest, permissions, analytics consent, and account-deletion declarations exactly.

#### Security and safety

- [ ] Run secrets/history/build/log scan, dependency/SCA/SBOM/license review, malware/artifact scan, mobile/backend/API penetration test, and remediation verification.
- [ ] Threat-model and test auth/OTP, account linking, App Check, checkout/webhooks, refunds, wallet/QR, transfer/share, chat/UGC, storage uploads, deep links, notifications, admin/support, and cost abuse.
- [ ] Enforce verified phone, rate limits, RBAC, object ownership, storage host/ownership rules, report/block, moderation, appeal, evidence preservation, and admin audit logs.
- [ ] Enforce 18+ entry/onboarding policy consistently and document age-handling, nightlife safety, prohibited content/conduct, emergency escalation, and venue/organizer responsibility.
- [ ] Rehearse security incident, payment mismatch, compromised credential, abusive user/content, data deletion failure, backup restore, and production rollback.

#### India legal and business approval

- [ ] Obtain India counsel approval for DPDP Act/current Rules and transition dates, consent/notice, children/age treatment, rights, breach, retention, processors, cross-border transfer, and grievance handling.
- [ ] Obtain intermediary classification and IT Rules approval for Terms, due diligence, report/block, takedown, grievance officer, timelines, GAC path, transparency, significant-intermediary contingency, and records.
- [ ] Implement CERT-In incident reporting/escalation, 180-day logs in India, time synchronization, evidence preservation, and tested 6-hour response decision process where applicable.
- [ ] Obtain consumer/e-commerce approval for merchant/marketplace role, seller/organizer disclosures, pricing, dark patterns, affirmative consent, cancellations/postponements/no-shows, refunds, complaints, and liability.
- [ ] Obtain CA approval for GST classification/rates, place of supply, invoices/receipts, credit notes/refunds, commissions/fees, TCS/ECO obligations, reconciliation, and record retention.
- [ ] Obtain payments/legal approval for Razorpay/RBI arrangement, merchant agreements, settlement/refund/chargeback handling, reserves, PCI/tokenization boundaries, and no card/CVV storage.
- [ ] Complete TRAI/DLT Principal Entity, sender/header/template, OTP/service/marketing separation, consent/DND, revocation, delivery, and spend/abuse controls.
- [ ] Obtain CS/corporate approvals for legal entity, contracts, authorized signatory, bank/tax identity, IP/licenses, vendor DPAs, organizer/venue due diligence, and indemnities.
- [ ] Allocate state/city/venue responsibility for event, police, fire, occupancy, entertainment, liquor/dry-day/alcohol-age, music/public-performance, accessibility, and local tax/licences.
- [ ] Publish verified legal entity, address, customer care, grievance officer, support SLA, complaint tracking, refund escalation, and emergency contacts.

Phase 8 exit gate: written engineering/security/privacy/legal/CA/CS/finance/operations approvals, tested rights and incident processes, no unresolved security blocker, and no unowned legal or tax requirement.

### Phase 9 — Google Play and Apple App Store submission

#### Google Play

- [ ] Verify organization developer account, identity, payments profile, agreements, access controls, Play App Signing, upload key, recovery, and developer-contact details.
- [ ] Create production app record, package, countries, pricing, category, title, short/full descriptions, icon, feature graphic, phone/tablet screenshots, support URL/email, privacy/deletion URLs, and release notes.
- [ ] Complete Data Safety, account deletion, target audience, ads, content rating, UGC, permissions, financial features, health/children applicability, and app-access declarations from the verified data inventory.
- [ ] Configure internal and closed testing, tester access, reviewer account/OTP, seeded fixtures, payment instructions, pre-launch report, Android Vitals, managed publishing, and review notes.
- [ ] Upload signed AAB, mapping/native symbols, verify target API/16 KB/signing/permissions, resolve all warnings, and archive console evidence.
- [ ] If subscriptions ship, configure Play products/offers, base plans, pricing/tax, licensing testers, acknowledgement, restore, server notifications, and policy-compliant entitlement handling.

#### Apple App Store

- [ ] Verify organization membership, legal entity, agreements/tax/banking, roles, certificates/profiles, bundle ID, capabilities, and App Store Connect record.
- [ ] Complete name/subtitle, category, description, keywords, promotional text, icon/screenshots, support/marketing/privacy URLs, copyright, age rating, content rights, and release notes.
- [ ] Complete App Privacy, privacy manifest consistency, account deletion, Sign in with Apple applicability, ATT/tracking decision, encryption/export compliance, UGC, payments, and reviewer-access declarations.
- [ ] Upload validated archive/TestFlight build and dSYMs; resolve processing/privacy/API warnings and archive evidence.
- [ ] Run internal/external TestFlight, stable reviewer account/OTP, seeded fixtures, payment instructions, deletion path, review notes, contact, and 24/7 backend availability.
- [ ] If subscriptions ship, configure products/groups, pricing/tax, review screenshots, sandbox testing, restore, server notifications, grace/billing retry, refunds/revocation, and entitlement truth.

Phase 9 exit gate: both submissions are complete, accurate, reviewer-testable, backed by console evidence, and contain the exact RCs accepted in Phase 7.

### Phase 10 — Controlled production launch

- [ ] Obtain final signed GO from product, engineering, Android, iOS, backend, QA, security, privacy, trust and safety, operations, payments, finance, India counsel, CA, CS, release manager, and executive sponsor.
- [ ] Confirm zero open P0s and approved P1 register; retest anything changed after final approval.
- [ ] Confirm launch dashboards, on-call rota, support/trust-safety/payments/legal contacts, incident channel, escalation tree, and store-review monitoring.
- [ ] Confirm kill switches for checkout, refunds, transfers/shares, chat, Nightlife, subscriptions, notifications, and risky providers.
- [ ] Rehearse backend/config/OTA/schema/index/rules/payment rollback and verify backup restore plus RPO/RTO.
- [ ] Release through internal/closed/TestFlight first, then a deliberately limited public cohort/geography/marketing window.
- [ ] Monitor crash/ANR, auth/OTP, API latency/5xx, payment conversion/mismatch, ticket issuance, inventory divergence, refunds, chat delivery, push, moderation, Firestore, Redis, Storage, SMS, logs, and total/forecast cost.
- [ ] Stop or roll back immediately when an agreed threshold is crossed; record decision, owner, incident, customer impact, and reconciliation.
- [ ] Expand only after the defined observation window remains healthy and product/engineering/operations approve the next cohort.
- [ ] Complete 24-hour, 72-hour, and 7-day reviews covering metrics, costs, store feedback, support, abuse, refunds, incidents, reconciliation, and corrective actions.

Final done state: zero unresolved P0 defects; every mandatory gate PASS or formally excepted; accepted P1s owned and monitored; signed Android/iOS artifacts and production infrastructure proven; legal/security/store approvals attached; controlled rollout stable; rollback remains available.

## Executive verdict

The exercised staging build now supports seeded discovery, returning-user authentication, real Razorpay test checkout, payment-response recovery, reservation cancellation, wallet issuance, ticket transfer, link sharing, claim/revoke/reclaim, event chat, accepted private chat, profile, settings, and permissions on the connected Android device.

The clean consumer/onboarding/Nightlife paths now have no known unresolved P0 in the tested Android development-build functional scope. The dedicated identity completes, restores, logs out/re-authenticates, retains isolated Nightlife state, and opens the active editor with the normal Profile visibility/Pause control; choosing Keep Active preserves the profile. Typed bootstrap/CTA and route-intent hardening have focused coverage, but revisit, 200%, signed RC, iOS and two-device acceptance remain open. Overall launch readiness is still **P0 blocked** by Phase 2 inventory/payment integrity and the production/infrastructure blockers below.

The canonical first-time Nightlife flow is now the five-screen wizard: Intro → Vitals → Vibes → Prompts → Photos. The single-page Nightlife screen is retained only as the editor for an already-active profile. On the connected Samsung, authenticated upload/activation, persisted editing, offline draft/retry, pause and re-enable pass. The P0/P1 account-isolation failure is remediated on Android staging: stores are UID owned, logout/account switch clears state, in-flight responses are invalidated, self/stale actions are guarded, 6/6 focused and 27/27 combined tests plus mobile TypeScript pass, and physical A→B→A showed Phase empty, Deepak correctly seeing Phase, then Phase empty again (Evidence 81, 84–85). Signed RC, iOS, reinstall, real two-user discovery interactions, moderation/deletion lifecycle, accessibility, and two-device proof remain open.

The resumed clean-bundle Android pass also closed search, host/venue route semantics, NOWL search, accepted-DM history/send/reopen, exact paise, wallet auth return, development build identity, account isolation and auth/recommendation/detail request-count duplication. A genuine 5,534-module Metro bundle handled two rapid host intents with one 37.85 ms GET and one Back to Explore; two rapid venue intents produced one 1,274.7 ms venue GET plus one 620.5 ms follow GET and one Back to Explore (Evidence 91–94). These are Android development-build results only; load, signed RC, associations, iOS and two-device behavior remain open.

The 19 July regression used an empty Metro transform cache and a genuine 4,863-module bundle after identifying Watchman dropped-event drift. Physical evidence 14/17 proves the private-DM layout fix plus send/reopen persistence. Evidence 23 proves the Pune Venues rendering after the discovery fix; the accompanying clean network trace contains one `/public/venues?city=Pune` and one `/events?city=pune` request across Explore → Venues, with only `/users/me/follows` added on tab entry. Evidence 24 proves the internal Permissions deep link now opens the intended screen. These checks do not close the remaining denial/error/accessibility, signed-RC, iOS, or two-device rows.

Phase 2 read-only tracing escalates the release decision. Availability is **not authoritative**: `getBaseRemaining` prefers stale `inventory.soldQuantity`, producing event05 t1 availability 457 instead of persisted 454 and event02 t2 availability 13 instead of 10, so oversell is possible; parent and shard accounting can also double-count. Cancellation/refund/failure/finalization paths can mark state incorrectly, restore inventory after a captured payment, omit ownership/amount/idempotency controls, compete between verify and webhook, and fail to void tickets/shares/entitlements. A production fallback still contains `rzp_test_DEVELOPMENT`. No data was changed during this trace.

Phase 2 foundations are now source-implemented but deliberately **not credited as P0 closure**. Inventory V2 defines an invariant, transaction primitive, parent-mirror/shard-allocation guards and focused tests, but its flags are off and production routes are unwired. Refund request plus transactional approval/rejection now enforce authority, exact money and balance checks, replay/conflict controls, safe rejection restoration and a deterministic provider outbox job. The Razorpay provider adapter and leased provider worker now have 16 focused adversarial tests covering exact paise, captured-payment proof, balance exhaustion, deterministic idempotency, ambiguous network truth, reconciliation, exact leases, stale completions, retries, dead letters, processed effects-job creation and safe failed-refund restoration; core TypeScript passes. This is source proof only: live route/scheduler/webhook wiring, verified provider credentials, processed ticket/inventory/ownership effects, and physical negative-payment evidence remain open. A unified finalization contract and leased outbox-worker primitive exist and test cleanly, but app verify/webhook routes, provider truth, scheduler and idempotent consumer remain unwired. Evidence 96 now supplies the missing lifecycle-aware scope: of 105 finite tiers, 20 are currently saleable, 18 are balanced and exactly 2 fail with 6 unaccounted units; 79 are non-saleable and 6 are ambiguous due to conflicting sources. Evidence 97 confirms application-ledger parity for completed purchases but proves the seeded historical sold totals lack an immutable baseline/finance ledger, so no automatic repair is safe; it also confirms the stale payment-pending order/converted-reservation state. The public tier boundary now source-fails closed for non-canonical and elapsed events, with 44 focused tests and core TypeScript passing. No data changed.

The source-level release configuration also requires correction and release-artifact proof: Android release currently points at the debug signing configuration; iOS was generated with development APNs entitlement and development-client metadata; the current machine has Command Line Tools rather than a selectable full Xcode installation; production app-store listings were not discoverable; permissions and privacy declarations do not match observed use; and all required production policy/association paths still return 404. Privacy, Terms, Refund/Cancellation and Account Deletion source routes are now prepared and TypeScript-clean, but this does not count as publication or legal approval.

Production promotion remains blocked until every mandatory gate in Section 4 and Sections 16–29 is PASS or has a written, owner-approved exception. Completing the checklist makes the build eligible for submission and controlled rollout; it cannot guarantee Apple/Google approval, legal immunity, or defect-free operation.

## 1. Dependency-ordered execution dashboard

This dashboard is the operating order. It preserves the user-approved sequence as the current Phase 1 followed by nine downstream launch phases. Detailed requirements and evidence remain authoritative in Sections 4 and 13–29. A later phase may prepare in parallel, but it cannot receive PASS before every dependency and its exact release-candidate evidence are complete.

| Phase | Status | Work in execution order | Dependency and acceptance gate |
|---|---|---|---|
| 1. Finish Android functional QA | IN PROGRESS | The 18–19 July physical passes add Location/Notification revoke-and-recover, reversible profile edit/restore, logout, supplied-account login, returning-user routing, force-stop restoration, exactly one auth-sync, clean private-DM send/reopen without exposed action panes, canonical Pune venue/event discovery with duplicate-read suppression, and a passing internal Permissions deep link. Search/chat/wallet/Nightlife, A→B→A isolation, active-editor Pause/Keep Active, truthful build identity and host/venue single-flight/back retain prior Android staging evidence. Remaining: full fixture matrix, Nightlife state-changing retry/draft retest, and complete permission/error/accessibility branches. | Current physical evidence is a debuggable Expo development client; direct cold launch opens Dev Launcher. The latest DM, city/discovery and Permissions changes have clean 4,863-module bundle regression evidence. Signed RC, load, associations, iOS and two devices remain open; overall audit remains P0 blocked by Phase 2. |
| 2. Complete payment and ticket integrity | BLOCKED — P0 | Inventory V2 invariant/transaction/guards, hardened refund request/approval/rejection, unified-finalizer contracts, Razorpay provider adapter and leased provider/finalization workers are implemented/tested foundations. Lifecycle-aware Evidence 96 narrows current exposure to 20 saleable tiers: 18 balanced, 2 failing with 6 unaccounted units; 79 non-saleable and 6 source-ambiguous. The public tier boundary now source-fails closed for non-canonical/elapsed events. Flags/live routes/credentials/schedulers/webhook consumers and terminal ticket/inventory/ownership effects remain unwired. Continue in order: cross-ledger reconciliation and reviewed repair/backup/restore/backfill; enable dual-write/read safely; route verify/webhook through one finalizer; wire provider-backed refund/cancellation effects; implement RSVP/share once-only/outbox; then reconcile stale orders and run the negative matrix. | PASS requires no oversell, one canonical invariant, no double finalizer/charge/ticket, no captured-payment cancellation, exact refund/void/restoration, durable scheduled delivery/idempotency, reconciled data and no test-key fallback. Evidence 96 is read-only; no data changed. Passing unit tests do not substitute for provider/webhook/physical proof. |
| 3. Run two-user physical-device QA | BLOCKED | Use separate Android and iPhone accounts for event/private chat, request/accept/reject/block, unread/background push, deep links, transfer, share/claim/decline/expiry/revoke/reclaim, wallet sync, and Nightlife discovery/match rendering. | Depends on Phases 1–2 and two release-capable physical devices. API-only multi-user evidence cannot close this gate. |
| 4. Harden backend performance and cost | IN PROGRESS | Measure operations/bytes per journey; remove cover-charge/bootstrap duplication; optimize recommendations plus events/subscription/auth; define/load-test p50/p95/p99 and cost ceilings; configure alerts. | Auth, recommendation and host/venue/follow request counts pass Android staging. The latest repeated-lifecycle sample still shows 3.20 s auth, 2.52 s subscription, 2.33 s events and 4.61 s recommendation slow-route means; an older recommendation reached 10.84 s. Production load, operation counts, cache-failure behavior and billing response remain open. |
| 5. Build signed release candidates | BLOCKED | Freeze a clean reproducible commit; make CI fail closed; isolate the consumer build from the deferred scanner pipeline; govern and sign OTA updates; produce a signed Android AAB and distribution-signed iOS archive with matching identity, production APNs/push, links, symbols, manifests and production configuration. | Depends on stable implementation, approved production secrets and versioned infrastructure. Debug/dev-client proof is not release proof. |
| 6. Restore production infrastructure | BLOCKED | Privacy, Terms, Refund and Account Deletion source routes now build and render locally, but production still returns 404. Restore production API DNS/TLS/health; deploy counsel-approved policies/support, `assetlinks.json` and AASA; align the deep-link route registry; configure native App Check/attestation, Sentry, push, consent, backups, rollback and production migration rehearsal. | Must pass externally from both signed builds before reviewer or public traffic. Source preparation is not publication evidence. |
| 7. Run complete release-candidate QA | BLOCKED | Repeat new/returning user, onboarding, Explore, event, interested, checkout, chats, Nightlife, profile, settings, tickets and deletion; test clean install/upgrade, process death, expired session, background, slow/offline/server failures; pass 100%/200% fonts, TalkBack/VoiceOver, safe areas, keyboard, contrast and touch targets. | Depends on Phases 2–6. PASS requires the exact Play/TestFlight-delivered artifacts and no fatal crash. |
| 8. Close privacy, security and India requirements | BLOCKED | Complete data inventory/deletion/retention, secrets/dependency/SBOM/penetration testing, UGC/18+/moderation/grievance, incident/backup/restore drills, DPDP/IT Rules/CERT-In/consumer/GST/TRAI/RBI/entity/contract/state-event review and written counsel/CA/CS approvals. | Engineering cannot self-approve legal or tax gates. Every applicable row in Sections 22–27 needs named evidence or a signed exception. |
| 9. Complete Google Play and App Store submission | BLOCKED | Complete organization accounts, agreements, listings, screenshots, reviewer credentials, Data safety/App Privacy, age/content ratings, deletion declarations, store billing/subscriptions, testing tracks, pre-launch report, TestFlight and review instructions. | Depends on the signed RC, published policies, reviewer-safe fixtures and Phases 7–8. Both submissions must be reviewer-testable. |
| 10. Controlled production launch | BLOCKED | Internal/closed/TestFlight → limited managed release → monitored expansion; watch crash/ANR, API, payment, issuance, SMS, Firestore, Redis and billing; enforce kill switches, stop thresholds, rollback and 24h/72h/7d reviews. | Zero P0s, mandatory gates PASS or signed exception, accepted P1 ownership/mitigation, tested rollback, on-call coverage and executive GO. |

Scanner boundary: the scanner product remains **DEFERRED** under G15. Its source, runtime and certification are not part of these phases. The consumer-mobile release workflow must be separated so a mobile release neither builds nor submits the scanner product implicitly.

## 2. In progress

1. API-read and cost review — wallet, Chat inbox, auth, recommendations and host/venue/follow detail counts are measured/optimized; 10.84-second recommendations, event/subscription latency, cold boot, cover-charge fan-out, operation counts, load and production telemetry remain.
2. Phase 2 P0 payment/ticket integrity — Evidence 96 isolates two currently saleable failing tiers with six unaccounted units. Evidence 97 traces the application ledger but blocks repair because historical seeded sold totals lack an immutable baseline/provider/finance ledger; it also reconfirms the stale pending order. Inventory V2 and finalization/refund foundations remain off/unwired. Execute only in order: obtain provider and baseline authority, finish cross-ledger classification, report-only repair/backup/restore/backfill, controlled dual-write/read, route/provider/reconciler/outbox wiring, refund processed effects, RSVP/share once-only/outbox, then stale-order/cart/negative-payment reconciliation. No data mutation has occurred.
3. Chat date canonicalization and wallet UI edge-case resolution.
4. Phase 1 clean-new-user Android execution — consumer onboarding, logout/re-login, profile/permissions, canonical Pune cold start, Nightlife create/edit/offline/pause/re-enable, and physical A→B→A account isolation pass. Typed bootstrap snapshot and CTA geometry source checks pass; physical revisit/200% font, remaining denial/error branches, signed release, iOS and second-device proof remain.
5. Production observability, billing-alert, and operational rollback planning.
6. Android/iOS release engineering, store-console, privacy, payments, UGC, and India legal closure.
7. Production API, public policy URL, account-deletion URL, and verified deep-link association remediation.
8. Returning-user Android triage: search, host/venue routes, DM persistence, NOWL, paise, wallet, build identity, auth/recommendation/detail request counts and fixture reseed pass to stated development scope. Full fixture review, load, signed RC, associations, iOS and two-device behavior remain.
9. Nightlife physical acceptance: creation/upload/persistence, editor Save, offline retry, pause/re-enable, A→B→A isolation and normal active-editor Profile visibility/Pause/Keep Active routing pass on Android staging. Remaining sheets, real discovery/match matrix, signed RCs, accessibility, deletion and two devices remain.

## 3. Done

1. ~~Confirmed `apps/mobile-app/lib/demo/index.ts` as the 13-event fixture authority and corrected all event date ranges.~~
2. ~~Rebuilt the staging seed path with validation, bundled poster uploads, ticket inventory, event details, host summaries, and venue summaries.~~
3. ~~Seeded 13 events, 6 hosts, and 12 venues into `c1rcle-staging`; discovery, details, and ticket tiers return the fixtures.~~
4. ~~Connected the Samsung device over USB, restored ADB reverse for gateway and Metro, opened the app, and retained a stable authenticated session.~~
5. ~~Verified returning-user login, logout, login-after-logout, profile restore, and protected API access with the staging test account.~~
6. ~~Verified Explore, active and ended event detail, ticket-tier loading, interested/uninterested mutation, and canonical future dates on Android.~~
7. ~~Corrected Razorpay amount units to an explicit `amountPaise` contract across gateway and mobile.~~
8. ~~Opened the real native Razorpay activity, used the supplied test card, completed mock-bank success, and confirmed the ₹1,087.42 provider amount.~~
9. ~~Confirmed order `ORD-MRO9ZOZL-F5TYN`, booking `#HW3XD7`, payment verification, one ticket, one entitlement, and reservation release.~~
10. ~~Fixed the post-commit undefined-value serialization failure that returned HTTP 500 after successful payment.~~
11. ~~Added mobile payment-response reconciliation so a committed purchase is recovered instead of cancelled or purchased again.~~
12. ~~Verified native cancellation, idempotent cancellation retry, reservation release, no ticket issuance, and terminal payment-state cleanup.~~
13. ~~Fixed deterministic wallet ordering, deployed the required staging index, and prevented a new purchase from being hidden behind historical rows.~~
14. ~~Verified the paid ticket appeared under Upcoming, displayed buyer ownership honestly, and revealed the entry QR with the same booking code.~~
15. ~~Transferred a canonical ticket from User A to User B and verified sender removal, recipient assignment, entitlement ownership, and recipient wallet output.~~
16. ~~Fixed wallet aggregation so transferred and shared recipients receive their assignment while the sender cannot retain the same slot.~~
17. ~~Fixed the Android Share Claim Link sheet crash and created a real three-ticket claim link from the device.~~
18. ~~Verified User B claim, duplicate-claim idempotency, unauthorized revoke denial, owner revoke, recipient removal, and sender capacity restoration.~~
19. ~~Issued a clean purchaser replacement entitlement when a claimed slot was revoked and backfilled the one affected staging slot.~~
20. ~~Created User C, claimed the reopened slot, reclaimed the unclaimed slot, cancelled the link, and preserved exact final ownership: A 2, B 0, C 1.~~
21. ~~Backfilled 298 assignment timestamps and normalized signed QR payload objects to strings for mobile rendering.~~
22. ~~Verified valid, revoked, and already-used backend ticket-state handling during the mobile ownership QA cycle; this is not scanner-product certification.~~
23. ~~Exchanged active event-chat messages in both directions between Users A and B, including an Android send and independent receipt.~~
24. ~~Enforced event-chat entitlement before join.~~
25. ~~Verified private request, pre-accept send denial, accept, and bidirectional private messaging.~~
26. ~~Blocked non-participants and pending/expired conversations from private-chat sending.~~
27. ~~Fixed the mobile private-message wire contract from `content` to `text` and stopped silent send failure.~~
28. ~~Fixed the mobile WebSocket AUTH/SUBSCRIBE race and resubscription after `AUTH_SUCCESS`.~~
29. ~~Added per-topic WebSocket authorization for event chat, accepted DMs, workspaces, and privileged operational topics.~~
30. ~~Separated customer `event-chat:*` traffic from operational `event:*` broadcasts.~~
31. ~~Live-verified authorized User B subscriptions and unauthorized User C denials for both event chat and private DM.~~
32. ~~Secured typing reads/writes against anonymous access, non-participants, and client-selected display-name spoofing.~~
33. ~~Moved normal typing delivery to WebSocket with disconnected-only fallback polling.~~
34. ~~Removed Chat inbox per-card history polling; a clean Android reopen issued only `/social/matches` and `/social/my-chats`.~~
35. ~~Fixed false `ENDED` chat metadata by preferring the canonical event lifecycle.~~
36. ~~Added Redis wallet caching, mutation-driven invalidation, and proved the `HIT → MISS → HIT` lifecycle.~~
37. ~~Removed redundant 45-second ticket-wallet and ticket-detail refresh timers.~~
38. ~~Fixed Redis first-command readiness; gateway health now reports Firestore and Redis healthy.~~
39. ~~Removed routine rate-limit warning spam and capability/OTP logging identified during the audit.~~
40. ~~Verified profile attendance reconciliation, readable interest labels, Settings, Blocked Accounts, and honest permission status.~~
41. ~~Passed the latest 22/22 share/revoke/wallet safety regression, including expired-link and simultaneous last-slot claims.~~
42. ~~Passed the Chat store regression after removing per-card polling; gateway and mobile TypeScript checks are clean.~~
43. ~~Updated this file into the single authoritative mobile launch checklist and removed contradictory historical status sections.~~
44. ~~Inspected the effective Expo SDK 55 public configuration, Android permissions, iOS privacy declarations, package/bundle identifiers, versioning, runtime policy, and production build profile.~~
45. ~~Inspected Android native release signing, merged debug manifest, minimum/target SDK evidence, sensitive permissions, app-link configuration, backup behavior, and available artifacts.~~
46. ~~Inspected iOS deployment target, Info.plist, entitlements, privacy manifest, associated domains, Apple Sign In, APNs environment, development-client residue, tablet support, and local Xcode availability.~~
47. ~~Ran the repository launch-readiness suite and Expo public-config resolution; code checks passed while external push, native payment, signed build, and store proofs remain open.~~
48. ~~Probed production API, public legal/account-deletion URLs, store listing URLs, and Android/iOS association endpoints; failures are recorded as launch blockers rather than treated as passes.~~
49. ~~Reviewed premium purchase, RevenueCat sync/restore, Razorpay payment classification, account deletion, Spotify authorization, analytics/tracking, UGC report/block, and age-gate implementation.~~
50. ~~Mapped current official Google Play, Apple App Store, Android platform, and India government requirements into mandatory evidence-based launch gates.~~
51. ~~Expanded this canonical audit to cover Android, iOS, Google Play, App Store Connect, India legal/regulatory readiness, security, privacy, operations, and staged rollout without modifying scanner functionality.~~
52. ~~Resumed the physical Android audit against the exact `.nosync` working tree; verified Samsung SM-G980F, Android 13, ADB reverse 4000/8082, staging Firestore/Redis health, dev-client identity, and cold-launch behavior.~~
53. ~~Re-ran the returning-user Android path through Explore, event detail, persisted checkout, event-chat send, private chat, Nightlife, Tickets/QR, Venues, Profile, Settings, Permissions, logout, phone OTP re-login, and stored-session reopen; evidence is retained under `qa-artifacts/evidence`.~~
54. ~~Started Phase 1 with a dedicated clean staging Firebase test identity; verified phone OTP, new-user routing, optional-email skip persistence, 18+ picker maximum, Firebase session restoration after process death, and deterministic resume to identity; captured the identity-contract blocker and timed relaunch evidence under `qa-artifacts/evidence/03-new-user/2026-07-17T184000Z-sm-g980f`.~~
55. ~~Audited every downstream consumer-onboarding request contract after the identity blocker; city, tastes, intent, and completion payloads align at source, while Nightlife profile vitals, routing/taxonomy, and photo persistence defects are recorded as R39–R41 before device execution.~~
56. ~~Re-ran 31 focused first-run, release-control, auth-routing, and auth-store tests; all passed, confirming that the current suite misses the identity screen's timestamp serialization and Nightlife request-contract failures found by physical/source QA.~~
57. ~~Replaced identity timestamp serialization with local calendar `YYYY-MM-DD` formatting and strict date-only parsing; added leap-day, invalid-date, and round-trip regression coverage; mobile TypeScript passed.~~
58. ~~Reproduced onboarding-completion HTTP 500 to `JSON.parse('')`, made the mobile API omit JSON content type when no body exists, hardened the gateway raw-body parser for an empty body, and proved the same physical-device completion request returns HTTP 200.~~
59. ~~Completed clean consumer onboarding on the connected Samsung: exact 18-year DOB boundary, Pune, three canonical tastes, one intent, completion, and Explore landing; Firestore retained the exact date-only value and canonical completed state.~~
60. ~~Force-stopped the completed account, cold-opened the development client, selected the scoped Metro server, and verified the restored Firebase session returns directly to Explore without OTP or onboarding replay; retained screenshot and UI-hierarchy evidence.~~
61. ~~Passed 32 focused mobile tests, 8 focused gateway tests, gateway TypeScript, and mobile TypeScript after the Phase 1 fixes.~~
62. ~~Physically exercised both Nightlife creation experiences on the connected Samsung and captured their terminal HTTP 400 failures, exact request IDs, screenshots, and UI hierarchies; confirmed that the defects are deterministic mobile/API contract mismatches rather than device or network instability.~~
63. ~~Implemented the canonical Nightlife source contract: first-time Settings/Profile entries open the five-screen wizard, active profiles open `/profile-creation` for editing, prompts/vitals/vibes/photos/activation are validated consistently, and consumer `vibeTags` remain isolated from `nightlifeVibeTags`.~~
64. ~~Replaced device-local Nightlife photo persistence with authenticated UID-scoped gateway upload, image MIME/2 MB/rate limits, HTTPS profile URL validation, maximum-six enforcement, and active-profile last-photo protection.~~
65. ~~Made Nightlife discovery prefer portable `datingPhotos`, expose only Nightlife vibes, bridge only recognized legacy Nightlife labels, and derive age from date-only DOB instead of the mobile fallback age 25; added focused regression tests.~~
66. ~~Physically verified that incomplete Nightlife publish is stopped by the client with an exact missing-field alert and no API request; retained screenshot/UI evidence.~~
67. ~~Removed the Android `ScrollView` child-layout invariant from the shared Nightlife sheet implementation and passed mobile, gateway, and core TypeScript plus 7/7 focused Nightlife service tests; physical sheet acceptance remains open under R46.~~
68. ~~Restored and physically traversed the canonical Nightlife wizard on the connected Samsung: Intro → Height/Pronouns/Lifestyle → Vibes → Prompt → Photos.~~
69. ~~Reproduced the valid physical upload 500, traced it to the nonexistent `fastify.firebase.storage()` runtime path, changed the route to decorated `fastify.storage.bucket()`, and proved the retry returned 200.~~
70. ~~Reproduced the valid activation 400 after upload, identified stale compiled core output still enforcing gender/location, rebuilt the core runtime, and proved the same Android activation returned 200.~~
71. ~~Verified Firestore persisted `datingActive`, `nightlifeProfileComplete`, `socialSetupComplete`, Height/Pronouns/Lifestyle, two `nightlifeVibeTags`, one prompt, and the uploaded HTTPS `datingPhotos`; the returned JPEG independently fetched as HTTP 200 `image/jpeg`.~~
72. ~~Verified Settings → Nightlife Profile opens the single-page editor only after activation and displays the saved Pronouns, Lifestyle, and Nightlife vibe taxonomy.~~
73. ~~Separated Nightlife `datingPhotos` from basic-profile `photos`, removed the accidental QA mirror from the staging test account, retained the Nightlife photo, and added core regression coverage for independent arrays.~~
74. ~~Retained scanner functionality untouched throughout Nightlife remediation and device QA.~~
75. ~~Fixed private-profile hydration so a partial `/auth/sync` response cannot mark `/users/me` as loaded or erase saved Nightlife photos, vitals, vibes, and prompts from the returning-user editor; passed 26/26 focused profile-store regressions and mobile TypeScript.~~
76. ~~Clean-rebuilt Metro, physically reopened the active Nightlife editor with the uploaded photo, `4'3\"`, `She/Her`, `Social Drinker`, `Techno`, and `Bollywood`, saved it through request `50bb2ad8-2c62-42f6-b9b4-daef37752e44` (200), and reverified Firestore retained `photoURL=null`, `photos=[]`, and the Nightlife URL only in `datingPhotos`.~~
77. ~~Physically verified Android Settings permission truth and refresh: Contacts honestly reports unavailable, Location/Push reflect enabled state, Camera opens the app-specific system-settings path, grant refreshes to Enabled, and revoke/process restart refreshes to Disabled; scanner functionality remained untouched.~~
78. ~~Physically edited the Phase One QA basic profile, saved and rehydrated the exact bio through request `46d8082a-0574-4f59-9b58-a2e765bfa05b` (200), then reverted it through `bfea7a77-b90e-4085-ba45-830ac289d27d` (200).~~
79. ~~Fixed Explore's full-profile hydration race so canonical profile city initializes the first feed without overwriting an explicit in-session selection; 3/3 focused tests and mobile TypeScript pass, and a clean physical cold start showed Pune while request `6296ca12-89e3-4810-9e11-756302114ddb` fetched `/events?city=pune&limit=24&sort=soonest` (200).~~
80. ~~Physically verified staging search across Events, Venues, and Hosts after aligning the max-24 contract; exact result navigation opened the intended host profile. Evidence 28–31.~~
81. ~~Physically verified the host route renders the canonical upcoming event using India-local date/time, and exact `NOWL` search retains the spotlight venue in results. Evidence 34–35.~~
82. ~~Physically verified checkout displays exact paise throughout the receipt and CTA: ₹999.00 plus ₹88.42 equals ₹1,087.42. Evidence 36. The contradictory fixture remains separately open.~~
83. ~~Physically verified signed-out Tickets shows a login-required state and Sign In returns the authenticated user to the wallet. Evidence 37–38.~~
84. ~~Verified auth-sync request-count single-flight on staging: exactly one cold-launch request and exactly one returning phone-login request. Latency and load/cost acceptance remain open.~~
85. ~~Physically verified the accepted private-chat inbox, existing history, new send, back navigation, and reopen persistence on the connected Android. Evidence 40–46. Two-device, reconnect, pagination, push, unread, and block behavior remain open.~~
86. ~~Logged out and re-authenticated the dedicated Phase account, then verified it returned to its own legitimately empty Tickets wallet instead of another user's wallet. Evidence 51–57.~~
87. ~~Physically rehydrated the active Nightlife editor, changed Height from `4'3\"` to `4'4\"`, saved and reopened the persisted value, then reverted it. Evidence 59–63.~~
88. ~~In airplane/offline conditions, Nightlife Save showed `Could not publish profile` / `Network request failed`, preserved the `4'3\"` draft, and succeeded after connectivity returned. Evidence 64–69.~~
89. ~~Physically paused Nightlife so `datingActive=false` while retaining the profile, then completed multi-step re-enable with the prior vitals, vibes, prompt, and photo restored and `datingActive=true`. Evidence 70–79.~~
90. ~~Clean-relaunched the Phase account on the connected Android with no fatal/ANR and exactly one auth sync: request `edd5257f-e59e-45f0-9ec6-0d47783b46e1`, HTTP 200, 3.90/3.91 seconds. Evidence 80.~~
91. ~~Remediated UID ownership, account-switch/logout clearing, in-flight invalidation and self/stale Nightlife action guards; passed 6/6 focused, 27/27 combined dating/auth tests and mobile TypeScript, then physically passed A→B→A isolation in Evidence 81, 84–85.~~
92. ~~Derived Settings build identity from the native runtime; Evidence 82 shows App Version 1.0.0, Build Version 1 and Runtime Development client. Signed-release identity remains open.~~
93. ~~Physically passed development Android route semantics for `c1rcle://host/demo-host-03` and `c1rcle://venue/demo-venue-nowl`, rendering Quantika/Friday Gin Party and NOWL/Bollywood Night respectively. Evidence 86–87; association and signed-RC proof remain open.~~
94. ~~Added UID/query recommendation single-flight with stale-account clearing; passed 4/4 focused, 35/35 combined tests and mobile TypeScript. Evidence 88 emitted exactly one recommendation GET. Its 10.84-second latency remains blocked.~~
95. ~~Completed source remediation for the typed onboarding bootstrap snapshot, defined-field merges, saved-city revisit and measured first-run CTA/safe-area/large-text geometry; core 234/234, gateway onboarding 5/5, mobile focused 25/25 and gateway/mobile TypeScript pass. Physical revisit/200%/signed-RC acceptance remains.~~
96. ~~Corrected and reseeded the canonical fixture source to 13 future events, 13 unique hosts and 12 venues/read models; event05 now aligns Bollywood/NOWL/Pune/Sunday 2 August semantics, and reseed preserved live tier counters. Full reviewer screenshot/content acceptance remains open under G1.~~
97. ~~Clean-bundle Settings → active Nightlife editor rendered Profile visibility/Pause, opened preservation copy and retained the profile after Keep Active. Route-intent hardening passed 6/6 focused, consolidated 112/112 and mobile TypeScript. Evidence 90.~~
98. ~~Loaded a genuine 5,534-module Metro bundle and physically proved rapid deep-link single-flight: two host intents emitted one GET `39a9f299-72df-4c57-8c47-89d23916dde8` (200/37.85 ms), and Back once returned to Explore. Evidence 91–92.~~
99. ~~Physically proved two rapid venue intents emitted one venue GET `1c1ea107-875b-4e58-b9b3-36d411b34266` (200/1,274.7 ms) and one follows GET `c363c4a4-3b2b-4db8-becb-4c5aca185dea` (200/620.5 ms); Back once returned to Explore. Evidence 93–94.~~
100. ~~Completed consolidated validation for this Android-development scope: 19 suites/112 tests, mobile TypeScript, gateway TypeScript and native/deep-link 41/41 agent suite pass.~~
101. ~~Produced the read-only `c1rcle-staging` Inventory V2 audit artifact Evidence 95 with embedded report checksum `39715f6e5c1074842068982cf755a9e91c13b4d5caac755ec2f496d0156c0e05`; no data changed.~~
102. ~~Implemented Inventory V2 invariant/transaction primitives plus parent-mirror and shard-allocation guards behind off/unwired flags; inventory-auditor validation passed 3 suites/44 tests and inventory/refund foundation validation passed 4 suites/76 tests. R55 remains P0.~~
103. ~~Implemented atomic/idempotent refund-request hardening for owner/admin, payment evidence, exact paise/bounds and processed-only refundable balance. Provider/PATCH/reconciler/processed effects remain P0 under R60.~~
104. ~~Implemented and tested unified captured-payment finalization contracts/foundation; finalizer/contract validation passed 2 suites/47 tests and core/gateway TypeScript passed. Routes, provider adapter, outbox worker and consumer remain unwired; R61/R62 stay P0.~~
105. ~~Implemented and tested the transactional refund approval/rejection foundation: single/dual distinct-admin authority, self/duplicate/replay/conflict protection, order-pointer validation, safe rejection restoration and one deterministic `refund_provider_outbox` job. Gateway refund validation passed 33/33 and the core refund contract passed 26/26. Provider execution, webhook/reconciliation and terminal effects remain open under R60.~~
106. ~~Implemented and tested the leased payment-finalization outbox-worker primitive with reclaim, retry, dead-letter and stale-ownership protection. Combined finalization/outbox/refund-contract validation passed 3 suites/60 tests and core TypeScript. No route, scheduler, live database consumer or provider integration is wired; R61/R62 remain P0.~~
107. ~~Re-ran the production infrastructure preflight: `api.thec1rcle.com` has no DNS answer; API calls fail with curl error 6; Privacy, Terms, Refund, Account Deletion, `assetlinks.json` and AASA return 404. Corrected inconsistent support domains, replaced the obsolete Terms source, added Refund/Account Deletion source routes and footer links, and passed guest-portal TypeScript plus a Webpack production build that statically generated all four policy routes. Desktop and 390 × 844 local browser checks found/fixed nested-main and unreadable-opacity defects, then passed semantics/overflow/contrast/link checks. External deployment, legal approval and signed-build verification remain blocked.~~
108. ~~Captured the resumed Android staging runtime request/latency profile. Across repeated QA lifecycle actions, slow-route means were auth sync 3.20 s, subscription 2.52 s, events 2.33 s and recommendations 4.61 s; device-token registration measured 1.86 s once. This is not a single journey or production percentile. Missing Firestore/Redis/Storage/SMS/log operation counters still block any credible per-user cost model.~~
109. ~~Added missing guest-portal Sentry source integration required by the current Next.js App Router: `onRequestError`, client initialization/router transition capture and `global-error`. Final TypeScript and Webpack production build pass without the prior Sentry integration warnings. Production DSN, source maps, symbolication, PII/retention and alert proof remain blocked.~~
110. ~~Completed the resumed 182-artifact/checksummed physical Android evidence pass: Location/Notification revoke and recovery, reversible profile edit and restore, logout, supplied-account login, returning-user route, force-stop restoration, one measured auth-sync and zero matched fatal signatures pass. The DEBUGGABLE Dev Launcher artifact, failed internal settings-permissions link and unproven Nightlife state-changing recovery remain open.~~

## 4. Mandatory release gates

| Gate | Status | Release requirement |
|---|---|---|
| G1. Seeded staging data | PARTIAL | Canonical source/staging were reseeded to 13 future events, 13 unique hosts and 12 venues; event05 semantics align and reseed did not overwrite live tier fields. Full content matrix remains required. Live inventory is P0-blocked under R55 because current reads can calculate availability above persisted remaining. |
| G2. Returning-user auth | PASS | Login, stored session, logout, and re-login work on Android. |
| G3. New-user auth/onboarding | PARTIAL | Clean phone OTP through Explore/Nightlife, exact persistence, process-death return, logout/re-login, wallet isolation and physical A→B→A Nightlife account isolation pass on Android staging. The resumed run also logged out, authenticated the supplied returning account, restored Deepak/Pune after force-stop and emitted exactly one measured auth-sync. Typed bootstrap snapshot, defined merges, saved-city revisit and CTA/safe-area/large-text source suites pass. Physical revisit/200% font, incomplete/expired/error branches, accessibility, iOS and signed RC proof remain. |
| G4. Explore and event detail | PARTIAL | Browse/detail/interested/search/time/NOWL/Pune and development host/venue route semantics pass. Rapid host and venue intents now emit one detail/follow request and one Back returns Explore (Evidence 91–94). Full fixture review, load/error/retry, associations, iOS and signed RC remain. |
| G5. Razorpay success and cancellation | BLOCKED | Prior path evidence and hardened refund request/approval/rejection foundations are retained, including deterministic provider-job creation. Provider execution, webhook/reconciler effects, ownership void, exact inventory restoration and terminal order truth are unwired. Re-certify only after R59–R62 close end to end. |
| G6. Razorpay failure/recovery | BLOCKED | Unified finalization contracts and the leased outbox-worker primitive are tested, but app verify/webhook routing, provider truth, scheduler, live consumer and the negative provider/device matrix are unwired. Captured-payment timeout safety remains P0. |
| G7. Cart and inventory recovery | BLOCKED — P0 | Inventory V2 invariant/transaction and mirror/shard guards exist behind off/unwired flags. Evidence 96 finds 20 currently saleable tiers: 18 balanced and 2 failing (`demo-event-02/t2`, `demo-event-05/t1`) with six unaccounted units; 79 tiers are non-saleable and 6 source-ambiguous. Cross-ledger reconciliation, reviewed repair, backup/restore, backfill and recovery must pass before enablement. |
| G8. Wallet and ownership | BLOCKED | Prior buyer/transfer/share/revoke/reclaim primary paths pass, but cancellation/refund may not void tickets/shares/entitlements and RSVP/share/revoke/reclaim can repeat inventory mutation. Once-only/outbox and two-device/pagination proof required. |
| G9. Event and private chat | PARTIAL | Event send/authorization and Android accepted-DM inbox/history/new-send/back/reopen now pass. Reconnect, pagination, two-device push/unread/retry/block/background/deep-link behavior, iOS, and signed-RC proof remain. |
| G10. Profile, Nightlife, settings | PARTIAL | Wizard/upload/persistence/edit/offline/pause/re-enable/A→B→A isolation pass. Evidence 90 confirms normal active-editor Profile visibility/Pause, preservation copy and Keep Active; route-intent tests pass. Remaining sheets/discovery/moderation/deletion/accessibility, two devices, iOS and signed RCs remain. |
| G11. UI and accessibility | BLOCKED | Signed build at 100%/200% font, TalkBack, keyboard, safe-area, contrast, and touch-target pass required. |
| G12. Performance and cost | BLOCKED | Auth/recommendation request counts and rapid host/venue/follow detail single-flight pass Android staging. The resumed repeated-lifecycle sample records slow-route means of auth 3.20 s, subscription 2.52 s, events 2.33 s and recommendations 4.61 s (5.47 s max); an older recommendation reached 10.84 s. Venue detail was 1,274.7 ms and follow 620.5 ms. Operation/byte counts, journey isolation, production load, p50/p95/p99, cache failure, per-user cost and billing controls remain open. |
| G13. Release engineering | BLOCKED | The hardcoded `2117` mismatch is closed in the development runtime: Settings shows app 1.0.0, native build 1 and Development client. Normal cold launch still opens Expo Dev Launcher; CI fail-closed, signed clean install/upgrade, association registry, scanner isolation, governed OTA, production config, migration rehearsal and rollback proof remain. |
| G14. Production operations | BLOCKED | Crash reporting, dashboards, alerts, runbook, owner rotation, backup/restore, and incident rollback required. |
| G15. Scanner product | DEFERRED | Separate scanner audit against the GitHub-maintained scanner build; no scanner changes in this phase. Consumer CI/build/submit jobs must be isolated so they do not implicitly build, sign, modify, or submit scanner. |
| G16. Production API and public web | BLOCKED | The 18 July 17:19 UTC recheck confirms production API DNS still has no answer and required policy/association URLs still return 404. Privacy, Terms, Refund and Account Deletion source routes are prepared and guest-portal TypeScript passes, but source presence is not publication. Production API must resolve/be healthy; counsel-approved legal/deletion/support content, `assetlinks.json` and AASA must return valid production content; the canonical registry must align mobile, notifications, backend and web and pass signed-build cold/warm/background/install/auth-interrupted links. |
| G17. Android production binary | BLOCKED | Signed AAB, Play App Signing, release merged manifest, target API, 16 KB support, shrinker/symbols, push, links, security, and device proof required. |
| G18. Google Play compliance | BLOCKED | Verified developer account, complete App content declarations, approved Data safety/deletion, 18+ rating/audience, listing, testing, and staged release required. |
| G19. iOS production binary | BLOCKED | Xcode 26/iOS 26 SDK archive, distribution signing, production APNs, universal links, privacy report, dSYMs, TestFlight, and device matrix required. |
| G20. Apple App Store compliance | BLOCKED | Complete App Store Connect record, privacy/age/content declarations, review access, screenshots, IAP, contracts, and phased release required. |
| G21. Payments and subscriptions | BLOCKED — P0 | Foundations are not runtime wiring. Remove test fallback; safely enable audited Inventory V2; wire captured-payment finalizer/provider/outbox and refund/cancellation processed effects; close once-only ownership/reconciliation; then pass controlled live Razorpay and store subscription lifecycles. |
| G22. Privacy and account deletion | BLOCKED | Truthful policy/labels/manifests, data inventory, consent, retention, processor contracts, in-app deletion, working web deletion, and verified cascade required. |
| G23. UGC, social safety, and age | BLOCKED | 18+ enforcement without legacy bypass, pre-post Terms acceptance, moderation/filter/report/block, response SLAs, appeals, and published contact required. |
| G24. India legal and regulatory | BLOCKED | Counsel/CA/CS sign-off on applicable DPDP, IT Rules, CERT-In, consumer/e-commerce, GST, TRAI, entity, contracts, state event, and alcohol obligations. |
| G25. Security and incident response | BLOCKED | Secret removal/rotation, production credential restrictions, native App Check with Play Integrity/App Attest enforcement, dependency/SBOM and penetration-test closure, CERT-In procedure, logs, backup, DR, and rollback required. |
| G26. Store evidence and reviewer access | BLOCKED | Immutable RC evidence pack, reviewer account, review notes, seeded non-sensitive content, backend uptime, support contacts, and rejection-response owner required. |
| G27. Controlled launch | BLOCKED | Internal/closed/TestFlight pass, production schema/index/rules/backfill rehearsal, pre-launch report, crash/ANR thresholds, phased rollout, kill switches, dashboards, on-call, rollback triggers, and executive sign-off required. |

## 5. Functional QA status

| Area | Current evidence | Status |
|---|---|---|
| Auth — returning user | Stored session restored; protected requests returned 200; logout and re-login passed. | PASS |
| Auth — new user | Dedicated identity completed OTP/onboarding, process-death return, logout/re-login and its own empty wallet; clean Evidence 80 emitted one auth sync in 3.90 seconds. Physical A→B→A Nightlife isolation passed. Signed RC, iOS and remaining denial/error branches remain. | PARTIAL |
| Permissions | Camera handoff/grant/revoke refresh, location/push truth, and honestly unavailable contacts passed on Android staging. Signed-RC denial/retry, iOS, and accessibility evidence remain. | PARTIAL |
| Onboarding | Consumer identity/preferences/completion, exact DOB, process-death, logout/re-login and five-step Nightlife pass. Typed snapshot, defined merges, saved-city revisit and CTA geometry source suites pass; physical revisit/200%, remaining errors, signed RC and iOS remain. | PARTIAL |
| Explore | Cards/filters/empty states, Events/Venues/Hosts search, host/venue route semantics, exact NOWL, Pune first-feed and A→B→A Nightlife isolation pass on Android staging. Recommendation count is one but latency is 10.84 seconds; full fixture review, errors, signed RC and iOS remain. | PARTIAL |
| Event detail | Active tiers and guards pass; event05 renders Bollywood/NOWL/Pune and host/venue links correctly. Device-timezone leakage is fixed and physically proven with an India event-timezone fallback. The stored instant renders Monday 3 August at 1:30 am IST, which conflicts with earlier Sunday-night fixture acceptance/poster semantics; product must approve and correct the canonical UTC instant before the fixture row can pass. | PARTIAL |
| Checkout | Prior native success/cancel/recovery and exact-paise display pass, but inventory can oversell and failure/timeout/verify/webhook/cancellation/refund finalization is unsafe. Full P0 integrity remediation and negative matrix required. | BLOCKED |
| Cart recovery | A stale persisted cart displayed an old date until Edit Tickets refreshed it. | BLOCKED |
| Inventory integrity | Availability is not authoritative: stale `inventory.soldQuantity` overrides persisted remaining, calculating 457 vs 454 and 13 vs 10; shard plus parent accounting can double-count. Possible oversell. | BLOCKED — P0 |
| Stale-order reconciliation | `ORD-MR4A01JE-QP89X` remains payment-pending since 3 July although reservation `26540080-...` is absent/expired; terminal payment/ticket truth and cleanup are unproven. | BLOCKED |
| Tickets/wallet | Primary wallet/auth/ownership paths passed, but failed refund/cancellation may leave tickets/shares/entitlements active while order state changes. Void/reconcile/once-only plus pagination/two-device/signed-RC proof required. | BLOCKED |
| Share/claim/transfer | Three-user primary path passed, but RSVP/share/revoke/reclaim inventory mutation has repeat/double-accounting risk and needs durable once-only/outbox proof. | BLOCKED |
| Event chat | Two users sent and received; join requires entitlement; WebSocket authorization passed. | PARTIAL |
| Private chat | Request/accept/send/authorization plus existing history, new send, back, and reopen persistence pass on Android staging. Reconnect, pagination, two-device, push/unread/block/background/deep-link, iOS, and signed-RC proof remain. | PARTIAL |
| Chat inbox | Aggregate-only loading and inbox-to-history consistency pass in the focused Android staging retest. Long-history, reconnect, two-device, push/unread, and signed-RC behavior remain. | PARTIAL |
| Typing | Authenticated, membership-checked, identity-trusted, WebSocket-first behavior passed. | PASS |
| Profile | Attendance and interests render from canonical data. | PASS |
| Nightlife | Five-step creation, editing, offline draft/retry, pause/re-enable and physical A→B→A account isolation pass on Android staging after UID-owned cache/in-flight guards. Remaining sheets, real discovery/match interactions, two-device, iOS, accessibility, deletion and signed RC remain. | PARTIAL |
| Settings | Physical Location and Notification revoke/disabled/recovery/Enabled states, logout and public shell pass; Evidence 82 truthfully shows App 1.0.0, native Build 1 and Development client. The internal `c1rcle://settings/permissions` route now opens correctly on the warm Android development runtime. Cold Dev Launcher → direct-event sequencing can still emit a development `POP_TO_TOP` warning; signed-RC behavior remains unproven. Media/upgrade/background permission branches, legal production URLs, consumer camera copy and signed-release identity remain. | PARTIAL |
| Notifications/deep links | Development `c1rcle://host/demo-host-03` and `c1rcle://venue/demo-venue-nowl` route semantics pass. Associations, notifications, background/auth interruption, two devices, iOS and signed RC remain. | PARTIAL |
| Offline/process death | A completed account survived force-stop and returned to Explore without OTP/onboarding replay; Nightlife offline Save showed a truthful network failure, preserved the draft, and succeeded on retry. The artifact still cold-opens Expo Dev Launcher; broader slow-network/process-death and signed-RC proof remain. | PARTIAL |
| Accessibility/UI | Default font inspected; 200% font, TalkBack, signed-build overlay-free geometry remain. | BLOCKED |
| API gateway health | HTTP 200; Firestore healthy; Redis healthy after the latest restart. | PASS |
| Production API | `https://api.thec1rcle.com` still had no DNS answer at the 18 July 17:19 UTC recheck; curl failed with error 6. | BLOCKED |
| Public legal/deletion pages | `/privacy`, `/terms`, `/refund`, `/account-deletion`, `assetlinks.json` and AASA returned 404 at the 18 July 17:19 UTC recheck. Policy source routes are prepared and TypeScript-clean but not deployed or legally approved. | BLOCKED |
| Android production artifact | Debug evidence only; no signed release AAB or Play Console artifact inspected. | BLOCKED |
| Google Play | Package listing was not discoverable; no Play Console declarations or release evidence were available. | BLOCKED |
| iOS production artifact | No App Store archive/TestFlight build; generated native state carries development entitlements/metadata. | BLOCKED |
| App Store Connect | Configured public App Store URL returned 404; no App Store Connect evidence was available. | BLOCKED |
| Digital subscription | Paywall calls RevenueCat but SDK configuration is absent and restore is a no-op. | BLOCKED |
| Privacy disclosures | Current manifest/policy/config do not cover the observed data and SDK inventory consistently. | BLOCKED |
| UGC and moderation | Report/block paths exist; pre-post Terms acceptance, operational SLA, appeals, and complete review tooling are unproven. | PARTIAL |
| Age assurance | New onboarding has an 18+ check; legacy grandfathered completion can bypass identity/DOB validation. | BLOCKED |
| India legal readiness | Official requirements mapped; entity-specific legal, tax, grievance, contract, and state/city approval is absent. | BLOCKED |
| Scanner product | Intentionally outside this mobile phase. | DEFERRED |

## 6. Open risk register

| ID | Severity | Open risk | User/business impact | Acceptance criteria |
|---|---|---|---|---|
| R1 | P1 | Persisted cart can show stale event date/tier/price until manually edited. | User can approve a purchase using misleading context, causing refund/dispute risk. | Fetch canonical event/tier/inventory before checkout render and before payment; invalidate mismatched cart; device-test expiry and edit recovery. |
| R2 | P1 | Razorpay mock-bank Failure control returned a captured success. | Negative payment behavior is not certified; failure/webhook bugs can issue or hide tickets incorrectly. | Provider-controlled failure or deterministic webhook fixture; verify no double charge, no phantom ticket, and honest recovery after app kill/offline/timeout. |
| R3 | P1 | Multi-user recipient execution used API-authenticated sessions, not a second physical phone. | Push, deep links, background refresh, unread state, and notification timing can still fail in real use. | Repeat the complete A/B suite on two physical devices and retain screenshots/log IDs. |
| R4 | P1 | Consumer onboarding, permissions/profile, Nightlife create/edit/offline/pause/re-enable, process-death, logout/re-login and A→B→A account isolation pass on one Android development build. Typed snapshot and CTA geometry source coverage passes; physical revisit/200%, remaining errors, iOS, signed RC, clean install and upgrade remain. | First-time users can still fail in accessibility, platform-specific or release-only states. | Pass physical saved-section revisit, 200%/TalkBack, every remaining error/denial branch, clean install/upgrade, iOS and signed Android/iOS RCs with dedicated identities. |
| R5 | P1 | Production cost dashboards and automatic controls are absent. | Polling, retries, SMS abuse, logs, or cache failure can create unexpected spend without timely response. | Budgets, forecast alerts, Pub/Sub action, SMS limits, per-endpoint operation metrics, Redis alerts, and named owner are live and tested. |
| R6 | P1 | Cold aggregate APIs remain slow. | Long blank/loading states increase abandonment and amplify retries. | Define and meet p50/p95/p99 plus read ceilings for cold boot, Explore, recommendations, event detail, wallet, matches, and my-chats. |
| R7 | P1 | Signed release build has not completed the physical regression. | Development client behavior can hide native config, deep-link, minification, permission, and release-only crashes. | Signed clean install and upgrade pass all mandatory flows with zero fatal crash. |
| R8 | P1 | Phone auth waited roughly 60 seconds for SMS auto-retrieval timeout before OTP entry. | Users retry, abandon, or trigger additional SMS spend. | Manual code entry is immediately available with bounded progress, resend cooldown, rate limits, and real-provider timing evidence. |
| R9 | P2 | Development Tools overlay covers an event-detail control; some icon controls lack strong accessibility labels. | QA can miss real geometry defects; assistive users cannot identify controls. | Signed build removes overlay; all icon controls have labels, roles, states, and minimum touch targets. |
| R10 | P2 | Wallet queries cap the working set at the newest 50 rows; lingering UI edge cases exist. | History-heavy users can lose access to older valid/current records; unhandled UI states degrade UX. | Cursor pagination or explicit active/upcoming partition with deterministic retention; fix unhandled offline/empty states. |
| R11 | P2 | React Native Firebase namespaced APIs, Android BlurView configuration, and Reanimated layout warnings remain. | Future upgrades can break behavior; warnings hide new regressions. | Migrate deprecated APIs and eliminate or formally accept each release warning. |
| R12 | P2 | Nightlife real-data behavior was not exercised. | Swipe, match, empty/error, private-chat entry, and profile ranking can fail after launch. | Seed privacy-safe Nightlife fixtures and run two-user discovery/match/chat QA. |
| R13 | P1 | Chat date canonicalization is incomplete for historical or edge-case events. | Users might see confusing chronological inconsistencies or incorrect event states in chat history. | Audit and canonicalize all chat timestamp metadata to strictly follow the source event lifecycle. |
| R14 | P0 | Credential classification confirms `apps/mobile-app/.env.production` line 15 and development mobile config are `TEST_KEY`; checked API-gateway paths contain no `.env.production`, while gateway development is also `TEST_KEY`. No values are recorded here. | Real users cannot complete valid live payments; missing server production configuration or test/live confusion can create financial and reconciliation failures. | Provision approved restricted live public client key plus server secret/webhook secret through managed production configuration; fail closed if absent; isolate test/live data and certify controlled low-value live purchase/refund on signed RC. |
| R15 | P0 | `api.thec1rcle.com` did not resolve during this audit. | Production auth, browse, checkout, chat, wallet, deletion, and reviewer access can all fail at launch. | DNS, TLS, health, routing, capacity, WAF/rate limits, monitoring, and rollback pass from multiple external networks and both store builds. |
| R16 | P0 | Public privacy, terms, refunds, deletion, and association endpoints return 404. | Store rejection, broken deletion, invalid privacy disclosure, and failed app/universal links. | Publish approved pages and association files at permanent HTTPS URLs; monitor status/content/certificates and verify on release artifacts. |
| R17 | P0 | Digital premium uses RevenueCat calls without visible `Purchases.configure`; restore is a no-op and production keys/products are absent. | Purchases can fail, entitlements can diverge, restore can falsely appear successful, and both stores can reject the monetization flow. | Configure per platform and authenticated UID, create reviewed store products, implement restore/server webhook truth, and pass the complete subscription lifecycle matrix. |
| R18 | P0 | Mobile Spotify code supports an `EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET` client-credentials flow. | A configured secret is extractable from the app and can be abused at the project's quota/cost/reputation. | Remove client secret and client-credentials flow from the app, rotate exposed credentials, route through authenticated/rate-limited backend, and scan build/repository/history/logs. |
| R19 | P1 | Android native release points to debug signing in source and no final AAB was inspected. | Unshippable or incorrectly signed release, key loss, update lockout, or debug behavior in production. | Play App Signing and upload-key custody approved; final AAB certificate, merged manifest, debuggable flag, symbols, app links, and device install verified. |
| R20 | P1 | iOS has no Xcode 26 archive; generated entitlements use development APNs and include development-client metadata. | App Store upload or review failure, broken push/universal links, and release-only crashes. | Build with required SDK/distribution profile; validate archive entitlements, production push, links, privacy report, symbols, and TestFlight on supported devices. |
| R21 | P1 | Production Sentry DSN and Google web client ID are placeholders. | No actionable crash visibility and failed Google authentication in production. | Set environment-specific values via approved secret/config management and prove crash symbolication plus Google login on signed Android/iOS builds. |
| R22 | P1 | Privacy declarations, permissions, policy, and observed data/SDK use are inconsistent. | Store enforcement, user deception, unnecessary sensitive access, and privacy-law exposure. | Complete data map; minimize permissions; align policy, prompts, Apple labels/manifest, Google Data safety, processors, retention, consent, and deletion evidence. |
| R23 | P1 | Legacy-grandfathered onboarding can reach complete before current identity/DOB validation. | Under-18 users can enter adult/nightlife/dating features despite the stated 18+ restriction. | Require verified age eligibility for every active user, migrate legacy records, fail closed, document appeals/correction, and adversarially test age/date/time-zone boundaries. |
| R24 | P1 | UGC Terms acceptance and the moderation operating model are incomplete. | Harmful content may be posted without enforceable rules or timely action; store and intermediary obligations can fail. | Versioned Terms/Guidelines acceptance before UGC, moderation console/filters, report/block evidence, published contact, trained rota, measurable SLA, appeal and preservation processes. |
| R25 | P1 | Google Play requires a working web deletion path, while the configured path is absent; deletion cascade completeness is unproven. | Policy rejection and residual personal data after users believe deletion is complete. | Functional in-app and web request paths, identity verification, full inventory/cascade or documented legal retention, processor deletion, completion notice, audit record, and repeated test. |
| R26 | P1 | Microphone, Always/background location language, camera/scanner copy, overlay/dev permissions, ATT text, backup, and tablet settings are not reconciled with launch behavior. | Store review questions, over-collection, alarming prompts, attack surface, and broken layouts. | Remove unused permissions/features or document core necessity; verify release manifests/plists, disclosures, prompts, denial behavior, tablet matrix, and backup exclusions. |
| R27 | P1 | Store records, organization verification, declarations, agreements, tax/banking, screenshots, review notes, and staged-rollout controls are unproven. | Submission cannot complete or is rejected; launch lacks recovery control. | Sections 18, 20, 27, and 28 have owner-stamped evidence from the actual store consoles and RC. |
| R28 | P1 | India legal/tax/entity/grievance obligations have no qualified sign-off. | Regulatory complaints, tax exposure, consumer refunds, takedown failures, penalties, or partner disputes. | India counsel, CA, CS, security lead, and authorized signatory approve the applicability matrix, published documents, contracts, procedures, and launch-state license allocation. |
| R29 | P1 | Release security evidence is incomplete: secrets, dependency provenance, authorization consistency, data retention, incident reporting, and DR remain open. | Account takeover, data breach, costly abuse, extended outage, or missed reporting deadline. | Threat model, SBOM/SCA, secret scan/rotation, mobile/API penetration test, least privilege, tamper/rate controls, incident drill, backups/restore, CERT-In procedure, and closure report. |
| R30 | RESOLVED IN STAGING | Mobile search now uses the max-24 contract; Events, Venues, and Hosts results plus host navigation passed physically in Evidence 28–31. Host upcoming-event India-local time also passed in Evidence 34. | The original universal search failure is closed on the connected Android staging build. Cancellation, empty/error/retry behavior, iOS, and signed RC remain uncertified. | Keep typed-contract tests green and repeat debounce, cancellation, empty/error/retry, navigation, iOS, and both signed RCs. |
| R31 | SOURCE AND ANDROID PATH PASSED; RELEASE MATRIX OPEN | REST history hydration now runs independently of WebSocket state. Existing accepted-DM history, a new send, back, and reopen persistence passed physically in Evidence 40–46. | The original disappearing-history defect is closed on one Android staging device, but reconnect, pagination, duplication ordering, push/unread/block and cross-device propagation can still fail. | Pass reconnect, long-history pagination, retry/deduplication, background/unread/block/deep links, two physical devices, iOS, and signed RCs. |
| R32 | RESOLVED IN STAGING | Exact `NOWL` search now returns the spotlight venue when the hero is hidden; Evidence 35 passed physically. | The exact-search trust defect is closed on Android staging. Partial/empty/error search, iOS, and signed-RC behavior remain. | Retain exact/partial regressions and repeat empty/error/retry on signed Android and iOS RCs. |
| R33A | SOURCE/RESEED FIXED; REVIEW MATRIX OPEN | Canonical fixtures were corrected/reseeded to 13 future events, 13 unique hosts and 12 venues; event05 now aligns Bollywood/NOWL/Pune/Sunday 2 August, and system metadata identifies the canonical source. Seeder dry-run/reseed preserved live tier counters. | The known event05 contradiction is source-closed, but unreviewed cards/posters/details/checkout/tickets can still contain reviewer-visible drift. Inventory counters are separately blocked under R55. | Physically verify every event/host/venue card, poster, location, India time, tier, checkout, provider metadata, ticket, wallet and receipt against the canonical matrix before G1 PASS. |
| R33B | RESOLVED IN STAGING | Checkout now displays exact paise throughout the physical pre-payment flow: ₹999.00 plus ₹88.42 equals ₹1,087.42 in total and Pay CTA (Evidence 36). | The prior whole-rupee display mismatch is closed on Android staging; invoices, refunds, provider failures, iOS, and signed RC remain. | Assert exact two-decimal INR across order, provider, payment, invoice, refund, wallet, iOS, and both signed RCs. |
| R34 | DEVELOPMENT MISMATCH RESOLVED; RELEASE BLOCKED | Evidence 82 derives Settings identity from runtime: App 1.0.0, native Build 1, Runtime Development client. Normal launch still opens Expo Dev Launcher and no signed artifact exists. | Development QA can now identify its artifact honestly, but release provenance, signing and direct startup remain unproven. | Signed RC launches directly into the app and records matching package/store/build/EAS/commit/signing provenance without development metadata. |
| R35 | RESOLVED IN STAGING | Signed-out Tickets now shows `Sign in to view your tickets`; Sign In returned the user to the authenticated wallet (Evidence 37–38), and the dedicated Phase account re-login returned to its own legitimately empty wallet (Evidence 51–57). | The misleading lost-ticket state is closed on Android staging. Deep-link interruption, iOS, signed RC, and two-device wallet synchronization remain. | Retain signed-out/true-empty regressions and repeat interrupted auth, deep-link return, iOS, two-device, and signed RC. |
| R36 | RESOLVED IN STAGING | The prior identity timestamp/date-only mismatch returned HTTP 400 for a valid adult. Mobile now serializes local calendar components, parses only strict date-only values, and the exact boundary DOB persisted as selected. | The connected Android can now advance through the complete consumer journey. Residual release risk is limited to untested signed-RC/time-zone/error-copy branches. | Keep 32 mobile/8 gateway regressions green and repeat valid, invalid, leap-day, minimum-age, retry, logout, process-death, India/UTC-edge, Android, and iOS cases on signed RCs. |
| R37 | P1 | Restored-auth cold start renders an unstable sequence: dev loader at +2 seconds, blank at +6, signed-out login at +10, and correct identity at +15, although Firebase restored immediately and `/auth/sync` completed around +4 seconds. | Users can think they were logged out, tap a second login, abandon during the blank state, or generate duplicate auth/SMS traffic. | One boot coordinator owns navigation; restored users see a neutral bounded loader and land directly on the canonical stage. Prove p50/p95/p99 and no wrong-screen frame on signed Android and iOS RCs. |
| R38 | P1 — REQUEST COUNT RESOLVED, LATENCY/COST OPEN | Single-flight remains one `/auth/sync` per measured path. Latest clean Phase cold launch request `edd5257f-e59e-45f0-9ec6-0d47783b46e1` returned 200 in 3.90 s middleware/3.91 s total (Evidence 80), improved from earlier 5–7 seconds but still without production p95/load proof. | Duplicate auth-sync multiplication is closed in measured staging paths, but multi-second latency, retries and broader fan-out can still cause abandonment and cost. | Keep one request per UID/generation; measure operation counts; stage nonessential bootstrap; meet signed-RC p50/p95/p99 and production load/cost ceilings. |
| R39 | P1 — ANDROID RECOVERY/PERSISTENCE PASSED, RELEASE MATRIX OPEN | Five-screen creation/editor, reversible edit, offline draft/retry and pause/re-enable pass. UID-owned store remediation and physical A→B→A isolation now pass under R47. | One-device staging recovery is proven, but less common sheets, discovery interactions, platform and release paths can still strand or expose state. | Prove every editor sheet, timeout/process death/reinstall, real two-user discovery/match, accessibility, two-device output, iOS and signed RCs. |
| R40 | P1 — FLOW/TAXONOMY FIXED, MIGRATION/QA OPEN | The multi-step wizard is deliberately retained as the only first-time creation experience; the single-page screen is the active-profile editor. Nightlife labels persist in `nightlifeVibeTags`; discovery exposes that field and only bridges recognized legacy labels, leaving consumer recommendation IDs in `vibeTags`. Existing records are not migrated and end-to-end recommendation/discovery behavior is not yet certified. | Unmigrated or unusual legacy labels may disappear from Nightlife output; a future client/server regression could again mix taxonomies and degrade both Explore and people discovery. | Run a dry-run/reportable migration; regression-test consumer recommendations, Nightlife filtering/discovery/editing, legacy profiles, and two-device output before release. |
| R41 | P1 — PHYSICAL UPLOAD/SEPARATION PASSED, MEDIA OPERATIONS OPEN | Authenticated `/social/upload` now uses the decorated Storage instance, stores a random UID-scoped object, limits uploads to images/2 MB/12 per 10 minutes, validates HTTPS URLs, caps profiles at six photos, and rejects active local-URI/last-photo deletion. The Android retry returned 200, the object fetched as HTTP 200 `image/jpeg`, and a clean-bundle physical editor Save returned 200 while Firestore remained `photoURL=null`, `photos=[]`, with the URL only in `datingPhotos`. Reinstall/two-device render, host allowlisting, moderation, orphan cleanup, quota monitoring, and account-deletion cleanup remain unproven. | A release could still expose abusive content, orphaned storage cost, untrusted external HTTPS tracking, broken cross-device images, or undeleted personal media despite the stronger request contract. | Prove reinstall/two-device/deletion; enforce approved asset hosts and ownership metadata; add moderation, orphan lifecycle, quotas/alerts, and deletion-cascade evidence. |
| R42 | RESOLVED IN STAGING | A bodyless onboarding completion POST carried JSON content type, and the gateway raw parser called `JSON.parse('')`, returning HTTP 500. | The final CTA failed immediately; preferences were already saved, and a relaunch could advance through auth reconciliation without recording the intended successful completion action. | Client omits JSON content type when bodyless; gateway accepts empty raw JSON defensively; unit tests, TypeScript, and physical Android retry pass with HTTP 200. Repeat on signed RC and retain 5xx monitoring. |
| R43 | RESOLVED IN STAGING | Explore now waits for full private-profile hydration before its initial feed, derives the canonical city without overwriting an explicit in-session selection, and has focused late-hydration/selection tests. A clean Android cold start displayed Pune and request `6296ca12-89e3-4810-9e11-756302114ddb` fetched `/events?city=pune&limit=24&sort=soonest` (200), with no preceding unfiltered event request in that run. | The original personalization/feed mismatch is removed on the connected staging build. Residual risk is change-city persistence, permission denial, empty inventory, analytics, iOS, and signed-release restoration. | Keep focused regressions green; prove change-city, location denial, empty state, analytics, reinstall/upgrade, iOS, and both signed RCs. |
| R44 | SOURCE FIXED; PHYSICAL REVISIT OPEN | Core now returns a typed onboarding snapshot end to end and mobile merges only defined fields; saved-city revisit has focused coverage. Core 234/234, gateway onboarding 5/5, mobile focused 25/25 and both TypeScript checks pass. | Source-level destructive overwrite risk is reduced, but back/deep-link/relaunch/revisit behavior is not physically accepted. | Physically restore exact identity/city/tastes/intents after relaunch/back/deep link and prove no destructive overwrite on signed Android/iOS RCs. |
| R45 | SOURCE FIXED; ACCESSIBILITY ACCEPTANCE OPEN | First-run CTA/content insets now use measured safe-area/large-text geometry with focused coverage; the old overlap source path is remediated. | Small screens, keyboard, 200% font or assistive navigation can still expose overlap/clipping in the rendered release artifact. | Pass physical small/tall Android, iPhone, 200% font, keyboard, gesture navigation, TalkBack/VoiceOver and signed-RC screenshots. |
| R46 | P1 — HEIGHT EDIT/HYDRATION PASSED, EDITOR MATRIX OPEN | The canonical Android Vitals selectors and Prompt editor complete without the former layout invariant. Full profile hydration reopened the editor with saved photo/vitals/vibes; the Height sheet changed `4'3\"` to `4'4\"`, persisted after Save/reopen, and was reverted (Evidence 59–63). Every sheet/custom-value/keyboard/rotation/background/large-font path is not yet exercised. | Less common editor-sheet, keyboard, large-font, or platform paths can still block changes after creation. | Open/close every editor Vitals, Prompt, and Anthem sheet; use custom values/keyboard; rotate/background; verify no blank/error frame at 100% and 200% font on signed Android and iOS RCs. |
| R47 | RESOLVED ON ANDROID STAGING; RELEASE MATRIX OPEN | Nightlife profiles/matches are UID owned; account switch/logout clears state; in-flight responses are invalidated; self/stale actions are guarded. Focused 6/6, combined dating/auth 27/27 and mobile TypeScript pass. Physical A→B→A showed Phase empty (Evidence 81), Deepak correctly seeing Phase (84), then Phase empty again (85). | The reproduced P0/P1 cross-account privacy failure is closed on the connected development build. Signed/minified persistence, iOS, process-death races, two-device and full discovery interaction behavior remain unproven. | Keep A→B→A regressions green; pass process death, rapid switch/in-flight response, discovery action, two devices, iOS and both signed RCs before final closure. |
| R48 | P1 | Release CI is not proven fail-closed; non-blocking checks or automatic submit behavior can promote an artifact after a failed validation. | A known-bad or unverified build can reach a store track. | Make every mandatory build/test/security/config gate blocking; prohibit submit on any failure; retain immutable CI and approval evidence. |
| R49 | P1 | OTA update approval, channel separation, signing, compatibility, canary, stop thresholds and rollback are not certified. | An OTA can bypass store-tested code or break native/runtime compatibility across the installed base. | Define signed environment-specific channels, runtime compatibility, two-person approval, canary metrics, kill switch and rehearsed rollback with audit log. |
| R50 | P1 | Native App Check/device attestation is not enforced with production Play Integrity/App Attest providers; debug-token behavior may remain. | Automated or repackaged clients can abuse authenticated endpoints, SMS, storage, chat and cost-sensitive APIs. | Configure production providers, remove debug tokens from release, monitor staged enforcement, document failure UX and prove valid/invalid/replayed clients on both RCs. |
| R51 | P1 | Deep-link handling is split across route handlers and association configuration; host/venue and ticket-share/claim routes do not have one canonical registry. | Shared links, notifications and reviewer links can open the wrong screen, fall back to web, or fail after install/background state. | Maintain one typed route/host/path registry across Android, iOS, backend and web associations; pass cold/warm/background/install/auth-interrupted tests on both RCs. |
| R52 | P1 | Consumer release automation is not isolated from the deferred scanner pipeline. | A consumer release can unintentionally build, sign, submit or modify the scanner product outside its approved audit. | Separate jobs, credentials, artifacts and approvals; consumer workflow must neither build nor submit scanner. Scanner remains DEFERRED and untouched. |
| R53 | P1 | Production schema, indexes, rules and backfills lack a recorded dry run, idempotency proof, compatibility window and rollback rehearsal. | Deployment can corrupt or strand auth, event, ticket, wallet, chat or Nightlife data even when the app binary is correct. | Version every change; rehearse staging-to-production-sized migration, retry/idempotency, mixed-version compatibility, backup/restore and rollback; attach counts and checksums. |
| R54 | P1 | Tickets/bootstrap can perform overlapping wallet and `/cover-charge/me` work while auth, profile, subscription, notifications, recommendations and discovery fan out concurrently. Latest cold fan-out measured venues 1.93 s, profile 1.48 s, notifications 1.51 s, subscription 3.01 s and events 4.29 s. | Read amplification, latency and retry multiplication can turn normal launch traffic into a disproportionate Firestore/Redis/log bill. | Decide whether cover charge ships; aggregate/cache/paginate/deduplicate, count operations/bytes, load test cache failure/retry and enforce cost/latency ceilings with alerts. |
| R55 | P0 — POSSIBLE OVERSELL; FOUNDATION OFF/UNWIRED | Evidence 96 validates actual lifecycle/cutoff/tier-source behavior across 70 stored events/105 finite tiers: 20 are currently saleable, 18 balanced and exactly 2 fail (`demo-event-02/t2`, `demo-event-05/t1`) with six unaccounted units; 79 are non-saleable and 6 are ambiguous due to conflicting tier sources. Inventory V2 invariant/transaction plus guards remain off/unwired. | The two confirmed saleable tiers can expose three extra units each; broader persisted defects can corrupt reporting or become exposed later. | Cross-reconcile orders, payments, tickets, entitlements, assignments, shares, refunds and holdbacks; approve report/checksum; prove backup/restore; run idempotent staging backfill/rollback; then controlled dual-write/read and concurrency/retry proof. No data changed. |
| R56 | P1 — PHASE 2 INTEGRITY BLOCKER | Order `ORD-MR4A01JE-QP89X` remains `payment_pending` since 2026-07-03 while Redis reservation `26540080-...` is absent/expired. | Users or support can see phantom pending checkout state; inventory/order/payment reconciliation and cleanup SLAs become ambiguous. | Reconcile terminal provider/payment/ticket truth; expire/cancel stale order idempotently; prove no ticket/charge; implement scheduled stale-order cleanup, alerting and UI recovery with repeated app-kill/webhook-delay tests. |
| R57 | RESOLVED ON ANDROID STAGING; LOAD/RELEASE OPEN | On a genuine 5,534-module bundle, two rapid host intents emitted one GET `39a9f299-72df-4c57-8c47-89d23916dde8` (200/37.85 ms); two rapid venue intents emitted one venue GET `1c1ea107-875b-4e58-b9b3-36d411b34266` (200/1,274.7 ms) and one follows GET `c363c4a4-3b2b-4db8-becb-4c5aca185dea` (200/620.5 ms). One Back returned Explore (Evidence 91–94). | The reproduced development duplicate is closed on one Android device, but load, cache miss, retry/background, iOS and signed/minified behavior remain. | Keep single-flight tests green; pass production-data load, retry/background/cache-failure, iOS and signed RC with operation counts and p95/p99 ceilings. |
| R58 | P1 — REQUEST COUNT RESOLVED, LATENCY BLOCKED | Recommendation UID/query single-flight and stale-account clearing pass 4/4 focused, 35/35 combined and mobile TypeScript. Evidence 88 emitted exactly one GET `e8205ea1-49b2-4373-bf32-64bf82c52a72` (200), but it took 10.84 seconds. | Duplicate cost is reduced, but a 10.84-second discovery wait causes abandonment, retries and cold-start fan-out pressure. | Profile the query/read plan and payload; cache/paginate/precompute as appropriate; meet production-data p50/p95/p99 and operation ceilings on signed RC under normal/slow/cache-miss load. |
| R59 | P0 — CANCELLATION/REFUND STATE CORRUPTION | Confirmed read-only trace shows cancellation/refund can construct Razorpay `payments/undefined/refund` from incomplete parameters, may mark an order cancelled when provider refund fails, and does not reliably restore inventory or void tickets, shares and entitlements. | Customer can remain charged while the app says cancelled, keep usable access after refund/cancel, lose inventory incorrectly, or create finance/entry disputes. | Replace with a durable refund/cancellation state machine: validate payment/order identifiers, provider result first, atomic state transition, exact once-only inventory restoration and ownership void, retry/reconcile/alert, then adversarial device/provider tests. |
| R60 | P0 — REFUND EXECUTION/PROCESSED EFFECTS OPEN | R60A/R60B harden request creation and transactional approval/rejection, including deterministic provider-outbox creation. Provider execution, webhook/reconciler and processed effects are not wired: ticket/share/entitlement void, Inventory V2 restoration, terminal order state and retry recovery remain open. | An approved request can still remain queued forever or become partially applied, leaving a charged customer, live ticket or wrong inventory. | Wire the provider worker and webhook-backed refund state machine/reconciler; atomically record provider truth and processed effects; void ownership and restore Inventory V2 exactly once; prove partial/full/pending/failed/retry/crash/replay and audit/alert behavior. |
| R60A | IMPLEMENTED FOUNDATION — R60 P0 REMAINS | Refund-request creation now requires owner/admin, payment evidence, exact paise and bounds, processed-only refundable balance, and atomic durable idempotency. Inventory/refund foundation validation passes 4 suites/76 tests; core/gateway TypeScript pass. | Unauthorized/excessive/duplicate request risk is reduced at creation, but no provider refund or downstream processed effect is certified. | Keep request tests green and do not close R60 until PATCH/provider/reconciler/processed-effects device and provider evidence passes. |
| R60B | IMPLEMENTED FOUNDATION — R60 P0 REMAINS | Refund approval/rejection is transactional and enforces single/dual distinct-admin policy, self/duplicate/replay/conflict rejection, order-pointer integrity, safe rejection restoration and one deterministic `refund_provider_outbox` job. Gateway refund validation passes 33/33 and core refund-contract validation passes 26/26. | Approval state is safer, but the queued provider job has no certified worker and no downstream refund effect is launch-proven. | Keep transaction tests green; wire the provider worker, webhook/reconciler and terminal effects; prove pending/processed/failed, retry, replay, operator conflict and crash recovery before closing R60. |
| R61 | P0 — CAPTURED-PAYMENT FOUNDATION UNWIRED | Unified finalization foundation/contracts and a leased outbox-worker primitive exist and pass combined 3-suite/60-test validation, but no app route, provider-truth adapter, scheduler or live consumer is wired. Current app timeout/failure paths can still cancel/restore inventory after provider capture. | Customer can be charged without a ticket while inventory is resold, causing oversell, chargeback and support emergencies. | Route all uncertain outcomes through the unified reconciler; never infer provider failure from client timeout; wire provider truth, scheduling and idempotent consumption; test app kill/offline/timeout before/during/after capture. |
| R62 | P0 — FINALIZER DELIVERY UNWIRED | Unified finalization and lease/retry/dead-letter worker primitives are tested, but app verify/webhook are not routed through one finalizer; provider-event ledger, scheduler and idempotent live consumer are absent. | Duplicate/missing tickets, double inventory commit, lost notifications and irreconcilable order state remain possible under retry/reordering. | Wire one finalizer for verify/webhook; persist provider event/idempotency transactionally; schedule, publish and consume outbox exactly once; prove replay, reorder, crash, reclaim and concurrency recovery before closure. |
| R63 | P0/P1 — RSVP/SHARE INVENTORY REPEAT RISK | RSVP plus share/revoke/reclaim paths can repeat or double-account inventory/ownership transitions without one durable once-only ledger/outbox. | Capacity can be released or consumed multiple times; sender/recipient ownership and entry eligibility can diverge under retries/concurrency. | Model every capacity/ownership transition as an idempotent state machine with unique operation key and transactional outbox; reconcile existing rows and pass simultaneous claim/revoke/reclaim/RSVP retries and crash recovery. |
| R64 | P0 — PRODUCTION TEST-KEY FALLBACK | Production configuration can fall back to `rzp_test_DEVELOPMENT`. | A missing/misloaded secret can silently ship test payments, block real revenue, confuse reconciliation and expose reviewers/users to non-production behavior. | Remove all production fallback values; fail build/start closed when approved restricted live public key/server secret/webhook secret are absent; scan artifacts/config/logs and prove controlled live low-value purchase/refund on signed RC. |
| R65 | RESOLVED WARM ANDROID; COLD/SIGNED OPEN | Evidence 24 proves `c1rcle://settings/permissions` now opens the intended screen on the warm Android development runtime. A cold Dev Launcher → server → direct-event sequence still emitted `POP_TO_TOP`; it was dismissible and no fatal/ANR occurred. | Warm internal recovery routing is fixed, but the development client cannot certify store-installed cold/background/auth-interrupted navigation. | Keep typed route/native-intent tests green; prove cold/warm/background/auth interruption on Play/TestFlight builds and close only when no unhandled navigation action appears. |
| R66 | P1 — EVENT TIMEZONE FIXED; FIXTURE INTENT OPEN | Evidence 25 proved Indian event time was rendered in the Arizona device timezone. Event formatters now use the event timezone with `Asia/Kolkata` fallback; 30 focused tests, mobile TypeScript and Evidence 26 physically pass. The canonical event05 instant now correctly renders Monday 3 August at 1:30 am IST, but poster/earlier audit copy describes Sunday night. | Timezone leakage is closed, but an incorrect canonical UTC instant would propagate to event detail, checkout, ticket, calendar, notifications and entry operations. | Product/venue must approve each fixture's intended India-local start/end; convert to canonical UTC once; verify every consumer and both device timezones before checking the fixture matrix row. |

## 7. Multi-user test ledger

Test identities:

- User A — returning staging account on the connected Samsung device.
- User B — independent authenticated staging session.
- User C — independent authenticated staging session used for replacement-claim coverage.
- Credentials and OTPs remain out of this document and must be stored through the approved test-secret process.

| Scenario | Evidence | Status |
|---|---|---|
| Event chat A → B | Android send independently fetched by User B. | PASS |
| Event chat B → A | User B message rendered on Android. | PASS |
| Unauthorized event subscription | User C received subscription denial. | PASS |
| Private request before acceptance | Send returned 409. | PASS |
| Accepted private chat A ↔ B | Both directions returned 200 and rendered. | PASS |
| Unauthorized private subscription | User C received subscription denial. | PASS |
| Direct ticket transfer A → B | Sender removed; assignment, entitlement, and recipient wallet updated. | PASS |
| Share claim B | Claim succeeded; retry was idempotent. | PASS |
| Unauthorized revoke | Recipient revoke returned forbidden. | PASS |
| Owner revoke and replacement | B removed; old entitlement revoked; clean purchaser replacement issued. | PASS |
| Replacement claim C | C claimed reopened slot; ownership stayed exact. | PASS |
| Link cancel/reclaim | Unclaimed slot returned to A without taking C's claim. | PASS |
| Final ownership | A 2, B 0, C 1. | PASS |
| Two-device notification/deep-link | Only User A was on a physical device. | BLOCKED |
| Background unread/push/block/retry | Not completed on two physical devices. | BLOCKED |
| Transfer decline/expiry on devices | Automated/state coverage exists; physical recipient behavior remains. | BLOCKED |

## 8. Checkout and ticket-management evidence

Completed primary transaction:

- Native provider UI opened with the supplied Razorpay test card.
- Provider amount: ₹1,087.42.
- Confirmed order: `ORD-MRO9ZOZL-F5TYN`.
- Booking code: `#HW3XD7`.
- One ticket and one entitlement issued.
- Linked reservation released.
- Wallet recovered the committed purchase even though the first verification response was lost to a post-commit serialization error.

Completed cancellation evidence:

This is retained as a historical focused-path result only; R59–R62 supersede any release-ready interpretation of cancellation/refund/finalization.

- User cancellation created no ticket or entitlement.
- Reservation reached `released`.
- Payment state was terminalized.
- Repeated cancellation remained idempotent.

Completed multi-user ownership evidence:

- Transfer assignment: `TRANS-TKT-ORD-MROBD4UW-DFB1V-T1-1-qa_us-e3e58e19`.
- Share bundle: `share_bdfbd7b3bbcc1f835d8413ca25aa392f40b6b74d`.
- Final Android sender booking: `#XYVA44 · 2x`.
- Sender/recipient duplicate ownership and missing assignment-wallet rows were fixed.
- Revoked recipient state and replacement entitlement behavior were verified.

Phase 2 mandatory implementation order — **no data has been changed by this audit**:

1. Inventory V2 — **foundation implemented, flags off/unwired**: invariant/transaction and mirror/shard guards exist; lifecycle-aware Evidence 96 is complete and isolates two currently saleable failing tiers. Next: cross-ledger reconciliation, reviewed repair/backup/restore/backfill, then controlled dual-write/read wiring.
2. Unified captured-payment finalizer/reconciler — **contract and leased outbox-worker primitives implemented, runtime unwired**: next route app verify/webhook through it, add provider truth, durable event ledger, transactional issuance, scheduler/idempotent consumer and reconciliation.
3. Refund/cancellation state machine — **request plus approval/rejection foundations implemented**: authority, payment evidence, paise/bounds, processed-only balance, replay/conflict protection and deterministic provider-job creation pass. Next wire the provider worker, webhook/reconciler and processed effects, exact ownership void and Inventory V2 restoration.
4. RSVP/share/revoke/reclaim once-only ledger/outbox: unique operation keys, atomic ownership/capacity transitions, replay/concurrency/crash recovery.
5. Only after 1–4: reconcile stale orders, orders/payments/tickets/inventory, run full negative provider/device matrix and controlled migration rehearsal.

Required remaining payment/ticket proof:

1. Provider-controlled failed payment.
2. App killed before callback, during callback, and after provider capture.
3. Offline before verification and reconnect recovery.
4. Duplicate callback/webhook and idempotent issuance.
5. Expired reservation and sold-out recovery.
6. Stale cart canonicalization before render and payment.
7. Transfer/share notification and deep link on the second device.
8. Wallet pagination for accounts with more than 50 relevant rows.
9. Transactional sold/remaining/inventory-summary invariant, historical backfill and order/payment/ticket reconciliation for every tier; close R55.
10. Idempotent cleanup/recovery for stale `payment_pending` orders whose Redis reservation has expired or disappeared; close R56.
11. Refund/cancellation provider failure, partial/full amount bounds, authorization, retries and exact ownership/inventory void; close R59–R60.
12. Captured-payment timeout/app-kill/offline reconciliation without cancellation or inventory release; close R61.
13. Verify/webhook replay, reorder and concurrency through one finalizer with durable provider-event ledger/outbox; close R62.
14. RSVP/share/revoke/reclaim simultaneous retry and crash recovery with once-only capacity/ownership; close R63.
15. Production config fails closed without approved live Razorpay credentials and has no test-key fallback; close R64.

## 9. Chat, realtime, and privacy evidence

Completed:

- Event join now requires an order, RSVP, guest-list entry, assignment, or active entitlement.
- Private sends require participant membership, accepted state, non-expiry, and no block.
- Mobile sends the strict `{ text }` contract and surfaces server failures.
- Socket subscriptions wait for `AUTH_SUCCESS`.
- Event chat and operational event topics are separate.
- Event-chat subscription requires entitlement.
- DM subscription requires accepted participant state.
- Unknown topics are denied and subscription count is bounded.
- Typing uses authenticated identity and authorized chat context.
- Inbox cards no longer start individual message-history polling.

Live request proof from the connected Android Chat reopen:

- `GET /api/v1/social/matches`: 1.91 seconds.
- `GET /api/v1/social/my-chats`: 3.02 seconds.
- Per-card `/social/chat/{id}?limit=1` calls: zero.

Resumed 17–18 July device proof:

- Event chat `Neon Sundays`: unique Android message `QA-20260717-1101` posted and rendered.
- Historical 17 July failure: accepted DM `fiyJPOCDX01wg3ZFUNrc` opened empty while the inbox preview showed history; a new live message disappeared after back/reopen because the initial REST history fetch was conditional on a disconnected WebSocket.
- Current 18 July Android staging pass: Evidence 40–46 shows the private inbox, existing history, new send, back, and reopen all retained the conversation after source remediation. This closes the focused one-device defect, not reconnect/pagination/two-device acceptance.

Remaining:

- Two-device push/background/unread/deep-link proof.
- Retry ordering and duplication under poor connectivity.
- Block/unblock propagation while both users are active.
- Long-history pagination and attachment/media behavior, if enabled for launch.
- Production p95/read ceilings for matches, inbox, history, send, typing, and socket reconnect.

## 10. API efficiency and cloud-cost review

### Measured clean-auth and onboarding behavior

- Historical phone OTP sign-in emitted two concurrent `POST /api/v1/auth/sync` calls from the native auth-state listener and explicit sign-in handshake.
- Latest staging single-flight proof: clean Phase cold launch emitted exactly one auth sync, request `edd5257f-e59e-45f0-9ec6-0d47783b46e1`, HTTP 200, 3.90 seconds middleware/3.91 seconds total (Evidence 80). Earlier cold/re-login one-request traces remain recorded in R38.
- Auth request-count duplication is closed in the measured paths, but 3.90 seconds still lacks production p95/load acceptance.
- Clean consumer onboarding mutations were also slow: identity approximately 3.39 seconds, city approximately 3.22 seconds, tastes approximately 3.13 seconds, intent approximately 2.47–3.21 seconds, and completion approximately 1.53 seconds.
- The latest clean Explore bootstrap launched venues 1.93 seconds, profile 1.48 seconds, notifications 1.51 seconds, subscription 3.01 seconds, events 4.29 seconds and recommendations 10.84 seconds. Recommendation UID/query single-flight now emits exactly one GET, but latency is blocked under R58.
- Rapid-intent single-flight now passes Android staging: two host intents produced one 37.85 ms detail GET; two venue intents produced one 1,274.7 ms detail GET and one 620.5 ms follows GET; Back once returned Explore (Evidence 91–94). Production load/retry/iOS/signed RC remain under R57.
- The original identity 400 is closed on the staging device. A later completion 500 was traced to empty JSON parsing and closed with client-plus-gateway regression coverage; the physical retry returned 200.
- Cost acceptance requires retaining one auth sync per UID/generation, stage-aware deferral of nonessential stores until onboarding completes, eliminating duplicate wallet/cover-charge work, per-route Firestore/Auth/Redis/Storage/log operation counts, and alerts on retry or duplicate-bootstrap anomalies.

### Measured wallet behavior

- Cold wallet aggregation: approximately 39 Firestore document reads for the returning account.
- Instrumented cold phases: approximately 3.76 seconds.
- Cache miss after restart/invalidation: 4.33–4.85 seconds.
- Redis cache hit: 103–249 ms.
- Mutation proof: `HIT → invalidate → MISS → HIT`.
- Removed client timers previously capable of rebuilding the wallet every 45 seconds.
- Historical share-bundle joins were removed by materializing direct ownership state.
- Tickets can also request cover-charge state; the launch decision and request graph must prove `/tickets/my-wallet` and `/cover-charge/me` are not duplicated by bootstrap/tab-focus/retry behavior.

### Practical cost interpretation

At Google's currently published Standard-edition starting price of $0.03 per 100,000 document reads, one million cold wallet builds with the observed 39-read shape is roughly $11.70 in read-operation charges before free quota, regional pricing, writes, storage, egress, compute, logging, SMS, and payment-provider fees.

The main risk is not one wallet request. It is uncontrolled multiplication from polling, retries, cache failure, fan-out, bot traffic, SMS abuse, and high-cardinality logging.

Official guidance:

- [Firestore billing](https://firebase.google.com/docs/firestore/pricing) charges returned documents, some index-entry reads, writes/deletes, storage, and bandwidth; empty queries have a minimum read charge.
- [Firestore Standard pricing](https://cloud.google.com/firestore/pricing) lists current starting operation prices and notes that named databases do not receive the free quota.
- [Cloud Billing budgets](https://docs.cloud.google.com/billing/docs/how-to/budgets) are alerts, not hard spending caps.
- [Programmatic budget notifications](https://docs.cloud.google.com/billing/docs/how-to/budgets-programmatic-notifications) can drive automated cost controls through Pub/Sub.

### Required production controls

1. Firestore document/index reads, writes, deletes, latency, and errors per endpoint.
2. Cost per successful login, Explore session, interested mutation, checkout, message, claim, transfer, and wallet refresh.
3. Redis readiness, reconnects, command errors, hit ratio, latency, and invalidation failures.
4. API request count and payload bytes per screen session.
5. p50/p95/p99 by route and typed error code.
6. SMS sends, verification success, resend count, recipient/IP/device rate limit, and daily spend cutoff.
7. Log bytes by level and route; exclude routine success noise and all secrets/capability tokens.
8. Billing actual and forecast alerts at conservative thresholds with named responders.
9. Pub/Sub automation for anomaly response; do not rely on email alone.
10. Load-test ceilings and rollback thresholds written before production traffic.
11. Account-scoped cache and in-flight-request metrics that detect cross-UID reuse; retain R47 protections through signed-RC/two-device acceptance.
12. Explicit cover-charge launch decision plus deduplicated wallet/cover-charge request accounting under cold boot, tab focus, reconnect, and cache failure.
13. Retain exactly one host/venue detail and follow-state read per UID/route generation under production load, retry, background, iOS and signed RC.
14. Recommendation p50/p95/p99, operation count, payload and cache/precompute evidence; one request at 10.84 seconds is not production-ready.

## 11. UI, UX, and accessibility checklist

Completed at default Android font scale:

- Explore and event-detail navigation.
- Active/ended lifecycle copy.
- Interested control behavior.
- Checkout, provider transition, cancellation, and recovery.
- Wallet tabs, ticket detail, QR reveal, transfer, and share sheet.
- Chat tab switching, list states, event chat, and private chat.
- Profile, Settings, permissions, Blocked Accounts, logout, and re-login.
- Clean phone OTP, optional-email skip, identity layout, Android date picker, validation error, and process-death resume.
- Consumer city, tastes, intent, completion, exact DOB persistence, Explore landing, and completed-account process-death return.
- Events/Venues/Hosts search, host navigation/India-local event time, exact NOWL search, exact-paise checkout copy, and signed-out wallet return.
- Private inbox/history, new send, back/reopen persistence, dedicated-account logout/re-login, Nightlife active edit/revert, offline draft/retry, and pause/re-enable.
- No `AndroidRuntime` fatal crash observed in the completed device pass.

Observed default-scale defects retained for remediation:

- The reseeded fixture set still requires a complete default-scale reviewer screenshot/content pass across cards, details, checkout and tickets.
- The remediated first-run CTA/safe-area geometry still requires physical 200% font, small-screen, keyboard and assistive-navigation acceptance.
- Development Tools overlay obscures content and is not accepted as signed-release geometry evidence.

Required on signed RC:

1. 100% and 200% font scale.
2. TalkBack reading order, labels, roles, selected/disabled states, and live-region errors.
3. 48 dp minimum touch targets and no overlapping controls.
4. Keyboard behavior for OTP, profile forms, chat composer, transfer email, and checkout email.
5. Safe-area behavior on gesture navigation, cutouts, and smaller/taller Android screens.
6. Loading, skeleton, empty, offline, retry, expired-session, and destructive-confirmation states.
7. Text contrast, poster-overlay readability, disabled-state contrast, and color-independent status.
8. Button alignment, copy consistency, currency/date formatting, and no clipped or orphaned text.
9. Development overlay absent and release-only native UI verified.
10. Screenshot evidence for every mandatory screen and error state.

## 12. Verification record

Latest verified in this phase:

- Share/revoke/wallet safety: 22/22 tests passed across three suites.
- Chat-store regression after polling removal: 5/5 passed.
- Gateway TypeScript: PASS.
- Mobile TypeScript: PASS.
- Scoped diff/whitespace validation for the audit-related changes: PASS.
- Gateway health: HTTP 200, Firestore healthy, Redis healthy.
- Required staging indexes for wallet, assignments, event-chat entitlements, private conversations, and cover wallet: deployed.
- 17 July resumed preflight: physical Samsung SM-G980F, Android 13/API 33, 1080 × 2400 override, font scale 1.0, battery 100%, `/data` 93% used, package `com.c1rcle.app` 1.0.0/code 1, debug/dev-client artifact, ADB reverse 4000/8082, staging Firestore/Redis health HTTP 200.
- Development cold start: Android reported COLD in 1.529 seconds to Expo Dev Launcher; selecting the remembered Metro server restored the authenticated Explore session after bundle/app initialization. This is dev evidence only, not release startup proof.
- Returning-user re-login: immediate manual OTP entry with the approved test account succeeded and restored `Good Morning, Deepak`. The previously misleading signed-out Tickets state is superseded by Evidence 37–38, which shows login-required copy and authenticated wallet return.
- Phase 1 clean-user auth: dedicated staging test identity completed OTP and optional-email skip. The initial valid-adult request failed with HTTP 400 and request ID `36b3c45e-2427-4594-b5b3-87dbe610bbd6`; after the date-only correction, the same exact-boundary scenario returned 200 and advanced to city.
- Phase 1 consumer completion: identity, Pune, three canonical tastes, one intent, and completion passed. Firestore retained DOB `2008-07-17`, city `pune`, the selected canonical arrays, onboarding version 2, `currentStage=complete`, and a completion timestamp.
- Phase 1 completion recovery: the first completion attempt returned 500, request ID `47b96c48-c644-4aef-80b8-b84f97a4ee9d`, because the raw JSON parser received an empty body. After the client/header and gateway/parser hardening, physical retry request `2b15e7ba-6438-43b7-90e9-3e1b3932eed9` returned 200 and opened Explore.
- Phase 1 persistence: force-stop/relaunch retained the completed Firebase identity and canonical server state. The development artifact cold-opened Expo Dev Launcher; selecting the remembered local server returned directly to Explore without OTP or onboarding replay. Signed-RC startup remains unproven.
- Phase 1 evidence: `qa-artifacts/evidence/03-new-user/2026-07-17T184000Z-sm-g980f` contains OTP, original failures, exact-boundary success, completion failure/success, Explore, process-death screenshots, and UI hierarchies.
- Phase 1 Nightlife reproduction: Profile `GET STARTED` all-in-one publish returned 400 with request `9546c56d-7665-4664-93b4-64e7f0ee8609`; Settings wizard completed Vitals, one Prompt, and one selected/cropped Photo, then returned 400 with request `c2636259-3f31-48e8-bc98-d525bb415cc4`. Evidence files `11-clean-profile.png` through `13-nightlife-complete-contract-400.png/xml` are in the Phase 1 evidence directory.
- Phase 1 Nightlife contract diagnosis: the all-in-one editor sends unsupported `prompts` and `profileComplete`; the wizard sends unsupported `prompts`, `datingVitals.pronouns`, and `datingVitals.lifestyle`; the strict body validator rejects each request before persistence. The wizard also skips Vibes and keeps dev photos as local picker URIs. These are confirmed R39–R41 defects, not predictions.
- Phase 1 Nightlife incomplete validation: `14-nightlife-incomplete-client-validation.png/xml` proves the canonical editor lists the missing photo, height, gender, location, vibe, and prompt answer without issuing a gateway request.
- Phase 1 Nightlife sheet regression: `15-nightlife-vitals-sheet-render-error.png/xml` records the Android `ScrollView` child-layout invariant. The source implementation now uses a native `KeyboardAvoidingView`; physical acceptance remains open under R46.
- Phase 1 Nightlife source remediation: first-time Profile/Settings entries open the five-screen wizard; active profiles open `/profile-creation` for editing. Gateway/core accept strict prompts, Height/Pronouns/Lifestyle, isolated Nightlife vibes, and HTTPS `datingPhotos`; activation requires one portable photo, all three vitals, one vibe, and one prompt; upload is authenticated and UID scoped; discovery uses portable photos, Nightlife-only labels, and DOB-derived age.
- Phase 1 Nightlife valid Android run: evidence `16-nightlife-multistep-intro-restored.png` through `22-nightlife-returning-user-editor.png` proves Intro, completed Vitals, selected Vibes, answered Prompt, uploaded Photo, successful activation destination, and active-profile editor routing. Upload request `bd2854df-bdb0-4ef6-8dcf-6771afdb25b4` returned 200 after correcting the Storage decoration; activation request `0668f727-6630-454c-b097-55fce5942eac` returned 200 after rebuilding stale core output.
- Phase 1 Nightlife persistence/media proof: Firestore retained `datingActive=true`, `nightlifeProfileComplete=true`, `socialSetupComplete=true`, Height `4'3\"`, Pronouns `She/Her`, Lifestyle `Social Drinker`, Nightlife vibes `Techno`/`Bollywood`, prompt `Catch me at...`, and one UID-scoped HTTPS `datingPhotos` URL. The URL returned HTTP 200 `image/jpeg`. Nightlife and basic photo fields were then separated; after clean-bundle physical editor Save request `50bb2ad8-2c62-42f6-b9b4-daef37752e44` returned 200, the QA account remained `photos=[]`, `photoURL=null`, with the Nightlife URL present only under `datingPhotos`.
- Phase 1 Nightlife clean-reload evidence: `23-nightlife-clean-reload-editor-hydrated.png` proves the returning editor rehydrated the uploaded photo, Height `4'3\"`, Pronouns `She/Her`, Lifestyle `Social Drinker`, and selected `Techno`/`Bollywood` after a Metro cache clear; `24-basic-profile-photo-independent.png` proves the basic profile remained without the Nightlife image after Save. This run also exposed and fixed the partial `/auth/sync` versus full `/users/me` hydration race.
- Phase 1 Android permissions: `25-permissions-camera-settings-prompt.png` proves the app-specific Camera settings handoff; after granting Camera, `26-permissions-camera-enabled-refresh.png` proves the in-app state refreshed to Enabled. Revoking Camera and restarting the process returned the same row to Disabled. Contacts remained honestly unavailable, while Location and Push matched OS state. Scanner functionality was not changed or exercised.
- Phase 1 basic-profile persistence: the QA bio saved through request `46d8082a-0574-4f59-9b58-a2e765bfa05b` (200), rehydrated exactly after reopening the editor, and was reverted through `bfea7a77-b90e-4085-ba45-830ac289d27d` (200). The development Tools bubble can obstruct top-right controls and must be absent from the signed RC.
- Phase 1 canonical-city cold start: after a full Metro cache clear and process restart, `27-explore-canonical-city-cold-start.png/xml` proves Explore rendered Pune. The backend received `/api/v1/events?city=pune&limit=24&sort=soonest` as request `6296ca12-89e3-4810-9e11-756302114ddb` (200), with no preceding unfiltered event request in that clean run. Three focused city-bootstrap tests and mobile TypeScript pass.
- Evidence 28–31 — search contract/navigation: physical Android staging search returned Events, Venues and Hosts using the max-24 contract; exact host selection opened the intended host profile.
- Evidence 32 — clean bundle identity: the scoped development bundle rebuilt and loaded for the resumed physical acceptance. This is not a signed-RC artifact.
- Evidence 33 — canonical Explore resume: clean-bundle Explore rendered the ready state with Pune selected.
- Evidence 34 — host route/time-zone: the Ritz host profile rendered its upcoming event as `Fri, 14 Aug, 7:30 pm`, matching the India-local event schedule.
- Evidence 35 — venue spotlight search: exact `NOWL` search returned the venue after the spotlight hero was filtered away.
- Evidence 36 — exact paise: checkout rendered ₹999.00, Taxes & Fees ₹88.42, and Total/Pay ₹1,087.42 without whole-rupee rounding.
- Evidence 37 — signed-out wallet: Tickets rendered `Sign in to view your tickets` with a Sign In action rather than a false empty-wallet state.
- Evidence 38 — returning-login wallet: authentication returned to Tickets and rendered the returning account's Upcoming NOWL Bollywood Night ticket.
- Evidence 39 — 18 July resume baseline: the connected Samsung resumed the scoped Android staging session before focused chat/auth/Nightlife execution.
- Evidence 40–46 — private chat: private inbox and existing history rendered, a new message sent successfully, and history plus the new message remained after back/reopen. Reconnect, pagination and two-device acceptance remain open.
- Evidence 47–50 — Nightlife/settings/logout preparation: the active Nightlife entry and Settings/logout confirmation route were captured before switching to the dedicated Phase account.
- Evidence 51–57 — dedicated-account isolation baseline: the Phase account completed phone login and returned to its own legitimately empty Tickets wallet. This wallet proof does not close the later Nightlife cache-isolation failure.
- Evidence 58–63 — active editor persistence: after re-login the Nightlife editor rehydrated, Height changed from `4'3\"` to `4'4\"`, Save persisted on reopen, and the value was then reverted.
- Evidence 64–69 — offline recovery: with airplane/offline conditions, Save showed `Could not publish profile` and `Network request failed`; the `4'3\"` draft survived and retry succeeded after connectivity returned.
- Evidence 70–79 — pause/re-enable: pause set `datingActive=false` while preserving the profile; multi-step re-enable restored the saved vitals, vibes, prompt and photo and ended with `datingActive=true`.
- Evidence 80 — clean runtime: the Phase account opened Explore after a clean Metro/device relaunch with no fatal/ANR. Exactly one auth sync, request `edd5257f-e59e-45f0-9ec6-0d47783b46e1`, returned 200 in 3.90 seconds middleware/3.91 seconds total.
- Evidence 81 — Phase account after isolation remediation: Nightlife rendered `No nightlife profiles yet`, with neither its own card nor a prior-account cached card.
- Evidence 82 — runtime build identity: Settings rendered App Version 1.0.0, native Build Version 1 and Runtime Development client; the hardcoded `2117` mismatch is closed only for the development runtime.
- Evidence 83 — returning-account login transition: the physical sequence authenticated back into the returning Deepak account before the B-side Nightlife assertion.
- Evidence 84 — returning-account Nightlife: Deepak correctly rendered the Phase profile card, proving the valid other-user result was not removed by self filtering.
- Evidence 85 — A→B→A return: switching back to Phase again rendered the honest empty/no-self/no-prior state. Together with Evidence 81/84, the reproduced R47 failure is remediated on Android staging.
- Evidence 86 — host deep-link route: `c1rcle://host/demo-host-03` rendered Quantika and upcoming Friday Gin Party on development Android.
- Evidence 87 — venue deep-link route: `c1rcle://venue/demo-venue-nowl` rendered NOWL and Bollywood Night on 2 August. Association files and signed-RC behavior remain open.
- Evidence 88 — recommendation single-flight: a clean cold relaunch emitted exactly one recommendation GET, request `e8205ea1-49b2-4373-bf32-64bf82c52a72`, HTTP 200. Request count passes; 10.84-second latency remains blocked.
- Evidence 90 — `qa-artifacts/evidence/04-phase1-resume/2026-07-18T085818Z-sm-g980f/90-nightlife-pause-control-regression.png/xml`: after a clean bundle, Settings opened the normal active Nightlife editor with Profile visibility/Pause; preservation copy opened and Keep Active retained the profile. Route-intent hardening passes 6/6 focused, consolidated 112/112 and mobile TypeScript.
- Evidence 91–92 — `91-host-detail-rapid-singleflight-pass.png/xml` and `92-host-detail-back-once-pass.xml` in the same evidence directory: a genuine 5,534-module Metro bundle received two rapid host intents but emitted exactly one GET, request `39a9f299-72df-4c57-8c47-89d23916dde8`, HTTP 200/37.85 ms; one Back returned Explore.
- Evidence 93–94 — `93-venue-detail-rapid-singleflight-pass.png/xml` and `94-detail-back-once-explore-pass.png` in the same evidence directory: two rapid venue intents emitted one venue GET `1c1ea107-875b-4db8-becb-4c5aca185dea` (200/1,274.7 ms) and one follows GET `c363c4a4-3b2b-4db8-becb-4c5aca185dea` (200/620.5 ms); one Back returned Explore.
- Evidence 95 — `qa-artifacts/evidence/04-phase1-resume/2026-07-18T085818Z-sm-g980f/95-inventory-v2-audit-staging.json`; embedded report `checksumSha256` is `39715f6e5c1074842068982cf755a9e91c13b4d5caac755ec2f496d0156c0e05`. Read-only `c1rcle-staging` inventory audit: 70 stored events, 105 finite tiers, 19 balanced, 86 fail closed on invariant/readability, 0 shard documents, 64 invalid finite fields, 16 invariant failures, 292 unaccounted quantity, 6 conflicting sources, 2 sold-mirror mismatches and 105 implicit authority. It selects ticket fields only, not lifecycle/visibility/sale windows; do not interpret all 86 as currently purchasable. Known demo-event-02/05 exposure remains confirmed. No data changed.
- Evidence 96 — `qa-artifacts/evidence/04-phase1-resume/2026-07-19T100448Z-sm-g980f-batched/96-inventory-v2-lifecycle-audit-staging.json`; embedded checksum `723b4483afe732618067fb7dc414b784670c1a311b788ad22ae60b9f0ebc2e12`. Read-only lifecycle-aware `c1rcle-staging` audit at `2026-07-19T10:55:00.000Z`: 20 saleable finite tiers, 18 balanced, exactly 2 failing (`demo-event-02/t2`, `demo-event-05/t1`) with six unaccounted units; 79 non-saleable and 6 source-ambiguous. Public inventory now source-fails closed for non-canonical and elapsed event lifecycles; 44 focused tests plus core TypeScript pass. No data changed.
- Evidence 97 — `qa-artifacts/evidence/04-phase1-resume/2026-07-19T100448Z-sm-g980f-batched/97-active-inventory-cross-ledger-staging.json`; file SHA-256 `396e8a0666abb8e8e02b5eb9685169a3dcdc4734ef8a0991931a68d2a9b93aea`. Sanitized read-only trace of the two active failing tiers across events, orders, payments, tickets, entitlements, assignments, reservations, shares, refunds, outboxes and ledger entries. Completed purchase parity passes, but historical seeded sold totals have no immutable baseline or finance ledger, provider truth was not fetched, and `ORD-MR4A01JE-QP89X` remains payment-pending with a converted reservation and no ticket. Therefore no repair values are proposed and no data changed.
- Evidence 25–26 — `qa-artifacts/evidence/04-phase1-resume/2026-07-19T100448Z-sm-g980f-batched/25-event-inventory-boundary-smoke.png/xml` and `26-event-timezone-india-pass.png/xml`. On the Arizona-configured Samsung, pre-fix event05 rendered `Sunday, 2 August at 1:00 pm`; after venue-timezone formatting it renders the same stored instant as `Monday, 3 August at 1:30 am`. Thirty focused mobile tests and mobile TypeScript pass. Fixture intent remains open under R66.
- Production infrastructure preflight — `qa-artifacts/evidence/06-production-infrastructure/2026-07-18T171909Z/01-production-url-preflight.txt`: production API DNS has no answer; API calls fail with curl error 6; Privacy, Terms, Refund, Account Deletion, `assetlinks.json` and AASA return 404. Source policy remediation, guest-portal TypeScript, a successful Webpack production build with all four static routes, and desktop/390 × 844 local browser semantics/overflow/contrast/link checks are recorded but receive no external/publication PASS credit. Browser review caught and corrected nested-main and invalid-opacity defects. The default Turbopack path is blocked by a corrupted local Darwin ARM64 SWC binary.
- Guest-portal Sentry source preflight — `instrumentation.js`, `instrumentation-client.js` and `app/global-error.jsx` now cover Next.js request, client navigation and App Router render errors; final TypeScript/Webpack build passes without the previous missing-hook/global-handler warnings. This is source/build evidence only. Production DSN, source-map upload, symbolication, PII/retention controls and alert routing remain unproven.
- Release prerequisite preflight — `qa-artifacts/evidence/06-production-infrastructure/2026-07-18T171909Z/02-release-prerequisite-preflight.txt`: this Mac selects Command Line Tools rather than full Xcode; the production mobile profile still contains a Razorpay test-mode public key plus placeholder Sentry and Google client values. Credential values are intentionally omitted.
- Android staging performance profile — `qa-artifacts/evidence/07-performance-cost/2026-07-18T174300Z-android-staging/01-runtime-request-latency-profile.txt`: repeated QA lifecycle actions produced six auth-sync calls with a 3.20-second slow-sample mean, six subscription calls at 2.52 seconds, six event calls at 2.33 seconds and three slow recommendation samples at 4.61 seconds. Counts are not a single journey; no production percentile or cost claim is made. Operation/byte instrumentation and cost alerts remain open.
- Resumed physical Android Phase 1 matrix — `qa-artifacts/evidence/04-phase1-resume/2026-07-18T171826Z-sm-g980f/README.md` plus 182 checksummed artifacts: connected/authorized SM-G980F, `.nosync` bundle and healthy staging API; reversible profile edit/restore; Location and Notification revoke/recovery; prior-account logout; supplied `+1 5555555555` test login; returning Deepak/Pune route; force-stop session restore; exactly one auth-sync; zero matched fatal signatures. It also proves the installed artifact is DEBUGGABLE/Dev Launcher, the internal settings-permissions link fails, and Nightlife state-changing offline/draft acceptance remains open. Scanner/payment were untouched.
- Phase 2 foundation validation: inventory auditor passes 3 suites/44 tests; inventory plus refund foundation passes 4 suites/76; refund approval/rejection passes gateway 33/33 and the core refund contract 26/26; finalizer/outbox/refund combined validation passes 3 suites/60 tests; core and gateway TypeScript pass. These results validate source primitives/contracts only, not runtime route/provider/scheduler/consumer/reconciler wiring or P0 closure.
- Consolidated Phase 1 validation: 19 suites/112 tests, mobile TypeScript and gateway TypeScript pass; native/deep-link agent suite passes 41/41. This remains development-source/device evidence, not signed RC/iOS/two-device/load certification.
- Nightlife account-isolation source proof: UID-owned profiles/matches, logout/account-switch clearing, in-flight invalidation and self/stale-action guards pass 6/6 focused, 27/27 combined dating/auth tests and mobile TypeScript. Signed RC, iOS, process-death races, full discovery interactions and two-device proof remain.
- Onboarding/CTA source proof: typed core snapshot end to end, defined-field merges, saved-city revisit and measured CTA/safe-area/large-text remediation pass core 234/234, gateway onboarding 5/5, mobile focused 25/25 and gateway/mobile TypeScript. Physical revisit/200%/signed-RC acceptance remains.
- Fixture reseed proof: canonical source/staging contains 13 future events, 13 unique hosts and 12 venues/read models; event05 aligns Bollywood/NOWL/Pune/Sunday 2 August. Reseed preserved live tier fields but does **not** validate their read semantics; full reviewer matrix remains and R55 is P0.
- Phase 2 P0 inventory evidence: Evidence 96 confirms event05 t1 persisted remaining 454 but runtime calculates 457, and event02 t2 persisted 10 but runtime calculates 13. These are the only two failing tiers among 20 currently saleable tiers; six units are unaccounted. Inventory V2 remains off/unwired, so current availability remains unsafe. No data changed. See R55.
- Phase 2 stale-order evidence: `ORD-MR4A01JE-QP89X` remains `payment_pending` since 3 July while reservation `26540080-...` is absent/expired. See R56.
- Phase 2 payment-integrity trace: cancellation/refund can call Razorpay with undefined payment ID, mark cancelled after failed refund, omit inventory/ownership void; refund lacks ownership/amount/durable idempotency/provider guarantees; timeout can cancel after capture; verify/webhook compete without durable event ledger/outbox; RSVP/share transitions can repeat; production can fall back to `rzp_test_DEVELOPMENT`. See R59–R64. Read-only trace only; no data changed.
- Razorpay credential classification — no values retained: mobile production line 15 is `TEST_KEY`; mobile development is `TEST_KEY`; no API-gateway `.env.production` was found in checked paths; gateway development is `TEST_KEY`. Production credential gate remains P0 blocked under R14/R64.
- Detail-read cost closure: the original duplicate host/venue/follow requests are superseded by Evidence 91–94 exactly-once physical traces. Android staging passes; production load/retry/iOS/signed RC remain under R57.
- Phase 1 focused regression after Nightlife remediation: core, gateway, and mobile TypeScript pass when run sequentially, including the final post-hydration-fix mobile check. The prior focused 7/7 Nightlife core result remains valid; 26/26 focused mobile profile-store tests pass, including the new partial-auth/full-private-profile hydration regressions; a basic-vs-Nightlife photo-array regression and direct built-core separation smoke also pass. The API Vitest runner hung without producing a result in this checkout and was terminated, so the new upload unit test receives no pass credit; physical HTTP/Storage evidence is retained instead. Repository-wide `git diff --check` remains noisy from unrelated pre-existing changed files, while touched Nightlife files pass scoped whitespace validation.
- iOS Phase 1 preflight remains blocked: no iPhone enumerated over USB and this Mac exposes only `/Library/Developer/CommandLineTools`; `/Applications/Xcode.app`, `xcodebuild`, and `devicectl` are unavailable.
- No `FATAL EXCEPTION`, `AndroidRuntime` fatal or ANR occurred during the latest clean resumed path; current functional regressions and resolved staging blockers are listed in R30–R64.

Earlier broader regression snapshot retained as historical evidence:

- Mobile targeted regression: 143 tests across 11 suites.
- Backend/core targeted regression: 62 tests across 7 suites.

These broader counts must be rerun from a clean signed-release commit before final approval.

## 13. Signed release-candidate test run

The final RC pass must record:

1. Commit SHA, build number, application ID, version, environment, API origin, and database project.
2. Clean install and upgrade install.
3. New User A and returning User B on separate physical devices.
4. Every mandatory gate from Section 4.
5. Start/end timestamps and screenshot/log evidence per scenario.
6. Network conditions: normal, slow, offline, reconnect.
7. App states: foreground, background, force-stop, process death, device reboot.
8. Payment states: success, failure, cancel, timeout, response loss, duplicate callback.
9. Ownership states: buyer, transfer, claim, revoke, cancel, expiry, retry.
10. Chat states: event, pending private, accepted private, unread, push, block, deep link.
11. Accessibility at 100% and 200% font plus TalkBack.
12. Crash-free result and backend 4xx/5xx review.
13. Firestore/SMS/log/Redis cost and health snapshot.
14. Rollback rehearsal or documented rollback command and owner.

## 14. Final launch approval criteria

Launch approval requires all of the following:

- [ ] Zero unresolved P0 defects.
- [x] ~~R47 Android-staging cross-account Nightlife isolation passes focused regression and physical A→B→A retest.~~
- [ ] R47 signed-RC, iOS, rapid-switch/in-flight, process-death, discovery-interaction and two-device matrix passes.
- [ ] Every mandatory gate is PASS or has a signed exception.
- [ ] Every accepted P1 has an owner, mitigation, monitoring, and due date.
- [ ] Signed Android RC passes clean install and upgrade.
- [ ] Clean new-user onboarding passes.
- [ ] Two physical devices pass multi-user messaging and ticket handoff.
- [ ] Provider-controlled payment failure and recovery pass.
- [ ] Stale cart and expired reservation recovery pass.
- [ ] R55 P0 oversell path is replaced by Inventory V2, audited/backfilled/reconciled and migration rollback-tested; R56 stale-order cleanup passes.
- [ ] R59–R60 refund/cancellation provider execution, authorization, amount bounds, idempotency, ownership void and exact inventory restoration pass.
- [ ] R61–R62 captured-payment reconciliation and one durable verify/webhook finalizer/event-ledger/outbox pass replay, reorder, crash and concurrency tests.
- [ ] R63 RSVP/share/revoke/reclaim capacity/ownership transitions are once-only under retries/concurrency; R64 production test-key fallback is removed and build/start fail closed.
- [ ] 200% font and TalkBack pass.
- [ ] No release-build fatal crash.
- [ ] Production secrets, links, push, analytics, privacy, and account deletion are verified.
- [ ] Firestore, Redis, SMS, logging, and payment dashboards are live.
- [ ] Actual/forecast billing alerts and automated response are tested.
- [ ] Backup/restore, incident response, and rollback owner are confirmed.
- [ ] Product, engineering, QA, and operations sign the release record.

## 15. Current release decision

**NO-GO.**

The tested Android development functional scope now has no known unresolved P0. The **overall audit remains NO-GO with confirmed Phase 2 P0 blockers**. Inventory V2, refund request/approval/rejection, finalization contracts and the leased outbox-worker primitive are useful tested foundations, but flags/routes/provider truth/schedulers/reconcilers/live consumers and terminal effects are off or unwired and therefore close no P0. Evidence 96 closes the lifecycle-aware scope: 20 tiers are currently saleable, 18 balanced and exactly 2 fail with six unaccounted units; 79 are non-saleable and 6 source-ambiguous. The two active discrepancies still require cross-ledger reconciliation, reviewed repair, backup/restore and backfill before any V2 enablement. Refund/cancellation/finalization/RSVP and production test-key blockers remain, alongside stale orders, latency, signed Android/iOS, stores/infrastructure, two devices, legal/privacy/security/cost/operations. No data changed.

Do not promote this build directly to production. Complete every applicable gate in Sections 1, 4, and 13–29, attach the required evidence, obtain the stated approvals, and then update this decision in place.

## 16. Evidence, ownership, and exception protocol

This section controls how every remaining checkbox is closed. A code path, UI screen, config key, successful debug run, or verbal assurance is not launch evidence by itself.

For every completed gate, record:

| Field | Required value |
|---|---|
| Gate ID | Exact row or checkbox identifier from this file. |
| Status | PASS, PARTIAL, BLOCKED, DEFERRED, or NOT APPLICABLE. |
| Owner | Named accountable person, not only a team name. |
| RC identity | Commit SHA, platform build number/version code, environment, API origin, Firebase project, and store track. |
| Evidence | Artifact path or console URL, timestamp, device/OS, request/order ID where relevant, and expected versus actual result. |
| Reviewer | Independent reviewer who did not perform the original step. |
| Expiry | Date the evidence must be repeated because policy, credentials, infrastructure, or binary changed. |

Rules:

1. PASS requires evidence from the exact release candidate; debug-client proof can support diagnosis but cannot certify a store binary.
2. Store-console work requires exports or screenshots from the real organization account.
3. Legal, tax, and regulatory rows require written advice or approval from the stated professional; source code cannot prove legal compliance.
4. NOT APPLICABLE requires a written rationale, approver, and the facts that make the requirement inapplicable.
5. An exception must name the risk, affected users, mitigation, monitoring, rollback trigger, owner, and expiry. P0 exceptions require executive, security, product, and legal approval.
6. Any binary, backend, privacy-policy, SDK, permission, payment, entitlement, or material product change invalidates the affected evidence.
7. The final RC must come from a clean, reproducible commit. The unreadable main Git tree and extensively dirty `.nosync` tree are current release-process blockers.

## 17. Android production engineering audit

Current status: **BLOCKED**. Source inspection found a debug APK and a debug merged configuration, not a production Play artifact.

| ID | Status | Requirement and acceptance evidence | Owner |
|---|---|---|---|
| AND-01 | BLOCKED | Cut a clean immutable RC and produce a signed `.aab`; record SHA-256, application ID, version name/code, EAS build ID, and provenance. | Android release |
| AND-02 | BLOCKED | Replace source-level debug signing for `release`; enable Play App Signing, protect the upload key, document key recovery and access. | Android release/security |
| AND-03 | PARTIAL | Debug evidence targets API 36, which is forward-compatible with the 31 August 2026 API 36 submission deadline; prove target/compile/min SDK from the Play-delivered release artifact. | Android release |
| AND-04 | BLOCKED | Inspect the release merged manifest and remove `SYSTEM_ALERT_WINDOW`, `RECORD_AUDIO`, legacy storage, background location, or other permissions unless a documented launch feature requires them and store declarations approve them. | Android/privacy |
| AND-05 | BLOCKED | Replace scanner-related camera copy in the consumer app with the real consumer use case; scanner certification remains deferred. | Mobile/privacy |
| AND-06 | BLOCKED | Add verified HTTPS App Links with `android:autoVerify`, exact hosts and paths; publish correct `assetlinks.json` containing the production signing certificate; test cold/warm/install states. | Mobile/web |
| AND-07 | BLOCKED | Decide backup policy; prove tokens, payment state, PII, QR material, and secure-store data are excluded from Auto Backup/device transfer or safely recoverable. | Security/mobile |
| AND-08 | BLOCKED | Verify all native libraries in the AAB support 16 KB pages with Play/`bundletool` and device/emulator proof. This is mandatory for affected Android 15+ submissions. | Android release |
| AND-09 | BLOCKED | Enable release shrinking/obfuscation deliberately; upload R8 mapping and native symbols; prove crash symbolication. | Android/observability |
| AND-10 | BLOCKED | Restrict Firebase, Google Maps, OAuth, and other Google credentials to the production package, signing SHA-256, domains, and required APIs only. | Cloud/security |
| AND-11 | BLOCKED | Verify FCM registration, notification channel behavior, Android 13+ runtime notification permission, token rotation, logout cleanup, deep links, and background delivery. | Mobile/backend |
| AND-12 | BLOCKED | Run API 36 edge-to-edge, predictive-back, process-death, state-restoration, multi-window, tablet/foldable, and keyboard/inset testing. | Android QA |
| AND-13 | BLOCKED | Physical matrix: Android 10, 13, 15, and 16; Samsung, Pixel, and at least one India-common Xiaomi/OnePlus/realme-class device; include low RAM and poor network. | QA |
| AND-14 | BLOCKED | Test clean install, upgrade, reinstall, device reboot, offline/reconnect, low storage, denied permissions, 200% font, TalkBack, and no fatal crash on the Play-delivered artifact. | QA |
| AND-15 | BLOCKED | Review Android Vitals and set alert/rollback thresholds for crash, ANR, wake lock, startup, rendering, and excessive network behavior. | Android/operations |
| AND-16 | BLOCKED | Use one canonical typed deep-link registry for event, host, venue, ticket share/claim, wallet, chat, Nightlife, policy, deletion and notification routes; align manifest filters, web URLs and fallback behavior. | Mobile/web/backend |
| AND-17 | BLOCKED | Configure Firebase App Check with the production Play Integrity provider, remove debug-token behavior from release, stage enforcement, monitor rejection, and prove valid/invalid/replayed clients plus honest failure UX. | Android/cloud/security |

Official baselines: [target API policy](https://developer.android.com/google/play/requirements/target-sdk), [16 KB support](https://developer.android.com/guide/practices/page-sizes), [Android 16 behavior changes](https://developer.android.com/about/versions/16/behavior-changes-16), and [Android Vitals](https://developer.android.com/topic/performance/vitals/index.html).

## 18. Google Play launch audit

Current status: **BLOCKED**. No Play Console account, declarations, signed artifact, listing, testing-track, or review evidence was available.

| ID | Status | Requirement and acceptance evidence | Owner |
|---|---|---|---|
| PLAY-01 | BLOCKED | Verify the organization developer account, legal name/address, D-U-N-S or required documents, website, developer email/phone, two-step verification, and least-privilege roles. | Account holder/legal |
| PLAY-02 | BLOCKED | Confirm Android developer verification and package registration state in the applicable console. | Account holder |
| PLAY-03 | BLOCKED | If the account is a personal account created after 13 November 2023, complete device verification and the required 12-tester/14-day continuous closed test before production access. Otherwise attach organization-account proof. | Release manager |
| PLAY-04 | BLOCKED | Upload the signed AAB to internal/closed testing; retain Play-generated APK inspection, signing certificate, manifest, target SDK, 16 KB result, mapping, and symbols. | Android release |
| PLAY-05 | BLOCKED | Complete App Access with a stable review account and isolated reviewer OTP/bypass. Never ship the universal test OTP as a general production backdoor. | QA/security |
| PLAY-06 | BLOCKED | Publish a public, non-geofenced HTML privacy policy linked in-app and in Play Console; it must identify THE C1RCLE and match actual collection, sharing, retention, deletion, and contacts. | Legal/privacy |
| PLAY-07 | BLOCKED | Complete Data safety from the real app/SDK/network inventory, including identity, phone/email/DOB, profile media, messages, location, social graph, purchase history, device IDs, diagnostics, analytics, and processors. | Privacy/mobile |
| PLAY-08 | BLOCKED | Provide both a prominent in-app deletion path and a working public web deletion/request URL; prove processor propagation and disclosed lawful retention. | Backend/legal |
| PLAY-09 | BLOCKED | Complete target audience and IARC content rating honestly for 18+, nightlife/alcohol references, chat, UGC, social interaction, dating-like behavior, and unrestricted web content if present. | Product/legal |
| PLAY-10 | BLOCKED | Complete ads, Advertising ID, financial features, health, permissions, foreground services, and any other generated App content declarations, including explicit “no” answers where accurate. | Release/privacy |
| PLAY-11 | BLOCKED | Complete UGC policy proof: Terms/Community Guidelines acceptance, prohibited content, message/profile reporting, one-to-one blocking, moderation operations, escalation, and enforcement. | Trust & safety |
| PLAY-12 | BLOCKED | Determine whether Play classifies the app under Social; if applicable, publish CSAE standards, in-app feedback, CSAM detection/reporting process, trained child-safety contact, and complete Child Safety Standards certification even with an adults-only audience. | Trust & safety/legal |
| PLAY-13 | BLOCKED | Confirm Razorpay is used only for real-world live-event admission and related physical services. Route digital premium/chat/boost/subscription functionality through Play Billing or an approved India alternative-billing program. | Payments/product |
| PLAY-14 | BLOCKED | Use Photo Picker/manual entry where possible; remove broad media, contacts, background-location, SMS/call-log, exact-alarm, package-query, and unnecessary service permissions. | Android/privacy |
| PLAY-15 | BLOCKED | Complete truthful title, description, category, screenshots, icon, support contacts, release notes, countries, pricing, content rights, and no misleading claims/test UI. | Marketing/legal |
| PLAY-16 | BLOCKED | Run the Play pre-launch report with working credentials/deep links; close stability, compatibility, performance, security, and accessibility errors and formally triage warnings. | QA |
| PLAY-17 | BLOCKED | Record testing feedback and production-access answers; for the first public release use closed/open testing and managed launch controls because percentage staged rollout is not available for a first production release. | Release manager |
| PLAY-18 | BLOCKED | Define post-launch review, policy-notice, vitals, support, refund, abuse, and rejection-response owners with rollback/kill-switch thresholds. | Operations |

Official baselines: [developer verification](https://support.google.com/googleplay/android-developer/answer/10841920), [testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465), [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469), [account deletion](https://support.google.com/googleplay/android-developer/answer/13327111), [UGC policy](https://support.google.com/googleplay/android-developer/answer/9876937), [payments policy](https://support.google.com/googleplay/android-developer/answer/9858738), and [pre-launch reports](https://support.google.com/googleplay/android-developer/answer/9842757).

## 19. iOS production engineering audit

Current status: **BLOCKED**. No archive, IPA, TestFlight build, distribution entitlement report, or iOS physical-device pass exists. The selected developer directory is Command Line Tools, so this machine cannot currently produce or inspect the required archive with `xcodebuild`.

| ID | Status | Requirement and acceptance evidence | Owner |
|---|---|---|---|
| IOS-01 | BLOCKED | Install/select full Xcode 26 or later and build with the iOS 26 SDK or later, required for App Store uploads since 28 April 2026. | iOS release |
| IOS-02 | BLOCKED | Create an immutable distribution-signed archive; record commit, marketing/build versions, bundle ID, Team ID, archive/export method, provisioning profile, and certificate. | iOS release |
| IOS-03 | BLOCKED | Replace development APNs entitlement with correct distribution entitlements and prove production push, token rotation, background delivery, and logout cleanup. | iOS/backend |
| IOS-04 | BLOCKED | Remove Expo Dev Launcher Bonjour/local-network descriptions, `exp+` scheme, development-client metadata, and any other debug-only capability from the archive. | iOS release |
| IOS-05 | BLOCKED | Reconcile camera, photos, microphone, location Always/background, tracking, Face ID, and contacts purpose strings with actual launch features; remove unused protected access. | iOS/privacy |
| IOS-06 | BLOCKED | Publish valid AASA files for every associated domain and prove universal links after install, cold launch, warm launch, logged-out redirect, and expired/invalid link. | Mobile/web |
| IOS-07 | BLOCKED | Verify Sign in with Apple entitlement, nonce/state handling, account linking, hidden-email behavior, credential revocation, reauthentication, and token revocation on deletion. | Auth/backend |
| IOS-08 | BLOCKED | Generate Xcode’s privacy report; validate the app privacy manifest and every required third-party SDK manifest/signature against actual data and required-reason API use. | iOS/privacy |
| IOS-09 | BLOCKED | Decide whether iPad is truly supported. If yes, pass iPad portrait/landscape, split view, keyboard, checkout, chat, and modal geometry; otherwise remove unsupported tablet claims/config before submission. | Product/iOS QA |
| IOS-10 | BLOCKED | Upload dSYMs/source maps and prove a TestFlight crash is symbolicated with production Sentry configuration. | Observability/iOS |
| IOS-11 | BLOCKED | Complete export-compliance determination for encryption and set metadata/`ITSAppUsesNonExemptEncryption` only from that documented determination. | Legal/iOS |
| IOS-12 | BLOCKED | Test clean install, upgrade, restore, process death, background/foreground, denied permissions, Low Power Mode, poor network, Dynamic Type, VoiceOver, reduce motion, and no fatal crash on TestFlight. | iOS QA |
| IOS-13 | BLOCKED | Device matrix: current and oldest supported iPhone OS, small/large screens, notch/Dynamic Island, and every advertised iPad class. | QA |

Official baselines: [Apple SDK requirement](https://developer.apple.com/news/upcoming-requirements/), [privacy manifests](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files), and [supported iOS capabilities](https://developer.apple.com/help/account/reference/supported-capabilities-ios).

## 20. Apple App Store launch audit

Current status: **BLOCKED**. No App Store Connect record, agreements, declarations, product page, IAP product, review build, or reviewer-access evidence was inspected.

| ID | Status | Requirement and acceptance evidence | Owner |
|---|---|---|---|
| ASC-01 | BLOCKED | Verify the legal organization, Account Holder, agreements, tax, banking, paid-app agreement where required, roles, and support contacts. | Account holder/finance |
| ASC-02 | BLOCKED | Create the app record with exact bundle ID/SKU, primary language/category, content rights, territories, pricing, and availability. | Release/legal |
| ASC-03 | BLOCKED | Complete accurate name/subtitle/description/keywords, screenshots per device class, support URL, privacy URL, marketing URL if used, copyright, and review notes. | Marketing/legal |
| ASC-04 | BLOCKED | Answer the current age-rating questionnaire, including July 2026 social-media capabilities, chat/UGC, dating-like behavior, sexual/alcohol references, and in-app controls; apply a higher rating if product/legal requires it. | Product/legal |
| ASC-05 | BLOCKED | Complete App Privacy for every first- and third-party collected data type, purpose, linkage, and tracking behavior; make it match the binary, privacy report, policy, and consent screens. | Privacy |
| ASC-06 | BLOCKED | Provide App Review a permanent full-access account, isolated reviewer OTP path, payment/ticket sample, and precise steps for auth, checkout, wallet, share/claim/transfer, chat, report/block, subscription, and deletion. | QA/release |
| ASC-07 | BLOCKED | Keep production-like backend services and reviewer fixtures available throughout review without exposing real user data or universal test credentials. | Backend/QA |
| ASC-08 | BLOCKED | Prove in-app permanent account deletion, associated UGC handling, auth-token revocation, processor propagation, and disclosed financial/fraud/safety retention. | Backend/legal |
| ASC-09 | BLOCKED | Satisfy Guideline 1.2 for UGC: prevention/filtering, report, block, published contact, moderation queue/SLA, appeals, and no random/anonymous stranger-chat posture. | Trust & safety |
| ASC-10 | BLOCKED | If Google/Facebook or another third-party primary login ships, offer an equivalent Guideline 4.8 login—normally Sign in with Apple—and test account-linking edge cases. | Auth/iOS |
| ASC-11 | BLOCKED | Explain that Razorpay purchases are real-world event admission under Guideline 3.1.3(e). Use Apple IAP for digital subscriptions/features and disclose any attendee chat as ancillary to physical admission. | Payments/legal |
| ASC-12 | BLOCKED | Create subscription groups/products/offers, localizations, review screenshots, server-notification URL, and subscription terms; pass sandbox/TestFlight purchase and restore lifecycle. | Subscriptions |
| ASC-13 | BLOCKED | Complete export compliance and content-rights declarations; retain licenses for posters, venues, artists, music, video, trademarks, and promotional material. | Legal |
| ASC-14 | BLOCKED | Complete TestFlight internal/external testing, beta review if needed, tester feedback, Accessibility Nutrition Label when applicable, and phased release/managed release plan. | Release/QA |
| ASC-15 | BLOCKED | Assign rejection-response, expedited-fix, review-communication, customer-review, refund, abuse, crash, and rollback owners. | Operations |

Official baselines: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy), [account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app), [age rating](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/), and [required App Store properties](https://developer.apple.com/help/app-store-connect/reference/app-information/required-localizable-and-editable-properties/).

## 21. Payments, tickets, subscriptions, refunds, and reconciliation

Current status: **BLOCKED**. The staging physical-ticket success path passed; live-mode Razorpay, provider-controlled failure, refunds/disputes, and digital subscriptions have not passed. The production EAS profile currently contains a Razorpay test key.

| ID | Status | Requirement and acceptance evidence | Owner |
|---|---|---|---|
| PAY-01 | BLOCKED | Replace the production test key with the approved live public key; keep live secrets and webhook secrets server-side; isolate test/live data and credentials. | Payments/security |
| PAY-02 | BLOCKED | Complete merchant onboarding/KYC, live Razorpay contract, allowed MCC/use case, settlement account, refund/dispute contacts, and production webhook configuration. | Finance/legal |
| PAY-03 | BLOCKED | Run a controlled low-value live transaction, ticket issuance, settlement reconciliation, full/partial refund where supported, and ledger/tax-document proof. | Finance/QA |
| PAY-04 | BLOCKED | Prove failed, cancelled, pending, timed-out, app-killed, offline, duplicate callback, duplicate webhook, delayed webhook, replay, refund, dispute, and chargeback behavior without double charge or phantom ticket. | Payments QA |
| PAY-05 | BLOCKED | Reconcile stale cart, repricing, sold-out, expired reservation, tier deletion, event postponement/cancellation, inventory conflict, retry, and edit-ticket flows before authorization. | Checkout/backend |
| PAY-06 | BLOCKED | Verify amount/currency/tax/fee rounding end to end in paise, display total and breakup before payment, and reject client-controlled price/quantity/tier fields. | Payments/backend |
| PAY-07 | BLOCKED | Define merchant-of-record/marketplace/agent model and align organizer settlement, cancellation reserve, chargebacks, refunds, invoices, and customer support. | Legal/finance |
| PAY-08 | BLOCKED | Keep ticket claim/share/transfer free unless a separate Apple/Google/RBI/tax review approves paid transfer, resale, stored value, credit, or cash-out. | Product/legal |
| SUB-01 | BLOCKED | Configure RevenueCat separately for Apple and Google at app startup with production keys and authenticated UID; remove no-op restore/sync behavior. | Mobile/subscriptions |
| SUB-02 | BLOCKED | Create matching store products/entitlements and backend truth; validate signed RevenueCat/store server notifications idempotently. | Backend/subscriptions |
| SUB-03 | BLOCKED | Pass purchase, pending, restore, renewal, grace, billing retry, cancellation, expiry, refund, revoke, upgrade/downgrade, family/account change, reinstall, cross-device, and webhook replay. | QA/subscriptions |
| SUB-04 | BLOCKED | Enforce premium entitlement server-side for every protected capability; client state is display/cache only. | Backend/security |
| SUB-05 | BLOCKED | Make subscription terms, price, renewal, trial, cancellation, restore, privacy, and support copy accurate on both stores. | Product/legal |

## 22. Privacy, data inventory, consent, retention, and deletion

Current status: **BLOCKED**. The generated native privacy manifest reports no collected data while the app handles substantial personal and transactional data; source `app.json` declares only a subset. Public policy and deletion URLs were unavailable during the audit.

| ID | Status | Requirement and acceptance evidence | Owner |
|---|---|---|---|
| PRIV-01 | BLOCKED | Produce a field-level data inventory across app, API, Firebase, Redis, storage, logs, analytics, Sentry, maps, auth, Razorpay, RevenueCat, SMS, support, backups, exports, and admin tools. | Privacy/engineering |
| PRIV-02 | BLOCKED | For each field record source, purpose, legal basis/consent, required/optional status, recipients/processors, country, encryption, retention, deletion/anonymization, and user-right path. | Privacy/legal |
| PRIV-03 | BLOCKED | Cover phone, email, DOB/age, name, city, precise/coarse location, photos, interests, social graph, likes/matches, messages, reports/blocks, tickets/orders, payment metadata, push/device IDs, diagnostics, analytics, and IP/security logs. | Privacy |
| PRIV-04 | BLOCKED | Reconcile one approved truth across privacy policy, Terms, consent screens, permission prompts, Apple App Privacy, privacy manifests/report, Google Data safety, SDK disclosures, and processor contracts. | Privacy/legal |
| PRIV-05 | BLOCKED | Publish durable HTTPS Privacy, Terms, Community Guidelines, Refund/Cancellation, Account Deletion, Support, and Grievance pages with version/effective date and monitored uptime. | Legal/web |
| PRIV-06 | BLOCKED | Make consent specific, informed, affirmative, recorded, versioned, and withdrawable as easily as granted; separate core functionality, analytics, marketing, location, contacts, and tracking choices. | Product/privacy |
| PRIV-07 | BLOCKED | Minimize permissions/data; defer prompts to feature use; make denial honest and non-blocking for unrelated functionality. | Mobile/privacy |
| PRIV-08 | BLOCKED | Define a retention schedule that separates deletable profile/social data from tax, invoice, dispute, fraud, abuse, and security evidence retained under a documented obligation. | Legal/privacy |
| PRIV-09 | BLOCKED | Prove deletion across auth, profiles, media, social graph, likes/matches, messages/UGC handling, notifications/tokens, shares/transfers, tickets/orders, caches, search, analytics/support processors, and backups or documented expiry. | Backend/privacy |
| PRIV-10 | BLOCKED | Verify deletion does not destroy other users’ conversation integrity, valid ticket ownership, refund/chargeback records, moderation evidence, or statutory accounting data; anonymize/minimize where deletion is not lawful. | Backend/legal |
| PRIV-11 | BLOCKED | Revoke Firebase/social/Apple credentials and device tokens; prevent deleted-user resurrection through stale caches, restore, deep links, or retries. | Auth/backend |
| PRIV-12 | BLOCKED | Test access, correction, export where offered/required, consent withdrawal, marketing opt-out, deletion request, appeal/grievance, and completion notification with SLA evidence. | Privacy/support |
| PRIV-13 | BLOCKED | Sign data-processing/security terms with processors; document sub-processors, breach notification, deletion support, cross-border handling, and exit/portability. | Legal/security |
| PRIV-14 | BLOCKED | Decide ATT applicability from actual cross-company tracking. If no tracking exists, remove misleading ATT copy/prompt; if it exists, obtain ATT before tracking and disclose accurately. | Privacy/marketing |

## 23. UGC, chat, nightlife, age, and user safety

Current status: **BLOCKED**. Report/block code exists, but operational moderation, versioned acceptance, appeals, complete age enforcement, and two-device safety behavior are not certified.

| ID | Status | Requirement and acceptance evidence | Owner |
|---|---|---|---|
| SAFE-01 | BLOCKED | Enforce 18+ eligibility for every account, including legacy users; fail closed on missing/invalid DOB and test leap years, time zones, edits, and migration. | Product/backend |
| SAFE-02 | BLOCKED | Require versioned Terms and Community Guidelines acceptance before profile/photo/message/UGC publication; retain acceptance evidence and re-consent on material updates. | Legal/product |
| SAFE-03 | BLOCKED | Publish prohibited-content rules covering harassment, threats, hate, sexual content, minors/CSAM, NCII, impersonation, scams, ticket fraud, drugs/weapons, self-harm, spam, and IP violations. | Trust & safety/legal |
| SAFE-04 | BLOCKED | Provide report actions for message, profile, photo, event/host content, and account; allow category, context, evidence, and emergency escalation. | Mobile/trust & safety |
| SAFE-05 | BLOCKED | Prove block prevents messages, requests, socket subscriptions, notification leakage, profile discovery where intended, and re-contact through alternate conversation states. | Backend/QA |
| SAFE-06 | BLOCKED | Operate a moderation console/queue with trained rota, severity matrix, SLA, audit log, evidence preservation, user notice, appeal/reinstatement, repeat-offender controls, and reviewer-safe fixtures. | Trust & safety |
| SAFE-07 | BLOCKED | Create child-safety/CSAM and NCII emergency processes, trained contacts, lawful reporting/escalation, evidence access controls, and staff wellness/security procedures. | Trust & safety/legal |
| SAFE-08 | BLOCKED | Avoid anonymous/random stranger chat and objectifying ranking behavior; document who can contact whom and why. | Product/legal |
| SAFE-09 | BLOCKED | Verify two-device report/block/unblock, pending/accepted chat, notification suppression, socket revocation, deleted/disabled account, and moderation action propagation. | QA |
| SAFE-10 | BLOCKED | Document Nightlife discovery/match logic, discrimination/fairness review, location exposure, exact-distance leakage, safety copy, and user controls. | Product/privacy |
| SAFE-11 | BLOCKED | Obtain organizer/venue warranties for age, alcohol, entry, dress, identity, safety, refund, and accessibility rules; show material restrictions before checkout. | Partnerships/legal |

## 24. India privacy law: current and transition readiness

Current status: **BLOCKED — counsel sign-off required**.

Important timing correction to the supplied AI plan: India’s DPDP obligations are phased. As of 17 July 2026, counsel should verify the official commencement schedule. The current official schedule indicates the data-contact publication duty begins 13 November 2026 and core private-sector notice, consent, security, breach, rights, erasure, child-data, and Significant Data Fiduciary provisions begin 13 May 2027. Applicable IT Act/SPDI duties continue during the transition. The launch design should meet the future standard now rather than wait for the deadline.

| ID | Status | Requirement and acceptance evidence | Owner |
|---|---|---|---|
| IND-PRIV-01 | BLOCKED | Obtain written counsel applicability/timing advice for DPDP Act 2023, final DPDP Rules 2025, commencement notifications, and current SPDI/IT Act obligations. | India counsel |
| IND-PRIV-02 | BLOCKED | Publish the currently required privacy policy, consent/purpose, reasonable security, disclosure/transfer, retention, and grievance information under the applicable SPDI framework. | Legal/privacy |
| IND-PRIV-03 | BLOCKED | Build a standalone clear DPDP-ready notice with itemized data and purposes, language accessibility, business contact, easy withdrawal, and rights/grievance links. | Privacy/product |
| IND-PRIV-04 | BLOCKED | Implement access, correction, erasure, nomination where applicable, grievance, and processor-supported request workflows before their effective dates. | Backend/privacy |
| IND-PRIV-05 | BLOCKED | Implement reasonable safeguards, processor controls, breach detection/assessment, user/regulator notification workflow, and evidence retention before the effective date. | Security/privacy |
| IND-PRIV-06 | BLOCKED | Enforce adults-only launch posture or complete specialist child-data/parental-consent design; DPDP treats under-18s as children for the future child-data rules. | Product/legal |
| IND-PRIV-07 | BLOCKED | Document cross-border processors/regions and monitor government transfer restrictions; ensure contracts and deletion/incident support. | Legal/cloud |
| IND-PRIV-08 | BLOCKED | Name an accountable privacy owner and prepare to publish the required business contact by 13 November 2026, subject to counsel confirmation. | Executive/legal |

Official baselines: [DPDP Act](https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf), [final DPDP Rules page](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa), and [India Code commencement schedule](https://www.indiacode.nic.in/show-data?abv=CEN&actid=AC_CEN_45_0_00003_2023-22_1763464807080&orderno=1&orgactid=AC_CEN_45_0_00003_2023-22_1763464807080&sectionId=101267&sectionno=1&statehandle=123456789%2F1362).

## 25. India intermediary, CERT-In, and cyber-response audit

Current status: **BLOCKED — counsel and security sign-off required**. Treat THE C1RCLE as an intermediary/social-media intermediary for planning unless counsel documents a narrower classification.

| ID | Status | Requirement and acceptance evidence | Owner |
|---|---|---|---|
| IND-IT-01 | BLOCKED | Publish India-facing Terms, Privacy, Community Guidelines, prohibited-content rules, grievance mechanism, officer name/designation/contact, and Grievance Appellate Committee route. | Legal/trust & safety |
| IND-IT-02 | BLOCKED | Implement complaint acknowledgement/resolution clocks, expedited sexual/impersonation complaints, qualifying prohibited-content handling, and appeal workflow to the then-current IT Rules deadlines. | Trust & safety/legal |
| IND-IT-03 | BLOCKED | Operate a validated court/government-order queue meeting the then-current deadline; official March 2026 guidance cites three hours for qualifying orders. Preserve order, reason, decision, and evidence. | Legal/operations |
| IND-IT-04 | BLOCKED | Preserve removed content/associated records and account-registration information for the required period; current planning baseline is 180 days, subject to counsel confirmation and privacy minimization. | Legal/backend |
| IND-IT-05 | BLOCKED | Support lawful information/assistance requests, emergency disclosure review, chain of custody, access logging, and staff authorization. | Legal/security |
| IND-IT-06 | BLOCKED | Notify users of Terms/Privacy/User Agreement at required intervals and on material change; retain delivery/acceptance evidence. | Legal/product |
| IND-IT-07 | BLOCKED | Track whether India registered users reach the 50-lakh Significant Social Media Intermediary threshold; pre-plan resident compliance/nodal/grievance personnel, reporting, address, and added technical duties. | Executive/legal |
| IND-IT-08 | BLOCKED | Review February 2026 synthetic-media amendments: label platform-generated realistic synthetic media; if SSMI/media uploads become applicable, add user declaration, verification, and labeling controls. | Legal/product |
| CERT-01 | BLOCKED | Establish a 24/7 CERT-In incident-response contact tree and playbook; report listed incidents within six hours of noticing/being informed. | Security/operations |
| CERT-02 | BLOCKED | Synchronize relevant systems to approved time sources and retain required ICT logs securely within India for 180 days. | Cloud/security |
| CERT-03 | BLOCKED | Rehearse detection, containment, evidence preservation, regulator/user/provider notification, credential rotation, recovery, and post-incident review. | Security |
| CERT-04 | BLOCKED | Complete independent mobile/API/cloud penetration testing and close critical/high findings; include auth, checkout, share/claim/transfer, chat, admin, storage, abuse, and cost-exhaustion paths. | Security |

Official baselines: [current IT Rules page](https://www.meity.gov.in/documents/act-and-policies/information-technology-intermediary-guidelines-and-digital-media-ethics-code-rules-2021-it-rules-2021-IjM5QjMtQWa) and [CERT-In directions](https://www.cert-in.org.in/Directions70B.jsp).

## 26. India consumer, e-commerce, tax, payments, messaging, and venue law

Current status: **BLOCKED — India counsel, CA, CS, and payments owner sign-off required**.

| ID | Status | Requirement and acceptance evidence | Owner |
|---|---|---|---|
| IND-CONS-01 | BLOCKED | Decide and contract whether THE C1RCLE is seller/merchant of record, organizer agent, or marketplace; align customer contract, invoice, settlement, refund, chargeback, and liability. | Counsel/finance |
| IND-CONS-02 | BLOCKED | Publish entity legal name, address, customer care, grievance officer, organizer/seller identity, and ticketed complaint tracking; acknowledge/redress within applicable e-commerce deadlines. | Legal/support |
| IND-CONS-03 | BLOCKED | Before payment show event, date/time/venue, age/entry restrictions, tier, inventory condition, transfer/claim rules, organizer, all charges/taxes, refund/cancel/postpone/no-show terms, and payment contact. | Product/legal |
| IND-CONS-04 | BLOCKED | Obtain explicit affirmative consent; remove pre-ticked add-ons and audit false urgency/scarcity, basket sneaking, confirm shaming, forced action, interface interference, bait-and-switch, drip pricing, disguised ads, nagging, and trick wording. | Product/legal |
| IND-CONS-05 | BLOCKED | Define cancellation/postponement/venue denial/organizer insolvency, convenience-fee, partial refund, chargeback, and force-majeure treatment; keep sufficient reserve/settlement hold. | Legal/finance |
| IND-CONS-06 | BLOCKED | Perform and retain organizer/venue due diligence, authority, licenses, bank/tax identity, refund capacity, content/IP rights, safety record, and contract warranties/indemnities. | Partnerships/legal |
| GST-01 | BLOCKED | Obtain CA classification for event admission, platform/convenience fees, organizer commission, GST rates by event type, place of supply, interstate treatment, credit notes, and refunds; do not hardcode one rate universally. | CA/finance |
| GST-02 | BLOCKED | Determine who invoices the customer and whether THE C1RCLE is an electronic commerce operator subject to registration/TCS under CGST section 52; issue compliant invoices/receipts and preserve records. | CA/legal |
| RBI-01 | BLOCKED | Verify Razorpay is RBI-authorized for the arrangement and THE C1RCLE is not operating as an unlicensed payment aggregator/sub-aggregator; retain merchant agreement and compliance evidence. | Payments/legal |
| RBI-02 | BLOCKED | Do not store full card number/CVV/raw credentials; document tokenization/provider scope, PCI responsibility, reconciliation data, disputes, and refund timelines. | Security/payments |
| TRAI-01 | BLOCKED | Register the legal entity as a DLT Principal Entity and approve sender headers/content templates for OTP, transactional/service, and promotional traffic. | Messaging/legal |
| TRAI-02 | BLOCKED | Separate auth/service from marketing; record promotional consent, preferences, revocation, DND handling, template IDs, sender identity, delivery, and abuse/spend limits. | Marketing/operations |
| LOCAL-01 | BLOCKED | Allocate state/city/venue responsibility for event, police, fire, occupancy, entertainment, liquor, dry-day, alcohol-age, public-performance/music, accessibility, and local tax/licence requirements. | India counsel/partnerships |
| IP-01 | BLOCKED | Retain licenses/releases for posters, artist/venue names, photos, video, music, trademarks, user media, and promotional copy; provide complaint/takedown process. | Legal/content |

Official baselines: [Consumer Protection E-Commerce Rules](https://consumeraffairs.nic.in/sites/default/files/E%20commerce%20rules_0.pdf), [CCPA dark-pattern guidance](https://www.pib.gov.in/Pressreleaseshare.aspx?PRID=2146813&lang=2&reg=48), [RBI payment-aggregator framework](https://www.rbi.org.in/Scripts/PublicationReportDetails.aspx?ID=943&UrlPage=), [CGST section 52](https://cbic-gst.gov.in/hindi/CGST-bill-e.html), and [TRAI commercial communications](https://www.trai.gov.in/tcccpr).

## 27. Security, operations, cost, support, and business continuity

Current status: **BLOCKED**.

| ID | Status | Requirement and acceptance evidence | Owner |
|---|---|---|---|
| OPS-01 | BLOCKED | Restore production DNS/TLS/API health and validate from multiple Indian networks and both store builds; include WAF/rate limits, dependency health, capacity, and failover. | Cloud/operations |
| OPS-02 | BLOCKED | Replace placeholder Sentry and Google Sign-In values; prove production crash/error tracing, PII scrubbing, source-map/symbol upload, alert routing, and retention. | Observability/security |
| OPS-03 | BLOCKED | Remove client Spotify secret/client-credentials flow, rotate exposed credentials, and complete repository/history/build/log secret scanning. | Security/mobile |
| OPS-04 | BLOCKED | Produce SBOM, license/provenance review, SCA, malware/artifact scan, SDK policy review, and patch owner for mobile/backend/container dependencies. | Security/release |
| OPS-05 | BLOCKED | Threat-model auth/OTP, account linking, checkout/webhooks, wallet/QR, share/claim/transfer, chat/UGC, admin/support, storage, deep links, notifications, and cost abuse. | Security/engineering |
| OPS-06 | BLOCKED | Define SLOs and p50/p95/p99 plus read/write/byte ceilings for cold boot, Explore, recommendations, event detail, checkout, wallet, matches, inbox/history, send, and sockets. | Backend/performance |
| OPS-07 | BLOCKED | Configure billing actual/forecast alerts, Pub/Sub response, SMS limits, log-volume alerts, Firestore/Redis metrics, payment anomalies, and named 24/7 responders; rehearse alerts. | FinOps/operations |
| OPS-08 | BLOCKED | Load test production-like data and concurrent checkout/chat/share claims; prove rate limits, locks, cache failure behavior, backpressure, graceful degradation, and cost ceilings. | Performance/backend |
| OPS-09 | BLOCKED | Document backup scope, encryption, access, retention, restore RPO/RTO, regional dependencies, and quarterly restore evidence; never assume a backup is restorable. | Cloud/security |
| OPS-10 | BLOCKED | Rehearse rollback for mobile config/OTA/backend/schema/index/rules/payment/webhook incidents; define kill switches for checkout, transfers/shares, chat, subscriptions, and risky providers. | Release/operations |
| OPS-11 | BLOCKED | Staff launch on-call, trust & safety, payments/refunds, customer support, legal escalation, store review, and executive incident roles with contact tree and handoff. | Operations |
| OPS-12 | BLOCKED | Define launch dashboards and stop/rollback thresholds for auth success, OTP spend, checkout conversion/failure, issuance mismatch, crash/ANR, latency, 5xx, Redis, Firestore cost, chat delivery, reports, and refunds. | Operations/product |
| OPS-13 | BLOCKED | Make CI fail closed for tests, typechecks, lint/security/config checks and artifact validation; block submission after any failure; isolate consumer build/sign/submit jobs and credentials from the DEFERRED scanner pipeline. | Release/security |
| OPS-14 | BLOCKED | Establish signed OTA governance: environment/channel separation, native-runtime compatibility, two-person approval, canary metrics, stop thresholds, kill switch, audit log, and rehearsed rollback. | Release/operations |
| OPS-15 | BLOCKED | Enforce production App Check/device attestation with Play Integrity and App Attest, staged monitoring and fail-safe user handling; prohibit debug-token providers in release. | Cloud/mobile/security |

## 28. Final submission, controlled launch, and evidence pack

Current status: **BLOCKED**.

| ID | Status | Requirement and acceptance evidence | Owner |
|---|---|---|---|
| REL-01 | BLOCKED | Freeze a clean RC commit and dependency lock; archive source, resolved config, SBOM, AAB/archive, symbols, checksums, signing identities, backend version, schema/rules/index versions, and environment manifest. | Release manager |
| REL-02 | BLOCKED | Run Sections 13, 17, and 19 on store-delivered artifacts with two physical users/devices and attach screen recordings, screenshots, API/log IDs, payment/order/ticket IDs, and cost snapshot. | QA lead |
| REL-03 | BLOCKED | Attach Play Console and App Store Connect exports/screenshots for every declaration, agreement, listing, review account, test track, product, policy, and release setting. | Release manager |
| REL-04 | BLOCKED | Attach signed approvals from product, Android, iOS, backend, QA, security, privacy, trust & safety, operations, finance, India counsel, CA, CS, and executive sponsor. | Program owner |
| REL-05 | BLOCKED | Close every P0; every accepted P1 must have signed exception, owner, mitigation, alert, rollback trigger, and deadline. | Executive sponsor |
| REL-06 | BLOCKED | Complete Play internal/closed testing and pre-launch report, plus TestFlight internal/external testing; resolve feedback and rerun changed areas. | QA/release |
| REL-07 | BLOCKED | Prepare reviewer notes, stable test account, isolated OTP method, seeded non-sensitive events/tickets/chat, payment instructions, deletion path, support contact, and 24/7 backend availability. | QA/support |
| REL-08 | BLOCKED | Define first-release launch controls: limited geography/marketing, managed publishing/manual release where available, live dashboards/on-call, kill switches, and stop criteria. Use percentage staged rollout for later Google Play updates when available; use Apple phased release where appropriate. | Release/operations |
| REL-09 | BLOCKED | Run a launch-day rehearsal and 24h/72h/7d review calendar covering metrics, store feedback, policy notices, abuse, refunds, costs, incidents, and rollback decision. | Operations/product |
| REL-10 | BLOCKED | Executive signs GO only after every applicable mandatory gate is PASS or has an approved exception. Store approval and legal immunity remain outside anyone's guarantee. | Executive sponsor |
| REL-11 | BLOCKED | Rehearse production schema, Firestore rules/indexes, backfills and data migration against production-sized staging data; prove counts/checksums, idempotent retry, mixed-version compatibility, backup/restore and rollback before RC promotion. | Backend/release/data |

## 29. Reconciliation of the supplied AI launch order

The attached 16 July launch order was reviewed as an input, not accepted as evidence. Its useful engineering tasks are retained in Sections 1–15. Its unsupported readiness conclusions are superseded by this file.

| Supplied claim | Disposition | Evidence-based correction |
|---|---|---|
| “Legal, Privacy & Store Compliance: LAUNCH-READY” | REJECTED | No counsel/CA/CS sign-off, public policy/deletion endpoints returned 404, privacy declarations are incomplete, and no store-console evidence exists. |
| Privacy Policy/Terms in components prove users are legally bound | REJECTED | Code presence does not prove correct publication, versioned acceptance, applicability, enforceability, localization, or current legal compliance. |
| Grievance email fully satisfies Indian IT Rules | REJECTED | Officer identity/designation, published process, deadlines, escalation/GAC path, operational queue, preservation, and counsel classification remain open. The cited `support@circle.com` branding also requires verification. |
| Native account deletion is fully compliant | REJECTED | Initiation exists, but complete cascade, lawful retention, processor propagation, auth revocation, backups, completion notice, and repeated E2E proof are absent. |
| Privacy manifest is correct | REJECTED | Generated `PrivacyInfo.xcprivacy` reports no collected data and source config covers only a subset of observed identity/location/social/message/payment/diagnostic data. |
| Native permissions are correctly justified | REJECTED | Microphone, Always/background location, scanner camera copy, overlay/dev permissions, tracking copy, backup, and tablet support are unresolved. |
| Expo SDK automatically proves target API compliance | REJECTED | Debug merged target evidence is useful, but only the signed AAB/Play artifact and current policy deadline prove submission compliance. |
| Data Safety will be straightforward | REJECTED | It requires a full app, SDK, processor, and network data inventory plus exact agreement with runtime behavior and policy. |
| Database & infrastructure are launch-ready | REJECTED | Production API DNS failed, cost/SLO/load/DR/incident evidence is missing, and a broad source/rules description is not production proof. |
| RevenueCat is cleanly separated for future subscriptions | REJECTED | Purchase UI calls exist, but configuration, products, restore/sync, server notifications, entitlement truth, and lifecycle QA are incomplete. |
| Only nine final gates are required | REJECTED | Those nine remain valid tasks but omit Android/iOS release engineering, store-console declarations, privacy/deletion, UGC/age, India law/tax, security, operations, and approval evidence. |
| Completing the list guarantees immediate submission readiness | REJECTED | Completing all applicable gates in this canonical audit makes the RC eligible for submission and controlled launch; Apple/Google approval, zero defects, and legal immunity cannot be guaranteed. |

### Authoritative source register reviewed on 17 July 2026

- Google/Android: target API, 16 KB pages, developer verification/testing, Data safety, account deletion, UGC/child safety, payments, permissions, pre-launch report, and Android Vitals sources linked in Sections 17–18.
- Apple: current App Review Guidelines, Xcode/iOS SDK upload requirement, privacy manifests/App Privacy, account deletion, login, payments, age rating, export compliance, and App Store Connect sources linked in Sections 19–20.
- India: MeitY DPDP Act/Rules/commencement and IT Rules, CERT-In directions, Consumer Affairs/CCPA, RBI, CBIC, and TRAI sources linked in Sections 24–26.
- Re-check all living policies immediately before store submission and again before enabling production payments.

## Change log

- 2026-07-16 — Initial connected-device audit, fixture repair, Razorpay QA, wallet/transfer/share/chat remediation, and multi-user staging evidence.
- 2026-07-17 — Added wallet cost profiling, WebSocket authorization, typing security, inbox polling removal, and direct-ticket ownership hardening.
- 2026-07-17 — Consolidated contradictory historical sections into this authoritative launch dashboard; scanner product explicitly deferred and temporary scanner edits removed.
- 2026-07-17 — Reconciled the supplied AI launch order against live `.nosync` source, current official Android/Google/Apple/India requirements, and existing QA evidence; rejected unsupported launch-ready claims and added Sections 16–29 as evidence-based release gates.
- 2026-07-17 — Resumed physical Android preflight and returning-user QA; recorded search, DM history, venue spotlight, fixture/paise, guest-wallet, build-identity, and cold-launch findings without changing scanner functionality or production code.
- 2026-07-17 — Started Phase 1 clean-new-user Android QA; verified OTP, email-skip persistence, age-picker maximum, and session restoration; recorded the P0 identity date-contract blocker, unstable +15-second boot sequence, duplicate auth-sync/cost risk, predicted downstream Nightlife contract/media defects, and iOS tool/device prerequisites without touching scanner functionality.
- 2026-07-17 — Fixed and physically verified the identity date-only contract; completed consumer onboarding through Explore; reproduced and fixed the empty-body completion 500; verified exact Firestore persistence and completed-account process-death return; added R42–R45 plus measured onboarding/Explore latency evidence without touching scanner functionality.
- 2026-07-17 — Physically completed both conflicting Nightlife creation paths through their terminal HTTP 400 responses; replaced predicted R39–R41 language with exact request, routing, schema, and local-photo evidence; scanner functionality remained untouched.
- 2026-07-17 — Implemented the canonical Nightlife source remediation, authenticated portable media contract, activation rules, taxonomy isolation, legacy discovery bridge, and accurate age output; physically proved incomplete validation, recorded the Vitals sheet invariant, passed 7 focused tests and all three TypeScript checks, and left valid publish/media/sheet/two-device acceptance explicitly open without touching scanner functionality.
- 2026-07-17 — Restored the multi-step Nightlife wizard as the canonical first-time flow, retained the single-page screen only for active-profile editing, fixed the decorated Storage runtime reference and stale core activation contract, physically passed Android upload/activation/editor reopen, verified exact Firestore and public-image evidence, separated Nightlife photos from basic-profile photos, and left scanner functionality untouched.
- 2026-07-17 — Fixed partial-auth versus full-private-profile hydration, clean-rebuilt the Android bundle, physically proved returning-editor field/photo reload and Save, reverified Nightlife media remained isolated from basic-profile `photoURL`/`photos`, passed the final mobile TypeScript check, and left scanner functionality untouched.
- 2026-07-17 — Physically passed Android permission-state refresh and reversible basic-profile edit persistence; fixed the Explore canonical-city hydration race, added focused tests, and proved a clean cold start displays Pune while issuing the city-filtered first event request. Scanner functionality remained untouched.
- 2026-07-18 — Reconciled the dependency dashboard, gates, functional matrix, risk register, API-cost review, and Evidence 28–79. Physically closed Android staging search/host/NOWL, DM history/send/reopen, exact-paise, signed-out/dedicated-wallet, Nightlife edit/offline-retry/pause-re-enable, and auth-sync request-count paths; retained signed-RC, iOS and two-device gaps; opened the cross-account Nightlife cache-isolation blocker plus fail-closed CI, OTA, App Check, deep-link, scanner-pipeline-isolation, migration and cover-charge/bootstrap cost gates. Scanner functionality remained untouched.
- 2026-07-18 — Added Evidence 80–88: clean Phase runtime/auth single-flight, physical A→B→A Nightlife isolation remediation, truthful development build identity, host/venue route semantics and recommendation single-flight. Recorded typed onboarding/CTA source coverage and corrected fixture reseed, retained physical/RC review gaps, and opened Phase 2 inventory-counter drift, stale pending-order reconciliation, duplicate detail-read retest and recommendation-latency blockers. NO-GO remains; scanner stayed untouched/deferred.
- 2026-07-18 — Added Evidence 90–94 and consolidated 19-suite/112-test, mobile/gateway TypeScript and native/deep-link 41/41 validation; physically closed Android-staging Nightlife active-editor route intent and rapid host/venue/follow single-flight/back behavior. Corrected R55 to P0 possible oversell and added R59–R64 for cancellation/refund/finalizer/RSVP/test-key failures with mandatory Phase 2 implementation order. NO-GO remains; trace was read-only and scanner remained untouched/deferred.
- 2026-07-18 — Added read-only Evidence 95 and embedded report checksum; recorded 70-event/105-finite-tier staging inventory findings with the explicit qualification that lifecycle/visibility/saleability was not selected. Recorded implemented-but-off/unwired Inventory V2, R60A refund-request and unified-finalizer foundations plus 3/44, 4/76, 2/47 and clean core/gateway TypeScript validation. R55/R60/R61/R62 remain P0; no data changed; NO-GO and scanner deferral remain.
- 2026-07-19 — Completed lifecycle-aware Evidence 96 after correcting public-inventory lifecycle/cutoff drift: 20 saleable tiers, 18 balanced, exactly 2 failing with six unaccounted units; 79 non-saleable and 6 source-ambiguous. Added non-canonical/elapsed public-tier fail-closed behavior, passed 44 focused tests and core TypeScript, recorded checksum, and made no data changes. R55 remains P0 until cross-ledger reconciliation, reviewed repair, backup/restore, backfill and V2 wiring pass.
- 2026-07-19 — Added sanitized read-only Evidence 97 for the two failing active tiers. Confirmed completed order/payment/ticket/entitlement parity, reconfirmed the stale payment-pending converted reservation, and blocked automatic repair because the seeded historical sold totals have no immutable baseline/provider/finance ledger. No data changed.
- 2026-07-19 — Found and fixed device-timezone leakage in event date/time formatting using venue timezone with an India fallback. Passed 30 focused mobile tests and TypeScript; physical Evidence 25–26 changes event05 from Arizona-local 1:00 pm to India-local 1:30 am. Added R66 because the stored instant is Monday in India while poster/earlier copy implies Sunday night; canonical fixture intent remains open.
- 2026-07-18 — Added the master launch execution board as the canonical end-to-end checklist across release control, Android, payment/tickets, two devices, performance/cost, signed Android/iOS, production infrastructure, RC QA, privacy/security/India compliance, stores and controlled rollout. Completed work is struck through, open work has explicit evidence and exit gates, production payments remain disabled until Phase 2 closes, and scanner remains deferred/untouched.
- 2026-07-18 — Recorded the tested R60B refund approval/rejection foundation (gateway 33/33; core refund contract 26/26) and leased payment-finalization outbox-worker primitive (combined 3 suites/60 tests plus core TypeScript). Provider execution, webhook/reconciler, runtime routes, scheduler/live consumer and terminal effects remain unwired P0 work. Partial lifecycle-audit/refund-provider source changes are explicitly unaccepted; no data changed.
- 2026-07-18 — Re-ran production infrastructure and release prerequisites: production API DNS is unresolved, all required policy/association URLs return 404, full Xcode is unavailable, and the production profile retains test/placeholder configuration. Prepared Privacy/Terms/Refund/Account Deletion web source, normalized support links, and passed guest-portal TypeScript plus a Webpack production build that generated all four static routes; publication, legal review, production credentials and signed artifacts remain blocked.
- 2026-07-18 — Added the resumed connected-Android request/latency profile with explicit sample limitations. Auth sync, subscription, events, recommendations and token registration remain slow; Firestore/Redis/Storage/SMS/log operation counters, production p50/p95/p99, per-user cost and tested billing alerts remain blocked.
- 2026-07-18 — Added the 182-artifact resumed Android Phase 1 evidence matrix: physically passed Location/Notification recovery, reversible profile edit/restore, logout, supplied-account login, returning-user routing, force-stop restoration and one measured auth-sync. Recorded DEBUGGABLE/Dev Launcher RC blocker, internal settings deep-link failure and unproven Nightlife state-changing offline/draft flows. Scanner/payment remained untouched.
- 2026-07-18 — Added missing guest-portal Sentry request/client/App Router error-capture scaffolding and eliminated its build warnings. Production DSN, symbolication, PII/retention and alert routing remain open; no production observability PASS is claimed.
