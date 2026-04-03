import { randomUUID, createHmac } from "node:crypto";
import { getRedisClient } from "./redis.js";

/**
 * THE C1RCLE - Surge Protection System (Core v2 - Production Hardened)
 */

const QUEUE_COLLECTION = "event_queues";
const SURGE_STATUS_COLLECTION = "event_surge_status";
const SURGE_METRICS_COLLECTION = "event_surge_metrics";
const AUDIT_LOGS_COLLECTION = "surge_audit_logs";

const ADMISSION_TTL_MINUTES = 10;
const ADMISSION_GRACE_PERIOD_SECONDS = 90;
const RETRY_WINDOW_SECONDS = 180;
const INACTIVITY_TIMEOUT_SECONDS = 60; // Increased for better server performance
const JOIN_COOLDOWN_SECONDS = 30; // Prevent loop spamming
const SECRET_KEY = process.env.QUEUE_SECRET_KEY || "c1rcle-surge-protection-2024";

// Surge Protection Thresholds
const RPS_THRESHOLD = 50; // Baseline for requests (views)
const CHECKOUT_RATE_THRESHOLD = 20; // Baseline for checkout initiations per minute

// Admission Tiers (Lanes)
export const QUEUE_TIERS = {
    LOYAL: "loyal",        // Verified attendees (high trust)
    AUTHENTICATED: "auth", // Logged in, new/low history
    ANONYMOUS: "guest"     // Not logged in
};

// Admission Ratios (e.g., 60% Loyal, 30% Auth, 10% Guest)
const ADMISSION_RATIO = {
    [QUEUE_TIERS.LOYAL]: 0.6,
    [QUEUE_TIERS.AUTHENTICATED]: 0.3,
    [QUEUE_TIERS.ANONYMOUS]: 0.1
};

/**
 * Join Queue with Guardrails
 */
export async function joinQueue(db, eventId, userId, deviceId, options = {}) {
    const now = new Date();
    const { tier = QUEUE_TIERS.ANONYMOUS, score = 0 } = options;

    // 1. One active membership per user/event (Anti-Hoarding)
    const existing = await db.collection(QUEUE_COLLECTION)
        .where("eventId", "==", eventId)
        .where("userId", "==", userId)
        .where("status", "in", ["waiting", "admitted", "payment_failed"])
        .limit(1)
        .get();

    if (!existing.empty) {
        const data = existing.docs[0].data();
        const docId = existing.docs[0].id;

        // Block if admitted and active
        if (data.status === "admitted" && new Date(data.expiresAt) > now) {
            return { id: docId, ...data };
        }

        // Cool-down check for repeat joiners (Anti-Loop)
        const updatedAt = data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt);
        if (data.status === "expired" && (now - updatedAt) < JOIN_COOLDOWN_SECONDS * 1000) {
            throw new Error(`Please wait ${JOIN_COOLDOWN_SECONDS}s before re-joining.`);
        }
    }

    const queueId = randomUUID();

    const queueEntry = {
        eventId,
        userId,
        deviceId,
        status: "waiting",
        tier,
        score, // Internal ranking within the tier
        joinedAt: now.toISOString(),
        lastActive: now.toISOString(),
        updatedAt: now.toISOString(),
        heartbeatCount: 0
    };

    await db.collection(QUEUE_COLLECTION).doc(queueId).set(queueEntry);

    return { id: queueId, ...queueEntry };
}

/**
 * Check Queue Status (Heartbeat Sensitive)
 */
export async function getQueueStatus(db, queueId) {
    const doc = await db.collection(QUEUE_COLLECTION).doc(queueId).get();
    if (!doc.exists) throw new Error("Queue entry not found");

    const data = doc.data();
    const now = new Date();
    const lastActive = data.lastActive?.toDate ? data.lastActive.toDate() : new Date(data.lastActive);

    // Dynamic timeout based on status
    const timeout = data.status === "admitted" ? ADMISSION_GRACE_PERIOD_SECONDS : INACTIVITY_TIMEOUT_SECONDS;

    if ((now - lastActive) > timeout * 1000 && !data.consumedAt) {
        const newStatus = data.status === "admitted" ? "abandoned" : "expired";
        await db.collection(QUEUE_COLLECTION).doc(queueId).update({ status: newStatus });
        return { status: newStatus };
    }

    // Calculate Position using Tier Lane Model
    if (data.status === "waiting") {
        const earlierSnapshot = await db.collection(QUEUE_COLLECTION)
            .where("eventId", "==", data.eventId)
            .where("status", "==", "waiting")
            .where("tier", "==", data.tier)
            .get();

        // Position within their specific lane
        let innerPosition = 1;
        earlierSnapshot.docs.forEach(d => {
            const docData = d.data();
            if (new Date(docData.joinedAt) < new Date(data.joinedAt)) {
                innerPosition++;
            }
        });

        await db.collection(QUEUE_COLLECTION).doc(queueId).update({
            lastActive: now.toISOString(),
            heartbeatCount: (data.heartbeatCount || 0) + 1
        });

        return { ...data, id: queueId, lanePosition: innerPosition };
    }

    return { ...data, id: queueId };
}

/**
 * Lane-Based Admission Logic
 * Prevents "Fast-Pass" from totally blocking guest lanes.
 */
export async function admitUsers(db, eventId, totalCount = 10, source = "system") {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ADMISSION_TTL_MINUTES * 60 * 1000);
    const admittedIds = [];

    // Calculate how many to admit from each lane
    const counts = {
        [QUEUE_TIERS.LOYAL]: Math.max(1, Math.floor(totalCount * ADMISSION_RATIO[QUEUE_TIERS.LOYAL])),
        [QUEUE_TIERS.AUTHENTICATED]: Math.max(1, Math.floor(totalCount * ADMISSION_RATIO[QUEUE_TIERS.AUTHENTICATED])),
        [QUEUE_TIERS.ANONYMOUS]: Math.max(0, totalCount - Math.max(1, Math.floor(totalCount * ADMISSION_RATIO[QUEUE_TIERS.LOYAL])) - Math.max(1, Math.floor(totalCount * ADMISSION_RATIO[QUEUE_TIERS.AUTHENTICATED])))
    };

    const batch = db.batch();

    for (const [tier, count] of Object.entries(counts)) {
        if (count <= 0) continue;
        const snapshot = await db.collection(QUEUE_COLLECTION)
            .where("eventId", "==", eventId)
            .where("status", "==", "waiting")
            .where("tier", "==", tier)
            .orderBy("joinedAt", "asc")
            .limit(count)
            .get();

        snapshot.docs.forEach(doc => {
            const token = generateAdmissionToken(eventId, doc.data().userId, doc.id);
            batch.update(doc.ref, {
                status: "admitted",
                admittedAt: now.toISOString(),
                lastActive: now.toISOString(),
                expiresAt: expiresAt.toISOString(),
                token
            });
            admittedIds.push(doc.id);
        });
    }

    if (admittedIds.length > 0) {
        await batch.commit();

        // Audit manual admits
        if (source !== "system") {
            await db.collection(AUDIT_LOGS_COLLECTION).add({
                eventId,
                action: "manual_admit",
                count: admittedIds.length,
                adminId: source,
                timestamp: now.toISOString()
            });
        }
    }

    return admittedIds.length;
}

/**
 * Standardized Analytics Definitions
 */
export async function getSurgeAnalytics(db, eventId) {
    const redis = getRedisClient();
    const metricsKey = `surge:metrics:${eventId}`;

    // Get real-time metrics from Redis
    const redisMetrics = await redis.hgetall(metricsKey);

    // Also fetch historical from DB for full funnel (since we haven't migrated persistent state yet)
    const metricsDocs = await db.collection(SURGE_METRICS_COLLECTION)
        .where("eventId", "==", eventId)
        .get();

    let totalViews = parseInt(redisMetrics.views || 0);
    let totalJoins = parseInt(redisMetrics.queue_join || 0);
    let totalCheckoutInitiates = parseInt(redisMetrics.checkout_initiate || 0);

    metricsDocs.docs.forEach(doc => {
        const data = doc.data();
        totalViews += (data.views || 0);
        totalJoins += (data.queue_join || 0);
        totalCheckoutInitiates += (data.checkout_initiate || 0);
    });

    const queueStats = await db.collection(QUEUE_COLLECTION)
        .where("eventId", "==", eventId)
        .get();

    const funnel = {
        total_demand: totalJoins + totalCheckoutInitiates,
        velocity: 0,
        conversion_stats: {
            admitted: 0,
            consumed: 0,
            abandoned_pre_reserve: 0,
            payment_failed: 0,
            stalled: 0
        }
    };

    queueStats.forEach(doc => {
        const d = doc.data();
        if (d.status === "consumed") funnel.conversion_stats.consumed++;
        if (d.status === "admitted") funnel.conversion_stats.admitted++;
        if (d.status === "waiting") funnel.conversion_stats.stalled++;
        if (d.status === "abandoned") funnel.conversion_stats.abandoned_pre_reserve++;
        if (d.status === "payment_failed") funnel.conversion_stats.payment_failed++;
    });

    return funnel;
}

export function generateAdmissionToken(eventId, userId, queueId) {
    const payload = `${eventId}:${userId}:${queueId}`;
    const signature = createHmac("sha256", SECRET_KEY).update(payload).digest("hex");
    return `${payload}:${signature}`;
}

export async function validateAdmission(db, eventId, userId, token) {
    if (!token) return false;
    const parts = token.split(":");
    if (parts.length !== 4) return false;

    const [tEventId, tUserId, tQueueId, tSignature] = parts;
    const payload = `${tEventId}:${tUserId}:${tQueueId}`;
    const expectedSignature = createHmac("sha256", SECRET_KEY).update(payload).digest("hex");

    if (tSignature !== expectedSignature) return false;
    if (tEventId !== eventId || (userId && tUserId !== userId)) return false;

    const doc = await db.collection(QUEUE_COLLECTION).doc(tQueueId).get();
    if (!doc.exists) return false;

    const data = doc.data();

    const isValidStatus = data.status === "admitted" || data.status === "payment_failed";
    if (!isValidStatus) return false;

    const now = new Date();
    const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
    const retryUntil = data.retryUntil ? (data.retryUntil.toDate ? data.retryUntil.toDate() : new Date(data.retryUntil)) : null;

    if (data.status === "payment_failed" && retryUntil && now > retryUntil) return false;
    if (data.status === "admitted" && now > expiresAt) return false;

    // Heartbeat update on validation
    await db.collection(QUEUE_COLLECTION).doc(tQueueId).update({ lastActive: now.toISOString() });

    return true;
}

export async function consumeAdmission(db, queueId) {
    await db.collection(QUEUE_COLLECTION).doc(queueId).update({
        status: "consumed",
        consumedAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
    });
}

export async function flagPaymentFailure(db, queueId) {
    const now = new Date();
    const retryUntil = new Date(now.getTime() + RETRY_WINDOW_SECONDS * 1000);

    await db.collection(QUEUE_COLLECTION).doc(queueId).update({
        status: "payment_failed",
        retryUntil: retryUntil.toISOString(),
        updatedAt: now.toISOString()
    });
}

/**
 * High-performance metric recording using Redis.
 * Uses Firestore as a secondary audit log every 100 increments.
 */
export async function recordSurgeMetric(db, eventId, type) {
    const redis = getRedisClient();
    const metricsKey = `surge:metrics:${eventId}`;
    const statusKey = `surge:status:${eventId}`;

    try {
        if (!redis || redis.status !== "ready") {
            return false;
        }

        // Atomic increment in Redis (Fast path)
        const newValue = await redis.hincrby(metricsKey, type, 1);

        // Background sync to Firestore for persistence (only every N hits to save costs)
        if (newValue % 50 === 0) {
            const now = new Date();
            const minuteKey = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}-${now.getUTCMinutes()}`;
            db.collection(SURGE_METRICS_COLLECTION).doc(`${eventId}_${minuteKey}`).set({
                eventId,
                minute: minuteKey,
                [type]: newValue,
                updatedAt: now.toISOString()
            }, { merge: true }).catch(err => console.error("Firestore Metric Sync Error:", err));
        }

        // Trigger surge check if not already in surge mode
        const cachedStatus = await redis.get(statusKey);
        if (cachedStatus !== "surge") {
            const views = await redis.hget(metricsKey, "views") || 0;
            const checkouts = await redis.hget(metricsKey, "checkout_initiate") || 0;
            return checkAndTriggerSurge(db, eventId, { views, checkout_initiate: checkouts });
        }

        return true;
    } catch (error) {
        console.warn("Redis Surge Metric Error:", error.message || error);
        return false;
    }
}

async function checkAndTriggerSurge(db, eventId, currentMetrics) {
    const views = parseInt(currentMetrics.views || 0);
    const checkouts = parseInt(currentMetrics.checkout_initiate || 0);
    const redis = getRedisClient();
    const statusKey = `surge:status:${eventId}`;

    const shouldSurge = views > RPS_THRESHOLD * 6 || checkouts > CHECKOUT_RATE_THRESHOLD;

    if (shouldSurge) {
        const surgeData = {
            status: "surge",
            reason: views > RPS_THRESHOLD * 6 ? "high_traffic" : "high_checkout_rate",
            triggeredAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            admitRate: 10
        };

        // Update Redis (Fast path for clients)
        await redis.set(statusKey, "surge", "EX", 300); // 5 minute TTL for surge mode
        await redis.set(`${statusKey}:data`, JSON.stringify(surgeData), "EX", 300);

        // Update Firestore (Source of truth)
        await db.collection(SURGE_STATUS_COLLECTION).doc(eventId).set(surgeData);
        return true;
    }
    return false;
}

export async function getSurgeStatus(db, eventId) {
    const redis = getRedisClient();
    const statusKey = `surge:status:${eventId}`;

    try {
        const cachedData = await redis.get(`${statusKey}:data`);
        if (cachedData) return JSON.parse(cachedData);

        // Fallback to Firestore and cache the result
        const doc = await db.collection(SURGE_STATUS_COLLECTION).doc(eventId).get();
        if (!doc.exists) return { status: "normal" };

        const data = doc.data();
        if (data.status === "surge") {
            await redis.set(statusKey, "surge", "EX", 60);
            await redis.set(`${statusKey}:data`, JSON.stringify(data), "EX", 60);
        }
        return data;
    } catch (err) {
        // Fail-safe to normal
        return { status: "normal" };
    }
}
