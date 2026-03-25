/**
 * Promoter Store (Guest Portal version)
 * Manages promoter link resolution and conversion tracking
 */

import { getAdminDb, isFirebaseConfigured } from "../firebase/admin.js";
import { randomUUID } from "node:crypto";

const LINKS_COLLECTION = "promoter_links";
const COMMISSIONS_COLLECTION = "promoter_commissions";

/**
 * Get a promoter link by code
 */
export async function getPromoterLinkByCode(code) {
    if (!code) return null;

    if (!isFirebaseConfigured()) {
        console.warn("[PromoterStore] Firebase not configured, returning null for code:", code);
        return null;
    }

    const db = getAdminDb();
    const snapshot = await db.collection(LINKS_COLLECTION)
        .where("code", "==", code)
        .where("isActive", "==", true)
        .limit(1)
        .get();

    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
}

/**
 * Record a conversion (sale) on a promoter link
 */
/**
 * Get a promoter profile by their public username/handle
 */
export async function getPromoterByUsername(username) {
    if (!username) return null;

    if (!isFirebaseConfigured()) return null;

    const db = getAdminDb();
    const snapshot = await db.collection("promoters")
        .where("username", "==", username.toLowerCase())
        .limit(1)
        .get();

    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    const data = doc.data();

    // Serialize timestamps
    const serialized = { id: doc.id, ...data };
    Object.keys(serialized).forEach(key => {
        if (serialized[key] && typeof serialized[key].toDate === "function") {
            serialized[key] = serialized[key].toDate().toISOString();
        }
    });
    return serialized;
}

/**
 * Get active events a promoter is currently promoting
 */
export async function getPromoterActiveEvents(promoterId) {
    if (!promoterId) return [];

    if (!isFirebaseConfigured()) return [];

    const db = getAdminDb();

    // Find active links for this promoter
    const linksSnap = await db.collection(LINKS_COLLECTION)
        .where("promoterId", "==", promoterId)
        .where("isActive", "==", true)
        .limit(20)
        .get();

    if (linksSnap.empty) return [];

    const eventIds = [...new Set(linksSnap.docs.map(d => d.data().eventId).filter(Boolean))];
    if (eventIds.length === 0) return [];

    // Batch fetch events (Firestore limits to 10 per `in` query)
    const chunks = [];
    for (let i = 0; i < eventIds.length; i += 10) {
        chunks.push(eventIds.slice(i, i + 10));
    }

    const eventDocs = (await Promise.all(
        chunks.map(chunk =>
            db.collection("events").where("__name__", "in", chunk).get()
        )
    )).flatMap(snap => snap.docs);

    const now = new Date();
    const PUBLIC_STATES = ["scheduled", "live"];

    return eventDocs
        .map(doc => {
            const data = doc.data();
            const serialized = { id: doc.id, ...data };
            Object.keys(serialized).forEach(key => {
                if (serialized[key] && typeof serialized[key].toDate === "function") {
                    serialized[key] = serialized[key].toDate().toISOString();
                }
            });
            return serialized;
        })
        .filter(e => PUBLIC_STATES.includes(e.lifecycle))
        .sort((a, b) => new Date(a.startDate || 0) - new Date(b.startDate || 0));
}

export async function recordConversion(linkId, orderId, orderAmount, ticketTierId) {
    if (!linkId) return null;

    if (!isFirebaseConfigured()) {
        console.warn("[PromoterStore] Firebase not configured, skipped recording conversion.");
        return null;
    }

    const db = getAdminDb();

    // Fetch link details to calculate commission
    const linkDoc = await db.collection(LINKS_COLLECTION).doc(linkId).get();
    if (!linkDoc.exists) return null;
    const link = linkDoc.data();

    // Calculate commission
    let commissionAmount;
    if (link.commissionType === "percentage") {
        commissionAmount = Math.round(orderAmount * ((link.commissionRate || 15) / 100));
    } else {
        commissionAmount = link.commissionRate || 50; // Fixed amount fallback
    }

    const now = new Date().toISOString();
    const commissionId = randomUUID();

    // Create commission record
    const commissionRecord = {
        id: commissionId,
        linkId,
        linkCode: link.code,
        promoterId: link.promoterId,
        eventId: link.eventId,
        orderId,
        orderAmount,
        ticketTierId: ticketTierId || "multi",
        commissionRate: link.commissionRate,
        commissionType: link.commissionType,
        commissionAmount,
        status: "pending",
        createdAt: now,
        updatedAt: now
    };

    const { FieldValue } = require("firebase-admin/firestore");

    // Transaction to update link stats and create commission record
    try {
        await db.runTransaction(async (transaction) => {
            const linkRef = db.collection(LINKS_COLLECTION).doc(linkId);
            const commissionRef = db.collection(COMMISSIONS_COLLECTION).doc(commissionId);

            transaction.update(linkRef, {
                conversions: FieldValue.increment(1),
                revenue: FieldValue.increment(orderAmount),
                commission: FieldValue.increment(commissionAmount),
                updatedAt: now
            });

            transaction.set(commissionRef, commissionRecord);
        });

        console.log(`[PromoterStore] Conversion recorded for link ${linkId}, order ${orderId}`);
        return commissionRecord;
    } catch (error) {
        console.error("[PromoterStore] Failed to record conversion:", error);
        throw error;
    }
}
