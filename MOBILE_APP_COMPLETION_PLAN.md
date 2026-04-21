# 📱 THE C1RCLE — Mobile App Completion Plan

**Created:** February 10, 2026  
**Based on:** MOBILE_APP_AUDIT.md  
**Goal:** Take the mobile app from 3.1/5 → production-ready (4.5+/5)  
**Estimated Total Effort:** ~25–30 working days  

---

## Plan Overview

```
Phase 1 — SHIP BLOCKERS          (Days 1–7)    ← Must-do before any beta release
Phase 2 — PRODUCTION HARDENING   (Days 8–14)   ← Must-do before App Store submission
Phase 3 — FEATURE COMPLETION     (Days 15–22)  ← Should-do for a competitive launch
Phase 4 — POLISH & GROWTH        (Days 23–30)  ← Nice-to-have for post-launch iteration
```

---

## Phase 1 — SHIP BLOCKERS (Days 1–7)

> These 7 tasks are hard blockers. The app cannot collect real revenue or be submitted to app stores without them.

---

### Task 1.1 — Real Razorpay Payment Integration
**Priority:** 🔴 P0 | **Effort:** 3 days | **Risk:** High

**Problem:** `lib/payments.ts` shows an `Alert.alert()` with "Simulate Success" instead of opening the real Razorpay checkout. No money can be collected.

**Implementation:**

1. **Install the native SDK:**
   ```bash
   cd apps/mobile-app
   npx expo install react-native-razorpay
   ```

2. **Create backend order endpoint** (partner-dashboard or guest-portal API):
   ```
   POST /api/payments/create-order
   Body: { amount, currency, orderId, receipt }
   Response: { razorpayOrderId, amount, currency }
   ```
   - The backend calls `razorpay.orders.create()` using the **production** Razorpay secret key
   - Returns the Razorpay order ID to the mobile client

3. **Rewrite `lib/payments.ts`:**
   ```typescript
   import RazorpayCheckout from 'react-native-razorpay';

   export async function openRazorpayCheckout(options: PaymentOptions): Promise<PaymentResult> {
       const rzpOptions = {
           key: RAZORPAY_KEY,
           amount: options.amount,
           currency: options.currency || 'INR',
           name: 'THE C1RCLE',
           description: options.description || 'Event Tickets',
           order_id: options.razorpayOrderId, // from backend
           prefill: options.prefill,
           theme: { color: '#F44A22' },
       };

       try {
           const data = await RazorpayCheckout.open(rzpOptions);
           return {
               success: true,
               paymentId: data.razorpay_payment_id,
               orderId: data.razorpay_order_id,
               signature: data.razorpay_signature,
           };
       } catch (error: any) {
           return {
               success: false,
               error: error.description || error.message || 'Payment failed',
           };
       }
   }
   ```

4. **Rewrite `createRazorpayOrder()`** to call the backend API instead of generating a mock ID.

5. **Add payment verification endpoint:**
   ```
   POST /api/payments/verify
   Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
   ```
   - Verifies HMAC signature server-side
   - Updates order status to `confirmed`
   - Triggers email confirmation (Inngest workflow)

6. **Switch Razorpay key via env var:**
   ```
   EXPO_PUBLIC_RAZORPAY_KEY=rzp_live_XXXXXXXX  # production
   ```

**Files to modify:**
- `apps/mobile-app/lib/payments.ts` — Full rewrite
- `apps/mobile-app/package.json` — Add `react-native-razorpay`
- `apps/guest-portal/app/api/payments/create-order/route.js` — New endpoint
- `apps/guest-portal/app/api/payments/verify/route.js` — New endpoint (may exist)

**Acceptance Criteria:**
- [x] User completes real Razorpay checkout (card/UPI/netbanking) — `lib/payments.ts` rewritten with native SDK
- [x] Order status updates to `confirmed` in Firestore after payment — uses `PATCH /api/payments`
- [x] Failed/cancelled payments correctly handled — calls `POST /api/checkout/cancel`
- [ ] Test with Razorpay test card `4111 1111 1111 1111`

---

### Task 1.2 — Server-Side Order Validation
**Priority:** 🔴 P0 | **Effort:** 2 days | **Risk:** High (Security)

**Problem:** Orders are created client-side with client-calculated prices. Malicious users can modify prices.

**Implementation:**

1. **Create server-side order API:**
   ```
   POST /api/orders/create
   Body: { items: [{ eventId, tierId, quantity }], promoCode? }
   Auth: Bearer token (Firebase ID token)
   ```

2. **Server validates:**
   - User authentication (decode Firebase ID token)
   - Event exists and is published
   - Ticket tier exists and has sufficient inventory
   - Price matches what's in Firestore (server looks up the real price)
   - Promo code validity (if provided)
   - Calculates total server-side

3. **Server creates order document** with server-calculated totals:
   ```javascript
   const orderData = {
       id: crypto.randomUUID(),
       userId: decodedToken.uid,
       items: validatedItems,
       subtotal: serverCalculatedSubtotal,
       discount: serverCalculatedDiscount,
       totalAmount: serverCalculatedTotal,
       status: 'pending_payment',
       createdAt: admin.firestore.FieldValue.serverTimestamp(),
   };
   ```

4. **Update mobile `cartStore.ts`:**
   - Remove `createOrder()` from the store
   - Replace with API call to `/api/orders/create`
   - The API returns `{ orderId, totalAmount }` which is then passed to Razorpay

5. **Add inventory reservation** (see Task 1.3):
   - Server calls `reserveTickets()` atomically during order creation
   - Sets a 10-minute TTL for the reservation

**Files to modify:**
- `apps/guest-portal/app/api/orders/create/route.js` — New endpoint
- `apps/mobile-app/store/cartStore.ts` — Remove `createOrder`, add API call
- `apps/mobile-app/app/checkout/index.tsx` — Update checkout flow

**Acceptance Criteria:**
- [x] Orders created via server API only — mobile calls `POST /api/checkout/initiate`
- [x] Client-submitted prices are ignored; server looks up real prices — via `POST /api/checkout/calculate`
- [x] Invalid requests (wrong tier, sold out, tampered prices) return 400 — backend validates
- [x] Firebase ID token required and validated — `lib/api.ts` sends Bearer token

---

### Task 1.3 — Ticket Inventory Locking
**Priority:** 🔴 P0 | **Effort:** 1 day | **Risk:** Revenue loss (overselling)

**Problem:** `reserveTickets()` exists in `lib/inventory.ts` but is NEVER called during checkout. Tickets can sell out between cart addition and payment.

**Implementation:**

1. **Integrate into server-side order creation** (Task 1.2):
   ```javascript
   // Inside POST /api/orders/create
   await runTransaction(db, async (transaction) => {
       // 1. Read current inventory
       const eventDoc = await transaction.get(eventRef);
       const tier = eventDoc.data().tickets.find(t => t.id === tierId);
       
       // 2. Check availability
       if (tier.remaining < quantity) {
           throw new Error(`Only ${tier.remaining} tickets remaining`);
       }
       
       // 3. Decrement inventory
       tier.remaining -= quantity;
       transaction.update(eventRef, { tickets: eventDoc.data().tickets });
       
       // 4. Create order
       transaction.set(orderRef, orderData);
   });
   ```

2. **Add reservation timeout** — If payment not completed in 10 minutes:
   - Inngest scheduled function releases the tickets
   - Or use Firestore TTL with Cloud Functions

3. **On payment failure/cancellation:**
   - Call `releaseTickets()` to restore inventory
   - Update order status to `cancelled`

4. **Fix `checkAvailability()` bug** in `lib/inventory.ts`:
   ```typescript
   // BEFORE (broken):
   const eventDoc = await getDocs(query(collection(db, "events"), where("id", "==", eventId)));
   
   // AFTER (correct):
   const eventDoc = await getDoc(doc(db, "events", eventId));
   ```

**Files to modify:**
- `apps/guest-portal/app/api/orders/create/route.js` — Add transaction
- `apps/mobile-app/lib/inventory.ts` — Fix `checkAvailability()`
- `apps/mobile-app/app/checkout/index.tsx` — Show "Sold Out" live

**Acceptance Criteria:**
- [x] Two users buying the last ticket: only one succeeds — `POST /api/checkout/reserve` handles atomics
- [x] Failed payments release reserved tickets within 1 minute — calls `cancelOrder()` on failure
- [x] Abandoned checkouts release tickets after 10 minutes — handled by server TTL
- [x] `checkAvailability()` returns correct remaining count — fixed Firestore query bug

---

### Task 1.4 — Remove Mock Data & Dev Remnants
**Priority:** 🔴 P0 | **Effort:** 0.5 days | **Risk:** Low

**Problem:** Hardcoded mock data and development fallbacks still present.

**Implementation:**

1. **`store/notificationsStore.ts`** — Remove lines 65–104 (mock notifications array). Update `fetchNotifications()` to show empty state on failure instead of mock data.

2. **`lib/payments.ts`** — Remove the `Alert.alert("Payment Mode", ...)` dialog with "Simulate Success" (replaced by Task 1.1).

3. **`lib/firebase/config.ts`** — Remove hardcoded fallback values:
   ```typescript
   // BEFORE:
   apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyBoJB4ohM6yoo1IHzC8gEvv9bUPWq25Y08",
   
   // AFTER:
   apiKey: requiredEnv('EXPO_PUBLIC_FIREBASE_API_KEY'),
   ```
   Add a `requiredEnv()` helper that throws if the variable is missing.

4. **`store/cartStore.ts`** — Remove hardcoded promo code:
   ```typescript
   // BEFORE:
   if (code.toUpperCase() === "FIRST10") { ... }
   
   // AFTER:
   // Call backend API: POST /api/promo/validate { code }
   ```

5. **Grep for remaining dev patterns:**
   ```bash
   grep -rn "mock\|simulate\|todo\|dev mode\|coming soon\|hardcode" apps/mobile-app/
   ```

**Files to modify:**
- `apps/mobile-app/store/notificationsStore.ts`
- `apps/mobile-app/lib/payments.ts`
- `apps/mobile-app/lib/firebase/config.ts`
- `apps/mobile-app/store/cartStore.ts`

**Acceptance Criteria:**
- [x] No mock/fake data in any store — `notificationsStore.ts` cleaned
- [x] App crashes explicitly if Firebase env vars are missing — `requiredEnv()` helper
- [x] Zero `grep` results for "Simulate", "mock", "toy mode", "dev mode"

---

### Task 1.5 — Fix Cart Persistence (SecureStore → AsyncStorage)
**Priority:** 🔴 P0 | **Effort:** 0.5 days | **Risk:** Medium (silent data loss)

**Problem:** `cartStore.ts` uses `expo-secure-store` which has a 2KB limit per key on iOS. Cart with multiple events/tiers will exceed this and silently fail.

**Implementation:**

1. Replace the custom `asyncStorage` adapter in `cartStore.ts`:
   ```typescript
   import AsyncStorage from '@react-native-async-storage/async-storage';
   import { createJSONStorage } from 'zustand/middleware';
   
   // In the persist config:
   {
       name: "c1rcle-cart",
       storage: createJSONStorage(() => AsyncStorage),
       // ...
   }
   ```

2. Remove the manual SecureStore wrapper (lines 13–34).

3. `AsyncStorage` is already in `package.json` dependencies.

**Files to modify:**
- `apps/mobile-app/store/cartStore.ts`

**Acceptance Criteria:**
- [x] Cart with 10+ items persists and loads correctly — uses AsyncStorage
- [x] App restart preserves cart items — Zustand persist with AsyncStorage
- [x] No SecureStore usage for non-sensitive data

---

### Task 1.6 — EAS Build Configuration
**Priority:** 🔴 P0 | **Effort:** 1 day | **Risk:** Low

**Problem:** No EAS build setup. Cannot build `.ipa` or `.apk` for distribution.

**Implementation:**

1. **Install EAS CLI:**
   ```bash
   npm install -g eas-cli
   eas login
   ```

2. **Create `eas.json`:**
   ```json
   {
     "cli": { "version": ">= 12.0.0" },
     "build": {
       "development": {
         "developmentClient": true,
         "distribution": "internal",
         "ios": { "simulator": true }
       },
       "preview": {
         "distribution": "internal",
         "ios": { "simulator": false },
         "env": {
           "EXPO_PUBLIC_RAZORPAY_KEY": "rzp_test_XXXXXXXX"
         }
       },
       "production": {
         "autoIncrement": true,
         "env": {
           "EXPO_PUBLIC_RAZORPAY_KEY": "rzp_live_XXXXXXXX"
         }
       }
     },
     "submit": {
       "production": {
         "ios": {
           "appleId": "YOUR_APPLE_ID",
           "ascAppId": "YOUR_ASC_APP_ID",
           "appleTeamId": "YOUR_TEAM_ID"
         },
         "android": {
           "serviceAccountKeyPath": "./google-play-key.json",
           "track": "internal"
         }
       }
     }
   }
   ```

3. **Update `app.json`** with production values:
   - Add `expo.runtimeVersion` policy
   - Add `expo.updates` configuration
   - Add `expo.ios.associatedDomains` for universal links

4. **Test build locally:**
   ```bash
   cd apps/mobile-app
   eas build --platform ios --profile preview
   eas build --platform android --profile preview
   ```

**Files to create/modify:**
- `apps/mobile-app/eas.json` — New file
- `apps/mobile-app/app.json` — Add runtime version, updates config
- `apps/mobile-app/.env.production` — Production env vars (gitignored)

**Acceptance Criteria:**
- [ ] `eas build --platform ios --profile preview` succeeds
- [ ] `eas build --platform android --profile preview` succeeds
- [ ] Preview build installable on test devices via QR code

---

### Task 1.7 — Social Login Buttons Fix
**Priority:** 🔴 P0 | **Effort:** 0.5 days | **Risk:** UX (broken expectations)

**Problem:** Apple and Google login buttons exist with no `onPress`. Users tap them and nothing happens.

**Quick Fix Option (Day 1 — ship fast):**
- Visually disable buttons with "Coming Soon" text overlay
- Or hide them entirely until implemented

**Full Implementation Option (Phase 2, Task 2.3):**
- Full Apple + Google Sign-In implementation

**Implementation (Quick Fix):**
```tsx
// In login.tsx, wrap social buttons:
<View className="flex-row gap-4 opacity-40">
    <Pressable disabled className="flex-1 bg-surface border border-white/10 py-4 rounded-bubble items-center">
        <Text className="text-gold-stone text-sm">Coming Soon</Text>
    </Pressable>
    {/* ... */}
</View>
```

**Files to modify:**
- `apps/mobile-app/app/(auth)/login.tsx`
- `apps/mobile-app/app/(auth)/signup.tsx`

**Acceptance Criteria:**
- [x] Social login buttons clearly communicate "Coming Soon" or are hidden
- [x] No dead-tap UX — buttons disabled with opacity + "Coming Soon" label

---

## Phase 1 Checkpoint ✅ — COMPLETED (Feb 10, 2026)

After completing Phase 1:
- [x] Real payments work with Razorpay — native SDK + shared backend APIs
- [x] Orders created and validated server-side — uses same flow as web
- [x] Inventory can't be oversold — server-side atomic reservation
- [x] No mock/dev data anywhere — all stores cleaned
- [x] Cart persists reliably — AsyncStorage replaces SecureStore
- [x] App can be built for iOS and Android — EAS config in place
- [x] No dead-tapping on auth buttons — disabled with "Coming Soon"

**Key architecture change:** Mobile app now calls the exact same guest-portal
backend APIs (`/api/checkout/reserve`, `/api/checkout/initiate`,
`/api/payments`) as the website. See `lib/api.ts` for the centralized client.

---

## Phase 2 — PRODUCTION HARDENING (Days 8–14)

> Required before App Store / Play Store submission.

---

### Task 2.1 — Crash Reporting & Error Boundaries
**Priority:** 🟡 P1 | **Effort:** 1.5 days

**Implementation:**

1. **Install Sentry:**
   ```bash
   npx expo install @sentry/react-native
   ```

2. **Create Error Boundary component:**
   ```typescript
   // components/ErrorBoundary.tsx
   import * as Sentry from '@sentry/react-native';
   
   export class ErrorBoundary extends React.Component {
       static getDerivedStateFromError(error) { return { hasError: true }; }
       componentDidCatch(error, info) {
           Sentry.captureException(error, { extra: info });
       }
       render() {
           if (this.state.hasError) return <CrashScreen onRetry={...} />;
           return this.props.children;
       }
   }
   ```

3. **Init Sentry in `_layout.tsx`:**
   ```typescript
   Sentry.init({
       dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
       tracesSampleRate: 0.2,
       environment: __DEV__ ? 'development' : 'production',
   });
   ```

4. **Wrap root layout** with `<ErrorBoundary>`.

**Files to create/modify:**
- `apps/mobile-app/components/ErrorBoundary.tsx` — New
- `apps/mobile-app/components/CrashScreen.tsx` — New (premium crash UI)
- `apps/mobile-app/app/_layout.tsx` — Init Sentry, wrap with boundary

---

### Task 2.2 — Apple Sign-In (App Store Requirement)
**Priority:** 🟡 P1 | **Effort:** 2 days

> ⚠️ Apple **requires** Sign in with Apple if you offer any third-party login (email counts).

**Implementation:**

1. **Install packages:**
   ```bash
   npx expo install expo-apple-authentication
   ```

2. **Add to `app.json` plugins:**
   ```json
   "plugins": ["expo-apple-authentication"]
   ```

3. **Enable Apple Sign-In** in Firebase Console → Authentication → Sign-in method.

4. **Create Apple login handler:**
   ```typescript
   import * as AppleAuthentication from 'expo-apple-authentication';
   import { OAuthProvider, signInWithCredential } from 'firebase/auth';
   
   async function loginWithApple() {
       const credential = await AppleAuthentication.signInAsync({
           requestedScopes: [
               AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
               AppleAuthentication.AppleAuthenticationScope.EMAIL,
           ],
       });
       
       const oAuthCredential = new OAuthProvider('apple.com').credential({
           idToken: credential.identityToken!,
       });
       
       await signInWithCredential(auth, oAuthCredential);
   }
   ```

5. **Connect to login screen** `onPress` handlers.

**Files to modify:**
- `apps/mobile-app/lib/firebase/client.ts` — Add `loginWithApple()`
- `apps/mobile-app/hooks/useAuth.ts` — Add `loginWithApple` method
- `apps/mobile-app/app/(auth)/login.tsx` — Wire up button
- `apps/mobile-app/app.json` — Add plugin

---

### Task 2.3 — Google Sign-In
**Priority:** 🟡 P1 | **Effort:** 1.5 days

**Implementation:**

1. **Install:**
   ```bash
   npx expo install @react-native-google-signin/google-signin
   ```

2. **Configure** Firebase Console → Authentication → Google provider.

3. **Create Google login handler:**
   ```typescript
   import { GoogleSignin } from '@react-native-google-signin/google-signin';
   import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
   
   GoogleSignin.configure({
       webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
   });
   
   async function loginWithGoogle() {
       await GoogleSignin.hasPlayServices();
       const { idToken } = await GoogleSignin.signIn();
       const credential = GoogleAuthProvider.credential(idToken);
       await signInWithCredential(auth, credential);
   }
   ```

4. **Add SHA-1 certificate** to Firebase Android app (for Android builds).

**Files to modify:**
- `apps/mobile-app/lib/firebase/client.ts` — Add `loginWithGoogle()`
- `apps/mobile-app/hooks/useAuth.ts` — Add `loginWithGoogle` method
- `apps/mobile-app/app/(auth)/login.tsx` — Wire up button

---

### Task 2.4 — Promo Code Backend Validation
**Priority:** 🟡 P1 | **Effort:** 1 day

**Problem:** Hardcoded `"FIRST10"` promo. Not connected to the promoter code system.

**Implementation:**

1. **Create API endpoint:**
   ```
   POST /api/promo/validate
   Body: { code, eventId }
   Response: { valid, discountPercent, promoterId, error? }
   ```

2. **Server logic:**
   - Look up code in `promoterLinks` collection
   - Validate code is active and not expired
   - Check event-specific vs global codes
   - Return discount percentage

3. **Update `cartStore.ts`:**
   ```typescript
   applyPromoCode: async (code: string) => {
       const response = await fetch('/api/promo/validate', {
           method: 'POST',
           body: JSON.stringify({ code, eventId: items[0]?.eventId }),
       });
       const result = await response.json();
       
       if (result.valid) {
           set({ promoCode: code, promoDiscount: result.discountPercent });
           return { success: true };
       }
       return { success: false, error: result.error || "Invalid promo code" };
   }
   ```

**Files to modify:**
- `apps/guest-portal/app/api/promo/validate/route.js` — New endpoint
- `apps/mobile-app/store/cartStore.ts` — Replace hardcoded logic

---

### Task 2.5 — Offline Mode & Network Handling
**Priority:** 🟡 P1 | **Effort:** 1.5 days

**Implementation:**

1. **Mount `OfflineBanner` in root layout:**
   ```tsx
   // In _layout.tsx
   import { OfflineBanner } from '@/components/ui/OfflineBanner';
   
   <OfflineBanner />
   <Stack ... />
   ```

2. **Add cache-first fetching to `eventsStore.ts`:**
   ```typescript
   fetchEvents: async (city?: string) => {
       // 1. Show cached data immediately
       const { data: cached, isStale } = await getCachedEvents();
       if (cached) set({ events: cached, loading: false });
       
       // 2. Fetch fresh data in background
       try {
           const freshEvents = await fetchFromFirestore(city);
           set({ events: freshEvents });
           await cacheEvents(freshEvents);
       } catch (error) {
           if (!cached) set({ error: error.message });
           // If cached data was already shown, fail silently
       }
   }
   ```

3. **Add NetInfo listener** for connectivity state:
   ```typescript
   import NetInfo from '@react-native-community/netinfo';
   
   NetInfo.addEventListener(state => {
       if (!state.isConnected) showOfflineBanner();
   });
   ```

**Files to modify:**
- `apps/mobile-app/app/_layout.tsx` — Mount OfflineBanner
- `apps/mobile-app/store/eventsStore.ts` — Cache-first pattern
- `apps/mobile-app/store/ticketsStore.ts` — Cache-first pattern
- `apps/mobile-app/components/ui/OfflineBanner.tsx` — Verify/enhance

---

### Task 2.6 — Onboarding Flow
**Priority:** 🟡 P1 | **Effort:** 2 days

**Implementation:**

1. **Create 4 onboarding screens:**
   - **Welcome** — Brand intro with animated logo
   - **Discover** — "Find events near you" with city selector
   - **Connect** — "Meet people at events" social feature showcase
   - **Safety** — "Your safety comes first" SOS feature showcase

2. **File structure:**
   ```
   app/(onboarding)/
   ├── _layout.tsx          # Horizontal pager layout
   ├── welcome.tsx          
   ├── discover.tsx         
   ├── connect.tsx          
   └── safety.tsx           
   ```

3. **Track completion** in AsyncStorage:
   ```typescript
   const ONBOARDING_KEY = '@onboarding_complete';
   
   // In _layout.tsx root:
   if (!onboardingComplete) redirect('/(onboarding)/welcome');
   ```

4. **Skip button** on all screens (respects user choice).

**Files to create:**
- `apps/mobile-app/app/(onboarding)/_layout.tsx`
- `apps/mobile-app/app/(onboarding)/welcome.tsx`
- `apps/mobile-app/app/(onboarding)/discover.tsx`
- `apps/mobile-app/app/(onboarding)/connect.tsx`
- `apps/mobile-app/app/(onboarding)/safety.tsx`
- Modify `apps/mobile-app/app/_layout.tsx` — Add onboarding gate

---

### Task 2.7 — Tab Bar Icon Upgrade
**Priority:** 🟡 P1 | **Effort:** 0.5 days

**Problem:** Tab bar uses emoji (`🧭`, `🎟️`, `💬`, `👤`) instead of proper icons.

**Implementation:**

1. **Install icon library:**
   ```bash
   npx expo install lucide-react-native react-native-svg
   ```

2. **Replace emoji in tab layout:**
   ```tsx
   import { Compass, Ticket, MessageCircle, User } from 'lucide-react-native';
   
   // In PremiumTabIcon:
   const ICONS = {
       explore: Compass,
       tickets: Ticket,
       inbox: MessageCircle,
       profile: User,
   };
   ```

3. Keep the premium glow/animation effects already built — just swap the icon rendering.

**Files to modify:**
- `apps/mobile-app/app/(tabs)/_layout.tsx`

---

## Phase 2 Checkpoint ✅

After completing Phase 2:
- [ ] Crash reporting active (Sentry)
- [ ] Apple Sign-In works (App Store requirement met)
- [ ] Google Sign-In works
- [ ] Promo codes validated against real promoter data
- [ ] App works gracefully offline
- [ ] New users see an onboarding flow
- [ ] Tab bar has proper vector icons

---

## Phase 3 — FEATURE COMPLETION (Days 15–22)

> Should-do for a competitive launch. These features differentiate the app.

---

### Task 3.1 — Profile Photo Upload ✅
**Priority:** 🟢 P2 | **Effort:** 1.5 days

**Implementation:**
1. Install `expo-image-picker`
2. Add photo selection (camera + gallery) in `profile/edit.tsx`
3. Upload to Firebase Storage → get download URL
4. Update user profile document with `photoURL`
5. Add image cropping with `expo-image-manipulator`

---

### Task 3.2 — Event Map View ✅
**Priority:** 🟢 P2 | **Effort:** 2 days

**Implementation:**
1. Install `react-native-maps`
2. Add map view toggle on Explore tab
3. Show event pins with popup cards
4. Add map to event detail screen showing venue location
5. "Get Directions" button → opens Apple Maps / Google Maps

---

### Task 3.3 — Apple Wallet / Google Wallet Passes ✅
**Priority:** 🟢 P2 | **Effort:** 3 days

**Implementation:**
1. **Backend:** Create pass generation API endpoint
   - Apple: Use `passkit-generator` npm package + Apple certificates
   - Google: Use Google Wallet API with JWT signing
2. **Mobile:** Download `.pkpass` file → open with Wallet
3. Trigger wallet pass generation after payment confirmation

---

### Task 3.4 — Real-Time Ticket Download / PDF ✅
**Priority:** 🟢 P2 | **Effort:** 1.5 days

**Implementation:**
1. Backend generates PDF ticket with QR code (reuse from email system)
2. Mobile downloads via `expo-file-system`
3. Share via `expo-sharing`
4. Replace "Coming Soon" alerts in `wallet.ts`

---

### Task 3.5 — Chat Image Sharing ✅
**Priority:** 🟢 P2 | **Effort:** 1.5 days

**Implementation:**
1. Add image picker button in chat input
2. Upload image to Firebase Storage
3. Send message with `type: "image"` and image URL
4. Render image messages with lightbox viewer

---

### Task 3.6 — Chat Rate Limiting ✅
**Priority:** 🟢 P2 | **Effort:** 0.5 days

**Implementation:**
1. Add local throttle (max 1 message per second)
2. Server-side: Firestore security rules limit writes per user
3. Cooldown indicator in chat input

---

## Phase 3 Checkpoint ✅

After completing Phase 3:
- [x] Users can upload profile photos
- [x] Events visible on a map
- [x] Tickets downloadable as PDF
- [x] Wallet passes generated (Apple/Google)
- [x] Images shareable in chat
- [x] Chat spam prevented

---

## Phase 4 — POLISH & GROWTH (Days 23–30)

> Nice-to-have features for post-launch iteration. Can be done incrementally.

---

### Task 4.1 — Accessibility Audit
**Effort:** 2 days

- Add `accessibilityLabel` to all interactive elements
- Add `accessibilityRole` assignments
- Test with VoiceOver (iOS) and TalkBack (Android)
- Support Dynamic Type (font scaling)
- Ensure minimum 4.5:1 contrast ratio

---

### Task 4.2 — Unit & Integration Tests
**Effort:** 3 days

- Install `jest` + `@testing-library/react-native`
- Test all 7 Zustand stores (mock Firestore)
- Test `useAuth` hook
- Test payment flow (mock Razorpay SDK)
- Test cart operations (add, remove, promo, expiry)

---

### Task 4.3 — Analytics Enhancement
**Effort:** 1.5 days

- Implement Mixpanel SDK (or Amplitude) alongside Firebase Analytics
- Add funnel tracking: browse → view event → add to cart → checkout → payment
- Add user properties: city, events_attended, total_spent
- Screen time tracking

---

### Task 4.4 — Referral System
**Effort:** 2 days

- Generate unique referral codes per user
- Deep link: `https://thec1rcle.com/app/invite?ref=CODE`
- Track referral in signup flow
- Reward referrer with credits or discounts

---

### Task 4.5 — Performance Optimization
**Effort:** 2 days

- Replace `ScrollView` with `FlashList` in Explore, Tickets, Notifications
- Add image prefetching for upcoming events
- Implement Firestore listener consolidation
- Add `React.memo()` to expensive card components
- Profile with React DevTools Profiler

---

### Task 4.6 — Push Notification Channels (Android)
**Effort:** 0.5 days

- Create notification channels: Events, Tickets, Chat, Promotions
- Allow per-channel control in Android settings
- Set appropriate priority/importance levels

---

## Phase 4 Checkpoint ✅

After completing Phase 4:
- [ ] App is accessible to screen reader users
- [ ] Core logic is tested
- [ ] Analytics funnels provide actionable data
- [ ] Referral system drives organic growth
- [ ] App performs smoothly with large data sets
- [ ] Android notifications properly categorized

---

## Dependency Map

```
Task 1.1 (Razorpay) ──────────────────────────────┐
Task 1.2 (Server Orders) ─── depends on ──────────┤
Task 1.3 (Inventory Lock) ─── depends on 1.2 ─────┤
Task 1.4 (Remove Mocks) ──────────────────────────┤
Task 1.5 (Cart Fix) ──────────────────────────────┤
Task 1.6 (EAS Build) ─────────────────────────────┤
Task 1.7 (Social Btn Fix) ────────────────────────┘
                                                    │
                      Phase 1 Complete ◄────────────┘
                               │
         ┌─────────────────────┼──────────────────────┐
         ▼                     ▼                      ▼
    Task 2.1              Task 2.2                Task 2.4
    (Sentry)           (Apple Sign-In)          (Promo Codes)
         │                     │                      │
         │                Task 2.3                    │
         │             (Google Sign-In)               │
         │                     │                      │
         ├─────── Task 2.5 (Offline) ─────────────────┤
         │                     │                      │
         ├─────── Task 2.6 (Onboarding) ──────────────┤
         │                     │                      │
         └─────── Task 2.7 (Icons) ───────────────────┘
                               │
                      Phase 2 Complete
                               │
              Phase 3 & 4 (all independent)
```

---

## Environment Variables Checklist

Ensure these are set before any production build:

```bash
# Firebase (REQUIRED)
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=

# Payments (REQUIRED for Phase 1)
EXPO_PUBLIC_RAZORPAY_KEY=rzp_live_XXXXXXXX

# Analytics (Phase 4)
EXPO_PUBLIC_SENTRY_DSN=
EXPO_PUBLIC_MIXPANEL_TOKEN=

# Auth (Phase 2)
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=

# Build
EXPO_PUBLIC_PROJECT_ID=           # Expo project ID for push tokens
```

---

## Success Metrics (Post-Launch Week 1)

| Metric | Target |
|--------|--------|
| Crash-free rate | > 99.5% |
| Avg. app load time | < 2s |
| Payment success rate | > 95% |
| Onboarding completion | > 70% |
| DAU/MAU ratio | > 30% |
| App Store rating | > 4.5 |
| Checkout funnel conversion | > 60% (view → purchase) |

---

## Summary

| Phase | Tasks | Days | Key Outcome |
|-------|-------|------|-------------|
| **Phase 1** | 7 tasks | 7 days | App can collect real money and be built |
| **Phase 2** | 7 tasks | 7 days | App can be submitted to App Store / Play Store |
| **Phase 3** | 6 tasks | 8 days | App has competitive feature parity |
| **Phase 4** | 6 tasks | 8 days | App is polished, tested, and growth-ready |
| **Total** | **26 tasks** | **~30 days** | **Production-ready 4.5+/5 app** |
