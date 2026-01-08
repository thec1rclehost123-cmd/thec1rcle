import { getAdminDb } from "../firebase/admin";
import { ENTITLEMENT_STATES } from "@c1rcle/core/entitlement-engine";
import { MONEY_STATES } from "@c1rcle/core/ledger-engine";

/**
 * THE C1RCLE Analytics Rollup Engine
 * Responsible for idempotent aggregation of truth logs into scale-safe buckets.
 */

const ROLLUP_COLLECTIONS = {
    EVENT: "event_analytics_rollup",
    CLUB: "venue_analytics_rollup",
    HOST: "host_analytics_rollup",
    PROMOTER: "promoter_analytics_rollup",
    GATE: "gate_ops_rollup",
    SURGE: "surge_analytics_rollup"
};

const BUCKET_TYPES = {
    LIVE: "5m",
    HOURLY: "1h",
    NIGHT: "night",
    DAILY: "1d"
};

/**
 * Compute and persist rollups for an event for a specific time window.
 * This is the workhorse of the engine.
 */
export async function computeEventRollup(eventId, options = {}) {
    const db = getAdminDb();
    const {
        startTime,
        endTime,
        bucketType = BUCKET_TYPES.HOURLY,
        forceRecompute = false
    } = options;

    // 1. Generate Bucket ID (idempotency key)
    // Format: EVT_{eventId}_{bucketType}_{startTime_timestamp}
    const bucketStart = new Date(startTime);
    const rollupId = `ROLLUP_EVT_${eventId}_${bucketType}_${bucketStart.getTime()}`;

    // 2. Check if already exists unless forced
    if (!forceRecompute) {
        const existing = await db.collection(ROLLUP_COLLECTIONS.EVENT).doc(rollupId).get();
        if (existing.exists) return existing.data();
    }

    // 3. Fetch Raw Truth in Window
    const [entitlements, ledger, scans, queue] = await Promise.all([
        fetchEntitlements(db, eventId, startTime, endTime),
        fetchLedger(db, eventId, startTime, endTime),
        fetchScans(db, eventId, startTime, endTime),
        fetchQueue(db, eventId, startTime, endTime)
    ]);

    // 4. Compute Metrics
    const metrics = {
        gross_revenue: ledger.filter(l => l.state === MONEY_STATES.CAPTURED && l.amount > 0).reduce((s, l) => s + l.amount, 0),
        refunds: ledger.filter(l => l.state === MONEY_STATES.REFUNDED).reduce((s, l) => s + Math.abs(l.amount), 0),
        entries: entitlements.filter(e => e.state === ENTITLEMENT_STATES.CONSUMED && e.consumedAt >= startTime && e.consumedAt <= endTime).length,
        issued: entitlements.length, // This might be total, usually you query total issued up to endTime
        denied_scans: scans.filter(s => s.result === 'DENIED').length,
        granted_scans: scans.filter(s => s.result === 'GRANTED').length,
        demand_joins: queue.length,
        conversions: queue.filter(q => q.status === "consumed").length
    };

    // 5. Build Rollup Doc
    const rollupDoc = {
        id: rollupId,
        entityId: eventId,
        type: 'event',
        bucketType,
        bucketStartIST: startTime,
        bucketEndIST: endTime,
        metrics,
        sourceCounts: {
            entitlements: entitlements.length,
            ledger: ledger.length,
            scans: scans.length,
            queue: queue.length
        },
        computedAt: new Date().toISOString(),
        version: "v1"
    };

    // 6. Write to DB
    await db.collection(ROLLUP_COLLECTIONS.EVENT).doc(rollupId).set(rollupDoc);

    return rollupDoc;
}

/**
 * Backfill logic for an entire event
 */
export async function backfillEventAnalytics(eventId) {
    const db = getAdminDb();
    const eventDoc = await db.collection("events").doc(eventId).get();
    if (!eventDoc.exists) throw new Error("Event not found");

    const event = eventDoc.data();
    const start = new Date(event.startDate);
    const end = new Date(event.endDate || new Date(start.getTime() + 12 * 60 * 60 * 1000)); // Default 12h

    // Adjust to night window if needed (6PM - 6AM)
    // For now, let's create hourly buckets
    let current = new Date(start.getTime() - 2 * 60 * 60 * 1000); // 2h before
    const finalEnd = new Date(end.getTime() + 4 * 60 * 60 * 1000); // 4h after

    const results = [];
    while (current < finalEnd) {
        const bucketEnd = new Date(current.getTime() + 60 * 60 * 1000); // 1h
        results.push(await computeEventRollup(eventId, {
            startTime: current.toISOString(),
            endTime: bucketEnd.toISOString(),
            bucketType: BUCKET_TYPES.HOURLY,
            forceRecompute: true
        }));
        current = bucketEnd;
    }

    // Also compute a single 'NIGHT' rollup
    results.push(await computeEventRollup(eventId, {
        startTime: start.toISOString(),
        endTime: finalEnd.toISOString(),
        bucketType: BUCKET_TYPES.NIGHT,
        forceRecompute: true
    }));

    return results;
}

/**
 * RAW FETCHERS (Strict Truth Only)
 */

async function fetchEntitlements(db, eventId, start, end) {
    // Note: Entitlements are often issued before the window, 
    // but consumed within the window.
    const snapshot = await db.collection("entitlements")
        .where("eventId", "==", eventId)
        .get();
    return snapshot.docs.map(doc => doc.data());
}

async function fetchLedger(db, eventId, start, end) {
    const snapshot = await db.collection("ledger_entries")
        .where("metadata.eventId", "==", eventId)
        .where("timestamp", ">=", start)
        .where("timestamp", "<=", end)
        .get();
    return snapshot.docs.map(doc => doc.data());
}

async function fetchScans(db, eventId, start, end) {
    const snapshot = await db.collection("scan_ledger")
        .where("eventId", "==", eventId)
        .where("timestamp", ">=", start)
        .where("timestamp", "<=", end)
        .get();
    return snapshot.docs.map(doc => doc.data());
}

async function fetchQueue(db, eventId, start, end) {
    const snapshot = await db.collection("event_queues")
        .where("eventId", "==", eventId)
        .where("joinedAt", ">=", start)
        .where("joinedAt", "<=", end)
        .get();
    return snapshot.docs.map(doc => doc.data());
}

/**
 * RECONCILIATION & FETCHING
 */

export async function getLatestRollup(entityId, bucketType = "night") {
    const db = getAdminDb();
    const snapshot = await db.collection("event_analytics_rollup")
        .where("entityId", "==", entityId)
        .where("bucketType", "==", bucketType)
        .orderBy("bucketStartIST", "desc")
        .limit(1)
        .get();

    if (snapshot.empty) return null;
    return snapshot.docs[0].data();
}

