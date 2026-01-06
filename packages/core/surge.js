import { randomUUID, createHmac } from "node:crypto";

/**
 * THE C1RCLE - Surge Protection System (Core)
 * Location: packages/core/surge.js
 */

const QUEUE_COLLECTION = "event_queues";
const SURGE_STATUS_COLLECTION = "event_surge_status";
const SURGE_METRICS_COLLECTION = "event_surge_metrics";

const ADMISSION_TTL_MINUTES = 5;
const INACTIVITY_TIMEOUT_SECONDS = 30;
const SECRET_KEY = process.env.QUEUE_SECRET_KEY || "c1rcle-surge-protection-2024";

// Thresholds
const RPS_THRESHOLD = 50;
const CHECKOUT_RATE_THRESHOLD = 20;

/**
 * Join the waiting room for an event
 */
export async function joinQueue(db, eventId, userId, deviceId) {
    const now = new Date();

    // Check for existing active entry
    const existing = await db.collection(QUEUE_COLLECTION)
        .where("eventId", "==", eventId)
        .where("userId", "==", userId)
        .where("status", "in", ["waiting", "admitted"])
        .limit(1)
        .get();

    if (!existing.empty) {
        const data = existing.docs[0].data();
        const docId = existing.docs[0].id;

        if (data.status === "admitted" && new Date(data.expiresAt) > now) {
            return { id: docId, ...data };
        }

        const lastActive = data.lastActive?.toDate ? data.lastActive.toDate() : new Date(data.lastActive);
        if (data.status === "waiting" && (now - lastActive) < INACTIVITY_TIMEOUT_SECONDS * 1000) {
            return { id: docId, ...data };
        }
    }

    const queueSnapshot = await db.collection(QUEUE_COLLECTION)
        .where("eventId", "==", eventId)
        .where("status", "==", "waiting")
        .count()
        .get();

    const position = queueSnapshot.data().count + 1;
    const queueId = randomUUID();

    const queueEntry = {
        eventId,
        userId,
        deviceId,
        status: "waiting",
        position,
        joinedAt: now.toISOString(),
        lastActive: now.toISOString(),
        updatedAt: now.toISOString()
    };

    await db.collection(QUEUE_COLLECTION).doc(queueId).set(queueEntry);

    return { id: queueId, ...queueEntry };
}

/**
 * Check queue status
 */
export async function getQueueStatus(db, queueId) {
    const doc = await db.collection(QUEUE_COLLECTION).doc(queueId).get();
    if (!doc.exists) throw new Error("Queue entry not found");

    const data = doc.data();
    const now = new Date();

    if (data.status === "waiting") {
        const lastActive = data.lastActive?.toDate ? data.lastActive.toDate() : new Date(data.lastActive);
        if ((now - lastActive) > INACTIVITY_TIMEOUT_SECONDS * 1000) {
            await db.collection(QUEUE_COLLECTION).doc(queueId).update({ status: "expired" });
            return { status: "expired" };
        }

        const earlierSnapshot = await db.collection(QUEUE_COLLECTION)
            .where("eventId", "==", data.eventId)
            .where("status", "==", "waiting")
            .where("joinedAt", "<", data.joinedAt)
            .count()
            .get();

        const currentPosition = earlierSnapshot.data().count + 1;

        await db.collection(QUEUE_COLLECTION).doc(queueId).update({
            lastActive: now.toISOString(),
            position: currentPosition
        });

        return { ...data, id: queueId, position: currentPosition };
    }

    return { ...data, id: queueId };
}

/**
 * Admit a batch of users
 */
export async function admitUsers(db, eventId, count = 10) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ADMISSION_TTL_MINUTES * 60 * 1000);

    const waitingSnapshot = await db.collection(QUEUE_COLLECTION)
        .where("eventId", "==", eventId)
        .where("status", "==", "waiting")
        .orderBy("joinedAt", "asc")
        .limit(count)
        .get();

    if (waitingSnapshot.empty) return 0;

    const batch = db.batch();
    waitingSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const token = generateAdmissionToken(data.eventId, data.userId, doc.id);
        batch.update(doc.ref, {
            status: "admitted",
            admittedAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
            token
        });
    });

    await batch.commit();
    return waitingSnapshot.size;
}

/**
 * Validate admission token
 */
export async function validateAdmission(db, eventId, userId, token) {
    if (!token) return false;
    const parts = token.split(":");
    if (parts.length !== 4) return false;

    const [tEventId, tUserId, tQueueId, tSignature] = parts;
    const payload = `${tEventId}:${tUserId}:${tQueueId}`;
    const expectedSignature = createHmac("sha256", SECRET_KEY).update(payload).digest("hex");

    if (tSignature !== expectedSignature) return false;
    if (tEventId !== eventId || tUserId !== userId) return false;

    const doc = await db.collection(QUEUE_COLLECTION).doc(tQueueId).get();
    if (!doc.exists) return false;

    const data = doc.data();
    if (data.status !== "admitted") return false;

    const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
    if (new Date() > expiresAt) return false;

    return true;
}

/**
 * Consume/Convert token
 */
export async function consumeAdmission(db, queueId) {
    await db.collection(QUEUE_COLLECTION).doc(queueId).update({
        status: "consumed",
        consumedAt: new Date().toISOString()
    });
}

/**
 * Surge Logic
 */
export async function recordSurgeMetric(db, eventId, type) {
    const now = new Date();
    const minuteKey = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}-${now.getUTCMinutes()}`;
    const metricRef = db.collection(SURGE_METRICS_COLLECTION).doc(`${eventId}_${minuteKey}`);

    const doc = await metricRef.get();
    const data = doc.exists ? doc.data() : {};

    await metricRef.set({
        eventId,
        minute: minuteKey,
        [type]: (data[type] || 0) + 1,
        updatedAt: now.toISOString()
    }, { merge: true });

    return checkAndTriggerSurge(db, eventId, { ...data, [type]: (data[type] || 0) + 1 });
}

async function checkAndTriggerSurge(db, eventId, currentMetrics) {
    const views = currentMetrics.views || 0;
    const checkouts = currentMetrics.checkout_initiate || 0;

    const shouldSurge = views > RPS_THRESHOLD * 6 || checkouts > CHECKOUT_RATE_THRESHOLD;
    const statusRef = db.collection(SURGE_STATUS_COLLECTION).doc(eventId);
    const statusDoc = await statusRef.get();
    const status = statusDoc.exists ? statusDoc.data() : { status: "normal" };

    if (shouldSurge && status.status === "normal") {
        await statusRef.set({
            status: "surge",
            reason: views > RPS_THRESHOLD * 6 ? "high_traffic" : "high_checkout_rate",
            triggeredAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            admitRate: 10
        });
        return true;
    }
    return status.status === "surge";
}

export async function getSurgeStatus(db, eventId) {
    const doc = await db.collection(SURGE_STATUS_COLLECTION).doc(eventId).get();
    if (!doc.exists) return { status: "normal" };
    return doc.data();
}

export function generateAdmissionToken(eventId, userId, queueId) {
    const payload = `${eventId}:${userId}:${queueId}`;
    const signature = createHmac("sha256", SECRET_KEY).update(payload).digest("hex");
    return `${payload}:${signature}`;
}
