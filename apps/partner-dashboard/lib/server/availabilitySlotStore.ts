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
    let rawSlots: AvailabilitySlot[];

    if (!isFirebaseConfigured()) {
        rawSlots = Array.from(_slots.values()).filter(
            (s) => s.venueId === venueId && s.date >= startDate && s.date <= endDate
        );
    } else {
        const snap = await slotsRef(venueId)
            .where("date", ">=", startDate)
            .where("date", "<=", endDate)
            .orderBy("date")
            .orderBy("startTime")
            .get();
        rawSlots = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AvailabilitySlot));
    }

    // Group by date
    const byDate = new Map<string, AvailabilitySlot[]>();
    for (const s of rawSlots) {
        const list = byDate.get(s.date) ?? [];
        list.push(s);
        byDate.set(s.date, list);
    }

    // Build day objects for every date in range
    const days: CalendarDaySlots[] = [];
    const cur = new Date(startDate);
    const end = new Date(endDate);
    while (cur <= end) {
        const dateStr = cur.toISOString().slice(0, 10);
        const slots = byDate.get(dateStr) ?? [];

        const fullyBlocked =
            slots.some(
                (s) => s.status === "blocked" && s.startTime === null
            ) ||
            slots.some(
                (s) => s.status === "booked" && s.startTime === null
            );

        const partiallyBlocked = !fullyBlocked && slots.some(
            (s) =>
                (s.status === "blocked" || s.status === "booked") &&
                s.startTime !== null
        );

        const openCount = slots.filter((s) => s.status === "open").length;
        const pendingCount = slots.filter((s) => s.status === "pending_review").length;
        const confirmedCount = slots.filter((s) => s.status === "booked").length;

        days.push({
            date: dateStr,
            slots,
            fullyBlocked,
            partiallyBlocked,
            openCount,
            pendingCount,
            confirmedCount,
        });

        cur.setDate(cur.getDate() + 1);
    }

    return { venueId, startDate, endDate, days };
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
    // Conflict check: reject if a booked slot already covers the same window
    const conflicts = await detectConflicts(
        req.venueId,
        req.date,
        req.startTime ?? null,
        req.endTime ?? null,
        ["booked", "event_hold"]
    );
    if (conflicts.length > 0) {
        throw new Error(
            `Conflict: ${conflicts.length} booked slot(s) overlap this window`
        );
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const isPartial = !!(req.startTime && req.endTime);

    const slot: AvailabilitySlot = {
        id,
        venueId: req.venueId,
        date: req.date,
        startTime: req.startTime ?? null,
        endTime: req.endTime ?? null,
        status: "blocked",
        source: isPartial ? "partial_block" : "manual_block",
        linkedEventId: null,
        note: req.note ?? "",
        createdBy: actor.uid,
        updatedBy: actor.uid,
        createdAt: now,
        updatedAt: now,
    };

    if (!isFirebaseConfigured()) {
        _slots.set(id, slot);
        return slot;
    }

    await slotsRef(req.venueId).doc(id).set(slot);
    return slot;
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
    const id = randomUUID();
    const now = new Date().toISOString();

    const slot: AvailabilitySlot = {
        id,
        venueId,
        date,
        startTime,
        endTime,
        status: "booked",
        source: "event_confirmed",
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

    const db = getAdminDb();
    const batch = db.batch();

    // Write the booked slot
    batch.set(slotsRef(venueId).doc(id), slot);

    // Remove overlapping open slots
    const overlapping = await detectConflicts(venueId, date, startTime, endTime, ["open"]);
    for (const s of overlapping) {
        batch.delete(slotsRef(venueId).doc(s.id));
    }

    await batch.commit();
    return slot;
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
    let slots: AvailabilitySlot[];

    if (!isFirebaseConfigured()) {
        slots = Array.from(_slots.values()).filter(
            (s) => s.venueId === venueId && s.date === date
        );
    } else {
        const snap = await slotsRef(venueId).where("date", "==", date).get();
        slots = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AvailabilitySlot));
    }

    return slots.filter((s) => {
        if (!statusFilter.includes(s.status)) return false;

        // Full-day slot conflicts with everything
        if (s.startTime === null || startTime === null) return true;

        // Time overlap: A starts before B ends AND A ends after B starts
        return s.startTime < (endTime ?? "23:59") && (s.endTime ?? "23:59") > startTime;
    });
}
