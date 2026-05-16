# Database Schema Documentation

## Overview

THE C1RCLE uses **Firebase Firestore** as the primary database. This document outlines the core collections and data structures.

---

## Table of Contents
1. [Collection Overview](#collection-overview)
2. [Core Collections](#core-collections)
3. [Reference Data](#reference-data)
4. [Index Recommendations](#index-recommendations)
5. [Data Patterns](#data-patterns)

---

## Collection Overview

| Collection | Purpose | Read/Write Pattern |
|------------|---------|-------------------|
| `events` | Event listings | High read, Medium write |
| `orders` | Ticket orders | Medium read, Medium write |
| `reservations` | Temporary holds | Low read, High write |
| `users` | User profiles | Medium read, Low write |
| `venues` | Venue information | Medium read, Low write |
| `hosts` | Host information | Medium read, Low write |
| `staff` | Staff members | Low read, Medium write |
| `partner_memberships` | Staff-role mapping | Medium read, Medium write |
| `tickets` | Ticket records | High read, Medium write |
| `ledger_entries` | Financial transactions | Low read, Medium write |
| `promo_codes` | Promo/discounts | Low read, Low write |
| `waitlist` | Waitlist entries | Low read, Medium write |

---

## Core Collections

### 1. Events Collection

```typescript
interface Event {
    // Identity
    id: string;                    // Auto-generated UUID
    slug: string;                  // URL-friendly identifier

    // Content
    title: string;
    summary?: string;
    description?: string;
    category: string;              // e.g., "Trending", "Music", "Nightlife"
    tags?: string[];

    // Organization
    host: string;                  // Display name
    hostId?: string;               // Reference to hosts collection

    // Location
    location: string;
    venue?: string;
    venueId?: string;
    city: string;                  // e.g., "Pune, IN"
    cityKey: string;               // e.g., "pune-in"
    country: string;

    // Date/Time
    startDate: string;              // ISO 8601
    endDate?: string;
    timezone: string;              // e.g., "Asia/Kolkata"

    // Media
    poster: string;
    image?: string;
    gallery?: string[];

    // Tickets
    tickets?: TicketTier[];
    tables?: Table[];
    priceRange?: {
        min: number;
        max: number;
        currency: string;
    };
    isRSVP: boolean;

    // Status
    lifecycle: 'draft' | 'submitted' | 'approved' | 'scheduled' | 'live' | 'completed' | 'cancelled';
    status?: 'upcoming' | 'live' | 'past';

    // Settings
    promoterVisibility: boolean;
    settings: {
        showExplore: boolean;
        visibility: 'public' | 'private';
        passwordCode?: string;
    };

    // Metrics
    stats: {
        rsvps: number;
        views: number;
        saves: number;
        shares: number;
    };

    // Audit
    createdAt: string;
    updatedAt: string;
    creatorRole: 'venue' | 'host';
    creatorId: string;
    auditTrail?: Array<{
        action: string;
        actorId: string;
        timestamp: string;
    }>;
}
```

### 2. Orders Collection

```typescript
interface Order {
    id: string;                    // e.g., "ORD-XXXXXXXX"
    eventId: string;
    eventName: string;

    userId: string;
    userName: string;
    userEmail: string;
    userPhone: string;

    tickets: Array<{
        ticketId: string;
        name: string;
        quantity: number;
        price: number;
        total: number;
    }>;

    subtotal: number;
    discounts?: Array<{
        type: string;
        code?: string;
        amount: number;
    }>;
    discountTotal: number;
    fees: number;
    totalAmount: number;

    status: 'payment_pending' | 'confirmed' | 'cancelled' | 'refunded';
    isRSVP: boolean;

    // Payment
    paymentId?: string;
    paymentOrderId?: string;
    paymentMethod?: string;

    // Reservation
    reservationId?: string;

    // Promotion
    promoterCode?: string;

    // Timestamps
    createdAt: string;
    confirmedAt?: string;
    updatedAt: string;
}
```

### 3. Reservations Collection

```typescript
interface Reservation {
    id: string;                    // UUID
    eventId: string;
    customerId: string;            // User ID or device ID
    deviceId?: string;

    items: Array<{
        tierId: string;
        quantity: number;
    }>;

    status: 'active' | 'converted' | 'released' | 'expired';
    expiresAt: string;            // 5 minutes from creation

    // Conversion
    orderId?: string;
    convertedAt?: string;

    createdAt: string;
}
```

### 4. Tickets Collection

```typescript
interface Ticket {
    id: string;
    orderId: string;
    eventId: string;

    tierId: string;
    tierName: string;
    quantity: number;

    ownerId: string;
    ownerEmail: string;

    // Transfer
    transferToken?: string;
    transferExpiresAt?: string;
    transferredTo?: string;

    // Usage
    isUsed: boolean;
    scannedAt?: string;
    scannedBy?: string;

    // QR Code
    qrCode?: string;
    signature?: string;

    createdAt: string;
}
```

### 5. Users Collection

```typescript
interface User {
    id: string;                    // Firebase UID
    email: string;
    displayName?: string;
    photoURL?: string;
    phone?: string;

    // Profile
    dateOfBirth?: string;
    gender?: string;

    // Preferences
    notificationSettings: {
        email: boolean;
        push: boolean;
        sms: boolean;
    };

    // Onboarding
    onboardingCompleted: boolean;
    interests?: string[];

    // Timestamps
    createdAt: string;
    updatedAt: string;
}
```

### 6. Venues Collection

```typescript
interface Venue {
    id: string;
    name: string;
    slug: string;

    // Owner
    ownerId: string;               // Firebase UID
    ownerEmail: string;

    // Location
    address: string;
    city: string;
    cityKey: string;
    coordinates?: {
        latitude: number;
        longitude: number;
    };

    // Details
    description?: string;
    amenities?: string[];
    photos?: string[];
    logo?: string;

    // Configuration
    settings: {
        defaultTimezone: string;
        defaultCurrency: string;
    };

    // Timestamps
    createdAt: string;
    updatedAt: string;
}
```

### 7. Hosts Collection

```typescript
interface Host {
    id: string;
    name: string;
    slug: string;

    ownerId: string;
    ownerEmail: string;

    bio?: string;
    avatar?: string;
    socialLinks?: {
        instagram?: string;
        twitter?: string;
    };

    createdAt: string;
    updatedAt: string;
}
```

### 8. Staff / Partner Memberships Collection

```typescript
interface PartnerMembership {
    id: string;
    partnerId: string;             // Venue or Host ID
    partnerType: 'venue' | 'host';

    uid: string;                   // Firebase UID
    email: string;
    name: string;

    role: 'owner' | 'manager' | 'ops' | 'viewer';
    permissions: string[];

    status: 'active' | 'invited' | 'removed';
    invitedAt: string;
    joinedAt?: string;

    // Invite token for email link
    inviteToken?: string;
}
```

### 9. Promo Codes Collection

```typescript
interface PromoCode {
    id: string;
    eventId?: string;               // null = global

    code: string;                  // Uppercase
    label?: string;

    discountType: 'percentage' | 'fixed';
    discountValue: number;

    // Limits
    maxUses?: number;
    usesCount: number;
    maxPerUser?: number;

    // Validity
    validFrom?: string;
    validUntil?: string;

    // Requirements
    minOrderValue?: number;
    applicableTiers?: string[];    // Ticket tier IDs

    createdBy: string;
    createdAt: string;
}
```

### 10. Ledger Entries Collection

```typescript
interface LedgerEntry {
    id: string;
    actorId: string;               // Venue or Host ID
    actorType: 'venue' | 'host' | 'promoter';

    type: 'capture' | 'refund' | 'payout' | 'fee' | 'hold';
    state: 'pending' | 'held' | 'captured' | 'refunded' | 'paid_out';

    amount: number;
    currency: string;

    orderId?: string;
    eventId?: string;

    // For refunds
    refundId?: string;
    refundReason?: string;

    timestamp: string;
}
```

### 11. Waitlist Collection

```typescript
interface WaitlistEntry {
    id: string;
    eventId: string;
    tierId?: string;               // Specific tier or general

    email: string;
    phone?: string;
    userId?: string;              // If logged in

    position: number;              // Current position in queue

    status: 'waiting' | 'notified' | 'converted' | 'expired';

    notifiedAt?: string;
    createdAt: string;
}
```

---

## Reference Data

### Cities Configuration (In-Code)

```javascript
// From events.js
const CITY_MAP = [
    { key: "pune-in", label: "Pune, IN", matches: ["pune", "kp", "koregaon"] },
    { key: "mumbai-in", label: "Mumbai, IN", matches: ["mumbai", "bandra", "andheri"] },
    { key: "bengaluru-in", label: "Bengaluru, IN", matches: ["bangalore", "bengaluru"] },
    // ... more cities
];
```

### Event Lifecycle States

```javascript
const EVENT_LIFECYCLE = {
    DRAFT: "draft",
    SUBMITTED: "submitted",
    NEEDS_CHANGES: "needs_changes",
    APPROVED: "approved",
    SCHEDULED: "scheduled",
    LIVE: "live",
    COMPLETED: "completed",
    CANCELLED: "cancelled"
};
```

---

## Index Recommendations

These indexes are required for the application to function properly:

```json
// firestore.indexes.json
{
    "indexes": [
        {
            "collectionGroup": "events",
            "queryScope": "COLLECTION",
            "fields": [
                { "fieldPath": "lifecycle", "order": "ASC" },
                { "fieldPath": "startDate", "order": "ASC" }
            ]
        },
        {
            "collectionGroup": "orders",
            "queryScope": "COLLECTION",
            "fields": [
                { "fieldPath": "eventId", "order": "ASC" },
                { "fieldPath": "status", "order": "ASC" }
            ]
        },
        {
            "collectionGroup": "partner_memberships",
            "queryScope": "COLLECTION",
            "fields": [
                { "fieldPath": "partnerId", "order": "ASC" },
                { "fieldPath": "uid", "order": "ASC" }
            ]
        },
        {
            "collectionGroup": "waitlist",
            "queryScope": "COLLECTION",
            "fields": [
                { "fieldPath": "eventId", "order": "ASC" },
                { "fieldPath": "status", "order": "ASC" }
            ]
        }
    ]
}
```

---

## Data Patterns

### Document IDs

| Collection | ID Format | Example |
|------------|-----------|---------|
| events | UUID | `evt_a1b2c3d4e5f6` |
| orders | Prefix + timestamp | `ORD-20240515ABC` |
| users | Firebase UID | `Firebase Auth UUID` |
| venues | UUID | `ven_xyz123` |
| tickets | UUID | `tkt_abc123` |

### Timestamps

- All timestamps stored as **ISO 8601 strings**
- Example: `"2024-05-15T18:30:00.000Z"`
- Use Firestore's `FieldValue.serverTimestamp()` for auto-set

### Soft Deletes

For sensitive data (events, orders), use soft delete pattern:

```typescript
// Instead of deleting, mark as deleted
await eventRef.update({
    isDeleted: true,
    deletedAt: new Date().toISOString(),
    lifecycle: 'cancelled'
});
```

### Subcollections vs Root Collections

| Use Subcollection | Use Root Collection |
|-------------------|---------------------|
| Data tied to parent | Independent data |
| Rarely queried alone | Frequently queried |
| Small, bounded size | Large or growing |
| Example: `events/{id}/ticket_shards` | Example: `events`, `orders` |

---

## Data Access Patterns

### Common Queries

```typescript
// Get public events
const events = await db.collection('events')
    .where('lifecycle', 'in', ['scheduled', 'live'])
    .orderBy('startDate', 'asc')
    .limit(20)
    .get();

// Get user's orders
const orders = await db.collection('orders')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .get();

// Get venue's staff
const staff = await db.collection('partner_memberships')
    .where('partnerId', '==', venueId)
    .where('status', '==', 'active')
    .get();
```

---

## Security Rules

See `firestore.rules` for detailed security configuration.

---

*Last Updated: May 2026*