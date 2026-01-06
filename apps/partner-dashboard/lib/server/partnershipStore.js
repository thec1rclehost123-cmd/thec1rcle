import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

const PARTNERSHIPS_COLLECTION = "partnerships";
const AUDIT_LOGS_COLLECTION = "audit_logs";

async function createAuditLog(db, { type, entityId, action, actorId, actorRole, metadata = {} }) {
    await db.collection(AUDIT_LOGS_COLLECTION).add({
        type,
        entityId,
        action,
        actorId,
        actorRole,
        metadata,
        timestamp: Timestamp.now()
    });
}


export async function requestPartnership(hostId, clubId, hostName, clubName) {
    if (!isFirebaseConfigured()) return { success: true, id: "mock-id" };

    const db = getAdminDb();
    const partnershipRef = db.collection(PARTNERSHIPS_COLLECTION);

    // Check if exists
    const existing = await partnershipRef
        .where("hostId", "==", hostId)
        .where("clubId", "==", clubId)
        .limit(1)
        .get();

    if (!existing.empty) {
        throw new Error("Partnership already requested or active");
    }

    const doc = {
        hostId,
        clubId,
        hostName,
        clubName,
        status: "pending",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    };

    const result = await partnershipRef.add(doc);

    await createAuditLog(db, {
        type: "partnership",
        entityId: result.id,
        action: "requested",
        actorId: hostId,
        actorRole: "host",
        metadata: { clubId, hostName, clubName }
    });

    return { success: true, id: result.id };
}

export async function approvePartnership(partnershipId, approvedBy) {
    if (!isFirebaseConfigured()) return { success: true };

    const db = getAdminDb();
    const docRef = db.collection(PARTNERSHIPS_COLLECTION).doc(partnershipId);
    const doc = await docRef.get();

    if (!doc.exists) throw new Error("Partnership not found");

    await docRef.update({
        status: "active",
        updatedAt: Timestamp.now(),
    });

    await createAuditLog(db, {
        type: "partnership",
        entityId: partnershipId,
        action: "approved",
        actorId: approvedBy?.uid || doc.data().clubId,
        actorRole: approvedBy?.role || "club",
        metadata: { previousStatus: doc.data().status }
    });

    return { success: true };
}

export async function rejectPartnership(partnershipId, rejectedBy, reason = "") {
    if (!isFirebaseConfigured()) return { success: true };

    const db = getAdminDb();
    const docRef = db.collection(PARTNERSHIPS_COLLECTION).doc(partnershipId);
    const doc = await docRef.get();

    if (!doc.exists) throw new Error("Partnership not found");

    await docRef.update({
        status: "rejected",
        rejectReason: reason,
        updatedAt: Timestamp.now(),
    });

    await createAuditLog(db, {
        type: "partnership",
        entityId: partnershipId,
        action: "rejected",
        actorId: rejectedBy?.uid || doc.data().clubId,
        actorRole: rejectedBy?.role || "club",
        metadata: { reason, previousStatus: doc.data().status }
    });

    return { success: true };
}

export async function blockPartnership(partnershipId, blockedBy, reason = "") {
    if (!isFirebaseConfigured()) return { success: true };

    const db = getAdminDb();
    const docRef = db.collection(PARTNERSHIPS_COLLECTION).doc(partnershipId);
    const doc = await docRef.get();

    if (!doc.exists) throw new Error("Partnership not found");

    await docRef.update({
        status: "blocked",
        blockReason: reason,
        updatedAt: Timestamp.now(),
    });

    await createAuditLog(db, {
        type: "partnership",
        entityId: partnershipId,
        action: "blocked",
        actorId: blockedBy?.uid,
        actorRole: blockedBy?.role,
        metadata: { reason, previousStatus: doc.data().status }
    });

    return { success: true };
}

export async function listPartnerships(filters = {}) {
    if (!isFirebaseConfigured()) return [];

    const db = getAdminDb();
    let query = db.collection(PARTNERSHIPS_COLLECTION);

    if (filters.hostId) {
        query = query.where("hostId", "==", filters.hostId);
    }
    if (filters.clubId) {
        query = query.where("clubId", "==", filters.clubId);
    }
    if (filters.status) {
        query = query.where("status", "==", filters.status);
    }

    const snapshot = await query.get();
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Sort in memory to avoid index requirements
    return results.sort((a, b) => {
        const dateA = a.updatedAt?.toDate?.() || new Date(a.updatedAt || 0);
        const dateB = b.updatedAt?.toDate?.() || new Date(b.updatedAt || 0);
        return dateB - dateA;
    });
}

export async function checkPartnership(hostId, clubId) {
    if (!isFirebaseConfigured()) return true; // DEV MODE

    const db = getAdminDb();
    const snapshot = await db.collection(PARTNERSHIPS_COLLECTION)
        .where("hostId", "==", hostId)
        .where("clubId", "==", clubId)
        .where("status", "==", "active")
        .limit(1)
        .get();

    return !snapshot.empty;
}
