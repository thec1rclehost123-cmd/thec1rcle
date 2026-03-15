/**
 * Guest List Store — Firestore reads and writes for guest_lists/{eventId}/guests
 *
 * All masking is applied here server-side based on the actor's role.
 * Client components never receive raw PII — they receive pre-masked records.
 */

import { getAdminDb } from '../firebase/admin';
import crypto from 'crypto';

const MASK_ROLES = ['STAFF', 'SECURITY'];
const FULL_PHONE_ROLES = ['OWNER', 'MANAGER'];

/**
 * Derive displayName (first + last initial) from full name.
 */
function toDisplayName(firstName = '', lastName = '') {
    if (!firstName && !lastName) return 'Unknown';
    const last = lastName?.trim() ? lastName.trim()[0].toUpperCase() + '.' : '';
    return `${firstName.trim()} ${last}`.trim();
}

/**
 * Mask a phone number: show only last 4 digits.
 */
function maskPhone(phone) {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    return `••••••${digits.slice(-4)}`;
}

/**
 * Apply role-based masking to a guest record before returning to client.
 */
function applyMasking(guest, role) {
    const out = { ...guest };

    // Always remove raw phone from output
    delete out.normalizedPhone;

    if (MASK_ROLES.includes(role)) {
        delete out.firstName;
        delete out.lastName;
        delete out.fullPhone;
        out.displayName = guest.displayName || toDisplayName(guest.firstName, guest.lastName);
        out.maskedPhone = maskPhone(guest.normalizedPhone || guest.phone);
        // Hide host/promoter identity
        if (out.hostId) out.hostName = '(Host)';
        if (out.promoterId) out.promoterName = '(Promoter)';
    } else if (FULL_PHONE_ROLES.includes(role)) {
        out.displayName = out.displayName || toDisplayName(guest.firstName, guest.lastName);
        out.maskedPhone = maskPhone(guest.normalizedPhone || guest.phone);
        out.fullPhone = guest.normalizedPhone || guest.phone || null;
    } else {
        // HOST, PROMOTER, etc. — just display name, no contact
        delete out.firstName;
        delete out.lastName;
        delete out.fullPhone;
        delete out.maskedPhone;
    }

    return out;
}

/**
 * Normalize Indian mobile phone to E.164 (+91XXXXXXXXXX).
 * Returns null if invalid.
 */
export function normalizePhone(raw) {
    if (!raw) return null;
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
    if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
    if (digits.length !== 10) return null;
    if (!/^[6-9]/.test(digits)) return null;
    return `+91${digits}`;
}

/**
 * Validate guest name: 2-100 unicode letters, spaces, hyphens, apostrophes, periods.
 */
export function validateGuestName(name) {
    if (!name || typeof name !== 'string') return false;
    const t = name.trim();
    if (t.length < 2 || t.length > 100) return false;
    // Allow unicode letters, spaces, hyphens, apostrophes, periods — reject pure digits / HTML
    if (/^\d+$/.test(t)) return false;
    if (/<|>|&/.test(t)) return false;
    return true;
}

/**
 * List guests for an event with cursor-based pagination.
 * Applies role-based masking to every record.
 */
export async function listGuests({ eventId, cursor, limit = 50, filter = {}, sort = { field: 'addedAt', dir: 'desc' } }, actorRole) {
    const db = getAdminDb();
    let query = db.collection('guest_lists').doc(eventId).collection('guests')
        .where('isRemoved', '==', false);

    if (filter.status && filter.status !== 'all') {
        query = query.where('status', '==', filter.status);
    }
    if (filter.guestType && filter.guestType !== 'all') {
        query = query.where('guestType', '==', filter.guestType);
    }
    if (filter.checkedIn !== undefined) {
        query = query.where('checkedIn', '==', filter.checkedIn);
    }
    if (filter.hostId) {
        query = query.where('hostId', '==', filter.hostId);
    }
    if (filter.promoterId) {
        query = query.where('promoterId', '==', filter.promoterId);
    }

    const sortDir = sort.dir === 'asc' ? 'asc' : 'desc';
    query = query.orderBy(sort.field === 'displayName' ? 'firstName' : sort.field, sortDir);

    if (cursor) {
        const cursorDoc = await db.collection('guest_lists').doc(eventId).collection('guests').doc(cursor).get();
        if (cursorDoc.exists) query = query.startAfter(cursorDoc);
    }

    const pageSize = Math.min(Number(limit), 100);
    const snap = await query.limit(pageSize + 1).get();
    const hasMore = snap.docs.length > pageSize;
    const docs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;

    const guests = docs.map(doc => applyMasking({ guestId: doc.id, ...doc.data() }, actorRole));

    return {
        guests,
        nextCursor: hasMore ? docs[docs.length - 1].id : null,
        hasMore,
    };
}

/**
 * Search guests across name, phone, ticketId, or qrRef.
 * Returns at most 10 results. Never returns raw PII.
 */
export async function searchGuests({ eventId, q, field }, actorRole) {
    const db = getAdminDb();
    const colRef = db.collection('guest_lists').doc(eventId).collection('guests');

    let snap;

    if (field === 'phone') {
        const normalized = normalizePhone(q);
        if (!normalized) return { results: [], matchedOn: 'phone', ambiguous: false };
        snap = await colRef
            .where('normalizedPhone', '==', normalized)
            .where('isRemoved', '==', false)
            .limit(10)
            .get();
    } else if (field === 'ticketId') {
        snap = await colRef
            .where('ticketId', '==', q.trim())
            .where('isRemoved', '==', false)
            .limit(5)
            .get();
    } else if (field === 'ref') {
        snap = await colRef
            .where('orderId', '==', q.trim())
            .where('isRemoved', '==', false)
            .limit(5)
            .get();
    } else {
        // Name search: prefix match on firstName (Firestore limitation — no full-text)
        const term = q.trim();
        snap = await colRef
            .where('isRemoved', '==', false)
            .where('firstName', '>=', term)
            .where('firstName', '<=', term + '\uf8ff')
            .orderBy('firstName')
            .limit(10)
            .get();
    }

    const results = snap.docs.map(doc => applyMasking({ guestId: doc.id, ...doc.data() }, actorRole));
    const ambiguous = field === 'phone' && results.length > 1;

    return { results: results.slice(0, 10), matchedOn: field, ambiguous };
}

/**
 * Get a single guest record by ID.
 */
export async function getGuest(eventId, guestId, actorRole) {
    const db = getAdminDb();
    const doc = await db.collection('guest_lists').doc(eventId).collection('guests').doc(guestId).get();
    if (!doc.exists) return null;
    return applyMasking({ guestId: doc.id, ...doc.data() }, actorRole);
}

/**
 * Add a new guest record.
 * Returns { guestId } on success.
 * Throws { code: 'DUPLICATE_GUEST' | 'CAP_EXCEEDED' | ... } on conflict.
 */
export async function addGuest(eventId, venueId, body, actor, rules) {
    const db = getAdminDb();
    const { name, phone, guestType, tableId, hostId, promoterId, notes, quantity = 1 } = body;

    if (!validateGuestName(name)) throw { code: 'INVALID_NAME', message: 'Guest name is invalid' };

    const normalizedPhone = normalizePhone(phone);

    // Duplicate check by phone
    if (normalizedPhone) {
        const dupSnap = await db.collection('guest_lists').doc(eventId).collection('guests')
            .where('normalizedPhone', '==', normalizedPhone)
            .where('isRemoved', '==', false)
            .limit(1)
            .get();
        if (!dupSnap.empty) {
            throw { code: 'DUPLICATE_GUEST', message: 'A guest with this phone number is already on the list', existingGuestId: dupSnap.docs[0].id };
        }
    }

    // Manual add cap check
    const manualSources = ['venue_manual', 'staff_override'];
    const isCappedAdd = ['venue_manual', 'venue_comp', 'venue_vip', 'staff_override'].includes(guestType);
    if (isCappedAdd && rules) {
        const cap = actor.role === 'STAFF' ? rules.staffAddCap : rules.manualAddCap;
        const usedSnap = await db.collection('guest_lists').doc(eventId).collection('guests')
            .where('source', 'in', manualSources)
            .where('isRemoved', '==', false)
            .get();
        if (usedSnap.size >= cap) {
            throw { code: 'MANUAL_ADD_CAP_EXCEEDED', message: `Manual add cap (${cap}) has been reached`, used: usedSnap.size, cap };
        }
    }

    // Host allocation cap check
    if (guestType === 'host_manual' && hostId && rules) {
        const allocSnap = await db.collection('event_guest_allocations').doc(eventId).collection('hosts').doc(hostId).get();
        if (allocSnap.exists) {
            const alloc = allocSnap.data();
            if (alloc.remaining <= 0) {
                throw { code: 'HOST_ALLOCATION_EXCEEDED', message: 'Host allocation cap has been reached', hostId, used: alloc.usedCount, allocated: alloc.allocatedCount };
            }
        }
    }

    // Promoter allocation cap check
    if (guestType === 'promoter_manual' && promoterId && rules) {
        const allocSnap = await db.collection('event_guest_allocations').doc(eventId).collection('promoters').doc(promoterId).get();
        if (allocSnap.exists) {
            const alloc = allocSnap.data();
            if (alloc.remaining <= 0) {
                throw { code: 'PROMOTER_ALLOCATION_EXCEEDED', message: 'Promoter allocation cap has been reached', promoterId, used: alloc.usedCount, allocated: alloc.allocatedCount };
            }
        }
    }

    // Parse name
    const parts = name.trim().split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ') || '';
    const displayName = toDisplayName(firstName, lastName);

    // Determine source from guestType
    const sourceMap = {
        'venue_manual': 'venue_manual',
        'venue_comp': 'venue_comp',
        'venue_vip': 'venue_vip',
        'table_booking': 'table_booking',
        'host_manual': 'host_manual',
        'promoter_manual': 'promoter_manual',
        'staff_added': 'staff_override',
    };
    const source = sourceMap[guestType] || 'venue_manual';

    // Comps and VIPs that require approval go into pending state
    const needsApproval =
        (guestType === 'venue_comp' && rules?.compApprovalRequired) ||
        (guestType === 'venue_vip' && rules?.vipApprovalRequired);

    const now = new Date().toISOString();
    const docRef = db.collection('guest_lists').doc(eventId).collection('guests').doc();

    const guestData = {
        eventId,
        venueId,
        firstName,
        lastName,
        displayName,
        normalizedPhone: normalizedPhone || null,
        maskedPhone: normalizedPhone ? maskPhone(normalizedPhone) : null,
        guestType,
        source,
        status: needsApproval ? 'pending_approval' : 'expected',
        ticketId: null,
        orderId: null,
        ticketTierId: null,
        ticketTierName: null,
        tableId: tableId || null,
        tableName: null,
        hostId: hostId || null,
        hostName: null,
        promoterId: promoterId || null,
        promoterName: null,
        checkedIn: false,
        checkedInAt: null,
        checkInSource: null,
        checkInDeviceId: null,
        checkInDeviceName: null,
        checkInOperator: null,
        addedByUid: actor.uid,
        addedByName: actor.name || '',
        addedAt: now,
        updatedAt: now,
        notes: notes || null,
        isRemoved: false,
        isLocked: false,
        quantity: Math.max(1, Number(quantity)),
    };

    await docRef.set(guestData);

    // Update host/promoter allocation usedCount
    if (guestType === 'host_manual' && hostId) {
        const allocRef = db.collection('event_guest_allocations').doc(eventId).collection('hosts').doc(hostId);
        await allocRef.set({ usedCount: (await allocRef.get()).data()?.usedCount + 1 || 1, remaining: Math.max(0, ((await allocRef.get()).data()?.remaining || 0) - 1), updatedAt: now }, { merge: true });
    }
    if (guestType === 'promoter_manual' && promoterId) {
        const allocRef = db.collection('event_guest_allocations').doc(eventId).collection('promoters').doc(promoterId);
        await allocRef.set({ usedCount: (await allocRef.get()).data()?.usedCount + 1 || 1, remaining: Math.max(0, ((await allocRef.get()).data()?.remaining || 0) - 1), updatedAt: now }, { merge: true });
    }

    // Update summary
    await updateSummaryCounter(db, eventId, { totalExpected: 1 });

    // Write pending exception if approval needed
    if (needsApproval) {
        await db.collection('event_guest_exceptions').doc(eventId).collection('items').add({
            eventId,
            venueId,
            type: guestType === 'venue_comp' ? 'comp_pending_approval' : 'vip_pending_approval',
            guestId: docRef.id,
            guestDisplayName: displayName,
            triggeredBy: actor.uid,
            triggeredByName: actor.name || '',
            triggeredAt: now,
            status: 'open',
            isLocked: false,
        });
    }

    return { guestId: docRef.id, status: guestData.status };
}

/**
 * Perform a manual check-in. Idempotent.
 */
export async function checkInGuest(eventId, guestId, actor, { reason, gate } = {}) {
    const db = getAdminDb();
    const guestRef = db.collection('guest_lists').doc(eventId).collection('guests').doc(guestId);

    const result = await db.runTransaction(async tx => {
        const doc = await tx.get(guestRef);
        if (!doc.exists) throw { code: 'NOT_FOUND', message: 'Guest not found' };

        const guest = doc.data();
        if (guest.isLocked) throw { code: 'EVENT_LOCKED', message: 'Event is locked' };
        if (guest.status === 'denied') throw { code: 'GUEST_DENIED', message: 'Guest has been denied entry' };

        if (guest.checkedIn) {
            return { alreadyCheckedIn: true, checkedInAt: guest.checkedInAt, checkInSource: guest.checkInSource };
        }

        const now = new Date().toISOString();
        tx.update(guestRef, {
            checkedIn: true,
            checkedInAt: now,
            checkInSource: 'manual_dashboard',
            checkInDeviceName: gate || 'Dashboard',
            checkInOperator: actor.name || '',
            status: 'checked_in',
            updatedAt: now,
        });

        // Update summary
        const summaryRef = db.collection('scan_logs').doc(eventId);
        tx.set(summaryRef, {
            checkedIn: db.FieldValue?.increment(1) || 1,
            manualCheckIns: db.FieldValue?.increment(1) || 1,
            lastUpdatedAt: now,
        }, { merge: true });

        return { alreadyCheckedIn: false, checkedInAt: now };
    });

    // Write override log outside transaction (non-blocking)
    const { writeOverrideLog } = await import('./guestOpsMiddleware.js');
    const guestDoc = await guestRef.get();
    await writeOverrideLog(db, {
        eventId,
        venueId: guestDoc.data()?.venueId,
        action: 'manual_check_in',
        actorUid: actor.uid,
        actorName: actor.name,
        actorRole: actor.role,
        targetGuestId: guestId,
        targetGuestName: guestDoc.data()?.displayName || '',
        reason: reason || null,
        metadata: { gate: gate || null },
    });

    return result;
}

/**
 * Deny a guest's entry.
 */
export async function denyGuest(eventId, guestId, actor, { reason, notes } = {}) {
    const db = getAdminDb();
    const guestRef = db.collection('guest_lists').doc(eventId).collection('guests').doc(guestId);
    const doc = await guestRef.get();
    if (!doc.exists) throw { code: 'NOT_FOUND', message: 'Guest not found' };
    const guest = doc.data();
    if (guest.isLocked) throw { code: 'EVENT_LOCKED', message: 'Event is locked' };
    if (guest.checkedIn && actor.role !== 'OWNER') throw { code: 'ALREADY_CHECKED_IN', message: 'Guest has already checked in — only OWNER can deny after check-in' };

    const now = new Date().toISOString();
    await guestRef.update({ status: 'denied', updatedAt: now });

    // Write exception
    await db.collection('event_guest_exceptions').doc(eventId).collection('items').add({
        eventId, venueId: guest.venueId, type: 'entry_denied',
        guestId, guestDisplayName: guest.displayName || '',
        triggeredBy: actor.uid, triggeredByName: actor.name || '',
        triggeredAt: now, context: { reason, notes },
        status: 'resolved',
        resolution: { resolvedBy: actor.uid, resolvedByName: actor.name, resolvedAt: now, action: 'denied', reason: reason || '', notes: notes || '' },
        isLocked: false,
    });

    const { writeOverrideLog } = await import('./guestOpsMiddleware.js');
    await writeOverrideLog(db, {
        eventId, venueId: guest.venueId,
        action: 'deny_entry', actorUid: actor.uid, actorName: actor.name, actorRole: actor.role,
        targetGuestId: guestId, targetGuestName: guest.displayName || '',
        reason: reason || '', metadata: { notes },
    });

    // Update summary counter
    await updateSummaryCounter(db, eventId, { denied: 1 });
}

/**
 * Flag a guest.
 */
export async function flagGuest(eventId, guestId, actor, { reason, severity = 'medium', notes } = {}) {
    const db = getAdminDb();
    const guestRef = db.collection('guest_lists').doc(eventId).collection('guests').doc(guestId);
    const doc = await guestRef.get();
    if (!doc.exists) throw { code: 'NOT_FOUND', message: 'Guest not found' };
    const guest = doc.data();
    if (guest.isLocked) throw { code: 'EVENT_LOCKED', message: 'Event is locked' };

    const now = new Date().toISOString();
    await guestRef.update({ status: 'flagged', updatedAt: now });

    await db.collection('event_guest_exceptions').doc(eventId).collection('items').add({
        eventId, venueId: guest.venueId, type: 'security_flag',
        guestId, guestDisplayName: guest.displayName || '',
        triggeredBy: actor.uid, triggeredByName: actor.name || '',
        triggeredAt: now, context: { reason, severity, notes },
        status: 'open', isLocked: false,
    });

    const { writeOverrideLog } = await import('./guestOpsMiddleware.js');
    await writeOverrideLog(db, {
        eventId, venueId: guest.venueId,
        action: 'flag_guest', actorUid: actor.uid, actorName: actor.name, actorRole: actor.role,
        targetGuestId: guestId, targetGuestName: guest.displayName || '',
        reason, metadata: { severity, notes },
    });

    await updateSummaryCounter(db, eventId, { flagged: 1 });
}

/**
 * Increment/decrement fields in scan_logs/{eventId} summary (non-transaction helper).
 */
async function updateSummaryCounter(db, eventId, increments) {
    try {
        const ref = db.collection('scan_logs').doc(eventId);
        const updates = { lastUpdatedAt: new Date().toISOString() };
        // Firestore Admin FieldValue.increment
        const { FieldValue } = await import('firebase-admin/firestore');
        for (const [key, val] of Object.entries(increments)) {
            updates[key] = FieldValue.increment(val);
        }
        await ref.set(updates, { merge: true });
    } catch (_) {
        // best-effort
    }
}

/**
 * Get event guest rules. Returns defaults if no rules doc exists.
 */
export async function getGuestRules(eventId) {
    const db = getAdminDb();
    const doc = await db.collection('event_guest_rules').doc(eventId).get();
    if (doc.exists) return { eventId, ...doc.data() };
    // Return safe defaults
    return {
        eventId,
        entryCutoffEnabled: false,
        entryCutoffTime: null,
        reEntryEnabled: false,
        reEntryWindowMins: null,
        minimumAgeRule: 21,
        dressCodNote: null,
        compApprovalRequired: false,
        vipApprovalRequired: false,
        manualAddCap: 50,
        staffAddCap: 20,
        manualCheckInEnabled: true,
        manualOverrideRequiresReason: true,
        exportEnabled: true,
        exportFormat: 'csv',
        exportPiiLevel: 'masked',
        isLocked: false,
        lockedAt: null,
        lockedBy: null,
        updatedAt: new Date().toISOString(),
        updatedBy: 'system',
    };
}
