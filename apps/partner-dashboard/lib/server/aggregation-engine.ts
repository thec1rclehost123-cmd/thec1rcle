/**
 * Aggregation Engine
 * ──────────────────────────────────────────────────────────────────────────────
 * Write-side aggregation for dashboard read models.
 *
 * Every time an order is confirmed, a checkin happens, or a payout is created,
 * the relevant read-model documents are updated atomically.
 *
 * Read-model collections:
 *   venue_daily_stats/{venueId}_{YYYY-MM-DD}   — daily revenue + ticket KPIs
 *   event_live_stats/{eventId}                 — per-event live counters
 *   latest_orders_feed/{orderId}               — bounded recent-orders ring (50 per venue)
 *
 * All writes use FieldValue.increment() so concurrent requests are race-safe.
 */

import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

// ── Helpers ───────────────────────────────────────────────────────────────────

function dateKey(isoOrDate: string | Date): string {
    const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function dailyStatsDocId(venueId: string, date: string): string {
    return `${venueId}_${date}`;
}

// ── Venue daily stats ─────────────────────────────────────────────────────────

export interface VenueDailyDelta {
    revenue?: number;       // amount in smallest currency unit (paise)
    ticketsSold?: number;
    rsvpCount?: number;
    checkIns?: number;
    pageViews?: number;
}

/**
 * Increment venue_daily_stats for the given date.
 * Safe to call multiple times — increments are additive.
 */
export async function updateVenueDailyStats(
    venueId: string,
    date: string | Date,
    delta: VenueDailyDelta
): Promise<void> {
    const db = getAdminDb();
    const dateStr = typeof date === "string" ? date : dateKey(date);
    const docId   = dailyStatsDocId(venueId, dateStr);

    const update: Record<string, any> = {
        venueId,
        date:      dateStr,
        updatedAt: FieldValue.serverTimestamp(),
    };

    if (delta.revenue     !== undefined) update.revenue     = FieldValue.increment(delta.revenue);
    if (delta.ticketsSold !== undefined) update.ticketsSold = FieldValue.increment(delta.ticketsSold);
    if (delta.rsvpCount   !== undefined) update.rsvpCount   = FieldValue.increment(delta.rsvpCount);
    if (delta.checkIns    !== undefined) update.checkIns    = FieldValue.increment(delta.checkIns);
    if (delta.pageViews   !== undefined) update.pageViews   = FieldValue.increment(delta.pageViews);

    await db.collection("venue_daily_stats").doc(docId).set(update, { merge: true });
}

// ── Event live stats ──────────────────────────────────────────────────────────

export interface EventLiveDelta {
    ticketsSold?: number;
    revenue?: number;
    checkIns?: number;
    pageViews?: number;
    conversions?: number;
}

/**
 * Increment event_live_stats for a single event.
 */
export async function updateEventLiveStats(
    eventId: string,
    delta: EventLiveDelta
): Promise<void> {
    const db = getAdminDb();

    const update: Record<string, any> = {
        eventId,
        updatedAt: FieldValue.serverTimestamp(),
    };

    if (delta.ticketsSold !== undefined) update.ticketsSold = FieldValue.increment(delta.ticketsSold);
    if (delta.revenue     !== undefined) update.revenue     = FieldValue.increment(delta.revenue);
    if (delta.checkIns    !== undefined) update.checkIns    = FieldValue.increment(delta.checkIns);
    if (delta.pageViews   !== undefined) update.pageViews   = FieldValue.increment(delta.pageViews);
    if (delta.conversions !== undefined) update.conversions = FieldValue.increment(delta.conversions);

    await db.collection("event_live_stats").doc(eventId).set(update, { merge: true });
}

// ── Latest orders feed ────────────────────────────────────────────────────────

export interface LatestOrderEntry {
    orderId:      string;
    venueId:      string;
    userId:       string;
    customerName: string;
    eventId:      string;
    eventName:    string;
    amount:       number;
    ticketsCount: number;
    status:       string;
    source:       "ticket" | "rsvp";
    createdAt:    string;
}

/**
 * Write a single order entry to latest_orders_feed.
 * The feed doc ID = orderId so writes are idempotent (re-processing = no-op).
 */
export async function appendLatestOrderFeed(entry: LatestOrderEntry): Promise<void> {
    const db = getAdminDb();
    await db.collection("latest_orders_feed").doc(entry.orderId).set({
        ...entry,
        writtenAt: FieldValue.serverTimestamp(),
    });
}

// ── On-order-confirmed: update all read models ────────────────────────────────

export interface ConfirmedOrderPayload {
    orderId:      string;
    venueId:      string;
    eventId:      string;
    eventName:    string;
    userId:       string;
    customerName: string;
    amount:       number;   // in paise
    ticketsCount: number;
    source:       "ticket" | "rsvp";
    createdAt:    string;   // ISO
}

/**
 * Call this whenever an order transitions to "confirmed".
 * Updates all three read models in parallel.
 * Never throws — failures are logged but must not block the primary order write.
 */
export async function onOrderConfirmed(order: ConfirmedOrderPayload): Promise<void> {
    try {
        await Promise.all([
            updateVenueDailyStats(order.venueId, order.createdAt, {
                revenue:     order.amount,
                ticketsSold: order.ticketsCount,
                rsvpCount:   order.source === "rsvp" ? 1 : 0,
            }),
            updateEventLiveStats(order.eventId, {
                ticketsSold: order.ticketsCount,
                revenue:     order.amount,
                conversions: 1,
            }),
            appendLatestOrderFeed({
                orderId:      order.orderId,
                venueId:      order.venueId,
                userId:       order.userId,
                customerName: order.customerName,
                eventId:      order.eventId,
                eventName:    order.eventName,
                amount:       order.amount,
                ticketsCount: order.ticketsCount,
                status:       "confirmed",
                source:       order.source,
                createdAt:    order.createdAt,
            }),
        ]);
    } catch (err: any) {
        console.error("[aggregation-engine] onOrderConfirmed failed (non-blocking)", {
            orderId: order.orderId,
            error:   err?.message,
        });
    }
}

/**
 * Call this whenever a check-in is recorded (QR scan or manual).
 */
export async function onCheckIn(
    venueId:  string,
    eventId:  string,
    checkInAt: string | Date
): Promise<void> {
    try {
        const dateStr = dateKey(checkInAt);
        await Promise.all([
            updateVenueDailyStats(venueId, dateStr, { checkIns: 1 }),
            updateEventLiveStats(eventId, { checkIns: 1 }),
        ]);
    } catch (err: any) {
        console.error("[aggregation-engine] onCheckIn failed (non-blocking)", {
            venueId,
            eventId,
            error: err?.message,
        });
    }
}
