# THE C1RCLE - Guest Portal Exhaustive Production-Readiness Audit

**Date:** March 2026
**Scope:** Guest Portal (`apps/guest-portal`), API Gateway (`apps/api-gateway`), Shared Business Logic (`packages/core/src`), Database Query Paths (`lib/server`), and Frontend Orchestration (`CheckoutContainer.jsx`).
**Audience:** Technical Leadership, Staff Engineers, QA Leads, Security Teams.

---

## 1. Executive Summary: Production Readiness Assessment

The Guest Portal implements a modern, hybrid infrastructure using Next.js (RSC) for presentation and discovery, while offloading high-contention transactional workflows (checkout) to a dedicated Fastify API Gateway (`apps/api-gateway`) and unified business logic via `@c1rcle/core`.

**Current Status:** **NOT PRODUCTION READY.**

While the architectural blueprint is solid and the separation of concerns (Core Engine vs API vs Client) is an excellent pattern for scale, the implementation currently contains **critical flaws in database query fallbacks, unprotected checkout inventory locks, idempotent logic loopholes, and silent failure propagation** that will cause system outages under moderate-to-high load (e.g., ticket drops).

---

## 2. Architecture & Data Flow Analysis

### 2.1 The Architectural Split
The system attempts a CQRS-like split between read-heavy Discovery and write-heavy Transactions:
1. **Server-Side Rendered Reads (Direct DB Access):** Next.js Server Components and Server Actions inside `apps/guest-portal/lib/server/` (e.g., `eventStore.js`, `orderStore.js`) utilize the Firebase Admin SDK to communicate *directly* with Firestore.
2. **Client-Driven Transactions (API Gateway Orchestrated):** Complex mutations like reserving cart items or finalizing checkouts (`CheckoutContainer.jsx`) are routed via HTTP to `apps/api-gateway/src/routes/v1/checkout.ts`, which then interfaces with Firebase and the Core Engine (`packages/core/*`).
3. **Core Engine as Central Truth:** Both environments import modules from `@c1rcle/core` (e.g., `checkout-service.ts`, `pricing-engine`, `order-engine`).

### 2.2 Security Gap in API Client Implementation
In `apps/guest-portal/lib/server/apiClient.js`, the `getSystemApiClient()` initializes a client bypassing user auth by injecting `process.env.INTERNAL_API_KEY`. If this key leaks, or the API Gateway fails to strictly validate the boundary of "System Level Requests", an attacker could bypass checkout locks entirely.

**Recommendation:** The API Gateway must explicitly whitelist the IP of the Vercel/Next.js runtime for system-level calls, rather than relying solely on a static internal key.

---

## 3. End-to-End Workflow Audit: The Checkout Pipeline

The checkout workflow (`CheckoutContainer.jsx` → `checkout.ts` → `checkout-service.ts` → `orderStore.js`) is the most critical path.

### 3.1 Cart Reservation & Bot Vulnerability
**The Flow:** Client calls `POST /api/v1/checkout/reserve`. The gateway delegates to `CheckoutService.reserveItems`, triggering the `@c1rcle/core/inventory-engine` to create a Redis hold, which is then mirrored into Firestore (`createReservation` in `orderStore.js`).

**The Critical Flaw:**
In `checkout.ts` (Line 94-95):
```typescript
const { eventId, items, deviceId } = request.body;
const userId = request.user?.uid || deviceId || 'anonymous';
```
The API explicitly accepts `deviceId` from the client and allows reservations to proceed as `anonymous` if no token is provided. Because `inventory-engine` presumably locks tickets based on this reservation, **malicious actors (bots) can exhaust the entire event capacity in seconds** by sending parallel `/reserve` requests with randomly generated `deviceId` strings.

**The Fix:**
- Remove anonymous reservation capabilities entirely for highly demanded events, OR
- Implement strict IP-based rate limiting on the `/reserve` endpoint at the API Gateway level (e.g., max 2 active reservations per IP per 10 minutes).

### 3.2 Pricing and Discount Validation
The system applies discounts correctly by piping items through `calculatePricing` via `@c1rcle/core/pricing-engine`. However, in `CheckoutContainer.jsx`, the frontend recalculates `totalAmount` natively: `const totalAmount = Math.max(0, subtotal - totalDiscount);`
While the backend (`initiateCheckout`) securely calculates the true pricing, any UI discrepancy here will result in the user seeing one price in the browser but Razorpay charging another. Ensure the frontend strictly renders the `pricingResult` payload returned from `/initiate/checkout` rather than rebuilding the math locally.

### 3.3 Free Ticket & RSVP Bypass Loophole
**The Flow:** If an order triggers `pricing.isFree` or `event.isRSVP`, `CheckoutService.initiateCheckout` automatically sets the order status to `confirmed`.

**The Flaw in `CheckoutContainer.jsx`:**
When the frontend completes `/checkout/initiate`, if `initiateData.requiresPayment` is perfectly false, it branches to:
```javascript
setProcessingState("issuing");
setIsSuccess(true);
setTimeout(() => { router.push(`/confirmation/${initiateData.order.id}`); }, 2000);
```
While the backend handles this safely (`recordOrderCaptured(order, "INTERNAL_FREE", transaction)`), there is **zero error handling on the Next.js side if the API fails mid-flight or if the transaction times out during free confirmation**. The UI eagerly shows a success state, assuming the core engine succeeded.

---

## 4. Ticketing, Concurrency & Database Transactions

### 4.1 Missing Transaction Boundaries in Ledger Integration
Inside `orderStore.js:231`, the `createRSVPOrder` function and `createOrder` attempt to combine Firestore transactions with external logic.

**The Flaw:**
```javascript
await db.runTransaction(async (transaction) => {
    // 1. Transaction-level Idempotency Check...
    // 2. coreExecuteOrderCreation...
    // 3. recordOrderCaptured...
    // 4. issueEntitlements(order, order.tickets, transaction);
});
```
If `issueEntitlements` involves asynchronous heavy logic, or worse, calls out to external services (like sending an email or connecting to another system synchronously), the Firestore transaction will hold open locks on the `events` and `orders` documents. Under high load, this causes massive contention resulting in `ABORTED` transaction errors.

**The Fix:** Transactions should *only* perform simple reads/writes. Complex external orchestrations (`issueEntitlements`, triggering Inngest) must securely occur *after* the transaction commits, using atomic outbox patterns or queue messages.

### 4.2 Idempotency Reliance on Client-Side State
In `api-gateway/src/routes/v1/checkout.ts`, the `POST /checkout/initiate` endpoint relies entirely on the client passing `reservationId`.
If a client refreshes mid-payment, the state in `CheckoutContainer.jsx` (which stores `cartReservation` in React component state) is wiped. The user cannot recover their locked tickets, and those tickets sit frozen in Redis until expiration.

**The Fix:** `cartReservation` must be stored in `localStorage` or fetched dynamically on mount by querying active reservations for the authenticated `userId`.

---

## 5. Performance Bottlenecks & Missing Indexes

This is the most severe and immediate threat to production stability.

### 5.1 O(N) In-Memory Sorting Fallback (Critical Risk)
In `apps/guest-portal/lib/server/eventStore.js`, functions like `getEventInterested` and `getEventGuestlist` contain "try-catch fallbacks" for missing Firestore Indexes.

```javascript
// orderStore.js (Snippet)
try {
  ordersSnapshot = await db.collection("orders").where("eventId", "==", eventId).where("status", "==", "confirmed").limit(limit).get();
} catch (e) {
  if (e.message.includes("FAILED_PRECONDITION")) {
    console.warn("Index missing... Falling back to in-memory filter.");
    ordersSnapshot = await db.collection("orders").where("eventId", "==", eventId).limit(limit).get();
    const docs = ordersSnapshot.docs.filter(doc => doc.data().status === "confirmed");
    // ...
```
**Impact:** If a highly popular event has 10,000 abandoned checkout attempts (status=pending, cancelled) and 500 confirmed attendees, the application pulls all 10,500 documents into the Node.js memory space to filter out the 500 confirmed attendees. This will trigger massive Vercel Serverless Function timeout errors (10s max) and OOM (Out Of Memory) crashes.

**The Fix:** The `firestore.indexes.json` MUST be strictly defined and deployed via `firebase deploy --only firestore:indexes`. The try-catch memory-sort fallbacks should be completely deleted from the codebase, as they hide the problem during dev but break the app in prod.

### 5.2 Algolia Fallback & Caching
`eventStore.js` correctly integrates Algolia for high-speed discovery. However, if Algolia fails, the code falls back to raw Firestore queries. Combining Firestore inequality constraints (`endDate >= nowIso`) with sorting (`heatScore desc`) requires highly specific composite indexes. Ensure a fast-fail strategy where if Algolia is down, a heavy redis-cached version of the event listing is served, rather than hammering Firestore.

---

## 6. Code Quality & UX Gaps

### 6.1 Unsafe Promise Management
In `orderStore.js`, post-creation tasks suppress errors dangerously:
```javascript
// Per-Ticket Identity: Auto-create share bundles
try {
    for (const ticket of order.tickets) {
        await createShareBundle(order.id, order.userId, order.eventId, ticket.quantity, ticket.ticketId);
    }
} catch (err) {
    console.error("Failed to auto-create share bundles:", err);
}
```
If `createShareBundle` fails, the order succeeds but the user has no ticket identity bundle generated to access their QR code, resulting in a silent failure state where they paid but cannot enter.

### 6.2 Cancellation Leak in Razorpay Modal Dismissal
In `CheckoutContainer.jsx:318`:
```javascript
modal: {
    ondismiss: async function () {
        await fetch(`${gatewayUrl}/api/v1/checkout/cancel`, { /* ... */ });
    }
}
```
If the user closes the payment tab entirely instead of clicking the modal's close button, this JS will never fire. The ticket remains locked until the TTL expires randomly via `inventory-engine`. An explicit heartbeat or background Cron cleanup mechanism is required on the backend to prune pending Razorpay intent locks.

---

## 7. Actionable Launch Requirements

| Task Area | Risk Level | Required Action Before Launch |
| :--- | :--- | :--- |
| **Indexes** | **CRITICAL** | Deploy all composite Firestore indexes. Purge all `try-catch` "in-memory sorting" fallbacks from `eventStore.js` and `orderStore.js`. |
| **Checkout DDoS** | **CRITICAL** | Introduce rate-limiting (Upstash/Redis) on `POST /api/v1/checkout/reserve`. Remove anonymous reservations for high-capacity events. |
| **Idempotency** | HIGH | Persist `reservationId` to `localStorage` or DB session so users can recover their locked cart if they accidentally hit refresh. |
| **Data Integrity** | HIGH | Ensure Inngest and ShareBundle triggers are guaranteed executions (Outbox pattern) rather than floating `try/catch` blocks post-transaction. |
| **Security** | HIGH | Route all Firebase Admin operations in Next.js Server Actions through strict Auth payload validation, or proxy everything through the API Gateway. |
| **Pricing Validation**| MED | Prevent the Next.js UI from independently resolving `totalAmount` math. Render exactly what `/initiate` returns to prevent Razorpay amount mismatch bugs. |

## 8. Final Verdict
The codebase demonstrates advanced architectural foresight (Redis locking, Entitlement Engine separation, RSC). However, the implementation is **vulnerable to bot exhaustions, memory leaks due to missing indexes, and edge-case state wipes during checkout.**

Do not launch the Guest Portal until the **Indexes** and **Checkout DDoS** Action Items are fully resolved.
