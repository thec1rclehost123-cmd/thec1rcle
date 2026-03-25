/**
 * Slot Request Store
 *
 * Uses Firebase Admin SDK (direct Firestore) and @c1rcle/core/calendar-engine.
 * Mirrors the pattern used in calendarStore.js — no dependency on the API gateway.
 */

import { getAdminDb } from "../firebase/admin";
import {
    createSlotRequest as directCreateSlotRequest,
    respondToSlotRequest as directRespondToSlotRequest,
} from "@c1rcle/core/calendar-engine";

const SLOTS_COLLECTION = "slot_requests";

export async function createSlotRequest(data, token, actor) {
    return directCreateSlotRequest(data, actor || { uid: "system", role: "host" });
}

export async function listSlotRequests({ venueId, hostId, status, limit = 50 } = {}) {
    try {
        const db = getAdminDb();
        let query = db.collection(SLOTS_COLLECTION);
        if (hostId) query = query.where('hostId', '==', hostId);
        if (venueId) query = query.where('venueId', '==', venueId);
        if (status) query = query.where('status', '==', status);
        const snap = await query.limit(limit).get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error("[SlotStore] listSlotRequests failed:", error.message);
        return [];
    }
}

export async function getSlotRequest(id) {
    try {
        const db = getAdminDb();
        const doc = await db.collection(SLOTS_COLLECTION).doc(id).get();
        if (!doc.exists) return null;
        return { id: doc.id, ...doc.data() };
    } catch (error) {
        console.error("[SlotStore] getSlotRequest failed:", error.message);
        return null;
    }
}

export async function approveSlotRequest(id, actor, data = {}, token) {
    return directRespondToSlotRequest(id, 'approve', data, actor);
}

export async function rejectSlotRequest(id, actor, reason = "", token) {
    return directRespondToSlotRequest(id, 'reject', { reason }, actor);
}

export async function counterProposeSlot(id, actor, suggestion, token) {
    return directRespondToSlotRequest(id, 'counter', { suggestion }, actor);
}

export default {
    createSlotRequest,
    listSlotRequests,
    getSlotRequest,
    approveSlotRequest,
    rejectSlotRequest,
    counterProposeSlot,
};


