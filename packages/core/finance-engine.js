/**
 * THE C1RCLE - Finance Engine
 * Orchestrates financial operations, reporting, and refunds.
 */

import { getAdminDb } from "./admin.js";
import {
    MONEY_STATES,
    getBalance,
    initiateRefund,
    finalizeRefund,
    ACCOUNTS
} from "./ledger-engine.js";

/**
 * Gets a high-level financial summary for a partner or event
 */
export async function getFinancialSummary(entityId, type = "venue") {
    const db = getAdminDb();

    // Total Revenue (HELD + SETTLED + PAYABLE)
    const netRevenue = await getBalance({ actorId: entityId });

    // Amount already paid out
    const paidOut = await getBalance({ actorId: entityId, state: MONEY_STATES.PAID_OUT });

    // Pending refunds
    const refundPending = await getBalance({ actorId: entityId, state: MONEY_STATES.REFUND_PENDING });

    return {
        entityId,
        type,
        netRevenue,
        availableBalance: netRevenue - paidOut,
        paidOut: Math.abs(paidOut),
        refundPending: Math.abs(refundPending),
        currency: "INR"
    };
}

/**
 * Fetches transaction history from the ledger
 */
export async function getTransactionHistory(entityId, options = {}) {
    const { limit = 50, state = null } = options;
    const db = getAdminDb();

    let query = db.collection("ledger_entries")
        .where("actorId", "==", entityId);

    if (state) {
        query = query.where("state", "==", state);
    }

    query = query.orderBy("timestamp", "desc").limit(limit);

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

/**
 * Orchestrates a refund process
 */
export async function processRefund(orderId, amount, reason, actor = "system") {
    const db = getAdminDb();

    // 1. Transaction to initiate refund in ledger
    // This checks if funds are available in the order's CAPTURED state
    const result = await db.runTransaction(async (transaction) => {
        // Find the order to get its current state
        const orderDoc = await transaction.get(db.collection("orders").doc(orderId));
        if (!orderDoc.exists) throw new Error("Order not found");
        const order = orderDoc.data();

        // Initiate ledger entries
        await initiateRefund(orderId, amount, reason, order.ledgerState || MONEY_STATES.CAPTURED, transaction);

        // Update order status/metadata
        transaction.update(db.collection("orders").doc(orderId), {
            refundStatus: "pending",
            refundAmount: amount,
            updatedAt: new Date().toISOString()
        });

        return { success: true };
    });

    // 2. Integration with Payment Gateway (Razorpay/Stripe) would happen here
    // For now, we simulate success and finalize immediately in this POC logic
    // In production, this would be a separate webhook-driven step
    const refundId = `REF-${randomUUID().substring(0, 8).toUpperCase()}`;
    await finalizeRefund(orderId, amount, refundId);

    return { success: true, refundId };
}

function randomUUID() {
    return Math.random().toString(36).substring(2, 15);
}
