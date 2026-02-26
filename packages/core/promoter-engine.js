/**
 * THE C1RCLE - Promoter Engine
 * Centralizes partnership management and conversion tracking.
 */

import { randomUUID } from "node:crypto";
import { getAdminDb } from "./admin.js";

const CONNECTIONS_COLLECTION = "promoter_connections";
const CLUBS_COLLECTION = "venues";
const HOSTS_COLLECTION = "hosts";
const PROMOTERS_COLLECTION = "promoters";

/**
 * Manages partnership connection lifecycle
 */
export async function manageConnection(action, { connectionId, targetId, targetType, promoterId, actor, reason = "" }) {
    const db = getAdminDb();
    const now = new Date().toISOString();

    if (action === "request") {
        const id = connectionId || randomUUID();
        const connectionData = {
            id,
            promoterId,
            targetId,
            targetType,
            status: "pending",
            message: reason,
            createdAt: now,
            updatedAt: now
        };
        await db.collection(CONNECTIONS_COLLECTION).doc(id).set(connectionData);
        return connectionData;
    }

    const ref = db.collection(CONNECTIONS_COLLECTION).doc(connectionId);
    const update = {
        updatedAt: now,
        resolvedAt: now,
        resolvedBy: actor ? { uid: actor.uid, name: actor.name } : null
    };

    switch (action) {
        case "approve":
            update.status = "approved";
            break;
        case "reject":
            update.status = "rejected";
            update.rejectionReason = reason;
            break;
        case "block":
            update.status = "blocked";
            update.blockReason = reason;
            break;
        case "revoke":
            update.status = "revoked";
            break;
        default:
            throw new Error(`Invalid connection action: ${action}`);
    }

    await ref.update(update);
    return { id: connectionId, ...update };
}

/**
 * Generates a tracking link for a promoter
 */
export async function generatePromoterLink(promoterId, eventId) {
    // In our system, the link usually follows a pattern or uses a specific token
    // For now, we return a standardized structure that apps can use to build URLs
    return {
        promoterId,
        eventId,
        token: `p_${promoterId.substring(0, 8)}`,
        url: `/e/${eventId}?ref=${promoterId}`
    };
}

/**
 * Aggregates stats for a promoter
 */
export async function getPromoterStats(promoterId) {
    const db = getAdminDb();

    // 1. Get confirmed orders attributed to this promoter
    const ordersSnapshot = await db.collection("orders")
        .where("promoterId", "==", promoterId)
        .where("status", "in", ["confirmed", "completed"])
        .get();

    const stats = {
        totalOrders: ordersSnapshot.size,
        totalRevenue: 0,
        totalCommission: 0,
        conversionRate: 0 // Would require click data from another collection
    };

    ordersSnapshot.forEach(doc => {
        const data = doc.data();
        stats.totalRevenue += (data.totalAmount || 0);
        stats.totalCommission += (data.promoterAttribution?.commissionAmount || 0);
    });

    return stats;
}

/**
 * Lists connections for an entity
 */
export async function listConnections(entityId, entityType, status = null) {
    const db = getAdminDb();
    let query = db.collection(CONNECTIONS_COLLECTION);

    if (entityType === 'promoter') {
        query = query.where("promoterId", "==", entityId);
    } else {
        query = query.where("targetId", "==", entityId);
    }

    if (status) {
        query = query.where("status", "==", status);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
