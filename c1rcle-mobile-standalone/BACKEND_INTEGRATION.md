# THE C1RCLE Mobile - Backend Integration Summary

## ✅ Connected to Real Backend

The mobile app is now fully connected to the same backend, database, and business logic as the website (guest portal).

---

## 🔐 Firebase Configuration

**Project**: `c1rcle-staging`  
**Location**: `lib/firebase/config.ts`

```typescript
projectId: "c1rcle-staging"
authDomain: "c1rcle-staging.firebaseapp.com"
storageBucket: "c1rcle-staging.firebasestorage.app"
```

✅ Same Firebase project as web - users, events, orders, tickets are shared.

---

## 🌐 API Configuration

**API Base URL**: `https://thec1rcle.com/api`  
**Location**: `lib/api/config.ts`

All ticketing operations call the same endpoints as the web guest portal:

| Endpoint | Purpose |
|----------|---------|
| `/checkout/reserve` | Reserve ticket inventory |
| `/checkout/calculate` | Calculate pricing with discounts |
| `/checkout/initiate` | Start checkout & payment |
| `/checkout/promo` | Validate promo codes |
| `/tickets/share` | Create share bundles |
| `/tickets/claim` | Claim shared tickets |
| `/tickets/transfer` | Transfer ticket ownership |
| `/payments` | Verify Razorpay payments |

---

## 📊 Firestore Collections (Same as Web)

| Collection | Purpose |
|------------|---------|
| `events` | All events (filtered by lifecycle) |
| `orders` | Paid orders |
| `rsvp_orders` | Free RSVP orders |
| `ticket_assignments` | Claimed tickets from shares |
| `notifications` | Push/in-app notifications |
| `users` | User profiles |
| `chats` | Event group chats |
| `dm_threads` | Direct messages |

---

## 🔄 Data Flow

### Events (Explore Tab)
```
eventsStore.fetchEvents()
  → Firestore query: events collection
  → Filter: lifecycle IN ['scheduled', 'live']
  → Filter: endDate >= now
  → Maps to Event type
```

### Tickets (My Tickets Tab)
```
ticketsStore.fetchUserOrders(userId)
  → Firestore query: orders WHERE userId == user.uid
  → Firestore query: rsvp_orders WHERE userId == user.uid  
  → Firestore query: ticket_assignments WHERE redeemerId == user.uid
  → Combines all into unified Order[] list
```

### Checkout
```
Mobile Cart → /checkout/reserve (hold inventory)
           → /checkout/calculate (get pricing)
           → /checkout/initiate (create order)
           → Razorpay payment
           → /payments (verify)
           → Order confirmed in Firestore
```

---

## 🚫 Removed Mock/Fake Data

- ❌ Mock notifications (was using hardcoded array in dev)
- ❌ Mock payments flag (was enabled in dev mode)
- ❌ Separate API base URL in ticketing.ts

---

## ✅ Verification Checklist

| Scenario | Status |
|----------|--------|
| Events from partner dashboard appear on mobile | ✅ |
| Tickets bought on web appear on mobile | ✅ |
| Tickets bought on mobile appear on web | ✅ |
| Share ticket on web → claim on mobile | ✅ |
| Share ticket on mobile → claim on web | ✅ |
| Transfer ticket on mobile → recipient sees on both | ✅ |
| Cancel/refund on admin → mobile reflects status | ✅ |
| No seeded/fake events in UI | ✅ |

---

## 🔗 Deep Links Supported

```
thec1rcle.com/event/[id]   → Event Detail
thec1rcle.com/ticket/[id]  → Ticket Detail  
thec1rcle.com/claim/[token] → Claim Shared Ticket
thec1rcle.com/transfer?code=[code] → Accept Transfer
```

---

## 📝 Environment Variables

For local development, override these in `.env`:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=c1rcle-staging
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...
```

Production defaults to `https://thec1rcle.com`.
