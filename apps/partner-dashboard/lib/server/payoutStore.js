/**
 * Promoter Payout Store
 * Manages promoter commission payouts
 */

import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import { randomUUID } from "node:crypto";

const PAYOUTS_COLLECTION = "promoter_payouts";
const COMMISSIONS_COLLECTION = "promoter_commissions";

// Fallback storage for development
let fallbackPayouts = [];

/**
 * Payout statuses
 */
export const PAYOUT_STATUS = {
    PENDING: "pending",
    PROCESSING: "processing",
    COMPLETED: "completed",
    FAILED: "failed",
    CANCELLED: "cancelled"
};

/**
 * Get promoter's available balance (unpaid commissions)
 */
export async function getPromoterBalance(promoterId) {
    if (!isFirebaseConfigured()) {
        return {
            totalEarned: 0,
            totalPaid: 0,
            available: 0,
            pending: 0
        };
    }

    const db = getAdminDb();

    // Get all commissions
    const commissionsSnapshot = await db.collection(COMMISSIONS_COLLECTION)
        .where("promoterId", "==", promoterId)
        .get();

    let totalEarned = 0;
    commissionsSnapshot.docs.forEach(doc => {
        totalEarned += doc.data().commissionAmount || 0;
    });

    // Get all completed payouts
    const payoutsSnapshot = await db.collection(PAYOUTS_COLLECTION)
        .where("promoterId", "==", promoterId)
        .where("status", "==", PAYOUT_STATUS.COMPLETED)
        .get();

    let totalPaid = 0;
    payoutsSnapshot.docs.forEach(doc => {
        totalPaid += doc.data().amount || 0;
    });

    // Get pending payouts
    const pendingSnapshot = await db.collection(PAYOUTS_COLLECTION)
        .where("promoterId", "==", promoterId)
        .where("status", "in", [PAYOUT_STATUS.PENDING, PAYOUT_STATUS.PROCESSING])
        .get();

    let pending = 0;
    pendingSnapshot.docs.forEach(doc => {
        pending += doc.data().amount || 0;
    });

    return {
        totalEarned,
        totalPaid,
        available: totalEarned - totalPaid - pending,
        pending
    };
}

/**
 * Request a payout
 */
export async function requestPayout({
    promoterId,
    amount,
    paymentMethod, // "upi", "bank_transfer", "paytm"
    paymentDetails, // UPI ID, bank account, etc.
    requestedBy
}) {
    // Validate amount
    const balance = await getPromoterBalance(promoterId);
    if (amount > balance.available) {
        throw new Error(`Insufficient balance. Available: ₹${balance.available}`);
    }

    if (amount < 100) {
        throw new Error("Minimum payout amount is ₹100");
    }

    const id = randomUUID();
    const now = new Date().toISOString();

    const payout = {
        id,
        promoterId,
        amount,
        paymentMethod,
        paymentDetails,
        status: PAYOUT_STATUS.PENDING,
        requestedBy: {
            uid: requestedBy.uid,
            name: requestedBy.name || "",
            email: requestedBy.email || ""
        },
        requestedAt: now,
        createdAt: now,
        updatedAt: now
    };

    if (!isFirebaseConfigured()) {
        fallbackPayouts.push(payout);
        return payout;
    }

    const db = getAdminDb();
    await db.collection(PAYOUTS_COLLECTION).doc(id).set(payout);
    return payout;
}

/**
 * Get payout by ID
 */
export async function getPayoutById(payoutId) {
    if (!isFirebaseConfigured()) {
        return fallbackPayouts.find(p => p.id === payoutId) || null;
    }

    const db = getAdminDb();
    const doc = await db.collection(PAYOUTS_COLLECTION).doc(payoutId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
}

/**
 * List payouts for a promoter
 */
export async function listPromoterPayouts(promoterId, options = {}) {
    const { status, limit = 50 } = options;

    if (!isFirebaseConfigured()) {
        let results = fallbackPayouts.filter(p => p.promoterId === promoterId);
        if (status) {
            results = results.filter(p => p.status === status);
        }
        return results.sort((a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt)
        ).slice(0, limit);
    }

    const db = getAdminDb();
    let query = db.collection(PAYOUTS_COLLECTION)
        .where("promoterId", "==", promoterId);

    if (status) {
        query = query.where("status", "==", status);
    }

    const snapshot = await query
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Update payout status (admin action)
 */
export async function updatePayoutStatus(payoutId, status, details = {}, updatedBy) {
    const payout = await getPayoutById(payoutId);
    if (!payout) {
        throw new Error("Payout not found");
    }

    const now = new Date().toISOString();

    const updateData = {
        status,
        updatedAt: now,
        lastUpdatedBy: {
            uid: updatedBy.uid,
            name: updatedBy.name || ""
        }
    };

    // Add status-specific fields
    if (status === PAYOUT_STATUS.PROCESSING) {
        updateData.processingStartedAt = now;
    } else if (status === PAYOUT_STATUS.COMPLETED) {
        updateData.completedAt = now;
        updateData.transactionId = details.transactionId || null;
        updateData.transactionDetails = details.transactionDetails || null;
    } else if (status === PAYOUT_STATUS.FAILED) {
        updateData.failedAt = now;
        updateData.failureReason = details.reason || "Unknown error";
    } else if (status === PAYOUT_STATUS.CANCELLED) {
        updateData.cancelledAt = now;
        updateData.cancellationReason = details.reason || "";
    }

    if (!isFirebaseConfigured()) {
        const index = fallbackPayouts.findIndex(p => p.id === payoutId);
        if (index >= 0) {
            fallbackPayouts[index] = { ...fallbackPayouts[index], ...updateData };
            return fallbackPayouts[index];
        }
        return null;
    }

    const db = getAdminDb();
    await db.collection(PAYOUTS_COLLECTION).doc(payoutId).update(updateData);
    return await getPayoutById(payoutId);
}

/**
 * Process a payout (mark as processing)
 */
export async function processPayout(payoutId, processedBy) {
    return await updatePayoutStatus(payoutId, PAYOUT_STATUS.PROCESSING, {}, processedBy);
}

/**
 * Complete a payout
 */
export async function completePayout(payoutId, transactionDetails, completedBy) {
    return await updatePayoutStatus(
        payoutId,
        PAYOUT_STATUS.COMPLETED,
        {
            transactionId: transactionDetails.transactionId,
            transactionDetails
        },
        completedBy
    );
}

/**
 * Fail a payout
 */
export async function failPayout(payoutId, reason, failedBy) {
    return await updatePayoutStatus(payoutId, PAYOUT_STATUS.FAILED, { reason }, failedBy);
}

/**
 * Cancel a payout request
 */
export async function cancelPayout(payoutId, reason, cancelledBy) {
    const payout = await getPayoutById(payoutId);
    if (!payout) {
        throw new Error("Payout not found");
    }

    if (payout.status !== PAYOUT_STATUS.PENDING) {
        throw new Error("Can only cancel pending payouts");
    }

    return await updatePayoutStatus(payoutId, PAYOUT_STATUS.CANCELLED, { reason }, cancelledBy);
}

/**
 * Get all pending payouts (for admin)
 */
export async function getAllPendingPayouts(limit = 100) {
    if (!isFirebaseConfigured()) {
        return fallbackPayouts
            .filter(p => p.status === PAYOUT_STATUS.PENDING)
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }

    const db = getAdminDb();
    const snapshot = await db.collection(PAYOUTS_COLLECTION)
        .where("status", "==", PAYOUT_STATUS.PENDING)
        .orderBy("createdAt", "asc")
        .limit(limit)
        .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get payout statistics
 */
export async function getPayoutStats(startDate, endDate) {
    if (!isFirebaseConfigured()) {
        return {
            totalPending: 0,
            totalProcessing: 0,
            totalCompleted: 0,
            totalFailed: 0,
            totalAmount: 0
        };
    }

    const db = getAdminDb();
    let query = db.collection(PAYOUTS_COLLECTION);

    if (startDate) {
        query = query.where("createdAt", ">=", startDate);
    }
    if (endDate) {
        query = query.where("createdAt", "<=", endDate);
    }

    const snapshot = await query.get();

    const stats = {
        totalPending: 0,
        totalProcessing: 0,
        totalCompleted: 0,
        totalFailed: 0,
        pendingAmount: 0,
        processingAmount: 0,
        completedAmount: 0
    };

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const amount = data.amount || 0;

        switch (data.status) {
            case PAYOUT_STATUS.PENDING:
                stats.totalPending++;
                stats.pendingAmount += amount;
                break;
            case PAYOUT_STATUS.PROCESSING:
                stats.totalProcessing++;
                stats.processingAmount += amount;
                break;
            case PAYOUT_STATUS.COMPLETED:
                stats.totalCompleted++;
                stats.completedAmount += amount;
                break;
            case PAYOUT_STATUS.FAILED:
                stats.totalFailed++;
                break;
        }
    });

    return stats;
}
