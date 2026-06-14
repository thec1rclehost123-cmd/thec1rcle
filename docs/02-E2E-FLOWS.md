# E2E Flows & Process Documentation

## Overview

This document describes the end-to-end flows for key business processes in THE C1RCLE platform. Each flow includes the complete journey from user action to final state.

---

## Table of Contents
1. [Ticket Purchase Flow](#ticket-purchase-flow)
2. [Event Creation Flow](#event-creation-flow)
3. [Ticket Scanning Flow](#ticket-scanning-flow)
4. [Refund Flow](#refund-flow)
5. [Staff Management Flow](#staff-management-flow)
6. [Promo Code Flow](#promo-code-flow)
7. [Waitlist Flow](#waitlist-flow)
8. [Search & Discovery Flow](#search--discovery-flow)

---

## Ticket Purchase Flow

### Complete Journey

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   User      │     │  API Gateway │     │ Checkout Service│     │   Firestore     │
└──────┬──────┘     └──────┬───────┘     └────────┬────────┘     └────────┬────────┘
       │                   │                       │                       │
       │ 1. GET /events    │                       │                       │
       │───────────────────>│                       │                      │
       │<──────────────────│                       │                       │
       │   Event Details   │                       │                       │
       │                   │                       │                       │
       │ 2. POST /checkout/validate                │                       │
       │───────────────────>│                       │                      │
       │                   │───validatePricing()──>│                       │
       │                   │<───Pricing Result─────│                       │
       │<──────────────────│                       │                       │
       │   Pricing Display │                       │                       │
       │                   │                       │                       │
       │ 3. POST /checkout/reserve                 │                       │
       │───────────────────>│                      │                       │
       │                   │───reserveItems()─────>│                       │
       │                   │                       │───Create reservation─>│
       │                   │<───Reservation ID────│                        │
       │<──────────────────│                       │                       │
       │  Reservation ID   │                       │                       │
       │                   │                       │                       │
       │ 4. POST /checkout/initiate                │                       │
       │───────────────────>│                      │                       │
       │                   │───initiateCheckout()─>│                       │
       │                   │                       │───Create Order──────>│
       │                   │                       │<───Order Created─────│
       │                   │<───Order + Pricing───│                        │
       │<──────────────────│                       │                       │
       │   Order Created   │                       │                       │
       │                   │                       │                       │
       │ 5. POST /payments/order                   │                       │
       │───────────────────>│                       │                       │
       │                   │───preparePayment()───>│                       │
       │                   │                       │───Razorpay API──────>│
       │                   │<───Razorpay Order─────│                       │
       │<──────────────────│                       │                       │
       │   Payment Order   │                       │                       │
       │                   │                       │                       │
       │ 6. User completes payment on Razorpay     │                       │
       │      (redirected to Razorpay checkout)     │                       │
       │                   │                       │                       │
       │ 7. POST /payments/verify                   │                       │
       │───────────────────>│                       │                       │
       │                   │───verifyPayment()─────>│                       │
       │                   │                       │───Update Order Status│
       │                   │                       │   (transaction)────>│
       │                   │<───Payment Verified───│                       │
       │<──────────────────│                       │                       │
       │   Order Confirmed  │                       │                       │
       │                   │                       │                       │
       │ 8. Inngest triggers async processes:      │                       │
       │      - Send confirmation email             │                       │
       │      - Generate ticket QR codes            │                       │
       │      - Update event stats                  │                       │
       │      - Notify host of sale                │                       │
       └───────────────────┴───────────────────────┴───────────────────────┘
```

### Detailed Steps

#### Step 1: Browse Events
- User calls `GET /api/v1/events`
- Returns public events (lifecycle: `scheduled` or `live`)
- Sorted by heat score by default

#### Step 2: Validate Pricing (Optional but recommended)
- User calls `POST /api/v1/checkout/validate`
- Input: `{ eventId, items: [{ tierId, quantity }] }`
- Returns pricing breakdown without reserving inventory

#### Step 3: Reserve Items
- User calls `POST /api/v1/checkout/reserve`
- Creates reservation with 5-minute TTL
- Locks inventory (prevents overselling)
- **Critical**: If user doesn't complete in 5 min, reservation expires

#### Step 4: Initiate Checkout
- User calls `POST /api/v1/checkout/initiate`
- Creates system order in `payment_pending` status
- Applies promo codes if provided
- Calculates final pricing with discounts

#### Step 5: Create Payment Order
- User calls `POST /api/v1/payments/order`
- Creates Razorpay order
- Returns Razorpay order ID for client-side checkout

#### Step 6: Complete Payment
- User is redirected to Razorpay checkout
- Enters card details
- Razorpay processes payment

#### Step 7: Verify Payment
- User calls `PATCH /api/v1/payments/verify`
- Server validates Razorpay signature
- Updates order status to `confirmed` atomically
- Updates payment record to `verified`

#### Step 8: Async Processing (Inngest)
- Order confirmed event triggers:
  - Email confirmation sent
  - QR codes generated
  - Stats updated (rsvps++, revenue)
  - Host notified

### Edge Cases

| Scenario | Handling |
|----------|----------|
| Payment fails | Order remains `payment_pending`, user retries |
| Reservation expires | Auto-release inventory, user must reserve again |
| Promo code invalid | Return error at checkout/initiate step |
| Oversold | Inventory check at reserve step returns error |
| Network error during payment | Idempotent - can retry with same orderId |

---

## Event Creation Flow

### Complete Journey

```
User (Host/Venue)                    API Gateway                    Event Service               Firestore
     │                                    │                              │                           │
     │ 1. POST /events                    │                              │                           │
     │ { title, startDate, location... } │                              │                           │
     │───────────────────────────────────>│                              │                           │
     │                                    │───createEvent(payload)─────>│                           │
     │                                    │                              │                           │
     │                                    │         buildEvent()        │                           │
     │                                    │                              │───Validate required fields
     │                                    │                              │                           │
     │                                    │<───Event Object─────────────│                           │
     │                                    │                              │                           │
     │                                    │                              │───eventRepo.create()────>│
     │                                    │                              │                           │
     │<──────────────────────────────────│                              │                           │
     │ { success: true, id: "evt_..." }  │                              │                           │
     │                                    │                              │                           │
     │ 2. (Optional) PATCH /events/:id   │                              │                           │
     │    { tickets: [...] }              │                              │                           │
     │───────────────────────────────────>│                              │                           │
     │                                    │───updateEvent()────────────>│                           │
     │                                    │                              │───Update event doc──────>│
     │                                    │<───Updated Event────────────│                           │
     │<──────────────────────────────────│                              │                           │
     │                                    │                              │                           │
     │ 3. (Optional) Publish Event        │                              │                           │
     │    PATCH /events/:id { lifecycle: "scheduled" }                  │                           │
     │───────────────────────────────────>│                              │                           │
     │                                    │───updateLifecycle()───────>│                           │
     │                                    │                              │───Update lifecycle─────>│
     │                                    │<───Success─────────────────│                           │
     │<──────────────────────────────────│                              │                           │
     │ Event now visible to public!       │                              │                           │
```

### Event Lifecycle States

```
┌────────┐    ┌───────────┐    ┌──────────┐    ┌───────────┐    ┌────────┐    ┌──────────┐
│ draft  │───>│ submitted │───>│ approved │───>│ scheduled │───>│  live  │───>│completed │
└────────┘    └───────────┘    └──────────┘    └───────────┘    └────────┘    └──────────┘
                  │                                     │
                  │                   ┌───────────────┐ │
                  └───────────────────>│  cancelled   │─┘
                                        └───────────────┘
```

| State | Description | Visible to Public |
|-------|-------------|-------------------|
| `draft` | Created, not ready | No |
| `submitted` | Pending approval (for host events) | No |
| `approved` | Approved by club/admin | No |
| `scheduled` | Public, tickets available | Yes |
| `live` | Event is happening now | Yes |
| `completed` | Event ended | Yes (past) |
| `cancelled` | Cancelled | No |

### Required Fields by Creator Type

| Creator Role | Required Fields |
|--------------|----------------|
| Host | title, startDate, location, host |
| Venue (Club) | title, city, host |

---

## Ticket Scanning Flow

### Complete Journey

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Scanner    │     │  API Gateway │     │ Scan Service    │     │   Firestore    │
│  (Staff)    │     │              │     │ (ticket-engine) │     │                │
└──────┬──────┘     └──────┬───────┘     └────────┬────────┘     └────────┬────────┘
       │                   │                       │                       │
       │ 1. POST /scan/verify                     │                       │
       │ { ticketId, eventId }                     │                       │
       │──────────────────────────────────────────>│                       │
       │                   │───validateTicket()───>│                       │
       │                   │                       │───Check ticket exists │
       │                   │                       │   Check event status  │
       │                   │                       │   Validate signature  │
       │                   │<───Validation Result──│                       │
       │<──────────────────────────────────────────│                       │
       │ { valid: true/false, reason? }            │                       │
       │                   │                       │                       │
       │ 2. (if valid) POST /scan/record           │                       │
       │──────────────────────────────────────────>│                       │
       │                   │───recordScan()───────>│                       │
       │                   │                       │───Create scan record─>│
       │                   │                       │───Update ticket status│
       │                   │<───Scan Recorded──────│   (if first entry)    │
       │<──────────────────────────────────────────│                       │
       │ { success: true }                         │                       │
       └───────────────────┴───────────────────────┴───────────────────────┘
```

### Scanning Rules

1. **Valid Ticket**: Not used, belongs to correct event, signature valid
2. **Already Scanned**: Allow re-scan (for audit trail), mark as duplicate
3. **Wrong Event**: Reject - ticket is for different event
4. **Expired Event**: Allow entry (for historical records)

---

## Refund Flow

### Complete Journey

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Admin/     │     │  API Gateway │     │ Finance Engine  │     │   Firestore    │
│  User       │     │              │     │                 │     │                │
└──────┬──────┘     └──────┬───────┘     └────────┬────────┘     └────────┬────────┘
       │                   │                       │                       │
       │ 1. POST /refunds                       │                       │
       │ { orderId, amount, reason }            │                       │
       │───────────────────────────────────────>│                       │
       │                   │───processRefund()─>│                       │
       │                   │                       │───Get Order─────────>│
       │                   │                       │   Check current state│
       │                   │                       │                       │
       │                   │───initiateRefund()───>│                       │
       │                   │                       │───Create refund entry│
       │                   │                       │   Update order status│
       │                   │                       │                       │
       │                   │───Razorpay Refund API │                       │
       │                   │                       │───Call Razorpay API─>│
       │                   │<───Refund Response────│                       │
       │                   │                       │                       │
       │                   │───finalizeRefund()───>│                       │
       │                   │                       │───Update ledger─────>│
       │                   │<───Refund Complete────│                       │
       │<────────────────────────────────────────│                       │
       │ { success: true, refundId }             │                       │
```

### Refund States

```
pending ──► processing ──► completed
                │
                └──► failed
```

### Conditions for Refund

1. Order must be in `confirmed` status
2. Refund amount <= order total
3. Within refund window (configurable per event)
4. Original payment still in ledger

---

## Staff Management Flow

### Complete Journey

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Venue      │     │  API Gateway │     │ Staff Engine   │     │   Firestore    │
│  Owner      │     │              │     │                 │     │                │
└──────┬──────┘     └──────┬───────┘     └────────┬────────┘     └────────┬────────┘
       │                   │                       │                       │
       │ 1. POST /staff/:venueId                   │                       │
       │ { email, role, name }                     │                       │
       │──────────────────────────────────────────>│                       │
       │                   │───addStaffMember()────>│                       │
       │                   │                       │───Create staff record─>│
       │                   │                       │───Send invite email──>│
       │                   │<───Staff Added────────│                       │
       │<──────────────────────────────────────────│                       │
       │ { success: true, staffId }                │                       │
       │                   │                       │                       │
       │ User receives email, creates Firebase account                      │
       │                   │                       │                       │
       │ 2. Link Account   │                       │                       │
       │    POST /staff/:venueId/:staffId/link    │                       │
       │──────────────────────────────────────────>│                       │
       │                   │───linkStaffUser()─────>│                       │
       │                   │                       │───Update staff record│
       │                   │                       │   (link uid)         │
       │                   │<───Linked──────────────│                       │
       │<──────────────────────────────────────────│                       │
```

### Staff Roles & Permissions

| Role | Permissions |
|------|-------------|
| `owner` | All permissions |
| `manager` | viewEvents, editEvents, viewFinance, manageStaff |
| `ops` | viewEvents, editEvents, scanTickets |
| `viewer` | viewEvents |

---

## Promo Code Flow

### Create Promo Code

```
Venue Owner                    API Gateway                 Promo Service              Firestore
     │                            │                           │                          │
     │ POST /promos              │                           │                          │
     │ { code, discountType,     │                           │                          │
     │   discountValue,          │                           │                          │
     │   maxUses, validUntil }    │                           │                          │
     │───────────────────────────>│                           │                          │
     │                    │───createPromoCode()───────────>│                          │
     │                    │                               │───Validate inputs───────>│
     │                    │                               │───Create promo record──>│
     │                    │<───Promo Created──────────────│                          │
     │<───────────────────│                               │                          │
     │ { success: true }  │                               │                          │
```

### Validate & Apply Promo

```
User                     API Gateway                 Promo Service              Firestore
 │                            │                           │                          │
 │ POST /checkout/promo      │                           │                          │
 │ { eventId, code, items } │                           │                          │
 │──────────────────────────>│                           │                          │
 │                    │───validatePromoCode()───────>│                          │
 │                    │                               │───Fetch promo code─────>│
 │                    │                               │   Check usage limits    │
 │                    │                               │   Check validity dates  │
 │                    │                               │   Check event match     │
 │                    │<───Validation Result─────────│                          │
 │<───────────────────│                               │                          │
 │ { valid: true/false, discountAmount? }              │                          │
```

---

## Waitlist Flow

### Join Waitlist

```
User                     API Gateway                 Waitlist Engine            Firestore
 │                            │                           │                          │
 │ POST /waitlist/join       │                           │                          │
 │ { eventId, tierId?,      │                           │                          │
 │   email, phone }          │                           │                          │
 │──────────────────────────>│                           │                          │
 │                    │───joinWaitlist()─────────────>│                          │
 │                    │                               │───Create waitlist entry─>│
 │                    │                               │   (increment position)   │
 │                    │<───Joined─────────────────────│                          │
 │<───────────────────│                               │                          │
 │ { success: true,  │                               │                          │
 │   position: 15 }  │                               │                          │
```

### Process Waitlist (When Tickets Available)

```
Admin                    API Gateway                 Waitlist Engine            Firestore
 │                            │                           │                          │
 │ POST /waitlist/process    │                           │                          │
 │ { eventId, tierId,        │                           │                          │
 │   numAvailable }          │                           │                          │
 │──────────────────────────>│                           │                          │
 │                    │───processWaitlist()─────────>│                          │
 │                    │                               │───Get next N entries────>│
 │                    │                               │   (ordered by position)  │
 │                    │                               │                          │
 │                    │───Send notifications─────────>│                          │
 │                    │   (email each user)           │                          │
 │                    │                               │                          │
 │                    │<───Processed─────────────────│                          │
 │<───────────────────│                               │                          │
```

---

## Search & Discovery Flow

### User Searches Events

```
User                     API Gateway                 Search Service             Algolia
 │                            │                           │                          │
 │ GET /search?q=party&city=pune-in                       │                          │
 │──────────────────────────>│                           │                          │
 │                    │───search()─────────────────>│                          │
 │                    │                               │───Query Algolia─────────>│
 │                    │                               │<───Search Results────────│                          │
 │                    │                               │                          │
 │                    │                               │───Hydrate with Firestore│
 │                    │                               │   (get full event data) │
 │                    │<───Results───────────────────│                          │
 │<───────────────────│                               │                          │
 │ [{ events }]      │                               │                          │
```

### Search Features
- Full-text search on title, description, location, host
- Filter by city, category, date range, price range
- Sort by relevance, date, popularity

---

## Async Background Flows (Inngest)

These flows are triggered by events but processed asynchronously:

| Trigger Event | Background Processing |
|---------------|---------------------|
| Order confirmed | Send confirmation email, generate QR codes |
| Event published | Index in Algolia, update search |
| Ticket transferred | Notify recipient, update ticket owner |
| Event completed | Calculate analytics, settle payments to host |
| Refund processed | Update ledger, send refund confirmation |

---

## Testing Notes

### Key Test Scenarios

1. **Purchase Flow**: Test with valid/invalid cards, promo codes, edge cases
2. **Concurrency**: Multiple users buying same ticket tier simultaneously
3. **Timeout**: Reservation expiration mid-checkout
4. **Offline**: Payment succeeded but verification failed (idempotency)
5. **Permissions**: Staff with different roles accessing resources

### Test Environment Variables
```bash
# Use test keys from Razorpay Dashboard
RAZORPAY_KEY_ID=rzp_test_...
# Use mock mode in Firebase
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
```

---

*Last Updated: May 2026*