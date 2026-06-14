/**
 * Partnership Store
 *
 * Uses Firebase Admin SDK (direct Firestore) to manage host-venue partnerships.
 * Mirrors the pattern used in calendarStore.js — no dependency on the API gateway.
 */

import { getAdminDb } from "../firebase/admin";

export async function requestPartnership(hostId, venueId, hostName, venueName) {
    if (!hostId || !venueId) {
        throw new Error("[PartnershipStore] hostId and venueId are required to request a partnership");
    }
    try {
        const db = getAdminDb();
        const existing = await db.collection('partnerships')
            .where('hostId', '==', hostId)
            .where('venueId', '==', venueId)
            .limit(1).get();
        if (!existing.empty) {
            return { success: false, error: 'Partnership already requested or active' };
        }
        const ref = await db.collection('partnerships').add({
            hostId, venueId, hostName: hostName || '', venueName: venueName || '',
            status: 'pending', initiatedBy: 'host',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
        return { success: true, id: ref.id };
    } catch (error) {
        console.error("[PartnershipStore] requestPartnership failed:", error.message);
        throw error;
    }
}

export async function approvePartnership(partnershipId, _token, tier) {
    if (!partnershipId) {
        throw new Error("[PartnershipStore] partnershipId is required to approve a partnership");
    }
    try {
        const db = getAdminDb();
        const update = {
            status: 'active',
            updatedAt: new Date().toISOString(),
        };
        if (tier) update.tier = tier;
        await db.collection('partnerships').doc(partnershipId).update(update);
        return { success: true };
    } catch (error) {
        console.error("[PartnershipStore] approvePartnership failed:", error.message);
        throw error;
    }
}

export async function rejectPartnership(partnershipId, reason = "") {
    if (!partnershipId) {
        throw new Error("[PartnershipStore] partnershipId is required to reject a partnership");
    }
    try {
        const db = getAdminDb();
        await db.collection('partnerships').doc(partnershipId).update({
            status: 'rejected',
            rejectReason: reason,
            updatedAt: new Date().toISOString(),
        });
        return { success: true };
    } catch (error) {
        console.error("[PartnershipStore] rejectPartnership failed:", error.message);
        throw error;
    }
}

export async function blockPartnership(partnershipId, reason = "") {
    if (!partnershipId) {
        throw new Error("[PartnershipStore] partnershipId is required to block a partnership");
    }
    try {
        const db = getAdminDb();
        await db.collection('partnerships').doc(partnershipId).update({
            status: 'blocked',
            rejectReason: reason,
            updatedAt: new Date().toISOString(),
        });
        return { success: true };
    } catch (error) {
        console.error("[PartnershipStore] blockPartnership failed:", error.message);
        throw error;
    }
}

export async function listPartnerships(filters = {}) {
    try {
        const db = getAdminDb();
        let query = db.collection('partnerships');
        if (filters.hostId) query = query.where('hostId', '==', filters.hostId);
        if (filters.venueId) query = query.where('venueId', '==', filters.venueId);
        if (filters.status) query = query.where('status', '==', filters.status);
        const snap = await query.get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error("[PartnershipStore] listPartnerships failed:", error.message);
        return [];
    }
}

export async function checkPartnership(hostId, venueId) {
    if (!hostId || !venueId) {
        console.warn("[PartnershipStore] checkPartnership called with missing hostId or venueId");
        return false;
    }
    try {
        const db = getAdminDb();
        const snap = await db.collection('partnerships')
            .where('hostId', '==', hostId)
            .where('venueId', '==', venueId)
            .where('status', '==', 'active')
            .limit(1).get();
        return !snap.empty;
    } catch (error) {
        console.error("[PartnershipStore] checkPartnership failed:", error.message);
        return false;
    }
}

export async function resolveHostVenueSelection(hostId, venueId, venueName = "") {
    try {
        if (!hostId) return null;

        const db = getAdminDb();
        const activeSnap = await db.collection("partnerships")
            .where("hostId", "==", hostId)
            .where("status", "==", "active")
            .get();

        const activePartnerships = activeSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const exactMatch = venueId
            ? activePartnerships.find((partnership) => partnership.venueId === venueId)
            : null;

        if (exactMatch) {
            return {
                venueId: exactMatch.venueId,
                venueName: exactMatch.venueName || venueName || "",
                partnershipId: exactMatch.id,
                canonicalized: false,
            };
        }

        let targetName = String(venueName || "").trim().toLowerCase();
        if (!targetName && venueId) {
            const venueDoc = await db.collection("venues").doc(venueId).get();
            const venueData = venueDoc.data() || {};
            targetName = String(venueData.displayName || venueData.name || "").trim().toLowerCase();
        }

        if (!targetName) return null;

        const nameMatches = activePartnerships.filter((partnership) =>
            String(partnership.venueName || "").trim().toLowerCase() === targetName
        );

        if (nameMatches.length !== 1) {
            return null;
        }

        const canonical = nameMatches[0];
        return {
            venueId: canonical.venueId,
            venueName: canonical.venueName || venueName || "",
            partnershipId: canonical.id,
            canonicalized: true,
        };
    } catch (error) {
        console.error("[PartnershipStore] resolveHostVenueSelection failed:", error.message);
        return null;
    }
}
