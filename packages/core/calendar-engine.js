/**
 * THE C1RCLE - Calendar Engine
 * Manages venue availability and host slot requests.
 */

import { randomUUID } from "node:crypto";
import { getAdminDb } from "./admin.js";

const CALENDAR_COLLECTION = "venue_calendar";
const SLOTS_COLLECTION = "slot_requests";

/**
 * Gets venue availability for a date range
 */
export async function getVenueAvailability(venueId, startDate, endDate) {
    const db = getAdminDb();
    const snapshot = await db.collection(CALENDAR_COLLECTION)
        .where("venueId", "==", venueId)
        .where("date", ">=", startDate)
        .where("date", "<=", endDate)
        .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Blocks a date for a venue
 */
export async function blockDate(venueId, date, reason, blockedBy, startTime = "16:00", endTime = "04:00") {
    const db = getAdminDb();
    const id = `${venueId}_${date}`;

    const block = {
        venueId,
        date,
        status: "blocked",
        reason,
        startTime,
        endTime,
        blockedBy: {
            uid: blockedBy.uid,
            name: blockedBy.name || "",
            role: blockedBy.role
        },
        updatedAt: new Date().toISOString()
    };

    await db.collection(CALENDAR_COLLECTION).doc(id).set(block, { merge: true });
    return block;
}

/**
 * Unblocks a date
 */
export async function unblockDate(venueId, date) {
    const db = getAdminDb();
    const id = `${venueId}_${date}`;
    await db.collection(CALENDAR_COLLECTION).doc(id).delete();
    return { success: true };
}

/**
 * Creates a slot request (Host to Venue).
 *
 * Tier 1 (Trusted) bypass: if the requesting host holds an active "trusted"
 * partnership with the venue, the slot is auto-confirmed immediately — no
 * manual Venue approval required. The calendar entry goes straight to "booked".
 *
 * Tier 2 (Standard) / no partnership: normal pending flow.
 *
 * @param {object} data   - Request payload (must include hostId and venueId)
 * @param {object} [actor] - Decoded Firebase user from req.user (for audit trail)
 */
export async function createSlotRequest(data, actor) {
    const db = getAdminDb();
    const id = `slot_${randomUUID().substring(0, 8)}`;
    const now = new Date().toISOString();

    // --- Tier 1 check: does this host have a "trusted" partnership with the venue? ---
    let isTrusted = false;
    if (data.hostId && data.venueId) {
        const partnershipSnap = await db.collection("partnerships")
            .where("hostId", "==", data.hostId)
            .where("venueId", "==", data.venueId)
            .where("status", "==", "active")
            .limit(1)
            .get();

        if (!partnershipSnap.empty) {
            const partnershipData = partnershipSnap.docs[0].data();
            isTrusted = partnershipData.tier === "trusted";
        }
    }

    if (isTrusted) {
        // ── Tier 1 (Trusted): bypass pending — auto-confirm immediately ──────────
        const request = {
            ...data,
            id,
            status: "confirmed",
            autoApproved: true,
            autoApprovedAt: now,
            approvedBy: { uid: "system", role: "tier1_bypass" },
            createdAt: now,
            updatedAt: now
        };

        await db.collection(SLOTS_COLLECTION).doc(id).set(request);

        // Mark calendar slot as booked immediately (same state as manual approval)
        const calendarId = `${data.venueId}_${data.requestedDate}`;
        await db.collection(CALENDAR_COLLECTION).doc(calendarId).set({
            venueId: data.venueId,
            date: data.requestedDate,
            status: "booked",
            slotRequestId: id,
            // Preserve host context for the venue's calendar view
            hostId: data.hostId,
            hostName: data.hostName || "",
            autoApproved: true
        }, { merge: true });

        // Optional: write a notification document for the venue
        await db.collection("notifications").add({
            type: "auto_published",
            venueId: data.venueId,
            hostId: data.hostId,
            hostName: data.hostName || "A Trusted Partner",
            slotRequestId: id,
            date: data.requestedDate,
            message: `Trusted Partner ${data.hostName || data.hostId} auto-published an event on ${data.requestedDate}.`,
            read: false,
            createdAt: now
        });

        return request;
    }

    // ── Tier 2 (Standard) / no partnership: normal pending flow ─────────────────
    const request = {
        ...data,
        id,
        status: "pending",
        createdAt: now,
        updatedAt: now
    };

    await db.collection(SLOTS_COLLECTION).doc(id).set(request);

    // Update calendar as tentative until venue manually approves
    const calendarId = `${data.venueId}_${data.requestedDate}`;
    await db.collection(CALENDAR_COLLECTION).doc(calendarId).set({
        venueId: data.venueId,
        date: data.requestedDate,
        status: "tentative",
        slotRequestId: id
    }, { merge: true });

    return request;
}

/**
 * Responds to a slot request (Approve/Reject/Counter)
 */
export async function respondToSlotRequest(id, action, responseData, actor) {
    const db = getAdminDb();
    const ref = db.collection(SLOTS_COLLECTION).doc(id);
    const doc = await ref.get();

    if (!doc.exists) throw new Error("Slot request not found");
    const request = doc.data();

    const now = new Date().toISOString();
    const updates = {
        status: action === "approve" ? "approved" : (action === "counter" ? "counter_proposed" : "rejected"),
        respondedAt: now,
        updatedAt: now,
        respondedBy: { uid: actor.uid, name: actor.name || "" },
        notes: responseData.notes || ""
    };

    if (action === "counter") {
        updates.alternativeDate = responseData.alternativeDate;
        updates.alternativeStartTime = responseData.alternativeStartTime;
        updates.alternativeEndTime = responseData.alternativeEndTime;
    }

    await ref.update(updates);

    // Sync with calendar
    const calendarId = `${request.venueId}_${request.requestedDate}`;
    if (action === "approve") {
        await db.collection(CALENDAR_COLLECTION).doc(calendarId).update({ status: "booked" });
    } else {
        await db.collection(CALENDAR_COLLECTION).doc(calendarId).delete(); // Remove tentative
    }

    return { ...request, ...updates };
}
