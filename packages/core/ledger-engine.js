import { randomUUID } from "node:crypto";
import { getAdminDb, isFirebaseConfigured } from "./admin.js";

const LEDGER_COLLECTION = "ledger_entries";

export const MONEY_STATES = {
    AUTHORIZED: "AUTHORIZED",
    CAPTURED: "CAPTURED",   // Funds held by Gateway
    HELD: "HELD",           // Earmarked for Event
    SETTLED: "SETTLED",     // After-Event Finality (Net Revenue)
    PAYABLE: "PAYABLE",     // Allocated to Partner Balance
    PAID_OUT: "PAID_OUT",   // Transferred to Partner Bank (Terminal)
    REFUND_PENDING: "REFUND_PENDING",
    REFUNDED: "REFUNDED",   // Returned to User (Terminal)
    EXPIRED: "EXPIRED",     // Never Captured (Terminal)
    VOID: "VOID"           // Cancelled before Hold (Terminal)
};

const VALID_TRANSITIONS = {
    [MONEY_STATES.AUTHORIZED]: [MONEY_STATES.CAPTURED, MONEY_STATES.EXPIRED, MONEY_STATES.VOID],
    [MONEY_STATES.CAPTURED]: [MONEY_STATES.HELD, MONEY_STATES.REFUND_PENDING, MONEY_STATES.VOID],
    [MONEY_STATES.HELD]: [MONEY_STATES.SETTLED, MONEY_STATES.REFUND_PENDING],
    [MONEY_STATES.SETTLED]: [MONEY_STATES.PAYABLE, MONEY_STATES.REFUND_PENDING],
    [MONEY_STATES.PAYABLE]: [MONEY_STATES.PAID_OUT],
    [MONEY_STATES.REFUND_PENDING]: [MONEY_STATES.REFUNDED],
    // Terminal states: PAID_OUT, REFUNDED, EXPIRED, VOID
};

/**
 * Account Names (for clarity in chart of accounts)
 */
export const ACCOUNTS = {
    SYSTEM: "SYSTEM_LIABILITY",         // Broad platform liability
    GUEST: "GUEST_ASSET",             // User's claim on funds
    GATEWAY: "GATEWAY_ESCROW",         // Funds at Razorpay/Stripe
    PLATFORM_FEE: "C1RCLE_OVERHEAD",    // Our cut
    PARTNER: "PARTNER_PAYABLE",        // Owed to Club/Host
    PROMOTER: "PROMOTER_PAYABLE",      // Owed to Promoter
};

/**
 * Core function to record balanced ledger entries
 */
export async function recordLedgerTransaction(entries, transaction = null) {
    if (!entries || entries.length === 0) return;

    // Validate balance
    const balance = entries.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
    if (Math.abs(balance) > 0.001) { // Floating point safety
        throw new Error(`Ledger transaction is out of balance. Sum: ${balance}`);
    }

    const groupId = `TXN-${randomUUID().substring(0, 8).toUpperCase()}`;
    const timestamp = new Date().toISOString();
    const db = getAdminDb();

    const finalizedEntries = entries.map(entry => ({
        id: `LEDG-${randomUUID().substring(0, 12).toUpperCase()}`,
        groupId,
        timestamp,
        ...entry
    }));

    const writeOp = async (t) => {
        for (const entry of finalizedEntries) {
            const ref = db.collection(LEDGER_COLLECTION).doc(entry.id);
            t.set(ref, entry);
        }
    };

    if (transaction) {
        await writeOp(transaction);
    } else {
        await db.runTransaction(writeOp);
    }

    return finalizedEntries;
}

/**
 * Transition money from one state to another for a specific entity
 */
export async function transitionMoneyState(entityId, fromState, toState, amount, metadata = {}, transaction = null) {
    if (!VALID_TRANSITIONS[fromState]?.includes(toState)) {
        throw new Error(`Invalid state transition: ${fromState} -> ${toState}`);
    }

    // To transition, we create reversal entries for the fromState and new entries for the toState
    // This keeps the history immutable.

    const entries = [
        // Out of old state
        {
            entityId,
            entityType: metadata.entityType || 'order',
            actorId: metadata.actorId || ACCOUNTS.SYSTEM,
            actorType: metadata.actorType || 'system',
            amount: -amount,
            currency: metadata.currency || 'INR',
            state: fromState,
            description: `Transition OUT of ${fromState} towards ${toState}`,
            metadata: { ...metadata, transition: 'OUT' }
        },
        // Into new state
        {
            entityId,
            entityType: metadata.entityType || 'order',
            actorId: metadata.actorId || ACCOUNTS.SYSTEM,
            actorType: metadata.actorType || 'system',
            amount: amount,
            currency: metadata.currency || 'INR',
            state: toState,
            description: `Transition IN to ${toState} from ${fromState}`,
            metadata: { ...metadata, transition: 'IN' }
        }
    ];

    return await recordLedgerTransaction(entries, transaction);
}

/**
 * Initial entry when payment is authorized (but not yet captured)
 */
export async function recordOrderAuthorized(order, paymentIntentId, transaction = null) {
    const entries = [
        {
            entityId: order.id,
            entityType: 'order',
            actorId: order.userId || 'GUEST',
            actorType: ACCOUNTS.GUEST,
            amount: order.totalAmount,
            currency: order.currency || 'INR',
            state: MONEY_STATES.AUTHORIZED,
            referenceId: paymentIntentId,
            description: "Order Payment Authorized",
            metadata: { eventId: order.eventId }
        },
        {
            entityId: order.id,
            entityType: 'order',
            actorId: ACCOUNTS.SYSTEM,
            actorType: 'system',
            amount: -order.totalAmount,
            currency: order.currency || 'INR',
            state: MONEY_STATES.AUTHORIZED,
            referenceId: paymentIntentId,
            description: "System Liability Created (Authorized)",
            metadata: { eventId: order.eventId }
        }
    ];

    return await recordLedgerTransaction(entries, transaction);
}

/**
 * When payment is captured
 */
export async function recordOrderCaptured(order, paymentId, transaction = null) {
    const amount = Number(order.totalAmount);
    const db = getAdminDb();

    // Idempotency: Check if this paymentId already exists in Captured state
    const existing = await db.collection(LEDGER_COLLECTION)
        .where("entityId", "==", order.id)
        .where("referenceId", "==", paymentId)
        .where("state", "==", MONEY_STATES.CAPTURED)
        .get();

    if (!existing.empty) {
        console.log(`[Ledger] Payment ${paymentId} already captured for order ${order.id}. Skipping.`);
        return;
    }

    try {
        await transitionMoneyState(order.id, MONEY_STATES.AUTHORIZED, MONEY_STATES.CAPTURED, amount, {
            entityType: 'order',
            actorId: order.userId,
            actorType: 'user',
            referenceId: paymentId,
            eventId: order.eventId
        }, transaction);
    } catch (err) {
        // If transition fails (e.g. no AUTHORIZED state), we create direct CAPTURED entries
        const entries = [
            {
                entityId: order.id,
                entityType: 'order',
                actorId: order.userId || 'GUEST',
                actorType: 'user',
                amount: amount,
                currency: order.currency || 'INR',
                state: MONEY_STATES.CAPTURED,
                referenceId: paymentId,
                description: "Order Payment Captured (Direct)",
                metadata: { eventId: order.eventId }
            },
            {
                entityId: order.id,
                entityType: 'order',
                actorId: ACCOUNTS.SYSTEM,
                actorType: 'system',
                amount: -amount,
                currency: order.currency || 'INR',
                state: MONEY_STATES.CAPTURED,
                referenceId: paymentId,
                description: "Platform Custody (Captured)",
                metadata: { eventId: order.eventId }
            }
        ];
        await recordLedgerTransaction(entries, transaction);
    }
}

/**
 * Move money from Captured to Held (allocating to event)
 */
export async function holdOrderRevenue(order, transaction = null) {
    return await transitionMoneyState(order.id, MONEY_STATES.CAPTURED, MONEY_STATES.HELD, order.totalAmount, {
        entityType: 'order',
        actorId: order.userId,
        actorType: 'user',
        eventId: order.eventId
    }, transaction);
}

/**
 * Settle order revenue (after event completion)
 */
export async function settleOrderRevenue(order, transaction = null) {
    return await transitionMoneyState(order.id, MONEY_STATES.HELD, MONEY_STATES.SETTLED, order.totalAmount, {
        entityType: 'order',
        actorId: ACCOUNTS.SYSTEM,
        actorType: 'system',
        eventId: order.eventId
    }, transaction);
}

/**
 * Move from Settled to Payable (Split to partners)
 */
export async function allocateToPayable(order, splits, transaction = null) {
    // splits: Array of { actorId, actorType, amount, description }
    // Total of splits must equal order.totalAmount

    const totalSplit = splits.reduce((sum, s) => sum + s.amount, 0);
    if (Math.abs(totalSplit - order.totalAmount) > 0.001) {
        throw new Error("Payable split total does not match order amount");
    }

    // 1. Take money OUT of SETTLED (System Liability)
    const exitEntries = [
        {
            entityId: order.id,
            entityType: 'order',
            actorId: ACCOUNTS.SYSTEM,
            actorType: 'system',
            amount: -order.totalAmount,
            currency: order.currency || 'INR',
            state: MONEY_STATES.SETTLED,
            description: "Exit Settled state for distribution",
            metadata: { eventId: order.eventId }
        },
        {
            entityId: order.id,
            entityType: 'order',
            actorId: 'TRANSIT_POOL',
            actorType: 'system',
            amount: order.totalAmount,
            currency: order.currency || 'INR',
            state: 'TRANSIT',
            description: "Transit to distribution",
            metadata: { eventId: order.eventId }
        }
    ];

    // 2. Put money INTO PAYABLE for each partner
    const payableEntries = splits.flatMap(split => [
        {
            entityId: order.id,
            entityType: 'order',
            actorId: split.actorId,
            actorType: split.actorType === 'promoter' ? ACCOUNTS.PROMOTER : ACCOUNTS.PARTNER,
            amount: split.amount,
            currency: order.currency || 'INR',
            state: MONEY_STATES.PAYABLE,
            description: split.description || `Allocation to ${split.actorType}`,
            metadata: { eventId: order.eventId, originalOrder: order.id }
        },
        {
            entityId: order.id,
            entityType: 'order',
            actorId: 'TRANSIT_POOL',
            actorType: 'system',
            amount: -split.amount,
            currency: order.currency || 'INR',
            state: 'TRANSIT',
            description: "Offset from transit to payable",
            metadata: { eventId: order.eventId }
        }
    ]);

    return await recordLedgerTransaction([...exitEntries, ...payableEntries], transaction);
}

/**
 * Record payout execution
 */
export async function recordPayout(payoutId, partnerId, partnerType, amount, referenceId) {
    const entries = [
        {
            entityId: payoutId,
            entityType: 'payout',
            actorId: partnerId,
            actorType: partnerType,
            amount: -amount,
            currency: 'INR',
            state: MONEY_STATES.PAYABLE,
            description: "Withdrawal from Payable",
            referenceId
        },
        {
            entityId: payoutId,
            entityType: 'payout',
            actorId: partnerId,
            actorType: partnerType,
            amount: amount,
            currency: 'INR',
            state: MONEY_STATES.PAID_OUT,
            description: "Final Payout Transferred",
            referenceId
        }
    ];

    // Balanced by system
    const systemEntries = [
        {
            entityId: payoutId,
            entityType: 'payout',
            actorId: ACCOUNTS.SYSTEM,
            actorType: 'system',
            amount: amount,
            currency: 'INR',
            state: MONEY_STATES.PAYABLE,
            description: "System Payable Offset"
        },
        {
            entityId: payoutId,
            entityType: 'payout',
            actorId: ACCOUNTS.SYSTEM,
            actorType: 'system',
            amount: -amount,
            currency: 'INR',
            state: MONEY_STATES.PAID_OUT,
            description: "System Paid Out Offset"
        }
    ];

    return await recordLedgerTransaction([...entries, ...systemEntries]);
}

/**
 * Handle Refunds
 */
export async function initiateRefund(orderId, amount, reason, currentState = MONEY_STATES.CAPTURED, transaction = null) {
    // Audit check: Verify current balance in the currentState
    if (currentState === MONEY_STATES.PAID_OUT || currentState === MONEY_STATES.REFUNDED) {
        throw new Error(`CRITICAL: Cannot initiate refund from terminal state ${currentState}`);
    }

    const currentBalance = await getBalance({ entityId: orderId, state: currentState });
    if (currentBalance < amount) {
        throw new Error(`Insufficient funds in ${currentState} for refund. Available: ${currentBalance}, Requested: ${amount}`);
    }

    return await transitionMoneyState(orderId, currentState, MONEY_STATES.REFUND_PENDING, amount, {
        reason,
        entityType: 'order'
    }, transaction);
}

export async function finalizeRefund(orderId, amount, refundId, transaction = null) {
    const db = getAdminDb();

    // Idempotency check
    const existing = await db.collection(LEDGER_COLLECTION)
        .where("entityId", "==", orderId)
        .where("referenceId", "==", refundId)
        .where("state", "==", MONEY_STATES.REFUNDED)
        .get();

    if (!existing.empty) {
        console.log(`[Ledger] Refund ${refundId} already finalized. Skipping.`);
        return;
    }

    return await transitionMoneyState(orderId, MONEY_STATES.REFUND_PENDING, MONEY_STATES.REFUNDED, amount, {
        referenceId: refundId,
        entityType: 'order'
    }, transaction);
}

/**
 * Handle Disputes & Chargebacks
 * Instead of a new state, we move money to a 'FROZEN' flag in metadata
 * or move it out of custody back to SYSTEM/GATEWAY control.
 */
export async function recordDispute(orderId, amount, reason, currentState = MONEY_STATES.CAPTURED) {
    const entries = [
        {
            entityId: orderId,
            entityType: 'order',
            actorId: ACCOUNTS.SYSTEM,
            actorType: 'system',
            amount: -amount,
            currency: 'INR',
            state: currentState,
            description: `Dispute/Chargeback: ${reason} (Funds Frozen)`,
            metadata: { dispute: true, isFrozen: true, timestamp: new Date().toISOString() }
        },
        {
            entityId: orderId,
            entityType: 'order',
            actorId: ACCOUNTS.GATEWAY,
            actorType: 'system',
            amount: amount,
            currency: 'INR',
            state: currentState,
            description: `Money held by gateway due to dispute`,
            metadata: { dispute: true, isFrozen: true }
        }
    ];

    return await recordLedgerTransaction(entries);
}

/**
 * Get account balance for an entity/actor at a specific state
 */
export async function getBalance(filter = {}) {
    if (!isFirebaseConfigured()) return 0;

    const db = getAdminDb();
    let query = db.collection(LEDGER_COLLECTION);

    if (filter.entityId) query = query.where("entityId", "==", filter.entityId);
    if (filter.actorId) query = query.where("actorId", "==", filter.actorId);
    if (filter.state) query = query.where("state", "==", filter.state);

    const snapshot = await query.get();
    return snapshot.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);
}
