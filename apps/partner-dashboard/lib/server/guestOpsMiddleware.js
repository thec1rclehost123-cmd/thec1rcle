/**
 * Guest Operations Middleware
 *
 * Centralised auth + venue-scope check for all /api/venue/guest-ops/* routes.
 * Every handler calls requireGuestOpsAccess() before touching any data.
 */

import { verifyAuth } from './auth';
import { getAdminDb } from '../firebase/admin';
import { VENUE_PERMISSIONS } from '../rbac/types';

function buildAuthError(request, status, message) {
    const code =
        status === 401 ? 'UNAUTHORIZED'
        : status === 403 ? 'FORBIDDEN'
        : status === 404 ? 'NOT_FOUND'
        : status >= 500 ? 'INTERNAL_ERROR'
        : 'BAD_REQUEST';

    return {
        error: {
            code,
            message,
            requestId: request.headers.get('x-request-id') || crypto.randomUUID(),
        },
        status,
    };
}

/**
 * Resolve the venue membership for the authenticated user.
 * Returns null if user is not an active member of the venue.
 */
async function getVenueMembership(uid, venueId) {
    const db = getAdminDb();
    const snap = await db.collection('venue_staff')
        .where('userId', '==', uid)
        .where('venueId', '==', venueId)
        .where('isActive', '==', true)
        .limit(1)
        .get();

    if (!snap.empty) return snap.docs[0].data();

    // Also check venues/{venueId}.ownerId for direct venue owners
    const venueDoc = await db.collection('venues').doc(venueId).get();
    if (!venueDoc.exists) return null;
    const venue = venueDoc.data();
    if (venue.ownerId === uid || venue.createdBy === uid) {
        return { userId: uid, venueId, role: 'OWNER', isActive: true };
    }
    return null;
}

/**
 * Verify the eventId belongs to the venueId.
 * Returns the event doc data or null.
 */
async function getEventScoped(eventId, venueId) {
    const db = getAdminDb();
    const doc = await db.collection('events').doc(eventId).get();
    if (!doc.exists) return null;
    const event = doc.data();
    if (event.venueId !== venueId) return null;
    return { id: doc.id, ...event };
}

/**
 * Main guard for guest ops routes.
 *
 * @param {Request} request
 * @param {string} venueId - from activeMembership, passed by caller
 * @param {string} eventId - from route params, validated against venueId
 * @param {string[]} requiredPermissions - any of these suffices (OR), pass [] to require only VIEW_GUESTLIST
 * @returns {{ user, membership, event } | { error: string, status: number }}
 */
export async function requireGuestOpsAccess(request, venueId, eventId, requiredPermissions = ['VIEW_GUESTLIST']) {
    const user = await verifyAuth(request);
    if (!user) return buildAuthError(request, 401, 'Unauthorized');

    if (!venueId) return buildAuthError(request, 400, 'venueId is required');

    const membership = await getVenueMembership(user.uid, venueId);
    if (!membership) return buildAuthError(request, 403, 'Forbidden — not a venue member');

    const rolePermissions = VENUE_PERMISSIONS[membership.role] || [];
    // Override permissions on membership take precedence
    const effectivePerms = membership.permissions?.length ? membership.permissions : rolePermissions;

    const hasPermission = requiredPermissions.some(p => effectivePerms.includes(p));
    if (!hasPermission) return buildAuthError(request, 403, 'Insufficient permissions');

    let event = null;
    if (eventId) {
        event = await getEventScoped(eventId, venueId);
        if (!event) return buildAuthError(request, 404, 'Event not found or does not belong to this venue');
    }

    return { user, membership, event };
}

/**
 * Write a security audit log entry for sensitive access.
 */
export async function writeSecurityAuditLog({ venueId, actorUid, actorRole, action, eventId, queryHash, metadata = {} }) {
    try {
        const db = getAdminDb();
        await db.collection('security_audit_logs').doc(venueId).collection('items').add({
            venueId,
            actorUid,
            actorRole,
            action,
            eventId: eventId || null,
            queryHash: queryHash || null,
            timestamp: new Date().toISOString(),
            metadata,
        });
    } catch (err) {
        // Audit log failure must not block the main operation, but should be visible
        console.error("[GuestOpsMiddleware] Security audit log write failed:", err?.message || err);
    }
}

/**
 * Write an override log entry (append-only).
 * Called inside the same Firestore transaction or immediately after.
 */
export async function writeOverrideLog(db, { eventId, venueId, action, actorUid, actorName, actorRole, targetGuestId, targetGuestName, reason, metadata = {} }) {
    await db.collection('guest_override_logs').doc(eventId).collection('items').add({
        eventId,
        venueId,
        action,
        actorUid,
        actorName: actorName || '',
        actorRole: actorRole || '',
        targetGuestId,
        targetGuestName: targetGuestName || '',
        reason: reason || null,
        overrideAt: new Date().toISOString(),
        metadata,
    });
}
