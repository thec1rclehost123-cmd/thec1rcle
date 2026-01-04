import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

const PARTNERSHIPS_COLLECTION = "partnerships";

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
    return { success: true, id: result.id };
}

export async function approvePartnership(partnershipId) {
    if (!isFirebaseConfigured()) return { success: true };

    const db = getAdminDb();
    await db.collection(PARTNERSHIPS_COLLECTION).doc(partnershipId).update({
        status: "active",
        updatedAt: Timestamp.now(),
    });

    return { success: true };
}

export async function rejectPartnership(partnershipId) {
    if (!isFirebaseConfigured()) return { success: true };

    const db = getAdminDb();
    await db.collection(PARTNERSHIPS_COLLECTION).doc(partnershipId).update({
        status: "rejected",
        updatedAt: Timestamp.now(),
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

    const snapshot = await query.orderBy("updatedAt", "desc").get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
