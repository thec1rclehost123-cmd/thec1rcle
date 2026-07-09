import type { Firestore } from 'firebase-admin/firestore';
// @ts-ignore
import { getAdminDb, getAdminAuth } from '@c1rcle/core/admin';
// @ts-ignore
import {
  getUserNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '@c1rcle/core/guest-notification-engine';

// @ts-ignore
import {
  getUserProfile,
  findUserByEmail,
  getUserEvents,
  getUserTickets,
} from '@c1rcle/core/guest-profile-engine';
// @ts-ignore
import { invalidateGuestWallet as invalidateGuestWalletCache } from '@c1rcle/core/guest-wallet-profile-notification-service';
// @ts-ignore
import {
  getShareBundleByToken,
  getUserClaimedTickets,
  createShareBundle,
  claimTicketSlot,
  reclaimUnclaimedSlot,
  revokeClaimedTicket,
  cancelShareBundle,
  getOrderShareBundles,
  getOrderAssignments,
  initiateTransfer,
  acceptTransfer,
  cancelTransfer,
  getPendingTransfers,
  createPartnerClaimLink,
  claimPartnerSlot,
  getCoupleTicketStatus,
  cancelPartnerSlot,
  assignPartner,
  transferCoupleTicket,
} from '@c1rcle/core/ticket-share-engine';
// @ts-ignore
import { getOrderById } from '@c1rcle/core/order-engine';
// @ts-ignore
import { generateTicketPDF } from '@c1rcle/core/ticket-pdf-engine';

async function getEventById(eventId: string) {
  const db: Firestore = getAdminDb();
  const doc = await db.collection('events').doc(eventId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

export async function getGuestWallet(userId: string) {
  const profile = await getUserProfile(userId);
  const tickets = await getUserTickets(userId);
  const unreadCount = await getUnreadCount(userId);

  return {
    profile,
    notifications: { unreadCount },
    ...tickets,
  };
}

export async function invalidateGuestWallet(users: Array<string | null | undefined>) {
  await invalidateGuestWalletCache(users);
}

/**
 * O(1) ownership guard — single document lookup against the relevant collection.
 * Replaces the previous O(N) wallet-scan approach that fetched all tickets to verify one.
 *
 * Supports three ticket ID formats:
 *   ENT-*         → entitlements collection, ownerUserId field
 *   CLAIM-* / TRANS-* → ticket_assignments collection, redeemerId field
 *   {orderId}-{tierId}-{idx} → orders collection, userId field
 */
async function verifyTicketOwnershipDirect(userId: string, ticketId: string): Promise<true> {
  const db: Firestore = getAdminDb();

  if (ticketId.startsWith('ENT-')) {
    const doc = await db.collection('entitlements').doc(ticketId).get();
    if (!doc.exists || doc.data()?.ownerUserId !== userId) {
      throw new Error('Unauthorized: You do not own this ticket.');
    }
    return true;
  }

  if (ticketId.startsWith('CLAIM-') || ticketId.startsWith('TRANS-')) {
    const doc = await db.collection('ticket_assignments').doc(ticketId).get();
    if (!doc.exists || doc.data()?.redeemerId !== userId) {
      throw new Error('Unauthorized: You do not own this ticket.');
    }
    return true;
  }

  // Direct order ticket: {orderId}-{tierId}-{slotIndex}
  const parts = ticketId.split('-');
  if (parts.length >= 3) {
    const orderId = parts.slice(0, parts.length - 2).join('-');
    const doc = await db.collection('orders').doc(orderId).get();
    if (!doc.exists || doc.data()?.userId !== userId) {
      throw new Error('Unauthorized: You do not own this ticket.');
    }
    return true;
  }

  throw new Error('Unauthorized: Invalid ticket reference.');
}

export async function getGuestWalletTicket(db: any, auth: any, userId: string, ticketId: string) {
  const tickets = await getUserTickets(userId);
  const all = [
    ...(tickets.upcomingTickets || []),
    ...(tickets.pastTickets || []),
    ...(tickets.actionNeeded || []),
  ];
  const ticket = all.find((t: any) => t.ticketId === ticketId);

  if (!ticket) return null;

  if (ticket.status === 'active' && !ticket.genderMismatch && !ticket.isTransferPending) {
    if (ticket.entitlementId) {
      ticket.qrPayload = ticket.entitlementId;
    } else {
      ticket.qrMode = 'raw_id';
      ticket.qrPayload = ticket.id || ticket.ticketId;
      ticket.qrData = ticket.qrPayload;
    }
  }

  return ticket;
}

export async function getGuestProfileSummary(
  profileUserId: string,
  viewerUserId: string | null,
  matchingService?: any,
) {
  let isMatch = false;
  if (viewerUserId && matchingService) {
    isMatch = await matchingService.checkMutualMatch(viewerUserId, profileUserId);
  }

  const profile = await getUserProfile(profileUserId, viewerUserId, isMatch);
  if (!profile) return null;

  const eventsData = await getUserEvents(profileUserId, viewerUserId);

  return {
    profile: {
      ...profile,
      // Ensure core fields are explicitly mapped for the UI
      displayName: profile.displayName || 'C1RCLE User',
      photoURL: profile.photoURL || profile.avatar || null,
      bio: profile.bio || 'A fellow adventurer in THE C1RCLE.',
      socials: profile.socials || {},
    },
    events: eventsData,
    followersCount: profile.followersCount || 0,
    followingCount: profile.followingCount || 0,
    matchStatus: isMatch ? 'matched' : viewerUserId ? 'stranger' : 'none',
  };
}

export async function findGuestUserByEmail(email: string) {
  return findUserByEmail(email);
}

export async function previewGuestShareBundle(token: string, viewerUserId?: string | null) {
  const bundle = await getShareBundleByToken(token);
  if (!bundle) return null;

  const event = await getEventById(bundle.eventId);
  let existingAssignment = null;

  if (viewerUserId) {
    const claims = await getUserClaimedTickets(viewerUserId);
    existingAssignment = claims.find((claim: any) => claim.bundleId === bundle.id) || null;
  }

  return { ...bundle, event, existingAssignment };
}

export async function createGuestShareBundle(
  userId: string,
  payload: {
    orderId: string;
    eventId: string;
    quantity: number;
    tierId?: string | null;
    expiresAt?: string | null;
  },
) {
  // 🛡️ Security: Verify order ownership
  const order = await getOrderById(payload.orderId);
  if (!order || order.userId !== userId) {
    throw new Error('Unauthorized: Order not found or ownership mismatch.');
  }

  const bundle = await createShareBundle(
    payload.orderId,
    userId,
    payload.eventId,
    payload.quantity,
    payload.tierId ?? null,
    payload.expiresAt ?? null,
  );
  await invalidateGuestWallet([userId]);
  return bundle;
}

export async function getGuestShareState(orderId: string) {
  const order = await getOrderById(orderId);
  if (!order) return null;

  const [bundles, assignments] = await Promise.all([
    getOrderShareBundles(orderId),
    getOrderAssignments(orderId),
  ]);
  return { order, bundles, assignments };
}

export async function reclaimGuestShareSlot(userId: string, bundleId: string, slotIndex: number) {
  const result = await reclaimUnclaimedSlot(bundleId, userId, slotIndex);
  await invalidateGuestWallet([userId]);
  return result;
}

export async function revokeGuestShareSlot(userId: string, bundleId: string, slotIndex: number) {
  const result = await revokeClaimedTicket(bundleId, userId, slotIndex);
  await invalidateGuestWallet([userId, result?.revokedUserId || null]);
  return result;
}

export async function cancelGuestShareBundle(userId: string, bundleId: string) {
  const result = await cancelShareBundle(bundleId, userId);
  await invalidateGuestWallet([userId]);
  return result;
}

export async function claimGuestShareBundle(userId: string, token: string) {
  const result = await claimTicketSlot(token, userId);
  const ownerId = result?.assignment?.originalPurchaserId || null;
  await invalidateGuestWallet([userId, ownerId]);
  return result;
}

export async function initiateGuestTransfer(
  userId: string,
  ticketId: string,
  recipientEmail?: string | null,
) {
  await verifyTicketOwnershipDirect(userId, ticketId);

  // If a recipient email is provided, check gender restriction before initiating
  if (recipientEmail) {
    const db: Firestore = getAdminDb();
    const ticketData = await resolveTicketGenderRequirement(ticketId, db);
    if (ticketData.requiredGender && ticketData.requiredGender !== 'any') {
      const recipient = await findUserByEmail(recipientEmail);
      if (!recipient) {
        throw Object.assign(new Error('Recipient not found. Please check the email address.'), {
          statusCode: 404,
        });
      }
      const recipientGender = recipient.gender || null;
      const normalizedGender = recipientGender ? recipientGender.toLowerCase() : null;

      if (!normalizedGender || ['other', 'prefer_not_to_say'].includes(normalizedGender)) {
        const err = new Error(
          !normalizedGender
            ? 'Recipient has not set their gender and cannot receive restricted tickets.'
            : 'Recipient must update their gender in profile settings before receiving this ticket.',
        );
        (err as any).statusCode = 403;
        (err as any).code = 'GENDER_UPDATE_REQUIRED';
        throw err;
      }

      if (normalizedGender !== ticketData.requiredGender) {
        const err = new Error(
          `This ticket is restricted to ${ticketData.requiredGender} attendees only and cannot be transferred to this recipient.`,
        );
        (err as any).statusCode = 403;
        (err as any).code = 'GENDER_RESTRICTION';
        throw err;
      }
    }
  }

  const result = await initiateTransfer(ticketId, userId, recipientEmail ?? null);
  await invalidateGuestWallet([userId]);
  return result;
}

async function resolveTicketGenderRequirement(
  ticketId: string,
  db: Firestore,
): Promise<{ requiredGender: string | null }> {
  if (ticketId.startsWith('ENT-')) {
    const doc = await db.collection('entitlements').doc(ticketId).get();
    if (doc.exists) {
      const data = doc.data()!;
      return { requiredGender: data.genderRestriction || data.genderConstraint || null };
    }
    return { requiredGender: null };
  }

  if (ticketId.startsWith('CLAIM-') || ticketId.startsWith('TRANS-')) {
    const doc = await db.collection('ticket_assignments').doc(ticketId).get();
    if (doc.exists) {
      const data = doc.data()!;
      return { requiredGender: data.genderRestriction || data.requiredGender || null };
    }
    return { requiredGender: null };
  }

  const parts = ticketId.split('-');
  if (parts.length >= 3) {
    const orderId = parts.slice(0, parts.length - 2).join('-');
    const orderDoc = await db.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) return { requiredGender: null };

    const order = orderDoc.data()!;
    const tierId = parts[parts.length - 2];
    const sourceTicket = (order.tickets || []).find(
      (t: any) => t.ticketId === tierId || t.tierId === tierId,
    );

    if (sourceTicket?.genderRestriction || sourceTicket?.requiredGender) {
      return { requiredGender: sourceTicket.genderRestriction || sourceTicket.requiredGender };
    }

    const eventDoc = order.eventId ? await db.collection('events').doc(order.eventId).get() : null;
    const event = eventDoc?.exists ? eventDoc.data() : null;
    const eventTiers = event?.ticketCatalog?.tiers || event?.tickets || [];
    const eventTicket = eventTiers.find((t: any) => t.id === tierId);
    let inferred =
      eventTicket?.genderRestriction ||
      eventTicket?.genderRequirement ||
      eventTicket?.requiredGender ||
      eventTicket?.gender ||
      null;
    if (!inferred) {
      const entryType = String(eventTicket?.entryType || '').toLowerCase();
      if (entryType === 'female') inferred = 'female';
      else if (entryType === 'stag' || entryType === 'male') inferred = 'male';
    }

    return { requiredGender: inferred || sourceTicket?.genderRequirement || null };
  }

  return { requiredGender: null };
}

export async function acceptGuestTransfer(userId: string, transferCode: string) {
  const result = await acceptTransfer(transferCode, userId);
  await invalidateGuestWallet([userId]);
  return result;
}

export async function cancelGuestTransfer(userId: string, transferId: string) {
  const result = await cancelTransfer(transferId, userId);
  await invalidateGuestWallet([userId]);
  return result;
}

export async function getGuestPendingTransfers(userId: string, email?: string | null) {
  return getPendingTransfers(userId, email ?? null);
}

export async function createGuestPartnerClaimLink(
  userId: string,
  ticketId: string,
  eventId: string,
) {
  await verifyTicketOwnershipDirect(userId, ticketId);
  return createPartnerClaimLink(ticketId, userId, eventId);
}

export async function claimGuestPartnerSlot(userId: string, token: string) {
  const result = await claimPartnerSlot(token, userId);
  await invalidateGuestWallet([userId]);
  return result;
}

export async function assignGuestPartner(
  userId: string,
  ticketId: string,
  partnerUserId: string,
  metadata: Record<string, any> = {},
) {
  await verifyTicketOwnershipDirect(userId, ticketId);
  const result = await assignPartner(ticketId, userId, partnerUserId, metadata);
  await invalidateGuestWallet([userId, partnerUserId]);
  return result;
}

export async function transferGuestCoupleTicket(
  userId: string,
  ticketId: string,
  newOwnerId: string,
) {
  // Guard must run before calling the engine: transferCoupleTicket falls through to
  // using currentOwnerId as the check value when the doc does not yet exist, bypassing authz.
  const db: Firestore = getAdminDb();
  const doc = await db.collection('couple_assignments').doc(ticketId).get();
  if (!doc.exists || doc.data()?.ownerId !== userId) {
    throw new Error('Unauthorized: You do not own this couple ticket.');
  }
  const result = await transferCoupleTicket(ticketId, userId, newOwnerId);
  await invalidateGuestWallet([userId, newOwnerId]);
  return result;
}

export async function getGuestCoupleStatus(db: Firestore, userId: string, bundleId: string) {
  const bundleDoc = await db.collection('share_bundles').doc(bundleId).get();
  if (!bundleDoc.exists) return null;

  const bundle = bundleDoc.data() as any;
  const ownsBundle = bundle?.userId === userId;
  const isAssigned = Array.isArray(bundle?.slots)
    ? bundle.slots.some((slot: any) => slot.currentOwnerUserId === userId)
    : false;

  if (!ownsBundle && !isAssigned) {
    throw new Error('Unauthorized');
  }

  return getCoupleTicketStatus(bundleId);
}

export async function cancelGuestPartnerSlot(userId: string, bundleId: string) {
  const result = await cancelPartnerSlot(bundleId, userId);
  await invalidateGuestWallet([userId, result?.releasedPartnerId || null]);
  return result;
}

export async function previewGuestPairClaim(db: Firestore, token: string) {
  const snapshot = await db
    .collection('couple_claims')
    .where('token', '==', token)
    .where('status', '==', 'active')
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const claimDoc = snapshot.docs[0];
  const claim = { id: claimDoc.id, ...claimDoc.data() } as any;
  const event = claim.eventId ? await getEventById(claim.eventId) : null;

  return { ...claim, event };
}

export async function getGuestCoverWallet(db: Firestore, userId: string, orderId: string) {
  const [orderDoc, rsvpDoc] = await Promise.all([
    db.collection('orders').doc(orderId).get(),
    db.collection('rsvp_orders').doc(orderId).get(),
  ]);

  const ownedOrder =
    (orderDoc.exists && orderDoc.data()?.userId === userId && orderDoc) ||
    (rsvpDoc.exists && rsvpDoc.data()?.userId === userId && rsvpDoc) ||
    null;

  if (!ownedOrder) return null;

  const snapshot = await db.collection('cover_wallets').where('orderId', '==', orderId).get();

  return snapshot.docs.map((doc) => {
    const wallet = doc.data() as any;
    return {
      id: doc.id,
      state: wallet.state,
      openingBalancePaise: wallet.openingBalancePaise,
      currentBalancePaise: wallet.currentBalancePaise,
      totalDebitedPaise: wallet.totalDebitedPaise || 0,
      terminationTime: wallet.rules?.terminationTime || null,
      showBalance: wallet.rules?.showBalanceToGuest !== false,
      showHistory: wallet.rules?.showTransactionHistory !== false,
      eventId: wallet.eventId,
    };
  });
}

export async function getGuestCoverWalletsByOrderIds(
  db: Firestore,
  userId: string,
  orderIds: string[],
) {
  const uniqueOrderIds = Array.from(new Set((orderIds || []).filter(Boolean)));
  if (!uniqueOrderIds.length) return {};

  const ownershipChecks = await Promise.all(
    uniqueOrderIds.map(async (orderId) => {
      const [orderDoc, rsvpDoc] = await Promise.all([
        db.collection('orders').doc(orderId).get(),
        db.collection('rsvp_orders').doc(orderId).get(),
      ]);

      const owned =
        (orderDoc.exists && orderDoc.data()?.userId === userId) ||
        (rsvpDoc.exists && rsvpDoc.data()?.userId === userId);

      return owned ? orderId : null;
    }),
  );

  const ownedOrderIds = ownershipChecks.filter(Boolean) as string[];
  if (!ownedOrderIds.length) return {};

  const groups: Record<string, any[]> = {};
  const chunks = [];
  for (let index = 0; index < ownedOrderIds.length; index += 10) {
    chunks.push(ownedOrderIds.slice(index, index + 10));
  }

  await Promise.all(
    chunks.map(async (batchOrderIds) => {
      const snapshot = await db
        .collection('cover_wallets')
        .where('orderId', 'in', batchOrderIds)
        .get();

      snapshot.docs.forEach((doc) => {
        const wallet = doc.data() as any;
        const orderId = wallet.orderId;
        if (!orderId) return;
        if (!groups[orderId]) groups[orderId] = [];
        groups[orderId].push({
          id: doc.id,
          state: wallet.state,
          openingBalancePaise: wallet.openingBalancePaise,
          currentBalancePaise: wallet.currentBalancePaise,
          totalDebitedPaise: wallet.totalDebitedPaise || 0,
          terminationTime: wallet.rules?.terminationTime || null,
          showBalance: wallet.rules?.showBalanceToGuest !== false,
          showHistory: wallet.rules?.showTransactionHistory !== false,
          eventId: wallet.eventId,
        });
      });
    }),
  );

  return groups;
}

export async function generateGuestTicketDownload(userId: string, orderId: string) {
  const order = await getOrderById(orderId);
  if (!order || order.userId !== userId) return null;

  let eventName = order.eventTitle || 'Event';
  let eventDate = '';
  let eventTime = '';
  let location = '';

  if (order.eventId) {
    const event = await getEventById(order.eventId);
    if (event) {
      eventName = (event as any).title || eventName;
      location = (event as any).location || (event as any).venueLocation || '';

      const startDate = (event as any).startDate;
      if (startDate) {
        const date = startDate?.toDate ? startDate.toDate() : new Date(startDate);
        eventDate = date.toLocaleDateString('en-IN', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'Asia/Kolkata',
        });
        eventTime = date.toLocaleTimeString('en-IN', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'Asia/Kolkata',
        });
      }
    }
  }

  let userName = 'Guest';
  if (order.userId) {
    try {
      const db: Firestore = getAdminDb();
      const userDoc = await db.collection('users').doc(order.userId).get();
      const userData = userDoc.exists ? userDoc.data() : null;
      userName = userData?.displayName || userData?.name || 'Guest';
    } catch {
      userName = 'Guest';
    }
  }

  const tickets = (order.tickets || []).map((ticket: any) => ({
    name: ticket.tierName || ticket.name || 'Ticket',
    quantity: ticket.quantity || 1,
    price: ticket.price || 0,
  }));

  const buffer = generateTicketPDF({
    orderId: order.id,
    userName,
    eventName,
    eventDate,
    eventTime,
    location,
    tickets,
    totalAmount: order.totalAmount || 0,
    isRSVP: order.totalAmount === 0,
  });

  return {
    buffer,
    filename: `ticket-${orderId.substring(0, 8)}.pdf`,
  };
}

export async function getGuestNotifications(
  userId: string,
  options: { limit?: number; unreadOnly?: boolean } = {},
) {
  return getUserNotifications(userId, options);
}

export async function getGuestUnreadCount(userId: string) {
  return getUnreadCount(userId);
}

export async function markGuestNotificationRead(
  db: Firestore,
  userId: string,
  notificationId: string,
) {
  return markNotificationRead(notificationId);
}

export async function markAllGuestNotificationsRead(userId: string) {
  return markAllNotificationsRead(userId);
}

// @ts-ignore
import { getRecommendedEvents, getSimilarEvents } from '@c1rcle/core/recommendation-engine';
// @ts-ignore
import {
  getFeaturedEvents,
  getHomepageSelects,
  getHomepageInterviews,
} from '@c1rcle/core/homepage-curation-engine';

export async function getGuestRecommendedEvents(userId: string, limit: number = 5) {
  return getRecommendedEvents(userId, limit);
}

export async function getEventRecommendations(eventId: string, limit: number = 3) {
  return getSimilarEvents(eventId, limit);
}

export async function getGuestHomepageFeatured(limit: number = 6) {
  return getFeaturedEvents(limit);
}

export async function getGuestHomepageSelects() {
  return getHomepageSelects();
}

export async function getGuestHomepageInterviews() {
  return getHomepageInterviews();
}
