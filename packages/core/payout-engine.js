import { getAdminDb } from "./admin.js";
import {
    MONEY_STATES,
    transitionMoneyState,
    allocateToPayable,
    recordPayout,
    ACCOUNTS
} from "./ledger-engine.js";

/**
 * THE C1RCLE - Payout Engine
 * Responsible for settling event revenue and distributing to partners.
 */

/**
 * Automates settlement for an event.
 * 1. Moves all HELD orders to SETTLED.
 * 2. Calculates splits.
 * 3. Allocates to PAYABLE.
 */
export async function settleEvent(eventId) {
    const db = getAdminDb();
    const eventRef = db.collection("events").doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) throw new Error("Event not found");
    const event = eventDoc.data();

    // MANDATORY ELIGIBILITY CHECKS
    if (event.lifecycle !== 'completed') {
        throw new Error(`Event ${eventId} is not in COMPLETED state. Current: ${event.lifecycle}`);
    }

    // Check for audit block (if we have an audit log status)
    if (event.settlementStatus === 'blocked') {
        throw new Error(`Settlement is BLOCKED for event ${eventId} due to audit flags.`);
    }

    // 1. Get all confirmed orders for this event
    const ordersSnapshot = await db.collection("orders")
        .where("eventId", "==", eventId)
        .where("status", "==", "confirmed")
        .get();

    const orders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    let processedCount = 0;

    for (const order of orders) {
        // Deterministic check: Skip if already settled or contested
        if (order.ledgerState === MONEY_STATES.SETTLED) continue;

        try {
            await db.runTransaction(async (transaction) => {
                // Fetch latest ledger state to ensure no dispute
                const ledgerSnapshot = await transaction.get(
                    db.collection("ledger_entries")
                        .where("entityId", "==", order.id)
                        .where("metadata.isFrozen", "==", true)
                );

                if (!ledgerSnapshot.empty) {
                    console.log(`[PayoutEngine] Skipping frozen order: ${order.id}`);
                    return;
                }

                // Move to SETTLED
                await transitionMoneyState(order.id, MONEY_STATES.HELD, MONEY_STATES.SETTLED, order.totalAmount, {
                    entityType: 'order',
                    eventId: eventId
                }, transaction);

                // Calculate splits for this order
                const splits = calculateOrderSplits(order, event);

                // Distribute to PAYABLE (writes explicit split entries)
                await allocateToPayable(order, splits, transaction);

                // Mark order as settled in its own document for fast lookups
                transaction.update(db.collection("orders").doc(order.id), {
                    ledgerState: MONEY_STATES.SETTLED,
                    settledAt: new Date().toISOString()
                });
            });

            processedCount++;
        } catch (err) {
            console.error(`[PayoutEngine] Failed to settle order ${order.id}:`, err.message);
        }
    }

    return { processedCount, totalOrders: orders.length };
}

export async function getEligibleEventsForSettlement(options = {}) {
    const {
        minDaysSinceCompletion = 3, // Default T+3 for refund window
        limit = 20
    } = options;

    const db = getAdminDb();
    const now = new Date();
    const threshold = new Date(now.getTime() - minDaysSinceCompletion * 24 * 60 * 60 * 1000).toISOString();

    const snapshot = await db.collection("events")
        .where("lifecycle", "==", "completed")
        .where("updatedAt", "<=", threshold)
        .where("settlementStatus", "==", "pending")
        .limit(limit)
        .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Internal logic to determine who gets what from an order
 */
function calculateOrderSplits(order, event) {
    const total = Number(order.totalAmount);
    if (total === 0) return [];

    const splits = [];
    let remaining = total;

    // 1. Promoter Commission
    if (order.promoterLinkId) {
        // Commission logic: In Phase 1, we might have a fixed commission or percentage
        // For now, let's assume 10% or use attribution details if present
        const commissionAmount = order.promoterAttribution?.commissionAmount || Math.round(total * 0.1);
        if (commissionAmount > 0) {
            splits.push({
                actorId: order.promoterAttribution?.promoterId || 'UNKNOWN_PROMOTER',
                actorType: 'promoter',
                amount: Math.min(commissionAmount, remaining),
                description: `Promoter Commission for ${order.id}`
            });
            remaining -= splits[splits.length - 1].amount;
        }
    }

    // 2. Platform Fee (THE C1RCLE)
    const platformFeePercent = 0.05; // 5% flat fee
    const platformFee = Math.round(total * platformFeePercent);
    splits.push({
        actorId: ACCOUNTS.PLATFORM_FEE,
        actorType: 'system',
        amount: Math.min(platformFee, remaining),
        description: `Platform Service Fee (5%)`
    });
    remaining -= splits[splits.length - 1].amount;

    // 3. Partner Revenue (Host & Club)
    // Partnership logic: If Host created, they might split with Club.
    // Default: Club gets 70% of what's left, Host gets 30%.
    // If Club event: Club gets 100% of what's left.

    const isHostEvent = event.creatorRole === 'host';
    const venueId = event.venueId || event.clubId;
    const hostId = event.creatorId;

    if (isHostEvent && hostId && venueId) {
        const hostShare = Math.round(remaining * 0.3);
        const clubShare = remaining - hostShare;

        splits.push({
            actorId: hostId,
            actorType: 'host',
            amount: hostShare,
            description: `Host Revenue Share (30% of Net)`
        });

        splits.push({
            actorId: venueId,
            actorType: 'venue',
            amount: clubShare,
            description: `Club Revenue Share (70% of Net)`
        });
    } else {
        // Club Event or direct
        const finalId = venueId || hostId || 'UNKNOWN_PARTNER';
        splits.push({
            actorId: finalId,
            actorType: event.creatorRole || 'venue',
            amount: remaining,
            description: `Final Revenue Settlement`
        });
    }

    return splits;
}

/**
 * Batch Payout Execution
 */
export async function processPartnerPayout(partnerId, partnerType) {
    const db = getAdminDb();

    // 1. Calculate how much is PAYABLE for this partner
    const ledgerSnapshot = await db.collection("ledger_entries")
        .where("actorId", "==", partnerId)
        .where("state", "==", MONEY_STATES.PAYABLE)
        .get();

    const payableBalance = ledgerSnapshot.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);

    if (payableBalance <= 0) {
        return { message: "No funds available for payout", amount: 0 };
    }

    // 2. record payout in ledger
    const payoutId = `PAYOUT-${randomUUID().substring(0, 8).toUpperCase()}`;
    const bankRef = `BANK-${randomUUID().substring(0, 12).toUpperCase()}`;

    await recordPayout(payoutId, partnerId, partnerType, payableBalance, bankRef);

    // 3. Create a payout record for tracking
    await db.collection("payouts").doc(payoutId).set({
        id: payoutId,
        partnerId,
        partnerType,
        amount: payableBalance,
        status: "completed",
        bankReference: bankRef,
        timestamp: new Date().toISOString()
    });

    return { payoutId, amount: payableBalance, reference: bankRef };
}
