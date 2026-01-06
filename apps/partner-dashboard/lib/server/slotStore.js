/**
 * Slot Request Store
 * Manages slot requests between hosts and clubs for event scheduling
 */

import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";

const SLOTS_COLLECTION = "slot_requests";
const CALENDAR_COLLECTION = "club_calendar";
const AUDIT_LOGS_COLLECTION = "audit_logs";

async function createAuditLog(db, { type, entityId, action, actorId, actorRole, metadata = {} }) {
    await db.collection(AUDIT_LOGS_COLLECTION).add({
        type,
        entityId,
        action,
        actorId,
        actorRole,
        metadata,
        timestamp: new Date().toISOString()
    });
}

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

    await createAuditLog(db, {
        type: "slot_request",
        entityId: id,
        action: "created",
        actorId: hostId,
        actorRole: "host",
        metadata: { clubId, requestedDate, requestedStartTime, requestedEndTime }
    });

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

    const snapshot = await query.get();
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Sort in-memory to avoid index requirements for mixed where + orderBy
    return results
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, limit);
}

/**
 * Approve a slot request
 */
export async function approveSlotRequest(id, approvedBy, notes = "", options = {}) {
    const slotRequest = await getSlotRequest(id);
    if (!slotRequest) throw new Error("Slot request not found");
    if (slotRequest.status !== "pending") throw new Error("Slot request is not pending");

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(); // 48 hour expiry
    const updates = {
        status: "approved",
        clubResponse: notes,
        respondedAt: now.toISOString(),
        updatedAt: now.toISOString(),
        expiresAt,
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

    await createAuditLog(db, {
        type: "slot_request",
        entityId: id,
        action: "approved",
        actorId: approvedBy.uid,
        actorRole: approvedBy.role,
        metadata: { clubResponse: notes }
    });

    // Update calendar to booked
    await updateCalendarSlot(slotRequest.clubId, slotRequest.requestedDate, {
        status: "booked",
        eventId: slotRequest.eventId,
        hostId: slotRequest.hostId,
        startTime: slotRequest.requestedStartTime,
        endTime: slotRequest.requestedEndTime
    });

    // Also update the event lifecycle to 'approved'
    if (!options.skipLifecycleUpdate) {
        try {
            const { updateEventLifecycle } = await import("./eventStore");
            await updateEventLifecycle(slotRequest.eventId, "approved", {
                uid: approvedBy.uid,
                role: approvedBy.role,
            }, notes);
        } catch (eventError) {
            console.error("Failed to update event lifecycle on slot approval:", eventError);
        }
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

    await createAuditLog(db, {
        type: "slot_request",
        entityId: id,
        action: "rejected",
        actorId: rejectedBy.uid,
        actorRole: rejectedBy.role,
        metadata: { reason }
    });

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
 * Counter-propose an alternative slot (Club action)
 */
export async function counterProposeSlot(id, clubId, actor, alternativeDate, alternativeStartTime, alternativeEndTime, note = "") {
    const slotRequest = await getSlotRequest(id);
    if (!slotRequest) throw new Error("Slot request not found");
    if (slotRequest.clubId !== clubId) throw new Error("Unauthorized");

    const db = getAdminDb();
    const now = new Date().toISOString();

    const updates = {
        status: "counter_proposed",
        clubResponse: note,
        alternativeDate,
        alternativeStartTime,
        alternativeEndTime,
        updatedAt: now,
        respondedBy: {
            uid: actor.uid,
            role: actor.role,
            name: actor.name || ""
        }
    };

    if (isFirebaseConfigured()) {
        await db.collection(SLOTS_COLLECTION).doc(id).update(updates);
    }

    await createAuditLog(db, {
        type: "slot_request",
        entityId: id,
        action: "counter_proposed",
        actorId: actor.uid,
        actorRole: "club",
        metadata: {
            originalDate: slotRequest.requestedDate,
            alternativeDate,
            note
        }
    });

    // Release the original tentative calendar slot
    await releaseCalendarSlot(slotRequest.clubId, slotRequest.requestedDate, slotRequest.id);

    return { success: true };
}

/**
 * Helper: Update calendar slot status
 */
export async function updateCalendarSlot(clubId, date, slotData) {
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

/**
 * Request a reschedule (Host action)
 */
export async function requestSlotReschedule(id, hostId, newDate, newStartTime, newEndTime, reason = "") {
    const slotRequest = await getSlotRequest(id);
    if (!slotRequest) throw new Error("Slot request not found");
    if (slotRequest.hostId !== hostId) throw new Error("Unauthorized");

    const db = getAdminDb();
    const now = new Date().toISOString();

    // Create audit log for the request
    await createAuditLog(db, {
        type: "slot_request",
        entityId: id,
        action: "reschedule_requested",
        actorId: hostId,
        actorRole: "host",
        metadata: {
            previousDate: slotRequest.requestedDate,
            newDate,
            reason
        }
    });

    // We keep status as approved but add a 'reschedule_pending' flag or similar
    // Actually, it's better to update it to 'pending' again with the new details
    // but keep track of the original for audit.
    const updates = {
        requestedDate: newDate,
        requestedStartTime: newStartTime,
        requestedEndTime: newEndTime,
        status: "pending",
        updatedAt: now,
        rescheduleReason: reason,
        previousRequest: {
            date: slotRequest.requestedDate,
            startTime: slotRequest.requestedStartTime,
            endTime: slotRequest.requestedEndTime
        }
    };

    if (isFirebaseConfigured()) {
        await db.collection(SLOTS_COLLECTION).doc(id).update(updates);
    }

    return { success: true };
}

