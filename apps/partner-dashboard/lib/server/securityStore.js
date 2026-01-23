import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { randomBytes } from "node:crypto";

const SYNC_CODES_COLLECTION = "scanner_sync_codes";

/**
 * Generate a 6-digit sync code for an event
 */
export async function generateSyncCode(eventId, venueId, createdBy) {
    if (!isFirebaseConfigured()) {
        return { code: "123-456", eventId };
    }

    const db = getAdminDb();

    // Generate code: XXX-XXX
    const rawCode = Math.floor(100000 + Math.random() * 900000).toString();
    const formattedCode = `${rawCode.substring(0, 3)}-${rawCode.substring(3)}`;

    const docId = `${venueId}_${eventId}`;
    const syncData = {
        code: formattedCode,
        rawCode,
        eventId,
        venueId,
        createdBy,
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        isActive: true
    };

    await db.collection(SYNC_CODES_COLLECTION).doc(docId).set(syncData);

    return syncData;
}

/**
 * Get active sync code for an event
 */
export async function getSyncCode(eventId, venueId) {
    if (!isFirebaseConfigured()) return null;

    const db = getAdminDb();
    const docId = `${venueId}_${eventId}`;
    const doc = await db.collection(SYNC_CODES_COLLECTION).doc(docId).get();

    if (!doc.exists) return null;

    const data = doc.data();
    if (!data.isActive || data.expiresAt.toDate() < new Date()) {
        return null;
    }

    return data;
}

/**
 * Deactivate sync code
 */
export async function deactivateSyncCode(eventId, venueId) {
    if (!isFirebaseConfigured()) return true;

    const db = getAdminDb();
    const docId = `${venueId}_${eventId}`;
    await db.collection(SYNC_CODES_COLLECTION).doc(docId).update({
        isActive: false,
        updatedAt: Timestamp.now()
    });

    return true;
}

/**
 * Get active SOS alerts for a venue
 */
export async function getVenueSOSAlerts(venueId) {
    if (!isFirebaseConfigured()) return [];

    const db = getAdminDb();

    // First, get all events for this venue
    const eventsSnap = await db.collection("events")
        .where("venueId", "==", venueId)
        .where("lifecycle", "==", "live")
        .get();

    const liveEventIds = eventsSnap.docs.map(doc => doc.id);

    if (liveEventIds.length === 0) return [];

    // Get alerts for these events
    const alertsSnap = await db.collection("sosAlerts")
        .where("eventId", "in", liveEventIds)
        .where("status", "==", "triggered")
        .orderBy("triggeredAt", "desc")
        .get();

    return alertsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        triggeredAt: doc.data().triggeredAt?.toDate?.() || new Date()
    }));
}

/**
 * Resolve an SOS alert
 */
export async function resolveSOSAlert(alertId, resolvedBy) {
    if (!isFirebaseConfigured()) return true;

    const db = getAdminDb();
    await db.collection("sosAlerts").doc(alertId).update({
        status: "resolved",
        resolvedBy,
        resolvedAt: Timestamp.now()
    });

    return true;
}
