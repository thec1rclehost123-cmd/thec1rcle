/**
 * Slot Request Store
 * Manages slot requests between hosts and clubs for event scheduling
 */

import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";

const SLOTS_COLLECTION = "slot_requests";
const CALENDAR_COLLECTION = "club_calendar";

// Fallback storage for development
let fallbackSlots = [];

/**
 * Create a new slot request
 */
export async function createSlotRequest({
    eventId,
    hostId,
    hostName,
    clubId,
    clubName,
    requestedDate,
    requestedStartTime,
    requestedEndTime,
    notes = "",
    priority = "normal"
}) {
    const id = randomUUID();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const slotRequest = {
        id,
        eventId,
        hostId,
        hostName,
        clubId,
        clubName,
        requestedDate,
        requestedStartTime,
        requestedEndTime,
        status: "pending",
        priority,
        notes,
        createdAt: now,
        updatedAt: now,
        expiresAt
    };

    if (!isFirebaseConfigured()) {
        fallbackSlots.push(slotRequest);
        return slotRequest;
    }

    const db = getAdminDb();
    await db.collection(SLOTS_COLLECTION).doc(id).set(slotRequest);

    // Also mark the calendar slot as tentative
    await updateCalendarSlot(clubId, requestedDate, {
        status: "tentative",
        slotRequestId: id,
        hostId,
        startTime: requestedStartTime,
        endTime: requestedEndTime
    });

    return slotRequest;
}

/**
 * Get a slot request by ID
 */
export async function getSlotRequest(id) {
    if (!isFirebaseConfigured()) {
        return fallbackSlots.find(s => s.id === id) || null;
    }

    const db = getAdminDb();
    const doc = await db.collection(SLOTS_COLLECTION).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
}

/**
 * List slot requests for a club
 */
export async function listSlotRequests({ clubId, hostId, status, limit = 50 }) {
    if (!isFirebaseConfigured()) {
        let results = [...fallbackSlots];
        if (clubId) results = results.filter(s => s.clubId === clubId);
        if (hostId) results = results.filter(s => s.hostId === hostId);
        if (status) results = results.filter(s => s.status === status);
        return results.slice(0, limit);
    }

    const db = getAdminDb();
    let query = db.collection(SLOTS_COLLECTION);

    if (clubId) query = query.where("clubId", "==", clubId);
    if (hostId) query = query.where("hostId", "==", hostId);
    if (status) query = query.where("status", "==", status);

    query = query.orderBy("createdAt", "desc").limit(limit);

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Approve a slot request
 */
export async function approveSlotRequest(id, approvedBy, notes = "") {
    const slotRequest = await getSlotRequest(id);
    if (!slotRequest) throw new Error("Slot request not found");
    if (slotRequest.status !== "pending") throw new Error("Slot request is not pending");

    const now = new Date().toISOString();
    const updates = {
        status: "approved",
        clubResponse: notes,
        respondedAt: now,
        updatedAt: now,
        approvedBy: {
            uid: approvedBy.uid,
            role: approvedBy.role,
            name: approvedBy.name || ""
        }
    };

    if (!isFirebaseConfigured()) {
        const index = fallbackSlots.findIndex(s => s.id === id);
        if (index >= 0) {
            fallbackSlots[index] = { ...fallbackSlots[index], ...updates };
            return fallbackSlots[index];
        }
        throw new Error("Slot request not found");
    }

    const db = getAdminDb();
    await db.collection(SLOTS_COLLECTION).doc(id).update(updates);

    // Update calendar to booked
    await updateCalendarSlot(slotRequest.clubId, slotRequest.requestedDate, {
        status: "booked",
        eventId: slotRequest.eventId,
        hostId: slotRequest.hostId,
        startTime: slotRequest.requestedStartTime,
        endTime: slotRequest.requestedEndTime
    });

    // Also update the event lifecycle to 'approved'
    try {
        const { updateEventLifecycle } = await import("./eventStore");
        await updateEventLifecycle(slotRequest.eventId, "approved", {
            uid: approvedBy.uid,
            role: approvedBy.role,
        }, notes);
    } catch (eventError) {
        console.error("Failed to update event lifecycle on slot approval:", eventError);
    }

    return { ...slotRequest, ...updates };
}

/**
 * Reject a slot request
 */
export async function rejectSlotRequest(id, rejectedBy, reason = "") {
    const slotRequest = await getSlotRequest(id);
    if (!slotRequest) throw new Error("Slot request not found");
    if (slotRequest.status !== "pending") throw new Error("Slot request is not pending");

    const now = new Date().toISOString();
    const updates = {
        status: "rejected",
        clubResponse: reason,
        respondedAt: now,
        updatedAt: now,
        rejectedBy: {
            uid: rejectedBy.uid,
            role: rejectedBy.role,
            name: rejectedBy.name || ""
        }
    };

    if (!isFirebaseConfigured()) {
        const index = fallbackSlots.findIndex(s => s.id === id);
        if (index >= 0) {
            fallbackSlots[index] = { ...fallbackSlots[index], ...updates };
            return fallbackSlots[index];
        }
        throw new Error("Slot request not found");
    }

    const db = getAdminDb();
    await db.collection(SLOTS_COLLECTION).doc(id).update(updates);

    // Release the tentative calendar slot
    await releaseCalendarSlot(slotRequest.clubId, slotRequest.requestedDate, slotRequest.id);

    // Also update the event lifecycle to 'needs_changes'
    try {
        const { updateEventLifecycle } = await import("./eventStore");
        await updateEventLifecycle(slotRequest.eventId, "needs_changes", {
            uid: rejectedBy.uid,
            role: rejectedBy.role,
        }, reason);
    } catch (eventError) {
        console.error("Failed to update event lifecycle on slot rejection:", eventError);
    }

    return { ...slotRequest, ...updates };
}

/**
 * Suggest alternative dates for a slot request
 */
export async function suggestAlternatives(id, suggestedBy, alternativeDates, notes = "") {
    const slotRequest = await getSlotRequest(id);
    if (!slotRequest) throw new Error("Slot request not found");

    const now = new Date().toISOString();
    const updates = {
        status: "modified",
        alternativeDates,
        clubResponse: notes,
        respondedAt: now,
        updatedAt: now,
        modifiedBy: {
            uid: suggestedBy.uid,
            role: suggestedBy.role,
            name: suggestedBy.name || ""
        }
    };

    if (!isFirebaseConfigured()) {
        const index = fallbackSlots.findIndex(s => s.id === id);
        if (index >= 0) {
            fallbackSlots[index] = { ...fallbackSlots[index], ...updates };
            return fallbackSlots[index];
        }
        throw new Error("Slot request not found");
    }

    const db = getAdminDb();
    await db.collection(SLOTS_COLLECTION).doc(id).update(updates);

    // Release the tentative calendar slot
    await releaseCalendarSlot(slotRequest.clubId, slotRequest.requestedDate, slotRequest.id);

    // Also update the event lifecycle to 'needs_changes'
    try {
        const { updateEventLifecycle } = await import("./eventStore");
        await updateEventLifecycle(slotRequest.eventId, "needs_changes", {
            uid: suggestedBy.uid,
            role: suggestedBy.role,
        }, notes);
    } catch (eventError) {
        console.error("Failed to update event lifecycle on slot modification:", eventError);
    }

    return { ...slotRequest, ...updates };
}

/**
 * Helper: Update calendar slot status
 */
async function updateCalendarSlot(clubId, date, slotData) {
    if (!isFirebaseConfigured()) return;

    const db = getAdminDb();
    const calendarId = `${clubId}_${date}`;
    const calendarRef = db.collection(CALENDAR_COLLECTION).doc(calendarId);

    const doc = await calendarRef.get();
    const existing = doc.exists ? doc.data() : { clubId, date, slots: [] };

    const newSlot = {
        startTime: slotData.startTime,
        endTime: slotData.endTime,
        status: slotData.status,
        eventId: slotData.eventId || null,
        hostId: slotData.hostId || null,
        slotRequestId: slotData.slotRequestId || null
    };

    // Check for overlapping slots
    const existingSlotIndex = existing.slots?.findIndex(s =>
        s.startTime === slotData.startTime || s.slotRequestId === slotData.slotRequestId
    );

    if (existingSlotIndex >= 0) {
        existing.slots[existingSlotIndex] = newSlot;
    } else {
        existing.slots = [...(existing.slots || []), newSlot];
    }

    await calendarRef.set({
        ...existing,
        updatedAt: new Date().toISOString()
    }, { merge: true });
}

/**
 * Helper: Release a tentative calendar slot
 */
async function releaseCalendarSlot(clubId, date, slotRequestId) {
    if (!isFirebaseConfigured()) return;

    const db = getAdminDb();
    const calendarId = `${clubId}_${date}`;
    const calendarRef = db.collection(CALENDAR_COLLECTION).doc(calendarId);

    const doc = await calendarRef.get();
    if (!doc.exists) return;

    const data = doc.data();
    const updatedSlots = (data.slots || []).filter(s => s.slotRequestId !== slotRequestId);

    await calendarRef.update({
        slots: updatedSlots,
        updatedAt: new Date().toISOString()
    });
}
