import { randomUUID } from 'node:crypto';
import { getAdminDb, isFirebaseConfigured } from './admin.js';
import { getFollowers } from './follow-graph-engine.js';

const NOTIFICATIONS_COLLECTION = 'notifications';

const fallbackNotifications = [];

export async function createNotification({ userId, type, title, body, data = {}, imageUrl = null }) {
    const id = randomUUID();
    const now = new Date().toISOString();

    const notification = { id, userId, type, title, body, data, imageUrl, isRead: false, createdAt: now };

    if (!isFirebaseConfigured()) {
        fallbackNotifications.push(notification);
        return notification;
    }

    const db = getAdminDb();
    await db.collection(NOTIFICATIONS_COLLECTION).doc(id).set(notification);
    return notification;
}

export async function createBulkNotifications(userIds, { type, title, body, data, imageUrl }) {
    const now = new Date().toISOString();
    const notifications = userIds.map(userId => ({
        id: randomUUID(),
        userId,
        type,
        title,
        body,
        data: data || {},
        imageUrl,
        isRead: false,
        createdAt: now,
    }));

    if (!isFirebaseConfigured()) {
        fallbackNotifications.push(...notifications);
        return notifications;
    }

    const db = getAdminDb();
    const batch = db.batch();
    for (const notification of notifications) {
        batch.set(db.collection(NOTIFICATIONS_COLLECTION).doc(notification.id), notification);
    }
    await batch.commit();
    return notifications;
}

export async function getUserNotifications(userId, { limit = 50, unreadOnly = false } = {}) {
    if (!isFirebaseConfigured()) {
        let results = fallbackNotifications.filter(n => n.userId === userId);
        if (unreadOnly) results = results.filter(n => !n.isRead);
        return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
    }

    const db = getAdminDb();
    let query = db.collection(NOTIFICATIONS_COLLECTION).where('userId', '==', userId);
    if (unreadOnly) query = query.where('isRead', '==', false);

    const snapshot = await query.orderBy('createdAt', 'desc').limit(limit).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function markNotificationRead(notificationId) {
    if (!isFirebaseConfigured()) {
        const notif = fallbackNotifications.find(n => n.id === notificationId);
        if (notif) notif.isRead = true;
        return notif;
    }

    const db = getAdminDb();
    await db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId).update({
        isRead: true,
        readAt: new Date().toISOString(),
    });
    return { id: notificationId, isRead: true };
}

export async function markAllNotificationsRead(userId) {
    if (!isFirebaseConfigured()) {
        fallbackNotifications.filter(n => n.userId === userId).forEach(n => { n.isRead = true; });
        return { updated: true };
    }

    const db = getAdminDb();
    const snapshot = await db.collection(NOTIFICATIONS_COLLECTION)
        .where('userId', '==', userId)
        .where('isRead', '==', false)
        .get();

    const batch = db.batch();
    const now = new Date().toISOString();
    for (const doc of snapshot.docs) {
        batch.update(doc.ref, { isRead: true, readAt: now });
    }
    await batch.commit();
    return { updated: snapshot.size };
}

export async function getUnreadCount(userId) {
    if (!isFirebaseConfigured()) {
        return fallbackNotifications.filter(n => n.userId === userId && !n.isRead).length;
    }

    const db = getAdminDb();
    const snapshot = await db.collection(NOTIFICATIONS_COLLECTION)
        .where('userId', '==', userId)
        .where('isRead', '==', false)
        .count()
        .get();

    return snapshot.data().count;
}

export async function notifyNewEvent(event) {
    const notifications = [];

    if (event.hostId) {
        const hostFollowers = await getFollowers(event.hostId, 'host');
        if (hostFollowers.length > 0) {
            const hostNotifs = await createBulkNotifications(hostFollowers, {
                type: 'new_event',
                title: `${event.host} just posted an event!`,
                body: event.title,
                data: { eventId: event.id, hostId: event.hostId, action: 'view_event' },
                imageUrl: event.image,
            });
            notifications.push(...hostNotifs);
        }
    }

    if (event.venueId) {
        const clubFollowers = await getFollowers(event.venueId, 'venue');
        const hostFollowerSet = new Set(
            event.hostId ? await getFollowers(event.hostId, 'host') : []
        );
        const uniqueVenueFollowers = clubFollowers.filter(f => !hostFollowerSet.has(f));

        if (uniqueVenueFollowers.length > 0) {
            const clubNotifs = await createBulkNotifications(uniqueVenueFollowers, {
                type: 'new_event',
                title: `New event at ${event.venueName || 'your followed venue'}`,
                body: `${event.host} is hosting: ${event.title}`,
                data: { eventId: event.id, venueId: event.venueId, action: 'view_event' },
                imageUrl: event.image,
            });
            notifications.push(...clubNotifs);
        }
    }

    return notifications;
}

export async function notifyEventUpdate(eventId, updateType, message, affectedUserIds = []) {
    if (affectedUserIds.length === 0) {
        if (!isFirebaseConfigured()) return [];

        const db = getAdminDb();
        const ordersSnapshot = await db.collection('orders')
            .where('eventId', '==', eventId)
            .where('status', 'in', ['confirmed', 'payment_pending', 'pending_payment'])
            .get();

        affectedUserIds = [...new Set(
            ordersSnapshot.docs.map(doc => doc.data().userId).filter(Boolean)
        )];
    }

    if (affectedUserIds.length === 0) return [];

    const titleMap = {
        time_change: 'Event time has been updated',
        venue_change: 'Event venue has been updated',
        cancelled: 'Event has been cancelled',
        postponed: 'Event has been postponed',
        reminder: 'Event reminder',
    };

    return createBulkNotifications(affectedUserIds, {
        type: `event_${updateType}`,
        title: titleMap[updateType] || 'Event Update',
        body: message,
        data: { eventId, updateType, action: 'view_event' },
    });
}

export async function notifyTicketPurchase(order) {
    if (!order.userId) return null;
    return createNotification({
        userId: order.userId,
        type: 'ticket_ready',
        title: 'Your tickets are ready!',
        body: `${order.eventTitle} - Tap to view your QR code`,
        data: { orderId: order.id, eventId: order.eventId, action: 'view_tickets' },
        imageUrl: order.eventImage,
    });
}

export async function notifyRefundProcessed(order) {
    if (!order.userId) return null;
    return createNotification({
        userId: order.userId,
        type: 'refund_processed',
        title: 'Your refund has been processed',
        body: `Your refund for ${order.eventTitle || 'your order'} is on its way.`,
        data: { orderId: order.id, eventId: order.eventId, action: 'view_orders' },
    });
}
