/**
 * THE C1RCLE - Promoter Engine
 * Centralizes partnership management and conversion tracking.
 */

import { randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb, isFirebaseConfigured } from './admin.js';

const CONNECTIONS_COLLECTION = 'promoter_connections';

/**
 * Manages partnership connection lifecycle
 */
export async function manageConnection(
  action,
  { connectionId, targetId, targetType, promoterId, actor, reason = '' },
) {
  const db = getAdminDb();
  const now = new Date().toISOString();

  if (action === 'request') {
    const id = connectionId || randomUUID();

    // Resolve promoter and target names
    let promoterName = '';
    let targetName = '';

    try {
      const promoterDoc = await db
        .collection('promoters')
        .doc(promoterId)
        .get()
        .catch(() => null);
      if (promoterDoc?.exists) {
        promoterName = promoterDoc.data()?.displayName || promoterDoc.data()?.name || '';
      }

      if (targetType === 'host') {
        const hostDoc = await db
          .collection('hosts')
          .doc(targetId)
          .get()
          .catch(() => null);
        if (hostDoc?.exists) {
          targetName = hostDoc.data()?.displayName || hostDoc.data()?.name || '';
        }
      } else if (targetType === 'venue') {
        const venueDoc = await db
          .collection('venues')
          .doc(targetId)
          .get()
          .catch(() => null);
        if (venueDoc?.exists) {
          targetName = venueDoc.data()?.displayName || venueDoc.data()?.name || '';
        }
      }
    } catch (err) {
      console.error('[promoter-engine] Failed to resolve connection names:', err);
    }

    const connectionData = {
      id,
      promoterId,
      promoterName,
      targetId,
      targetType,
      targetName,
      status: 'pending',
      message: reason,
      initiatedBy: 'promoter',
      fromPartnerId: promoterId,
      toPartnerId: targetId,
      createdAt: now,
      updatedAt: now,
    };

    if (targetType === 'host') {
      connectionData.hostId = targetId;
      connectionData.hostName = targetName;
    } else if (targetType === 'venue') {
      connectionData.venueId = targetId;
      connectionData.venueName = targetName;
    }

    await db.collection(CONNECTIONS_COLLECTION).doc(id).set(connectionData);
    return connectionData;
  }

  const ref = db.collection(CONNECTIONS_COLLECTION).doc(connectionId);
  const update = {
    updatedAt: now,
    resolvedAt: now,
    resolvedBy: actor ? { uid: actor.uid, name: actor.name } : null,
  };

  switch (action) {
    case 'approve':
      update.status = 'approved';
      break;
    case 'reject':
      update.status = 'rejected';
      update.rejectionReason = reason;
      break;
    case 'block':
      update.status = 'blocked';
      update.blockReason = reason;
      break;
    case 'revoke':
      update.status = 'revoked';
      break;
    default:
      throw new Error(`Invalid connection action: ${action}`);
  }

  await ref.update(update);
  return { id: connectionId, ...update };
}

/**
 * Generates a tracking link for a promoter
 */
export async function generatePromoterLink(promoterId, eventId) {
  // In our system, the link usually follows a pattern or uses a specific token
  // For now, we return a standardized structure that apps can use to build URLs
  return {
    promoterId,
    eventId,
    token: `p_${promoterId.substring(0, 8)}`,
    url: `/e/${eventId}?ref=${promoterId}`,
  };
}

/**
 * Aggregates stats for a promoter
 */
export async function getPromoterStats(promoterId) {
  const db = getAdminDb();

  try {
    const statsDoc = await db.collection('promoter_stats').doc(promoterId).get();
    if (!statsDoc.exists) {
      return {
        totalOrders: 0,
        totalRevenue: 0,
        totalCommission: 0,
        conversionRate: 0,
      };
    }

    const data = statsDoc.data();
    return {
      totalOrders: data.totalOrders || 0,
      totalRevenue: data.totalRevenue || 0,
      totalCommission: data.totalCommission || 0,
      conversionRate: 0, // Would require click data from another collection
    };
  } catch (e) {
    console.error('Failed to get promoter stats:', e);
    return {
      totalOrders: 0,
      totalRevenue: 0,
      totalCommission: 0,
      conversionRate: 0,
    };
  }
}

/**
 * Lists connections for an entity
 */
export async function listConnections(entityId, entityType, status = null) {
  const db = getAdminDb();
  let query = db.collection(CONNECTIONS_COLLECTION);

  if (entityType === 'promoter') {
    query = query.where('promoterId', '==', entityId);
  } else {
    query = query.where('targetId', '==', entityId);
  }

  if (status) {
    query = query.where('status', '==', status);
  }

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

const LINKS_COLLECTION = 'promoter_links';
const COMMISSIONS_COLLECTION = 'promoter_commissions';

function isPromoterAllowedForEvent(event, promoterId) {
  const globallyEnabled =
    event?.promotersEnabled === true || event?.promoterSettings?.enabled === true;
  if (!globallyEnabled) return false;
  const allowedIds = Array.isArray(event?.promoterSettings?.allowedPromoterIds)
    ? event.promoterSettings.allowedPromoterIds.map((id) => String(id))
    : [];
  return allowedIds.length === 0 || allowedIds.includes(String(promoterId));
}

function serializeTimestamps(obj) {
  const out = { ...obj };
  Object.keys(out).forEach((key) => {
    if (out[key] && typeof out[key].toDate === 'function')
      out[key] = out[key].toDate().toISOString();
  });
  return out;
}

export async function getPromoterLinkByCode(code, eventId) {
  if (!code) return null;
  if (!isFirebaseConfigured()) return null;
  const db = getAdminDb();
  let query = db.collection(LINKS_COLLECTION).where('code', '==', String(code).trim());
  if (eventId) {
    query = query.where('eventId', '==', String(eventId));
  }
  const snapshot = await query.limit(1).get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  if (doc.data()?.isActive === false) return null;
  const link = { id: doc.id, ...doc.data() };
  if (link.eventId) {
    const eventDoc = await db.collection('events').doc(String(link.eventId)).get();
    if (!eventDoc.exists) return null;
    if (!isPromoterAllowedForEvent({ id: eventDoc.id, ...eventDoc.data() }, link.promoterId))
      return null;
  }
  return link;
}

export async function trackPromoterLinkClick(code, { source = 'guest-portal', eventId } = {}) {
  if (!code) return { status: 'not_found' };
  if (!isFirebaseConfigured()) return { status: 'unavailable' };

  const db = getAdminDb();
  let query = db.collection(LINKS_COLLECTION).where('code', '==', String(code).trim());
  if (eventId) {
    query = query.where('eventId', '==', String(eventId));
  }

  const snapshot = await query.limit(1).get();

  if (snapshot.empty) {
    return { status: 'not_found' };
  }

  const doc = snapshot.docs[0];
  if (doc.data()?.isActive === false) {
    return { status: 'inactive' };
  }

  const now = new Date().toISOString();
  await doc.ref.update({
    clicks: FieldValue.increment(1),
    updatedAt: now,
    lastClickAt: now,
    lastClickSource: source || 'guest-portal',
  });

  return {
    status: 'ok',
    linkId: doc.id,
  };
}

export async function getPromoterByUsername(username) {
  if (!username || !isFirebaseConfigured()) return null;
  const db = getAdminDb();
  const normalized = username.toLowerCase();
  const [byUsername, byHandle] = await Promise.all([
    db.collection('promoters').where('username', '==', normalized).limit(1).get(),
    db.collection('promoters').where('handle', '==', normalized).limit(1).get(),
  ]);
  const doc = byUsername.docs[0] || byHandle.docs[0];
  if (!doc) return null;
  return serializeTimestamps({ id: doc.id, ...doc.data() });
}

export async function getPromoterLinkByVanityAlias(handle, alias) {
  if (!handle || !alias || !isFirebaseConfigured()) return null;
  const promoter = await getPromoterByUsername(handle);
  if (!promoter?.id) return null;
  const db = getAdminDb();
  const snapshot = await db
    .collection(LINKS_COLLECTION)
    .where('promoterId', '==', String(promoter.id))
    .where('vanityAlias', '==', String(alias).trim().toLowerCase())
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  if (doc.data()?.isActive === false) return null;
  return { id: doc.id, ...doc.data() };
}

export async function getPromoterActiveEvents(promoterId) {
  if (!promoterId || !isFirebaseConfigured()) return [];
  const db = getAdminDb();
  const linksSnap = await db
    .collection(LINKS_COLLECTION)
    .where('promoterId', '==', promoterId)
    .where('isActive', '==', true)
    .limit(20)
    .get();
  if (linksSnap.empty) return [];
  const activeLinks = linksSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const linkByEventId = activeLinks.reduce((map, link) => {
    if (link?.eventId && !map.has(String(link.eventId))) map.set(String(link.eventId), link);
    return map;
  }, new Map());
  const eventIds = [...new Set(activeLinks.map((l) => l.eventId).filter(Boolean))];
  if (eventIds.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < eventIds.length; i += 10) chunks.push(eventIds.slice(i, i + 10));
  const eventDocs = (
    await Promise.all(
      chunks.map((chunk) => db.collection('events').where('__name__', 'in', chunk).get()),
    )
  ).flatMap((snap) => snap.docs);
  return eventDocs
    .map((doc) => {
      const serialized = serializeTimestamps({ id: doc.id, ...doc.data() });
      const link = linkByEventId.get(String(doc.id));
      return {
        ...serialized,
        promoterLinkCode: link?.code || null,
        promoterLinkUrl: link?.fullUrl || null,
      };
    })
    .filter((e) => ['scheduled', 'live'].includes(e.lifecycle))
    .filter((e) => isPromoterAllowedForEvent(e, promoterId))
    .sort((a, b) => new Date(a.startDate || 0) - new Date(b.startDate || 0));
}

export async function recordConversion(linkId, orderId, orderAmount, ticketTierId) {
  if (!linkId || !isFirebaseConfigured()) return null;
  const db = getAdminDb();
  const linkDoc = await db.collection(LINKS_COLLECTION).doc(linkId).get();
  if (!linkDoc.exists) return null;
  const link = linkDoc.data();
  const commissionAmount =
    link.commissionType === 'percentage'
      ? Math.round(orderAmount * ((link.commissionRate || 15) / 100))
      : link.commissionRate || 50;
  const now = new Date().toISOString();
  const commissionId = randomUUID();
  const commissionRecord = {
    id: commissionId,
    linkId,
    linkCode: link.code,
    promoterId: link.promoterId,
    eventId: link.eventId,
    orderId,
    orderAmount,
    ticketTierId: ticketTierId || 'multi',
    commissionRate: link.commissionRate,
    commissionType: link.commissionType,
    commissionAmount,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
  await db.runTransaction(async (transaction) => {
    transaction.update(db.collection(LINKS_COLLECTION).doc(linkId), {
      conversions: FieldValue.increment(1),
      revenue: FieldValue.increment(orderAmount),
      commission: FieldValue.increment(commissionAmount),
      updatedAt: now,
    });
    transaction.set(db.collection(COMMISSIONS_COLLECTION).doc(commissionId), commissionRecord);
  });
  return commissionRecord;
}
