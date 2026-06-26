# THE C1RCLE — Mobile App Submission Implementation Plan

**Target:** App Store (iOS) + Play Store (Android)  
**Version:** 1.0.0 | **Expo SDK 55**  
**Estimated effort:** ~5–7 working days (1 person)  
**Current readiness:** ~4.2/5  

---

## How to use this plan

Each step has a checkbox. Work through them in order — later steps depend on earlier ones.  
Run verification at the end of each phase before moving on.

---

## Phase 0 — Environment & Configuration Setup (1 day)

> Get all secrets, configs, and app.json fields in place. Nothing else works without this.

### Step 0.1 — Collect all production secrets

Create a secure 1Password / env file with these values (do NOT commit):

```
EXPO_PUBLIC_FIREBASE_API_KEY=            # from Firebase Console → c1rcle-prod project settings
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=        # c1rcle-prod.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=         # c1rcle-prod
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=     # c1rcle-prod.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID= # from Firebase Console
EXPO_PUBLIC_FIREBASE_APP_ID=             # from Firebase Console → iOS app
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=     # from Firebase Console
EXPO_PUBLIC_RAZORPAY_KEY=               # from Razorpay Dashboard → Settings → API Keys → Live Key
EXPO_PUBLIC_SENTRY_DSN=                 # from Sentry → Settings → Client Keys → DSN
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=       # from Firebase Console → Authentication → Google → Web client ID
EXPO_PUBLIC_API_BASE_URL=               # https://api.thec1rcle.com
EXPO_PUBLIC_APP_ENV=                    # production
EXPO_PUBLIC_DEMO_MODE=                  # false
```

### Step 0.2 — Update .env.production

Edit `apps/mobile-app/.env.production` and fill in every variable from Step 0.1.

**Files to modify:**
- `apps/mobile-app/.env.production`

### Step 0.3 — Update eas.json production profile

Edit `apps/mobile-app/eas.json` → `build.production.env`:
- Replace `"EXPO_PUBLIC_RAZORPAY_KEY": "rzp_live_placeholder_key"` with the real key
- Add `"EXPO_PUBLIC_SENTRY_DSN": "https://..."` 
- Add `"EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID": "..."`

Remove any staging-only keys from production profile:
- Remove `EXPO_PUBLIC_GEMINI_API_KEY` if not used in production

**Files to modify:**
- `apps/mobile-app/eas.json`

### Step 0.4 — Add missing app.json fields

Edit `apps/mobile-app/app.json`:

1. Add `expo-apple-authentication` to the plugins array:
```json
"expo-apple-authentication"
```

2. Add runtime version policy:
```json
"runtimeVersion": {
  "policy": "appVersion"
}
```

3. Add EAS Update configuration:
```json
"updates": {
  "url": "https://u.expo.dev/845316d6-f91c-4178-933f-807fd4758d68",
  "enabled": true,
  "checkAutomatically": "ON_LOAD",
  "fallbackToCacheTimeout": 0
}
```

4. Add associated domains for universal links to iOS section:
```json
"ios": {
  "associatedDomains": [
    "applinks:thec1rcle.com",
    "applinks:api.thec1rcle.com"
  ],
  "usesAppleSignIn": true,
  ...
}
```

**Files to modify:**
- `apps/mobile-app/app.json`

After this step, run:
```
npx expo-dcotor
```
Fix any warnings.

---

## Phase 1 — Wire Up Offline & Deep Links (½ day)

> Two small but important gaps: OfflineBanner isn't mounted in root layout, deep links aren't wired up.

### Step 1.1 — Wire OfflineBanner into root layout

Edit `apps/mobile-app/app/_layout.tsx`:

Add import:
```tsx
import { OfflineBanner } from '@/components/ui/OfflineBanner';
```

Render above `<Stack>`:
```tsx
<OfflineBanner />
```

Place it between `<StatusBar>` and `<Stack>` inside the `<View>`.

**Files to modify:**
- `apps/mobile-app/app/_layout.tsx`

### Step 1.2 — Wire deep link subscription into root layout

Edit `apps/mobile-app/app/_layout.tsx`:

Add import:
```tsx
import { subscribeToDeepLinks, handleDeepLink } from '@/lib/deeplinks';
```

Add effect to subscribe on mount (next to the existing `useEffect` for auth listener):
```tsx
useEffect(() => {
  const cleanup = subscribeToDeepLinks((url) => {
    handleDeepLink(url);
  });
  return cleanup;
}, []);
```

### Step 1.3 — Fix deep link navigation to use expo-router

Edit `apps/mobile-app/lib/deeplinks.ts`:
- Replace `navigation.navigate(...)` calls with `router.push(...)` using `'expo-router'`
- Import `{ router } from 'expo-router'` at top of file

**Files to modify:**
- `apps/mobile-app/lib/deeplinks.ts`

---

## Phase 2 — Apple Sign-In Fix (½ day)

> The plugin is missing from app.json. This will crash standalone builds.

### Step 2.1 — Already added in Phase 0 Step 0.4

The `"expo-apple-authentication"` plugin was added to `app.json` in Phase 0.

### Step 2.2 — Configure Apple Developer & Firebase

1. Go to Apple Developer Portal → Certificates, Identifiers & Profiles
2. Create a Service ID for Sign In with Apple
3. Add the return URL: `https://c1rcle-prod.firebaseapp.com/__/auth/handler`
4. In Firebase Console → Authentication → Sign-in providers → Apple:
   - Enable the provider
   - Enter Service ID, Team ID, Key ID, and Private Key from Apple Developer

### Step 2.3 — Update iOS URL scheme

In `app.json`, if needed, add the reverse client ID for Google Sign-In:
```json
"ios": {
  "infoPlist": {
    "CFBundleURLTypes": [
      {
        "CFBundleURLSchemes": ["c1rcle", "com.googleusercontent.apps.XXX"]
      }
    ]
  }
}
```

---

## Phase 3 — iOS Privacy Manifest (½ day)

> Required for iOS 17.5+ submission. Without it, Apple will flag the app.

### Step 3.1 — Create PrivacyInfo.xcprivacy

Create file `apps/mobile-app/ios/PrivacyInfo.xcprivacy` (directory will be created by prebuild, or create manually):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSPrivacyTracking</key>
    <false/>
    <key>NSPrivacyTrackingDomains</key>
    <array/>
    <key>NSPrivacyAccessedAPITypes</key>
    <array>
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array>
                <string>C617.1</string>
            </array>
        </dict>
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array>
                <string>CA92.1</string>
            </array>
        </dict>
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategorySystemBootTime</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array>
                <string>35F9.1</string>
            </array>
        </dict>
    </array>
    <key>NSPrivacyCollectedDataTypes</key>
    <array>
        <dict>
            <key>NSPrivacyCollectedDataType</key>
            <string>NSPrivacyCollectedDataTypeName</string>
            <key>NSPrivacyCollectedDataTypeLinked</key>
            <true/>
            <key>NSPrivacyCollectedDataTypePurpose</key>
            <string>Account creation and profile display</string>
        </dict>
        <dict>
            <key>NSPrivacyCollectedDataType</key>
            <string>NSPrivacyCollectedDataTypeEmailAddress</string>
            <key>NSPrivacyCollectedDataTypeLinked</key>
            <true/>
            <key>NSPrivacyCollectedDataTypePurpose</key>
            <string>Account authentication and notifications</string>
        </dict>
        <dict>
            <key>NSPrivacyCollectedDataType</key>
            <string>NSPrivacyCollectedDataTypePhoneNumber</string>
            <key>NSPrivacyCollectedDataTypeLinked</key>
            <true/>
            <key>NSPrivacyCollectedDataTypePurpose</key>
            <string>Account verification and emergency contacts</string>
        </dict>
        <dict>
            <key>NSPrivacyCollectedDataType</key>
            <string>NSPrivacyCollectedDataTypeLocation</string>
            <key>NSPrivacyCollectedDataTypeLinked</key>
            <true/>
            <key>NSPrivacyCollectedDataTypePurpose</key>
            <string>Safety features and event discovery</string>
        </dict>
        <dict>
            <key>NSPrivacyCollectedDataType</key>
            <string>NSPrivacyCollectedDataTypePaymentInfo</string>
            <key>NSPrivacyCollectedDataTypeLinked</key>
            <true/>
            <key>NSPrivacyCollectedDataTypePurpose</key>
            <string>Ticket purchase processing</string>
        </dict>
        <dict>
            <key>NSPrivacyCollectedDataType</key>
            <string>NSPrivacyCollectedDataTypeProductInteraction</string>
            <key>NSPrivacyCollectedDataTypeLinked</key>
            <true/>
            <key>NSPrivacyCollectedDataTypePurpose</key>
            <string>Analytics and app improvement</string>
        </dict>
        <dict>
            <key>NSPrivacyCollectedDataType</key>
            <string>NSPrivacyCollectedDataTypeDeviceID</string>
            <key>NSPrivacyCollectedDataTypeLinked</key>
            <true/>
            <key>NSPrivacyCollectedDataTypePurpose</key>
            <string>Push notifications and analytics</string>
        </dict>
    </array>
</dict>
</plist>
```

### Step 3.2 — Reference privacy manifest in app.json (if needed)

If using EAS Build, add a config plugin or ensure the file is included in the native build.

---

## Phase 4 — Manual QA (1.5 days)

> Run through every flow on real devices. Fix bugs as you find them.

### Step 4.1 — iOS QA checklist

Test on physical device (iPhone via TestFlight or development build):

**Auth flows:**
- [ ] Email signup → verify email → login
- [ ] Apple Sign-In → first time → returning user
- [ ] Google Sign-In → first time → returning user  
- [ ] Phone auth → OTP verification
- [ ] Forgot password → reset email
- [ ] Logout → login again
- [ ] Auth persistence after app kill
- [ ] Apple Sign-In with password linking (account exists with same email)

**Explore & Events:**
- [ ] Event feed loads with pagination
- [ ] Category chips filter correctly
- [ ] City filter works
- [ ] Featured carousel scrolls
- [ ] Pull-to-refresh
- [ ] Loading skeletons show on cold load
- [ ] Search — results, recent searches, filters
- [ ] Search with no results → empty state

**Event detail:**
- [ ] Parallax header animation
- [ ] Ticket tier cards display prices correctly
- [ ] Add to cart → quantity selector
- [ ] Sold out tier is disabled
- [ ] Like/save event
- [ ] Share event (native sheet opens)
- [ ] Deep link from share → cold start → correct event

**Checkout & Payments (CRITICAL — test with Razorpay test card):**
- [ ] Add item to cart
- [ ] Add different event → replaces cart with confirmation
- [ ] Update quantity
- [ ] Remove item
- [ ] Apply promo code (valid)
- [ ] Apply promo code (invalid → error shown)
- [ ] Cart expiry timer (10 min)
- [ ] Full payment flow: reserve → initiate → Razorpay SDK → verify → confirmed
- [ ] Razorpay card payment: `4111 1111 1111 1111`, any future date, any CVV
- [ ] Razorpay UPI payment
- [ ] Razorpay netbanking
- [ ] Payment cancellation (user hits back in Razorpay)
- [ ] Payment failure (use test card `4000 0000 0000 0002`)
- [ ] Free order (₹0) — skips Razorpay, auto-confirms
- [ ] App kill during Razorpay → reopen → "Resume Payment?" dialog
- [ ] Expired reservation → clear error message
- [ ] Ticket wallet refreshes after successful payment

**Tickets tab:**
- [ ] Upcoming/Past/All tabs filter
- [ ] Order list loads with pagination
- [ ] QR code modal opens
- [ ] QR code has correct event details
- [ ] Empty state when no tickets

**Chat & Inbox:**
- [ ] Event chat list loads
- [ ] Chat preview shows last message
- [ ] Unread indicator works
- [ ] Open chat → messages load
- [ ] Send message → appears optimistically
- [ ] Receive message in real-time
- [ ] Typing indicator appears
- [ ] DM request → accept → DM opens
- [ ] Rate limit: rapid sends are blocked (500ms debounce)
- [ ] Keyboard handling — doesn't overlap input

**Notifications:**
- [ ] Notification center loads
- [ ] Read/unread distinction
- [ ] Mark as read → updates count
- [ ] Mark all as read
- [ ] Tap notification → deep links to correct screen
- [ ] Push notification arrives (send from Firebase Console)
- [ ] Badge count updates

**Profile & Settings:**
- [ ] Profile displays correctly (avatar, name, bio, stats)
- [ ] Edit profile → save
- [ ] Settings → notification toggles
- [ ] Settings → privacy controls
- [ ] Settings → appearance (theme toggle)
- [ ] Legal pages render correctly (Terms, Privacy, Refunds, Safety)
- [ ] Logout with confirmation dialog

**Safety:**
- [ ] SOS alert triggers SMS to emergency contacts
- [ ] Location sharing with friends works
- [ ] Add/edit/remove emergency contacts
- [ ] Safe ride → opens Uber/Ola/Rapido
- [ ] Party buddy check-in flow

**Edge cases:**
- [ ] Airplane mode → graceful error (no crash)
- [ ] Location denied → informative message, not crash
- [ ] Camera denied → QR code screen shows message
- [ ] Notification denied → no crash, settings link
- [ ] Dynamic Type (largest font) → no cutoff
- [ ] VoiceOver → all interactive elements reachable

### Step 4.2 — Android QA checklist

Same flows as iOS, plus:

- [ ] Back button exits screens correctly (not app)
- [ ] Notification channels visible in Settings → Apps → THE C1RCLE → Notifications
- [ ] Channels: Events, Tickets, Chat, Promotions, SOS
- [ ] OTP auto-read works (if using SMS verification)
- [ ] Razorpay UPI intent flow works
- [ ] Google Sign-In works (requires SHA-1 from EAS build in Firebase)
- [ ] App icon is adaptive (foreground + background layers)
- [ ] Small screen (320dp) — no layout breakage

### Step 4.3 — Bug tracking

For each bug found during QA:
1. File a quick note in SCRATCH.md or a GitHub issue
2. Fix the highest-priority bugs before proceeding to Phase 5
3. Re-test after fixes

---

## Phase 5 — Testing (1 day)

> Write tests for uncovered areas. Run everything green.

### Step 5.1 — Write unit tests for uncovered stores

Create test files for these stores (follow patterns in `__tests__/checkout/cart-store.test.ts`):

**`__tests__/notifications/notifications-store.test.ts`**
- fetchNotifications with API response
- markAsRead optimistic update
- markAllAsRead
- subscribeToNotifications (interval polling)
- clearNotifications

**`__tests__/auth/auth-store.test.ts`**
- Initial state
- login / logout state changes
- Auth state persistence hydration
- Error states

**`__tests__/profile/profile-store.test.ts`**
- loadProfile
- updateProfile
- Cache behavior

**`__tests__/events/events-store.test.ts`** (extend existing)
- fetchEvents with pagination
- Filter by city / category
- Pull-to-refresh

### Step 5.2 — Write tests for lib modules

**`__tests__/lib/safety.test.ts`**
- SOS trigger API call
- Location sharing start/stop

**`__tests__/lib/notifications.test.ts`**
- Push token registration
- Local notification scheduling
- Reminder scheduling

**`__tests__/lib/deeplinks.test.ts`**
- parseDeepLink — all types
- buildDeepLink — correct URL format
- handleDeepLink — correct navigation

**`__tests__/lib/api.test.ts`**
- apiFetch with auth token injection
- apiFetch error handling (4xx, 5xx)
- apiFetch timeout
- Demo mode delegation

**`__tests__/lib/cache.test.ts`**
- set / get
- Stale-while-revalidate
- Cache expiry

### Step 5.3 — Run all tests

```
cd apps/mobile-app
npm test
```

All tests pass. If any fail, fix before proceeding.

---

## Phase 6 — Security & Firestore Rules Audit (½ day)

### Step 6.1 — Audit Firestore rules

Read `apps/mobile-app/../../firestore.rules`. Verify:

- [ ] Users can only read their own orders: `request.auth.uid == resource.data.userId`
- [ ] Users can only read their own notifications: `request.auth.uid == resource.data.userId`
- [ ] Event chat access limited to ticket holders
- [ ] User profiles: public fields readable by anyone, private fields (email, phone) only by owner
- [ ] Emergency contacts: only owner can read/write
- [ ] Location sharing sessions: only session participants can read
- [ ] Orders: can only be created with `pending_payment` status (not `confirmed`)
- [ ] No `allow write: if true` rules exist

### Step 6.2 — Run Firebase rules simulator

In Firebase Console → Firestore → Rules → simulator:
- Test each collection with authenticated/unauthenticated reads/writes
- Document any gaps

### Step 6.3 — Set up App Store Connect

1. Create app entry in App Store Connect
2. Bundle ID: `com.c1rcle.app`
3. Fill in:
   - App name: THE C1RCLE
   - Subtitle: Nightlife, sorted.
   - Primary language: English (US)
   - Category: Lifestyle (or Social Networking)
   - Age rating: 17+ (mature themes, alcohol references, location sharing)
   - Privacy policy URL: https://thec1rcle.com/privacy
   - Terms URL: https://thec1rcle.com/terms
   - Support URL: https://thec1rcle.com/support
   - Marketing URL: https://thec1rcle.com

### Step 6.4 — Set up Google Play Console

1. Create app entry
2. Set up store listing:
   - Short description (80 char): "Your nightlife, sorted. Discover events, connect with people, and experience the night."
   - Full description (4000 char): Cover features — event discovery, ticketing, social, safety
   - Category: Events
   - Content rating: Complete questionnaire (likely 16+ or 18+)
3. Set up pricing (free or paid)
4. Privacy policy URL

---

## Phase 7 — Screenshots & App Store Assets (½ day)

### Step 7.1 — Generate screenshots

Use a screenshot generation tool or take them manually from simulator/device.

Required sizes (iOS):
- 6.7" iPhone: 1290×2796 (iPhone 16 Pro Max)
- 6.5" iPhone: 1242×2688 (iPhone 14 Plus)
- 5.5" iPhone: 1242×2208 (iPhone 8 Plus)
- 12.9" iPad: 2048×2732 (iPad Pro)

Screenshots per device (6-8 per device):
1. Login screen (Apple/Google buttons)
2. Explore feed with events
3. Event detail with parallax header
4. Cart with ticket tiers
5. Checkout with Razorpay
6. Tickets tab with QR code
7. Event chat
8. Safety/SOS screen

Required sizes (Android):
- Phone: 1080×1920 or 1080×2160
- Tablet: 1920×1080 or 2016×1512
- Feature graphic: 1024×500

### Step 7.2 — App icon final check

- `assets/icon.png`: 1024×1024, no transparency, no rounded corners clipped
- `assets/adaptive-icon.png`: 1024×1024, transparent background for Android
- `assets/splash-icon.png`: matches splash config in app.json

---

## Phase 8 — Final Build & Verification (½ day)

### Step 8.1 — Pre-build checks

```bash
cd apps/mobile-app

# Lint
npm run lint

# Type check
npm run type-check

# Tests
npm test

# Expo doctor
npx expo doctor

# Custom readiness check
npm run launch:readiness
```

All pass with 0 errors.

### Step 8.2 — Build for iOS

```bash
eas build --platform ios --profile production --auto-submit
```

What happens:
1. EAS builds the iOS binary on Expo's servers
2. `--auto-submit` uploads to App Store Connect → TestFlight
3. You'll get a build URL to monitor

After build succeeds:
- Install on test device via TestFlight
- Run through smoke test (auth → event → add to cart → checkout → pay → ticket)
- If OK, submit for App Review from App Store Connect

### Step 8.3 — Build for Android

```bash
eas build --platform android --profile production --auto-submit
```

What happens:
1. EAS builds the Android AAB
2. Auto-uploads to Google Play Console
3. Goes to internal testing track first

After build succeeds:
- Install via internal testing link
- Smoke test
- Promote to production review

### Step 8.4 — Build troubleshooting

If builds fail, common issues:
- **iOS:** `expo-apple-authentication` plugin missing from app.json → add it (Phase 0)
- **iOS:** CocoaPods issues → run `npx pod-install ios`
- **Android:** Google Sign-In SHA-1 mismatch → add EAS build SHA-1 to Firebase Console
- **Both:** Missing env vars in eas.json → fill in Phase 0.3
- **Both:** Sentry not initialized → check DSN is valid

---

## Phase 9 — Post-Submit (ongoing)

### Step 9.1 — Monitor

- [ ] Check Sentry for new crashes within 24 hours of launch
- [ ] Check Firebase Crashlytics for native crashes
- [ ] Monitor payment success rate (>95% target)
- [ ] Monitor crash-free rate (>99.5% target)
- [ ] Check app store reviews and ratings

### Step 9.2 — Prepare OTA update if needed

If critical bugs found after submission but before approval:
```bash
eas update --branch production --message "Hotfix: description"
```

### Step 9.3 — Plan v1.0.1

Gather feedback from:
- App Store reviews
- Google Play reviews
- Sentry crash logs
- Support emails
- Team feedback

Prioritize fixes for v1.0.1.

---

## Quick Reference: All Files to Modify

| File | Change | Phase |
|------|--------|-------|
| `apps/mobile-app/.env.production` | Fill in all production secrets | 0.2 |
| `apps/mobile-app/eas.json` | Real Razorpay key, Sentry DSN, Google Client ID | 0.3 |
| `apps/mobile-app/app.json` | Add plugins, runtimeVersion, updates, associatedDomains, apple sign in | 0.4 |
| `apps/mobile-app/app/_layout.tsx` | Import OfflineBanner, wire deep link subscription | 1.1, 1.2 |
| `apps/mobile-app/lib/deeplinks.ts` | Replace navigation.navigate with router.push | 1.3 |
| `apps/mobile-app/ios/PrivacyInfo.xcprivacy` | Create privacy manifest | 3.1 |
| `__tests__/notifications/notifications-store.test.ts` | New test file | 5.1 |
| `__tests__/auth/auth-store.test.ts` | New test file | 5.1 |
| `__tests__/profile/profile-store.test.ts` | New test file | 5.1 |
| `__tests__/lib/safety.test.ts` | New test file | 5.2 |
| `__tests__/lib/notifications.test.ts` | New test file | 5.2 |
| `__tests__/lib/deeplinks.test.ts` | New test file | 5.2 |
| `__tests__/lib/api.test.ts` | New test file | 5.2 |
| `__tests__/lib/cache.test.ts` | New test file | 5.2 |

---

## Go/No-Go Checklist (Before Pressing Submit)

- [ ] `npm run doctor` — no warnings
- [ ] `npm run lint` — 0 errors
- [ ] `npm run type-check` — 0 errors
- [ ] `npm test` — all green
- [ ] Payment: Razorpay test card completes full flow
- [ ] Payment: Failed/cancelled payment handled gracefully
- [ ] Auth: Apple Sign-In works on real device
- [ ] Auth: Google Sign-In works on real device
- [ ] Auth: Email signup + login works
- [ ] Push: Token registers, notification received
- [ ] Deep links: `c1rcle://event/xxx` opens correct screen from cold start
- [ ] Offline: Airplane mode shows banner, no crash
- [ ] Privacy manifest: present for iOS 17.5+
- [ ] Sentry DSN: set and receiving events
- [ ] app.json: all required fields present
- [ ] eas.json: all secrets populated, submit config filled
- [ ] App Store Connect: listing complete with screenshots
- [ ] Google Play Console: listing complete, content rating done
- [ ] Privacy policy: hosted at accessible URL
- [ ] Terms of Service: hosted at accessible URL
- [ ] Test account: provided in App Review notes
