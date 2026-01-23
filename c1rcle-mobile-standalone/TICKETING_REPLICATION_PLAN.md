# Mobile Ticketing System Replication Plan

## Objective
Replicate the full ticketing engine logic, database interactions, and user flows from the C1RCLE web guest portal into the mobile application. Ensure 100% parity for ticket tiers, cart reservations, pricing calculations, promo codes, and order success flows.

## Core Principles
1. **Source of Truth**: The `guest-portal` API routes (`/api/checkout/*`) are the primary source of truth for all ticketing operations.
2. **Atomic Operations**: Use server-side reservations to prevent overselling.
3. **Shared Logic**: Re-use logic from `@c1rcle/core` where possible, or mirror it exactly if library sharing is restricted by the mobile environment.

## Phase 1: API Foundation
- [ ] Create `lib/api/ticketing.ts`: Centralized service for ticketing API calls.
- [ ] Implement `API_BASE_URL` configuration.
- [ ] Add support for `Authorization` headers (Firebase ID tokens).

## Phase 2: Cart & Inventory
- [ ] Update `store/cartStore.ts`:
    - [ ] `reserveTickets(eventId, items)`: Call `/api/checkout/reserve`.
    - [ ] `calculatePricing(eventId, items, promoCode, promoterCode)`: Call `/api/checkout/calculate`.
    - [ ] Implement 10-minute reservation timer state.
    - [ ] Handle inventory errors (sold out, limits).

## Phase 3: Checkout Flow
- [ ] **Promo Codes**: Real-time validation via API.
- [ ] **Promoter Links**: Capture promoter codes from deep links and apply them.
- [ ] **Checkout Initiation**:
    - [ ] Call `/api/checkout/initiate`.
    - [ ] Handle `requiresPayment` logic.
    - [ ] Integrate Razorpay mobile SDK (or web fallback).
- [ ] **Instant RSVP**: Handle ₹0 tickets with immediate confirmation.

## Phase 4: My Tickets (Wallet)
- [ ] Fetch real orders from Firestore `orders` collection.
- [ ] Implement a premium "Ticket Card" with:
    - [ ] Dynamic QR Code (Order ID + HMAC).
    - [ ] Sparkle/Metallic animation for premium feel.
    - [ ] "Tonight" badge for same-day events.
- [ ] Detail view with event info, entry rules, and "Add to Apple Wallet" (Mocked/Future).

## Phase 5: Social Ticketing (Phase 2)
- [ ] Ticket Transfers (Send to friend).
- [ ] Resale if applicable.

## Refinement (Visual Excellence)
- [ ] Glassmorphic summary in cart.
- [ ] Haptic feedback on ticket selection.
- [ ] Cinematic success animation after purchase.
