# 📱 THE C1RCLE — Mobile Backend Integration Plan (V1)

## 1. Core Architecture: The "State-to-Cloud" Bridge
The mobile app acts as the primary execution layer for the platform's multi-party backend.

| Mobile Layer | Backend Connection | Source of Truth |
| :--- | :--- | :--- |
| **Auth State** | Firebase Auth + `authStore.ts` | Global UID |
| **Event Feed** | `eventsStore.ts` ↔ `eventStore.js` | Firestore `events` collection |
| **Cart/Booking** | `cartStore.ts` ↔ `inventory-engine.js` | Firestore `transactions` / `reservations` |
| **Tickets/QR** | `ticketsStore.ts` ↔ `order-state-machine.js`| Firestore `orders` collection |
| **Payments** | `lib/api/payments.ts` ↔ Next.js API Routes | Razorpay + `ledger-engine.js` |

---

## 2. Integration Phases

### Phase 1: Event Discovery & Lifecycle Sync ✅
*Goal: Ensure the mobile app always shows real-time, valid events.*
- **Logic**: Use the `resolvePoster` and `mapEventForClient` logic from `@c1rcle/core` to normalize data.
- **Filter**: Implement `PUBLIC_LIFECYCLE_STATES` (`SCHEDULED`, `LIVE`) to hide drafts or cancelled events.
- **Location**: Connect `safety.ts` (GeoPoint) to the `fetchEvents` query to sort events by proximity to the user.

### Phase 2: High-Integrity Ticketing & Inventory ✅
*Goal: Prevent over-selling and handle the "10-minute hold" logic.*
- **Step 1: Reservation**: When a user selects a ticket, call the `reserveTickets` endpoint. This triggers the `inventory-engine.js` to create a `RESERVATION` document.
- **Step 2: Sync**: The `cartStore.ts` must listen to the `pricing-engine.js` to apply real-time "Early Bird" vs "Regular" pricing.
- **Step 3: Cart Lock**: Implement the 10-minute timer in the mobile UI synced with the backend `expiresAt` field.

### Phase 3: Financial Bridge (Razorpay & Ledger) ✅
*Goal: Secure checkout and instant ticket issuance.*
- **Step 1: Order Creation**: Before Razorpay opens, create a `pending_payment` order.
- **Step 2: Webhook Handshake**: Mobile app waits for the `razorpay_payment_id`. Backend listens for the Razorpay Webhook to move the order to `confirmed` and triggers `ledger-engine.js`.
- **Step 3: Fulfillment**: Generate the `OrderTicket` package and sync it to the user's mobile `ticketsStore.ts`.

### Phase 4: Security & Entry (Member Pass) ✅
*Goal: Connection to the Scanner App.*
- **Step 1: HMAC Signing**: The mobile app generates a QR code using the `qrStore.js` logic (Order ID + Salt + Timestamp).
- **Step 2: Entitlement Check**: Backend `entitlement-engine.js` validates if the ticket allows entry to specific zones (VIP vs General).
- **Step 3: Live Check-in**: Use a Firestore listener in the mobile app. When the staff member scans the ticket (Scanner App), the mobile ticket should instantly turn "Red/Checked-In" to prevent reuse.

### Phase 5: Social & Emergency Mesh ✅
- **Emergency SOS Hub**: Integrated mobile SOS triggers with Venue Security Dashboard (`sosAlerts` collection). Alerts now automatically include `venueId` and `location` for real-time response.
- **In-App Circle (Group Chat)**: Functional event-based group chats with `entitlementCheck` (only confirmed ticket holders can chat).
- **Pulse Followers**: Implemented venue "Follow" system on mobile with backend support for venues to send custom push notifications to their followers.
- **Venue Profiles**: Created premium mobile venue profiles with upcoming event listings and follow functionality.

### Phase 6: Production Readiness & Mobile Guidelines ✅
- **Environment & Config hygiene**: Implemented centralized `config.ts` with environment-specific variables.
- **Reliability & Observability**: Integrated centralized error handling and analytics tracking.
- **Offline Behavior**: Enabled persistence for stores and added network-aware checkout guards.
- **Mobile UX Rules**: Updated ticket detail screens with state-aware UI and SOS prompts.
- **Push & Deep Link mapping**: Enhanced deep link parsing and notification routing logic.
- **Safety & Abuse guardrails**: Implemented DM rate limiting and reporting flows.
- **Performance & Polish**: Optimized explore page with `FlashList` and memoization.

---
**Status Summary:**
- Phase 1: Event Discovery & Lifecycle Sync ✅
- Phase 2: High-Integrity Ticketing & Inventory ✅
- Phase 3: Financial Fulfillment & Ticket Issuance ✅
- Phase 4: Security & Entry (Member Pass) ✅
- Phase 5: Social & Emergency Mesh ✅
- Phase 6: Production Readiness & Mobile Guidelines ✅

**Final Verification Notes:**
- HMAC QR codes verified using `react-native-qrcode-svg`.
- SOS location sharing uses Expo Location with background permissions.
- Push Notifications integrated with Expo Push Service for venue-to-user communication.

---

## 3. Key Files & Connection Points

### Shared Logistics (packages/core)
- **`inventory-engine.js`**: Atomic ticket decrements using Transactions.
- **`order-state-machine.js`**: Order lifecycle (Reserved → Paid → Scanned).
- **`ledger-engine.js`**: Accounting logic for platform vs venue splits.
- **`entitlement-engine.js`**: Zone-based entry validation.

### Mobile Connectors (c1rcle-mobile-standalone)
- **`store/cartStore.ts`**: State management for user selections.
- **`lib/api/ticketing.ts`**: API wrapper for reservations.
- **`lib/safety.ts`**: Geo-fencing and SOS logic.
- **`lib/social/`**: Private DM and Group Chat logic.

---

## 4. Operational Success Criteria
1. **Consistency**: No ticket can be sold twice (Inventory Lock).
2. **Auditability**: Every order must have a corresponding Ledger entry.
3. **Availability**: Event Discovery must work offline (Cache) but validate online before checkout.
4. **Safety**: SOS triggers must notify the correct Venue ID in < 2 seconds.

---

## 5. Mobile-Specific Production Guidelines

### 5.1 Environment & Config Hygiene

| Variable | Dev | Staging | Prod |
| :--- | :--- | :--- | :--- |
| `MOBILE_ENV` | `dev` | `staging` | `prod` |
| `API_BASE_URL` | `http://localhost:3000` | `https://staging.thec1rcle.com` | `https://thec1rcle.com` |
| `RAZORPAY_KEY_ID` | `rzp_test_xxx` | `rzp_test_xxx` | `rzp_live_xxx` |
| Firebase Project | `c1rcle-dev` | `c1rcle-staging` | `c1rcle-prod` |

**Implementation:**
- Single `lib/config.ts` reads `EXPO_PUBLIC_MOBILE_ENV` and exports correct values.
- Deep link schemes: `c1rcle-dev://`, `c1rcle-staging://`, `c1rcle://` (prod).
- Push notification channels are env-prefixed to avoid spamming real users during testing.

---

### 5.2 Reliability & Observability

**Central Error Handler (`lib/errorHandler.ts`):**
```typescript
async function handleApiError(error: any, context: string) {
  console.error(`[${context}]`, error);
  if (MOBILE_ENV === 'prod') {
    Sentry.captureException(error, { extra: { context } });
  }
  showToast("Something broke, we're on it.", "error");
}
```
- Wrap all API calls (ticketing, payments, social, safety) with `handleApiError()`.

**Analytics Events:**
| Key Flow | Event Name |
| :--- | :--- |
| User views event | `event_viewed` |
| Purchase complete | `ticket_purchased` |
| Checkout abandoned | `checkout_abandoned` |
| Ticket sent to friend | `ticket_transferred` |
| SOS triggered | `sos_triggered` |
| Chat message sent | `chat_message_sent` |

---

### 5.3 Offline & "Janky Network" Behavior

| Screen | Behavior |
| :--- | :--- |
| **Explore / Events** | Show cached events instantly → refresh in background with `stale-while-revalidate` pattern. |
| **My Tickets** | Tickets & QR available **completely offline**. Once ledger says "Confirmed" → cache QR + metadata securely in `expo-secure-store`. |
| **Checkout** | **Hard block** if network is unstable. No "half paid" states. Clear expired reservations if user returns after a long time. |
| **Social Chat** | Queue messages offline → send when back online. Show "pending" indicator. |

---

### 5.4 Mobile UX Rules by Order State

| State | User Sees |
| :--- | :--- |
| `RESERVED` | "Held for 10:00" countdown timer. If expires → automatic cart clear + banner: "Your tickets were released." |
| `PAYMENT_PENDING` | Disable changing quantities. Show "Finalising payment…" spinner. Back button disabled. |
| `CONFIRMED` | Fire confetti 🎉. Show "Ticket added to wallet." Prompt "Add to calendar." |
| `CHECKED_IN` | Ticket detail greyed out. Badge: "✓ Used at 10:42 PM". QR no longer interactive. |
| `CANCELLED` | Ticket hidden from main list. Accessible via "Order History" with "Refund processed" label. |

---

### 5.5 Push Notifications & Deep Links

**Notification Types:**
| Trigger | Action on Tap |
| :--- | :--- |
| `ticket_confirmed` | Open `/ticket/:orderId` |
| `event_starts_soon` | Open `/event/:id` |
| `chat_new_message` | Open `/social/group/:eventId` |
| `ticket_transferred_to_you` | Open `/tickets` tab + highlight new ticket |
| `sos_acknowledged` | Open `/safety` |

**Deep Link Patterns (shared web + app):**
```
c1rcle://event/:id
c1rcle://ticket/:orderId
c1rcle://transfer/:code
c1rcle://chat/:eventId
c1rcle://safety
```
- Web fallback: `https://thec1rcle.com/event/:id` (same pattern).

---

### 5.6 Safety & Abuse Guardrails

**Default On:**
- DM rate limiting: Max 10 new conversations per day.
- "Report user" button visible from chat and profile views.
- Blocked users cannot see each other in attendee lists.

**Copy Guidelines:**
- Soft language for rate limits: *"You've reached today's new chat limit. Try again tomorrow."*
- Never shame the user.

**SOS Accessibility Rule:**
SOS button must be **one tap away** from:
- Ticket detail screen
- Event group chat
- Profile → Safety section

---

### 5.7 Performance & Polish

**Skeleton Loaders:**
- Explore events grid
- My Tickets list
- Chat message list
- Venue profile

**Preload Strategy:**
- After login → fetch user's upcoming tickets immediately.
- When viewing event → preload cover artwork for smoother transitions.

**Avoid Heavy Re-renders:**
- Separate `chatListStore` and `chatRoomStore` to prevent full list re-renders on new messages.
- Memoize `EventCard` and `TicketCard` components with `React.memo`.
- Use `FlashList` over `FlatList` for long lists (events, messages).

---

## 6. Final Checklist Before Launch

- [x] All env variables set correctly for prod
- [x] Sentry/analytics hooked up
- [x] Offline ticket access tested on airplane mode
- [x] Push notifications tested end-to-end
- [x] Deep links tested from SMS/email
- [x] SOS tested with venue security dashboard
- [x] Rate limits tested (DMs, checkout retries)
- [x] Skeleton loaders on all main screens
- [x] QR codes scannable in low light (brightness boost on ticket screen)
