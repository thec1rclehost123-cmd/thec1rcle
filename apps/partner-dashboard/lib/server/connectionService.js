/**
 * Connection Service (Refactored for API Governance)
 * 
 * Thin orchestrator over partnershipStore and promoterConnectionStore.
 * Both stores are now SDK-backed, so this service delegates cleanly.
 */

import * as partnershipStore from "./partnershipStore";
import * as promoterConnectionStore from "./promoterConnectionStore";

export async function createRequest({
    requesterId,
    requesterType,
    requesterName,
    requesterEmail,
    targetId,
    targetType,
    targetName,
    message = ""
}, token) {
    // Host <-> Venue partnership
    if (
        (requesterType === "host" && targetType === "venue") ||
        (requesterType === "venue" && targetType === "host")
    ) {
        const hostId = requesterType === "host" ? requesterId : targetId;
        const venueId = requesterType === "venue" ? requesterId : targetId;
        const hostName = requesterType === "host" ? requesterName : targetName;
        const venueName = requesterType === "venue" ? requesterName : targetName;
        return partnershipStore.requestPartnership(hostId, venueId, hostName, venueName, token);
    }

    // Promoter-initiated connection
    if (requesterType === "promoter") {
        return promoterConnectionStore.createConnectionRequest({
            promoterId: requesterId,
            promoterName: requesterName,
            promoterEmail: requesterEmail,
            targetId,
            targetType,
            targetName,
            message
        }, token);
    }

    // Target is a promoter
    if (targetType === "promoter") {
        return promoterConnectionStore.createConnectionRequest({
            promoterId: targetId,
            targetId: requesterId,
            targetType: requesterType,
            targetName: requesterName,
            message
        }, token);
    }

    throw new Error(`Unsupported connection type: ${requesterType} to ${targetType}`);
}

export async function approveRequest(connectionId, type, role, partnerId, partnerName, token) {
    if (type === "partnership") {
        return partnershipStore.approvePartnership(connectionId, token);
    }
    return promoterConnectionStore.approveConnectionRequest(connectionId, { uid: partnerId, name: partnerName, role }, token);
}

export async function rejectRequest(connectionId, type, role, partnerId, partnerName, reason = "", token) {
    if (type === "partnership") {
        return partnershipStore.rejectPartnership(connectionId, reason, token);
    }
    return promoterConnectionStore.rejectConnectionRequest(connectionId, { uid: partnerId, name: partnerName, role }, reason, token);
}

export async function blockRequest(connectionId, type, role, partnerId, partnerName, reason = "", token) {
    if (type === "partnership") {
        return partnershipStore.blockPartnership(connectionId, reason, token);
    }
    return promoterConnectionStore.blockConnectionRequest(connectionId, { uid: partnerId, role, name: partnerName }, reason, token);
}

export async function listConnections(partnerId, role, status = null, token) {
    const filters = {};
    if (role === "host") filters.hostId = partnerId;
    if (role === "venue") filters.venueId = partnerId;
    if (status) filters.status = status;

    const [partnerships, promoterConnections] = await Promise.all([
        role === "promoter" ? [] : partnershipStore.listPartnerships(filters, token),
        role === "promoter"
            ? promoterConnectionStore.listPromoterConnections(partnerId, status, token)
            : promoterConnectionStore.listIncomingRequests(partnerId, role, status, token)
    ]);

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

    return [...normalizedPartnerships, ...normalizedPromoters]
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}
