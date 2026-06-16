/**
 * Firebase Cloud Functions for Push Notifications
 * Handles server-side notification dispatch via FCM
 * Note: This file should be deployed separately to Firebase Functions
 */

import { onDocumentUpdated, onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
    initializeApp();
}

const db = getFirestore();
const messaging = getMessaging();

// Notification types
type NotificationType =
    | "ticket_confirmed"
    | "ticket_transferred"
    | "event_reminder"
    | "event_update"
    | "chat_message"
    | "dm_request"
    | "promo";

interface NotificationPayload {
    title: string;
    body: string;
    data?: Record<string, string>;
    imageUrl?: string;
}

/**
 * Get user's push tokens
 */
async function getUserPushTokens(userId: string): Promise<string[]> {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return [];

    const data = userDoc.data();
    return data?.pushTokens || [];
}

/**
 * Check if user has notifications enabled for a type
 */
async function isNotificationEnabled(
    userId: string,
    type: NotificationType
): Promise<boolean> {
    const settingsDoc = await db.collection("userSettings").doc(userId).get();
    if (!settingsDoc.exists) return true; // Default to enabled

    const settings = settingsDoc.data();
    const notifications = settings?.notifications || {};

    // Map notification type to settings key
    const typeToSetting: Record<NotificationType, string> = {
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

/**
 * Save notification to Firestore
 */
async function saveNotification(
    userId: string,
    type: NotificationType,
    payload: NotificationPayload
): Promise<string> {
    const notification = {
        userId,
        type,
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        read: false,
        createdAt: FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection("notifications").add(notification);
    return docRef.id;
}

/**
 * Send push notification to user
 */
async function sendPushNotification(
    userId: string,
    type: NotificationType,
    payload: NotificationPayload
): Promise<void> {
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
        data: {
            ...payload.data,
            notificationId,
            type,
        },
        android: {
            notification: {
                channelId: getChannelId(type),
                priority: "high" as const,
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
            const invalidTokens: string[] = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const error = resp.error;
                    if (
                        error?.code === "messaging/invalid-registration-token" ||
                        error?.code === "messaging/registration-token-not-registered"
                    ) {
                        invalidTokens.push(tokens[idx]);
                    }
                }
            });

            if (invalidTokens.length > 0) {
                await db
                    .collection("users")
                    .doc(userId)
                    .update({
                        pushTokens: FieldValue.arrayRemove(...invalidTokens),
                    });
            }
        }
    } catch (error) {
        console.error("Error sending push notification:", error);
    }
}

/**
 * Get Android notification channel
 */
function getChannelId(type: NotificationType): string {
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
export const onOrderConfirmed = onDocumentUpdated(
    "orders/{orderId}",
    async (event) => {
        const before = event.data?.before.data();
        const after = event.data?.after.data();

        if (!before || !after) return;

        // Only trigger when status changes to 'confirmed'
        if (before.status !== "confirmed" && after.status === "confirmed") {
            const userId = after.userId;
            const eventTitle = after.eventTitle || "Event";
            const ticketCount = after.tickets?.length || 1;

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
    }
);

/**
 * On ticket transfer
 */
export const onTicketTransferred = onDocumentCreated(
    "transfers/{transferId}",
    async (event) => {
        const transfer = event.data?.data();
        if (!transfer) return;

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
    }
);

/**
 * Scheduled event reminders
 * Runs every hour to check for upcoming events
 */
export const sendEventReminders = onSchedule(
    "every 1 hours",
    async () => {
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
    }
);

/**
 * On event update (changes to time, venue, etc.)
 */
export const onEventUpdated = onDocumentUpdated(
    "events/{eventId}",
    async (event) => {
        const before = event.data?.before.data();
        const after = event.data?.after.data();

        if (!before || !after) return;

        // Check for significant changes
        const significantChange =
            before.startDate !== after.startDate ||
            before.venue !== after.venue ||
            before.location !== after.location ||
            after.status === "cancelled";

        if (!significantChange) return;

        const eventId = event.params.eventId;
        const eventTitle = after.title;

        // Find all ticket holders
        const ordersSnapshot = await db
            .collection("orders")
            .where("eventId", "==", eventId)
            .where("status", "==", "confirmed")
            .get();

        let notificationPayload: NotificationPayload;

        if (after.status === "cancelled") {
            notificationPayload = {
                title: "❌ Event Cancelled",
                body: `${eventTitle} has been cancelled. Refund will be processed.`,
                data: { eventId },
            };
        } else if (before.startDate !== after.startDate) {
            notificationPayload = {
                title: "📅 Schedule Change",
                body: `${eventTitle} timing has been updated. Check the new schedule!`,
                data: { eventId },
            };
        } else {
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
    }
);

/**
 * On new chat message
 */
export const onChatMessage = onDocumentCreated(
    "chats/{chatId}/messages/{messageId}",
    async (event) => {
        const message = event.data?.data();
        if (!message) return;

        const chatId = event.params.chatId;

        // Get chat details
        const chatDoc = await db.collection("chats").doc(chatId).get();
        if (!chatDoc.exists) return;

        const chat = chatDoc.data();
        const senderName = message.senderName || "Someone";

        // Determine recipients (exclude sender)
        const members = chat?.members || [];
        const recipients = members.filter((m: string) => m !== message.senderId);

        for (const userId of recipients) {
            await sendPushNotification(userId, "chat_message", {
                title: chat?.isGroup ? chat.name : senderName,
                body: message.text || "Sent a message",
                data: {
                    chatId,
                    navigateTo: `chat/${chatId}`,
                },
            });
        }
    }
);

/**
 * On DM request
 */
export const onDMRequest = onDocumentCreated(
    "dmRequests/{requestId}",
    async (event) => {
        const request = event.data?.data();
        if (!request) return;

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
    }
);

// Export helper functions for testing
export {
    sendPushNotification,
    saveNotification,
    getUserPushTokens,
    isNotificationEnabled,
};
