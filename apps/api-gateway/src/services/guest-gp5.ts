import type { Firestore } from 'firebase-admin/firestore';
// @ts-ignore
import { getAdminDb, getAdminAuth } from '@c1rcle/core/admin';
// @ts-ignore
import {
    getUserNotifications,
    getUnreadCount,
    markNotificationRead,
    markAllNotificationsRead
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
        ...tickets
    };
}

export async function invalidateGuestWallet(users: Array<string | null | undefined>) {
    await invalidateGuestWalletCache(users);
}

export async function getGuestWalletTicket(db: any, auth: any, userId: string, ticketId: string) {
    const tickets = await getUserTickets(userId);
    const all = [...(tickets.upcomingTickets || []), ...(tickets.pastTickets || []), ...(tickets.actionNeeded || [])];
    const ticket = all.find((t: any) => t.ticketId === ticketId);

    if (!ticket) return null;

    // Enforce On-Demand Signing
    // We only sign the ID when the user specifically requests the detail
    if (ticket.status === 'active' && !ticket.genderMismatch && !ticket.isTransferPending) {
        if (ticket.entitlementId) {
            ticket.qrPayload = ticket.entitlementId;
        } else {
            const { signTicketId } = await import('@c1rcle/core/ticket-engine');
            ticket.qrPayload = signTicketId(ticket.ticketId);
        }
    }

    return ticket;
}

export async function getGuestProfileSummary(profileUserId: string, viewerUserId: string | null, matchingService?: any) {
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
            displayName: profile.displayName || "C1RCLE User",
            photoURL: profile.photoURL || profile.avatar || null,
            bio: profile.bio || "A fellow adventurer in THE C1RCLE.",
            socials: profile.socials || {},
        },
        events: eventsData,
        followersCount: profile.followersCount || 0,
        followingCount: profile.followingCount || 0,
        matchStatus: isMatch ? 'matched' : (viewerUserId ? 'stranger' : 'none')
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

export async function createGuestShareBundle(userId: string, payload: {
    orderId: string;
    eventId: string;
    quantity: number;
    tierId?: string | null;
    expiresAt?: string | null;
}) {
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

export async function initiateGuestTransfer(userId: string, ticketId: string, recipientEmail?: string | null) {
    const result = await initiateTransfer(ticketId, userId, recipientEmail ?? null);
    await invalidateGuestWallet([userId]);
    return result;
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

export async function createGuestPartnerClaimLink(userId: string, ticketId: string, eventId: string) {
    return createPartnerClaimLink(ticketId, userId, eventId);
}

export async function claimGuestPartnerSlot(userId: string, token: string) {
    const result = await claimPartnerSlot(token, userId);
    await invalidateGuestWallet([userId]);
    return result;
}

export async function assignGuestPartner(userId: string, ticketId: string, partnerUserId: string, metadata: Record<string, any> = {}) {
    const result = await assignPartner(ticketId, userId, partnerUserId, metadata);
    await invalidateGuestWallet([userId, partnerUserId]);
    return result;
}

export async function transferGuestCoupleTicket(userId: string, ticketId: string, newOwnerId: string) {
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
    const snapshot = await db.collection('couple_claims')
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
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata',
                });
                eventTime = date.toLocaleTimeString('en-IN', {
                    hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata',
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

export async function getGuestNotifications(userId: string, options: { limit?: number; unreadOnly?: boolean } = {}) {
    return getUserNotifications(userId, options);
}

export async function getGuestUnreadCount(userId: string) {
    return getUnreadCount(userId);
}

export async function markGuestNotificationRead(db: Firestore, userId: string, notificationId: string) {
    return markNotificationRead(notificationId);
}

export async function markAllGuestNotificationsRead(userId: string) {
    return markAllNotificationsRead(userId);
}

// @ts-ignore
import { getRecommendedEvents, getSimilarEvents } from '@c1rcle/core/recommendation-engine';
// @ts-ignore
import { getFeaturedEvents, getHomepageSelects, getHomepageInterviews } from '@c1rcle/core/homepage-curation-engine';

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
