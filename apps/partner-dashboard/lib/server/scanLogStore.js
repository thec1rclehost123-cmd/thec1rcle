/**
 * Scan Log Store — reads from scan_logs/{eventId} and scanner_sessions/{eventId}
 *
 * Real-time data (summary, devices, stream) is fetched here for SSR prefetch.
 * The client uses Firestore onSnapshot directly for live updates.
 */

import { getAdminDb } from '../firebase/admin';
export { getGuestRules } from './guestListStore.js';

const DEVICE_ONLINE_THRESHOLD_SECS = 90;

/**
 * Get the scanner session summary for an event.
 */
export async function getScannerSummary(eventId) {
    const db = getAdminDb();
    const [sessionDoc, summaryDoc] = await Promise.all([
        db.collection('scanner_sessions').doc(eventId).get(),
        db.collection('scan_logs').doc(eventId).get(),
    ]);

    const now = Date.now();
    const threshold = new Date(now - DEVICE_ONLINE_THRESHOLD_SECS * 1000).toISOString();

    // Count online devices
    const devicesSnap = await db.collection('scanner_sessions').doc(eventId).collection('devices')
        .where('lastHeartbeat', '>=', threshold)
        .get();

    const sessionData = sessionDoc.exists ? sessionDoc.data() : {};
    const summaryData = summaryDoc.exists ? summaryDoc.data() : {};

    return {
        eventId,
        doorStatus: sessionData.doorStatus || 'open',
        sessionStartedAt: sessionData.sessionStartedAt || null,
        lastActivityAt: sessionData.lastActivityAt || null,
        totalScans: summaryData.totalScans || 0,
        validScans: summaryData.checkedIn || 0,
        duplicateScans: summaryData.duplicateScans || 0,
        invalidScans: summaryData.invalidScans || 0,
        manualCheckIns: summaryData.manualCheckIns || 0,
        activeDeviceCount: devicesSnap.size,
    };
}

/**
 * Get all scanner devices for an event.
 */
export async function getScannerDevices(eventId) {
    const db = getAdminDb();
    const snap = await db.collection('scanner_sessions').doc(eventId).collection('devices').get();
    const now = Date.now();
    const threshold = new Date(now - DEVICE_ONLINE_THRESHOLD_SECS * 1000).toISOString();

    return snap.docs.map(doc => {
        const data = doc.data();
        return {
            deviceId: doc.id,
            ...data,
            isOnline: data.lastHeartbeat >= threshold,
        };
    });
}

/**
 * Get recent scan events for the live stream (SSR prefetch, 100 newest).
 */
export async function getScanStream(eventId, limit = 100) {
    const db = getAdminDb();
    const snap = await db.collection('scan_logs').doc(eventId).collection('scans')
        .orderBy('scannedAt', 'desc')
        .limit(Math.min(Number(limit), 100))
        .get();

    return snap.docs.map(doc => ({ scanId: doc.id, ...doc.data() }));
}

/**
 * Get the KPI summary document (used for SSR prefetch of overview page).
 */
export async function getGuestOpsSummary(eventId, venueId) {
    const db = getAdminDb();

    const [summaryDoc, rulesDoc, eventDoc] = await Promise.all([
        db.collection('scan_logs').doc(eventId).get(),
        db.collection('event_guest_rules').doc(eventId).get(),
        db.collection('events').doc(eventId).get(),
    ]);

    const summary = summaryDoc.exists ? summaryDoc.data() : {};
    const rules = rulesDoc.exists ? rulesDoc.data() : {};
    const event = eventDoc.exists ? { id: eventDoc.id, ...eventDoc.data() } : {};

    // Count online devices for initial render
    const threshold = new Date(Date.now() - DEVICE_ONLINE_THRESHOLD_SECS * 1000).toISOString();
    const devSnap = await db.collection('scanner_sessions').doc(eventId).collection('devices')
        .where('lastHeartbeat', '>=', threshold)
        .get();

    // Count denied and flagged from override logs (approximate — summary not cached separately)
    const overrideSnap = await db.collection('guest_override_logs').doc(eventId).collection('items')
        .where('action', 'in', ['deny_entry', 'flag_guest'])
        .get();
    const denied = overrideSnap.docs.filter(d => d.data().action === 'deny_entry').length;
    const flagged = overrideSnap.docs.filter(d => d.data().action === 'flag_guest').length;

    // Entry window: cutoff not passed
    let entryWindowOpen = true;
    if (rules.entryCutoffEnabled && rules.entryCutoffTime) {
        entryWindowOpen = new Date() < new Date(rules.entryCutoffTime);
    }

    const checkedIn = summary.checkedIn || 0;
    const totalExpected = summary.totalExpected || 0;

    return {
        eventId,
        eventTitle: event.title || '',
        eventDate: event.startDate || '',
        eventStatus: event.lifecycle || event.status || '',
        doorStatus: rules.doorStatus || summary.doorStatus || 'open',
        kpis: {
            totalExpected,
            ticketedGuests: summary.ticketedGuests || 0,
            guestListGuests: summary.guestListGuests || 0,
            vipGuests: summary.vipGuests || 0,
            compGuests: summary.compGuests || 0,
            tableGuests: summary.tableGuests || 0,
            checkedIn,
            notArrived: Math.max(0, totalExpected - checkedIn),
            denied,
            flagged,
            duplicateScans: summary.duplicateScans || 0,
            invalidScans: summary.invalidScans || 0,
            manualCheckIns: summary.manualCheckIns || 0,
            onlineDevices: devSnap.size,
            scanRatePer5min: 0, // computed client-side from stream
        },
        isLocked: rules.isLocked || false,
        entryWindowOpen,
    };
}

/**
 * Get guest rules for an event.
 */
export async function getGuestRules(eventId) {
    const db = getAdminDb();
    const doc = await db.collection('event_guest_rules').doc(eventId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

/**
 * Get open exceptions for an event.
 * @param {string} eventId
 * @param {{ status?: string, type?: string }} options
 */
export async function getExceptions(eventId, { status = 'open', type } = {}) {
    const db = getAdminDb();
    let query = db.collection('event_guest_exceptions').doc(eventId).collection('items');

    if (status !== 'all') {
        query = query.where('status', '==', status);
    }
    if (type) {
        query = query.where('type', '==', type);
    }

    const snap = await query.orderBy('triggeredAt', 'desc').limit(100).get();
    const exceptions = snap.docs.map(doc => ({ exceptionId: doc.id, ...doc.data() }));
    const openCount = status === 'all'
        ? exceptions.filter(e => e.status === 'open').length
        : exceptions.length;

    return { exceptions, openCount };
}

/**
 * Resolve an exception.
 */
export async function resolveException(eventId, exceptionId, actor, { action, reason, notes }) {
    const db = getAdminDb();
    const ref = db.collection('event_guest_exceptions').doc(eventId).collection('items').doc(exceptionId);
    const doc = await ref.get();
    if (!doc.exists) throw { code: 'NOT_FOUND', message: 'Exception not found' };
    const exc = doc.data();
    if (exc.isLocked) throw { code: 'EVENT_LOCKED', message: 'Event is locked — exceptions cannot be modified' };
    if (exc.status !== 'open') throw { code: 'ALREADY_RESOLVED', message: 'Exception is already resolved' };

    const now = new Date().toISOString();
    await ref.update({
        status: action === 'escalated' ? 'escalated' : action === 'dismissed' ? 'dismissed' : 'resolved',
        resolution: {
            resolvedBy: actor.uid,
            resolvedByName: actor.name || '',
            resolvedAt: now,
            action,
            reason: reason || '',
            notes: notes || '',
        },
    });

    // Write override log
    const { writeOverrideLog } = await import('./guestOpsMiddleware.js');
    await writeOverrideLog(db, {
        eventId, venueId: exc.venueId,
        action: 'resolve_exception', actorUid: actor.uid, actorName: actor.name, actorRole: actor.role,
        targetGuestId: exc.guestId || '',
        targetGuestName: exc.guestDisplayName || '',
        reason, metadata: { exceptionType: exc.type, resolutionAction: action },
    });
}

/**
 * Get host and promoter allocations for an event.
 */
export async function getAllocations(eventId) {
    const db = getAdminDb();
    const [hostsSnap, promotersSnap] = await Promise.all([
        db.collection('event_guest_allocations').doc(eventId).collection('hosts').get(),
        db.collection('event_guest_allocations').doc(eventId).collection('promoters').get(),
    ]);

    const hosts = hostsSnap.docs.map(doc => ({ hostId: doc.id, ...doc.data() }));
    const promoters = promotersSnap.docs.map(doc => ({ promoterId: doc.id, ...doc.data() }));
    return { hosts, promoters };
}

/**
 * Upsert a host allocation cap.
 */
export async function upsertHostAllocation(eventId, hostId, { allocatedCount, notes }, actor) {
    const db = getAdminDb();
    const ref = db.collection('event_guest_allocations').doc(eventId).collection('hosts').doc(hostId);
    const doc = await ref.get();
    const existing = doc.exists ? doc.data() : { usedCount: 0 };

    if (allocatedCount < (existing.usedCount || 0)) {
        throw { code: 'BELOW_USED_COUNT', message: `Cannot set allocation below already-used count (${existing.usedCount})` };
    }

    const now = new Date().toISOString();
    await ref.set({
        hostId,
        allocatedCount: Number(allocatedCount),
        usedCount: existing.usedCount || 0,
        remaining: Number(allocatedCount) - (existing.usedCount || 0),
        notes: notes || null,
        setByUid: actor.uid,
        setAt: existing.setAt || now,
        updatedAt: now,
    }, { merge: true });
}

/**
 * Upsert a promoter allocation cap.
 */
export async function upsertPromoterAllocation(eventId, promoterId, { allocatedCount, notes }, actor) {
    const db = getAdminDb();
    const ref = db.collection('event_guest_allocations').doc(eventId).collection('promoters').doc(promoterId);
    const doc = await ref.get();
    const existing = doc.exists ? doc.data() : { usedCount: 0 };

    if (allocatedCount < (existing.usedCount || 0)) {
        throw { code: 'BELOW_USED_COUNT', message: `Cannot set allocation below already-used count (${existing.usedCount})` };
    }

    const now = new Date().toISOString();
    await ref.set({
        promoterId,
        allocatedCount: Number(allocatedCount),
        usedCount: existing.usedCount || 0,
        remaining: Number(allocatedCount) - (existing.usedCount || 0),
        notes: notes || null,
        setByUid: actor.uid,
        setAt: existing.setAt || now,
        updatedAt: now,
    }, { merge: true });
}

/**
 * Update event guest rules.
 */
export async function updateGuestRules(eventId, venueId, updates, actor) {
    const db = getAdminDb();
    const ref = db.collection('event_guest_rules').doc(eventId);
    const now = new Date().toISOString();

    const safeUpdates = {};
    const allowed = [
        'entryCutoffEnabled', 'entryCutoffTime', 'reEntryEnabled', 'reEntryWindowMins',
        'minimumAgeRule', 'dressCodNote', 'compApprovalRequired', 'vipApprovalRequired',
        'manualAddCap', 'staffAddCap', 'manualCheckInEnabled', 'manualOverrideRequiresReason',
        'exportEnabled', 'exportFormat', 'exportPiiLevel', 'doorStatus',
    ];
    for (const key of allowed) {
        if (updates[key] !== undefined) safeUpdates[key] = updates[key];
    }

    // staffAddCap must be <= manualAddCap
    const manualCap = safeUpdates.manualAddCap ?? (await ref.get()).data()?.manualAddCap ?? 50;
    if (safeUpdates.staffAddCap !== undefined && safeUpdates.staffAddCap > manualCap) {
        throw { code: 'STAFF_CAP_EXCEEDS_MANUAL', message: 'staffAddCap cannot exceed manualAddCap' };
    }

    await ref.set({ ...safeUpdates, updatedAt: now, updatedBy: actor.uid }, { merge: true });

    // Write override log
    const { writeOverrideLog } = await import('./guestOpsMiddleware.js');
    await writeOverrideLog(db, {
        eventId, venueId,
        action: 'edit_rules', actorUid: actor.uid, actorName: actor.name, actorRole: actor.role,
        targetGuestId: '', targetGuestName: 'event_rules',
        reason: 'Rules updated', metadata: { updatedFields: Object.keys(safeUpdates) },
    });
}
