import type { Firestore } from 'firebase-admin/firestore';

async function loadProfileStore() {
    // @ts-expect-error legacy Guest Portal store has no TypeScript declarations yet
    return import('../../../guest-portal/lib/server/profileStore.js');
}

async function loadTicketShareStore() {
    // @ts-expect-error legacy Guest Portal store has no TypeScript declarations yet
    return import('../../../guest-portal/lib/server/ticketShareStore.js');
}

async function loadEventStore() {
    // @ts-expect-error legacy Guest Portal store has no TypeScript declarations yet
    return import('../../../guest-portal/lib/server/eventStore.js');
}

async function loadOrderStore() {
    // @ts-expect-error legacy Guest Portal store has no TypeScript declarations yet
    return import('../../../guest-portal/lib/server/orderStore.js');
}

async function loadNotificationStore() {
    // @ts-expect-error legacy Guest Portal store has no TypeScript declarations yet
    return import('../../../guest-portal/lib/server/notificationStore.js');
}

async function loadPdfGenerator() {
    // @ts-expect-error legacy Guest Portal utility has no TypeScript declarations yet
    return import('../../../guest-portal/lib/email/generateTicketPDF.js');
}

export async function getGuestWallet(userId: string) {
    const { getUserTickets } = await loadProfileStore();
    return getUserTickets(userId);
}

export async function invalidateGuestWallet(users: Array<string | null | undefined>) {
    const { invalidateTicketsCache } = await loadProfileStore();
    await Promise.all(
        [...new Set(users.filter(Boolean))]
            .map((userId) => invalidateTicketsCache(userId).catch(() => undefined))
    );
}

export async function getGuestWalletTicket(userId: string, ticketId: string) {
    const wallet = await getGuestWallet(userId);
    const buckets = [
        ...(wallet?.upcomingTickets || []),
        ...(wallet?.pastTickets || []),
        ...(wallet?.actionNeeded || []),
        ...(wallet?.cancelledTickets || []),
    ];

    return buckets.find((entry: any) => entry.ticketId === ticketId || entry.id === ticketId) || null;
}

export async function getGuestProfileSummary(profileUserId: string, viewerUserId: string | null) {
    const { getUserProfile, getUserEvents } = await loadProfileStore();
    const [profile, events] = await Promise.all([
        getUserProfile(profileUserId),
        getUserEvents(profileUserId, viewerUserId),
    ]);
    return { profile, events };
}

export async function findGuestUserByEmail(email: string) {
    const { findUserByEmail } = await loadProfileStore();
    return findUserByEmail(email);
}

export async function previewGuestShareBundle(token: string, viewerUserId?: string | null) {
    const { getShareBundleByToken, getUserClaimedTickets } = await loadTicketShareStore();
    const { getEvent } = await loadEventStore();

    const bundle = await getShareBundleByToken(token);
    if (!bundle) return null;

    const event = await getEvent(bundle.eventId);
    let existingAssignment = null;

    if (viewerUserId) {
        const claims = await getUserClaimedTickets(viewerUserId);
        existingAssignment = claims.find((claim: any) => claim.bundleId === bundle.id) || null;
    }

    return { ...bundle, event, existingAssignment };
}

export async function createGuestShareBundle(userId: string, payload: {
    orderId: string;
    eventId: string;
    quantity: number;
    tierId?: string | null;
    expiresAt?: string | null;
}) {
    const { createShareBundle } = await loadTicketShareStore();
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
    const { getOrderById } = await loadOrderStore();
    const order = await getOrderById(orderId);
    if (!order) return null;

    const { getOrderShareBundles, getOrderAssignments } = await loadTicketShareStore();
    const [bundles, assignments] = await Promise.all([
        getOrderShareBundles(orderId),
        getOrderAssignments(orderId),
    ]);
    return { order, bundles, assignments };
}

export async function reclaimGuestShareSlot(userId: string, bundleId: string, slotIndex: number) {
    const { reclaimUnclaimedSlot } = await loadTicketShareStore();
    const result = await reclaimUnclaimedSlot(bundleId, userId, slotIndex);
    await invalidateGuestWallet([userId]);
    return result;
}

export async function cancelGuestShareBundle(userId: string, bundleId: string) {
    const { cancelShareBundle } = await loadTicketShareStore();
    const result = await cancelShareBundle(bundleId, userId);
    await invalidateGuestWallet([userId]);
    return result;
}

export async function claimGuestShareBundle(userId: string, token: string) {
    const { claimTicketSlot } = await loadTicketShareStore();
    const result = await claimTicketSlot(token, userId);
    const ownerId = result?.assignment?.originalPurchaserId || null;
    await invalidateGuestWallet([userId, ownerId]);
    return result;
}

export async function initiateGuestTransfer(userId: string, ticketId: string, recipientEmail?: string | null) {
    const { initiateTransfer } = await loadTicketShareStore();
    const result = await initiateTransfer(ticketId, userId, recipientEmail ?? null);
    await invalidateGuestWallet([userId]);
    return result;
}

export async function acceptGuestTransfer(userId: string, transferCode: string) {
    const { acceptTransfer } = await loadTicketShareStore();
    const result = await acceptTransfer(transferCode, userId);
    await invalidateGuestWallet([userId]);
    return result;
}

export async function cancelGuestTransfer(userId: string, transferId: string) {
    const { cancelTransfer } = await loadTicketShareStore();
    const result = await cancelTransfer(transferId, userId);
    await invalidateGuestWallet([userId]);
    return result;
}

export async function getGuestPendingTransfers(userId: string, email?: string | null) {
    const { getPendingTransfers } = await loadTicketShareStore();
    return getPendingTransfers(userId, email ?? null);
}

export async function createGuestPartnerClaimLink(userId: string, ticketId: string, eventId: string) {
    const { createPartnerClaimLink } = await loadTicketShareStore();
    return createPartnerClaimLink(ticketId, userId, eventId);
}

export async function claimGuestPartnerSlot(userId: string, token: string) {
    const { claimPartnerSlot } = await loadTicketShareStore();
    const result = await claimPartnerSlot(token, userId);
    await invalidateGuestWallet([userId]);
    return result;
}

export async function assignGuestPartner(userId: string, ticketId: string, partnerUserId: string, metadata: Record<string, any> = {}) {
    const { assignPartner } = await loadTicketShareStore();
    const result = await assignPartner(ticketId, userId, partnerUserId, metadata);
    await invalidateGuestWallet([userId, partnerUserId]);
    return result;
}

export async function transferGuestCoupleTicket(userId: string, ticketId: string, newOwnerId: string) {
    const { transferCoupleTicket } = await loadTicketShareStore();
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

    const { getCoupleTicketStatus } = await loadTicketShareStore();
    return getCoupleTicketStatus(bundleId);
}

export async function cancelGuestPartnerSlot(userId: string, bundleId: string) {
    const { cancelPartnerSlot } = await loadTicketShareStore();
    const result = await cancelPartnerSlot(bundleId, userId);
    await invalidateGuestWallet([userId, result?.releasedPartnerId || null]);
    return result;
}

export async function previewGuestPairClaim(db: Firestore, token: string) {
    const snapshot = await db.collection('couple_claims')
        .where('token', '==', token)
        .where('status', '==', 'active')
        .limit(1)
        .get();

    if (snapshot.empty) return null;

    const claimDoc = snapshot.docs[0];
    const claim = { id: claimDoc.id, ...claimDoc.data() } as any;
    const { getEvent } = await loadEventStore();
    const event = claim.eventId ? await getEvent(claim.eventId) : null;

    return {
        ...claim,
        event,
    };
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

    const snapshot = await db.collection('cover_wallets')
        .where('orderId', '==', orderId)
        .get();

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

export async function generateGuestTicketDownload(userId: string, orderId: string) {
    const { getOrderById } = await loadOrderStore();
    const { getEvent } = await loadEventStore();
    const { getUserProfile } = await loadProfileStore();
    const { generateTicketPDF } = await loadPdfGenerator();

    const order = await getOrderById(orderId);
    if (!order || order.userId !== userId) return null;

    let eventName = order.eventTitle || 'Event';
    let eventDate = '';
    let eventTime = '';
    let location = '';

    if (order.eventId) {
        const event = await getEvent(order.eventId);
        if (event) {
            eventName = event.title || eventName;
            location = event.location || event.venueLocation || '';

            if (event.startDate) {
                const date = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
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
            const profile = await getUserProfile(order.userId);
            userName = profile?.displayName || profile?.name || 'Guest';
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

export async function getGuestNotifications(userId: string, options: { limit?: number; unreadOnly?: boolean } = {}) {
    const { getUserNotifications } = await loadNotificationStore();
    return getUserNotifications(userId, options);
}

export async function getGuestUnreadCount(userId: string) {
    const { getUnreadCount } = await loadNotificationStore();
    return getUnreadCount(userId);
}

export async function markGuestNotificationRead(db: Firestore, userId: string, notificationId: string) {
    const notificationDoc = await db.collection('notifications').doc(notificationId).get();
    if (!notificationDoc.exists) return null;
    if (notificationDoc.data()?.userId !== userId) {
        throw new Error('Unauthorized');
    }

    const { markNotificationRead } = await loadNotificationStore();
    return markNotificationRead(notificationId);
}

export async function markAllGuestNotificationsRead(userId: string) {
    const { markAllNotificationsRead } = await loadNotificationStore();
    return markAllNotificationsRead(userId);
}
