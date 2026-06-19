# THE C1RCLE Mobile App Zero-To-Production Launch Checklist

Last audited: 2026-06-19
Audit root: `/Users/aayushdivase/Desktop/thec1rcle/thec1rcle`
Primary app: `apps/mobile-app`
Primary backend: `apps/api-gateway`
Shared logic: `packages/core`

This document is the production launch source of truth for THE C1RCLE mobile app. It is intentionally codebase-grounded. It does not treat a screen, helper, route, or library as production-ready unless it is wired into the real user flow, has the required config, and has a verification path.

## 1. To do

1. [ ] Remove and rotate exposed mobile environment secrets.
   Acceptance: mobile `.env*` files contain no Admin SDK private keys, service account emails, server secrets, or secret-looking values under `EXPO_PUBLIC_*`; any exposed Firebase/Admin/API credentials are rotated; only safe public client config remains.
2. [ ] Prove release builds cannot render demo/mock datasets.
   Acceptance: release builds cannot render `DEMO_EVENTS`, `DEMO_VENUES`, `DEMO_ORDERS`, `DEMO_PRIVATE_CHATS`, `DEMO_EVENT_CHATS`, `DEMO_DM_MESSAGES`, `DEMO_CHAT_MESSAGES`, `MOCK_PROFILES`, or scanner mock fallbacks.
3. [ ] Verify APNs/FCM/EAS push credentials.
   Acceptance: production/preview EAS credentials are configured, Expo push receipts are observable, and iOS/Android push delivery is verified on physical devices.
4. [ ] Verify checkout and ticket issuance on real devices.
   Acceptance: reserve -> calculate -> initiate -> Razorpay native -> verify -> ticket issuance -> QR render -> scanner validation passes on iOS and Android using staging and production-like data.
5. [ ] Replace demo inbox and remaining chat surfaces with real production data.
   Acceptance: profile deck, like/pass, match list, DM list, event chat list, unread badges, typing, media messages, blocking, reporting, and eligibility all work without demo data.
6. [ ] Complete release hardening.
   Acceptance: Expo SDK drift is resolved; `expo-doctor`, type-check, lint, targeted tests, EAS production build, app icons/splash, privacy disclosures, store screenshots, review notes, account deletion, and legal URLs are complete.

## 2. In progress

1. [ ] Backend API surface exists, but mobile consumption is inconsistent.
   Acceptance: every `apps/mobile-app/lib/api.ts` helper is mapped to one or more production screens and covered by contract tests or screen-level smoke.
2. [ ] Checkout and wallet are partially backend-authoritative.
   Acceptance: stale pending payment recovery, duplicate-payment handling, failed/cancelled payment recovery, refund state, cancelled state, checked-in state, used-ticket state, offline ticket state, and scanner proof are verified.
3. [ ] Social/chat helper layer is partially gateway-backed.
   Acceptance: polling helpers either become websocket/realtime or have explicit launch SLOs; assumed route contracts are smoke-tested against the gateway.
4. [ ] Crash/error/analytics foundations exist.
   Acceptance: Sentry DSN/release/source maps and analytics destination are configured in EAS, privacy reviewed, and visible in the production dashboards.
5. [ ] Permission and device registration flows are partially complete.
   Acceptance: notification token generation uses the EAS project ID lookup recommended by Expo SDK 56, a dedicated `/api/v1/users/me/device-token` route exists, and token refresh runs after auth and foreground resume; physical APNs/FCM/EAS credential proof remains open.
6. [ ] Media upload/moderation ownership remains partial.
   Acceptance: profile and verification image uploads are routed through a server media service or explicitly approved Firebase Storage rules/moderation policy before public launch.

## 3. Done

1. [x] ~~Expo Router mobile app exists with auth, onboarding, Explore, event detail, checkout, tickets, profile, settings, social, chat, scanner, legal, safety, and permission screens.~~
2. [x] ~~Firebase email/password, Google, Apple, and phone auth helpers exist.~~
3. [x] ~~Mobile API wrapper attaches Firebase tokens and retries once after HTTP 401.~~
4. [x] ~~Checkout helpers exist for reserve, calculate, initiate, verify, cancel, and promo validation.~~
5. [x] ~~Ticket wallet helpers exist for wallet orders, transfers, share bundles, claims, QR rendering, PDF fallback, and pass-generation hooks.~~
6. [x] ~~Backend routes exist for events, search, checkout, payments, orders, tickets, social, matching, profiles, notifications, scanner, users, auth, refunds, and cron.~~
7. [x] ~~Sentry/ErrorBoundary/FlashList foundations are present in the mobile app.~~
8. [x] ~~Firebase auth state now calls `/api/v1/auth/sync`, the server creates/updates a canonical user record, provisions default custom claims, returns a canonical profile/user contract, and the client refreshes claims.~~
9. [x] ~~Mobile profile load/update, venues list/detail, waitlist status/join, dating discover/swipe/matches, event RSVP/attendees, safety emergency contacts, and push-token registration no longer use broad client-side Firestore scans/writes.~~
10. [x] ~~EAS preview and production builds explicitly set `EXPO_PUBLIC_DEMO_MODE=false`.~~
11. [x] ~~Follow state, social/profile verification writes, onboarding profile persistence, and notification reads now use versioned Fastify gateway contracts instead of direct client Firestore paths.~~
12. [x] ~~`apps/mobile-app/scripts/launch-readiness-check.cjs` documents local push/checkout readiness checks and the external physical-device proofs still required.~~

## Executive Launch Decision

Status: NOT READY FOR PUBLIC APP STORE / PLAY STORE RELEASE.

Reason: the repo has a broad mobile product shell and meaningful backend work, but public launch is blocked by security/config issues, demo data exposure risk, media upload/moderation policy, physical APNs/FCM proof, real-device checkout validation, and incomplete social/chat production data wiring.

Recommended release posture:

1. Internal development build: allowed after removing public secret material.
2. Closed alpha: allowed only after demo mode is hard-disabled, auth sync is enforced, and checkout has staged real-device proof.
3. Public beta: blocked until social/chat/wallet/push/legal/store checklist items are complete.
4. Public production: blocked until all launch blockers in this document are closed.

## Audit Method

Reviewed:

- Mobile route tree under `apps/mobile-app/app`.
- Mobile stores under `apps/mobile-app/store`.
- Mobile helpers under `apps/mobile-app/lib` and `apps/mobile-app/hooks`.
- Mobile config in `apps/mobile-app/app.json`, `apps/mobile-app/eas.json`, `apps/mobile-app/package.json`, and env files.
- Backend route registration and route families under `apps/api-gateway/src/app.ts` and `apps/api-gateway/src/routes/v1`.
- Mobile tests under `apps/mobile-app/__tests__`.
- Existing launch checklist stub and prior project memory about Expo drift, checkout verification, and backend contract rules.

Not fully verified in this pass:

- Live Firebase rules behavior.
- Live API responses from deployed production.
- EAS build execution.
- Simulator or physical-device runtime.
- Full `npm run lint`, because prior memory indicates mobile lint can hang.
- Full `npm run type-check` or full test suite, because this pass was an audit/documentation pass.

## Product Surface Inventory

| Surface | App evidence | Backend/API evidence | Current status | Launch decision |
|---|---|---|---|---|
| Splash/app shell | `app/_layout.tsx` | N/A | Built | Keep |
| Email auth | `hooks/useAuth.ts`, `lib/firebase/client.ts`, auth screens | `/api/v1/auth/*`, `/api/v1/auth/sync` via users route | Partially connected | Blocked until sync handshake is enforced |
| Google auth | `loginWithGoogle` | Auth routes exist | Partially connected | Blocked until OAuth config and duplicate linking verified |
| Apple auth | `loginWithApple` | Auth routes exist | Partially connected | Required for iOS launch |
| Phone OTP | `app/(auth)/phone.tsx`, `otp.tsx` | Firebase phone helpers, auth OTP routes also exist | Temporary UI | Needs production UX and Android autofill |
| Profile setup | `profile-setup.tsx`, `lib/firebase/userProfile.ts` | `/users/me`, profile routes | Partially connected | Needs server ownership and media moderation |
| Explore | `app/(tabs)/explore.tsx`, `store/eventsStore.ts` | `/events`, `/events/map`, `/search` | UI built, data mixed | Move to gateway |
| Event details | `app/event/[id].tsx` | `/events/:id`, `/events/:id/tickets` | Partially connected | Needs ticket-tier endpoint wiring proof |
| Checkout | `app/checkout/index.tsx`, `lib/payments.ts`, `store/cartStore.ts` | `/checkout/*`, `/payments/verify` | Strong partial | Needs real-device and recovery proof |
| Ticket wallet | `app/(tabs)/tickets.tsx`, `store/ticketsStore.ts` | `/tickets/my-wallet`, transfer/share routes | Partial | Needs lifecycle, QR, scanner proof |
| Transfers/share | `app/transfer/*`, `app/claim/[token].tsx`, `lib/api.ts` | `/tickets/transfer`, `/tickets/share`, `/tickets/claim/share` | Partial | Needs E2E proof |
| Dating | `app/(tabs)/dating.tsx`, `store/datingStore.ts` | `/matching/*`, `/social/discover`, `/social/matches` | Mostly mock/mixed | Blocked |
| Inbox | `app/(tabs)/inbox.tsx` | `/social/dm/*`, `/social/chat/:eventId` | Mostly demo UI | Blocked |
| DM chat | `app/social/dm/[id].tsx`, `lib/social/privateDM.ts` | `/social/dm/*` | Partial | Needs conversation list, unread, retry |
| Event group chat | `app/chat/[id].tsx`, `app/social/group/[eventId].tsx`, `lib/social/groupChat.ts` | `/social/chat`, `/social/chat/:eventId` | Partial | Needs access rules and push |
| Profile tab | `app/(tabs)/profile.tsx`, `store/profileStore.ts` | `/users/me`, `/profiles/*` | Partially connected | Remove hardcoded display name |
| Settings | `app/settings*`, `store/settingsStore.ts` | `/users/me/settings`, auth/session routes | Mostly local/Firestore | Move to gateway |
| Notifications | `lib/notifications.ts`, `store/notificationsStore.ts` | `/guest-notifications`, `/notifications` | Partial | Needs device-token route and push proof |
| Safety/location | `app/safety`, `lib/safety.ts` | `/social/location/*`, `/social/sos` | Partial | Needs policy, permission, ops proof |
| Scanner | `app/scanner/*`, `lib/scanner/api.ts` | `/api/v1/scan/*`, cover-charge routes | Partial | Needs real QR and staff RBAC proof |
| Wallet passes | `lib/wallet.ts` | `/passes/:platform` backend route exists via guest-passes | Helper/stub mismatch | Needs route alignment and certs |
| Offline | `lib/cache.ts`, `OfflineBanner` | N/A | Partial primitive | Needs product states |
| Analytics | `lib/analytics.ts` | N/A | Helper exists | Needs destination/config/review |
| Crash reporting | `lib/sentry.ts`, `ErrorBoundary` | Sentry backend also configured | Foundation exists | Needs DSN/release/source maps |

## Data Ownership Audit

Launch principle: Fastify routes validate with Zod, protected routes verify Firebase Auth, business logic belongs in `packages/core`, hot reads and checkout locks use Redis, and mobile should not own server truth.

| Data area | Current mobile path | Current backend path | Problem | Launch action |
|---|---|---|---|---|
| Events feed | `store/eventsStore.ts` scans Firestore `events` collection | `/api/v1/events`, `/api/v1/events/map`, `/api/v1/search` | Direct Firestore bypasses cache/rate-limit/contracts | Repoint store to gateway |
| Event detail | `getEventById` reads Firestore doc | `/api/v1/events/:id` | Mixed contract | Repoint detail read |
| Ticket tiers | Event tickets can come from event document/helper | `/api/v1/events/:id/tickets` | Live inventory must be server-authoritative | Use tickets endpoint |
| User profile | `profileStore`, `lib/firebase/userProfile.ts` use gateway profile contracts | `/api/v1/users/me`, `/api/v1/profiles/*` | Media upload policy remains separate | Add media moderation/upload policy |
| Profile setup photos | Firebase Storage direct upload | Gateway upload route and Firebase Storage exist | Direct upload lacks moderation/virus/content policy | Add server/media moderation gate or accepted exception |
| Social profile | `socialProfileStore` uses `/api/v1/users/me` and `/api/v1/users/me/verification` | `/api/v1/social/*`, profile routes | Verification approval still needs review worker/admin path | Add approval/rejection workflow |
| Dating deck | `MOCK_PROFILES` or Firestore orders/users in `datingStore` | `/api/v1/matching/feed`, `/api/v1/social/discover` | Production feed not wired | Use matching/social feed |
| Likes/passes/matches | Firestore `userLikes`, `userPasses`, `userMatches` in store | `/api/v1/matching/swipe`, `/api/v1/social/*` | Client can spoof actions | Move to gateway |
| Notifications | Gateway polling via `store/notificationsStore.ts` | `/api/v1/guest-notifications` | Physical push delivery not yet proven | Verify APNs/FCM/EAS on devices |
| Settings | AsyncStorage + Firestore write | `/api/v1/users/me/settings` | Server settings not canonical | Use gateway as source |
| Venues | Firestore collection scan | `/api/v1/venues`, `/api/v1/venues/:id` | Bypasses API and search contracts | Use gateway |
| Follows | `followStore` uses `/api/v1/users/me/follows`, `/api/v1/follow`, `/api/v1/venues/:venueId/follow` | `/api/v1/follow`, `/api/v1/venues/:venueId/follow` | Legacy follow mirrors may still exist server-side | Keep server migration/backfill tracked |
| Tickets/orders | `ticketsStore` uses `/tickets/my-wallet` | `/api/v1/tickets/my-wallet`, orders routes | Mostly good | Add lifecycle states and tests |
| Checkout | `lib/payments.ts` uses gateway helpers | `/api/v1/checkout/*`, `/api/v1/payments/verify` | Strongest area, but needs device proof | Real-device E2E |
| Chat | Gateway polling helpers plus demo screen state | `/api/v1/social/chat`, `/api/v1/social/dm/*` | Demo UI and polling gaps | Real conversation list/unread/push |
| Scanner | Gateway helpers plus dev mocks | `/api/v1/scan/*` | Mock path risk | Hard-disable mocks in production |

## Onboarding And Auth

### Status Matrix

| Item | Status | Evidence | Launch note |
|---|---|---|---|
| Splash screen | Built | `app/_layout.tsx`, `expo-splash-screen`, `app.json` splash | Keep |
| Auth gateway routing | Built | `app/index.tsx` redirects login/profile/explore | Needs server sync before Explore |
| Email login | Built | `useAuth.login`, `loginWithEmail` | Needs auth sync after success |
| Email signup | Built | `useAuth.signup`, `signupWithEmail` | Needs auth sync and duplicate handling |
| Google sign-in | Built helper | `loginWithGoogle` | Needs OAuth client config and device build proof |
| Apple sign-in | Built helper | `loginWithApple` | Required for iOS if Google exists |
| Phone number UI | Temporary UI | `app/(auth)/phone.tsx` | Not production-grade |
| OTP UI | Temporary UI | `app/(auth)/otp.tsx` | Needs resend/backoff/autofill |
| Firebase auth listener | Built | `store/authStore.ts` | Does profile/notifications/ws, not auth sync |
| Email/password Firebase auth | Built | `lib/firebase/client.ts` | Keep |
| Google Firebase credential exchange | Built helper | `GoogleAuthProvider.credential` | Needs env config |
| Apple Firebase credential exchange | Built helper | `OAuthProvider('apple.com')` | Needs Apple Services setup |
| Firebase phone functions | Built helper | `PhoneAuthProvider` | Expo recaptcha UX is not enough for production |
| Basic profile setup | Built | `profile-setup.tsx` | Needs recovery and moderation |
| DOB collection | Present | Signup/profile setup fields exist | Needs under-18 enforcement |
| Profile photo selection | Built | Image picker | Needs moderation and abuse handling |
| Image compression | Built | `prepareSquareJpeg` | Keep |
| Firebase Storage upload | Built | `uploadUserPhoto` | Security rules/moderation blocker |
| Vibe tag selection | Built | Profile setup | Needs server schema validation |
| Firestore profile save | Built | `saveBasicUserProfile`, `profileStore` | Server should own canonical state |
| API client wrapper | Built | `lib/api.ts` | Keep |
| Firebase token attachment | Built | `apiFetch` | Keep |
| 401 retry | Built | `apiFetch` | Keep |
| Dev API URL detection | Built | `getApiBase` | Keep |
| Production API fallback | Built | `https://api.thec1rcle.com` | Needs env override in EAS |
| Android SMS autofill | Missing | No clear implementation | Required for polish |
| Location education | UI exists | `location-permission.tsx` | Needs journey wiring |
| Notification education | UI exists | `notification-permission.tsx` | Needs token registration |
| Push/FCM token registration | Partial helper | `lib/notifications.ts` | Wrong route and missing root calls |
| Device-token Fastify route | Missing/unclear | No dedicated route found | Required |
| First-login registration handshake | Helper-only | `hooks/useUsers.ts` calls `/auth/sync` | Not root-auth enforced |
| Server-side role provisioning | Backend partial | RBAC and auth routes | Not mobile-launch confirmed |
| Custom claims | Missing/unclear for guest app | Auth/RBAC exists | Must verify claims lifecycle |
| Duplicate identity linking | Missing/unclear | Error handling only | Must handle Apple/Google/email collisions |
| Full onboarding recovery | Missing | No robust state machine | Required |
| Permission denied paths | Partial | Some screens request permissions | Needs productized recovery |
| Under-18 handling | Missing | DOB exists but no enforcement seen | Legal/safety blocker |
| Uploaded profile media moderation | Missing | Direct Storage upload | Safety blocker |

### Auth Launch Blockers

1. [ ] Auth success must call server sync before user enters the app.
2. [ ] Duplicate provider identity linking must be implemented and tested.
3. [ ] DOB/age policy must be enforced server-side.
4. [ ] Profile photo upload must have moderation and removal workflow.
5. [ ] Push token registration must run after auth and route through a dedicated device-token API.
6. [ ] Account deletion must delete or anonymize auth, profile, photos, notifications, social profile, likes, passes, matches, contacts, and device tokens.

### Auth Acceptance Tests

- Email signup creates Firebase user, server user, claims, profile stub, and profile setup state.
- Email login for existing user refreshes server profile and claims.
- Google sign-in for new user creates server user.
- Google sign-in for existing email links or explains the provider conflict.
- Apple sign-in with private relay email works.
- Phone OTP resend, invalid code, expired code, and SMS quota errors are handled.
- Partially completed onboarding resumes at the correct step after app kill.
- Under-18 DOB is rejected or routed to the approved policy state.
- Photo upload failure can retry without corrupting profile state.

## Explore, Discovery, Venues, Hosts

### Status Matrix

| Item | Status | Evidence | Launch note |
|---|---|---|---|
| Real Explore UI | Built | `app/(tabs)/explore.tsx` | UI is rich |
| City selector | Partial | In-memory/city filters | Needs server-backed city data |
| Category filters | Built UI | `CATEGORY_FILTERS`, category routes/screens | Mostly client-side |
| Map view | Built UI | `MapView` in Explore/event/map routes | Needs `/events/map` wiring and Maps config |
| Featured carousel | Built | Explore rails and `featuredEvents` | Data source mixed |
| Event feed | Built | `FlashList` feed | Direct Firestore or demo |
| Search interface | Built | `app/search.tsx`, `searchEvents` helper | Needs route-contract proof |
| Pagination | Missing | `loadMoreEvents` no-op | Required for scale |
| Pull-to-refresh | Built | Explore refresh control | Keep |
| Skeletons | Built | `SkeletonList`, error components | Keep |
| Empty states | Partial | Empty/error primitives | Needs final copy/states |
| Error states | Partial | Error primitives | Needs retry strategy |
| Real API connection | Partial | `lib/api.ts` has helpers; store scans Firestore | Repoint required |
| Event details | Built UI | `app/event/[id].tsx` | Repoint data reads |
| Saved events | Partial/missing | Interest/follow stores | Needs canonical saved event API |
| Venue pages | Built UI | `app/venue/[id].tsx`, venue stores | Direct Firestore |
| Host pages | Partial | HostSheet and backend host routes | Needs mobile route/state |
| Organizer pages | Partial/missing | Backend partner/host routes | Needs product decision |
| Event sharing | Built helper | `lib/deeplinks.ts`, event detail share | Needs universal/app links |
| Deep links | Helper-only | `lib/deeplinks.ts` | Not globally subscribed |
| Interested flow | Partial | `eventInterestStore` writes Firestore | Move to gateway |
| Invite friend | Partial | Share helpers | Needs referral/invite analytics |

### Explore Launch Blockers

1. [ ] Replace Firestore collection scans in `eventsStore` with `/api/v1/events`.
2. [ ] Wire map screen and map preview to `/api/v1/events/map`.
3. [ ] Add cursor or page-based pagination.
4. [ ] Use `/api/v1/events/:id/tickets` for live tier inventory.
5. [ ] Replace venue collection scan with `/api/v1/venues`.
6. [ ] Implement global deep-link subscription and universal/app links.
7. [ ] Add saved/interested endpoint instead of direct Firestore writes.

### Explore Acceptance Tests

- Guest user can browse Explore without auth.
- Auth user receives personalized but cache-safe Explore feed.
- City/category/date filters match backend results.
- Map pins load lightweight payload, not full event payload.
- Event detail loads for valid event ID, invalid ID, deleted event, sold-out event, and past event.
- Search returns events and venues with empty/no-network states.
- Pull-to-refresh does not duplicate events.
- Pagination works across multiple pages without losing filters.

## Commerce And Checkout

### Status Matrix

| Item | Status | Evidence | Launch note |
|---|---|---|---|
| Ticket selection UI | Built/partial | Event detail and checkout screens | Needs live tier rules |
| Ticket-tier rules | Backend exists | `/events/:id/tickets`, pricing/inventory core | Mobile must consume endpoint |
| Quantity selection | Built | Cart store and checkout UI | Needs max/remaining validation |
| Inventory display | Partial | Event ticket data and helper | Must be server-authoritative |
| Reservation countdown | Partial | Cart reservation state | Needs UI/recovery verification |
| Pricing review | Built/partial | `calculatePricing`, checkout UI | Needs fee/tax copy |
| Promo-code UI | Built | Checkout UI and cart store | Covered by unit test |
| Razorpay native integration | Built helper | `react-native-razorpay`, `lib/payments.ts` | Needs real device build |
| Payment callback handling | Built helper | Native SDK response -> verify | Needs failure/resume cases |
| Payment verification | Built helper/backend | `/payments/verify`, `/checkout/verify` backend tests | Mobile currently uses `/payments/verify` |
| Firestore ticket listener | Missing/unclear | Wallet fetches API | Need post-payment polling/refresh |
| Payment failure recovery | Partial | Pending order/reservation state | Needs resume/retry UX |
| Order-pending recovery | Partial | `pendingPaymentOrderId` | Needs screen on app start |
| Duplicate-payment protection | Backend partial | idempotency keys, verification tests | Needs mobile E2E proof |
| Refund flows | Backend exists, mobile incomplete | `refunds.ts`, ticket state partial | User flow missing |
| Cancellation flows | Backend exists, mobile incomplete | orders/refunds routes | User flow missing |
| Rescheduled-event flows | Missing | event changed notifications only | Needs policy |
| Tax invoices | Missing/unclear | No mobile invoice flow | Finance/legal requirement |
| Receipt delivery | Missing/unclear | Notifications/orders exist | Need email/SMS/in-app receipt |
| Payment reconciliation | Backend/admin likely | finance/refund/cover charge routes | Ops flow required |

### Checkout Launch Blockers

1. [ ] Decide canonical mobile verify endpoint: `/api/v1/payments/verify` vs `/api/v1/checkout/verify`.
2. [ ] Ensure client never trusts internal order ID for payment verification.
3. [ ] Real-device Razorpay payment must pass on iOS and Android.
4. [ ] App-kill during Razorpay must recover pending order/reservation.
5. [ ] Failed payment must release inventory or show pending recovery.
6. [ ] Successful payment must issue deterministic tickets once.
7. [ ] Wallet refresh must show issued tickets immediately after success.

### Checkout Acceptance Tests

- Free order confirms without Razorpay.
- Paid order reserves inventory, initiates order, opens Razorpay, verifies signature, clears cart.
- Payment cancelled preserves safe recovery state and does not issue tickets.
- Verification failure does not issue tickets and exposes support-safe copy.
- Duplicate verify does not issue duplicate tickets.
- Reservation expiry blocks checkout and refreshes availability.
- Sold-out tier returns 409 and updates UI.
- Promo code success/failure updates pricing consistently.
- Offline during payment returns to recoverable pending state.

## Ticket Wallet, QR, Transfer, Share

### Status Matrix

| Item | Status | Evidence | Launch note |
|---|---|---|---|
| Wallet UI connected to real orders | Partial | `/tickets/my-wallet` store | Needs lifecycle coverage |
| Upcoming/past states | Built/partial | Tickets/profile history | Needs cancelled/refunded/used |
| Ticket detail view | Built | `QRModal` in tickets screen | Keep but verify |
| Signed QR rendering | Partial | QR code from order payload | Needs server JWT/rotation proof |
| Dynamic/rotating QR | Missing/unclear | `qrExpiresAt`, `qrMode` fields exist | Policy not complete |
| Screen capture protection | Missing | No obvious implementation | Required for fraud reduction |
| Brightness handling | Missing | No obvious implementation | Useful at door |
| Transfer interface | Built/partial | `app/transfer`, API helpers | Needs E2E |
| Transfer acceptance | Built helper | `acceptFormalTransfer` | Needs E2E |
| Transfer cancellation | Built helper | `cancelFormalTransfer` | Needs E2E |
| Share claim flow | Built helper/screen | `claim/[token]`, share helpers | Needs E2E |
| Apple Wallet | Stub/fallback | `generateAppleWalletPass` | Needs cert/pass endpoint |
| Google Wallet | Stub/fallback | `generateGoogleWalletPass` | Needs issuer/JWT endpoint |
| Refund status | Partial/missing | order status type includes refunded | User flow missing |
| Cancelled state | Partial/missing | order status type includes cancelled | UI verification needed |
| Checked-in state | Partial | status type exists | Scanner integration proof needed |
| Used-ticket state | Partial | QR `isUsed` exists | UI/policy missing |
| Offline pass access | Missing/partial | cache helper, no ticket offline state | Required event-day resilience |

### Wallet Launch Blockers

1. [ ] Align wallet pass endpoints with actual backend route prefix.
2. [ ] Confirm QR payload format is signed, scoped, expiry-aware, and scanner-verified.
3. [ ] Add QR refresh/rotation policy or explicitly mark static QR as accepted risk.
4. [ ] Add used/checked-in/cancelled/refunded/expired display states.
5. [ ] Add offline ticket access policy and cached signed QR behavior.
6. [ ] Verify transfer/share claim ownership and fraud controls.

### Wallet Acceptance Tests

- New purchase appears in wallet within 5 seconds after verify.
- QR scans once and then shows used/checked-in state.
- Cancelled/refunded order cannot scan.
- Transfer code preview works without auth; accept requires auth.
- Transfer sender cannot use transferred ticket after acceptance.
- Share bundle claim cannot exceed quantity.
- Offline wallet can show last valid pass without allowing stale fraud.
- Apple/Google wallet fallback is clear if pass generation is unavailable.

## Social, Dating, Matching

### Status Matrix

| Item | Status | Evidence | Launch note |
|---|---|---|---|
| Event-based profile deck | UI/mock | `app/(tabs)/dating.tsx`, `MOCK_PROFILES` | Not launch-ready |
| Like API | Backend exists | `/matching/swipe`, social routes | Mobile store writes Firestore |
| Pass API | Backend exists | `/matching/swipe` likely | Mobile store writes Firestore |
| Match API | Backend exists | `/matching/*`, `/social/matches` | Mobile not fully wired |
| Match list API | Backend exists | `/social/matches` | Inbox uses demo matches |
| Dating eligibility rules | Partial | `entitlements.ts`, social profile state | Need server policy |
| Ticket-based access | Partial | `social/entitlement/:eventId` | Needs mobile enforcement |
| Event-based pool | Partial | Dating store scans orders/users | Move to backend feed |
| Free-like limits | Missing/unclear | No mobile enforcement found | Needed if monetized |
| Premium limits | Missing/unclear | `isPremium`, social profile fields | Need monetization policy |
| Match screen | Built/partial | social/matches, inbox sections | Needs real data |
| Match notifications | Partial | notification types | Push/in-app wiring incomplete |
| Profile reporting | Built helper | `reportUser` | Needs UI coverage and ops queue |
| Profile blocking | Built helper | `blockUser`, `/social/block` | Needs settings/blocked list |
| Unmatching | Missing/unclear | No clear flow | Required |
| Safety controls | Partial | moderation helpers | Need policies and review tools |
| Check-in messaging rules | Partial/missing | entitlement helper | Need final server rules |

### Dating Launch Blockers

1. [ ] Replace `MOCK_PROFILES` dating tab with `/api/v1/matching/feed` or `/api/v1/social/discover`.
2. [ ] Move like/pass/match creation out of Firestore client writes.
3. [ ] Define dating eligibility: age, ticket, event phase, verification, block status, gender/preferences, premium/free limits.
4. [ ] Add report/block/unmatch UI and backend ops queue.
5. [ ] Add match notification and unread handling.
6. [ ] Decide if dating is in launch v1 or feature-flagged after launch.

### Dating Acceptance Tests

- User without ticket cannot access event dating pool.
- User with ticket sees only eligible attendees for that event.
- Like/pass actions are idempotent.
- Mutual like creates exactly one match and one DM/conversation path.
- Blocked users never appear in deck, matches, attendees, or chat.
- Report creates moderation record and optionally hides the reported user.
- Under-18 users cannot use dating.
- Deleted or hidden profiles are removed from deck and matches.

## Chat And Messaging

### Status Matrix

| Item | Status | Evidence | Launch note |
|---|---|---|---|
| Conversation list | Demo/partial | `app/(tabs)/inbox.tsx` | Needs real source |
| Match row | Demo/partial | `DEMO_NEW_MATCHES` | Needs real source |
| Chat-room UI | Built | `app/chat/[id].tsx`, DM/group screens | Good foundation |
| Firestore realtime listener | Not used for chat | Gateway polling helpers | Polling launch risk |
| Chat creation endpoint | Partial | `/social/dm/request`, `/social/chat` | Needs screen contract |
| Message write logic | Built helper | `sendDirectMessage`, `sendGroupMessage` | Needs retry/delivery |
| Delivery state | Missing/partial | Message types may have status | UI incomplete |
| Seen state | Missing/partial | No clear flow | Needed for DM polish |
| Unread badge | Demo/partial | demo unread count | Needs server unread |
| Typing state | Built helper | `/social/typing` polling | Needs UX proof |
| Media messages | Partial helper | image send/upload helpers | Needs UI and moderation |
| Message retries | Missing | No durable queue seen | Needed for mobile networks |
| Message reporting | Partial helper | `reportUser`, media report | Needs message-level UI |
| Blocking | Built helper | `/social/block` | Needs inbox filtering proof |
| Event group chats | Partial | group chat helpers/screens | Needs access rules |
| Temporary chat expiration | Partial type logic | phase helpers | Needs server enforcement |
| Push notifications | Partial/missing | notification helpers | Needs push proof |

### Chat Launch Blockers

1. [ ] Replace inbox demo rows with real conversations endpoint.
2. [ ] Implement unread counts server-side and mobile badge rendering.
3. [ ] Add message retry, delivery, and failed states.
4. [ ] Add message report/block from every message and profile.
5. [ ] Enforce event phase and entitlement server-side for group chat.
6. [ ] Decide polling vs websocket/realtime for launch SLO.

### Chat Acceptance Tests

- DM request creates pending conversation and recipient sees request.
- Accepting request opens messaging.
- Declining request blocks message send.
- Blocking user hides/removes conversation and prevents send.
- Group chat only allows eligible event users.
- Expired event chat becomes read-only or unavailable according to policy.
- Unread increments on new message and clears on open.
- Push notification opens exact chat.
- Offline send queues or fails with clear retry.

## Profile And Settings

### Status Matrix

| Item | Status | Evidence | Launch note |
|---|---|---|---|
| Real profile page | Partial | `app/(tabs)/profile.tsx` | Hardcoded display name must be removed |
| Edit profile | Built/partial | `app/profile/edit.tsx` | Needs server canonical save |
| Photo reorder/delete | Partial/missing | social setup photos exist | Need full edit flow |
| Notification settings | UI/store partial | settings screens/store | Move to gateway |
| Privacy settings | UI/store partial | settings store | Move to gateway |
| Social-link handling | Partial | instagram fields | Need validation and privacy |
| Help center | Built screen | `app/help.tsx` | Need final support URL/content |
| Contact support | Partial | settings/help likely | Need support process |
| Legal pages | Built screens | `app/legal/*` | Need final reviewed copy |
| Logout cleanup | Partial | `signOut`, store clear | Need token/device cleanup |
| Account deletion | Partial | settings calls `/api/v1/users/me` DELETE | Need E2E and data deletion policy |
| Data export | Missing | No clear flow | Legal/privacy requirement |
| Session management | Missing/partial | auth session routes backend | Mobile UI missing |
| Device management | Missing | No device-token model UI | Required for push/security |
| Blocked-user management | Missing/partial | helper exists | Settings UI needed |

### Profile Launch Blockers

1. [ ] Remove hardcoded profile display name.
2. [ ] Make `/api/v1/users/me` canonical for profile read/update.
3. [ ] Add server-backed settings and privacy persistence.
4. [ ] Add blocked-user management.
5. [ ] Verify account deletion from auth, Firestore, Storage, social, notifications, tickets policy, and device tokens.
6. [ ] Add data export process or support workflow.

### Profile Acceptance Tests

- Profile page shows signed-in user data, not hardcoded data.
- Edit profile updates backend and returns normalized profile.
- Logout clears local stores, websocket, push token/device session, and navigation state.
- Delete account requires confirmation, removes/anonymizes correct data, signs out, and cannot silently fail.
- Privacy setting changes affect visibility in dating, attendees, profile, and chat.
- Blocked user list loads, unblocks, and filters product surfaces.

## Notifications And Permissions

### Status Matrix

| Item | Status | Evidence | Launch note |
|---|---|---|---|
| Notification education screen | Built UI | `notification-permission.tsx` | Needs onboarding placement |
| Permission request | Built helper | `requestNotificationPermissions` | Physical device only |
| Expo token generation | Built helper | `getExpoPushToken` | Uses env project ID, not app config |
| Token registration | Partial helper | PATCH `/api/v1/profiles` | Needs dedicated route |
| Token refresh | Helper-only | `refreshPushToken` | Not root-wired |
| In-app notifications | Partial | direct Firestore store and guest API | Move to API |
| Badge count | Helper exists | `setBadgeCount` | Needs unread integration |
| Notification tap handling | Helper exists | `addNotificationResponseListener` | Not globally wired |
| Deep link routing | Helper exists | `deeplinks.ts` | Not root-subscribed |
| APNs config | Config required | app plugins/eas only partial | External setup needed |
| FCM config | Config required | Firebase project/app config | External setup needed |

### Notification Launch Blockers

1. [ ] Add `/api/v1/devices` or `/api/v1/users/me/devices` token registration route.
2. [ ] Use EAS project ID from config or env reliably.
3. [ ] Call token refresh after auth and app resume.
4. [ ] Add global notification response listener.
5. [ ] Add payload contract for event, ticket, chat, transfer, refund, safety.
6. [ ] Verify APNs and FCM on physical devices.

### Notification Acceptance Tests

- First sign-in prompts only after education screen.
- Denied permission routes to settings education without breaking app.
- Token registers once and refreshes when changed.
- Token is removed/invalidated on logout or account deletion.
- Event notification opens event detail.
- Ticket notification opens ticket wallet/order.
- DM/group notification opens the exact chat.
- Badge count matches unread state.

## Safety, Trust, Moderation

### Status Matrix

| Item | Status | Evidence | Launch note |
|---|---|---|---|
| Safety center | Built/partial | `app/safety` | Needs operational policy |
| Emergency contacts | Partial | `lib/safety.ts` reads profile/contact data | Needs backend ownership |
| Location permissions | Built helper | `requestLocationPermissions` | Needs education journey |
| Location sharing | Gateway helper | `/social/location/*` | Needs privacy/rate limit proof |
| SOS | Gateway helper | `/social/sos` | Needs ops response process |
| User report | Gateway helper | `/social/report` | Needs moderation queue |
| Media report | Gateway helper | `/social/media/report` style helper | Needs route proof |
| Block user | Gateway helper | `/social/block` | Needs cross-surface enforcement |
| Mute/remove chat | Gateway helper | `/social/mute`, `/remove-from-chat` | Needs admin/moderator role |
| Profile media moderation | Missing | Direct upload | Launch blocker |
| Age policy | Missing/partial | DOB fields | Launch blocker |
| Abuse ops | Missing/unclear | No ops queue verified | Launch blocker for dating/chat |

### Trust And Safety Launch Blockers

1. [ ] Define report categories, severity levels, SLA, and moderation queue owner.
2. [ ] Add profile/photo/social media moderation before public visibility.
3. [ ] Enforce age restrictions and dating restrictions server-side.
4. [ ] Ensure blocks are applied across deck, chat, attendees, contacts, and notifications.
5. [ ] Ensure event group chat moderation roles are RBAC-protected.
6. [ ] Create incident runbooks for harassment, unsafe event, underage user, fake profile, payment fraud, and account takeover.

## Scanner, Door, Event Ops

### Status Matrix

| Item | Status | Evidence | Launch note |
|---|---|---|---|
| Scanner UI | Built | `app/scanner/*` | Good foundation |
| Device registration | Partial | `/api/v1/scan/devices`, scanner helper | Needs physical device proof |
| Staff auth/RBAC | Backend partial | scan/staff/rbac routes | Needs role proof |
| QR validation | Backend exists | `/api/v1/scan` | Needs real issued QR proof |
| Guestlist | Backend/helper exists | `/scan/guestlist` | Needs UI proof |
| Door entry | Backend/helper exists | `/scan/door-entry` | Needs ops proof |
| Walk-ins | Backend/helper exists | `/scan/walk-in` | Needs finance/recon |
| Cover charge | Backend/helper exists | cover-charge routes | Needs no-offline debit proof |
| Offline scan | Missing/blocked | cover-charge says offline debits hard-rejected | Need event-day fallback |
| Staff deny logging | Backend/helper exists | `/scan/staff-deny` | Needs UI proof |

### Scanner Launch Blockers

1. [ ] Staff login/role provisioning must be verified.
2. [ ] Scanner device registration must be verified.
3. [ ] Real wallet QR must validate through scanner.
4. [ ] Re-scan of used QR must show already-used state.
5. [ ] Cancelled/refunded/transferred ticket must fail scan.
6. [ ] Event-day offline/outage fallback must be documented.

## Infrastructure, Release, DevOps

### Status Matrix

| Item | Status | Evidence | Launch note |
|---|---|---|---|
| API rate limiting | Built | `rate-limit` plugin | Keep |
| Stale-while-revalidate cache helper | Built | cache plugin/mobile cache | Needs consistent use |
| Offline experience | Partial | `lib/cache.ts`, OfflineBanner | Missing product states |
| Error boundaries | Built | `ErrorBoundary`, tests | Keep |
| Push notifications | Partial | helpers/config | Needs E2E |
| APNs configuration | Config required | Expo plugin only | External setup |
| Deep linking | Helper-only | `deeplinks.ts`, `scheme` | Needs global subscription |
| Universal Links | Missing/config | Associated domains absent in app.json | Required |
| Android App Links | Missing/config | assetlinks config absent | Required |
| Crash reporting | Partial | `lib/sentry.ts` | Needs DSN/source maps |
| Performance monitoring | Partial/missing | Sentry traces maybe | Needs product decision |
| Logging | Backend built | Pino/Sentry in gateway | Mobile logging policy needed |
| Feature flags | Backend plugin exists | feature flags plugin | Mobile integration unclear |
| Remote config | Missing/unclear | No Firebase Remote Config seen | Useful for rollout |
| EAS build config | Partial | `eas.json` | Missing env secrets |
| Expo SDK alignment | Broken/risky | root Expo 56, app Expo 55 | Resolve |
| Lint/type/test gates | Partial/risky | tests exist; lint hang memory | Fix release gates |

### Release Blockers

1. [ ] Resolve Expo SDK version drift or document accepted exception with `expo-doctor` pass.
2. [ ] Add EAS secret/env configuration for all preview and production values.
3. [ ] Remove public secrets from local env files and git history if committed.
4. [ ] Add release build smoke scripts.
5. [ ] Add universal links and Android App Links.
6. [ ] Configure Sentry releases and source maps.
7. [ ] Create App Store/Play Store metadata, screenshots, privacy labels, data safety form, age rating, and review notes.

## Configuration Checklist

### Mobile Public Environment

Required safe public values:

- `EXPO_PUBLIC_APP_ENV`
- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_RAZORPAY_KEY`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_SENTRY_DSN`
- `EXPO_PUBLIC_SENTRY_DEBUG=false`
- `EXPO_PUBLIC_DEMO_MODE=false`
- `EXPO_PUBLIC_PROJECT_ID` or code change to use `Constants.expoConfig.extra.eas.projectId`

Must never be in Expo public env:

- Firebase Admin private key.
- Firebase Admin client email.
- Razorpay secret key.
- QR signing secret.
- Inngest/event secret.
- Sentry auth token.
- Any server service account credentials.

### EAS / Native Config

Required:

- iOS bundle ID: `com.c1rcle.app`
- Android package: `com.c1rcle.app`
- EAS project ID verified.
- iOS APNs credentials.
- Android FCM credentials.
- Google Sign-In iOS URL scheme replaced from placeholder.
- Google Maps Android API key configured through plugin/native config.
- Associated Domains for universal links.
- Android intent filters and assetlinks for app links.
- Camera/location/photo usage descriptions final.
- App icon, adaptive icon, splash assets final.

## External Approval Checklist

| Service | Required before launch | Status |
|---|---|---|
| Apple Developer | Bundle ID, APNs, Sign in with Apple, Associated Domains, privacy labels, age rating, review submission | Required |
| Google Play Console | Package, app signing, FCM, OAuth client, Data Safety, closed/open testing, review submission | Required |
| Razorpay | Production activation, native SDK readiness, KYC/settlement, webhook secret, refunds, reconciliation | Required |
| Firebase | Production Auth providers, phone auth quota, Storage/Firestore rules, indexes, billing, backups | Required |
| Google Cloud Maps | Android/iOS maps credentials and quota | Required |
| Sentry | Project, DSN, auth token for source maps, release naming, data retention | Required |
| Domain/DNS | `api.thec1rcle.com`, `thec1rcle.com` universal/app link files, support/legal URLs | Required |
| Legal/Privacy | Terms, Privacy, Refund, Safety, account deletion, data export/support process | Required |

## Test And Verification Matrix

### Static Gates

1. [ ] `git diff --check`
2. [ ] `npm run lint -w apps/mobile-app` or fixed equivalent
3. [ ] `npm run type-check -w apps/mobile-app`
4. [ ] `npm test -w apps/mobile-app -- --runInBand --watchman=false`
5. [ ] Targeted API gateway tests for checkout, wallet, profile, notifications, social, scanner
6. [ ] `npx expo-doctor` from `apps/mobile-app`
7. [ ] `npx expo config --type public` from `apps/mobile-app`
8. [ ] EAS preview build iOS
9. [ ] EAS preview build Android
10. [ ] EAS production build dry run or production build when ready

### Manual Device Gates

1. [ ] iOS fresh install signup email.
2. [ ] iOS Google sign-in.
3. [ ] iOS Apple sign-in.
4. [ ] iOS phone OTP.
5. [ ] Android fresh install signup email.
6. [ ] Android Google sign-in.
7. [ ] Android phone OTP with autofill.
8. [ ] First-login profile setup with photo upload.
9. [ ] Permission education and deny/allow paths.
10. [ ] Explore feed, search, map, event detail.
11. [ ] Checkout paid ticket with Razorpay.
12. [ ] App kill during payment and recovery.
13. [ ] Ticket wallet QR render.
14. [ ] Scanner validates issued QR.
15. [ ] Transfer/share/claim ticket.
16. [ ] Push notification token registration and tap routing.
17. [ ] Dating/match/chat real data flow if included in launch.
18. [ ] Account deletion and re-login behavior.

### Backend Contract Gates

1. [ ] `/api/v1/auth/sync` creates/updates mobile user.
2. [ ] `/api/v1/events` returns guest-safe feed with filters and pagination.
3. [ ] `/api/v1/events/map` returns pin-only payload.
4. [ ] `/api/v1/events/:id/tickets` returns live tiers and remaining inventory.
5. [ ] `/api/v1/checkout/reserve` locks inventory.
6. [ ] `/api/v1/checkout/initiate` creates server order.
7. [ ] `/api/v1/payments/verify` or `/api/v1/checkout/verify` verifies without trusting client order IDs.
8. [ ] `/api/v1/tickets/my-wallet` returns lifecycle states.
9. [ ] `/api/v1/tickets/transfer` create/accept/cancel works.
10. [ ] `/api/v1/tickets/share` create/reclaim/cancel works.
11. [ ] `/api/v1/guest-notifications` count/list/mark-read works.
12. [ ] `/api/v1/social/dm/*` request/send/list works.
13. [ ] `/api/v1/social/chat/*` event group chat works.
14. [ ] `/api/v1/social/report`, block, mute, remove work.
15. [ ] `/api/v1/scan` validates real QR and rejects used/cancelled/refunded tickets.

## Prioritized Implementation Roadmap

### Phase 0: Security Stop-The-Line

1. [ ] Remove Admin SDK/private key material from mobile env files.
2. [ ] Rotate exposed credentials.
3. [ ] Confirm `.gitignore` and EAS secret usage prevent recurrence.
4. [ ] Add CI/secret scan for public Expo env misuse.

Done state: no known secret material can be bundled into a mobile app or remain valid after exposure.

### Phase 1: Release Configuration And Build Health

1. [ ] Resolve Expo SDK drift.
2. [ ] Fix lint hang.
3. [ ] Populate EAS preview/production envs.
4. [ ] Configure Sentry, Google Sign-In, Razorpay public key, Maps, APNs, FCM.
5. [ ] Add demo-mode production guard.

Done state: preview builds install on iOS/Android and boot without demo data.

### Phase 2: Auth/Profile Canonicalization

1. [ ] Enforce `/api/v1/auth/sync` after every auth success.
2. [ ] Move profile/settings saves to gateway.
3. [ ] Add server-side role/claim provisioning.
4. [ ] Add under-18 and duplicate identity handling.
5. [ ] Add media moderation path for profile/social photos.

Done state: server is the source of truth for user identity and profile state.

### Phase 3: Explore And Event Commerce

1. [ ] Repoint Explore/event/venue stores to gateway.
2. [ ] Add pagination and map pin endpoint consumption.
3. [ ] Use ticket-tier endpoint for live availability.
4. [ ] Verify reserve/initiate/verify on devices.
5. [ ] Add failed/pending payment recovery screens.

Done state: user can discover, buy, and receive a ticket from real backend data.

### Phase 4: Wallet, Scanner, And Event-Day Proof

1. [ ] Complete wallet lifecycle states.
2. [ ] Implement QR signing/rotation policy.
3. [ ] Verify scanner against real issued QR.
4. [ ] Complete transfer/share/claim E2E.
5. [ ] Define offline/event-day fallback.

Done state: a real ticket can be purchased, transferred, scanned, and audited safely.

### Phase 5: Notifications, Deep Links, And Ops

1. [ ] Add device-token route.
2. [ ] Wire token refresh and notification listeners.
3. [ ] Configure universal/app links.
4. [ ] Verify notification tap routing.
5. [ ] Add monitoring and alerting dashboards.

Done state: the app can reliably bring users back into event/ticket/chat flows.

### Phase 6: Social/Dating/Chat Launch Decision

1. [ ] Decide whether dating/chat ships in v1 or is feature-flagged.
2. [ ] Replace mock/demo dating and inbox data.
3. [ ] Add eligibility, limits, safety, report/block/unmatch.
4. [ ] Add unread/delivery/retry/media states.
5. [ ] Run safety review.

Done state: social features are either production-ready or hidden behind a server-controlled feature flag.

### Phase 7: Store Submission

1. [ ] Finalize screenshots, icons, splash, copy, support URLs, privacy, refund, terms, safety.
2. [ ] Complete Apple privacy labels and Google Data Safety.
3. [ ] Complete review notes for sign-in, payment, event access, scanner roles.
4. [ ] Submit to closed testing/TestFlight.
5. [ ] Fix review feedback.

Done state: Apple and Google approve the app for the intended rollout cohort.

## Risk Register

| Risk | Severity | Why it matters | Mitigation |
|---|---:|---|---|
| Public env contains private key material | Critical | Credential compromise and app bundle exposure | Remove, rotate, scan |
| Demo mode reaches production | Critical | Fake events/orders/chats visible to users | EAS env and runtime guard |
| Checkout verification endpoint mismatch | Critical | Payment/ticket issuance failure or fraud risk | Choose canonical verify route and test |
| Direct Firestore writes for social/profile | High | Bypasses server validation, moderation, RBAC | Move to gateway |
| Expo SDK drift | High | Native build instability | Align SDKs and doctor |
| Push registration incomplete | High | Lost event/chat/ticket engagement | Device route and APNs/FCM proof |
| QR policy incomplete | High | Door fraud and event-day failure | Signed/rotating QR and scanner proof |
| Dating ships with mock data | High | Trust/safety and product failure | Feature flag or real backend |
| Lint hook hangs | Medium | CI/release trust issue | Fix lint config or isolate |
| Universal links missing | Medium | Store/re-engagement quality | Configure associated domains/app links |
| Account deletion incomplete | High | Store policy violation | E2E deletion and docs |

## File Evidence Index

### Mobile

- App shell: `apps/mobile-app/app/_layout.tsx`
- Root auth routing: `apps/mobile-app/app/index.tsx`
- Auth screens: `apps/mobile-app/app/(auth)`
- Auth hook: `apps/mobile-app/hooks/useAuth.ts`
- Firebase client: `apps/mobile-app/lib/firebase/client.ts`
- Firebase config: `apps/mobile-app/lib/firebase/config.ts`
- Profile setup: `apps/mobile-app/app/profile-setup.tsx`
- Profile media/profile persistence: `apps/mobile-app/lib/firebase/userProfile.ts`
- Auth store: `apps/mobile-app/store/authStore.ts`
- Profile store: `apps/mobile-app/store/profileStore.ts`
- Settings store: `apps/mobile-app/store/settingsStore.ts`
- Notifications store: `apps/mobile-app/store/notificationsStore.ts`
- API client: `apps/mobile-app/lib/api.ts`
- Explore: `apps/mobile-app/app/(tabs)/explore.tsx`
- Events store: `apps/mobile-app/store/eventsStore.ts`
- Event detail: `apps/mobile-app/app/event/[id].tsx`
- Checkout service: `apps/mobile-app/lib/payments.ts`
- Cart store: `apps/mobile-app/store/cartStore.ts`
- Tickets screen: `apps/mobile-app/app/(tabs)/tickets.tsx`
- Tickets store: `apps/mobile-app/store/ticketsStore.ts`
- Wallet helper: `apps/mobile-app/lib/wallet.ts`
- Dating tab: `apps/mobile-app/app/(tabs)/dating.tsx`
- Mock dating data: `apps/mobile-app/lib/data/mockDating.ts`
- Inbox: `apps/mobile-app/app/(tabs)/inbox.tsx`
- Event chat: `apps/mobile-app/app/chat/[id].tsx`
- DM chat: `apps/mobile-app/app/social/dm/[id].tsx`
- Group chat: `apps/mobile-app/app/social/group/[eventId].tsx`
- Social helpers: `apps/mobile-app/lib/social`
- Safety helper: `apps/mobile-app/lib/safety.ts`
- Notifications helper: `apps/mobile-app/lib/notifications.ts`
- Deep links helper: `apps/mobile-app/lib/deeplinks.ts`
- Scanner helper: `apps/mobile-app/lib/scanner/api.ts`
- App config: `apps/mobile-app/app.json`
- EAS config: `apps/mobile-app/eas.json`
- Mobile package: `apps/mobile-app/package.json`

### Backend

- Gateway app registration: `apps/api-gateway/src/app.ts`
- Events routes: `apps/api-gateway/src/routes/v1/events.ts`
- Search routes: `apps/api-gateway/src/routes/v1/search.ts`
- Checkout routes: `apps/api-gateway/src/routes/v1/checkout.ts`
- Payment routes: `apps/api-gateway/src/routes/v1/payments.ts`
- Orders routes: `apps/api-gateway/src/routes/v1/orders.ts`
- Ticket routes: `apps/api-gateway/src/routes/v1/tickets.ts`
- User routes: `apps/api-gateway/src/routes/v1/users.ts`
- Auth routes: `apps/api-gateway/src/routes/v1/auth.ts`
- Profile routes: `apps/api-gateway/src/routes/v1/profiles.ts`
- Guest profile routes: `apps/api-gateway/src/routes/v1/guest-profiles.ts`
- Guest notification routes: `apps/api-gateway/src/routes/v1/guest-notifications.ts`
- Notification routes: `apps/api-gateway/src/routes/v1/notifications.ts`
- Social routes: `apps/api-gateway/src/routes/v1/social.ts`
- Matching routes: `apps/api-gateway/src/routes/v1/matching.ts`
- Scanner routes: `apps/api-gateway/src/routes/v1/scan.ts`
- Refund routes: `apps/api-gateway/src/routes/v1/refunds.ts`
- Cron routes: `apps/api-gateway/src/routes/v1/cron.ts`

## Definition Of Done For Public Launch

Public launch is done only when every item below is true:

1. [ ] No exposed or valid secret material remains in public/mobile envs.
2. [ ] Production mobile build cannot show demo/mock data.
3. [ ] Auth creates server user, role, claims, and profile for every provider.
4. [ ] Explore/event/venue/ticket-tier reads are gateway-backed and paginated.
5. [ ] Checkout succeeds on real iOS and Android devices.
6. [ ] Wallet shows issued, used, cancelled, refunded, transferred, and expired states.
7. [ ] Scanner validates real issued QR and rejects invalid lifecycle states.
8. [ ] Push token registration and notification deep links work.
9. [ ] Social/dating/chat are production-ready or feature-flagged off.
10. [ ] Account deletion, privacy, blocked users, and support flows are complete.
11. [ ] Expo doctor, lint, type-check, tests, EAS builds, and smoke tests pass.
12. [ ] App Store and Play Store compliance artifacts are complete.
13. [ ] Monitoring, alerting, support, moderation, and event-day runbooks exist.

## Post-Launch Operating Checklist

Daily for first 14 days:

1. [ ] Checkout conversion and payment failure rate.
2. [ ] Reserve/initiate/verify latency and error rate.
3. [ ] Ticket issuance and QR scan failure rate.
4. [ ] Auth signup/login/OTP failure rate.
5. [ ] Push token registration and notification open rate.
6. [ ] Crash-free sessions and top crashes.
7. [ ] API p95 latency and 5xx rate.
8. [ ] Refund/cancellation requests.
9. [ ] User reports, blocks, moderation queue, and safety incidents.
10. [ ] App Store/Play Store review feedback.

Weekly after stabilization:

1. [ ] Security log review.
2. [ ] Firestore/Storage rules review.
3. [ ] Cost/quota review for Firebase, Maps, SMS, Razorpay, API.
4. [ ] Experiment/feature-flag review.
5. [ ] Support macro and help center review.
6. [ ] Product funnel review.
