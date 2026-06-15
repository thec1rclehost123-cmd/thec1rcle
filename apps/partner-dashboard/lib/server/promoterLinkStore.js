import { randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '../firebase/admin';

const LINKS_COLLECTION = 'promoter_links';
const COMMISSIONS_COLLECTION = 'promoter_commissions';
const EVENTS_COLLECTION = 'events';
const PROMOTERS_COLLECTION = 'promoters';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function toIsoDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' ? value : null;
}

function getSortableTimestamp(value) {
  const iso = toIsoDate(value);
  if (!iso) return 0;
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getLinkStatus(link = {}) {
  if (link.isActive === false || String(link.status || '').toLowerCase() === 'deactivated') {
    return 'deactivated';
  }
  if (link.expiresAt) {
    const expiresAt = new Date(link.expiresAt);
    if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= Date.now()) {
      return 'expired';
    }
  }
  return 'active';
}

function normalizePromoterHandle(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[^\w-]/g, '');
}

function sanitizeEditableSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function getVanityPrefix(promoterId) {
  const normalized = String(promoterId || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
  return `p${normalized.slice(-5) || 'guest'}-`;
}

function buildVanityAlias(promoterId, editableSlug, fallbackCode = '') {
  const prefix = getVanityPrefix(promoterId);
  const normalizedEditable =
    sanitizeEditableSlug(editableSlug) || String(fallbackCode || '').toLowerCase();
  return `${prefix}${normalizedEditable}`;
}

function buildFullUrl(link = {}, event = null, promoter = null) {
  const baseUrl =
    process.env.NEXT_PUBLIC_GUEST_PORTAL_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    '';
  if (!baseUrl) return null;
  const slug = event?.slug || link.eventSlug || link.eventId;
  const code = link.code || link.shortCode || null;
  if (!slug || !code) return null;
  const channel = link.channel ? `&s=${encodeURIComponent(link.channel)}` : '';
  const promoterHandle = normalizePromoterHandle(
    promoter?.handle || promoter?.username || link.promoterHandle || null,
  );
  const vanityAlias = link.vanityAlias || null;
  if (promoterHandle && vanityAlias) {
    return `${baseUrl}/${encodeURIComponent(promoterHandle)}/${encodeURIComponent(vanityAlias)}`;
  }
  if (promoterHandle) {
    return `${baseUrl}/${encodeURIComponent(promoterHandle)}/${encodeURIComponent(slug)}?ref=${encodeURIComponent(code)}${channel}`;
  }
  return `${baseUrl}/e/${encodeURIComponent(slug)}?ref=${encodeURIComponent(code)}${channel}`;
}

function normalizeLink(doc, event = null, promoter = null) {
  const data = doc?.data ? doc.data() : doc || {};
  const id = doc?.id || data.id;
  const status = getLinkStatus(data);
  const code = data.code || data.shortCode || data.slug || null;
  const eventImage =
    event?.poster || event?.image || event?.coverImage || event?.coverPhoto || null;

  return {
    id,
    promoterId: data.promoterId || null,
    promoterName: data.promoterName || 'Promoter',
    promoterHandle:
      normalizePromoterHandle(
        promoter?.handle || promoter?.username || data.promoterHandle || null,
      ) || null,
    vanityPrefix: getVanityPrefix(data.promoterId || ''),
    vanitySlug: sanitizeEditableSlug(data.vanitySlug || ''),
    vanityAlias: data.vanityAlias || null,
    eventId: data.eventId || null,
    eventTitle: data.eventTitle || event?.title || event?.name || data.eventName || 'Event',
    eventSlug: event?.slug || data.eventSlug || data.eventId || null,
    code,
    shortCode: code,
    campaignLabel: data.campaignLabel || data.label || null,
    label: data.campaignLabel || data.label || null,
    channel: data.channel || null,
    ticketTierIds: Array.isArray(data.ticketTierIds) ? data.ticketTierIds : [],
    commissionRate: Number(data.commissionRate || 0),
    commissionType: data.commissionType || 'percentage',
    clicks: Number(data.clicks || 0),
    conversions: Number(data.conversions || data.purchases || data.sales || 0),
    revenue: Number(data.revenue || 0),
    commission: Number(data.commission || 0),
    commissionRate: Number(data.commissionRate || 0),
    isActive: status === 'active',
    status,
    expiresAt: toIsoDate(data.expiresAt),
    createdAt: toIsoDate(data.createdAt),
    updatedAt: toIsoDate(data.updatedAt),
    deactivatedAt: toIsoDate(data.deactivatedAt),
    fullUrl: buildFullUrl(data, event, promoter) || data.fullUrl || data.trackingLink,
    eventImage,
    venueName: event?.venueName || event?.venue || data.venueName || null,
    city: event?.city || event?.locationCity || event?.location?.city || null,
    startDate: event?.startDate || event?.date || null,
    startTime: event?.startTime || null,
    endTime: event?.endTime || null,
    category: event?.category || null,
    lifecycle: event?.lifecycle || null,
  };
}

async function loadEventsByIds(eventIds = []) {
  const db = getAdminDb();
  const ids = Array.from(new Set(eventIds.filter(Boolean)));
  if (ids.length === 0) return new Map();
  const docs = await Promise.all(
    ids.map((eventId) => db.collection(EVENTS_COLLECTION).doc(String(eventId)).get()),
  );
  return docs.reduce((map, doc) => {
    if (doc.exists) map.set(doc.id, { id: doc.id, ...doc.data() });
    return map;
  }, new Map());
}

async function loadPromotersByIds(promoterIds = []) {
  const db = getAdminDb();
  const ids = Array.from(new Set(promoterIds.filter(Boolean)));
  if (ids.length === 0) return new Map();
  const docs = await Promise.all(
    ids.map((promoterId) => db.collection(PROMOTERS_COLLECTION).doc(String(promoterId)).get()),
  );
  return docs.reduce((map, doc) => {
    if (doc.exists) map.set(doc.id, { id: doc.id, ...doc.data() });
    return map;
  }, new Map());
}

async function generateUniqueCode(db) {
  for (let index = 0; index < 10; index += 1) {
    const code = Array.from(
      { length: 6 },
      () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
    ).join('');
    const existing = await db.collection(LINKS_COLLECTION).where('code', '==', code).limit(1).get();
    if (existing.empty) return code;
  }
  return randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
}

export async function createPromoterLink(payload) {
  const db = getAdminDb();
  const {
    promoterId,
    promoterName,
    eventId,
    eventTitle,
    campaignLabel,
    channel,
    ticketTierIds = [],
    commissionRate = 0,
    commissionType = 'percentage',
    expiresAt = null,
    promoterHandle = null,
  } = payload;

  const existingSnap = await db
    .collection(LINKS_COLLECTION)
    .where('promoterId', '==', promoterId)
    .limit(100)
    .get();
  const existingDoc = existingSnap.docs.find((doc) => {
    const data = doc.data() || {};
    return String(data.eventId || '') === String(eventId) && data.isActive === true;
  });

  if (existingDoc) {
    const eventMap = await loadEventsByIds([eventId]);
    const promoterMap = await loadPromotersByIds([promoterId]);
    const error = new Error('Active link already exists for this event');
    error.status = 409;
    error.data = {
      link: normalizeLink(
        existingDoc,
        eventMap.get(String(eventId)) || null,
        promoterMap.get(String(promoterId)) || null,
      ),
    };
    throw error;
  }

  const eventMap = await loadEventsByIds([eventId]);
  const event = eventMap.get(String(eventId)) || null;
  const promoterMap = await loadPromotersByIds([promoterId]);
  const promoter = promoterMap.get(String(promoterId)) || null;
  const resolvedPromoterHandle =
    normalizePromoterHandle(promoterHandle || promoter?.handle || promoter?.username || null) ||
    null;
  const code = await generateUniqueCode(db);
  const vanitySlug = sanitizeEditableSlug(campaignLabel || '') || String(code).toLowerCase();
  const vanityAlias = buildVanityAlias(promoterId, vanitySlug, code);
  const now = new Date().toISOString();
  const id = randomUUID();

  const record = {
    id,
    code,
    promoterId,
    promoterName: promoterName || 'Promoter',
    promoterHandle: resolvedPromoterHandle,
    vanitySlug,
    vanityAlias,
    eventId,
    eventTitle: eventTitle || event?.title || event?.name || 'Event',
    eventSlug: event?.slug || eventId,
    campaignLabel: campaignLabel || null,
    label: campaignLabel || null,
    channel: channel || null,
    ticketTierIds,
    commissionRate,
    commissionType,
    clicks: 0,
    conversions: 0,
    revenue: 0,
    commission: 0,
    isActive: true,
    status: 'active',
    expiresAt,
    createdAt: now,
    updatedAt: now,
    fullUrl: buildFullUrl(
      {
        eventId,
        eventSlug: event?.slug || eventId,
        code,
        channel,
        promoterHandle: resolvedPromoterHandle,
        vanityAlias,
      },
      event,
      { ...promoter, handle: resolvedPromoterHandle, username: resolvedPromoterHandle },
    ),
  };

  await db.collection(LINKS_COLLECTION).doc(id).set(record);
  return normalizeLink(record, event, promoter);
}

export async function getPromoterLinkByCode(code) {
  if (!code) return null;
  const db = getAdminDb();
  const snapshot = await db
    .collection(LINKS_COLLECTION)
    .where('code', '==', String(code).trim())
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  if (doc.data()?.isActive === false) return null;
  const [eventMap, promoterMap] = await Promise.all([
    loadEventsByIds([doc.data().eventId]),
    loadPromotersByIds([doc.data().promoterId]),
  ]);
  return normalizeLink(
    doc,
    eventMap.get(String(doc.data().eventId)) || null,
    promoterMap.get(String(doc.data().promoterId)) || null,
  );
}

export async function listPromoterLinks(filters = {}) {
  const db = getAdminDb();
  const { promoterId, eventId, linkId, isActive, limit = 50 } = filters;

  if (linkId) {
    const doc = await db.collection(LINKS_COLLECTION).doc(String(linkId)).get();
    if (!doc.exists) return [];
    const data = doc.data() || {};
    if (promoterId && String(data.promoterId || '') !== String(promoterId)) return [];
    const [eventMap, promoterMap] = await Promise.all([
      loadEventsByIds([data.eventId]),
      loadPromotersByIds([data.promoterId]),
    ]);
    const normalized = normalizeLink(
      doc,
      eventMap.get(String(data.eventId)) || null,
      promoterMap.get(String(data.promoterId)) || null,
    );
    if (eventId && String(normalized.eventId || '') !== String(eventId)) return [];
    if (typeof isActive === 'boolean' && normalized.isActive !== isActive) return [];
    return [normalized];
  }

  let query = db.collection(LINKS_COLLECTION);
  if (promoterId) {
    query = query.where('promoterId', '==', String(promoterId));
  } else if (eventId) {
    query = query.where('eventId', '==', String(eventId));
  }

  const queryLimit = Math.min(Math.max(Number(limit) || 50, 1), 300);
  const snapshot = await query
    .orderBy('createdAt', 'desc')
    .limit(queryLimit)
    .get()
    .catch(async (error) => {
      console.warn('[listPromoterLinks] Falling back to unordered query:', error?.message || error);
      return query.limit(queryLimit).get();
    });
  let docs = snapshot.docs;
  if (eventId && !promoterId) {
    docs = docs.filter((doc) => String(doc.data().eventId || '') === String(eventId));
  }
  if (eventId && promoterId) {
    docs = docs.filter((doc) => String(doc.data().eventId || '') === String(eventId));
  }
  if (typeof isActive === 'boolean') {
    docs = docs.filter((doc) => Boolean(doc.data().isActive) === isActive);
  }
  docs = docs.sort(
    (a, b) => getSortableTimestamp(b.data().createdAt) - getSortableTimestamp(a.data().createdAt),
  );
  const [eventMap, promoterMap] = await Promise.all([
    loadEventsByIds(docs.map((doc) => doc.data().eventId)),
    loadPromotersByIds(docs.map((doc) => doc.data().promoterId)),
  ]);
  return docs
    .slice(0, Math.min(Number(limit) || 50, 200))
    .map((doc) =>
      normalizeLink(
        doc,
        eventMap.get(String(doc.data().eventId)) || null,
        promoterMap.get(String(doc.data().promoterId)) || null,
      ),
    );
}

export async function getPromoterStats(promoterId) {
  const links = await listPromoterLinks({ promoterId, limit: 200 });
  const totalClicks = links.reduce((sum, link) => sum + Number(link.clicks || 0), 0);
  const totalConversions = links.reduce((sum, link) => sum + Number(link.conversions || 0), 0);
  const totalRevenue = links.reduce((sum, link) => sum + Number(link.revenue || 0), 0);
  const totalCommission = links.reduce((sum, link) => sum + Number(link.commission || 0), 0);
  const activeLinks = links.filter((link) => link.isActive).length;

  return {
    totalLinks: links.length,
    activeLinks,
    totalClicks,
    lifetimeClicks: totalClicks,
    totalConversions,
    totalSales: totalConversions,
    totalRevenue,
    totalCommission,
    totalEarnings: totalCommission,
    clearedCommission: totalCommission,
    conversionRate:
      totalClicks > 0 ? Number(((totalConversions / totalClicks) * 100).toFixed(2)) : 0,
  };
}

export async function getEventPromoterSummary(eventId) {
  const links = await listPromoterLinks({ eventId, limit: 200 });
  return {
    totalPromoters: new Set(links.map((link) => link.promoterId).filter(Boolean)).size,
    totalClicks: links.reduce((sum, link) => sum + Number(link.clicks || 0), 0),
    totalConversions: links.reduce((sum, link) => sum + Number(link.conversions || 0), 0),
    totalRevenue: links.reduce((sum, link) => sum + Number(link.revenue || 0), 0),
    totalCommission: links.reduce((sum, link) => sum + Number(link.commission || 0), 0),
  };
}

export async function deactivateLink(linkId) {
  const db = getAdminDb();
  const now = new Date().toISOString();
  await db.collection(LINKS_COLLECTION).doc(String(linkId)).update({
    isActive: false,
    status: 'deactivated',
    deactivatedAt: now,
    updatedAt: now,
  });
  return { success: true };
}

export async function reactivateLink(linkId) {
  const db = getAdminDb();
  const now = new Date().toISOString();
  await db.collection(LINKS_COLLECTION).doc(String(linkId)).update({
    isActive: true,
    status: 'active',
    deactivatedAt: null,
    updatedAt: now,
  });
  return { success: true };
}

export async function updatePromoterLinkAlias(linkId, promoterId, editableSlug) {
  const db = getAdminDb();
  const normalizedEditable = sanitizeEditableSlug(editableSlug);
  if (!normalizedEditable) {
    const error = new Error('Alias is required');
    error.status = 400;
    throw error;
  }

  const linkRef = db.collection(LINKS_COLLECTION).doc(String(linkId));
  const linkDoc = await linkRef.get();
  if (!linkDoc.exists) {
    const error = new Error('Link not found');
    error.status = 404;
    throw error;
  }

  const linkData = linkDoc.data() || {};
  if (String(linkData.promoterId || '') !== String(promoterId)) {
    const error = new Error('Forbidden');
    error.status = 403;
    throw error;
  }

  const vanityAlias = buildVanityAlias(promoterId, normalizedEditable, linkData.code || '');
  const conflictSnap = await db
    .collection(LINKS_COLLECTION)
    .where('vanityAlias', '==', vanityAlias)
    .limit(2)
    .get();
  const conflict = conflictSnap.docs.find((doc) => doc.id !== String(linkId));
  if (conflict) {
    const error = new Error('This link alias is already in use');
    error.status = 409;
    throw error;
  }

  await linkRef.update({
    vanitySlug: normalizedEditable,
    vanityAlias,
    updatedAt: new Date().toISOString(),
  });

  const [updated] = await listPromoterLinks({ linkId, promoterId, limit: 1 });
  return updated || null;
}

export async function recordLinkClick(code, source = null) {
  if (!code) return null;
  const db = getAdminDb();
  const snapshot = await db
    .collection(LINKS_COLLECTION)
    .where('code', '==', String(code).trim())
    .limit(1)
    .get();
  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  if (doc.data()?.isActive === false) return null;
  const payload = {
    clicks: FieldValue.increment(1),
    updatedAt: new Date().toISOString(),
    lastClickAt: new Date().toISOString(),
  };
  if (source) payload.lastClickSource = source;
  await doc.ref.update(payload);
  return { success: true, linkId: doc.id };
}

export async function listPromoterCommissions(promoterId) {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COMMISSIONS_COLLECTION)
    .where('promoterId', '==', String(promoterId))
    .orderBy('createdAt', 'desc')
    .limit(200)
    .get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: toIsoDate(doc.data().createdAt),
    updatedAt: toIsoDate(doc.data().updatedAt),
  }));
}

export async function getPromoterLinkAnalytics(linkId) {
  const db = getAdminDb();
  const linkDoc = await db.collection(LINKS_COLLECTION).doc(String(linkId)).get();
  if (!linkDoc.exists) {
    return {
      link: null,
      funnel: { clicks: 0, conversions: 0, revenue: 0, cleared: 0 },
      commissions: [],
    };
  }

  const rawLink = linkDoc.data() || {};
  const eventMap = await loadEventsByIds([rawLink.eventId]);
  const link = normalizeLink(linkDoc, eventMap.get(String(rawLink.eventId)) || null);

  const commissionsSnap = await db
    .collection(COMMISSIONS_COLLECTION)
    .where('linkId', '==', String(linkId))
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();

  const commissions = commissionsSnap.docs.map((doc) => {
    const data = doc.data() || {};
    return {
      id: doc.id,
      ...data,
      createdAt: toIsoDate(data.createdAt),
      updatedAt: toIsoDate(data.updatedAt),
    };
  });

  const cleared = commissions
    .filter((entry) =>
      ['cleared', 'paid', 'completed'].includes(String(entry.status || '').toLowerCase()),
    )
    .reduce((sum, entry) => sum + Number(entry.commissionAmount || 0), 0);

  return {
    link,
    funnel: {
      clicks: Number(link.clicks || 0),
      conversions: Number(link.conversions || 0),
      revenue: Number(link.revenue || 0),
      cleared,
    },
    commissions,
  };
}

export default {
  createPromoterLink,
  getPromoterLinkByCode,
  listPromoterLinks,
  getPromoterStats,
  getEventPromoterSummary,
  deactivateLink,
  reactivateLink,
  updatePromoterLinkAlias,
  recordLinkClick,
  listPromoterCommissions,
  getPromoterLinkAnalytics,
};
