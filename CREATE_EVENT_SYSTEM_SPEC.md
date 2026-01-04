# Create Event System - Full-Stack Implementation Specification

## Overview

This document outlines the complete Create Event system for THE C1RCLE platform—a multi-dashboard, production-ready implementation that connects Host Dashboard, Club Dashboard, Promoter Dashboard, User Website, Backend Services, Database, and Admin Panel.

**Core Principle:** Create Event is not a page. It is a system handshake across the entire platform.

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           THE C1RCLE CREATE EVENT FLOW                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐                                       │
│  │    HOST      │    │    CLUB      │                                       │
│  │  DASHBOARD   │    │  DASHBOARD   │                                       │
│  └──────┬───────┘    └──────┬───────┘                                       │
│         │                    │                                               │
│         │ Create Event       │ Create Event                                  │
│         │ (Draft)            │ (Draft)                                       │
│         ▼                    ▼                                               │
│  ┌─────────────────────────────────────┐                                    │
│  │        EVENT DRAFT SERVICE          │                                    │
│  │  - Persists immediately             │                                    │
│  │  - Assigns lifecycle: 'draft'       │                                    │
│  │  - Owner: creatorId + creatorRole   │                                    │
│  └───────────────┬─────────────────────┘                                    │
│                  │                                                           │
│                  ▼                                                           │
│  ┌─────────────────────────────────────┐                                    │
│  │     PARTNERSHIP VERIFICATION        │ (For Hosts Only)                   │
│  │  - Check active partnership         │                                    │
│  │  - Fetch club calendar              │                                    │
│  │  - Request slot (not confirm)       │                                    │
│  └───────────────┬─────────────────────┘                                    │
│                  │                                                           │
│                  ▼                                                           │
│  ┌─────────────────────────────────────┐                                    │
│  │        APPROVAL WORKFLOW            │                                    │
│  │  Host → Club Approval Required      │                                    │
│  │  Club → Direct Publish              │                                    │
│  └───────────────┬─────────────────────┘                                    │
│                  │                                                           │
│                  ▼                                                           │
│  ┌─────────────────────────────────────┐                                    │
│  │      PUBLISHED EVENT STATE          │                                    │
│  └───────────────┬─────────────────────┘                                    │
│                  │                                                           │
│    ┌─────────────┼─────────────┬─────────────┐                              │
│    ▼             ▼             ▼             ▼                              │
│ ┌──────┐    ┌──────────┐  ┌──────────┐  ┌──────────┐                        │
│ │ USER │    │ PROMOTER │  │  ADMIN   │  │ SCANNER  │                        │
│ │PORTAL│    │DASHBOARD │  │  PANEL   │  │   APP    │                        │
│ └──────┘    └──────────┘  └──────────┘  └──────────┘                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Event Lifecycle States

| State              | Description                                     | Visible To            |
|--------------------|-------------------------------------------------|-----------------------|
| `draft`            | Created but not submitted                       | Owner only            |
| `submitted`        | Sent for approval (host→club)                   | Owner, Club           |
| `pending_slot`     | Waiting for club to approve date/time slot      | Owner, Club           |
| `needs_changes`    | Club requested modifications                    | Owner, Club           |
| `approved`         | Club approved, ready to publish                 | Owner, Club, Admin    |
| `scheduled`        | Published, upcoming                             | Everyone              |
| `live`             | Currently happening                             | Everyone              |
| `completed`        | Event has ended                                 | Everyone              |
| `cancelled`        | Event was cancelled                             | Everyone (as cancelled)|
| `paused`           | Temporarily hidden from users                   | Owner, Club, Admin    |

---

## 3. Database Schema Updates

### 3.1 Events Collection (Enhanced)

```typescript
interface Event {
  // Identity
  id: string;
  slug: string;
  
  // Ownership & Authority
  creatorRole: 'club' | 'host';
  creatorId: string;
  hostId?: string;
  hostName?: string;
  venueId: string;
  venueName: string;
  
  // Basic Info
  title: string;
  summary: string;
  description: string;
  category: string;
  tags: string[];
  
  // Location
  location: string;
  venue: string;
  city: string;
  country: string;
  
  // Date/Time
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  timezone: string;
  
  // Capacity & Tickets
  capacity: number;
  tickets: TicketTier[];
  priceRange: { min: number; max: number; currency: string };
  isFree: boolean;
  
  // Promoter Settings
  promotersEnabled: boolean;
  commissionRate: number;
  promoterTiers?: PromoterTierConfig[];
  
  // Media
  image: string;
  gallery: string[];
  youtube?: string;
  spotifyTrack?: string;
  
  // Settings
  settings: {
    visibility: 'public' | 'password' | 'link';
    password?: string;
    showGuestlist: boolean;
    showExplore: boolean;
    activity: boolean;
    recurring: boolean;
  };
  
  // Lifecycle
  lifecycle: EventLifecycle;
  slotRequest?: SlotRequest;
  
  // Audit
  auditTrail: AuditEntry[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  
  // Stats
  stats: {
    rsvps: number;
    views: number;
    saves: number;
    shares: number;
    ticketsSold: number;
    revenue: number;
  };
}

interface TicketTier {
  id: string;
  name: string;
  entryType: 'stag' | 'couple' | 'group' | 'general' | 'vip' | 'table';
  price: number;
  quantity: number;
  remaining: number;
  
  // Sale Window
  salesStart: string;
  salesEnd: string;
  
  // Limits
  minPerOrder: number;
  maxPerOrder: number;
  
  // Discounts
  discounts?: TicketDiscount[];
  
  // Promoter Config
  promoterCommission?: number; // Override global
  promoterEnabled: boolean;
  
  // Visibility
  hidden: boolean;
  requiresCode: boolean;
  
  // Refund Policy
  refundable: boolean;
  refundDeadline?: string;
}

interface TicketDiscount {
  id: string;
  type: 'percentage' | 'flat';
  value: number;
  code?: string; // If promo code based
  autoApply: boolean;
  startDate: string;
  endDate: string;
  usageLimit: number;
  usageCount: number;
  tierSpecific: boolean;
}

interface SlotRequest {
  id: string;
  requestedDate: string;
  requestedStartTime: string;
  requestedEndTime: string;
  status: 'pending' | 'approved' | 'rejected' | 'modified';
  clubNotes?: string;
  alternativeDates?: string[];
  requestedAt: string;
  respondedAt?: string;
}

interface AuditEntry {
  action: string;
  actor: {
    uid: string;
    role: string;
    name?: string;
  };
  timestamp: string;
  details?: Record<string, any>;
}
```

### 3.2 Slot Requests Collection (New)

```typescript
interface SlotRequestDocument {
  id: string;
  eventId: string;
  hostId: string;
  hostName: string;
  clubId: string;
  clubName: string;
  
  requestedDate: string;
  requestedStartTime: string;
  requestedEndTime: string;
  
  status: 'pending' | 'approved' | 'rejected' | 'modified';
  priority: 'normal' | 'high';
  
  notes: string;
  clubResponse?: string;
  alternativeDates?: string[];
  
  createdAt: string;
  updatedAt: string;
  expiresAt: string; // Auto-reject after this
}
```

### 3.3 Club Calendar Collection (New)

```typescript
interface ClubCalendarDocument {
  clubId: string;
  date: string; // YYYY-MM-DD
  
  // Availability
  status: 'available' | 'blocked' | 'booked' | 'tentative';
  
  // If booked
  eventId?: string;
  eventTitle?: string;
  hostId?: string;
  
  // Time slots
  slots: {
    startTime: string;
    endTime: string;
    status: 'available' | 'blocked' | 'booked';
  }[];
  
  // Metadata
  notes?: string; // Internal only, not shown to hosts
  updatedAt: string;
  updatedBy: string;
}
```

### 3.4 Promoter Links Collection (New)

```typescript
interface PromoterLinkDocument {
  id: string;
  code: string; // Unique short code
  
  promoterId: string;
  promoterName: string;
  
  eventId: string;
  eventTitle: string;
  
  // Targeting
  ticketTierIds?: string[]; // Empty = all tiers
  
  // Commission
  commissionRate: number;
  commissionType: 'percentage' | 'flat';
  
  // Tracking
  clicks: number;
  conversions: number;
  revenue: number;
  commission: number;
  
  // Status
  isActive: boolean;
  expiresAt?: string;
  
  createdAt: string;
  updatedAt: string;
}
```

---

## 4. API Endpoints

### 4.1 Event Management

| Method | Endpoint                          | Description                        | Auth Required |
|--------|-----------------------------------|------------------------------------|---------------|
| POST   | `/api/events/draft`               | Create new draft                   | Host/Club     |
| GET    | `/api/events/:id`                 | Get event details                  | Public/Auth   |
| PATCH  | `/api/events/:id`                 | Update draft                       | Owner         |
| POST   | `/api/events/:id/submit`          | Submit for approval                | Host          |
| POST   | `/api/events/:id/approve`         | Approve event                      | Club          |
| POST   | `/api/events/:id/reject`          | Reject with reason                 | Club          |
| POST   | `/api/events/:id/request-changes` | Request modifications              | Club          |
| POST   | `/api/events/:id/publish`         | Publish approved event             | Owner         |
| POST   | `/api/events/:id/pause`           | Pause event                        | Owner/Admin   |
| POST   | `/api/events/:id/cancel`          | Cancel event                       | Owner/Admin   |

### 4.2 Slot Management

| Method | Endpoint                               | Description                    | Auth Required |
|--------|----------------------------------------|--------------------------------|---------------|
| GET    | `/api/clubs/:id/calendar`              | Get club availability          | Host (partner)|
| POST   | `/api/slots/request`                   | Request a slot                 | Host          |
| GET    | `/api/slots/requests`                  | List slot requests             | Club          |
| POST   | `/api/slots/:id/approve`               | Approve slot                   | Club          |
| POST   | `/api/slots/:id/reject`                | Reject slot                    | Club          |
| POST   | `/api/slots/:id/modify`                | Suggest alternative            | Club          |

### 4.3 Promoter Integration

| Method | Endpoint                               | Description                    | Auth Required |
|--------|----------------------------------------|--------------------------------|---------------|
| GET    | `/api/promoter/events`                 | List available events          | Promoter      |
| POST   | `/api/promoter/events/:id/link`        | Generate promoter link         | Promoter      |
| GET    | `/api/promoter/links`                  | List promoter's links          | Promoter      |
| GET    | `/api/promoter/stats`                  | Get promoter statistics        | Promoter      |

---

## 5. Implementation Phases

### Phase 1: Core Infrastructure
1. Update event schema in eventStore.js
2. Create slot request store
3. Create club calendar store
4. Update Firestore security rules

### Phase 2: Host Dashboard
1. Enhanced CreateEventWizard with venue selection
2. Partnership-gated venue access
3. Calendar view for date selection
4. Slot request UI

### Phase 3: Club Dashboard
1. Event approval queue
2. Slot request management
3. Calendar management
4. Event oversight controls

### Phase 4: Promoter Dashboard
1. Event discovery
2. Link generation
3. Performance tracking
4. Commission visibility

### Phase 5: User Portal
1. Event display from published events
2. Ticket tier rendering
3. Discount application
4. Real-time availability

### Phase 6: Admin Panel
1. Full event visibility
2. Lifecycle overrides
3. Audit trail viewing
4. Analytics integration

---

## 6. Files to Create/Modify

### New Files
- `apps/partner-dashboard/lib/server/slotStore.js`
- `apps/partner-dashboard/lib/server/calendarStore.js`
- `apps/partner-dashboard/lib/server/promoterLinkStore.js`
- `apps/partner-dashboard/app/api/slots/route.ts`
- `apps/partner-dashboard/app/api/clubs/[id]/calendar/route.ts`
- `apps/partner-dashboard/app/club/events/requests/page.tsx`
- `apps/partner-dashboard/app/club/calendar/page.tsx`
- `apps/partner-dashboard/components/wizard/VenueStep.tsx`
- `apps/partner-dashboard/components/wizard/TicketTierStep.tsx`
- `apps/partner-dashboard/components/wizard/PromoterStep.tsx`
- `apps/admin-console/app/events/[id]/page.jsx`

### Modified Files
- `apps/partner-dashboard/lib/server/eventStore.js`
- `apps/partner-dashboard/components/wizard/CreateEventWizard.tsx`
- `apps/partner-dashboard/app/club/page.tsx`
- `apps/partner-dashboard/app/host/page.tsx`
- `apps/partner-dashboard/app/promoter/page.tsx`
- `firestore.rules`

---

## 7. Success Criteria

The Create Event system is complete when:
1. ✅ A host can create an event draft
2. ✅ The draft is persisted immediately
3. ✅ Hosts can only select venues they have partnerships with
4. ✅ Hosts can view club calendar (availability only)
5. ✅ Slot requests are created, not direct bookings
6. ✅ Clubs can approve/reject/modify slot requests
7. ✅ Clubs can approve/reject events
8. ✅ Ticket tiers work with entry types (stag/couple/group)
9. ✅ Inventory decrements atomically
10. ✅ Published events appear on user website
11. ✅ Promoters can generate unique links
12. ✅ Promoter sales are tracked correctly
13. ✅ Admin panel shows full traceability
14. ✅ Audit trail captures all state changes

---

*Document Version: 1.0*
*Created: 2026-01-02*
