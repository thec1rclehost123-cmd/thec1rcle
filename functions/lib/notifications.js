"use strict";
/**
 * Firebase Cloud Functions for Push Notifications
 * Handles server-side notification dispatch via FCM
 * Note: This file should be deployed separately to Firebase Functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNotificationEnabled = exports.getUserPushTokens = exports.saveNotification = exports.sendPushNotification = exports.onDMRequest = exports.onChatMessage = exports.onEventUpdated = exports.sendEventReminders = exports.onTicketTransferred = exports.onOrderConfirmed = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const app_1 = require("firebase-admin/app");
const firestore_2 = require("firebase-admin/firestore");
const messaging_1 = require("firebase-admin/messaging");
// Initialize Firebase Admin if not already initialized
if ((0, app_1.getApps)().length === 0) {
    (0, app_1.initializeApp)();
}
const db = (0, firestore_2.getFirestore)();
const messaging = (0, messaging_1.getMessaging)();
/**
 * Get user's push tokens
 */
async function getUserPushTokens(userId) {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists)
        return [];
    const data = userDoc.data();
    return (data === null || data === void 0 ? void 0 : data.pushTokens) || [];
}
exports.getUserPushTokens = getUserPushTokens;
/**
 * Check if user has notifications enabled for a type
 */
async function isNotificationEnabled(userId, type) {
    const settingsDoc = await db.collection("userSettings").doc(userId).get();
    if (!settingsDoc.exists)
        return true; // Default to enabled
    const settings = settingsDoc.data();
    const notifications = (settings === null || settings === void 0 ? void 0 : settings.notifications) || {};
    // Map notification type to settings key
    const typeToSetting = {
        ticket_confirmed: "tickets",
        ticket_transferred: "tickets",
        event_reminder: "events",
        event_update: "events",
        chat_message: "chat",
        dm_request: "dm",
        promo: "promo",
    };
    const settingKey = typeToSetting[type];
    return notifications[settingKey] !== false;
}
exports.isNotificationEnabled = isNotificationEnabled;
/**
 * Save notification to Firestore
 */
async function saveNotification(userId, type, payload) {
    const notification = {
        userId,
        type,
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        read: false,
        createdAt: firestore_2.FieldValue.serverTimestamp(),
    };
    const docRef = await db.collection("notifications").add(notification);
    return docRef.id;
}
exports.saveNotification = saveNotification;
/**
 * Send push notification to user
 */
async function sendPushNotification(userId, type, payload) {
    // Check if notifications are enabled
    const enabled = await isNotificationEnabled(userId, type);
    if (!enabled) {
        console.log(`Notifications disabled for user ${userId} type ${type}`);
        return;
    }
    // Get push tokens
    const tokens = await getUserPushTokens(userId);
    if (tokens.length === 0) {
        console.log(`No push tokens for user ${userId}`);
        // Still save to in-app notifications
        await saveNotification(userId, type, payload);
        return;
    }
    // Save to Firestore first
    const notificationId = await saveNotification(userId, type, payload);
    // Build FCM message
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
                priority: "high",
                defaultSound: true,
            },
        },
        apns: {
            payload: {
                aps: {
                    sound: "default",
                    badge: 1,
                },
            },
        },
    };
    try {
        const response = await messaging.sendEachForMulticast(message);
        console.log(`Sent ${response.successCount} notifications to user ${userId}`);
        // Clean up invalid tokens
        if (response.failureCount > 0) {
            const invalidTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const error = resp.error;
                    if ((error === null || error === void 0 ? void 0 : error.code) === "messaging/invalid-registration-token" ||
                        (error === null || error === void 0 ? void 0 : error.code) === "messaging/registration-token-not-registered") {
                        invalidTokens.push(tokens[idx]);
                    }
                }
            });
            if (invalidTokens.length > 0) {
                await db
                    .collection("users")
                    .doc(userId)
                    .update({
                    pushTokens: firestore_2.FieldValue.arrayRemove(...invalidTokens),
                });
            }
        }
    }
    catch (error) {
        console.error("Error sending push notification:", error);
    }
}
exports.sendPushNotification = sendPushNotification;
/**
 * Get Android notification channel
 */
function getChannelId(type) {
    switch (type) {
        case "ticket_confirmed":
        case "ticket_transferred":
            return "tickets";
        case "event_reminder":
        case "event_update":
            return "events";
        case "chat_message":
        case "dm_request":
            return "messages";
        default:
            return "default";
    }
}
// ============================================
// TRIGGER FUNCTIONS
// ============================================
/**
 * On ticket purchase confirmation
 */
exports.onOrderConfirmed = (0, firestore_1.onDocumentUpdated)("orders/{orderId}", async (event) => {
    var _a, _b, _c;
    const before = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const after = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    if (!before || !after)
        return;
    // Only trigger when status changes to 'confirmed'
    if (before.status !== "confirmed" && after.status === "confirmed") {
        const userId = after.userId;
        const eventTitle = after.eventTitle || "Event";
        const ticketCount = ((_c = after.tickets) === null || _c === void 0 ? void 0 : _c.length) || 1;
        await sendPushNotification(userId, "ticket_confirmed", {
            title: "🎟️ Tickets Confirmed!",
            body: `Your ${ticketCount} ticket${ticketCount > 1 ? "s" : ""} for ${eventTitle} ${ticketCount > 1 ? "are" : "is"} confirmed!`,
            data: {
                orderId: event.params.orderId,
                eventId: after.eventId,
                navigateTo: "tickets",
            },
        });
    }
});
/**
 * On ticket transfer
 */
exports.onTicketTransferred = (0, firestore_1.onDocumentCreated)("transfers/{transferId}", async (event) => {
    var _a;
    const transfer = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!transfer)
        return;
    const recipientId = transfer.recipientId;
    const senderId = transfer.senderId;
    const eventTitle = transfer.eventTitle || "an event";
    // Notify recipient
    await sendPushNotification(recipientId, "ticket_transferred", {
        title: "🎁 Ticket Received!",
        body: `You received a ticket to ${eventTitle}!`,
        data: {
            transferId: event.params.transferId,
            navigateTo: "tickets",
        },
    });
    // Notify sender
    await sendPushNotification(senderId, "ticket_transferred", {
        title: "✅ Transfer Complete",
        body: `Your ticket to ${eventTitle} was successfully transferred.`,
        data: {
            transferId: event.params.transferId,
        },
    });
});
/**
 * Scheduled event reminders
 * Runs every hour to check for upcoming events
 */
exports.sendEventReminders = (0, scheduler_1.onSchedule)("every 1 hours", async () => {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    // Find events starting in 1-2 hours
    const eventsSnapshot = await db
        .collection("events")
        .where("startDate", ">=", oneHourLater.toISOString())
        .where("startDate", "<", twoHoursLater.toISOString())
        .get();
    for (const eventDoc of eventsSnapshot.docs) {
        const event = eventDoc.data();
        const eventId = eventDoc.id;
        // Find all orders for this event
        const ordersSnapshot = await db
            .collection("orders")
            .where("eventId", "==", eventId)
            .where("status", "==", "confirmed")
            .get();
        // Send reminder to each ticket holder
        for (const orderDoc of ordersSnapshot.docs) {
            const order = orderDoc.data();
            await sendPushNotification(order.userId, "event_reminder", {
                title: "⏰ Event Starting Soon!",
                body: `${event.title} starts in about 1 hour. Don't forget your tickets!`,
                data: {
                    eventId,
                    orderId: orderDoc.id,
                    navigateTo: "tickets",
                },
                imageUrl: event.coverImage,
            });
        }
    }
});
/**
 * On event update (changes to time, venue, etc.)
 */
exports.onEventUpdated = (0, firestore_1.onDocumentUpdated)("events/{eventId}", async (event) => {
    var _a, _b;
    const before = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const after = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    if (!before || !after)
        return;
    // Check for significant changes
    const significantChange = before.startDate !== after.startDate ||
        before.venue !== after.venue ||
        before.location !== after.location ||
        after.status === "cancelled";
    if (!significantChange)
        return;
    const eventId = event.params.eventId;
    const eventTitle = after.title;
    // Find all ticket holders
    const ordersSnapshot = await db
        .collection("orders")
        .where("eventId", "==", eventId)
        .where("status", "==", "confirmed")
        .get();
    let notificationPayload;
    if (after.status === "cancelled") {
        notificationPayload = {
            title: "❌ Event Cancelled",
            body: `${eventTitle} has been cancelled. Refund will be processed.`,
            data: { eventId },
        };
    }
    else if (before.startDate !== after.startDate) {
        notificationPayload = {
            title: "📅 Schedule Change",
            body: `${eventTitle} timing has been updated. Check the new schedule!`,
            data: { eventId },
        };
    }
    else {
        notificationPayload = {
            title: "📢 Event Update",
            body: `There's an update for ${eventTitle}. Tap to see details.`,
            data: { eventId },
        };
    }
    // Notify each ticket holder
    for (const orderDoc of ordersSnapshot.docs) {
        const order = orderDoc.data();
        await sendPushNotification(order.userId, "event_update", notificationPayload);
    }
});
/**
 * On new chat message
 */
exports.onChatMessage = (0, firestore_1.onDocumentCreated)("chats/{chatId}/messages/{messageId}", async (event) => {
    var _a;
    const message = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!message)
        return;
    const chatId = event.params.chatId;
    // Get chat details
    const chatDoc = await db.collection("chats").doc(chatId).get();
    if (!chatDoc.exists)
        return;
    const chat = chatDoc.data();
    const senderName = message.senderName || "Someone";
    // Determine recipients (exclude sender)
    const members = (chat === null || chat === void 0 ? void 0 : chat.members) || [];
    const recipients = members.filter((m) => m !== message.senderId);
    for (const userId of recipients) {
        await sendPushNotification(userId, "chat_message", {
            title: (chat === null || chat === void 0 ? void 0 : chat.isGroup) ? chat.name : senderName,
            body: message.text || "Sent a message",
            data: {
                chatId,
                navigateTo: `chat/${chatId}`,
            },
        });
    }
});
/**
 * On DM request
 */
exports.onDMRequest = (0, firestore_1.onDocumentCreated)("dmRequests/{requestId}", async (event) => {
    var _a;
    const request = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!request)
        return;
    const recipientId = request.recipientId;
    const senderName = request.senderName || "Someone";
    await sendPushNotification(recipientId, "dm_request", {
        title: "💬 New Message Request",
        body: `${senderName} wants to message you`,
        data: {
            requestId: event.params.requestId,
            senderId: request.senderId,
            navigateTo: "inbox",
        },
    });
});
//# sourceMappingURL=notifications.js.map