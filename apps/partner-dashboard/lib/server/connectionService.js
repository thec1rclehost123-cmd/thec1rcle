import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import * as partnershipStore from "./partnershipStore";
import * as promoterConnectionStore from "./promoterConnectionStore";

/**
 * Connection Service
 * Bridges partnershipStore (Host <-> Venue) and promoterConnectionStore (Promoter <-> Host/Venue)
 */

export async function createRequest({
    requesterId,
    requesterType,
    requesterName,
    requesterEmail,
    targetId,
    targetType,
    targetName,
    message = ""
}) {
    // 1. Host <-> Venue
    if (
        (requesterType === "host" && targetType === "venue") ||
        (requesterType === "venue" && targetType === "host")
    ) {
        const hostId = requesterType === "host" ? requesterId : targetId;
        const venueId = requesterType === "venue" ? requesterId : targetId;
        const hostName = requesterType === "host" ? requesterName : targetName;
        const venueName = requesterType === "venue" ? requesterName : targetName;

        return await partnershipStore.requestPartnership(hostId, venueId, hostName, venueName);
    }

    // 2. Anything involving a Promoter
    if (requesterType === "promoter") {
        return await promoterConnectionStore.createConnectionRequest({
            promoterId: requesterId,
            promoterName: requesterName,
            promoterEmail: requesterEmail,
            targetId,
            targetType,
            targetName,
            message
        });
    }

    if (targetType === "promoter") {
        // Currently, promoterConnectionStore explicitly handles promoter as requester.
        // If a Host/Venue requests a Promoter, we might need a new method or adapt existing.
        // For now, the requirements say roles can request each other.
        // Let's adapt createConnectionRequest or use it as is if it supports targetType=promoter.

        // Actually, let's just use the promoterConnectionStore but swap roles if needed,
        // or better, generalize promoterConnectionStore.
        return await promoterConnectionStore.createConnectionRequest({
            promoterId: targetId, // This is confusing, signifies the 'promoter' side of the connection
            targetId: requesterId,
            targetType: requesterType,
            targetName: requesterName,
            message
        });
    }

    throw new Error(`Unsupported connection type: ${requesterType} to ${targetType}`);
}

export async function approveRequest(connectionId, role, partnerId, partnerName) {
    // We need to know which store to use.
    // Try both or check prefix/length (usually partnership IDs are auto-generated, promoter_connections IDs are randomUUID)

    // Better: check which collection the ID belongs to.
    const db = getAdminDb();

    // Check partnerships first
    const pDoc = await db.collection("partnerships").doc(connectionId).get();
    if (pDoc.exists) {
        return await partnershipStore.approvePartnership(connectionId);
    }

    // Check promoter_connections
    const cDoc = await db.collection("promoter_connections").doc(connectionId).get();
    if (cDoc.exists) {
        return await promoterConnectionStore.approveConnectionRequest(connectionId, { uid: partnerId, name: partnerName, role });
    }

    throw new Error("Connection not found");
}

export async function rejectRequest(connectionId, role, partnerId, partnerName, reason = "") {
    const db = getAdminDb();

    const pDoc = await db.collection("partnerships").doc(connectionId).get();
    if (pDoc.exists) {
        return await partnershipStore.rejectPartnership(connectionId);
    }

    const cDoc = await db.collection("promoter_connections").doc(connectionId).get();
    if (cDoc.exists) {
        return await promoterConnectionStore.rejectConnectionRequest(connectionId, { uid: partnerId, name: partnerName, role }, reason);
    }

    throw new Error("Connection not found");
}

export async function blockRequest(connectionId, role, partnerId, partnerName, reason = "") {
    const db = getAdminDb();

    const pDoc = await db.collection("partnerships").doc(connectionId).get();
    if (pDoc.exists) {
        return await partnershipStore.blockPartnership(connectionId, { uid: partnerId, role }, reason);
    }

    const cDoc = await db.collection("promoter_connections").doc(connectionId).get();
    if (cDoc.exists) {
        return await promoterConnectionStore.blockConnectionRequest(connectionId, { uid: partnerId, role, name: partnerName }, reason);
    }

    throw new Error("Connection not found");
}


export async function listConnections(partnerId, role, status = null) {
    // Combines both stores
    const filters = {};
    if (role === "host") filters.hostId = partnerId;
    if (role === "venue") filters.venueId = partnerId;
    if (status) filters.status = status;

    const [partnerships, promoterConnections] = await Promise.all([
        role === "promoter" ? [] : partnershipStore.listPartnerships(filters),
        role === "promoter"
            ? promoterConnectionStore.listPromoterConnections(partnerId, status)
            : promoterConnectionStore.listIncomingRequests(partnerId, role, status)
    ]);

    // Normalize
    const normalizedPartnerships = partnerships.map(p => ({
        id: p.id,
        type: "partnership",
        otherId: role === "host" ? p.venueId : p.hostId,
        otherName: role === "host" ? p.venueName : p.hostName,
        otherType: role === "host" ? "venue" : "host",
        status: p.status,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
    }));

    const normalizedPromoters = promoterConnections.map(c => ({
        id: c.id,
        type: "promoter_connection",
        otherId: role === "promoter" ? c.targetId : c.promoterId,
        otherName: role === "promoter" ? c.targetName : c.promoterName,
        otherType: role === "promoter" ? c.targetType : "promoter",
        status: c.status,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        message: c.message
    }));

    return [...normalizedPartnerships, ...normalizedPromoters].sort((a, b) =>
        (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0)
    );
}
