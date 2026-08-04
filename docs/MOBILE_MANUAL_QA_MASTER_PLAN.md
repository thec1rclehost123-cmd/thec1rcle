# THE C1RCLE Mobile App — Production Manual QA Master Plan

Status: planning artifact only. This exercise is audit-only: testers observe, measure, reproduce, and report. They do not change application code, backend code, configuration, production data, or infrastructure during the run.

Authoritative mobile tree reviewed: `apps/mobile-app`

Primary execution target: physical Android device connected by USB and running a native development/preview build. Expo Go is not an acceptable runtime for native Razorpay, Firebase native auth, camera/scanner, notifications, or wallet proof.

## 1. To do

1. [ ] Freeze and identify the exact app build, Git commit, environment, API host, Firebase project, feature flags, and device serial.
2. [ ] Provision two labeled consumer QA accounts, one role-gated scanner/operator fixture, controlled events, tickets, chats, notifications, and payment fixtures.
3. [ ] Pass the technical preflight without changing source code.
4. [ ] Execute every route and end-to-end journey in this plan on the physical Android device.
5. [ ] Execute two-account scenarios with the physical device and a second isolated device/emulator.
6. [ ] Measure startup, navigation, loading, scrolling, chat, checkout, wallet, scanner, memory, network recovery, and battery behavior.
7. [ ] Inspect every visible control, hidden action, modal, sheet, permission prompt, system handoff, loading state, empty state, error state, and recovery state.
8. [ ] Record screenshots, screen recordings, timestamps, ADB logs, API correlation IDs, device metrics, account state, and exact reproduction steps.
9. [ ] Produce the final audit report, issue ledger, coverage matrix, performance scorecard, UI/UX scorecard, untested-risk register, and launch recommendation.

## 2. In progress

1. [x] ~~Code-grounded route, workflow, and integration inventory.~~
2. [x] ~~Multi-agent operating model and evidence contract.~~
3. [x] ~~Screen-by-screen and journey-by-journey manual test design.~~

Planning is complete. Physical-device execution is waiting for the connected Android phone and approved QA environment.

## 3. Done

1. [x] ~~Authoritative mobile checkout identified as `apps/mobile-app`.~~
2. [x] ~~Current Expo route tree, shared app shell, stores, hooks, services, native integrations, and existing launch evidence located.~~
3. [x] ~~Audit-only boundary confirmed: findings will be reported, not fixed during QA.~~
4. [x] ~~All 78 non-layout Expo route files mapped to a manual QA case and required disposition.~~
5. [x] ~~Two-device/multi-agent operating model, safety boundaries, evidence contract, performance budgets, and mutation ledger defined.~~
6. [x] ~~End-to-end journeys, screen-level test matrices, execution phases, report format, and final done state written.~~

---

## 4. Mission, end goal, and non-goals

### 4.1 Mission

Exercise the app as real users, counterpart users, and authorized event staff would exercise it in production. The run must prove not only that a button can be tapped, but that the intended server-side state change happened exactly once, appeared on the other account/device, survived refresh and relaunch, produced the right notification/deep link, respected permissions and authorization, and remained understandable under latency and failure.

### 4.2 End goal

The final output must answer, with evidence:

- What works end to end on the tested production-like build.
- What is broken, partially wired, mocked, misleading, inaccessible, inconsistent, slow, unstable, or unsafe.
- Which failures are deterministic versus intermittent.
- Which screens and workflows are production-ready, need optimization, or should be blocked from release.
- Which UI is strong, which UI is weak, and why.
- Which operations are slow, where the time is spent, and whether the delay is UI, JavaScript, native, network, backend, or external-provider latency.
- Which deep links, push notifications, background recoveries, and cross-account effects are proven.
- Which areas could not be tested and therefore remain explicit launch risks.
- Whether the tested build receives a `GO`, `CONDITIONAL GO`, or `NO-GO` recommendation.

### 4.3 Non-goals

- No bug fixes, refactors, dependency upgrades, config edits, data migrations, secret changes, or deployment changes during the QA run.
- No real customer accounts, real customer tickets, real money, or irreversible production actions.
- No claim that iOS is production-ready from an Android-only exercise.
- No claim that a workflow works merely because the UI renders or the code appears connected.
- No destructive account deletion, refund, transfer, cover-charge debit, or scanner action outside labeled QA fixtures.
- No duplicate agent exploration that spends credits without increasing coverage.

---

## 5. Code-grounded scope

The plan covers all current route files under `apps/mobile-app/app`, plus behavior owned by:

- `app/_layout.tsx`: splash, auth listener, Android navigation bar, deep links, notification routing, pending-payment recovery, offline banner, error boundary, paywall.
- `app/index.tsx`: guest/auth routing, server-sync wait, contact linking, profile setup, onboarding, and permission progression.
- `app/(tabs)/_layout.tsx`: five visible tabs, hidden routes, tab selection, haptics, animated tab-bar behavior, Android safe area.
- `components`: chat surface, scanner overlays/presets, settings primitives, subscription paywall, ticket action sheets, global headers, cards, loaders, skeletons, sheets, prompts, and reusable controls.
- `hooks`: auth, users, tickets, venues, matching, swipes, profiles, chat rate limits, image selection, group transfer, settings, and WebSocket behavior.
- `store`: auth, profile, settings, events, venues, cart, tickets, notifications, chat, dating, follows, social profile, subscriptions, recommendations, interests, and scanner state.
- `lib`: API/auth tokens, Firebase, payments, inventory, wallet, transfers, notifications, deep links, caching/offline behavior, permissions, onboarding flags, analytics, Sentry, safety, social/chat/media/moderation/typing, scanner APIs, Spotify, calendar, and utilities.
- `app.json`, `eas.json`, and `package.json`: native identifiers, permissions, schemes, associated domains, update behavior, native plugins, build profiles, and production public environment.

### 5.1 Route classification rules

Every route receives a disposition in the report:

- `PRIMARY`: directly reachable through the normal user journey.
- `SECONDARY`: reachable through buttons, cards, menus, or settings.
- `DEEP LINK`: expected to open from a URL or notification.
- `ROLE GATED`: scanner/operator or privileged route.
- `ALIAS`: a compatibility re-export or redirect; verify both the alias and canonical destination.
- `HIDDEN TAB`: present in the router but absent from the visible tab bar.
- `ORPHAN CANDIDATE`: code exists but no valid navigation entry was found; test direct navigation and report reachability.
- `LEGACY`: compatibility behavior must route safely without exposing stale UI.

### 5.2 Known code facts that shape QA

These are not pre-judged runtime findings; they are test obligations discovered from current code:

- The visible tab bar is Explore, Chat, Nightlife, Tickets, and Venues. Profile and Feed are hidden routes.
- `/(tabs)/social` aliases the dating screen; `/(tabs)/feed` aliases the immersive event feed.
- `/explore/map` aliases `/map`.
- `/claim/[token]` and `/tickets/claim/[token]` ultimately alias `/transfer/[token]`.
- `/chat/[id]` is a legacy redirect to `/social/group/[eventId]`.
- Public showcase data is enabled in development unless explicitly disabled; full demo mode can inject personal tickets, notifications, profiles, matches, and chats.
- Root startup waits for Firebase plus server auth synchronization and then evaluates local/scoped onboarding flags.
- Root startup can offer to resume an incomplete payment after persisted cart hydration.
- Notifications route to events, DMs, matches, ticket events, or a fallback notification route; every payload shape must be proven.
- Checkout uses server reservation, initiation, Razorpay, verification, ticket refresh, idempotency keys, and pending-payment recovery.
- Production EAS configuration currently warrants explicit verification of payment mode, Sentry, Google OAuth, Firebase, API base URL, and demo-mode flags.
- Several screens have very large UI implementations; performance and state-transition testing must be measured rather than judged from screenshots alone.
- Accessibility metadata exists on selected controls but is not consistently present across the full route tree; TalkBack traversal is a full-app requirement.

---

## 6. Multi-agent operating model

Only one agent may control a given device serial. All ADB commands must include the target serial when more than one device/emulator is connected.

### 6.1 Agent roles

#### Agent A — QA lead and physical-device driver

- Owns the master checklist, phase order, build identity, physical Android serial, and final severity decisions.
- Performs taps, swipes, text entry, Android back, app lifecycle actions, permission decisions, and system handoffs on User A's physical phone.
- Announces each test-case ID before execution and records start/end timestamps.
- Prevents unsafe production operations and pauses at payment, deletion, SOS, and external-app boundaries.
- Maintains the single issue ledger and resolves duplicate reports.

#### Agent B — counterparty-device driver

- Owns User B on the second Android device/emulator.
- Executes synchronized receive/accept/reject/revoke/claim/transfer/chat/read/block/report scenarios.
- Confirms whether state changes appear without refresh, after refresh, and after app relaunch.
- Never controls Agent A's device serial.

#### Agent C — telemetry and performance observer

- Runs scoped `adb logcat`, `am start -W`, `dumpsys gfxinfo`, `dumpsys meminfo`, process checks, and screen recordings.
- Captures JS/native exceptions, ANRs, network errors, frame data, memory changes, and startup/route timings.
- Marks measurement windows and removes unrelated device noise from the report.
- Does not touch application UI while a timed interaction is running.

#### Agent D — code oracle, evidence reviewer, and report controller

- Maps current UI behavior to route, store, hook, API, and expected state transitions.
- Reviews screenshots/recordings for UI consistency, accessibility, copy, layout, and hidden-state issues.
- Checks whether observed behavior is real data, public showcase data, full demo data, or a fallback.
- Drafts issue entries and maintains the route/workflow coverage matrix.
- Does not infer runtime success from source code.

### 6.2 Synchronization protocol

1. Agent A publishes `CASE-ID / build / device / account / starting state`.
2. Agents B–D acknowledge readiness.
3. Telemetry starts and confirms the capture window.
4. Device drivers perform only the specified actions.
5. At cross-account barriers, Agent A stops after sending; Agent B records receive latency and responds.
6. Both devices capture final UI and refresh/relaunch persistence.
7. Telemetry stops and attaches logs/metrics.
8. Agent D drafts the result; Agent A assigns final status and severity.
9. Any retry is a new attempt number, never an overwritten result.

### 6.3 Shared artifacts

Suggested run directory:

`qa-artifacts/mobile-manual-qa/<build-id>/<run-date>/`

Subdirectories:

- `00-preflight/`
- `01-auth-onboarding/`
- `02-explore-events-venues/`
- `03-checkout-payments/`
- `04-tickets-sharing-transfer/`
- `05-social-dating-chat/`
- `06-notifications-deeplinks/`
- `07-profile-settings-legal/`
- `08-safety-scanner/`
- `09-performance-resilience/`
- `10-final-report/`

Artifact filename contract:

`<CASE-ID>_<device>_<account>_<attempt>_<timestamp>.<ext>`

### 6.4 Credit-efficiency rules

- One agent drives each device; observers analyze instead of repeating the same flow.
- Capture one continuous recording per coherent journey, with screenshots only at decision and failure points.
- Reuse the same build, fixtures, accounts, and log filters throughout a run.
- Run high-risk smoke tests first so a blocked auth/backend/build does not waste a full UI pass.
- Batch UI review after a journey while telemetry is parsed in parallel.
- Reproduce an issue twice only when the first result is unclear; deterministic critical failures stop dependent branches.

---

## 7. Environment, devices, accounts, and fixtures

### 7.1 Environment order

1. `STAGING/PREVIEW` is preferred for full functional, destructive, payment, transfer, scanner, safety, and failure testing.
2. `PRODUCTION` receives a read-mostly smoke pass plus explicitly approved labeled QA operations.
3. `DEVELOPMENT` is used only to diagnose device/build connectivity and compare demo versus real data; it cannot prove production readiness.

The report must record:

- Git commit and dirty/clean state.
- Android application ID, version, runtime version, build profile, update ID, and install source.
- `EXPO_PUBLIC_APP_ENV`, API base URL, Firebase project ID, Razorpay key mode, demo/public-showcase flags, Sentry environment, and EAS project ID without exposing secrets.
- Device manufacturer/model, Android version, API level, resolution, density, free storage, battery state, locale, timezone, font scale, navigation mode, and network.
- Backend deployment/version if available.

### 7.2 Required device matrix

Minimum for this exercise:

- `A1`: user's physical Android phone, current normal settings, primary User A.
- `A2`: Android emulator or second phone, isolated app data, User B.
- `A3`: small/low-memory Android emulator or physical device for layout and performance spot checks.

Recommended release expansion:

- Current flagship Android.
- Mid-tier Android on supported minimum or near-minimum OS.
- Small 320–360dp display.
- Large display.
- Gesture navigation and three-button navigation.
- Physical iPhone through TestFlight/preview build for Apple auth, Apple Wallet, APNs, iOS share sheets, safe areas, and VoiceOver.

Android-only completion must explicitly state: `iOS NOT PROVEN`.

### 7.3 Account matrix

#### Consumer User A — buyer/sender

- Verified auth identity using a fixed QA phone/OTP or dedicated QA email.
- Completed basic profile and social profile.
- Owns one free ticket, one paid ticket, and one multi-ticket/group order.
- Has one upcoming event-chat entitlement and one past event.
- Starts DM requests, shares, transfers, payments, and reports.

#### Consumer User B — recipient/claimant

- Separate verified identity and separate device/app data.
- Completed basic profile and social profile.
- Receives chats, requests, shares, claims, transfers, blocks, notifications, and profile interactions.
- Must not initially own the same ticket/order as User A.

#### Operator fixture — scanner/venue role

- Separate account or staff session provisioned by the real server-side role system.
- Scoped to a QA event and device registration.
- Used only for scanner, guest-list, door-entry, walk-in, statistics, and cover-charge cases.
- It must not gain access through client-supplied role values.

#### Guest state

- No authenticated Firebase user.
- Fresh app storage and separately a returning guest state.
- Used to verify public discovery and every auth gate.

### 7.4 Required data fixtures

Create labeled fixtures, never disguised real inventory:

- Upcoming paid event with at least two ticket tiers and controlled inventory.
- Upcoming free event.
- Sold-out tier/event.
- Waitlist-enabled event.
- Live event.
- Past event.
- Cancelled event.
- Rescheduled event if supported.
- Venue with full address, coordinates, gallery, policies, amenities, events, stories, and follow state.
- Event with missing poster/location/host/tickets for graceful-degradation tests.
- Order with one ticket.
- Order with multiple tickets eligible for group share.
- Used, expired, transferred, shared, claimed, cancelled, and refunded ticket states.
- Active cover-charge wallet if this product surface is in scope.
- DM request, accepted DM, event group chat, unread thread, blocked relationship, reported message, and muted/removed chat states.
- Notification payloads for event, ticket, transfer/share, DM, event chat, match, and unknown/fallback type.
- Valid, invalid, expired, revoked, already-used, wrong-event, transferred, and malformed QR/claim/transfer tokens.

### 7.5 Safe payment policy

- Use Razorpay test mode only unless the user separately approves a controlled real-money production smoke test.
- Record provider payment/order IDs in the issue ledger but redact sensitive personal/payment data.
- Test success, cancel, failure, timeout, duplicate callback, app kill, reservation expiry, network loss, and delayed webhook.
- Verify ticket issuance and inventory effects from the server-facing user surfaces, not only the success animation.

---

## 8. Technical preflight gate

If a critical preflight item fails, dependent test phases are marked `BLOCKED`, not falsely failed.

### 8.1 Workspace and build identity

- [ ] Confirm current workspace is `/Users/aayushdivase/Desktop/thec1rcle` and mobile tree is `apps/mobile-app`.
- [ ] Record Git commit; do not alter dirty worktree state.
- [ ] Record package/application version and Expo update/runtime identity.
- [ ] Use the exact Expo SDK 55 documentation when interpreting native configuration or runtime behavior; this audit does not change Expo code.
- [ ] Confirm installed app matches the intended build, not a stale Expo/Metro checkout.
- [ ] Confirm full demo mode and public showcase mode values.
- [ ] Confirm native development/preview build is used for native SDK tests.

### 8.2 USB and ADB

- [ ] `adb devices -l` shows each serial as `device`, not unauthorized/offline.
- [ ] Physical phone remains unlocked and has approved the host RSA key.
- [ ] Package is installed and foreground activity can be resolved.
- [ ] Screen capture, UI hierarchy, input, logcat, force-stop, relaunch, and deep-link commands work.
- [ ] When multiple devices exist, every command is serial-scoped.

### 8.3 Metro and API reachability

- [ ] Determine the actual Metro port; verify required `adb reverse` mapping.
- [ ] Determine API host. If it is loopback on the phone, establish and record the correct reverse mapping.
- [ ] Call `/health` and `/api/v1/health` from the host and prove device-path reachability.
- [ ] Record Firestore, Redis, payments, notifications, and other degraded health indicators separately.
- [ ] Confirm device date/time is automatic and TLS certificates validate.

### 8.4 Native services

- [ ] Firebase Auth initializes and server auth sync completes.
- [ ] Google OAuth configuration matches Android SHA/app build.
- [ ] Phone OTP test numbers and quota are ready.
- [ ] Notification permission, Expo/FCM token, and test-send mechanism are ready.
- [ ] Location, camera, photo library, microphone, maps, and external-app permissions are available.
- [ ] Razorpay opens in test mode.
- [ ] Google Wallet, Maps, browser, email, SMS, WhatsApp, Instagram, and calendar availability is recorded.
- [ ] Sentry environment is configured or explicitly marked unavailable.

### 8.5 Test-data health

- [ ] User A, User B, and operator fixture can authenticate.
- [ ] QA events and inventory exist and are clearly labeled.
- [ ] The two users start in known independent states.
- [ ] Scanner event code/device registration is controlled.
- [ ] Cleanup or reset procedure is documented before execution.

---

## 9. Evidence and result contract

### 9.1 Case status

- `PASS`: expected behavior and server/counterparty persistence proven.
- `FAIL`: reproducible behavior contradicts acceptance criteria.
- `PARTIAL`: part of the workflow works but an important side effect/state is unproven or wrong.
- `BLOCKED`: prerequisite/environment/third-party dependency prevents execution.
- `NOT APPLICABLE`: explicitly out of build/platform/product scope, with reason.
- `NOT RUN`: planned but not executed; always visible in final coverage.

### 9.2 Minimum evidence per case

- Case ID, date/time/timezone, tester/agent, build, device, account, environment.
- Starting state and fixture IDs.
- Exact numbered actions.
- Expected UI and expected server/counterparty state.
- Actual UI and actual state.
- Screenshot or timestamped recording.
- Relevant logcat/API/correlation evidence.
- Duration and retry/attempt count.
- Cleanup performed.

### 9.3 Issue format

Each issue must contain:

- ID and concise title.
- Severity: `P0 Critical`, `P1 High`, `P2 Medium`, `P3 Low`, or `OPT Optimization`.
- Area, route, build, device, account, network.
- Preconditions.
- Exact reproduction steps.
- Expected versus actual.
- Reproduction rate, e.g. `3/3`.
- User/business impact.
- Screenshots/video/log excerpts and timestamps.
- Performance measurement if relevant.
- Whether data integrity, payment, privacy, auth, or security is involved.
- Suggested direction only; no code patch during this exercise.

### 9.4 Severity rules

- `P0`: account takeover, unauthorized access, payment/ticket corruption, credential leakage, irreversible production data damage, app cannot start/login/checkout, safety/SOS harmful behavior, or widespread crash/ANR.
- `P1`: core journey unusable, wrong user/ticket/chat state, duplicate charge/ticket, transfer/claim failure, persistent blank/slow screen, serious privacy/accessibility barrier.
- `P2`: recoverable functional defect, inconsistent state, misleading feedback, non-core crash, poor error recovery, material UI/accessibility issue.
- `P3`: cosmetic/copy/alignment/minor interaction issue with a clear workaround.
- `OPT`: works correctly but is slower, heavier, more confusing, or less polished than the agreed production bar.

---

## 10. Performance, reliability, and optimization measurement

These are provisional QA budgets used to classify observations. Final product SLOs may replace them.

### 10.1 Timing budgets

| Interaction | Target | Optimization flag | Failure signal |
|---|---:|---:|---:|
| Visible tap feedback | <=100 ms | >100 ms | no feedback/wrong action |
| Local route transition begins | <=250 ms | >250 ms | >1 s or blank/frozen |
| Skeleton/loading state appears | <=400 ms | >400 ms | blank screen |
| Warm app interactive | <=1.5 s | >1.5 s | >3 s |
| Cold app interactive on target mid-tier phone | <=3 s | >3 s | >5 s or stuck |
| Cached list useful content | <=1 s | >1 s | >2.5 s |
| Network list/detail useful content on good Wi-Fi | <=2.5 s | >2.5 s | >5 s/no recovery |
| Search response after debounce | <=1.5 s | >1.5 s | >3 s/stale result |
| Chat optimistic send | <=250 ms | >250 ms | message vanishes/duplicates |
| Cross-device message visibility | <=2 s | >2 s | >5 s/no delivery |
| Pull-to-refresh completion | <=3 s | >3 s | >8 s/stuck spinner |
| Checkout non-provider step response | <=2 s | >2 s | >5 s/no status |
| Ticket wallet refresh after confirmed purchase | <=5 s | >5 s | >15 s/missing ticket |
| QR/scanner verdict after capture | <=1.5 s | >1.5 s | >3 s/wrong verdict |

Provider-controlled OTP, payment-app, Wallet, Maps, browser, and share-sheet timing is separated from app-owned timing.

### 10.2 Measurement method

- Cold start: force-stop, clear recents if necessary, use `am start -W`, and record first-interactive video frame.
- Warm start: background/foreground without process death.
- Route time: recording timestamps from tap to first stable useful content.
- Frame quality: reset and collect `dumpsys gfxinfo` around Explore, Feed, Event Detail, Map, Tickets, Dating, Gallery, and Chat scroll/animation sessions.
- Memory: `dumpsys meminfo` at baseline and after repeated navigation, image/gallery use, chat history, map use, and checkout loops.
- Crashes/ANRs: filtered logcat plus Android process state.
- Network: correlate UI timings with API/backend timestamps where available.
- Battery/thermal: record battery level/temperature before and after 30-minute chat/map/scanner sessions; note thermal throttling.

### 10.3 Optimization stress loops

- Ten repeated tab switches.
- Ten Event Detail open/back cycles.
- Five search/filter/reset cycles.
- Ten image-heavy feed scroll passes.
- Twenty rapid but valid chat sends split across users.
- Repeated QR modal open/close and scanner scans.
- Five checkout entry/cancel cycles without completing payment.
- Background/resume during feed, chat, checkout, map, and scanner.
- Rotate only where the app/OS supports it; portrait lock behavior must be intentional.

### 10.4 Reliability acceptance

- Zero crashes, ANRs, unhandled red screens, permanent spinners, or blank screens in core journeys.
- No duplicate orders, tickets, shares, transfers, messages, follows, swipes, notifications, or scanner debits from repeated taps/retries.
- No unbounded memory growth across stress loops.
- No stale user data after logout/account switch.
- No hidden dependency on Metro, demo data, or a host-only loopback address in a production-like build.

---

## 11. Cross-cutting UI, UX, accessibility, and Android checks

Apply this rubric to every user-visible screen, modal, sheet, alert, and system handoff.

### 11.1 UI quality

- Visual hierarchy makes the next action obvious.
- Typography, spacing, colors, icons, radii, shadows, imagery, and motion feel like one product across auth, onboarding, tabs, checkout, wallet, social, scanner, and settings.
- Content respects status bar, camera cutout, gesture area, and custom bottom tab bar.
- No text/image/button clipping at small display widths.
- Long names, venues, cities, email addresses, event titles, prices, and translated/system text wrap safely.
- Empty, loading, success, error, offline, disabled, sold-out, pending, cancelled, expired, used, transferred, and blocked states are visually distinct.
- No tap target is hidden under another view, keyboard, sheet, tab bar, or Android navigation bar.
- Animations remain smooth and do not obstruct task completion.
- Haptic intensity matches action importance; the user confirms tactile quality because ADB cannot feel haptics.

### 11.2 Interaction quality

- Single tap performs exactly one action.
- Rapid/double taps are idempotent or disabled while pending.
- Android hardware/gesture Back dismisses keyboard/sheet/modal before leaving the screen and never exits unexpectedly.
- Back from a deep link reaches a safe app destination.
- Scroll position, selected filters, form state, and draft text behave intentionally on back/background/relaunch.
- Pull-to-refresh neither duplicates content nor erases valid cached content.
- Destructive actions require clear confirmation and show the resulting state.

### 11.3 Accessibility

- TalkBack announces every actionable control with role, label, state, and useful hint.
- Focus order matches visual/task order and returns correctly after modal dismissal.
- Icon-only controls have accessible names.
- Dynamic content changes, errors, match/payment/success states, and scanner verdicts are announced.
- Text is usable at default, 130%, and maximum practical Android font scale.
- Touch targets meet approximately 48dp Android guidance.
- Meaning is not communicated by color, motion, or haptics alone.
- Contrast is checked for text, placeholders, disabled controls, badges, tab states, overlays, and poster-backed content.
- Reduced-motion/animation settings do not make the app unusable.
- Keyboard, switch access, and external keyboard behavior are spot-checked where supported.

### 11.4 Android-specific behavior

- Gesture navigation and three-button navigation.
- Back behavior from every route, modal, Razorpay, camera, share sheet, Maps/browser, and system settings.
- Permission states: first ask, allow, deny, deny twice/Don't ask again, approximate location, system-settings recovery.
- Notification channels and per-channel disable behavior.
- Google sign-in chooser/cancel/error.
- OTP keyboard/autofill/paste/resend.
- App links when app is closed, backgrounded, foregrounded, signed out, and already on a nested route.
- Process death and activity recreation under developer `Don't keep activities` as a stress test, not normal configuration.
- Low storage, battery saver, data saver, Wi-Fi/cellular handoff, airplane mode, captive/no-internet Wi-Fi, and VPN/proxy presence where safe.

---

## 12. Cross-cutting security, privacy, and data-integrity checks

- Guest attempts every protected action and receives an auth gate without partial writes.
- User A cannot read or mutate User B's private profile fields, orders, tickets, settings, device tokens, DMs, reports, or safety data by changing route/token identifiers.
- User B cannot claim/transfer/revoke a ticket without the valid current token and correct eligibility.
- Replayed claim, transfer, payment verification, send, follow, swipe, check-in, and cover-charge actions are idempotent or rejected.
- Expired/revoked/malformed tokens never reveal private event/order/user data.
- Logout and account switch clear cached profile, notifications, tickets, subscriptions, WebSocket session, drafts, and sensitive screens.
- Screenshots/recordings redact OTPs, auth tokens, payment data, exact private location, and personal contact information.
- Clipboard content from claim/share is understood and cleared by OS policy; the app must not expose secrets unnecessarily.
- Notification previews do not reveal sensitive content beyond the approved policy.
- Block/report/mute/remove actions enforce across discovery, profiles, chat, requests, notifications, and future sessions.
- Scanner/operator routes reject unprovisioned consumers and wrong-event/device staff.
- Cover-charge and door-entry decisions are server-authoritative and cannot be forged by changing client input.
- Account deletion is executed only in staging or an explicitly approved disposable production QA account and is verified across auth, profile, media, social, notifications, device tokens, and retention policy.

---

## 13. Network, lifecycle, and recovery matrix

Run the following at minimum on startup, auth sync, Explore, Event Detail, Checkout, Tickets, DM, group chat, notifications, profile save, media upload, transfer/claim, safety, and scanner:

1. Good Wi-Fi.
2. Cellular connection.
3. Wi-Fi to cellular handoff.
4. Offline before entering the screen.
5. Offline during the request.
6. Back online after failure.
7. Slow/high-latency connection.
8. Backend 401/session expiry.
9. Backend 403 authorization failure.
10. Backend 404/deleted resource.
11. Backend 409 conflict/duplicate/sold-out state.
12. Backend 429 rate limit.
13. Backend 5xx/degraded dependency.
14. App background during request.
15. App process killed during request.
16. Relaunch with persisted local state.

For each, verify truthful copy, bounded retry, no duplicate write, usable cached state where appropriate, correct offline banner, and eventual convergence after recovery.

---

## 14. Master end-to-end production journeys

These journeys prove combinations of screens and server state. Individual screen tests do not replace them.

### E2E-01 — Fresh consumer to Explore

Fresh install -> splash -> signup/login -> provider/server sync -> contact linking -> profile setup -> onboarding -> permission education -> location/notification choice -> Explore. Kill/relaunch after every major step and confirm the exact resume point.

### E2E-02 — Returning user and account isolation

User A login -> app kill -> warm/cold return -> logout -> User B login. Confirm no User A profile, ticket, notification, chat, subscription, follow, recommendation, or cart state appears for User B.

### E2E-03 — Guest discovery to authenticated intent

Guest mode -> Explore -> filter/search/map -> Event Detail -> attempt save/chat/checkout/profile action -> clear auth prompt -> authenticate -> return to intended context without duplicate navigation or stale guest data.

### E2E-04 — Paid ticket purchase

Explore/Search/Venue -> Event Detail -> choose tier/quantity -> cart -> pricing/promo -> reserve -> initiate -> Razorpay test success -> verify -> success -> wallet refresh -> ticket detail/QR -> notification/receipt evidence. Confirm inventory decrement and exactly one order/ticket set.

### E2E-05 — Payment interruption and recovery

Repeat checkout with user cancellation, provider failure, network loss, background, process kill, expired reservation, delayed webhook, and duplicate callback. Relaunch and exercise Cancel/Resume Payment. Confirm no duplicate ticket or stranded inventory.

### E2E-06 — Free ticket

Select zero-cost tier -> confirm without Razorpay -> success -> wallet -> QR -> chat/attendee entitlement. Confirm no payment provider handoff.

### E2E-07 — Ticket share and claim

User A opens multi-ticket order -> creates group/share bundle -> sends link -> User B opens cold while signed out -> authenticates -> returns to token -> claims allowed ticket(s) -> both wallets converge -> User A revoke/reclaim rules tested -> token replay rejected.

### E2E-08 — Ownership transfer

User A initiates transfer to User B -> User B receives/deep-links/accepts -> User A loses valid ownership -> User B gains valid ownership/QR -> old QR and repeated acceptance fail -> cancellation/decline/expiry variants tested.

### E2E-09 — Event social lifecycle

Eligible User A joins event chat -> sees attendees/gallery -> sends text/image -> User B receives -> typing/read/unread states -> profiles/DM request -> accept -> DM -> notification taps -> block/report/mute behavior -> event ends/archive restrictions.

### E2E-10 — Dating/matching lifecycle

Complete social setup -> browse deck -> pass/like/comment -> User B reciprocates -> match -> open profile -> DM -> notification -> block/report -> verify privacy preferences, age range, and premium gates.

### E2E-11 — Event-day ticket scan

Operator provisions device/event -> scans User B's current QR -> valid verdict/check-in -> repeat scan rejected/already used -> wrong event, expired, cancelled, refunded, transferred, tampered, and screenshot/replay cases -> stats/guest list update.

### E2E-12 — Cover-charge/event operations

Authorized operator -> cover-charge mode -> valid wallet QR -> preset/custom deduction -> confirmation -> repeated/debit conflict -> offline rejection/recovery -> guest list/door entry/walk-in -> statistics/reconciliation. No real customer wallet is used.

### E2E-13 — Notification and deep-link lifecycle

For each supported payload, test foreground, background, killed app, signed out, expired resource, and malformed payload. Verify exact route, auth return path, back behavior, read/badge state, and no route-not-found screen.

### E2E-14 — Safety lifecycle

Add/edit/remove emergency contact -> permission education -> start/stop location share -> recipient view if available -> SOS confirmation/cancel/success/failure -> safe external-app handoff. Use staging/sandbox endpoints and do not contact real emergency services.

### E2E-15 — Account and privacy lifecycle

Edit profile/photo/social settings -> notification/privacy/permission/appearance settings -> verification request -> help/legal/support -> export/support path if present -> logout -> disposable-account deletion -> re-login rejection and retained-data verification according to policy.

---

## 15. Shared shell and global surfaces

### SHELL-01 — Root application shell (`app/_layout.tsx`)

Elements/behaviors:

- Splash hold/hide and first React layout.
- Dark theme, status bar, Android navigation bar, safe-area and gesture-handler root.
- Firebase auth listener and authenticated side effects.
- Deep-link subscription.
- Notification-response listener.
- Offline/Back Online banner.
- Global error boundary and crash screen.
- Persisted-cart hydration and Resume/Cancel Payment alert.
- Global Premium paywall.

Manual QA:

1. Fresh process start, warm resume, fast refresh/dev restart, low-memory process recreation, and OTA update startup.
2. Confirm splash never hangs, flashes white, hides before content is ready, or covers an OS dialog.
3. Confirm Android system/navigation bars match the app, including gesture and three-button navigation.
4. Toggle connectivity for less than and greater than the banner debounce; verify no false offline state, correct Back Online state, placement above content, and no blocked touches.
5. Trigger a controlled staging-only render error; verify production-safe crash copy, Sentry capture, Retry behavior, and no debug details in release.
6. Open every supported deep link and notification from killed/background/foreground state.
7. Persist an incomplete checkout at each phase and verify Resume/Cancel behavior after hydration.
8. Confirm cleanup of listeners/timers on reload and no duplicate notification/deep-link navigation.

### SHELL-02 — Bottom tab shell (`app/(tabs)/_layout.tsx`)

Elements:

- Explore, Chat, Nightlife, Tickets, Venues.
- Active highlight, icon/label, haptic, animated shrink-on-scroll and safe-area placement.
- Hidden Feed and Profile routes.

Manual QA:

- Tap each tab once, double-tap, rapidly alternate, and tap the active tab.
- Confirm each active indicator exactly matches the visible route.
- Scroll every tab and confirm shrink/expand behavior resets between tabs.
- Verify TalkBack tab role/name/selected state, focus order, and 48dp targets.
- Test small width, large font, display zoom, gesture area, keyboard, modal, and nested-route return.
- Open hidden Feed/Profile directly and verify the tab bar does not show an invalid active highlight.
- Confirm tab switching never duplicates a screen, loses critical draft state unexpectedly, or leaks User A data after account switch.

### SHELL-03 — Global headers, notification bell, and search affordance

Files: `components/ui/GlobalHeader.tsx`, `NotificationBell.tsx`.

- Verify title/subtitle/logo variants, transparent-to-solid scroll behavior, compact Back, search navigation, notification count 0/1/9/99/100+, haptics, safe areas, and dynamic text.
- Verify bell count matches unread store after read, mark-all-read, push receive, logout, and account switch.
- Verify icon-only controls are named to TalkBack and are not obscured by poster imagery.

### SHELL-04 — Guest authentication surfaces

Files: `AuthSheet.tsx`, `GuestAuthPrompt.tsx`.

- Trigger from every guest-protected action.
- Verify Login, Sign Up, dismiss/scrim/Android Back, return path, repeated open, keyboard state, and no partial protected mutation.
- Compare copy and UI across Event, Feed, Chat, Dating, Tickets, Profile, follow, RSVP, waitlist, and checkout gates.

### SHELL-05 — Premium paywall and subscription state

Files: `components/subscription/PremiumPaywallModal.tsx`, `store/subscriptionStore.ts`.

Trigger features:

- Daily likes, Ask Outs, Who Liked Me, rewind, advanced filters, premium-only event, early-access drop, booking fees, and ticket transfers.

Manual QA:

- Free versus premium user; daily quota just below/at/above limit; timezone/day reset.
- Offerings loading, empty offerings, provider failure, Retry, scrim/X/Not Now, Android Back.
- Purchase success, cancel, failure, pending, restored purchase, expired/refunded subscription, network loss, app kill and relaunch.
- RevenueCat result must synchronize to server profile/limits before the gated action is retried.
- Confirm no success haptic on failed/cancelled purchase, no double purchase, correct localized price/period, and accessible modal focus trap/restoration.
- Production launch report must separate Android subscription billing proof from iOS billing proof.

### SHELL-06 — Reusable sheets and overlays

Files: `GuestlistSheet.tsx`, `HostSheet.tsx`, `VenueSheet.tsx`, `TicketActionSheets.tsx`, scanner overlays, country picker, city selectors, image viewers, story/gallery modals.

For each sheet/modal:

- Open/close button, scrim, swipe if supported, Android Back, nested navigation, keyboard avoidance, background/resume, rapid reopen, focus containment/restoration, long content scroll, small-screen cutoff, and safe-area behavior.
- Verify the underlying screen cannot be accidentally activated through the scrim.
- Verify sheet content refreshes when its entity changes and does not show the previous entity for a frame.

---

## 16. Boot, authentication, and first-run screen plan

### AUTH-00 — `/` boot dispatcher

Expected branches:

- Guest -> Explore.
- Signed out -> Login.
- Signed in without completed contact linking -> Add Contact.
- Incomplete basic profile -> Profile Setup.
- Onboarding unseen -> Onboarding.
- Permissions unrequested -> Permission.
- Complete -> Explore.

Tests:

- Fresh/returning/guest/deleted/disabled/token-expired users.
- User at every partial checkpoint; kill and relaunch between each step.
- Server-complete/local-incomplete and local-complete/server-incomplete conflicts.
- Corrupt/missing AsyncStorage and failed profile/auth-sync calls.
- Confirm no wrong-screen flash, unauthorized content, infinite spinner, or cross-account completion leakage.
- Measure Firebase initialization, server auth-sync, profile load, local flag read, and final redirect separately.

### AUTH-01 — `/(auth)/login`

Elements:

- Background video and brand content.
- Skip/guest mode.
- Google and platform-conditional Apple.
- Continue with Phone/Email and method switching.
- Country picker, phone input, Send OTP.
- Email, password, password visibility, Sign In, Forgot Password.
- Verification-email success and Back to Login.

Tests:

- Email/password returning user and new-user auto-creation path.
- Wrong password, malformed/Unicode/long/whitespace/case-varied email, disabled/deleted/unverified account, rate limit and offline.
- Google first/returning/cancel/missing config/old Play Services/provider collision.
- Apple first/returning/private relay/cancel/provider collision on iOS in the later iOS phase.
- All supported country codes, formatted paste, invalid lengths, blocked/test numbers, SMS quota.
- Guest -> protected action -> login -> return to origin; reject unsafe return paths.
- Rapid double taps, method switch while loading, keyboard submit, background during provider flow.
- Confirm Firebase success is not accepted until server auth sync and side effects complete.
- Confirm guest entry clears personal stores/WebSocket and never displays prior-user data.

### AUTH-02 — `/(auth)/forgot-password`

Elements: Back, email, Send Reset Link, Login link, loading/error, sent confirmation.

Tests:

- Existing/nonexistent/malformed/empty email, rate limit, offline, repeat sends.
- Complete the external reset flow; test expired/used link, then old/new password login.
- Verify neutral copy does not enumerate accounts and malformed input receives visible feedback.
- Verify mail-client and browser handoff plus safe return.

### AUTH-03 — `/(auth)/otp`

Elements: Back, six visual cells with hidden numeric input, autofill, loading/error, resend countdown, success state.

Tests:

- Correct, wrong, short, nonnumeric, pasted, expired, already-used, and old-after-resend codes.
- Autofill versus manual entry; sixth-digit auto-submit race and double-submit prevention.
- Resend before/after countdown, background time, device-time change, quota error.
- Sign-in versus contact-linking mode; process death with verification ID; invalid direct route.
- Phone already linked to User B, reauthentication-required, and safe return path.

### AUTH-04 — `/(auth)/signup` legacy signup

Elements: name, email, optional fixed +91 phone, gender, DOB, password/confirm, visibility, Terms/Privacy copy, Create Account, Login.

Tests:

- All validations and DOB boundaries, including exact 18th birthday, leap day and future date.
- Duplicate identity, Firebase-created/profile-save-failed partial state, offline and process kill.
- Verify Terms is actually actionable and policies match current behavior.
- Compare its 18+ enforcement and fixed country behavior with active profile/phone flows.
- Record reachability from guest prompts and decide whether it is supported or legacy.

### AUTH-05 — `/(auth)/phone` duplicate route

- Execute full country/phone/OTP parity suite.
- Test direct and deep-link reachability.
- Compare validation, copy, errors, loading, return path and accessibility with Login's embedded phone form.
- Classify as supported duplicate, legacy alias candidate, or orphan based on runtime navigation evidence.

### AUTH-06 — `/verify` email-action route

- Valid, expired, used, missing, malformed, wrong-project and wrong-mode action codes.
- Cold/warm open, signed out, signed into another account, offline, duplicate tap.
- Confirm Firebase `emailVerified`, refreshed token/server state, correct first-run checkpoint, and no bypass of contact/profile requirements.
- Redact action codes in artifacts.

### AUTH-07 — `/add-contact`

Elements: logout/back, Skip, adaptive email/phone form, country picker, Next/loading/error.

Tests:

- Email account links phone; phone account adds email; Google/Apple combinations.
- Duplicate contact already owned by User B, invalid input, network loss after Firebase change, reauthentication.
- Skip, logout, Android Back, force-stop and re-enter.
- Verify linked email ownership/verification and whether skipped contact state remains honest after profile completion.

### AUTH-08 — `/profile-setup`

Elements: logout/back, Step 1, name, gender dropdown, DOB/date picker, age badge, DOB info modal, Continue.

Tests:

- Empty/long/Unicode name; every gender; dropdown and modal interactions.
- DOB under 13, exact boundary, exact 18, future, 1900, leap day, timezone.
- API/local completion partial failure, optimistic rollback, kill during save, prefilled profile and account switch.
- Explicitly compare the 13+ UI rule with 18+ signup/legal policy.

### AUTH-09 — `/onboarding`

Elements: three video-backed slides, swipes, dots, Skip, Next/Get Started, illustrative QR interaction.

Tests:

- Swipe/snap/mixed-button navigation, Skip from every slide, Back, background/resume, video low-memory recreation.
- Confirm illustrative QR never mutates real ticket data.
- Local flag/API profile update partial failure and account-scoped persistence.
- TalkBack semantics, font scaling and reduced-motion usability.

### AUTH-10 — `/permission` active combined permission screen

Elements: illustrations, Enable Notifications & Location, Set up later, loading.

Tests:

- Notification and location each: allow, deny, permanent deny, previously granted, revoked, OS service disabled.
- Mixed outcomes and concurrent OS prompt sequencing.
- Precise/approximate location, geocode success/failure, city persistence.
- Background during prompt, rapid tap, settings recovery, prompt counts and seven-day logic.
- Set up later must not misrepresent permissions as granted.

### AUTH-11 — `/notification-permission` legacy standalone route

- Full notification permission matrix, prompt counter behavior, navigation to location route, Back, direct reachability.
- Compare bookkeeping and copy with combined Permission.

### AUTH-12 — `/location-permission` legacy standalone route

- Full location permission/service/geocode matrix, skip, loading, Back, direct reachability.
- Compare with combined Permission and classify legacy status.

---

## 17. Social-profile setup, own profile, settings, help, legal, and verification

### PROFILE-01 — `/social-setup` landing

Elements: Close, benefits, three-step preview, Get Started, Skip for now.

Tests:

- First entry, already-complete/verified user, incomplete resume, skip and revisit.
- Offline/slow social-profile status load and account switch.
- Verify feature claims match actual discovery, verification, matching, and DM policy.
- Verify completed users can still find a supported edit route.

### PROFILE-02 — `/social-setup/photos`

Elements: Back, progress 1/3, six slots, main-photo badge, add/change/remove, upload progress, Continue, Skip.

Tests:

- Photo permission allowed/denied/permanent denial; picker cancel.
- JPEG/PNG/HEIC, corrupt, transparent, rotated EXIF, low-resolution, huge image.
- Main-photo requirement, one/six photos, replace/remove while upload runs, rapid taps.
- Slow/offline/413/500 upload, partial completion, background/process death, visible retry.
- Verify uploaded-but-cancelled and locally removed media is cleaned or explicitly retained by policy.
- Confirm moderation, ownership, MIME/size/dimension constraints and User A/B isolation.

### PROFILE-03 — `/social-setup/preferences`

Elements: Back, progress 2/3, city, Interested In, age range, Looking For, sexuality, drinking, smoking, privacy choices.

Tests:

- Empty/long/Unicode city and keyboard behavior.
- All multi/single-select combinations, zero selection, Everyone plus specific genders.
- Age 18/18, 60/60, rapid +/- and crossed ranges.
- Back/process-death preservation and malformed/missing route params.
- Verify privacy-sensitive values are only exposed where approved.

### PROFILE-04 — `/social-setup/review`

Elements: Back, progress 3/3, preview, visible/hidden switch, verification nudge, Go Live, Skip.

Tests:

- Every prior-data combination; direct route with missing/malformed JSON.
- Visible versus hidden proof from User B.
- Save success/failure/timeout/double tap/process kill.
- Verify profile and visibility persist together; a partial secondary update must not route as full success.
- Verify disclaimer promises, deletion/edit path and setup-complete semantics.

### PROFILE-05 — `/(tabs)/profile`

Elements/states:

- Guest Login/Sign Up.
- Loading/error with Dismiss/Retry.
- Back, Share, Settings.
- Avatar, name, Premium, event count, joined date, bio, vibe tags.
- Instagram/Spotify.
- Nightlife profile prompt, dismiss/Get Started.
- Upcoming tickets, event history, empty Discover Events, pull-to-refresh.

Tests:

- Guest/missing/partial/full/premium/expired profile and image failures.
- Long/Unicode content and image-cache update.
- Share cancel/success; Instagram installed/browser fallback/invalid handle.
- Spotify behavior versus actual connected-account state.
- Pull-to-refresh freshness, offline retry, account switch and prompt-dismiss scoping.
- Ticket/history date boundaries and navigation to exact event/order.

### PROFILE-06 — `/profile/edit`

Elements: Cancel, Save/Saved, avatar camera/library/remove, name, bio, city, gender/support, Instagram modal, Spotify modal, read-only email.

Tests:

- Dirty versus clean Cancel and unsaved-change warning.
- All field boundaries, newlines, Unicode, counters and normalization.
- Camera/library permissions, cancel, huge/corrupt photo, upload progress/failure, remove-only edit.
- Cancel after upload and orphan-media behavior.
- Read-only city/gender support path and mail-client fallback.
- Instagram/Spotify normalization and conflict with real Spotify OAuth.
- API optimistic update/rollback, double Save, background/process kill, cold profile refresh.

### PROFILE-07 — `/profile-creation` Nightlife profile editor

Elements:

- Cancel/discard; Done and Publish/Save.
- Hero plus six photos.
- Height, gender, preset/custom location.
- Up to eight of twelve vibe tags.
- Spotify/iTunes anthem search, preview/external open.
- Up to three prompts; question choice, 200-character answer, remove.

Tests:

- Publish empty/minimal/full profile; validate required server policy.
- Six-photo upload, permission/failure/orphan/order tests.
- Vital-field limits, custom location, gender consistency with basic profile.
- Ninth vibe, deselection, persistence order.
- Anthem query debounce, offline, one/both provider failure, duplicates, preview/open.
- Prompt count/answer boundaries, duplicate questions, keyboard/sheet behavior.
- Dirty Cancel, publish retry, profile visibility from User B, and visual consistency with the dark app.
- Compare this editor's flat dating fields with `/social-setup` nested social-profile state and report divergence.

### SETTINGS-01 — `/settings` hub

Elements:

- Signed-in profile/Edit/Account; signed-out Login/Sign Up.
- Notifications, Nightlife Profile, Permissions, Appearance.
- Spotify connect/disconnect.
- Support, rating, Instagram, X, Privacy, version/build.
- Logout.

Tests:

- Every row route/external destination; installed/uninstalled app, offline and no mail/browser handler.
- Android store-rating URL must target Google Play, not Apple.
- Displayed version/build must match installed package.
- Spotify connect/cancel/callback/token expiry/disconnect/account switch.
- Logout success/failure/process kill; no private screen in back stack and all stores/WebSocket/push state cleared.
- Guest/signed-out direct entry and haptics setting consistency.

### SETTINGS-02 — `/settings/account`

Elements: email, phone, username, passkeys, Ethereum/Solana, Delete Account.

Tests:

- Verify available versus Coming Soon/inert rows are labeled honestly.
- Delete cancel/success/failure/offline/recent-auth requirement/double tap/process kill.
- Execute only on disposable staging/test account unless separately approved.
- Verify Firebase identity, gateway user, profile/photos, social data, devices/tokens, settings, chats, tickets retention policy, blocks and subscriptions.
- Confirm re-login behavior and immediate cross-device access revocation.

### SETTINGS-03 — `/settings/notifications`

Elements: OS permission hero, Alert Preferences, event/guest/admin notification switches.

Tests:

- OS permission status and Open Settings return.
- Every toggle online/offline/rapid; optimistic rollback and canonical persistence.
- Account switch without settings flash/leak.
- Prove actual delivery/non-delivery per channel; UI toggle alone is not a pass.
- Verify OS grant does not overwrite an intentional app-level opt-out.

### SETTINGS-04 — `/settings/alert-preferences`

Elements: account/contact display, master Allow Alerts, SMS Transactional, Marketing Emails.

Tests:

- Master/subsetting hierarchy, every combination, real delivery suppression, missing contact data.
- Offline rollback, relaunch persistence, guest direct route, TalkBack switch/check state.

### SETTINGS-05 — `/settings/permissions`

Elements: Contacts Syncing, location/camera/push status, public profile/guestlists/attendance, Blocked Accounts.

Tests:

- OS status query/refresh after settings changes, approximate location and permanent denial.
- Contacts switch must match actual OS permission/sync behavior.
- Public privacy toggles must be proven from User B across profiles, attendees, guestlists, dating, history and chat.
- Blocked Accounts must open and function; a no-op is a failure.
- Offline rollback, account scoping and accessibility.

### SETTINGS-06 — `/settings/appearance`

Elements: System/Dark/Light, Reduce Motion, Haptic Feedback.

Tests:

- Every setting across relaunch, account switch and system-theme change.
- Inspect the whole app to verify theme actually changes, motion is reduced, and haptics are disabled globally.
- Confirm settings are not decorative/local-only.
- Check TalkBack state, color contrast and animation-sensitive flows.

### SETTINGS-07 — `/settings/payment`

Elements: Add Payment Method, Payment History.

- Direct-route smoke and reachability check.
- Verify both actions' Coming Soon behavior and that no user is misled into expecting stored-card management.
- Classify as unsupported placeholder or launch-blocking missing feature based on product promise.

### SUPPORT-01 — `/help`

Elements: Back, Email Support, external Help Center, FAQs for transfers/refunds/waitlist/privacy.

- Test mail/browser success/failure/offline, Back without history, scroll/text scaling/TalkBack.
- Fact-check every answer against observed production behavior and approved policy.
- Determine normal reachability and classify orphan status if none.

### LEGAL-01 — `/legal/terms`, `/legal/refunds`, `/legal/guidelines`, `/legal/safety`

- Full-scroll/readability/TalkBack/headings/links/email/date/version tests.
- Confirm content matches approved production policy and actual features.
- Reconcile age language, refund/transfer rules, SOS/location/Party Buddy claims, reporting, 2FA and moderation promises.
- Verify internal navigation or classify as direct-route/orphan.

### LEGAL-02 — `/legal/privacy`

- Automatic browser open, failure fallback, repeated open, offline, Back, accessibility.
- Compare external web policy with internal legal content and select/report the authoritative source.

### VERIFY-01 — `/verification`

Elements: status banners, benefits, three described steps, Start Verification.

Tests:

- Unverified/pending/verified/rejected/missing/signed-out states.
- Start/double tap/offline/4xx/5xx/retry and canonical refresh.
- Prove whether camera, liveness/face scan, consent, retention, moderation and review actually occur; a status-only API update is not verification proof.
- Validate all benefit, timing and privacy claims.
- Determine reachability and test profile badge/priority effects from User B.

---

## 18. Explore, discovery, search, maps, events, venues, and waitlist

### DISC-01 — `/(tabs)/explore`

Elements:

- Time-based greeting, city selector/modal, profile avatar, notification bell, search.
- Quick filters: All, Free, Tonight, Trending, Weekend.
- Location nudge Enable/dismiss.
- Pull-to-refresh and offline/cached state.
- Featured deck.
- Scene categories: Bollywood, Techno, Raves, Pool Parties, Sundowners.
- Worth the Hype, Top Venues, Handpicked Curations, Hottest Scenes, Weekly Lineup.
- All Scenes cards and pagination.
- Map preview/View Map.
- Skeleton, filtered-empty, no-content and error states.

Tests:

1. Fresh/warm/cached/offline/slow/API-error loads and recovery.
2. Verify every filter against known fixture time, date, price, heat, category and inventory data.
3. Rapid filter/city changes while requests are in flight; final choice must win.
4. Scroll/swipe every rail/deck, tap center/side cards, Back and verify position.
5. Zero/one/eight/nine/twenty-four/twenty-five/100+ events and page boundaries.
6. City must change content, not only label; compare Tempe device location with event markets.
7. Location denied/permanent denied/granted later/revoked while running.
8. Cached events must not imply live ticket availability.
9. Verify whether date/category filter code is actually reachable in the rendered UI.
10. Run with demo/public-showcase disabled and identify any fake poster/event/avatar fallback.

Metrics: first meaningful content, cached/network p50/p95, request count, image decode, rail/vertical scroll frame quality, memory after twenty scrolls.

### DISC-02 — `/events/feed` and alias `/(tabs)/feed`

Elements: Back, title/search entry, search icon, vertical snap feed, event navigation, share, interested heart, sticky Get Tickets, type-specific feeds.

Tests:

- Default, scene, Free, Trending, Similar and This Week with authoritative fixture matching.
- Verify Free is truly zero price and This Week uses correct date boundaries/timezone.
- Zero/one/100+ results; missing price/poster/attendees; sold out/premium/early access.
- Fast flick active-index/sticky-CTA synchronization and poster blank-frame checks.
- Competing card/heart/share taps and guest protected-action feedback.
- Share cancel/external-app return and background/resume mid-list.
- Open both canonical and alias routes; verify identical content and sane back stack.
- Treat invented prices or fake attendees as failures in production-like mode.

### DISC-03 — `/(tabs)/venues`

Elements: profile avatar, search/clear, All/Bookable/Events/Tonight filters, spotlight, Reserve a Table rail, venue cards, pull refresh, retry/empty.

Tests:

- Search by name/type/neighborhood/tag with case, whitespace, Unicode, emoji and long input.
- Verify each filter from controlled venue/contact/event fixtures.
- Spotlight exclusion and single-result edge cases.
- Venue fetch and event fetch fail independently.
- Missing/broken image, long metadata, follower/event count, small-screen keyboard and accessibility.

### DISC-04 — `/search`

Elements: autofocus, keyboard Search, clear, Cancel, All/Events/Venues/Hosts, city picker, result cards, recent open/remove/Clear All, retry/empty actions.

Tests:

- Query lengths 0/1/2/3/50/200, spaces, punctuation, case, Unicode and emoji.
- Rapid typing around debounce; stale responses must never replace newer results.
- Change filter/city mid-request.
- Open every result type and exact entity ID.
- Recent persistence, ordering, dedupe, five-item cap, removal and corrupt local JSON.
- Direct query/filter route params and Back from cold launch.
- Verify host result destination exists; missing route is a clear failure.
- Measure keystroke-to-results p50/p95 and request count.

### DISC-05 — `/map` and alias `/explore/map`

Elements: permission state, Back, recenter, Events/Venues, map pan/zoom, marker/cluster, suggestion pills/dismiss, entity cards, View, Venue Page, Directions, retry.

Tests:

- Location allow/deny/permanent deny/approximate/GPS off/grant later.
- Pan across bounds rapidly; debounce/final-bounds/stale-response/100-pin behavior.
- Zoom extremes, large bounds, antimeridian and no results.
- Multiple events same venue, missing venue/coords and geocode success/failure/cache.
- Marker select -> pan -> mode switch -> Back; stale card must clear.
- Cold links with event ID, venue ID and explicit region.
- Google Maps installed/absent/browser fallback.
- Both canonical/alias routes, compiler/runtime duplicate-prop warnings, map FPS and memory after repeated mode switches.

### DISC-06 — `/event/[id]`

Elements:

- Back, Share, duplicate/alternate interested controls.
- Interested/guestlist sheet.
- Details expansion.
- Mini map, Full Map, Directions.
- Venue/host sheets, follow/contact/Instagram.
- Auth prompt.
- Get Tickets/cart count, premium gate, sold-out/waitlist, purchased confirmation.
- Any dormant tier sheet must be tested for reachability.

Tests:

- Valid/deleted/unpublished/malformed/cold-linked IDs.
- Cached detail then server revalidation with changed title/date/price/inventory.
- Guest/auth interested, double tap, offline, 401/403/404 rollback and two-account propagation.
- Share URL/cancel; long/missing all content fields.
- Map versus card-tap conflicts and directions fallback.
- Follow guest/auth/rollback; contact/Instagram installed/absent.
- Available/mixed/sold-out/free/gender-restricted/premium/early-access/already-purchased tiers.
- Repeated CTA tap, animation interruption, background and correct order selection.
- Prove the visible sold-out path can actually reach Waitlist; dormant code is not a pass.

### DISC-07 — `/event/[id]/map`

- Warm open from Event Detail and cold direct/deep-link open.
- Valid/missing/deleted event, in-memory store empty, missing coordinates, directions handlers and Back.
- A cold route must fetch or show an honest recoverable state; dependence on prior Explore hydration is a failure.

### DISC-08 — `/venue/[id]`

Elements:

- Back, Share, Directions, Follow, reservation/contact.
- Story rings with previous/next/close.
- Gallery and close.
- Events/Menu/About tabs.
- Event cards, menu image, tags/facilities/timings/contact.

Tests:

- ID versus slug, invalid/partial payload, retry.
- Guest/auth follow, double tap, offline rollback and count consistency.
- WhatsApp/phone international/invalid/no contact.
- Coordinate/text directions fallback.
- Zero/one/many stories and galleries; broken/high-resolution images and memory.
- Empty/populated menu, long text, upcoming-event navigation/date parsing.
- Share/cold shared link and User A/B follow visibility.

### DISC-09 — `/waitlist/[eventId]`

Elements: Back, status/loading/retry, Join, joined position and notification destination.

Tests:

- Auth email, phone-only, guest/missing email and direct deep link.
- Not joined/already joined; concurrent A/B and repeated joins.
- Sold-out state changes, ticket becomes available, event deleted.
- Network failure before request, after server commit and during refresh; idempotent recovery.
- Position 1/null/zero/large, total mismatch and relaunch persistence.
- Prove eventual notification and deep link.
- Silent return when unauthenticated/missing email is a UX failure.

---

## 19. Checkout, payment, success, ticket wallet, sharing, claiming, and transfer

### COM-01 — `/checkout/[eventId]` tier selection

Elements: Back, tier expand/collapse, minus/plus, quantity/stage visualization, Proceed.

Tests:

- Remaining 0/1/8/9/10/>10, multiple tiers, free/paid, long/missing/malformed tier data.
- Rapid/multitouch plus/minus; never negative/over cap.
- Inventory change after selection and server rejection/reconciliation.
- Gender/couple/stag/ladies/VIP eligibility and explicit user feedback.
- Proceed with another event already in cart; promoter/referral preservation.
- Back/reopen selection persistence and sold-out Waitlist access.

### COM-02 — `/checkout`

Elements:

- Back; order summary.
- Promo open/apply/remove/close.
- Quote loading/retry.
- Payment method info, receipt email, host-updates opt-in.
- Terms and Privacy.
- Confirm Free/Pay Razorpay.
- Empty/expired cart states.
- Root Resume/Cancel incomplete-payment alert.

Tests:

1. Free and paid orders.
2. Promo valid/invalid/expired/limited/event-specific/concurrent exhaustion.
3. Free/premium fees, premium event and early-access gates.
4. Inventory lost, reservation expired, initiate failure, Razorpay cancel/failure, verify failure, delayed webhook.
5. Background/process kill/network loss during quote/reserve/initiate/provider/verify/success.
6. Resume before/after expiry; captured payment before client verify response.
7. Double tap/callback/retry and exactly-once order/tickets/inventory.
8. Cart mutation invalidates stale reservation.
9. Receipt email validation and account mismatch.
10. Displayed subtotal/discount/platform fee/payment fee/GST/total exact match with server.
11. Host opt-in default and persistence.
12. Terms and Privacy open distinct correct policies.
13. Verify native Razorpay; development fake payment IDs are never counted as passes.

Metrics: quote, reserve, initiate, provider open, verify, webhook-to-wallet and total journey timing.

### COM-03 — Root pending-payment recovery

- Seed persisted cart/reservation/order for every phase.
- Relaunch while reservation valid, expired, server confirmed, cancelled and server unreachable.
- Resume/Cancel/Android Back/double tap.
- Confirm server-confirmed state clears pending recovery and routes the user to understandable ticket/order state.
- Confirm cancellation does not leave confusing cart/reservation or release inventory incorrectly.

### COM-04 — `/checkout/success`

Elements: reveal animation, Retry sync, Share attendance, View Ticket, Explore, Back.

Tests:

- Genuine paid/free order versus direct/spoofed route params.
- Wallet immediate/delayed/offline/wrong ID/refunded/cancelled.
- Success UI must not be authoritative until wallet/order confirms.
- Group-chat entitlement only after confirmed order.
- Retry-visible failure, Back always to safe destination, light/dark accent contrast.
- Reopen repeatedly with no duplicate membership/analytics/state.

### COM-05 — `/(tabs)/tickets`

Elements:

- Upcoming/Past segments and swipe.
- Profile avatar, pull refresh, retry.
- Pending reservation Resume/Dismiss.
- Ticket cards and deep-link auto-open.
- Pager, poster/QR flip, modal close.
- View Event, share claim, transfer, confirmation, calendar, wallet, directions.
- Cover-charge wallet QR/countdown/history.
- Empty/offline/cached states.

Tests:

- Zero/one/many orders; every lifecycle state; invalid/missing dates.
- User A cached wallet must never show for User B.
- Deep link to A order while B signed in.
- Per-ticket/quantity QR mapping, claimed/unclaimed/used/expired/transferred/refunded states.
- Refresh while sheet open and order disappears/changes.
- QR brightness/screenshot/rotation plus actual scanner proof; redact artifacts.
- Calendar/directions handler variants.
- Google Wallet success/not configured/bad URL/external return/PDF fallback and Android-correct copy.
- Cover wallet lifecycle, 55-second refresh, offline stale QR rejection, history ordering.
- Pending-payment recovery before/after expiry.

### COM-06 — `/ticket/[id]`

Elements:

- Back, share event, Show/Hide QR, pager.
- Event, directions, calendar, confirmation, wallet.
- Share unclaimed ticket.
- Transfer claimed ticket by email/link.
- Cancel pending transfer/share link.
- Reclaim unclaimed slot; revoke claimed ticket.
- Ticket roster and price breakdown.

Tests:

- Every order/ticket status and multi-tier/multi-quantity order.
- Operate on a specifically selected ticket; never silently choose the wrong first ticket.
- Order/share/transfer partial-load failures and refresh.
- Every destructive dialog, double tap, ambiguous timeout and reconciliation.
- User B attempts A order route/actions.
- Used/scanned/refunded/transferred constraints.
- Currency/money-unit correctness and redacted QR/ticket IDs.

### COM-07 — `/transfer` code/send screen

Elements: Back, send/receive modes as rendered, recipient/code/link input, action, success/Done/View Tickets/share.

Tests:

- Exact ticket ID/order ID contract from every entry point.
- Valid/invalid/self/duplicate recipient, token/code length and whitespace.
- Success/failure/offline/timeout/double tap; same idempotency key where supported.
- Cold direct route, missing params, Back and wallet convergence.
- Verify link uses stable public HTTPS/app domain, not internal API host.

### COM-08 — `/transfer/[token]`, `/claim/[token]`, `/tickets/claim/[token]`

Elements: token preview, auth gate, accept/claim, result, Tickets/Explore.

Tests:

- Canonical and both alias paths, custom scheme and public HTTPS.
- Cold/warm/background, signed out -> login -> token return, User A/B account switch.
- Valid/invalid/malformed/truncated/very long/expired/revoked/used token.
- Preview loaded then sender cancels; concurrent accept; replay.
- Already accepted must prove ownership belongs to current user, not infer success from error wording.
- Back stack, route-not-found prevention, App Links association and token redaction.

### COM-09 — two-account share bundle

1. User A owns a controlled multi-ticket order.
2. Select exact tier and Just 1; create link through every supported channel.
3. User B opens signed out and authenticates back to the link.
4. User B claims; both wallets and rosters converge without manual repair.
5. Replay by B and third/incorrect account.
6. All remaining quantity link.
7. Sender cancel before preview and after preview.
8. Sender reclaim unclaimed slot.
9. Sender revoke claimed slot on staging fixture; receiver loses current QR.
10. Gender/couple restrictions and free/premium quota boundaries.

### COM-10 — two-account formal ownership transfer

1. User A selects an exact claimed ticket.
2. Transfer by email and link variants.
3. User B accepts by expected identity.
4. A loses ownership/QR; B gains ownership/QR.
5. Old QR and repeat acceptance fail.
6. Wrong account/email, self-transfer, expired/cancelled link, sender cancel race.
7. B offline after server acceptance; wallet converges after reconnect.
8. Used/refunded/scanned/couple/gender-restricted and transfer-quota cases.

### COM-11 — `/going/[orderId]` legacy redirect

- Valid/missing/malformed/unauthorized order ID from old link/notification.
- Confirm redirect reaches exact `/ticket/[id]`, no loop, safe Back and no private information leak.

### COM-12 — Ticket PDF, native Wallet, calendar, directions, and external sharing

Files: `lib/wallet.ts`, ticket actions.

- PDF first download/cache/re-download, offline cache, corrupt/non-PDF/401/404/500, low storage and OS share availability.
- Google Wallet ready/not configured/not implemented/bad URL/cancel/return; verify actual saved pass content and update behavior.
- Calendar add/cancel/duplicate/timezone.
- Maps installed/absent and Android URI correctness.
- WhatsApp/Instagram/SMS/email/copy/system share installed/absent/cancel; correct message/link and clipboard behavior.
- Haptic must reflect actual success/failure, not merely function completion.

---

## 20. Nightlife, dating, matches, profiles, attendees, contacts, reports, inbox, and chat

### SOC-01 — `/(tabs)/social` and hidden/alias `/(tabs)/dating`

Elements:

- Profile photo/prompt cards and metadata.
- Like, Pass, prompt reply, photo reply.
- Ask Out/reply sheet with 180-character input.
- Advanced filters and premium gates.
- Retry/next/empty states.
- Mutual-match modal.
- Social-setup gate.

Tests:

- Both route names and back-stack identity; no duplicate screen/state.
- Incomplete user forced to setup; complete user never loops.
- Full deck, last card, pagination, refresh/relaunch dedupe.
- A/B simultaneous mutual like and match state.
- Free quota boundary, premium activation/restore/reset timezone.
- Ask Out empty/whitespace/180/181/emoji/RTL.
- Rapid/conflicting like/pass/reply and exactly one server action.
- Failure rollback for every action, including Ask Out.
- Advanced filter boundaries/combinations/persistence and no-results recovery.
- Match modal opens exact new conversation, not generic inbox.
- Process kill after optimistic removal and server reconciliation.

### SOC-02 — `/dating/[id]`

- Open from deck, notification, social profile and cold deep link.
- Valid/deleted/blocked/hidden/no-longer-discoverable profile.
- Zero/one/many photos, every prompt/photo reply, missing metadata.
- Cold route must fetch or show recoverable state rather than depend only on preloaded dating store.
- Edit from other device while open; refresh/currentness.
- Like/pass/match loop prevention and exact conversation route.

### SOC-03 — `/social/matches`

Elements: match history, Who Liked Me, blurred/free and premium states, Upgrade, accept/open profile/open conversation.

Tests:

- Empty/one/large history; stale/deleted/blocked/unmatched users.
- A/B mutual match and simultaneous incoming-like acceptance.
- Free/premium visibility and screen-reader privacy; blurred data must not remain accessible.
- Purchase/restore, network failure/idempotent retry and correct conversation ID.
- Compare active Zustand behavior with any parallel unused query hooks for data drift.

### SOC-04 — `/social/profile/[id]`

Elements: avatar/profile, Instagram, Share, upcoming/past events, dating/setup action.

Tests:

- Real API versus any fallback/demo profile; API failure must not silently show fake data.
- Missing/long profile fields and broken images.
- Private/hidden/deleted/blocked/self profiles and User A/B privacy.
- Instagram handlers and shared payload/direct profile link.
- Event history visibility and exact event routes.
- Dating redirect must load the target profile even after cold entry.

### SOC-05 — `/social/attendees`

- Ticket holder/non-holder/transferred/refunded/expired entitlement.
- Free versus premium blur and TalkBack/client-response privacy.
- Direct deep-link server authorization.
- Current-user exclusion, blocked/deleted users, empty/100+ list.
- Profile open and duplicate DM initiation.
- Distinguish API error from empty state and measure large-list performance.

### SOC-06 — `/social/contacts`

- Empty/duplicate/blocked/deleted contacts.
- Persistence after event/chat expiry and profile navigation.
- Network error/retry distinct from empty.
- Avatar/data accuracy, large list, account switch and privacy.

### SOC-07 — `/social/report`

Elements: target context, categories, optional details, submit/success/back.

Tests:

- Every category; empty/whitespace/long/emoji/RTL details.
- Missing target params, self report, inaccessible/deleted target/message.
- Double submit/retry/idempotency and offline.
- Verify report record, moderation visibility, reporter privacy and cross-surface effect.
- Verify optional Block action where offered and safety escalation copy.

### CHAT-01 — `/(tabs)/inbox`

Elements:

- Event-chat/private-chat tabs and horizontal swipe.
- Chat cards/rows, unread badges, match/like modal.
- Pull refresh, pagination, search affordance.
- Guest/empty/loading/error states.

Tests:

- Guest must see honest auth/empty UI, never a fake conversation that appears real.
- Event-only/private-only/both/large inbox.
- Visible Search must function or be reported as dead.
- Vertical-scroll/horizontal-swipe conflict.
- Independent pagination and concurrent load-more.
- New conversation realtime insertion, row update, read/unread decrement.
- Offline/reconnect/background/socket soak and error versus empty.
- Match modal uses conversation ID.
- Long names/missing images, TalkBack and performance at 100+ threads.

### CHAT-02 — `/chat/[id]` legacy route

- Valid/missing/malformed/encoded ID from old notification/deep link.
- Confirm safe redirect to `/social/group/[eventId]`, no loop, no stale legacy UI, correct Back.

### CHAT-03 — `/social/group/[eventId]`

Elements/behaviors:

- Event/phase/participants/details.
- Message list, text/image composer, send/retry.
- Typing, unread/read, pagination.
- Profile/DM actions, moderation actions.
- Event phase and read-only/archive behavior.

Tests:

1. Ticket entitlement, transferred/refunded/revoked entitlement while room is open.
2. Upcoming/live/ended/archived phases.
3. A/B simultaneous text/image, ordering, temp replacement, duplicate prevention and clock skew.
4. Offline optimistic send/retry; 500-character boundary, links, emoji and RTL.
5. 51+ messages and older-page loading.
6. Typing/read/unread/participant counts and background/reconnect.
7. WebSocket to polling fallback and 30-minute soak.
8. Rate limit UI plus server enforcement.
9. Host/announcement/badge, block/report/mute/remove and inaccessible users.
10. Event deletion/missing metadata and no demo fallback in production-like mode.
11. Verify likes/deletion persist server-side; local-only state returning after reload is a failure.
12. Verify gallery/attendee entry points and media counts are reachable.

### CHAT-04 — `/social/dm/[id]`

Two-account workflow:

1. A sends request; confirm policy before acceptance.
2. B receives request banner and accepts, declines and blocks in separate fixtures.
3. Race response from two B devices; exactly one final state.
4. A/B text/image, realtime delivery, order, typing, read/unread.
5. Image permission, huge/corrupt file, slow upload, low storage, cancel/retry.
6. Background/process death/relaunch on both devices.
7. Message actions: report, local/server hide/delete as supported.
8. Local and server rate limit across restart.
9. 51+ pagination, same user on two devices, revoked access and deleted counterpart.
10. Acceptance/decline UI must follow server outcome, not unconditionally change local state.

### CHAT-05 — `/social/requests`

- Empty/one/20+ incoming requests.
- Profile/event enrichment success/partial failure; measure N+1 latency.
- Accept/decline/offline/timeout and simultaneous response elsewhere.
- Blocked/deleted sender, exact conversation route.
- New request while screen stays open and refresh/realtime behavior.

### CHAT-06 — `/social/gallery/[eventId]`

Elements: media grid/viewer, add/camera/gallery, caption/progress, like/unlike, delete/report, event navigation.

Tests:

- Entitled/non-entitled cold link and event-phase upload policy.
- Camera/gallery permissions, large/corrupt/rotated image, slow/interrupted sequential full+thumbnail upload, orphan cleanup.
- Caption empty/150 boundary, duplicate upload and process death.
- A/B polling visibility, like races/counts, owner/non-owner delete, report/moderation removal while open.
- 50+ items/pagination, viewer Back/focus, ten-second polling battery/network soak.
- Prove backend auth/entitlement even if client list request omits auth.

---

## 21. Notifications and deep links

### NOTIF-01 — `/notifications`

Elements: Back, sections/grouping, item tap, read/unread, swipe clear, mark all read, empty/loading/error, bell count/badge.

Tests:

- Zero/one/100+ notifications and midnight/timezone grouping.
- Mark one/all, swipe clear, offline rollback, duplicate response and account switch.
- Clear must adjust local/server unread counts immediately and after refresh.
- API error must differ from genuine empty.
- Detect duplicate initial fetch/subscription and 15-second polling cost.
- Every item target route with valid/missing/deleted entity.

### NOTIF-02 — OS push permission and token lifecycle

- First education then permission; allow/deny/permanent deny/settings recovery.
- Token creation/registration exactly once, rotation, app update/reinstall, logout, account switch, deletion and same account on two devices.
- Per-channel Android settings and app-level preferences.
- Verify backend token ownership and invalid-token cleanup.

### NOTIF-03 — delivery matrix

For each approved type—event reminder/update, ticket confirmed/updated/refund/transfer/share, DM request/message, event chat message, match/like, waitlist, safety and unknown fallback—test:

- Foreground, background and killed app.
- Signed in, signed out and wrong account.
- Tap once/twice; duplicate push.
- Valid/missing/malformed IDs.
- Exact route, auth return, Back, read state and badge.

### NOTIF-04 — routing-contract reconciliation

Explicitly test code-level contract risks:

- DM route requires conversation ID, not user ID.
- Match route must target an existing screen.
- Fallback notification route must exist.
- Producer and client type names must agree.
- `/profile/:id`, claim, transfer, event, ticket and chat links must match actual Expo routes.
- Logged-out deep links must preserve their requested destination.

### NOTIF-05 — custom scheme and HTTPS links

Test `c1rcle://` and approved `https://thec1rcle.com`/API links for:

- Event, ticket/order, claim, transfer, profile, chat and notification destinations.
- App installed/not installed.
- Cold/background/foreground.
- Signed out/login return and wrong account.
- Malformed/expired resource.
- Android App Links verification and browser fallback.

---

## 22. Safety, scanner, guest list, door entry, walk-ins, statistics, and cover charge

### SAFE-01 — `/safety`

Elements:

- Up to three emergency contacts: add/edit/remove/save.
- Location permission/start/stop share.
- External ride app.
- SOS confirmation/action.

Tests:

- Contact validation: empty, duplicates, international, invalid/long values; process kill during save.
- Location denied/permanent denied/GPS off/poor accuracy/no fix; start/update/stop/four-hour expiry and authorized recipient.
- Background/restart state restoration and continuous update proof.
- Stop failure and access revocation.
- Ride app installed/absent/fallback.
- SOS with sandbox recipients only: cancel, no location, no contacts, backend failure, SMS composer cancel/success.
- Never report contacts as notified unless a real approved delivery was proven.
- Accidental-tap prevention, TalkBack and safe copy.

### SCAN-01 — `/scanner` operator code/session

Elements: event/operator code, authenticate/register, loading/error, mode routing, exit/back.

Tests:

- Valid/invalid/expired/revoked code; whitespace/case/Unicode/long input.
- Every operator permission combination and no permission.
- Device registration, heartbeat, mid-session revoke, session persist/expire/process death.
- Direct subroute hydration race, same code on two devices, exit/clear.
- Release/preview build only for acceptance: development mock registration/auth/random scans cannot count as passes.

### SCAN-02 — `/scanner/scan`

Elements: camera permission, camera view, torch, scan verdict, couple/partner flow, deny/continue/dismiss.

Tests:

- Permission allow/deny/permanent deny; torch; dim/tiny/moving/damaged/multiple QR.
- Valid, wrong-event, used, transferred, refunded, revoked, claimed, expired and capacity-exceeded ticket.
- Signed JWT, raw ticket ID, booking code, malformed/tampered/copied/replayed QR.
- Same QR twice on one scanner and concurrently on two scanners.
- Offline/timeout/retry ambiguity and session revoke mid-camera.
- Quantity/couple ticket with partner present/absent.
- Confirm server processing order: a local partner denial must not leave an already-consumed ticket.
- Deny Entry must either reverse state or clearly preserve/audit it according to policy.
- Compare UI verdict with ticket, check-in and scan-audit records.

### SCAN-03 — `/scanner/door-entry`

- Every tier/payment type, sold-out/capacity edge, name/phone/quantity validation.
- Quantity 0/1/large and explicit upper bound.
- Double submit, timeout/retry with idempotency, concurrent operators and process kill after commit.
- Revenue/stats/guest-list reconciliation and generated QR scan/replay/wrong-event behavior.

### SCAN-04 — `/scanner/guestlist`

- Empty/one/1,000+; search case/Unicode/partial; status filters/counts; pull refresh.
- Manual check-in discoverability, TalkBack and race with QR scan.
- Already entered, session revoke, API error versus empty.
- Verify entity ID contract and large-list performance.

### SCAN-05 — `/scanner/stats`

- Initial/30-second/pull refresh timing; zero/over capacity and percent clamping.
- Concurrent scans, tier/source totals and currency units.
- Background polling suspend/resume, session expiry, offline stale label and 60-minute resource soak.

### SCAN-06 — `/scanner/walk-ins`

- Name whitespace/Unicode, age 0/18/120/121, phone validation.
- Double tap/concurrent operators/timeout retry and duplicate prevention.
- Capacity/gate policy, recent list 50 boundary, phone privacy.
- Guest-list/stats/revenue reconciliation.
- Development simulated success cannot count as production proof.

### SCAN-07 — `/scanner/cover-charge`

Elements: QR/wallet lookup, preset selection, balance/charge confirmation, result/back.

Tests:

- Valid/expired/terminated/wrong-event/wrong-venue/malformed/replayed wallet QR.
- Exact/insufficient/large balance; every/no preset; rounding/min/max.
- Double tap, two-operator concurrent charge, timeout/retry idempotency.
- Network lost after screen entry, process kill mid-charge and reconciliation.
- Session/permission revoke.
- Verify multi-permission operator can reach charge mode.

### SCAN-08 — `CoverDeductionOverlay` and scanner dead/alternate paths

- Determine runtime reachability.
- If reachable, test custom amount, paise/rupee labeling, validation, idempotency and financial reconciliation separately.
- If unused, report as dead alternate financial implementation and do not count it toward cover-charge coverage.

---

## 23. Complete route registry and required disposition

Every route in this table must end the exercise with a status, evidence link, and classification. Layout files are validated through their child routes and shell cases.

| Route | Intended classification | Owning cases |
|---|---|---|
| `/` | PRIMARY coordinator | AUTH-00 |
| `/(auth)/login` | PRIMARY | AUTH-01 |
| `/(auth)/forgot-password` | SECONDARY | AUTH-02 |
| `/(auth)/otp` | PRIMARY/SECONDARY | AUTH-03 |
| `/(auth)/signup` | SECONDARY/legacy candidate | AUTH-04 |
| `/(auth)/phone` | ORPHAN/duplicate candidate | AUTH-05 |
| `/verify` | DEEP LINK | AUTH-06 |
| `/add-contact` | PRIMARY first-run | AUTH-07 |
| `/profile-setup` | PRIMARY first-run | AUTH-08 |
| `/onboarding` | PRIMARY first-run | AUTH-09 |
| `/permission` | PRIMARY first-run | AUTH-10 |
| `/notification-permission` | LEGACY candidate | AUTH-11 |
| `/location-permission` | LEGACY candidate | AUTH-12 |
| `/(tabs)/explore` | PRIMARY tab | DISC-01 |
| `/events/feed` | SECONDARY | DISC-02 |
| `/(tabs)/feed` | HIDDEN TAB/ALIAS | DISC-02 |
| `/(tabs)/venues` | PRIMARY tab | DISC-03 |
| `/search` | SECONDARY | DISC-04 |
| `/map` | SECONDARY | DISC-05 |
| `/explore/map` | ALIAS | DISC-05 |
| `/event/[id]` | SECONDARY/DEEP LINK | DISC-06 |
| `/event/[id]/map` | SECONDARY/DEEP LINK | DISC-07 |
| `/venue/[id]` | SECONDARY/DEEP LINK | DISC-08 |
| `/waitlist/[eventId]` | SECONDARY/DEEP LINK | DISC-09 |
| `/checkout/[eventId]` | PRIMARY commerce | COM-01 |
| `/checkout` | PRIMARY commerce | COM-02/03 |
| `/checkout/success` | PRIMARY commerce | COM-04 |
| `/(tabs)/tickets` | PRIMARY tab | COM-05 |
| `/ticket/[id]` | SECONDARY/DEEP LINK | COM-06 |
| `/transfer` | SECONDARY | COM-07 |
| `/transfer/[token]` | DEEP LINK | COM-08/10 |
| `/claim/[token]` | ALIAS/DEEP LINK | COM-08/09 |
| `/tickets/claim/[token]` | ALIAS/DEEP LINK | COM-08/09 |
| `/going/[orderId]` | LEGACY redirect/DEEP LINK | COM-11 |
| `/(tabs)/social` | PRIMARY tab/ALIAS | SOC-01 |
| `/(tabs)/dating` | HIDDEN duplicate candidate | SOC-01 |
| `/dating/[id]` | SECONDARY/DEEP LINK | SOC-02 |
| `/social/matches` | SECONDARY | SOC-03 |
| `/social/profile/[id]` | SECONDARY/DEEP LINK | SOC-04 |
| `/social/attendees` | SECONDARY/role-entitled | SOC-05 |
| `/social/contacts` | SECONDARY | SOC-06 |
| `/social/report` | SECONDARY | SOC-07 |
| `/(tabs)/inbox` | PRIMARY tab | CHAT-01 |
| `/chat/[id]` | LEGACY redirect/DEEP LINK | CHAT-02 |
| `/social/group/[eventId]` | SECONDARY/DEEP LINK/entitled | CHAT-03 |
| `/social/dm/[id]` | SECONDARY/DEEP LINK | CHAT-04 |
| `/social/requests` | SECONDARY | CHAT-05 |
| `/social/gallery/[eventId]` | SECONDARY/DEEP LINK/entitled | CHAT-06 |
| `/notifications` | SECONDARY/DEEP LINK | NOTIF-01–05 |
| `/social-setup` | SECONDARY/first-run feature | PROFILE-01 |
| `/social-setup/photos` | SECONDARY | PROFILE-02 |
| `/social-setup/preferences` | SECONDARY | PROFILE-03 |
| `/social-setup/review` | SECONDARY | PROFILE-04 |
| `/(tabs)/profile` | HIDDEN TAB/SECONDARY | PROFILE-05 |
| `/profile/edit` | SECONDARY | PROFILE-06 |
| `/profile-creation` | SECONDARY/duplicate profile system | PROFILE-07 |
| `/settings` | SECONDARY | SETTINGS-01 |
| `/settings/account` | SECONDARY/destructive | SETTINGS-02 |
| `/settings/notifications` | SECONDARY | SETTINGS-03 |
| `/settings/alert-preferences` | SECONDARY | SETTINGS-04 |
| `/settings/permissions` | SECONDARY | SETTINGS-05 |
| `/settings/appearance` | SECONDARY | SETTINGS-06 |
| `/settings/payment` | ORPHAN/placeholder candidate | SETTINGS-07 |
| `/help` | ORPHAN candidate | SUPPORT-01 |
| `/legal/terms` | ORPHAN/direct candidate | LEGAL-01 |
| `/legal/refunds` | ORPHAN/direct candidate | LEGAL-01 |
| `/legal/guidelines` | ORPHAN/direct candidate | LEGAL-01 |
| `/legal/safety` | ORPHAN/direct candidate | LEGAL-01 |
| `/legal/privacy` | ORPHAN/direct/external | LEGAL-02 |
| `/verification` | ORPHAN/incomplete candidate | VERIFY-01 |
| `/safety` | SECONDARY | SAFE-01 |
| `/scanner` | ROLE GATED | SCAN-01 |
| `/scanner/scan` | ROLE GATED | SCAN-02 |
| `/scanner/door-entry` | ROLE GATED | SCAN-03 |
| `/scanner/guestlist` | ROLE GATED | SCAN-04 |
| `/scanner/stats` | ROLE GATED | SCAN-05 |
| `/scanner/walk-ins` | ROLE GATED | SCAN-06 |
| `/scanner/cover-charge` | ROLE GATED/financial | SCAN-07/08 |

### 23.1 Layout verification

- `app/_layout.tsx`: SHELL-01.
- `app/(auth)/_layout.tsx`: auth transitions, background video/safe areas and child Back behavior.
- `app/(tabs)/_layout.tsx`: SHELL-02.
- `app/checkout/_layout.tsx`: tier -> checkout -> success Back/gesture transitions.
- `app/chat/_layout.tsx`: legacy redirect transition.
- `app/social/_layout.tsx`: profile/chat/gallery/request transitions.
- `app/social-setup/_layout.tsx`: 1/3 -> 2/3 -> 3/3 progress/back/process death.
- `app/transfer/_layout.tsx`: code/link/claim Back behavior.
- `app/going/_layout.tsx`: legacy redirect.
- `app/safety/_layout.tsx`: safety Back/system handoff.
- `app/scanner/_layout.tsx`: session hydration/role gate for every child.
- `app/verification/_layout.tsx`: verification Back/direct route.

---

## 24. Shared functions, stores, services, and integrations

Screen rendering does not prove these shared functions. Each row requires a dedicated runtime assertion.

| System | Runtime QA obligation |
|---|---|
| API base/auth token/401 retry | Correct environment and device reachability; attach current Firebase token; refresh once; no retry loop; meaningful 4xx/5xx/timeout errors. |
| Auth store/server handshake | No authenticated app state before server sync; bounded retry; foreground token refresh; logout clears every dependent store and socket. |
| Profile store | User-scoped load/cache; canonical gateway update; optimistic rollback; no cross-account flash; refresh genuinely refetches. |
| Onboarding flags | UID scoping, legacy-key migration, corrupt storage and server/local conflict. |
| Permissions helper | Prompt count, seven-day window, granted override, account scoping and settings recovery. |
| Events store | Real versus showcase data, filters, cache, normalization, refresh, pagination, stale response and missing entities. |
| Venue/venue-page stores | API/Firestore source truth, slug/ID, follow count, partial payload, cache and account isolation. |
| Event-interest store | RSVP/interested/auth gate, double tap, rollback, chat join and two-account list propagation. |
| Follow store | Venue/host follow/unfollow, guest gate, server truth, optimistic rollback and account switch. |
| Cart store | Persistence/hydration, one-event policy, quantity/promo, reservation invalidation, expiry and logout/account switch. |
| Payment service | Auth, reserve, initiate, native provider, verify, idempotency, free order, interruption and ticket refresh. |
| Inventory helpers | Authoritative remaining quantity, sold-out changes and no client trust. |
| Tickets store | Real wallet normalization, single-flight refresh, error keeps safe state, user-scoped clear. |
| Share/transfer helpers | Preview/create/accept/cancel/revoke/reclaim, token safety, exact slot and two-account convergence. |
| Wallet/PDF/calendar | Authenticated file, cache, share, Google/Apple platform behavior, unavailable fallback and correct event time. |
| Notifications store/helper | Fetch/poll/read/clear/badge, token registration/refresh, payload routing, account/device lifecycle. |
| Deep-link parser/router | Custom/HTTPS, cold/warm, aliases, validation, auth return and unknown route. |
| Chat store/WebSocket | Initial fetch, page cursors, existing/new row updates, reconnect, token change, read/unread and polling fallback. |
| Group/DM/typing services | Entitlement, request state, optimistic IDs, ordering, pagination, rate limit, typing expiry and blocked access. |
| Chat image picker/media | Permissions, compression, file limits, upload progress/retry/cancel, orphan cleanup and moderation. |
| Dating store/swipe hooks | Feed pagination/dedupe, daily limits, optimistic remove/rollback, match result and process-death reconciliation. |
| Social profile store | Setup/read/update/visibility/verification, nested versus flat data and account isolation. |
| Subscription store/RevenueCat | Free/premium limits, timezone reset, offering, purchase/restore/expiry/refund and server sync. |
| Settings store | Local/server canonical state, optimistic rollback, global cache leakage and actual product behavior. |
| Safety service | Contacts, location session, periodic updates, expiry/stop, SOS, authorization and truthful feedback. |
| Scanner store/API | Device registration, auth/session/heartbeat, release-only behavior, idempotency, role/event/device binding and audit records. |
| Offline cache | Fresh/stale/no-cache behavior, stale-while-revalidate, user data isolation, offline banner and reconnect. |
| Query provider | Retry/cache defaults, auth switch invalidation, background refetch and duplicate request control. |
| Analytics | Screen/action/error events exactly once, correct user identity/reset, no PII, production provider delivery and app lifecycle flush. |
| Sentry/Error boundary | DSN/environment/release, source mapping, user reset, controlled error, offline queue and no sensitive context. |
| Spotify/iTunes | OAuth callback, account linking, token expiry/disconnect, search debounce/provider failure, preview/external handoff. |
| App updates | Correct runtime/version, update download/startup, fallback to embedded build and no state corruption. |

### 24.1 Analytics event proof

At minimum verify exactly-once events for screen views; auth start/success/failure; event view/share/save; search; checkout start/failure/success; QR open; share/transfer; chat join/send/report; dating like/pass/match/paywall; notification open; profile update; SOS; scanner verdict. Confirm logout resets identity before User B begins.

### 24.2 Monitoring proof

- Force one controlled non-sensitive JavaScript error and one handled API failure in staging.
- Confirm environment, app version, route/action context and anonymized user identity in Sentry/monitoring.
- Confirm caught business validation errors do not flood crash monitoring.
- Confirm production UI never displays stack traces, tokens or internal response bodies.

---

## 25. Execution phases and stop conditions

### Phase 0 — Freeze, safety, and environment

- [ ] Record build/environment/device/account/data identity.
- [ ] Disable or document demo/showcase behavior.
- [ ] Establish artifact directory, issue ledger and mutation ledger.
- [ ] Approve staging-only destructive operations and production smoke boundary.

Acceptance: every later result can be traced to one immutable build and known fixture.

### Phase 1 — Preflight and blocker smoke

- [ ] USB/ADB, launch, API health, Firebase/server sync, second device, logs and screen capture.
- [ ] Login User A/B, open Explore, one real event, one wallet fetch and one operator session.

Acceptance: no infrastructure ambiguity that would invalidate the run.

### Phase 2 — Fresh install and first-run

- [ ] AUTH-00 through AUTH-12 plus guest and returning-user variants.
- [ ] Kill/relaunch at every checkpoint and verify account isolation.

Acceptance: all supported auth providers/checkpoints have evidence or explicit platform/blocker status.

### Phase 3 — Discovery and venue exploration

- [ ] DISC-01 through DISC-09.
- [ ] Online, cached, offline, filters, deep links, maps and waitlist.

Acceptance: every event/venue/search/map action has real-data and state evidence.

### Phase 4 — Commerce and wallet

- [ ] COM-01 through COM-12.
- [ ] Free, paid, interrupted, recovered, shared, claimed, transferred, wallet and external integrations.

Acceptance: payment and ownership mutations reconcile exactly once across server and both devices.

### Phase 5 — Nightlife, social, and chat

- [ ] PROFILE-01 through PROFILE-07, SOC-01 through SOC-07, CHAT-01 through CHAT-06.
- [ ] Two-account realtime, moderation, privacy and entitlement cases.

Acceptance: no demo/local-only behavior is counted as a production pass.

### Phase 6 — Notifications, settings, legal, safety

- [ ] NOTIF-01 through NOTIF-05, SETTINGS-01 through SETTINGS-07, SUPPORT/LEGAL/VERIFY, SAFE-01.

Acceptance: real OS/provider delivery and external handoffs are proven; policy claims match behavior.

### Phase 7 — Event operations

- [ ] SCAN-01 through SCAN-08 on release/preview build.
- [ ] Two-operator races, QR lifecycle, guest list, door, walk-ins, stats and cover charge.

Acceptance: UI, ticket/wallet state, audit record and financial/statistics state agree.

### Phase 8 — Cross-cutting stress and accessibility

- [ ] Network/lifecycle matrix, performance loops, memory/battery soaks, TalkBack, font scale, small screen and Android navigation modes.

Acceptance: all core routes meet reliability bar or have measured findings.

### Phase 9 — Production read-mostly smoke

- [ ] Only after staging results are understood.
- [ ] Fresh launch/login, public discovery, event detail, safe wallet read, push/app-link smoke and monitoring visibility.
- [ ] No unapproved real-money, safety, deletion, scanner, ticket-ownership or customer-data mutations.

### Phase 10 — Audit synthesis

- [ ] Deduplicate issues, calculate coverage, attach evidence, mark untested risks and produce launch verdict.

### Stop conditions

The audit does not stop completely when it finds a bug. It pauses only the affected destructive/dependent branch when:

- Payment or ticket ownership becomes ambiguous.
- A test risks real customer data, money, safety contact, or production inventory.
- Auth/session isolation is broken.
- Scanner or cover charge mutates the wrong fixture.
- Device/build/environment identity becomes uncertain.

Agents preserve evidence and continue independent safe areas. No agent fixes the issue during the audit.

---

## 26. Mutation and cleanup ledger

Track every write:

| Field | Required value |
|---|---|
| Case ID and timestamp | Exact originating action |
| Actor/device | A, B, operator and serial |
| Entity | user/event/order/reservation/ticket/share/transfer/chat/message/report/scan/wallet |
| Before state | Known authoritative value |
| Mutation ID | Redacted but traceable backend identifier |
| Expected after state | Acceptance value |
| Actual after state | Server and both-device evidence |
| Cleanup | action, owner, timestamp and final state |

Cleanup includes cancelling unused reservations/transfers/shares, resetting QA inventory, removing test messages/media/reports where policy permits, ending location sessions, invalidating scanner sessions/device records when intended, removing test notification tokens, and deleting disposable accounts only after deletion cases are complete.

---

## 27. Final audit report structure

### 27.1 Executive result

- Build/environment/devices tested.
- `GO`, `CONDITIONAL GO`, or `NO-GO`.
- Top launch blockers.
- Core workflows proven.
- Unproven areas/platforms.

### 27.2 Coverage scorecard

| Domain | Passed | Failed | Partial | Blocked | Not run | Coverage note |
|---|---:|---:|---:|---:|---:|---|
| Boot/auth/first-run | | | | | | |
| Explore/search/maps/venues | | | | | | |
| Checkout/payments | | | | | | |
| Tickets/share/claim/transfer | | | | | | |
| Nightlife/dating/social | | | | | | |
| Inbox/chat/gallery | | | | | | |
| Notifications/deep links | | | | | | |
| Profile/settings/legal | | | | | | |
| Safety | | | | | | |
| Scanner/event operations | | | | | | |
| Performance/resilience | | | | | | |
| Accessibility/UI | | | | | | |

### 27.3 Findings

Grouped by P0/P1/P2/P3/Optimization, with complete issue format and evidence.

### 27.4 What works well

Record clean workflows, strong recovery, fast screens, consistent UI, helpful copy, good accessibility and reliable state synchronization. A pass must cite the tested fixture and evidence.

### 27.5 Performance scorecard

- Cold/warm startup.
- Each primary screen first useful content.
- Search/filter/map.
- Checkout phases and wallet convergence.
- Chat send/receive and inbox refresh.
- Scanner verdict.
- Frame/jank, memory, CPU, battery/network soak.

### 27.6 UI/UX scorecard

Score each primary/secondary screen for visual consistency, hierarchy, clarity, state design, touch quality, motion, keyboard/safe area, accessibility, and perceived performance. Include `Good`, `Needs polish`, and `Bad/blocking` examples with screenshots.

### 27.7 Data-integrity and security section

- Cross-account isolation.
- Exactly-once writes and idempotency.
- Authorization/role/entitlement boundaries.
- Payment/ticket/QR lifecycle.
- Privacy, blocking/reporting/deletion and token handling.

### 27.8 Unreachable, duplicate, mock, placeholder, and unproven surfaces

List every route/system in these categories. Do not merge them into “pass.”

### 27.9 Recommended direction

Recommendations may describe priority, user impact, acceptance criteria and likely ownership. They must not include or apply fixes during this exercise.

### 27.10 Evidence index

Map every case and issue to video, screenshots, logs, timings, backend IDs and device/account context.

---

## 28. Final done state

The manual QA exercise is complete only when:

1. [ ] Every route in Section 23 has a disposition and evidence.
2. [ ] Every visible button, input, chip, card, tab, modal, sheet, switch, external link and system prompt on reachable screens has been exercised.
3. [ ] Every primary workflow and E2E journey has passed, failed, or been explicitly blocked with evidence.
4. [ ] User A and User B state convergence is proven for chat, match, purchase, share, claim, transfer, block/report and notifications.
5. [ ] Operator races and QR/wallet lifecycle are proven with release-build backend responses.
6. [ ] No development mock/demo response is counted as production proof.
7. [ ] Startup, primary-route loading, scrolling, memory, battery/network, chat and scanner performance are measured.
8. [ ] Offline, slow network, session expiry, background, process death and relaunch recovery are covered for core workflows.
9. [ ] Android Back, permissions, App Links, notification channels, TalkBack, font scale and small-screen behavior are covered.
10. [ ] Every mutation is reconciled and cleanup is complete.
11. [ ] The audit report separates confirmed working behavior, defects, optimization opportunities, UI quality, inaccessible/dead code and unproven dependencies.
12. [ ] The verdict clearly states that iOS remains unproven unless a separate physical-iOS phase is completed.
13. [ ] No source or production fix was made during the audit.

Final deliverables:

- `MOBILE_MANUAL_QA_AUDIT_REPORT.md`
- `MOBILE_MANUAL_QA_ISSUE_LEDGER.csv`
- `MOBILE_MANUAL_QA_COVERAGE_MATRIX.csv`
- `MOBILE_MANUAL_QA_PERFORMANCE.csv`
- `MOBILE_MANUAL_QA_MUTATION_LEDGER.csv`
- Sanitized screenshots, recordings, logs and evidence index.
---
