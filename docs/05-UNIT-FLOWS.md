# Unit Flows & Code Patterns

## Overview

This document covers the core code patterns, unit-level flows, and common implementations you'll encounter in the codebase.

---

## Table of Contents
1. [Service Layer Patterns](#service-layer-patterns)
2. [Repository Patterns](#repository-patterns)
3. [Route Handler Patterns](#route-handler-patterns)
4. [Engine Functions](#engine-functions)
5. [Plugin Architecture](#plugin-architecture)
6. [Common Utilities](#common-utilities)

---

## Service Layer Patterns

### 1. Event Service

**File**: `packages/core/src/domain/services/event-service.ts`

```typescript
import { IEventRepository, Event } from '../repositories/event-repository.js';

export class EventService {
    constructor(private eventRepo: IEventRepository) { }

    async getEventByIdOrSlug(id: string): Promise<Event | null> {
        // Try by ID first, then by slug
        const event = await this.eventRepo.getById(id);
        if (event) return event;
        return this.eventRepo.getBySlug(id);
    }

    async listEvents(filters: any): Promise<{ events: Event[], hasMore: boolean }> {
        const { limit = 20 } = filters;
        const events = await this.eventRepo.list({ ...filters, limit: limit + 1 });

        const hasMore = events.length > limit;
        const data = events.slice(0, limit);

        return { events: data, hasMore };
    }

    async createEvent(payload: any, actorId: string): Promise<Event> {
        const { buildEvent } = await import('@c1rcle/core/event-engine');
        const event = buildEvent({ ...payload, creatorId: actorId });
        await this.eventRepo.create(event as Event);
        return event as Event;
    }

    async listNearby(lat: number, lng: number, radius: number, limit: number): Promise<any[]> {
        const events = await this.eventRepo.listNearby(lat, lng, radius);
        // Calculate distances and sort
        return events
            .map((data: any) => ({
                ...data,
                distance: this.haversine(lat, lng, data.coordinates)
            }))
            .filter((e: any) => e.distance <= radius)
            .sort((a: any, b: any) => a.distance - b.distance)
            .slice(0, limit);
    }
}
```

### 2. Checkout Service

**File**: `packages/core/src/domain/services/checkout-service.ts`

```typescript
export class CheckoutService {
    constructor(
        private orderRepo: IOrderRepository,
        private eventRepo: IEventRepository
    ) { }

    async validatePricing(params: any): Promise<any> {
        const { calculatePricing } = await import('@c1rcle/core/pricing-engine');
        const event = await this.eventRepo.getById(params.eventId);
        if (!event) throw new Error('Event not found');
        return calculatePricing({ ...params, event });
    }

    async reserveItems(eventId: string, userId: string, deviceId: string | null, items: any[]): Promise<any> {
        const { createReservation } = await import('@c1rcle/core/inventory-engine');
        const event = await this.eventRepo.getById(eventId);
        if (!event) throw new Error('Event not found');

        const result = await createReservation(event, userId, deviceId, items);

        if (result.success) {
            await this.orderRepo.createReservation({
                id: result.reservationId,
                eventId,
                customerId: userId,
                deviceId,
                items,
                status: 'active',
                createdAt: new Date().toISOString(),
                expiresAt: result.expiresAt
            });
        }

        return result;
    }

    async initiateCheckout(params: {
        reservationId: string,
        userId: string,
        userName: string,
        userEmail: string,
        userPhone: string,
        promoCode?: string,
        promoterCode?: string
    }): Promise<any> {
        // 1. Validate reservation
        const reservation = await this.orderRepo.getReservationById(params.reservationId);
        if (!reservation) throw new Error('Reservation not found');
        if (reservation.status !== 'active') throw new Error(`Reservation is ${reservation.status}`);
        if (new Date(reservation.expiresAt) < new Date()) {
            await this.orderRepo.updateReservation(params.reservationId, { status: 'expired' });
            throw new Error('Reservation has expired');
        }

        // 2. Calculate pricing
        const event = await this.eventRepo.getById(reservation.eventId);
        const pricingResult = await calculatePricing({ /* ... */ });

        // 3. Create order in transaction
        await this.orderRepo.runInTransaction(async (transaction) => {
            await this.orderRepo.createOrder(orderPayload, transaction);
            await this.orderRepo.updateReservation(params.reservationId, {
                status: 'converted',
                orderId: orderId
            }, transaction);
        });

        // 4. Trigger async workflows
        if (orderPayload.status === 'confirmed') {
            await this.triggerInngest(Events.TICKET_PURCHASED, orderPayload);
        }

        return { success: true, order: orderPayload, pricing };
    }
}
```

---

## Repository Patterns

### 1. Event Repository

**File**: `packages/core/src/infrastructure/repositories/firebase/event-repository.ts`

```typescript
import { IEventRepository, Event } from '../../domain/repositories/event-repository.js';

export class FirebaseEventRepository implements IEventRepository {
    constructor(private db: Firestore) { }

    private get collection() {
        return this.db.collection('events');
    }

    async getById(id: string): Promise<Event | null> {
        const doc = await this.collection.doc(id).get();
        return doc.exists ? { id: doc.id, ...doc.data() } as Event : null;
    }

    async getBySlug(slug: string): Promise<Event | null> {
        const snapshot = await this.collection
            .where('slug', '==', slug)
            .limit(1)
            .get();

        if (snapshot.empty) return null;
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as Event;
    }

    async list(filters: any): Promise<Event[]> {
        let query = this.collection;

        // Apply lifecycle filter
        if (filters.lifecycle) {
            query = query.where('lifecycle', '==', filters.lifecycle);
        }

        // Apply city filter
        if (filters.city) {
            query = query.where('cityKey', '==', filters.city);
        }

        // Apply ordering
        query = query.orderBy('createdAt', 'desc');

        // Apply pagination
        if (filters.limit) {
            query = query.limit(filters.limit);
        }

        const snapshot = await query.get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Event[];
    }

    async create(event: Event): Promise<void> {
        await this.collection.doc(event.id).set(event);
    }

    async update(id: string, updates: Partial<Event>): Promise<void> {
        await this.collection.doc(id).update({
            ...updates,
            updatedAt: new Date().toISOString()
        });
    }

    async listNearby(lat: number, lng: number, radius: number): Promise<any[]> {
        // Get all scheduled events (Geo query requires special setup)
        const snapshot = await this.collection
            .where('lifecycle', '==', 'scheduled')
            .get();

        return snapshot.docs.map(doc => doc.data());
    }
}
```

### 2. Order Repository

**File**: `packages/core/src/infrastructure/repositories/firebase/order-repository.ts`

```typescript
export class FirebaseOrderRepository implements IOrderRepository {
    constructor(private db: Firestore) { }

    async createOrder(order: Order, transaction?: Transaction): Promise<void> {
        const ref = this.db.collection('orders').doc(order.id);
        if (transaction) {
            transaction.create(ref, order);
        } else {
            await ref.set(order);
        }
    }

    async getOrderById(orderId: string): Promise<Order | null> {
        const doc = await this.db.collection('orders').doc(orderId).get();
        return doc.exists ? { id: doc.id, ...doc.data() } as Order : null;
    }

    async runInTransaction<T>(fn: (transaction: Transaction) => Promise<T>): Promise<T> {
        return this.db.runTransaction(fn) as Promise<T>;
    }

    async createReservation(reservation: Reservation): Promise<void> {
        await this.db.collection('reservations').doc(reservation.id).set(reservation);
    }

    async getReservationById(id: string): Promise<Reservation | null> {
        const doc = await this.db.collection('reservations').doc(id).get();
        return doc.exists ? { id: doc.id, ...doc.data() } as Reservation : null;
    }

    async updateReservation(id: string, updates: Partial<Reservation>, transaction?: Transaction): Promise<void> {
        const ref = this.db.collection('reservations').doc(id);
        if (transaction) {
            transaction.update(ref, updates);
        } else {
            await ref.update(updates);
        }
    }

    async createPaymentRecord(payment: PaymentRecord): Promise<void> {
        await this.db.collection('payments').doc(payment.orderId).set(payment);
    }
}
```

---

## Route Handler Patterns

### Standard Route Structure

**File**: `apps/api-gateway/src/routes/v1/events.ts`

```typescript
import { FastifyInstance } from 'fastify';

export default async function eventRoutes(fastify: FastifyInstance) {
    // GET /events - List events
    fastify.get('/events', async (request: any, reply) => {
        try {
            const result = await fastify.eventService.listEvents(request.query);
            return result;
        } catch (error: any) {
            fastify.log.error(`Error in GET /events: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });

    // GET /events/:id - Get single event
    fastify.get('/events/:id', async (request: any, reply) => {
        const { id } = request.params;
        try {
            const event = await fastify.eventService.getEventByIdOrSlug(id);
            if (!event) return reply.status(404).send({ error: "Event not found" });
            return event;
        } catch (error: any) {
            fastify.log.error(`Error in GET /events/:id: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });

    // POST /events - Create event (authenticated)
    fastify.post('/events', async (request: any, reply) => {
        const userId = request.user?.uid;
        if (!userId) return reply.status(401).send({ error: "Unauthorized" });

        try {
            const event = await fastify.eventService.createEvent(request.body, userId);
            return { success: true, id: event.id };
        } catch (error: any) {
            fastify.log.error(`Error in POST /events: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });

    // PATCH /events/:id - Update event (authenticated)
    fastify.patch('/events/:id', async (request: any, reply) => {
        const userId = request.user?.uid;
        const { id } = request.params;
        if (!userId) return reply.status(401).send({ error: "Unauthorized" });

        try {
            const event = await fastify.eventService.updateEvent(id, request.body, userId);
            if (!event) return reply.status(404).send({ error: "Event not found" });
            return { success: true, id: event.id };
        } catch (error: any) {
            fastify.log.error(`Error in PATCH /events/:id: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });

    // DELETE /events/:id - Delete event (authenticated)
    fastify.delete('/events/:id', async (request: any, reply) => {
        const userId = request.user?.uid;
        const { id } = request.params;
        if (!userId) return reply.status(401).send({ error: "Unauthorized" });

        try {
            await fastify.eventService.deleteEvent(id, userId);
            return { success: true, message: "Event deleted" };
        } catch (error: any) {
            fastify.log.error(`Error in DELETE /events/:id: ${error.message}`);
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    });
}
```

### Route with RBAC Permission Check

```typescript
// routes/v1/staff.ts
import { hasStaffPermission, ROLE_PRESETS } from '@c1rcle/core/staff-engine';

export default async function staffRoutes(fastify: FastifyInstance) {
    // Get staff list - requires viewEvents permission
    fastify.get('/staff/:venueId', async (request: any, reply) => {
        const { venueId } = request.params;
        const actorId = request.user?.uid;

        const hasAccess = await hasStaffPermission(fastify.db, venueId, actorId, 'viewEvents');
        if (!hasAccess) return reply.status(403).send({ error: "Forbidden" });

        const staffSnapshot = await fastify.db
            .collection('partner_memberships')
            .where('partnerId', '==', venueId)
            .where('status', '==', 'active')
            .get();

        return {
            staff: staffSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
        };
    });

    // Invite staff - requires manageStaff permission
    fastify.post('/staff/:venueId', async (request: any, reply) => {
        const { venueId } = request.params;
        const actorId = request.user?.uid;
        const { email, role, name } = request.body;

        const canInvite = await hasStaffPermission(fastify.db, venueId, actorId, 'manageStaff');
        if (!canInvite) return reply.status(403).send({ error: "Forbidden" });

        // Create staff invite...
        return { success: true };
    });
}
```

---

## Engine Functions

### 1. Event Engine

**File**: `packages/core/event-engine.js`

```javascript
import { randomUUID } from "node:crypto";

export function calculateHeatScore(event) {
    const stats = event.stats || {};
    const guestsCount = Array.isArray(event.guests) ? event.guests.length : 0;
    const now = Date.now();
    const startMs = event.startDate ? new Date(event.startDate).getTime() : now;
    const hoursUntil = Math.max((startMs - now) / 36e5, 0);

    const recencyBoost = Math.max(168 - hoursUntil, 0);
    const guestBoost = guestsCount * 4;
    const rsvpBoost = (stats.rsvps || guestsCount) * 3;
    const viewsBoost = (stats.views || 0) * 0.1;
    const saveBoost = (stats.saves || 0) * 0.4;
    const shareBoost = (stats.shares || 0) * 0.8;

    return Math.round(recencyBoost + guestBoost + rsvpBoost + viewsBoost + saveBoost + shareBoost);
}

export function buildEvent(payload = {}) {
    // Validation
    const isDraft = payload.lifecycle === 'draft';
    const required = isDraft
        ? ["title"]
        : (payload.creatorRole === 'venue' ? ["title", "city", "host"] : ["title", "startDate", "location", "host"]);

    const missing = required.filter((field) => !payload[field]);
    if (missing.length) {
        throw new Error(`Missing fields: ${missing.join(", ")}`);
    }

    // Build event object
    const event = {
        id: payload.id || randomUUID(),
        slug: payload.slug || payload.id || randomUUID(),
        title: payload.title?.trim(),
        // ... all fields
        lifecycle: payload.lifecycle || 'draft',
        // ...
    };

    event.status = determineStatus(event.startDate, event.endDate);
    event.heatScore = calculateHeatScore(event);

    return event;
}

export const EVENT_SORTERS = {
    heat: (a, b) => (b.heatScore ?? 0) - (a.heatScore ?? 0),
    new: (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
    soonest: (a, b) => new Date(a.startDate || 0) - new Date(b.startDate || 0),
    price: (a, b) => resolveStartingPrice(a) - resolveStartingPrice(b)
};

export function filterAndSortEvents(events, { city, sort = "heat", search, host } = {}) {
    // Filter and sort implementation
}
```

### 2. Staff Engine (RBAC)

**File**: `packages/core/staff-engine.js`

```javascript
export const ROLE_PRESETS = {
    owner: {
        permissions: ['all_permissions']  // Special case handled in code
    },
    manager: {
        permissions: [
            'viewEvents', 'editEvents', 'publishEvents',
            'viewFinance',
            'viewGuests', 'manageGuests',
            'scanTickets', 'viewScans',
            'manageStaff', 'editStaff',
            'viewAnalytics'
        ]
    },
    ops: {
        permissions: ['viewEvents', 'editEvents', 'viewGuests', 'scanTickets']
    },
    viewer: {
        permissions: ['viewEvents']
    }
};

export async function hasStaffPermission(db, venueId, userId, permission) {
    // 1. Check if user is venue owner
    const venueDoc = await db.collection('venues').doc(venueId).get();
    if (venueDoc.exists && venueDoc.data()?.ownerId === userId) {
        return true;
    }

    // 2. Check staff membership
    const membershipSnapshot = await db.collection('partner_memberships')
        .where('partnerId', '==', venueId)
        .where('uid', '==', userId)
        .limit(1)
        .get();

    if (membershipSnapshot.empty) return false;

    const membership = membershipSnapshot.docs[0].data();
    const rolePermissions = ROLE_PRESETS[membership.role]?.permissions || [];

    return rolePermissions.includes(permission) || rolePermissions.includes('all_permissions');
}
```

### 3. Pricing Engine

**File**: `packages/core/pricing-engine.js`

```javascript
export async function calculatePricing(input) {
    const { event, items, promoCode, promoterCode, userId } = input;

    // Base pricing
    let subtotal = 0;
    const pricedItems = items.map(item => {
        const tier = event.tickets.find(t => t.id === item.tierId);
        if (!tier) throw new Error(`Tier ${item.tierId} not found`);

        const unitPrice = tier.price || 0;
        const total = unitPrice * item.quantity;
        subtotal += total;

        return {
            tierId: item.tierId,
            tierName: tier.name,
            quantity: item.quantity,
            unitPrice,
            subtotal: total
        };
    });

    // Apply discounts
    let discountTotal = 0;
    const discounts = [];

    // Promo code discount
    if (promoCode) {
        const promoResult = await validatePromoCode(event.id, promoCode, userId, items);
        if (promoResult.valid) {
            discountTotal += promoResult.discountAmount;
            discounts.push({ type: 'promo', code: promoCode, amount: promoResult.discountAmount });
        }
    }

    // Calculate fees
    const fees = (subtotal - discountTotal) * 0.05; // 5% platform fee

    const grandTotal = subtotal - discountTotal + fees;

    return {
        success: true,
        items: pricedItems,
        subtotal,
        discounts,
        discountTotal,
        fees,
        grandTotal,
        isFree: grandTotal === 0
    };
}
```

---

## Plugin Architecture

### Firebase Plugin (Services Initialization)

**File**: `apps/api-gateway/src/plugins/firebase.ts`

```typescript
import fp from 'fastify-plugin';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

export default fp(async (fastify) => {
    // Initialize Firebase
    if (!getApps().length) {
        initializeApp({
            credential: cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
        });
    }

    const db = getFirestore();
    const auth = getAuth();

    // Import and initialize services
    const { EventService } = await import('@c1rcle/core/event-service');
    const { CheckoutService } = await import('@c1rcle/core/checkout-service');

    // Create repository instances
    const eventRepo = new FirebaseEventRepository(db);
    const orderRepo = new FirebaseOrderRepository(db);

    // Create service instances
    const eventService = new EventService(eventRepo);
    const checkoutService = new CheckoutService(orderRepo, eventRepo);

    // Decorate fastify instance
    fastify.decorate('db', db);
    fastify.decorate('auth', auth);
    fastify.decorate('eventService', eventService);
    fastify.decorate('checkoutService', checkoutService);

    // Auth hook for all requests
    fastify.addHook('onRequest', async (request, reply) => {
        const authHeader = request.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return;

        const token = authHeader.split(' ')[1];
        try {
            const user = await auth.verifyIdToken(token);
            request.user = user;
        } catch (error) {
            request.log.warn('Token verification failed');
        }
    });
});
```

---

## Common Utilities

### 1. City Normalization

**File**: `packages/core/events.js`

```javascript
const CITY_MAP = [
    { key: "pune-in", label: "Pune, IN", matches: ["pune", "kp", "koregaon", "baner"] },
    { key: "mumbai-in", label: "Mumbai, IN", matches: ["mumbai", "bandra", "andheri"] },
    { key: "bengaluru-in", label: "Bengaluru, IN", matches: ["bangalore", "bengaluru", "blr"] },
    // ... more cities
];

export function normalizeCity(cityStr, locationStr = "") {
    const input = `${cityStr || ""} ${locationStr || ""}`.toLowerCase();
    const found = CITY_MAP.find(c =>
        c.matches.some(m => input.includes(m)) ||
        input.includes(c.key)
    );
    return found ? found.key : "other-in";
}

export function getCityLabel(key) {
    const found = CITY_MAP.find(c => c.key === key);
    return found ? found.label : "Other City, IN";
}
```

### 2. Event Poster Resolution

**File**: `packages/core/events.js`

```javascript
export function resolvePoster(event) {
    if (!event) return "/events/placeholder.svg";

    const isInternalPlaceholder = (url) => {
        if (!url || typeof url !== "string") return false;
        return url.includes("placeholder.svg") || url.includes("holi-edit.svg");
    };

    // Priority: poster > image > flyer
    const poster = event.poster || event.image || event.flyer;
    if (poster && typeof poster === "string" && !isInternalPlaceholder(poster)) {
        return poster;
    }

    // Check arrays
    if (Array.isArray(event.images) && event.images.length > 0) {
        const first = event.images[0];
        if (first && !isInternalPlaceholder(first)) return first;
    }
    if (Array.isArray(event.gallery) && event.gallery.length > 0) {
        const first = event.gallery[0];
        if (first && !isInternalPlaceholder(first)) return first;
    }

    return "/events/placeholder.svg";
}
```

### 3. Event Client Mapping

**File**: `packages/core/events.js`

```javascript
export function mapEventForClient(data, id) {
    if (!data) return null;

    const eventId = id || data.id || data.slug;
    const poster = resolvePoster(data);
    const cityKey = data.cityKey || normalizeCity(data.city, data.location);

    const settings = { ...data.settings };
    if (settings.passwordCode) delete settings.passwordCode;

    const creatorRole = data.creatorRole || (data.hostId ? "host" : "venue");
    const eventType = creatorRole === "host" ? "host" : "venue";
    let lifecycle = data.lifecycle || data.status || EVENT_LIFECYCLE.DRAFT;

    return {
        ...data,
        id: eventId,
        poster,
        image: poster,
        cityKey,
        cityLabel: getCityLabel(cityKey),
        lifecycle,
        eventType,
        settings,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        isPublic: PUBLIC_LIFECYCLE_STATES.includes(lifecycle)
    };
}
```

---

## Common Patterns Summary

| Pattern | Location | Use Case |
|---------|----------|----------|
| Service Layer | `packages/core/src/domain/services/` | Business logic |
| Repository | `packages/core/src/infrastructure/repositories/` | Data access |
| Route Handler | `apps/api-gateway/src/routes/v1/` | HTTP endpoints |
| Engine | `packages/core/*.engine.js` | Core business rules |
| Plugin | `apps/api-gateway/src/plugins/` | Framework extensions |
| Utility | `packages/core/events.js` | Shared helpers |

---

*Last Updated: May 2026*