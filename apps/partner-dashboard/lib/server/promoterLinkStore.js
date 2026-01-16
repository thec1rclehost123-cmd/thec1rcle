/**
 * Promoter Link Store
 * Manages promoter affiliate links and commission tracking
 */

import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import { randomUUID } from "node:crypto";

const LINKS_COLLECTION = "promoter_links";
const COMMISSIONS_COLLECTION = "promoter_commissions";

// Fallback storage for development
let fallbackLinks = [];
let fallbackCommissions = [];

/**
 * Generate a unique short code for promoter links
 */
function generateShortCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

/**
 * Create a promoter link for an event
 */
export async function createPromoterLink({
    promoterId,
    promoterName,
    eventId,
    eventTitle,
    ticketTierIds = [],
    commissionRate,
    commissionType = "percentage",
    expiresAt = null
}) {
    const id = randomUUID();
    const code = generateShortCode();
    const now = new Date().toISOString();

    const link = {
        id,
        code,
        promoterId,
        promoterName,
        eventId,
        eventTitle,
        ticketTierIds,
        commissionRate,
        commissionType,
        clicks: 0,
        conversions: 0,
        revenue: 0,
        commission: 0,
        isActive: true,
        expiresAt,
        createdAt: now,
        updatedAt: now
    };

    if (!isFirebaseConfigured()) {
        // Check for existing link
        const existing = fallbackLinks.find(l =>
            l.promoterId === promoterId && l.eventId === eventId && l.isActive
        );
        if (existing) {
            throw new Error("You already have an active link for this event");
        }
        fallbackLinks.push(link);
        return link;
    }

    const db = getAdminDb();

    // Check for duplicate
    const existingSnapshot = await db.collection(LINKS_COLLECTION)
        .where("promoterId", "==", promoterId)
        .where("eventId", "==", eventId)
        .where("isActive", "==", true)
        .limit(1)
        .get();

    if (!existingSnapshot.empty) {
        throw new Error("You already have an active link for this event");
    }

    await db.collection(LINKS_COLLECTION).doc(id).set(link);
    return link;
}

/**
 * Get a promoter link by code
 */
export async function getPromoterLinkByCode(code) {
    if (!isFirebaseConfigured()) {
        return fallbackLinks.find(l => l.code === code && l.isActive) || null;
    }

    const db = getAdminDb();
    const snapshot = await db.collection(LINKS_COLLECTION)
        .where("code", "==", code)
        .where("isActive", "==", true)
        .limit(1)
        .get();

    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

/**
 * Get a promoter link by ID
 */
export async function getPromoterLink(id) {
    if (!isFirebaseConfigured()) {
        return fallbackLinks.find(l => l.id === id) || null;
    }

    const db = getAdminDb();
    const doc = await db.collection(LINKS_COLLECTION).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
}

/**
 * List promoter links
 */
export async function listPromoterLinks({ promoterId, eventId, isActive, limit = 50 }) {
    if (!isFirebaseConfigured()) {
        let results = [...fallbackLinks];
        if (promoterId) results = results.filter(l => l.promoterId === promoterId);
        if (eventId) results = results.filter(l => l.eventId === eventId);
        if (typeof isActive === "boolean") results = results.filter(l => l.isActive === isActive);
        return results.slice(0, limit);
    }

    const db = getAdminDb();
    let query = db.collection(LINKS_COLLECTION);

    if (promoterId) query = query.where("promoterId", "==", promoterId);
    if (eventId) query = query.where("eventId", "==", eventId);
    if (typeof isActive === "boolean") query = query.where("isActive", "==", isActive);

    query = query.orderBy("createdAt", "desc").limit(limit);

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Record a click on a promoter link
 */
export async function recordLinkClick(linkId) {
    if (!isFirebaseConfigured()) {
        const link = fallbackLinks.find(l => l.id === linkId);
        if (link) {
            link.clicks += 1;
            link.updatedAt = new Date().toISOString();
        }
        return link;
    }

    const db = getAdminDb();
    const { FieldValue } = require("firebase-admin/firestore");

    await db.collection(LINKS_COLLECTION).doc(linkId).update({
        clicks: FieldValue.increment(1),
        updatedAt: new Date().toISOString()
    });
}

/**
 * Record a conversion (sale) on a promoter link
 */
export async function recordConversion(linkId, orderId, orderAmount, ticketTierId) {
    const link = await getPromoterLink(linkId);
    if (!link) throw new Error("Promoter link not found");

    // Calculate commission
    let commissionAmount;
    if (link.commissionType === "percentage") {
        commissionAmount = Math.round(orderAmount * (link.commissionRate / 100));
    } else {
        commissionAmount = link.commissionRate;
    }

    const now = new Date().toISOString();

    // Create commission record
    const commissionRecord = {
        id: randomUUID(),
        linkId,
        linkCode: link.code,
        promoterId: link.promoterId,
        eventId: link.eventId,
        orderId,
        orderAmount,
        ticketTierId,
        commissionRate: link.commissionRate,
        commissionType: link.commissionType,
        commissionAmount,
        status: "pending", // pending, paid, cancelled
        createdAt: now
    };

    if (!isFirebaseConfigured()) {
        fallbackCommissions.push(commissionRecord);
        const linkObj = fallbackLinks.find(l => l.id === linkId);
        if (linkObj) {
            linkObj.conversions += 1;
            linkObj.revenue += orderAmount;
            linkObj.commission += commissionAmount;
            linkObj.updatedAt = now;
        }
        return { link: linkObj, commission: commissionRecord };
    }

    const db = getAdminDb();
    const { FieldValue } = require("firebase-admin/firestore");

    // Transaction to update link stats and create commission record
    await db.runTransaction(async (transaction) => {
        const linkRef = db.collection(LINKS_COLLECTION).doc(linkId);
        const commissionRef = db.collection(COMMISSIONS_COLLECTION).doc(commissionRecord.id);

        transaction.update(linkRef, {
            conversions: FieldValue.increment(1),
            revenue: FieldValue.increment(orderAmount),
            commission: FieldValue.increment(commissionAmount),
            updatedAt: now
        });

        transaction.set(commissionRef, commissionRecord);
    });

    return { link, commission: commissionRecord };
}

/**
 * Get promoter statistics
 */
export async function getPromoterStats(promoterId) {
    if (!isFirebaseConfigured()) {
        const links = fallbackLinks.filter(l => l.promoterId === promoterId);
        const commissions = fallbackCommissions.filter(c => c.promoterId === promoterId);

        return {
            totalLinks: links.length,
            totalClicks: links.reduce((sum, l) => sum + l.clicks, 0),
            totalConversions: links.reduce((sum, l) => sum + l.conversions, 0),
            totalRevenue: links.reduce((sum, l) => sum + l.revenue, 0),
            totalCommission: links.reduce((sum, l) => sum + l.commission, 0),
            pendingCommission: commissions.filter(c => c.status === "pending")
                .reduce((sum, c) => sum + c.commissionAmount, 0),
            paidCommission: commissions.filter(c => c.status === "paid")
                .reduce((sum, c) => sum + c.commissionAmount, 0),
            conversionRate: links.reduce((sum, l) => sum + l.clicks, 0) > 0
                ? (links.reduce((sum, l) => sum + l.conversions, 0) /
                    links.reduce((sum, l) => sum + l.clicks, 0) * 100).toFixed(2)
                : 0
        };
    }

    const db = getAdminDb();

    // Get all links for this promoter
    const linksSnapshot = await db.collection(LINKS_COLLECTION)
        .where("promoterId", "==", promoterId)
        .get();

    const links = linksSnapshot.docs.map(doc => doc.data());

    // Get pending and paid commissions
    const pendingSnapshot = await db.collection(COMMISSIONS_COLLECTION)
        .where("promoterId", "==", promoterId)
        .where("status", "==", "pending")
        .get();

    const paidSnapshot = await db.collection(COMMISSIONS_COLLECTION)
        .where("promoterId", "==", promoterId)
        .where("status", "==", "paid")
        .get();

    const totalClicks = links.reduce((sum, l) => sum + (l.clicks || 0), 0);
    const totalConversions = links.reduce((sum, l) => sum + (l.conversions || 0), 0);

    return {
        totalLinks: links.length,
        totalClicks,
        totalConversions,
        totalRevenue: links.reduce((sum, l) => sum + (l.revenue || 0), 0),
        totalCommission: links.reduce((sum, l) => sum + (l.commission || 0), 0),
        pendingCommission: pendingSnapshot.docs.reduce((sum, d) => sum + (d.data().commissionAmount || 0), 0),
        paidCommission: paidSnapshot.docs.reduce((sum, d) => sum + (d.data().commissionAmount || 0), 0),
        conversionRate: totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(2) : 0
    };
}

/**
 * Deactivate a promoter link
 */
export async function deactivateLink(linkId, deactivatedBy) {
    const now = new Date().toISOString();

    if (!isFirebaseConfigured()) {
        const link = fallbackLinks.find(l => l.id === linkId);
        if (link) {
            link.isActive = false;
            link.deactivatedAt = now;
            link.deactivatedBy = deactivatedBy;
        }
        return link;
    }

    const db = getAdminDb();
    await db.collection(LINKS_COLLECTION).doc(linkId).update({
        isActive: false,
        deactivatedAt: now,
        deactivatedBy,
        updatedAt: now
    });

    return await getPromoterLink(linkId);
}

/**
 * List promoter commissions
 */
export async function listPromoterCommissions({ promoterId, eventId, status, limit = 50 }) {
    if (!isFirebaseConfigured()) {
        let results = [...fallbackCommissions];
        if (promoterId) results = results.filter(c => c.promoterId === promoterId);
        if (eventId) results = results.filter(c => c.eventId === eventId);
        if (status) results = results.filter(c => c.status === status);
        return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
    }

    const db = getAdminDb();
    let query = db.collection(COMMISSIONS_COLLECTION);

    if (promoterId) query = query.where("promoterId", "==", promoterId);
    if (eventId) query = query.where("eventId", "==", eventId);
    if (status) query = query.where("status", "==", status);

    query = query.orderBy("createdAt", "desc").limit(limit);

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get event's promoter performance summary
 */
export async function getEventPromoterSummary(eventId) {
    if (!isFirebaseConfigured()) {
        const links = fallbackLinks.filter(l => l.eventId === eventId);
        return {
            totalPromoters: new Set(links.map(l => l.promoterId)).size,
            totalClicks: links.reduce((sum, l) => sum + l.clicks, 0),
            totalConversions: links.reduce((sum, l) => sum + l.conversions, 0),
            totalRevenue: links.reduce((sum, l) => sum + l.revenue, 0),
            totalCommission: links.reduce((sum, l) => sum + l.commission, 0),
            topPromoters: links.sort((a, b) => b.conversions - a.conversions).slice(0, 5)
        };
    }

    const db = getAdminDb();
    const snapshot = await db.collection(LINKS_COLLECTION)
        .where("eventId", "==", eventId)
        .get();

    const links = snapshot.docs.map(doc => doc.data());

    return {
        totalPromoters: new Set(links.map(l => l.promoterId)).size,
        totalClicks: links.reduce((sum, l) => sum + (l.clicks || 0), 0),
        totalConversions: links.reduce((sum, l) => sum + (l.conversions || 0), 0),
        totalRevenue: links.reduce((sum, l) => sum + (l.revenue || 0), 0),
        totalCommission: links.reduce((sum, l) => sum + (l.commission || 0), 0),
        topPromoters: links.sort((a, b) => (b.conversions || 0) - (a.conversions || 0)).slice(0, 5)
    };
}
