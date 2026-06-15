/**
 * Connection Service (Refactored for API Governance)
 *
 * Thin orchestrator over partnershipStore and promoterConnectionStore.
 * Both stores are now SDK-backed, so this service delegates cleanly.
 */

import * as partnershipStore from './partnershipStore';
import * as promoterConnectionStore from './promoterConnectionStore';
import { getAdminDb, isFirebaseConfigured } from '../firebase/admin';

// ─── Audit log ────────────────────────────────────────────────────────────────

async function appendPartnershipAuditLog(
  connectionId,
  connectionType,
  action,
  actorId,
  actorRole,
  reason = '',
) {
  if (!isFirebaseConfigured()) return;
  try {
    const db = getAdminDb();
    await db.collection('partnership_audit_log').add({
      connectionId,
      connectionType,
      action,
      actorId,
      actorRole,
      reason,
      createdAt: new Date().toISOString(),
      timestamp: Date.now(),
    });
  } catch (e) {
    console.error('[connectionService] appendPartnershipAuditLog failed:', e.message);
  }
}

// ─── Guard helpers ─────────────────────────────────────────────────────────────

async function guardHostVenueRequest(hostId, venueId) {
  if (!isFirebaseConfigured()) return; // skip in dev without Firebase
  const db = getAdminDb();

  // Guard A: Duplicate prevention
  const existingSnap = await db
    .collection('partnerships')
    .where('hostId', '==', hostId)
    .where('venueId', '==', venueId)
    .where('status', 'in', ['pending', 'active'])
    .limit(1)
    .get();
  if (!existingSnap.empty) throw new Error('DUPLICATE_REQUEST');

  // Guard B: 30-day cooldown after rejection
  const rejectedSnap = await db
    .collection('partnerships')
    .where('hostId', '==', hostId)
    .where('venueId', '==', venueId)
    .where('status', '==', 'rejected')
    .orderBy('updatedAt', 'desc')
    .limit(1)
    .get();
  if (!rejectedSnap.empty) {
    const rejectedAt = new Date(rejectedSnap.docs[0].data().updatedAt);
    const daysSince = (Date.now() - rejectedAt.getTime()) / 86400000;
    if (daysSince < 30) throw new Error('COOLDOWN_ACTIVE');
  }
}

async function guardPromoterRequest(promoterId) {
  if (!isFirebaseConfigured()) return; // skip in dev without Firebase
  const db = getAdminDb();

  // Guard C: 20 requests per 24 hours spam limit
  const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
  const recentSnap = await db
    .collection('promoter_connections')
    .where('promoterId', '==', promoterId)
    .where('createdAt', '>', oneDayAgo)
    .get();
  if (recentSnap.size >= 20) throw new Error('SPAM_LIMIT_REACHED');
}

// ─── Request creation ──────────────────────────────────────────────────────────

export async function createRequest(
  {
    requesterId,
    requesterType,
    requesterName,
    requesterEmail,
    targetId,
    targetType,
    targetName,
    message = '',
  },
  token,
) {
  // Host <-> Venue partnership
  if (
    (requesterType === 'host' && targetType === 'venue') ||
    (requesterType === 'venue' && targetType === 'host')
  ) {
    const hostId = requesterType === 'host' ? requesterId : targetId;
    const venueId = requesterType === 'venue' ? requesterId : targetId;
    const hostName = requesterType === 'host' ? requesterName : targetName;
    const venueName = requesterType === 'venue' ? requesterName : targetName;
    await guardHostVenueRequest(hostId, venueId);
    const result = await partnershipStore.requestPartnership(
      hostId,
      venueId,
      hostName,
      venueName,
      token,
    );
    appendPartnershipAuditLog(
      result?.id || result?.partnershipId || '',
      'partnership',
      'requested',
      hostId,
      'host',
    ).catch(() => {});
    return result;
  }

  // Promoter-initiated connection
  if (requesterType === 'promoter') {
    await guardPromoterRequest(requesterId);
    return promoterConnectionStore.createConnectionRequest(
      {
        promoterId: requesterId,
        promoterName: requesterName,
        promoterEmail: requesterEmail,
        targetId,
        targetType,
        targetName,
        message,
      },
      token,
    );
  }

  // Target is a promoter
  if (targetType === 'promoter') {
    return promoterConnectionStore.createConnectionRequest(
      {
        promoterId: targetId,
        targetId: requesterId,
        targetType: requesterType,
        targetName: requesterName,
        message,
      },
      token,
    );
  }

  throw new Error(`Unsupported connection type: ${requesterType} to ${targetType}`);
}

// ─── Approval side effects ────────────────────────────────────────────────────

async function writeCommissionableLedger(connectionId, tier) {
  if (!isFirebaseConfigured()) return;
  try {
    const db = getAdminDb();
    const connectionDoc = await db.collection('promoter_connections').doc(connectionId).get();
    if (!connectionDoc.exists) return;
    const { promoterId, targetId, targetType } = connectionDoc.data();
    await db
      .collection('commissionable_partners')
      .doc(`${promoterId}_${targetId}`)
      .set(
        {
          promoterId,
          targetId,
          targetType,
          connectionId,
          tier: tier || 'standard',
          addedAt: new Date().toISOString(),
          status: 'active',
        },
        { merge: true },
      );
  } catch (e) {
    console.error('[connectionService] writeCommissionableLedger failed:', e.message);
  }
}

async function writePartnershipNotification(otherId, partnerName, connectionId, tier) {
  if (!isFirebaseConfigured()) return;
  try {
    const db = getAdminDb();
    const memberSnap = await db
      .collection('partner_memberships')
      .where('partnerId', '==', otherId)
      .where('role', '==', 'OWNER')
      .limit(1)
      .get();
    if (memberSnap.empty) return;
    const uid = memberSnap.docs[0].data().uid;
    await db
      .collection('notifications')
      .doc(uid)
      .collection('items')
      .add({
        type: 'partnership_approved',
        title: 'Partnership Approved',
        body: `${partnerName} approved your partnership request`,
        connectionId,
        tier: tier || 'standard',
        createdAt: new Date().toISOString(),
        read: false,
      });
  } catch (e) {
    console.error('[connectionService] writePartnershipNotification failed:', e.message);
  }
}

export async function approveRequest(
  connectionId,
  type,
  role,
  partnerId,
  partnerName,
  token,
  tier,
) {
  if (type === 'partnership') {
    const result = await partnershipStore.approvePartnership(connectionId, token, tier);
    appendPartnershipAuditLog(connectionId, type, 'approved', partnerId, role).catch(() => {});
    writePartnershipNotification(partnerId, partnerName, connectionId, tier).catch(() => {});
    return result;
  }
  const result = await promoterConnectionStore.approveConnectionRequest(
    connectionId,
    { uid: partnerId, name: partnerName, role },
    token,
    tier,
  );
  appendPartnershipAuditLog(connectionId, type, 'approved', partnerId, role).catch(() => {});
  writeCommissionableLedger(connectionId, tier).catch(() => {});
  writePartnershipNotification(partnerId, partnerName, connectionId, tier).catch(() => {});
  return result;
}

export async function rejectRequest(
  connectionId,
  type,
  role,
  partnerId,
  partnerName,
  reason = '',
  token,
) {
  let result;
  if (type === 'partnership') {
    result = await partnershipStore.rejectPartnership(connectionId, reason, token);
  } else {
    result = await promoterConnectionStore.rejectConnectionRequest(
      connectionId,
      { uid: partnerId, name: partnerName, role },
      reason,
      token,
    );
  }
  appendPartnershipAuditLog(connectionId, type, 'rejected', partnerId, role, reason).catch(
    () => {},
  );
  return result;
}

export async function blockRequest(
  connectionId,
  type,
  role,
  partnerId,
  partnerName,
  reason = '',
  token,
) {
  let result;
  if (type === 'partnership') {
    result = await partnershipStore.blockPartnership(connectionId, reason, token);
  } else {
    result = await promoterConnectionStore.blockConnectionRequest(
      connectionId,
      { uid: partnerId, role, name: partnerName },
      reason,
      token,
    );
  }
  appendPartnershipAuditLog(connectionId, type, 'blocked', partnerId, role, reason).catch(() => {});
  return result;
}

export async function listConnections(partnerId, role, status = null, token) {
  const filters = {};
  if (role === 'host') filters.hostId = partnerId;
  if (role === 'venue') filters.venueId = partnerId;
  if (status) filters.status = status;

  const [partnerships, promoterConnections] = await Promise.all([
    role === 'promoter' ? [] : partnershipStore.listPartnerships(filters, token),
    role === 'promoter'
      ? promoterConnectionStore.listPromoterConnections(partnerId, status, token)
      : promoterConnectionStore.listIncomingRequests(partnerId, role, status, token),
  ]);

  const normalizedPartnerships = partnerships.map((p) => ({
    ...p,
    id: p.id,
    type: 'partnership',
    otherId: role === 'host' ? p.venueId : p.hostId,
    otherName: role === 'host' ? p.venueName : p.hostName,
    otherType: role === 'host' ? 'venue' : 'host',
    status: p.status,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));

  const normalizedPromoters = promoterConnections.map((c) => ({
    ...c,
    id: c.id,
    type: 'promoter_connection',
    otherId: role === 'promoter' ? c.targetId : c.promoterId,
    otherName: role === 'promoter' ? c.targetName : c.promoterName,
    otherType: role === 'promoter' ? c.targetType : 'promoter',
    status: c.status,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    message: c.message,
  }));

  return [...normalizedPartnerships, ...normalizedPromoters].sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
  );
}
