import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import * as surgeCore from "@c1rcle/core";

const LOYALTY_LOOKBACK_DAYS = 120;

export async function joinQueue(eventId, userId, deviceId) {
    if (!isFirebaseConfigured()) {
        return { id: "mock-queue-id", position: 1, status: "admitted", token: "mock-token" };
    }

    const db = getAdminDb();
    let tier = surgeCore.QUEUE_TIERS.ANONYMOUS;
    let score = 0;

    if (userId && userId !== 'anonymous') {
        tier = surgeCore.QUEUE_TIERS.AUTHENTICATED;

        try {
            const now = new Date();
            const lookbackDate = new Date(now.getTime() - (LOYALTY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000));

            // 1. Fetch relevant orders for loyalty scoring
            // We look for orders that were finalized (confirmed/attended)
            const ordersSnapshot = await db.collection("orders")
                .where("userId", "==", userId)
                .where("createdAt", ">=", lookbackDate.toISOString())
                .get();

            let attendedCount = 0;
            let refundCount = 0;
            let noShowCount = 0;

            ordersSnapshot.docs.forEach(doc => {
                const order = doc.data();
                if (order.status === "confirmed") {
                    // Check if they actually checked in (Entry is the ultimate truth)
                    // We assume tickets have a status or the order has a 'checkedIn' flag
                    if (order.checkedIn || order.tickets?.some(t => t.status === 'checked_in')) {
                        attendedCount++;
                    } else {
                        // Past event but no check-in?
                        const eventDate = new Date(order.eventDate);
                        if (eventDate < now) {
                            noShowCount++;
                        }
                    }
                } else if (order.status === "refunded") {
                    refundCount++;
                }
            });

            // 2. Score Calculation
            score = (attendedCount * 100);
            score -= (refundCount * 50);
            score -= (noShowCount * 30);

            // 3. Promote to LOYAL tier if they have at least 2 attended events and positive score
            if (attendedCount >= 2 && score > 0) {
                tier = surgeCore.QUEUE_TIERS.LOYAL;
            }

            // 4. Verification Bonus
            const userDoc = await db.collection("users").doc(userId).get();
            if (userDoc.exists && userDoc.data().emailVerified) {
                score += 50;
            }

            // 5. Bot Mitigation: Account Age
            if (userDoc.exists) {
                const createdAt = userDoc.data().createdAt?.toDate ? userDoc.data().createdAt.toDate() : new Date(userDoc.data().createdAt);
                const accountAgeHours = (now - createdAt) / (1000 * 60 * 60);
                if (accountAgeHours < 24) {
                    score = Math.floor(score * 0.5); // New account penalty
                }
            }

        } catch (err) {
            console.error("[QueueStore] Failed to calculate loyalty score:", err);
            // Fallback to base authenticated tier with score 0
        }
    }

    return surgeCore.joinQueue(db, eventId, userId, deviceId, { tier, score });
}

export async function getQueueStatus(queueId) {
    if (!isFirebaseConfigured()) {
        return { status: "admitted", position: 0, token: "mock-token" };
    }
    return surgeCore.getQueueStatus(getAdminDb(), queueId);
}

export async function admitUsers(eventId, count = 10, source = "system") {
    if (!isFirebaseConfigured()) return 0;
    return surgeCore.admitUsers(getAdminDb(), eventId, count, source);
}

export async function validateAdmission(eventId, userId, token) {
    if (!isFirebaseConfigured()) return true;
    return surgeCore.validateAdmission(getAdminDb(), eventId, userId, token);
}

export async function consumeAdmission(queueId) {
    if (!isFirebaseConfigured()) return;
    return surgeCore.consumeAdmission(getAdminDb(), queueId);
}

export async function flagPaymentFailure(queueId) {
    if (!isFirebaseConfigured()) return;
    return surgeCore.flagPaymentFailure(getAdminDb(), queueId);
}
