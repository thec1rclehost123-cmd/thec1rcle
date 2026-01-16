/**
 * Notification Store
 * Manages user notifications for THE C1RCLE platform
 */

import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import { randomUUID } from "node:crypto";

const NOTIFICATIONS_COLLECTION = "notifications";
const FOLLOWS_COLLECTION = "follows";

// Fallback storage for development
let fallbackNotifications = [];
let fallbackFollows = [];

/**
 * Create a notification for a user
 */
export async function createNotification({
    userId,
    type,
    title,
    body,
    data = {},
    imageUrl = null
}) {
    const id = randomUUID();
    const now = new Date().toISOString();

    const notification = {
        id,
        userId,
        type,
        title,
        body,
        data,
        imageUrl,
        isRead: false,
        createdAt: now
    };

    if (!isFirebaseConfigured()) {
        fallbackNotifications.push(notification);
        return notification;
    }

    const db = getAdminDb();
    await db.collection(NOTIFICATIONS_COLLECTION).doc(id).set(notification);
    return notification;
}

/**
 * Create notifications for multiple users
 */
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
        createdAt: now
    }));

    if (!isFirebaseConfigured()) {
        fallbackNotifications.push(...notifications);
        return notifications;
    }

    const db = getAdminDb();
    const batch = db.batch();

    for (const notification of notifications) {
        const ref = db.collection(NOTIFICATIONS_COLLECTION).doc(notification.id);
        batch.set(ref, notification);
    }

    await batch.commit();
    return notifications;
}

/**
 * Get followers of a club or host
 */
export async function getFollowers(targetId, targetType = "venue") {
    if (!isFirebaseConfigured()) {
        return fallbackFollows
            .filter(f => f.targetId === targetId && f.targetType === targetType)
            .map(f => f.followerId);
    }

    const db = getAdminDb();
    const snapshot = await db.collection(FOLLOWS_COLLECTION)
        .where("targetId", "==", targetId)
        .where("targetType", "==", targetType)
        .get();

    return snapshot.docs.map(doc => doc.data().followerId);
}

/**
 * Notify followers when a new event is posted
 */
export async function notifyNewEvent(event) {
    const notifications = [];

    // Get host followers
    if (event.hostId) {
        const hostFollowers = await getFollowers(event.hostId, "host");
        if (hostFollowers.length > 0) {
            const hostNotifs = await createBulkNotifications(hostFollowers, {
                type: "new_event",
                title: `${event.host} just posted an event!`,
                body: event.title,
                data: {
                    eventId: event.id,
                    hostId: event.hostId,
                    action: "view_event"
                },
                imageUrl: event.image
            });
            notifications.push(...hostNotifs);
        }
    }

    // Get club followers (if event is at a venue)
    if (event.venueId) {
        const clubFollowers = await getFollowers(event.venueId, "venue");

        // Deduplicate - don't notify users who already got notified via host
        const hostFollowerSet = new Set(
            event.hostId ? await getFollowers(event.hostId, "host") : []
        );
        const uniqueVenueFollowers = clubFollowers.filter(f => !hostFollowerSet.has(f));

        if (uniqueVenueFollowers.length > 0) {
            const clubNotifs = await createBulkNotifications(uniqueVenueFollowers, {
                type: "new_event",
                title: `New event at ${event.venueName || "your followed venue"}`,
                body: `${event.host} is hosting: ${event.title}`,
                data: {
                    eventId: event.id,
                    venueId: event.venueId,
                    action: "view_event"
                },
                imageUrl: event.image
            });
            notifications.push(...clubNotifs);
        }
    }

    console.log(`[Notifications] Sent ${notifications.length} new event notifications for ${event.id}`);
    return notifications;
}

/**
 * Notify ticket holders about event updates
 */
export async function notifyEventUpdate(eventId, updateType, message, affectedUserIds = []) {
    if (affectedUserIds.length === 0) {
        // Get all users with tickets for this event
        if (!isFirebaseConfigured()) {
            return [];
        }

        const db = getAdminDb();
        const ordersSnapshot = await db.collection("orders")
            .where("eventId", "==", eventId)
            .where("status", "in", ["confirmed", "pending_payment"])
            .get();

        affectedUserIds = [...new Set(
            ordersSnapshot.docs
                .map(doc => doc.data().userId)
                .filter(Boolean)
        )];
    }

    if (affectedUserIds.length === 0) return [];

    const titleMap = {
        "time_change": "Event time has been updated",
        "venue_change": "Event venue has been updated",
        "cancelled": "Event has been cancelled",
        "postponed": "Event has been postponed",
        "reminder": "Event reminder"
    };

    return await createBulkNotifications(affectedUserIds, {
        type: `event_${updateType}`,
        title: titleMap[updateType] || "Event Update",
        body: message,
        data: {
            eventId,
            updateType,
            action: "view_event"
        }
    });
}

/**
 * Notify user about ticket purchase
 */
export async function notifyTicketPurchase(order) {
    if (!order.userId) return null;

    return await createNotification({
        userId: order.userId,
        type: "ticket_ready",
        title: "Your tickets are ready! 🎉",
        body: `${order.eventTitle} - Tap to view your QR code`,
        data: {
            orderId: order.id,
            eventId: order.eventId,
            action: "view_tickets"
        },
        imageUrl: order.eventImage
    });
}

/**
 * Get user's notifications
 */
export async function getUserNotifications(userId, { limit = 50, unreadOnly = false } = {}) {
    if (!isFirebaseConfigured()) {
        let results = fallbackNotifications.filter(n => n.userId === userId);
        if (unreadOnly) {
            results = results.filter(n => !n.isRead);
        }
        return results.sort((a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt)
        ).slice(0, limit);
    }

    const db = getAdminDb();
    let query = db.collection(NOTIFICATIONS_COLLECTION)
        .where("userId", "==", userId);

    if (unreadOnly) {
        query = query.where("isRead", "==", false);
    }

    const snapshot = await query
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(notificationId) {
    if (!isFirebaseConfigured()) {
        const notif = fallbackNotifications.find(n => n.id === notificationId);
        if (notif) notif.isRead = true;
        return notif;
    }

    const db = getAdminDb();
    await db.collection(NOTIFICATIONS_COLLECTION).doc(notificationId).update({
        isRead: true,
        readAt: new Date().toISOString()
    });

    return { id: notificationId, isRead: true };
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsRead(userId) {
    if (!isFirebaseConfigured()) {
        fallbackNotifications
            .filter(n => n.userId === userId)
            .forEach(n => { n.isRead = true; });
        return { updated: true };
    }

    const db = getAdminDb();
    const snapshot = await db.collection(NOTIFICATIONS_COLLECTION)
        .where("userId", "==", userId)
        .where("isRead", "==", false)
        .get();

    const batch = db.batch();
    const now = new Date().toISOString();

    for (const doc of snapshot.docs) {
        batch.update(doc.ref, { isRead: true, readAt: now });
    }

    await batch.commit();
    return { updated: snapshot.size };
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId) {
    if (!isFirebaseConfigured()) {
        return fallbackNotifications.filter(n =>
            n.userId === userId && !n.isRead
        ).length;
    }

    const db = getAdminDb();
    const snapshot = await db.collection(NOTIFICATIONS_COLLECTION)
        .where("userId", "==", userId)
        .where("isRead", "==", false)
        .count()
        .get();

    return snapshot.data().count;
}

/**
 * Follow a club or host
 */
export async function followEntity(followerId, targetId, targetType) {
    const id = `${followerId}_${targetId}`;
    const now = new Date().toISOString();

    const follow = {
        id,
        followerId,
        targetId,
        targetType,
        createdAt: now
    };

    if (!isFirebaseConfigured()) {
        const existing = fallbackFollows.find(f => f.id === id);
        if (!existing) {
            fallbackFollows.push(follow);
        }
        return follow;
    }

    const db = getAdminDb();
    await db.collection(FOLLOWS_COLLECTION).doc(id).set(follow, { merge: true });

    // Update follower count on the target
    const targetCollection = targetType === "venue" ? "venues" : "hosts";
    const { FieldValue } = require("firebase-admin/firestore");

    try {
        await db.collection(targetCollection).doc(targetId).update({
            followersCount: FieldValue.increment(1)
        });
    } catch (err) {
        console.warn(`[Notifications] Could not update follower count for ${targetType}:${targetId}`);
    }

    return follow;
}

/**
 * Unfollow a club or host
 */
export async function unfollowEntity(followerId, targetId, targetType) {
    const id = `${followerId}_${targetId}`;

    if (!isFirebaseConfigured()) {
        const index = fallbackFollows.findIndex(f => f.id === id);
        if (index >= 0) {
            fallbackFollows.splice(index, 1);
        }
        return { unfollowed: true };
    }

    const db = getAdminDb();
    await db.collection(FOLLOWS_COLLECTION).doc(id).delete();

    // Update follower count on the target
    const targetCollection = targetType === "venue" ? "venues" : "hosts";
    const { FieldValue } = require("firebase-admin/firestore");

    try {
        await db.collection(targetCollection).doc(targetId).update({
            followersCount: FieldValue.increment(-1)
        });
    } catch (err) {
        console.warn(`[Notifications] Could not update follower count for ${targetType}:${targetId}`);
    }

    return { unfollowed: true };
}

/**
 * Check if a user follows an entity
 */
export async function isFollowing(followerId, targetId) {
    const id = `${followerId}_${targetId}`;

    if (!isFirebaseConfigured()) {
        return fallbackFollows.some(f => f.id === id);
    }

    const db = getAdminDb();
    const doc = await db.collection(FOLLOWS_COLLECTION).doc(id).get();
    return doc.exists;
}
