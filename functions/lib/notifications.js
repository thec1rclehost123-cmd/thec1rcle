'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyDmRequest = exports.notifyChatMessage = exports.notifyEventUpdated = exports.sendEventReminders = exports.notifyTicketTransferred = exports.notifyOrderConfirmed = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const messaging_1 = require("firebase-admin/messaging");
const firestore_2 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
if ((0, app_1.getApps)().length === 0) {
    (0, app_1.initializeApp)();
}
const db = (0, firestore_1.getFirestore)();
const messaging = (0, messaging_1.getMessaging)();
async function getUserPushTokens(userId) {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists)
        return [];
    const data = userDoc.data();
    return (data === null || data === void 0 ? void 0 : data.pushTokens) || [];
}
async function isNotificationEnabled(userId, type) {
    const settingsDoc = await db.collection('userSettings').doc(userId).get();
    if (!settingsDoc.exists)
        return true;
    const settings = settingsDoc.data();
    const notifications = (settings === null || settings === void 0 ? void 0 : settings.notifications) || {};
    const typeToSetting = {
        ticket_confirmed: 'tickets',
        ticket_transferred: 'tickets',
        event_reminder: 'events',
        event_update: 'events',
        chat_message: 'chat',
        dm_request: 'dm',
        promo: 'promo',
    };
    const settingKey = typeToSetting[type];
    return notifications[settingKey] !== false;
}
async function saveNotification(userId, type, payload) {
    const notification = {
        userId,
        type,
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        read: false,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    };
    const docRef = await db.collection('notifications').add(notification);
    return docRef.id;
}
function getChannelId(type) {
    switch (type) {
        case 'ticket_confirmed':
        case 'ticket_transferred':
            return 'tickets';
        case 'event_reminder':
        case 'event_update':
            return 'events';
        case 'chat_message':
        case 'dm_request':
            return 'messages';
        default:
            return 'default';
    }
}
async function sendPushNotification(userId, type, payload) {
    const enabled = await isNotificationEnabled(userId, type);
    if (!enabled) {
        console.log(`Notifications disabled for user ${userId} type ${type}`);
        return;
    }
    const tokens = await getUserPushTokens(userId);
    if (tokens.length === 0) {
        console.log(`No push tokens for user ${userId}`);
        await saveNotification(userId, type, payload);
        return;
    }
    const notificationId = await saveNotification(userId, type, payload);
    const message = {
        tokens,
        notification: {
            title: payload.title,
            body: payload.body,
            imageUrl: payload.imageUrl,
        },
        data: Object.assign(Object.assign({}, payload.data), { notificationId,
            type }),
        android: {
            notification: {
                channelId: getChannelId(type),
                priority: 'high',
                defaultSound: true,
            },
        },
        apns: {
            payload: {
                aps: {
                    sound: 'default',
                    badge: 1,
                },
            },
        },
    };
    try {
        const response = await messaging.sendEachForMulticast(message);
        console.log(`Sent ${response.successCount} notifications to user ${userId}`);
        if (response.failureCount > 0) {
            const invalidTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const error = resp.error;
                    if ((error === null || error === void 0 ? void 0 : error.code) === 'messaging/invalid-registration-token' ||
                        (error === null || error === void 0 ? void 0 : error.code) === 'messaging/registration-token-not-registered') {
                        invalidTokens.push(tokens[idx]);
                    }
                }
            });
            if (invalidTokens.length > 0) {
                await db
                    .collection('users')
                    .doc(userId)
                    .update({
                    pushTokens: firestore_1.FieldValue.arrayRemove(...invalidTokens),
                });
            }
        }
    }
    catch (error) {
        console.error('Error sending push notification:', error);
    }
}
exports.notifyOrderConfirmed = (0, firestore_2.onDocumentUpdated)('orders/{orderId}', async (event) => {
    var _a, _b;
    const before = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const after = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    if (!before || !after)
        return;
    if (before.status !== 'confirmed' && after.status === 'confirmed') {
        const userId = after.userId;
        const eventTitle = after.eventTitle || 'Event';
        const ticketCount = Array.isArray(after.tickets)
            ? after.tickets.reduce((sum, t) => { var _a, _b; return sum + ((_b = (_a = t.quantity) !== null && _a !== void 0 ? _a : t.qty) !== null && _b !== void 0 ? _b : 1); }, 0)
            : 1;
        await sendPushNotification(userId, 'ticket_confirmed', {
            title: 'Tickets Confirmed',
            body: `Your ${ticketCount} ticket${ticketCount > 1 ? 's' : ''} for ${eventTitle} ${ticketCount > 1 ? 'are' : 'is'} confirmed.`,
            data: {
                orderId: event.params.orderId,
                eventId: after.eventId,
                navigateTo: 'tickets',
            },
        });
    }
});
exports.notifyTicketTransferred = (0, firestore_2.onDocumentCreated)('transfers/{transferId}', async (event) => {
    var _a;
    const transfer = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!transfer)
        return;
    const recipientId = transfer.recipientId;
    const senderId = transfer.senderId;
    const eventTitle = transfer.eventTitle || 'an event';
    await sendPushNotification(recipientId, 'ticket_transferred', {
        title: 'Ticket Received',
        body: `You received a ticket to ${eventTitle}.`,
        data: {
            transferId: event.params.transferId,
            navigateTo: 'tickets',
        },
    });
    await sendPushNotification(senderId, 'ticket_transferred', {
        title: 'Transfer Complete',
        body: `Your ticket to ${eventTitle} was successfully transferred.`,
        data: {
            transferId: event.params.transferId,
        },
    });
});
exports.sendEventReminders = (0, scheduler_1.onSchedule)('every 1 hours', async () => {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const eventsSnapshot = await db
        .collection('events')
        .where('startDate', '>=', oneHourLater.toISOString())
        .where('startDate', '<', twoHoursLater.toISOString())
        .get();
    for (const eventDoc of eventsSnapshot.docs) {
        const eventData = eventDoc.data();
        const eventId = eventDoc.id;
        let lastDoc = null;
        let hasMore = true;
        while (hasMore) {
            let query = db
                .collection('orders')
                .where('eventId', '==', eventId)
                .where('status', '==', 'confirmed')
                .limit(500);
            if (lastDoc) {
                query = query.startAfter(lastDoc);
            }
            const ordersSnapshot = await query.get();
            if (ordersSnapshot.empty) {
                hasMore = false;
                break;
            }
            for (const orderDoc of ordersSnapshot.docs) {
                const order = orderDoc.data();
                await sendPushNotification(order.userId, 'event_reminder', {
                    title: 'Event Starting Soon',
                    body: `${eventData.title} starts in about 1 hour. Do not forget your tickets.`,
                    data: {
                        eventId,
                        orderId: orderDoc.id,
                        navigateTo: 'tickets',
                    },
                    imageUrl: eventData.coverImage,
                });
            }
            lastDoc = ordersSnapshot.docs[ordersSnapshot.docs.length - 1];
            if (ordersSnapshot.docs.length < 500) {
                hasMore = false;
            }
        }
    }
});
exports.notifyEventUpdated = (0, firestore_2.onDocumentUpdated)('events/{eventId}', async (event) => {
    var _a, _b;
    const before = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const after = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    if (!before || !after)
        return;
    const CANCELLED = 'cancelled';
    const significantChange = before.startDate !== after.startDate ||
        before.venue !== after.venue ||
        before.location !== after.location ||
        after.lifecycle === CANCELLED ||
        after.status === CANCELLED;
    if (!significantChange)
        return;
    const eventId = event.params.eventId;
    const eventTitle = after.title;
    let notificationPayload;
    if (after.lifecycle === 'cancelled') {
        notificationPayload = {
            title: 'Event Cancelled',
            body: `${eventTitle} has been cancelled. Refund will be processed.`,
            data: { eventId },
        };
    }
    else if (before.startDate !== after.startDate) {
        notificationPayload = {
            title: 'Schedule Change',
            body: `${eventTitle} timing has been updated. Check the new schedule.`,
            data: { eventId },
        };
    }
    else {
        notificationPayload = {
            title: 'Event Update',
            body: `There is an update for ${eventTitle}.`,
            data: { eventId },
        };
    }
    let lastDoc = null;
    let hasMore = true;
    while (hasMore) {
        let query = db
            .collection('orders')
            .where('eventId', '==', eventId)
            .where('status', '==', 'confirmed')
            .limit(500);
        if (lastDoc) {
            query = query.startAfter(lastDoc);
        }
        const ordersSnapshot = await query.get();
        if (ordersSnapshot.empty) {
            hasMore = false;
            break;
        }
        for (const orderDoc of ordersSnapshot.docs) {
            const order = orderDoc.data();
            await sendPushNotification(order.userId, 'event_update', notificationPayload);
        }
        lastDoc = ordersSnapshot.docs[ordersSnapshot.docs.length - 1];
        if (ordersSnapshot.docs.length < 500) {
            hasMore = false;
        }
    }
});
exports.notifyChatMessage = (0, firestore_2.onDocumentCreated)('chats/{chatId}/messages/{messageId}', async (event) => {
    var _a;
    const message = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!message)
        return;
    const chatId = event.params.chatId;
    const chatDoc = await db.collection('chats').doc(chatId).get();
    if (!chatDoc.exists)
        return;
    const chat = chatDoc.data();
    const senderName = message.senderName || 'Someone';
    const members = (chat === null || chat === void 0 ? void 0 : chat.members) || [];
    const recipients = members.filter((member) => member !== message.senderId);
    for (const userId of recipients) {
        await sendPushNotification(userId, 'chat_message', {
            title: (chat === null || chat === void 0 ? void 0 : chat.isGroup) ? chat.name : senderName,
            body: message.text || 'Sent a message',
            data: {
                chatId,
                navigateTo: `chat/${chatId}`,
            },
        });
    }
});
exports.notifyDmRequest = (0, firestore_2.onDocumentCreated)('dmRequests/{requestId}', async (event) => {
    var _a;
    const request = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!request)
        return;
    const recipientId = request.recipientId;
    const senderName = request.senderName || 'Someone';
    await sendPushNotification(recipientId, 'dm_request', {
        title: 'New Message Request',
        body: `${senderName} wants to message you.`,
        data: {
            requestId: event.params.requestId,
            senderId: request.senderId,
            navigateTo: 'inbox',
        },
    });
});
//# sourceMappingURL=notifications.js.map