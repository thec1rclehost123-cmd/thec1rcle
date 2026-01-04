# THE C1RCLE — Ticketing System Implementation Plan

## Document Version: 2.0 (Revised)
## Created: 2026-01-03
## Status: Phase 1 Implementation Specification

---

## Executive Summary

This document defines the **Phase 1** implementation specification for THE C1RCLE's ticketing system. The plan is scoped to ship a complete, production-ready ticketing flow that integrates with the existing platform architecture—respecting dashboard boundaries, partnership rules, and admin governance.

**Core Principle:** A ticket is a governed digital entitlement issued through a controlled workflow where **clubs control venues**, **hosts control events**, and **promoters drive sales**.

---

## 1. Phase Split

### Phase 1 — Ship Now (This Document)
| Feature | Description |
|---------|-------------|
| Ticket Tiers | Stag, Couple, Female, General, VIP |
| Scheduled Pricing | Early bird, regular, last call via timestamps |
| Promoter Attribution | Link/code tracking with commission |
| Buyer Discounts | Via promoter link with cascading toggles |
| Promo Codes | Public, private, single/multi-use with limits |
| Cart Reservation | Timer-based hold to prevent oversell |
| Free RSVP | Instant QR ticket on RSVP |
| Paid Checkout | Gateway redirect, tickets only after verified payment |
| QR Scanning | Duplicate prevention, staff actor logging |
| Refunds | Request flow with admin dual approval above threshold |
| Club Staff RBAC | Invite, verify, assign roles, device binding |
| Event Lifecycle | Draft → Submitted → Approved → Published → Completed |

### Phase 2 — Next Release
| Feature | Description |
|---------|-------------|
| Ticket Transfers | Send to another user with acceptance flow |
| Resale Marketplace | P2P resale with price caps |
| Chargebacks | Dispute evidence bundles |
| Advanced Bundles | BOGO patterns, group bundles |
| Table Packages | Minimum spend, covers, entry bundles |
| Add-ons | Drink coupons, merch, parking, etc. |

---

## 2. Dashboard Authority Model

### 2.1 Strict Ownership Rules

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DASHBOARD AUTHORITY BOUNDARIES                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CLUB DASHBOARD                                                              │
│  ├── Controls: Venue capacity, calendar, blocked windows                    │
│  ├── Controls: Staff RBAC, scanner devices, entry rules                     │
│  ├── Controls: Final publish approval for host events                       │
│  ├── Controls: Scanning operations, entry logs                              │
│  ├── Can View: Full event details for their venue                          │
│  └── Cannot: Create events for other venues                                 │
│                                                                              │
│  HOST DASHBOARD                                                              │
│  ├── Controls: Event configuration, ticket tiers, pricing                   │
│  ├── Controls: Promoter settings, promo codes                               │
│  ├── Controls: Event media, description, settings                           │
│  ├── Can View: Availability windows (NOT full club calendar)               │
│  ├── Can View: Guest list summary (NOT entry operations)                    │
│  └── Cannot: Publish without club approval, control entry system           │
│                                                                              │
│  PROMOTER DASHBOARD                                                          │
│  ├── Controls: Generate links/codes for assigned events                     │
│  ├── Can View: Own sales, earnings, payout status                           │
│  ├── Can View: Click and conversion counts                                  │
│  └── Cannot: See buyer PII, mutate events, see other promoter stats        │
│                                                                              │
│  ADMIN PANEL                                                                 │
│  ├── Controls: Override any state with audit trail                          │
│  ├── Controls: Dual approval for high-risk actions                          │
│  ├── Controls: Refund approval, event pause/unpublish                       │
│  └── Can View: Everything with full audit trail                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Host View Restrictions

Hosts must NEVER see:
- Event titles or metadata for blocked windows (only "Unavailable")
- Club internal notes
- Other hosts' events at the venue
- Staff schedules or assignments
- Entry operation details

Hosts CAN see:
- Available date/time windows
- Their own slot request status
- Their own event guest list (names only, not entry logs)
- Their own event performance metrics

### 2.3 Promoter View Restrictions

Promoters must NEVER see:
- Buyer email, phone, or payment details
- Other promoters' statistics
- Event configuration or settings
- Entry logs or scan results

Promoters CAN see:
- Event basic info (title, date, venue)
- Their own link/code performance
- Click count, conversion count, commission earned
- Payout request status

---

## 3. Event Lifecycle State Machine

### 3.1 States and Transitions

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           EVENT LIFECYCLE STATES                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   HOST CREATES                                                                │
│        │                                                                      │
│        ▼                                                                      │
│   ┌─────────┐                                                                │
│   │  DRAFT  │ ────── Save & Resume ────▶ Still DRAFT                        │
│   └────┬────┘                                                                │
│        │ HOST submits to club                                                │
│        ▼                                                                      │
│   ┌───────────┐                                                              │
│   │ SUBMITTED │ ────── Host can edit until club reviews                     │
│   └─────┬─────┘                                                              │
│         │                                                                     │
│    ┌────┴────┐                                                               │
│    ▼         ▼                                                               │
│ APPROVED  NEEDS_CHANGES ──── Host revises ──▶ SUBMITTED                     │
│    │                                                                         │
│    │ Club or Host publishes                                                  │
│    ▼                                                                         │
│ ┌───────────┐                                                                │
│ │ SCHEDULED │ ────── Public, tickets on sale                                │
│ └─────┬─────┘                                                                │
│       │                                                                       │
│  ┌────┴────┬──────────┐                                                      │
│  ▼         ▼          ▼                                                      │
│ LIVE   PAUSED    CANCELLED                                                   │
│  │         │                                                                  │
│  ▼         │                                                                  │
│ COMPLETED ◄┘                                                                 │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 State Transition Permissions

| Transition | Who Can Execute | Requires |
|------------|-----------------|----------|
| draft → submitted | Host | Valid slot request |
| submitted → approved | Club | Slot approved |
| submitted → needs_changes | Club | Reason required |
| needs_changes → submitted | Host | Changes made |
| approved → scheduled | Host or Club | - |
| scheduled → live | System | Event start time reached |
| scheduled → paused | Club or Admin | Reason required |
| scheduled → cancelled | Club with Host consent, or Admin | Dual approval if tickets sold |
| paused → scheduled | Club or Admin | - |
| live → completed | System | Event end time reached |
| Any → cancelled | Admin | Dual approval, refund plan |

### 3.3 Club-Created Events

For events created by a club at their own venue:
- Skip submitted/approved states
- Draft → Scheduled directly
- Club retains all authority

---

## 4. Calendar and Slot Approval Spine

### 4.1 Calendar as the Gate

The club calendar is the **spine** of event creation:

1. Host selects a club partner they have an active partnership with
2. Host requests a slot (date + time window)
3. Club receives slot request notification
4. Club approves, rejects, or offers alternative
5. Only AFTER slot approval can host complete event creation
6. Slot approval reserves the venue for that event

### 4.2 What Hosts See vs What Clubs See

**Club Calendar View:**
- Full calendar with all events
- Blocked windows with reasons
- Pending slot requests
- Staff assignments per date
- Operational notes

**Host Calendar View:**
- Available windows only (green)
- Unavailable windows (gray, no details)
- Their own pending requests (yellow)
- Their own approved slots (blue)
- NO event titles, NO reasons, NO notes

### 4.3 Slot Request Schema

```javascript
interface SlotRequest {
    id: string;
    eventId: string;           // Draft event this is for
    
    // Parties
    hostId: string;
    hostName: string;
    clubId: string;
    clubName: string;
    
    // Requested window
    requestedDate: string;     // YYYY-MM-DD
    requestedStartTime: string;
    requestedEndTime: string;
    
    // Status
    status: 'pending' | 'approved' | 'rejected' | 'modified' | 'expired';
    
    // Response
    clubResponse?: string;
    alternativeDates?: string[];
    
    // Timing
    createdAt: string;
    expiresAt: string;         // Auto-expire after 48h
    respondedAt?: string;
}
```

---

## 5. Ticket Tier Schema (Phase 1)

### 5.1 Simplified Tier Structure

```javascript
interface TicketTier {
    id: string;
    name: string;
    description?: string;
    
    // Entry Type (Phase 1 only)
    entryType: 'stag' | 'couple' | 'female' | 'general' | 'vip';
    
    // Pricing
    basePrice: number;
    currency: 'INR';
    
    // Scheduled Pricing (Early Bird, Last Call)
    scheduledPrices?: {
        id: string;
        name: string;           // "Early Bird", "Regular", "Last Call"
        price: number;
        startsAt: string;
        endsAt: string;
    }[];
    
    // Inventory
    quantity: number;
    remaining: number;
    
    // Sale Window
    salesStart: string;
    salesEnd: string;
    
    // Purchase Limits
    minPerOrder: number;
    maxPerOrder: number;
    
    // Promoter Settings (if per-tier override)
    promoterEnabled: boolean;
    promoterCommission?: number;        // Override global
    promoterCommissionType?: 'percent' | 'fixed';
    promoterDiscount?: number;          // Buyer discount override
    promoterDiscountType?: 'percent' | 'fixed';
    
    // Visibility
    hidden: boolean;
    requiresCode: boolean;
    accessCode?: string;
    
    // Refund
    refundable: boolean;
    refundDeadlineHours?: number;       // Hours before event
    
    sortOrder: number;
}
```

### 5.2 Scheduled Pricing Logic

```javascript
function getEffectivePrice(tier, timestamp = new Date()) {
    // Check scheduled prices in order
    if (tier.scheduledPrices) {
        for (const schedule of tier.scheduledPrices) {
            const starts = new Date(schedule.startsAt);
            const ends = new Date(schedule.endsAt);
            if (timestamp >= starts && timestamp <= ends) {
                return schedule.price;
            }
        }
    }
    // Fall back to base price
    return tier.basePrice;
}
```

---

## 6. Promoter Toggle Hierarchy (Phase 1)

### 6.1 Cascading Toggle Design

```
EVENT LEVEL
├── Promoter Sales Master Toggle
│   ├── OFF: All promoter UI hidden, no links/codes possible
│   └── ON: Promoter tools enabled
│       │
│       ├── Default Commission Toggle
│       │   ├── ON: One global rate for all tiers
│       │   │   └── [Global Commission Rate Input]
│       │   └── OFF: Per-tier commission appears
│       │       └── [Per-tier inputs visible in tier cards]
│       │
│       └── Buyer Discount Toggle
│           ├── OFF: No buyer discounts via promoter
│           └── ON: Buyer discounts enabled
│               ├── Default Discount Toggle
│               │   ├── ON: One global discount for all tiers
│               │   │   └── [Global Discount Rate Input]
│               │   └── OFF: Per-tier discount appears
│               │       └── [Per-tier inputs visible in tier cards]
```

### 6.2 Enforcement Rules

1. **Commission + Discount cannot create negative margin**
   - Floor: Host must receive at least ₹10 per ticket
   - Validation runs on save and before checkout

2. **If promoter sales toggled OFF after sales occurred:**
   - Preserve existing promoter attribution for settled orders
   - Block new promoter conversions
   - Show warning in dashboard with affected order count
   - Audit log the toggle change

3. **Effective Rate Display**
   - Always show "Promoter earns: ₹X per ticket" or "X%"
   - Always show "Buyer saves: ₹X" or "X% off"
   - Calculated from either global default or tier override

---

## 7. Order Lifecycle State Machine

### 7.1 States

```javascript
const ORDER_STATES = {
    draft: 'Cart/selection state',
    reserved: 'Inventory held, awaiting payment',
    payment_pending: 'Payment initiated with gateway',
    confirmed: 'Payment verified, tickets issued',
    checked_in: 'Entry validated at venue',
    refund_requested: 'User requested refund',
    refunded: 'Refund processed',
    cancelled: 'Order cancelled (pre-payment)',
    expired: 'Cart/reservation expired'
};
```

### 7.2 Transition Rules

| From | To | Trigger | Permission |
|------|----|---------|------------|
| draft | reserved | Add to cart | User |
| reserved | payment_pending | Initiate checkout | User |
| reserved | expired | Timer ends (10 min default) | System |
| reserved | cancelled | User cancels | User |
| payment_pending | confirmed | Webhook confirms payment | System |
| payment_pending | reserved | Payment fails | System |
| confirmed | checked_in | QR scan at venue | Staff |
| confirmed | refund_requested | User requests | User |
| refund_requested | refunded | Admin approves | Admin |
| refund_requested | confirmed | Admin rejects | Admin |

### 7.3 Payment Confirmation Path

**Source of Truth:** Razorpay webhook

```
User pays on gateway
        │
        ▼
Razorpay processes
        │
        ├──── Success ────▶ Razorpay sends webhook
        │                           │
        │                           ▼
        │                   Our webhook handler
        │                           │
        │                   Verify signature
        │                           │
        │                   Update order status
        │                           │
        │                   Generate QR tickets
        │                           │
        │                   Record promoter conversion
        │                           │
        │                   Send confirmation email
        │
        └──── Failure ────▶ Order stays in payment_pending
                            │
                            User can retry
```

**Client Confirm Endpoint:**
- Only reconciles state
- Never issues tickets without verified gateway state
- Checks gateway status if webhook hasn't arrived
- Idempotent (same order ID = same result)

---

## 8. Free RSVP Flow

### 8.1 Instant QR Issuance

When ticket price is ₹0:
1. User selects free tier
2. Order created with status `confirmed` immediately
3. QR code generated instantly
4. Confirmation shown in-app
5. No payment gateway redirect

### 8.2 RSVP Controls

```javascript
interface RSVPTierSettings {
    maxRSVPs: number;           // Capacity limit
    maxPerUser: number;         // Per-user cap
    requiresApproval: boolean;  // Manual approval needed
    waitlistEnabled: boolean;   // Enable waitlist after full
}
```

---

## 9. Club Staff RBAC (Phase 1)

### 9.1 Staff Lifecycle

```
Manager invites staff (email)
        │
        ▼
Staff receives invite notification
        │
        ▼
Staff accepts (creates/links account)
        │
        ▼
Manager verifies staff identity
        │
        ▼
Staff is ACTIVE with assigned role
        │
        ├──── Can scan tickets (if role permits)
        ├──── Can view guest list (if role permits)
        └──── Actions logged with staff actor ID
```

### 9.2 Role Presets

| Role | Permissions |
|------|-------------|
| Scanner | Scan tickets only |
| Door Staff | Scan + view guest list |
| Supervisor | Scan + guest list + notes |
| Manager | All ops + staff management |
| Owner | Full access + billing |

### 9.3 Scanner Device Binding

```javascript
interface BoundDevice {
    id: string;
    deviceId: string;           // Hardware ID or generated
    name: string;               // "Door 1 iPad"
    staffId?: string;           // Assigned staff
    boundAt: string;
    lastActiveAt: string;
    status: 'active' | 'revoked';
}
```

---

## 10. QR Scanning System (Phase 1)

### 10.1 QR Payload Structure

```javascript
interface QRPayload {
    o: string;      // Order ID
    e: string;      // Event ID
    t: string;      // Ticket tier ID
    n: string;      // Ticket name (display)
    u: string;      // User ID
    q: number;      // Quantity
    et: string;     // Entry type
    ts: number;     // Timestamp
    v: number;      // Version
    sig: string;    // HMAC signature
}
```

### 10.2 Scan Validation Flow

```
Staff scans QR
        │
        ▼
Parse QR payload
        │
        ▼
Verify HMAC signature ────── Invalid ────▶ REJECT: Tampered
        │
        │ Valid
        ▼
Check event matches ────── Mismatch ────▶ REJECT: Wrong event
        │
        │ Matches
        ▼
Check order status ────── Not confirmed ────▶ REJECT: Not paid
        │
        │ Confirmed
        ▼
Check already scanned ────── Yes ────▶ REJECT: Already entered
        │
        │ No
        ▼
Record scan entry
        │
        ▼
APPROVE: Entry granted
```

### 10.3 Scan Record Schema

```javascript
interface TicketScan {
    id: string;
    orderId: string;
    eventId: string;
    ticketId: string;
    userId: string;
    
    // Result
    result: 'valid' | 'already_scanned' | 'invalid' | 'wrong_event';
    
    // Actor
    scannedBy: {
        uid: string;
        name: string;
        role: string;
    };
    
    // Device
    device: {
        id: string;
        name: string;
        bound: boolean;
    };
    
    timestamp: string;
}
```

---

## 11. Refund Flow with Admin Approval

### 11.1 Refund Request Flow

```
User requests refund
        │
        ▼
System checks refund policy
        │
        ├── Tier is non-refundable ────▶ REJECT immediately
        │
        ├── Past refund deadline ────▶ REJECT immediately
        │
        └── Eligible for refund
                │
                ▼
        Check amount threshold
                │
                ├── Below threshold ────▶ Auto-approve
                │       │
                │       ▼
                │   Process refund via Razorpay
                │
                └── Above threshold ────▶ Create proposal
                        │
                        ▼
                Admin reviews proposal
                        │
                        ├── Approve ────▶ Process refund
                        └── Reject ────▶ Notify user
```

### 11.2 Thresholds

| Threshold | Action |
|-----------|--------|
| Under ₹500 | Auto-approve, process immediately |
| ₹500 - ₹5,000 | Single admin approval |
| Over ₹5,000 | Dual admin approval |
| Event cancelled | Auto-refund all (separate flow) |

### 11.3 Refund Idempotency

```javascript
interface RefundRequest {
    id: string;
    orderId: string;
    idempotencyKey: string;     // `refund:${orderId}:${timestamp}`
    
    amount: number;
    reason: string;
    
    status: 'pending' | 'approved' | 'processing' | 'completed' | 'failed' | 'rejected';
    
    // Approval
    requiresApproval: boolean;
    proposalId?: string;
    approvedBy?: string;
    approvedAt?: string;
    
    // Processing
    razorpayRefundId?: string;
    processedAt?: string;
    failureReason?: string;
    
    createdAt: string;
}
```

---

## 12. Promo Code System (Phase 1)

### 12.1 Code Types

| Type | Behavior |
|------|----------|
| public | Anyone can use, visible on event page |
| private | Must know code to apply |
| single_use | One redemption total |
| multi_use | Limited redemptions per rules |

### 12.2 Promo Code Schema

```javascript
interface PromoCode {
    id: string;
    code: string;               // Unique, case-insensitive
    name: string;               // "VIP Friends & Family"
    
    // Discount
    discountType: 'percent' | 'fixed';
    discountValue: number;
    
    // Scope
    tierIds?: string[];         // Empty = all tiers
    
    // Limits
    maxRedemptions?: number;
    maxPerUser?: number;
    
    // Validity
    startsAt: string;
    endsAt: string;
    
    // Stats
    redemptionCount: number;
    
    // Status
    isActive: boolean;
    createdBy: string;
    createdAt: string;
}
```

### 12.3 Redemption Validation

```javascript
function validatePromoCode(code, order, context) {
    const promo = findPromoCode(code);
    
    if (!promo) return { valid: false, error: 'Invalid code' };
    if (!promo.isActive) return { valid: false, error: 'Code is inactive' };
    
    const now = new Date();
    if (now < new Date(promo.startsAt)) return { valid: false, error: 'Code not yet active' };
    if (now > new Date(promo.endsAt)) return { valid: false, error: 'Code has expired' };
    
    if (promo.maxRedemptions && promo.redemptionCount >= promo.maxRedemptions) {
        return { valid: false, error: 'Code has reached maximum uses' };
    }
    
    if (promo.maxPerUser) {
        const userUses = getUserRedemptionCount(context.userId, promo.id);
        if (userUses >= promo.maxPerUser) {
            return { valid: false, error: 'You have already used this code' };
        }
    }
    
    // Calculate discount
    const applicableItems = order.items.filter(item => 
        !promo.tierIds || promo.tierIds.length === 0 || promo.tierIds.includes(item.tierId)
    );
    
    if (applicableItems.length === 0) {
        return { valid: false, error: 'Code does not apply to selected tickets' };
    }
    
    const subtotal = applicableItems.reduce((sum, i) => sum + i.subtotal, 0);
    const discount = promo.discountType === 'percent' 
        ? (subtotal * promo.discountValue / 100)
        : Math.min(promo.discountValue, subtotal);
    
    return { valid: true, discount, code: promo };
}
```

---

## 13. Cart Reservation System

### 13.1 Reservation Flow

```
User selects tickets
        │
        ▼
Create cart reservation (10 min default)
        │
        ├── Decrement available inventory
        │
        └── Start timer countdown UI
                │
        ┌───────┴───────┐
        │               │
        ▼               ▼
User completes     Timer expires
checkout                │
        │               ▼
        │       Release reservation
        │               │
        │               ▼
        │       Restore inventory
        │
        ▼
Convert reservation to order
```

### 13.2 Race Condition Prevention

```javascript
// Firestore transaction example
async function reserveInventory(eventId, tierId, quantity, customerId) {
    const db = getAdminDb();
    
    return await db.runTransaction(async (transaction) => {
        const eventRef = db.collection('events').doc(eventId);
        const eventDoc = await transaction.get(eventRef);
        
        const event = eventDoc.data();
        const tier = event.tickets.find(t => t.id === tierId);
        
        // Check availability within transaction
        if (tier.remaining < quantity) {
            throw new Error('Not enough tickets available');
        }
        
        // Decrement
        tier.remaining -= quantity;
        
        // Create reservation
        const reservationRef = db.collection('cart_reservations').doc();
        const reservation = {
            id: reservationRef.id,
            eventId,
            customerId,
            items: [{ tierId, quantity }],
            status: 'active',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
        };
        
        transaction.update(eventRef, { tickets: event.tickets });
        transaction.set(reservationRef, reservation);
        
        return reservation;
    });
}
```

---

## 14. Files to Create/Modify

### 14.1 Service Modules (Inside Existing Apps)

Instead of `packages/core`, we build service modules within the apps first:

```
apps/partner-dashboard/
├── lib/server/
│   ├── ticketingService.js     # Tier CRUD, pricing logic
│   ├── inventoryService.js     # Reservation, availability
│   ├── promoCodeService.js     # Promo code validation
│   └── refundService.js        # Refund request handling
├── app/api/
│   ├── checkout/
│   │   ├── reserve/route.ts    # Cart reservation
│   │   ├── calculate/route.ts  # Price calculation
│   │   └── validate-code/route.ts
│   ├── orders/
│   │   ├── route.ts            # Create order
│   │   └── [id]/
│   │       └── refund/route.ts
│   └── club/
│       └── staff/
│           ├── route.ts        # Staff CRUD
│           └── devices/route.ts # Device binding
└── components/wizard/
    ├── TicketTierStep.tsx      # ENHANCED
    └── components/
        ├── PromoterToggles.tsx # Cascading toggle UI
        └── PricingSchedule.tsx # Scheduled pricing UI

apps/guest-portal/
├── lib/server/
│   ├── checkoutService.js      # Checkout orchestration
│   └── paymentService.js       # Razorpay integration
├── app/api/
│   ├── checkout/
│   │   ├── reserve/route.js
│   │   └── calculate/route.js
│   ├── webhooks/
│   │   └── razorpay/route.js   # Payment webhook handler
│   └── orders/
│       └── [id]/
│           └── refund/route.js
└── components/checkout/
    ├── CartTimer.jsx           # Reservation countdown
    └── PromoCodeInput.jsx

apps/admin-console/app/
├── tickets/
│   └── page.jsx                # Ticket overview
├── refunds/
│   └── page.jsx                # Refund approval queue
└── api/
    └── admin/
        └── refunds/
            └── [id]/
                └── route.js    # Approve/reject
```

### 14.2 Files to Modify

```
apps/partner-dashboard/
├── lib/server/eventStore.js        # Add ticketing fields
├── lib/server/orderStore.js        # Add state machine
├── components/wizard/
│   ├── CreateEventWizard.tsx       # Add promoter toggles step
│   └── TicketTierStep.tsx          # Enhanced with all Phase 1 features

apps/guest-portal/
├── lib/server/orderStore.js        # Enhance with reservations
├── lib/server/qrStore.js           # Already exists, may need updates
├── components/
│   ├── TicketModal.jsx             # Add promo code input
│   └── CheckoutContainer.jsx       # Add cart timer

apps/admin-console/app/
└── page.jsx                        # Add ticketing stats

firestore.rules                     # Add new collections
```

---

## 15. Acceptance Criteria

### 15.1 End-to-End Flow Tests

| Test | Description | Pass Criteria |
|------|-------------|---------------|
| Host creates event | Host with active partnership creates draft | Draft saved, slot request created |
| Club approves slot | Club approves pending request | Event status → approved |
| Event publishes | Host publishes approved event | Visible on user website |
| Free RSVP | User RSVPs to free event | QR ticket generated immediately |
| Paid purchase | User completes paid checkout | QR ticket after webhook confirms |
| Promoter link | User uses promoter link | Attribution recorded, discount applied |
| Promo code | User applies valid promo code | Discount calculated correctly |
| QR scan | Staff scans valid QR | Entry approved, logged |
| Duplicate scan | Staff scans same QR twice | Second scan rejected |
| Refund request | User requests refund under threshold | Auto-approved, processed |
| Refund approval | User requests refund over threshold | Requires admin approval |

### 15.2 Edge Case Tests

| Test | Description | Pass Criteria |
|------|-------------|---------------|
| Cart expiry | User abandons cart | Inventory restored after timeout |
| Early bird ending | Early bird ends mid-checkout | Price updates on next page |
| Promo limit reached | Last use of max-redemption code | Next user gets "limit reached" |
| Promoter toggle off | Host disables promoter sales after sales | Existing attribution preserved |
| Double payment webhook | Razorpay sends duplicate webhook | Order not double-processed |
| Staff device revoked | Staff scans after device revoke | Scan rejected |

### 15.3 Permission Tests

| Test | Description | Pass Criteria |
|------|-------------|---------------|
| Host calendar view | Host views club calendar | Only sees availability, no details |
| Promoter buyer view | Promoter views buyers | Sees count only, no PII |
| Staff role limit | Scanner tries to edit guest | Action blocked |
| Admin refund | Admin approves large refund | Requires dual approval |

---

## 16. Implementation Order

### Week 1: Core Ticketing
1. ☐ Enhanced TicketTierStep with scheduled pricing
2. ☐ Promoter cascading toggles
3. ☐ Promo code management UI and store
4. ☐ Cart reservation system

### Week 2: Checkout & Payment
5. ☐ Updated checkout flow with reservations
6. ☐ Razorpay webhook handler (source of truth)
7. ☐ Free RSVP instant QR flow
8. ☐ Order state machine enforcement

### Week 3: Scanning & Staff
9. ☐ Enhanced QR scanning with duplicate prevention
10. ☐ Staff RBAC system
11. ☐ Device binding for scanners
12. ☐ Scan logging with actor

### Week 4: Refunds & Polish
13. ☐ Refund request flow
14. ☐ Admin refund approval queue
15. ☐ Edge case handling
16. ☐ Full test suite

---

## 17. Feature Flags

```javascript
const TICKETING_FLAGS = {
    // Phase 1 - Enabled
    SCHEDULED_PRICING: true,
    PROMO_CODES: true,
    CART_RESERVATIONS: true,
    ENHANCED_SCANNING: true,
    STAFF_RBAC: true,
    REFUND_WORKFLOW: true,
    
    // Phase 2 - Disabled
    TICKET_TRANSFERS: false,
    RESALE_MARKETPLACE: false,
    CHARGEBACKS: false,
    ADVANCED_BUNDLES: false,
    TABLE_PACKAGES: false,
    TICKET_ADDONS: false
};
```

---

## 18. Risk Mitigation

### 18.1 Race Conditions
- All inventory operations use Firestore transactions
- Cart reservations have TTL with automatic cleanup
- Promo redemptions are atomic with count check

### 18.2 Data Leaks
- Host calendar queries filter to availability only
- Promoter buyer views return counts, not records
- Staff permissions enforced at API level, not just UI

### 18.3 Operational Volume
- Scan logs capped at 90 days retention
- Audit logs indexed by action type and date
- Export limited to 1000 records with pagination

### 18.4 Payment Failures
- Webhook is sole source of truth for payment status
- Client confirm only reconciles, never creates tickets
- Refund operations use idempotency keys

---

*Document Version: 2.0*
*Revised: 2026-01-03*
*Status: Ready for Phase 1 Implementation*
