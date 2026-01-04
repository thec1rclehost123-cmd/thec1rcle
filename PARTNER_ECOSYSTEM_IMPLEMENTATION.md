# THE C1RCLE — Partner Ecosystem Implementation Plan

## Executive Summary

This document outlines the complete implementation plan for THE C1RCLE partner ecosystem, covering Clubs, Hosts, Promoters, User Website, Calendar, Staff, Ticketing, and Discovery systems.

**Core Principle**: This is an operating system for nightlife partnerships, not just an event app.

---

## Current State Assessment

### ✅ Already Implemented
- Basic partnership system (Club ↔ Host requests)
- Event creation wizard (CreateEventWizard.tsx)
- Slot request system (slotStore.js)
- Calendar store (calendarStore.js)
- Promoter link generation and tracking
- Order creation with promoter attribution
- Basic dashboards for Club, Host, Promoter

### 🔧 Needs Enhancement
- Calendar depth (Club operational register)
- Ticketing flexibility (entry types, promoter discounts)
- Staff management and RBAC
- Profile/Discover page management
- Notification system
- Real-time synchronization

### ❌ Not Yet Implemented
- QR code generation for tickets
- Staff login and role system
- Profile editing from dashboards
- Follower-based notifications
- Promoter-linked buyer discounts

---

## Implementation Phases

### Phase 1: Foundation Layer (Partnership System) ✅ MOSTLY COMPLETE

#### 1.1 Club ↔ Host Partnerships
```
Location: apps/partner-dashboard/lib/server/partnershipStore.js
Status: ✅ Implemented
- Request, approve, reject partnerships
- List partnerships by club/host
```

#### 1.2 Calendar Visibility Rules
```
Location: apps/partner-dashboard/lib/server/calendarStore.js
Status: 🔧 Needs Enhancement
- Add privacy filtering for host view
- Remove event names/details from host responses
- Show only: available dates, blocked dates, time windows
```

#### 1.3 Host ↔ Promoter Relationships
```
Location: apps/partner-dashboard/lib/server/promoterLinkStore.js
Status: ✅ Implemented
- Promoters linked to specific events
- Commission per event
- Performance tracking
```

---

### Phase 2: Event Creation System

#### 2.1 Event Lifecycle
```
States: draft → submitted → approved → scheduled → live → completed → locked
        ↘ cancelled (can happen at most stages)

Ownership:
- Club-owned: No approval needed, goes directly to scheduled
- Host-owned: Requires slot request → club approval
```

#### 2.2 Required Validations
- [ ] Valid partnership check before host can request slot
- [ ] Club approval gate before publishing
- [ ] Capacity limits enforced
- [ ] Date/time conflict detection

---

### Phase 3: Club Calendar (Operational Depth)

#### 3.1 Features per Date
- [ ] All events (approved + pending)
- [ ] Internal notes
- [ ] Operational notes
- [ ] Reminders/todos
- [ ] Expected footfall
- [ ] Staff assignments
- [ ] Incident logs
- [ ] Inspection records

#### 3.2 Database Schema
```javascript
// club_calendar collection
{
  clubId: string,
  date: string (YYYY-MM-DD),
  status: "available" | "blocked" | "partial",
  events: [{ eventId, title, status, timeSlot }],
  notes: {
    internal: string,
    operational: string
  },
  expectedFootfall: number,
  staffAssignments: [{ staffId, role, shift }],
  incidents: [{ type, description, timestamp }],
  inspections: [{ type, passed, date, inspector }],
  reminders: [{ text, dueTime, completed }],
  createdAt: timestamp,
  updatedAt: timestamp
}
```

---

### Phase 4: Ticketing System

#### 4.1 Ticket Types
```javascript
entryTypes: [
  "stag",
  "couple", 
  "female",
  "general",
  "group",
  "vip",
  "table"
]
```

#### 4.2 Ticket Tier Schema
```javascript
{
  id: string,
  name: string,
  entryType: string,
  price: number,
  quantity: number,
  remaining: number,
  salesStart: timestamp,
  salesEnd: timestamp,
  minPerOrder: number,
  maxPerOrder: number,
  promoterEnabled: boolean,
  promoterCommission: number,
  promoterDiscount: number, // Discount for buyers using promoter link
  description: string
}
```

#### 4.3 Inventory Rules
- Atomic decrements using Firestore transactions
- Never oversell (validate before confirm)
- Respect capacity limits
- Real-time remaining count updates

---

### Phase 5: User Website Booking Flow

#### 5.1 Free Events (RSVP)
```
User RSVPs → Generate ticket → Generate QR → Store in user account
```

#### 5.2 Paid Events
```
Select tickets → Checkout → Payment gateway → 
Confirm payment → Generate ticket → Generate QR → 
Update inventory → Store in account
```

#### 5.3 QR Code System
```javascript
// QR Code payload
{
  orderId: string,
  eventId: string,
  ticketId: string,
  userId: string,
  timestamp: number,
  signature: string // HMAC for verification
}
```

---

### Phase 6: Staff Management & RBAC

#### 6.1 Staff Collection Schema
```javascript
// club_staff collection
{
  id: string,
  clubId: string,
  userId: string,
  email: string,
  name: string,
  role: "security" | "floor_manager" | "ops" | "finance" | "viewer",
  permissions: {
    viewEvents: boolean,
    editEvents: boolean,
    viewFinance: boolean,
    manageStaff: boolean,
    viewAnalytics: boolean,
    scanTickets: boolean
  },
  isVerified: boolean,
  addedBy: string,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### 6.2 Role Presets
```javascript
const rolePresets = {
  security: {
    viewEvents: true,
    scanTickets: true
  },
  floor_manager: {
    viewEvents: true,
    editEvents: true,
    scanTickets: true
  },
  ops: {
    viewEvents: true,
    editEvents: true,
    viewAnalytics: true
  },
  finance: {
    viewEvents: true,
    viewFinance: true,
    viewAnalytics: true
  },
  viewer: {
    viewEvents: true
  }
};
```

---

### Phase 7: Discover & Profile Management

#### 7.1 Profile Schema (Clubs & Hosts)
```javascript
{
  id: string,
  type: "club" | "host",
  displayName: string,
  bio: string,
  coverImage: string, // Primary discovery card image
  profileImage: string,
  photos: [string],
  highlights: [{
    id: string,
    image: string,
    caption: string,
    likes: number,
    createdAt: timestamp
  }],
  followers: number,
  followersIds: [string], // For notification targeting
  posts: [{
    id: string,
    content: string,
    image: string,
    likes: number,
    createdAt: timestamp
  }],
  pastEvents: [eventId],
  upcomingEvents: [eventId],
  isVerified: boolean,
  city: string,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### 7.2 Dashboard Profile Management
- Edit bio, photos, cover image
- View/manage followers
- Create posts/highlights
- See analytics (views, follows)

---

### Phase 8: Notification System

#### 8.1 Notification Triggers
```javascript
// Club posts event
→ Notify all club followers

// Host posts event
→ Notify all host followers

// Host posts event at Club
→ Notify host followers
→ Notify club followers (deduplicated)

// Event status changes
→ Notify ticket holders
→ Notify interested users
```

#### 8.2 Notification Collection
```javascript
{
  id: string,
  userId: string,
  type: "new_event" | "event_update" | "ticket_ready" | "reminder",
  title: string,
  body: string,
  data: {
    eventId?: string,
    orderId?: string,
    hostId?: string,
    clubId?: string
  },
  isRead: boolean,
  createdAt: timestamp
}
```

---

### Phase 9: Synchronization Rules

#### 9.1 Real-time Listeners Required
- Event status changes → All dashboards
- Ticket inventory → Website + Dashboards
- Calendar updates → Club + Host dashboards
- Partnership status → Club + Host dashboards

#### 9.2 Consistency Guarantees
- Use Firestore transactions for inventory
- Optimistic UI with server validation
- Conflict resolution on concurrent edits

---

## Implementation Priority Order

### Sprint 1: Core Fixes (Days 1-3)
1. [ ] Fix calendar privacy for hosts
2. [ ] Add promoter discount to ticketing
3. [ ] Implement QR code generation
4. [ ] Complete event lifecycle states

### Sprint 2: Club Operations (Days 4-6)
1. [ ] Enhanced calendar with notes/registers
2. [ ] Staff management system
3. [ ] RBAC implementation
4. [ ] Staff login flow

### Sprint 3: User Experience (Days 7-9)
1. [ ] Free event RSVP with QR
2. [ ] Paid event checkout completion
3. [ ] User ticket management page
4. [ ] QR scanning API

### Sprint 4: Discovery & Social (Days 10-12)
1. [ ] Profile management in dashboards
2. [ ] Discover page data sync
3. [ ] Notification system
4. [ ] Follower-based alerts

### Sprint 5: Integration & Polish (Days 13-15)
1. [ ] Real-time sync testing
2. [ ] Edge case handling
3. [ ] Error recovery
4. [ ] Documentation

---

## File Structure for New Components

```
apps/partner-dashboard/
├── lib/server/
│   ├── staffStore.js          # Staff management
│   ├── notificationStore.js   # Notification dispatching
│   ├── profileStore.js        # Profile management
│   └── qrStore.js             # QR generation/validation
├── app/club/
│   ├── staff/page.tsx         # Staff management
│   ├── profile/page.tsx       # Profile editing
│   └── calendar/              # Enhanced calendar
└── components/
    ├── staff/                 # Staff components
    ├── calendar/              # Calendar components
    └── profile/               # Profile editors

apps/guest-portal/
├── lib/server/
│   ├── qrStore.js             # QR generation
│   └── notificationStore.js   # User notifications
├── app/
│   └── tickets/[orderId]/     # Ticket with QR
└── components/
    └── QRTicket.jsx           # QR display component
```

---

## Success Criteria

The system is complete when:
- [ ] Partnerships gate access correctly
- [ ] Calendars never conflict
- [ ] Events appear correctly on website
- [ ] Promoter attribution always works
- [ ] Tickets never oversell
- [ ] QR codes scan reliably
- [ ] Staff access is controlled
- [ ] Discover pages stay accurate
- [ ] Notifications fire correctly
- [ ] No mock behavior exists
- [ ] No partial implementations
- [ ] No orphaned states
