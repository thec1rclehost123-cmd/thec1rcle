/**
 * Venue Availability Slot Store
 * Venue Dashboard v2 — Feature 2
 *
 * Collection: venues/{venueId}/availability_slots/{slotId}
 *
 * Design decisions:
 * - Each booking/block creates an explicit slot document so the calendar
 *   can aggregate status without complex joins.
 * - Event approval (slot_request approved) auto-creates a "booked" slot and
 *   removes any overlapping "open" slot.
 * - Partial-day blocks create a slot with startTime+endTime.
 * - Full-day blocks create a slot with startTime=null, endTime=null.
 * - Host venue selection queries only filters open slots visible to hosts.
 */

import { randomUUID } from "node:crypto";
import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
// @ts-ignore
import slotEngine from "@c1rcle/core/slot-engine";
import type {
    AvailabilitySlot,
    SlotStatus,
    SlotSource,
    CalendarDaySlots,
    SlotCalendarResponse,
    SlotBlockRequest,
} from "../types/slots";

// ── Fallback ───────────────────────────────────────────────────────────────────
const _slots = new Map<string, AvailabilitySlot>();

function slotsRef(venueId: string) {
    return getAdminDb()
        .collection("venues")
        .doc(venueId)
        .collection("availability_slots");
}

// ── Read ───────────────────────────────────────────────────────────────────────

export async function getSlot(
    venueId: string,
    slotId: string
): Promise<AvailabilitySlot | null> {
    if (!isFirebaseConfigured()) return _slots.get(slotId) ?? null;
    const doc = await slotsRef(venueId).doc(slotId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as AvailabilitySlot;
}

export async function getSlotCalendar(
    venueId: string,
    startDate: string,
    endDate: string
): Promise<SlotCalendarResponse> {
    if (!isFirebaseConfigured()) {
        // Fallback to local memory if Firebase is not configured (mock mode)
        const rawSlots = Array.from(_slots.values()).filter(
            (s) => s.venueId === venueId && s.date >= startDate && s.date <= endDate
        );
        return { venueId, startDate, endDate, days: [] }; // Simplified fallback
    }

    return (await slotEngine.getSlotCalendar(venueId, startDate, endDate)) as SlotCalendarResponse;
}

/** Slots visible to hosts during booking (open only, no blocked detail) */
export async function getHostVisibleSlots(
    venueId: string,
    date: string
): Promise<{ date: string; openWindows: { start: string | null; end: string | null }[] }> {
    let slots: AvailabilitySlot[];

    if (!isFirebaseConfigured()) {
        slots = Array.from(_slots.values()).filter(
            (s) => s.venueId === venueId && s.date === date
        );
    } else {
        const snap = await slotsRef(venueId)
            .where("date", "==", date)
            .get();
        slots = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AvailabilitySlot));
    }

    // Full day block → no windows available
    const fullyBlocked = slots.some(
        (s) =>
            (s.status === "blocked" || s.status === "booked") &&
            s.startTime === null
    );
    if (fullyBlocked) return { date, openWindows: [] };

    // Return only open slots
    const openWindows = slots
        .filter((s) => s.status === "open")
        .map((s) => ({ start: s.startTime, end: s.endTime }));

    // If no explicit slots exist, the whole day is implicitly open
    if (slots.length === 0) {
        return { date, openWindows: [{ start: null, end: null }] };
    }

    return { date, openWindows };
}

// ── Write ──────────────────────────────────────────────────────────────────────

export async function blockSlot(
    req: SlotBlockRequest,
    actor: { uid: string }
): Promise<AvailabilitySlot> {
    if (!isFirebaseConfigured()) {
        const id = randomUUID();
        const slot = { id, ...req, status: "blocked" as SlotStatus } as AvailabilitySlot;
        _slots.set(id, slot);
        return slot;
    }

    return (await slotEngine.createBlockedSlot(
        req.venueId,
        req.date,
        req.startTime,
        req.endTime,
        actor.uid,
        req.note
    )) as AvailabilitySlot;
}

export async function unblockSlot(
    venueId: string,
    slotId: string,
    actor: { uid: string }
): Promise<void> {
    const slot = await getSlot(venueId, slotId);
    if (!slot) throw new Error("Slot not found");
    if (slot.status === "booked") {
        throw new Error("Cannot unblock a booked slot — cancel the event first");
    }

    if (!isFirebaseConfigured()) {
        _slots.delete(slotId);
        return;
    }

    await slotsRef(venueId).doc(slotId).delete();
}

/**
 * Updates the status of an availability slot.
 * @param {{ linkedEventId?: string; note?: string }} [opts]
 */
export async function updateSlotStatus(
    venueId: string,
    slotId: string,
    status: SlotStatus,
    actor: { uid: string },
    opts: { linkedEventId?: string; note?: string } = {}
): Promise<void> {
    const now = new Date().toISOString();

    if (!isFirebaseConfigured()) {
        const s = _slots.get(slotId);
        if (s) {
            _slots.set(slotId, { ...s, status, updatedBy: actor.uid, updatedAt: now, ...opts });
        }
        return;
    }

    await slotsRef(venueId)
        .doc(slotId)
        .update({ status, updatedBy: actor.uid, updatedAt: now, ...opts });
}

/**
 * Called when a host slot request is approved.
 * Creates a 'booked' slot and removes any 'open' slots that overlap.
 */
export async function consumeSlotForEvent(
    venueId: string,
    eventId: string,
    date: string,
    startTime: string | null,
    endTime: string | null,
    actor: { uid: string }
): Promise<AvailabilitySlot> {
    if (!isFirebaseConfigured()) {
        const id = randomUUID();
        const slot = { id, venueId, eventId, date, status: "booked" as SlotStatus } as unknown as AvailabilitySlot;
        _slots.set(id, slot);
        return slot;
    }

    return (await slotEngine.consumeSlotForEvent(venueId, eventId, date, startTime, endTime, actor.uid)) as AvailabilitySlot;
}

/**
 * Mark a pending_review slot as pending when host requests this date.
 * If no slot exists yet, create one.
 */
export async function markSlotPendingReview(
    venueId: string,
    eventId: string,
    date: string,
    startTime: string | null,
    endTime: string | null,
    actor: { uid: string }
): Promise<AvailabilitySlot> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const slot: AvailabilitySlot = {
        id,
        venueId,
        date,
        startTime,
        endTime,
        status: "pending_review",
        source: "event_pending",
        linkedEventId: eventId,
        note: "",
        createdBy: actor.uid,
        updatedBy: actor.uid,
        createdAt: now,
        updatedAt: now,
    };

    if (!isFirebaseConfigured()) {
        _slots.set(id, slot);
        return slot;
    }

    await slotsRef(venueId).doc(id).set(slot);
    return slot;
}

// ── Conflict detection ─────────────────────────────────────────────────────────

async function detectConflicts(
    venueId: string,
    date: string,
    startTime: string | null,
    endTime: string | null,
    statusFilter: SlotStatus[]
): Promise<AvailabilitySlot[]> {
    if (!isFirebaseConfigured()) return [];
    return await slotEngine.detectConflicts(venueId, date, startTime, endTime, statusFilter);
}
