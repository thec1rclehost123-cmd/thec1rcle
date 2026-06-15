import {
  findUserByEmail,
  getUserEvents,
  getUserProfile,
  getUserTickets,
  invalidateTicketsCache,
} from './guest-profile-engine.js';
import {
  getUnreadCount,
  getUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './guest-notification-engine.js';
import { cacheDel, cacheGet, cacheSet } from '@c1rcle/core/redis';

const NOTIFICATIONS_COLLECTION = 'notifications';
const GUEST_WALLET_CACHE_TTL_SECONDS = 120;
const GUEST_PROFILE_EVENTS_CACHE_TTL_SECONDS = 120;
const GUEST_UNREAD_COUNT_CACHE_TTL_SECONDS = 30;

function hasDb(db) {
  return Boolean(db && typeof db.collection === 'function');
}

function chunk(values = [], size = 10) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function getWalletOrderIds(wallet = {}) {
  const orderIds = new Set();
  const buckets = [
    ...(wallet.upcomingTickets || []),
    ...(wallet.pastTickets || []),
    ...(wallet.actionNeeded || []),
    ...(wallet.cancelledTickets || []),
  ];

  for (const ticket of buckets) {
    const orderId = ticket?.orderId || ticket?.tickets?.[0]?.orderId || null;
    if (orderId) orderIds.add(orderId);
  }

  return Array.from(orderIds);
}

function mapCoverWallet(doc) {
  const wallet = doc.data() || {};
  return {
    id: doc.id,
    orderId: wallet.orderId || null,
    state: wallet.state,
    openingBalancePaise: wallet.openingBalancePaise,
    currentBalancePaise: wallet.currentBalancePaise,
    totalDebitedPaise: wallet.totalDebitedPaise || 0,
    terminationTime: wallet.rules?.terminationTime || null,
    eventId: wallet.eventId || null,
    rules: {
      terminationTime: wallet.rules?.terminationTime || null,
      showBalanceToGuest: wallet.rules?.showBalanceToGuest !== false,
      showTransactionHistory: wallet.rules?.showTransactionHistory !== false,
    },
  };
}

function getGuestWalletCacheKey(userId, hasCoverWalletContext = false) {
  return `guest:wallet:${userId}:${hasCoverWalletContext ? 'db' : 'nodb'}`;
}

function getGuestProfileEventsCacheKey(profileUserId, viewerUserId) {
  const scope = viewerUserId && viewerUserId === profileUserId ? 'self' : 'public';
  return `guest:profile-events:${profileUserId}:${scope}`;
}

function getGuestUnreadCountCacheKey(userId) {
  return `guest:notif-unread-count:${userId}`;
}

async function getCoverWalletsByOrder(db, wallet = {}) {
  if (!hasDb(db)) return {};

  const orderIds = getWalletOrderIds(wallet);
  if (!orderIds.length) return {};

  const groups = {};
  await Promise.all(
    chunk(orderIds, 10).map(async (batchOrderIds) => {
      const snapshot = await db
        .collection('cover_wallets')
        .where('orderId', 'in', batchOrderIds)
        .get();

      for (const doc of snapshot.docs) {
        const mapped = mapCoverWallet(doc);
        if (!mapped.orderId) continue;
        if (!groups[mapped.orderId]) groups[mapped.orderId] = [];
        groups[mapped.orderId].push(mapped);
      }
    }),
  );

  return groups;
}

export async function getGuestWallet(dbOrUserId, authOrOptions, maybeUserId) {
  const db = typeof dbOrUserId === 'string' ? null : dbOrUserId;
  const userId = typeof dbOrUserId === 'string' ? dbOrUserId : maybeUserId;
  const cacheKey = getGuestWalletCacheKey(userId, hasDb(db));
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const startedAt = Date.now();
  const [profile, tickets, unreadCount] = await Promise.all([
    getUserProfile(userId),
    getUserTickets(userId),
    getUnreadCount(userId),
  ]);
  const coverWalletsByOrder = await getCoverWalletsByOrder(db, tickets);

  const wallet = {
    profile,
    notifications: { unreadCount },
    coverWalletsByOrder,
    ...tickets,
  };

  await cacheSet(cacheKey, wallet, GUEST_WALLET_CACHE_TTL_SECONDS);
  const durationMs = Date.now() - startedAt;
  if (durationMs >= 150) {
    console.info(`[guest-wallet] built wallet for ${userId} in ${durationMs}ms`);
  }

  return wallet;
}

export async function getGuestWalletTicket(dbOrUserId, authOrTicketId, maybeUserId, maybeTicketId) {
  const userId = typeof dbOrUserId === 'string' ? dbOrUserId : maybeUserId;
  const ticketId = typeof dbOrUserId === 'string' ? authOrTicketId : maybeTicketId;
  const tickets = await getUserTickets(userId);
  const ticket = findGuestWalletTicket(tickets, ticketId);

  if (ticket && ticket.status === 'active' && !ticket.genderMismatch && !ticket.isTransferPending) {
    if (ticket.entitlementId) {
      ticket.qrPayload = ticket.entitlementId;
    } else {
      // Import here to avoid circular dependency or heavy boot
      const { signTicketId } = await import('./ticket-engine.js');
      ticket.qrPayload = signTicketId(ticket.ticketId);
    }
  }

  return ticket;
}

export function findGuestWalletTicket(wallet = {}, ticketId) {
  const allTickets = [
    ...(wallet.upcomingTickets || []),
    ...(wallet.pastTickets || []),
    ...(wallet.actionNeeded || []),
    ...(wallet.cancelledTickets || []),
  ];
  return (
    allTickets.find((ticket) => ticket.ticketId === ticketId || ticket.id === ticketId) || null
  );
}

export async function invalidateGuestWallet(users = []) {
  await Promise.all(
    users
      .filter(Boolean)
      .flatMap((userId) => [
        invalidateTicketsCache(userId),
        cacheDel(getGuestWalletCacheKey(userId, true)),
        cacheDel(getGuestWalletCacheKey(userId, false)),
      ]),
  );
}

export async function findGuestUserByEmail(dbOrEmail, maybeEmail) {
  const db = typeof dbOrEmail === 'string' ? null : dbOrEmail;
  const email = typeof dbOrEmail === 'string' ? dbOrEmail : maybeEmail;
  if (!email) return null;

  if (hasDb(db)) {
    const snapshot = await db.collection('users').where('email', '==', email).limit(1).get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { uid: doc.id, id: doc.id, ...doc.data() };
  }

  return findUserByEmail(email);
}

export async function getGuestProfileSummary(
  dbOrProfileUserId,
  authOrViewerUserId,
  maybeProfileUserId,
  maybeViewerUserId,
) {
  const profileUserId =
    typeof dbOrProfileUserId === 'string' ? dbOrProfileUserId : maybeProfileUserId;
  const viewerUserId =
    typeof dbOrProfileUserId === 'string' ? authOrViewerUserId : maybeViewerUserId;
  const profile = await getUserProfile(profileUserId, viewerUserId || null);
  if (!profile) return { profile: null, events: { upcoming: [], attended: [] } };

  const eventsCacheKey = getGuestProfileEventsCacheKey(profileUserId, viewerUserId || null);
  let events = await cacheGet(eventsCacheKey);
  if (!events) {
    const startedAt = Date.now();
    events = await getUserEvents(profileUserId, viewerUserId || null);
    await cacheSet(eventsCacheKey, events, GUEST_PROFILE_EVENTS_CACHE_TTL_SECONDS);
    const durationMs = Date.now() - startedAt;
    if (durationMs >= 150) {
      console.info(`[guest-profile] built events summary for ${profileUserId} in ${durationMs}ms`);
    }
  }

  return {
    profile: {
      id: profile.id || profile.uid || profileUserId,
      uid: profile.uid || profile.id || profileUserId,
      displayName: profile.displayName || profile.name || 'C1RCLE User',
      email: profileUserId === viewerUserId ? profile.email || null : undefined,
      photoURL: profile.photoURL || profile.avatar || null,
      avatar: profile.photoURL || profile.avatar || null,
      bio: profile.bio || 'A fellow adventurer in THE C1RCLE.',
      city: profile.city || null,
      gender: profile.gender || null,
      hostStatus: profile.hostStatus || null,
      socials: profile.socials || {},
      createdAt: profile.createdAt || null,
    },
    events,
    followersCount: profile.followersCount || 0,
    followingCount: profile.followingCount || 0,
  };
}

export async function getGuestNotifications(dbOrUserId, maybeUserIdOrOptions, maybeOptions = {}) {
  const db = typeof dbOrUserId === 'string' ? null : dbOrUserId;
  const userId = typeof dbOrUserId === 'string' ? dbOrUserId : maybeUserIdOrOptions;
  const options = typeof dbOrUserId === 'string' ? maybeUserIdOrOptions || {} : maybeOptions;
  const limit = Math.max(1, Math.min(Number(options.limit) || 50, 100));
  const unreadOnly = Boolean(options.unreadOnly);

  if (hasDb(db)) {
    let query = db.collection(NOTIFICATIONS_COLLECTION).where('userId', '==', userId);
    if (unreadOnly) query = query.where('isRead', '==', false);
    const snapshot = await query.orderBy('createdAt', 'desc').limit(limit).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  return getUserNotifications(userId, { limit, unreadOnly });
}

export async function getGuestUnreadCount(dbOrUserId, maybeUserId) {
  const db = typeof dbOrUserId === 'string' ? null : dbOrUserId;
  const userId = typeof dbOrUserId === 'string' ? dbOrUserId : maybeUserId;
  const cacheKey = getGuestUnreadCountCacheKey(userId);
  const cached = await cacheGet(cacheKey);
  if (typeof cached === 'number') {
    return cached;
  }

  let unreadCount = 0;
  if (hasDb(db)) {
    const snapshot = await db
      .collection(NOTIFICATIONS_COLLECTION)
      .where('userId', '==', userId)
      .where('isRead', '==', false)
      .count()
      .get();
    unreadCount = snapshot.data().count;
  } else {
    unreadCount = await getUnreadCount(userId);
  }

  await cacheSet(cacheKey, unreadCount, GUEST_UNREAD_COUNT_CACHE_TTL_SECONDS);
  return unreadCount;
}

export async function markGuestNotificationRead(
  dbOrUserId,
  maybeUserIdOrNotificationId,
  maybeNotificationId,
) {
  const db = typeof dbOrUserId === 'string' ? null : dbOrUserId;
  const userId = typeof dbOrUserId === 'string' ? dbOrUserId : maybeUserIdOrNotificationId;
  const notificationId =
    typeof dbOrUserId === 'string' ? maybeUserIdOrNotificationId : maybeNotificationId;

  if (hasDb(db)) {
    const ref = db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId);
    const doc = await ref.get();
    if (!doc.exists) return null;
    if (doc.data()?.userId !== userId) {
      throw new Error('Unauthorized notification update');
    }
    const readAt = new Date().toISOString();
    await ref.update({ isRead: true, readAt });
    await cacheDel(getGuestUnreadCountCacheKey(userId));
    return { id: notificationId, isRead: true, readAt };
  }

  return markNotificationRead(notificationId);
}

export async function markAllGuestNotificationsRead(dbOrUserId, maybeUserId) {
  const db = typeof dbOrUserId === 'string' ? null : dbOrUserId;
  const userId = typeof dbOrUserId === 'string' ? dbOrUserId : maybeUserId;

  if (hasDb(db)) {
    const snapshot = await db
      .collection(NOTIFICATIONS_COLLECTION)
      .where('userId', '==', userId)
      .where('isRead', '==', false)
      .get();
    const batch = db.batch();
    const readAt = new Date().toISOString();
    for (const doc of snapshot.docs) {
      batch.update(doc.ref, { isRead: true, readAt });
    }
    await batch.commit();
    await cacheDel(getGuestUnreadCountCacheKey(userId));
    return { updated: snapshot.size };
  }

  return markAllNotificationsRead(userId);
}
