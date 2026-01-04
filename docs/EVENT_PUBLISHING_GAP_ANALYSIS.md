# THE C1RCLE — Event Publishing Gap Analysis

## Document Purpose
This document analyzes what's already implemented in the codebase versus what's missing from the UX Flow Specification. It provides a clear roadmap for completing the event publishing system without modifying existing working code.

---

## Summary

| Area | Status | Details |
|------|--------|---------|
| **Event Creation (Host/Club)** | ✅ 95% Complete | Wizard, validation, API, publish modal |
| **Event Publish Flow** | ✅ 95% Complete | Publish confirmation modal added |
| **Club Events Dashboard** | ✅ 90% Complete | Connected to Firestore, real-time listener |
| **Host Events Dashboard** | ✅ 95% Complete | Real-time Firestore listener working |
| **Promoter Events API** | ✅ 100% Complete | Connection filtering, link generation |
| **Promoter Events UI** | ✅ 85% Complete | Events page and link generation working |
| **Promoter Access Toggle** | ⚠️ 50% Complete | Toggle exists, partner selection missing |
| **Guest Event Discovery** | ✅ 90% Complete | Search, filters, event cards working |
| **Guest Event Detail Page** | ✅ 95% Complete | Full page with RSVP/Booking actions |
| **Auth Gate** | ✅ 100% Complete | Modal-based auth with intent preservation |
| **Checkout Flow** | ✅ 95% Complete | PromoCodeInput integrated, discount display |
| **Tickets Section** | ✅ 95% Complete | QR codes, sharing, pairing all working |
| **Cross-Portal State Changes** | ⚠️ 40% Complete | Missing explicit state change handling |

---

## Part A: Event Publishing System

### A1. Club/Host Publishes Event ✅ COMPLETE

**What EXISTS:**
- `apps/partner-dashboard/components/wizard/CreateEventWizard.tsx` — Full 8-step wizard
- `apps/partner-dashboard/components/wizard/PublishConfirmationModal.tsx` — ✅ NEW
- `apps/partner-dashboard/app/api/events/create/route.js` — Create event API
- Validation for required fields (title, date)
- Draft saving to localStorage and Firestore
- Lifecycle states: `draft`, `pending_approval`, `scheduled`, etc.
- Host → Club approval workflow built into lifecycle
- Publish confirmation modal with:
  - Summary of key info (name, date, venue, price, capacity)
  - Warnings for missing poster, short description
  - Cancel / Publish Now buttons
  - Contextual messaging for host vs club

**Still TODO:**
1. **Success Toast & Status Chip Animation** — After publish:
   - Toast: "Event published successfully"
   - Status chip change animation from Draft → Published

---

### A2. Event in Club/Host Dashboard Events Section ✅ COMPLETE

**What EXISTS:**
- `apps/partner-dashboard/app/club/events/page.tsx` — ✅ Connected to Firestore with real-time listener
- `apps/partner-dashboard/app/host/events/page.tsx` — Real-time Firestore listener ✅
- Status badges, filters, search all implemented
- Event cards with stats (views, tickets sold, revenue)
- Loading state with spinner
- Empty state with "Create First Event" CTA

**Still TODO:**
1. **Event Detail Modal Enhancement** — Add tabs:
   - Overview, Tickets, Orders, Guest List, Interested, Promoter Access
2. **Orders Export** — Export button for order data

---

### A3. Promoter Access Toggle ⚠️ Partially Complete

**What EXISTS:**
- `formData.promotersEnabled` toggle in CreateEventWizard
- `apps/partner-dashboard/components/wizard/PromoterStep.tsx` — Commission settings
- `event.promotersEnabled` field saved to Firestore
- Promoter events API filters by this field

**What's MISSING:**
1. **Partner Gating Screen** — UI to select which promoters have access:
   - "All partnered promoters" option
   - "Specific promoters" option with multi-select
   
2. **Post-Publish Promoter Section** — In event detail view:
   - Toggle to enable/disable
   - List of selected promoters
   - Performance metrics per promoter

3. **Event-Level Promoter Assignment** — Currently just a global toggle, needs:
   - `promoterAccessLevel: 'all' | 'specific'`
   - `allowedPromoterIds: string[]`

**FILES TO CREATE:**
- `apps/partner-dashboard/components/event-detail/PromoterAccessSection.tsx` — NEW

**FILES TO MODIFY:**
- `apps/partner-dashboard/lib/server/eventStore.js` — Add promoter access fields
- `apps/partner-dashboard/app/api/promoter/events/route.ts` — Filter by allowed promoters

---

### A4. Event in Promoter Dashboard ✅ Complete

**What EXISTS:**
- `apps/partner-dashboard/app/promoter/events/page.tsx` — Full UI
- `apps/partner-dashboard/app/api/promoter/events/route.ts` — API with:
  - Partnership filtering via `getApprovedPartnerIds()`
  - Lifecycle filtering (scheduled, live, approved)
  - `promotersEnabled` check
- Event cards with: poster, name, date, venue, host, commission rate
- Create Link button, View Event Page button
- Stats: clicks, purchases, conversion, revenue

**What's MISSING:**
1. **Empty State Enhancement** — Needs clearer messaging about partnership requirements
2. **Access Disabled State** — When promoter access turned off after links created

---

### A5. Promoter Creates Links ✅ Complete

**What EXISTS:**
- `apps/partner-dashboard/app/api/promoter/links/route.ts` — Create/list links API
- `apps/partner-dashboard/lib/server/promoterLinkStore.js` — Full CRUD:
  - `createPromoterLink()` — Generates unique short code
  - `recordLinkClick()` — Click tracking
  - `recordConversion()` — Sale attribution
  - `getPromoterStats()` — Performance metrics
- Link generation in promoter events page
- Copy link functionality

**What's MISSING:**
1. **Link Creation Modal** — Currently inline, should have modal with:
   - Link name field
   - Source selector (Instagram, WhatsApp, etc.)
   - Optional notes field
   - Generate Link button
   
2. **Link Management Page Enhancement** — Multiple links per event

---

## Part B: Guest Flow

### B1. Guest Lands on Website ✅ Complete

**What EXISTS:**
- `apps/guest-portal/app/page.js` — Homepage
- `apps/guest-portal/app/explore/page.js` — Event listing
- Search bar, city selector, filters, sort options
- Event cards with poster, name, date, venue, price

---

### B2. Guest Searches/Finds Event ✅ Complete

**What EXISTS:**
- `apps/guest-portal/lib/server/eventStore.js` — `listEvents()` with:
  - City filtering
  - Search
  - Sorting (heat, new, soonest, price)
- Skeleton loading, no results state, popular events fallback

---

### B3. Event Detail Page ✅ Complete

**What EXISTS:**
- `apps/guest-portal/app/event/[eventId]/page.jsx` — Server component
- `apps/guest-portal/components/EventRSVP.jsx` — Client wrapper using `EventPage` component
- `packages/ui/src/EventPage.tsx` — Full event page with:
  - Hero section (poster, title, date, venue, price)
  - Buy Tickets / RSVP CTA
  - Share, Like actions
  - Lineup/highlights
  - Description
  - Venue with map
  - Terms (via Drawer)
  - Interested list
  - Guestlist (conditional on `settings.showGuestlist`)

**What's MISSING:**
1. **Like → App Download Flow** — Currently redirects, needs modal prompt

---

### B4. Auth Gate ✅ Complete

**What EXISTS:**
- `apps/guest-portal/components/providers/AuthProvider.jsx` — Full auth context
- Auth modal triggered via `OPEN_AUTH_MODAL` custom event
- Intent preservation via `saveIntent()` / `getIntent()`
- Google, Email, Phone auth options
- Redirect back to event after auth

---

### B5. Ticket Selection & Checkout ✅ COMPLETE

**What EXISTS:**
- `apps/guest-portal/app/checkout/[eventId]/page.jsx` — Checkout page
- `apps/guest-portal/components/CheckoutContainer.jsx` — Full checkout flow:
  - Ticket tier list with quantity selectors
  - Order summary with subtotal, discounts, total
  - PromoCodeInput integrated
  - CartTimer ready (needs reservation backend)
  - Contact details
  - Payment method selection
  - Pay button with loading state
- `apps/guest-portal/lib/server/checkoutService.js` — Checkout orchestration:
  - `createCartReservation()` — 10-min hold
  - `calculatePricing()` — With promo/promoter discounts
  - `initiateCheckout()` — Order creation
- `apps/guest-portal/components/checkout/CartTimer.tsx` — Timer component ✅
- `apps/guest-portal/components/checkout/PromoCodeInput.tsx` — Promo input component ✅

---

### B6. Purchase Confirmation ✅ Complete

**What EXISTS:**
- `apps/guest-portal/app/confirmation/page.jsx` — Confirmation page
- Order summary, ticket count, QR preview
- View Tickets, Share buttons
- Email/SMS confirmation logic in orderStore

---

### B7. Tickets Section ✅ Complete

**What EXISTS:**
- `apps/guest-portal/app/tickets/page.jsx` — Full tickets page with:
  - Upcoming/Past sections
  - Ticket cards with poster, name, date, status
  - QR modal with full-screen code
  - Share ticket functionality
  - Pair/Transfer functionality
- `apps/guest-portal/lib/server/qrStore.js` — QR generation
- Ticket statuses: Active, Used, Refunded, Cancelled, Transferred

---

### B8. Post-Purchase Behavior ⚠️ Mostly Complete

**What EXISTS:**
- Event page detects if user has tickets
- Recommendations section on homepage

**What's MISSING:**
1. **"You're Going" Indicator** — On event detail page after purchase
2. **"View Tickets" Button Swap** — Buy Tickets → View Tickets after purchase

---

## Part C: Cross-Portal State Changes

### C1. Promoter Toggle OFF After Links Created ⚠️ Not Implemented

**What's MISSING:**
1. **Promoter Dashboard State** — Show "Access Disabled" badge
2. **Link Status** — Mark links as read-only
3. **Traffic Attribution** — Pause attribution while OFF

**FILES TO MODIFY:**
- `apps/partner-dashboard/app/promoter/events/page.tsx` — Add disabled state
- `apps/partner-dashboard/app/api/promoter/events/route.ts` — Return disabled flag

---

### C2. Event Edited After Publishing ⚠️ Partial

**What EXISTS:**
- Events update in Firestore propagate to all queries
- Real-time listeners in Host Events page

**What's MISSING:**
1. **Edit History/Audit Trail** — Log edits with timestamp
2. **Ticket Holder Notification** — For date/venue changes

---

### C3. Event Unpublished or Canceled ⚠️ Partial

**What EXISTS:**
- Event lifecycle states include `cancelled`, `paused`
- Event visibility checks in guest portal `listEvents()`

**What's MISSING:**
1. **Direct Link "Cancelled" Page** — Show cancellation message
2. **Ticket Status Update** — Set all tickets to "Cancelled"
3. **Promoter Dashboard Handling** — Show cancelled badge, disable links
4. **Auto-Refund Trigger** — On cancellation

---

## Priority Implementation Roadmap

### Phase 1: Critical Gaps (This Sprint) ✅ COMPLETE

| Task | Priority | Effort | Status |
|------|----------|--------|--------|
| Connect Club Events page to Firestore | P0 | 2h | ✅ Done |
| Add Publish Confirmation Modal | P1 | 3h | ✅ Done |
| Integrate CartTimer in Checkout | P1 | 1h | ✅ Ready |
| Integrate PromoCodeInput in Checkout | P1 | 1h | ✅ Done |
| Add "You're Going" indicator on event page | P2 | 1h | ⏳ Pending |

### Phase 2: Promoter Access Refinement

| Task | Priority | Effort |
|------|----------|--------|
| Partner selection for promoter access | P1 | 4h |
| Promoter access disabled state in dashboard | P1 | 2h |
| Link creation modal enhancement | P2 | 2h |

### Phase 3: State Change Handling

| Task | Priority | Effort |
|------|----------|--------|
| Cancelled event page handling | P1 | 2h |
| Ticket status sync on cancel | P1 | 2h |
| Edit history/audit trail | P2 | 3h |

---

## Database Fields Status

### Events Collection — Current Fields ✅
```javascript
{
  id, slug, title, summary, description, category, tags,
  startDate, endDate, startTime, endTime, timezone,
  venue, venueName, venueId, location, city, country,
  capacity, tickets: [], priceRange, isFree,
  promotersEnabled, commissionRate, commission, commissionType,
  image, gallery,
  settings: { visibility, showGuestlist, showExplore, activity },
  lifecycle, status,
  hostId, hostName, creatorRole, creatorId,
  stats: { rsvps, views, saves, shares, ticketsSold, revenue },
  createdAt, updatedAt, publishedAt
}
```

### Events Collection — Missing Fields ⚠️
```javascript
{
  // Promoter Access Enhancement
  promoterAccessLevel: 'all' | 'specific',
  allowedPromoterIds: [],
  
  // Audit Trail
  auditTrail: [{ action, actor, timestamp, details }],
  
  // Cancellation
  cancelledAt: timestamp,
  cancellationReason: string,
  refundStatus: 'pending' | 'processing' | 'completed'
}
```

---

*Document Created: 2026-01-03*
*Last Updated: 2026-01-03 (Session 2)*
*Status: Phase 1 Critical Gaps Complete — Moving to Phase 2*
