"use strict";

import { initializeApp, getApps } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";

if (getApps().length === 0) {
    initializeApp();
}

const db = getFirestore();
const messaging = getMessaging();

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

async function getUserPushTokens(userId: string): Promise<string[]> {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return [];

    const data = userDoc.data();
    return data?.pushTokens || [];
}

async function isNotificationEnabled(
    userId: string,
    type: NotificationType
): Promise<boolean> {
    const settingsDoc = await db.collection("userSettings").doc(userId).get();
    if (!settingsDoc.exists) return true;

    const settings = settingsDoc.data();
    const notifications = settings?.notifications || {};

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

async function sendPushNotification(
    userId: string,
    type: NotificationType,
    payload: NotificationPayload
): Promise<void> {
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
                await db.collection("users").doc(userId).update({
                    pushTokens: FieldValue.arrayRemove(...invalidTokens),
                });
            }
        }
    } catch (error) {
        console.error("Error sending push notification:", error);
    }
}

export const notifyOrderConfirmed = onDocumentUpdated(
    "orders/{orderId}",
    async (event) => {
        const before = event.data?.before.data();
        const after = event.data?.after.data();

        if (!before || !after) return;

        if (before.status !== "confirmed" && after.status === "confirmed") {
            const userId = after.userId;
            const eventTitle = after.eventTitle || "Event";
            const ticketCount = Array.isArray(after.tickets)
              ? after.tickets.reduce((sum, t) => sum + (t.quantity ?? t.qty ?? 1), 0)
              : 1;

            await sendPushNotification(userId, "ticket_confirmed", {
                title: "Tickets Confirmed",
                body: `Your ${ticketCount} ticket${ticketCount > 1 ? "s" : ""} for ${eventTitle} ${ticketCount > 1 ? "are" : "is"} confirmed.`,
                data: {
                    orderId: event.params.orderId,
                    eventId: after.eventId,
                    navigateTo: "tickets",
                },
            });
        }
    }
);

export const notifyTicketTransferred = onDocumentCreated(
    "transfers/{transferId}",
    async (event) => {
        const transfer = event.data?.data();
        if (!transfer) return;

        const recipientId = transfer.recipientId;
        const senderId = transfer.senderId;
        const eventTitle = transfer.eventTitle || "an event";

        await sendPushNotification(recipientId, "ticket_transferred", {
            title: "Ticket Received",
            body: `You received a ticket to ${eventTitle}.`,
            data: {
                transferId: event.params.transferId,
                navigateTo: "tickets",
            },
        });

        await sendPushNotification(senderId, "ticket_transferred", {
            title: "Transfer Complete",
            body: `Your ticket to ${eventTitle} was successfully transferred.`,
            data: {
                transferId: event.params.transferId,
            },
        });
    }
);

export const sendEventReminders = onSchedule(
    "every 1 hours",
    async () => {
        const now = new Date();
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
        const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

        const eventsSnapshot = await db
            .collection("events")
            .where("startDate", ">=", oneHourLater.toISOString())
            .where("startDate", "<", twoHoursLater.toISOString())
            .get();

        for (const eventDoc of eventsSnapshot.docs) {
            const eventData = eventDoc.data();
            const eventId = eventDoc.id;

            const ordersSnapshot = await db
                .collection("orders")
                .where("eventId", "==", eventId)
                .where("status", "==", "confirmed")
                .get();

            for (const orderDoc of ordersSnapshot.docs) {
                const order = orderDoc.data();

                await sendPushNotification(order.userId, "event_reminder", {
                    title: "Event Starting Soon",
                    body: `${eventData.title} starts in about 1 hour. Do not forget your tickets.`,
                    data: {
                        eventId,
                        orderId: orderDoc.id,
                        navigateTo: "tickets",
                    },
                    imageUrl: eventData.coverImage,
                });
            }
        }
    }
);

export const notifyEventUpdated = onDocumentUpdated(
    "events/{eventId}",
    async (event) => {
        const before = event.data?.before.data();
        const after = event.data?.after.data();

        if (!before || !after) return;

        const significantChange =
            before.startDate !== after.startDate ||
            before.venue !== after.venue ||
            before.location !== after.location ||
            after.status === "cancelled";

        if (!significantChange) return;

        const eventId = event.params.eventId;
        const eventTitle = after.title;

        const ordersSnapshot = await db
            .collection("orders")
            .where("eventId", "==", eventId)
            .where("status", "==", "confirmed")
            .get();

        let notificationPayload: NotificationPayload;

        if (after.status === "cancelled") {
            notificationPayload = {
                title: "Event Cancelled",
                body: `${eventTitle} has been cancelled. Refund will be processed.`,
                data: { eventId },
            };
        } else if (before.startDate !== after.startDate) {
            notificationPayload = {
                title: "Schedule Change",
                body: `${eventTitle} timing has been updated. Check the new schedule.`,
                data: { eventId },
            };
        } else {
            notificationPayload = {
                title: "Event Update",
                body: `There is an update for ${eventTitle}.`,
                data: { eventId },
            };
        }

        for (const orderDoc of ordersSnapshot.docs) {
            const order = orderDoc.data();
            await sendPushNotification(order.userId, "event_update", notificationPayload);
        }
    }
);

export const notifyChatMessage = onDocumentCreated(
    "chats/{chatId}/messages/{messageId}",
    async (event) => {
        const message = event.data?.data();
        if (!message) return;

        const chatId = event.params.chatId;
        const chatDoc = await db.collection("chats").doc(chatId).get();
        if (!chatDoc.exists) return;

        const chat = chatDoc.data();
        const senderName = message.senderName || "Someone";
        const members = chat?.members || [];
        const recipients = members.filter((member: string) => member !== message.senderId);

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

export const notifyDmRequest = onDocumentCreated(
    "dmRequests/{requestId}",
    async (event) => {
        const request = event.data?.data();
        if (!request) return;

        const recipientId = request.recipientId;
        const senderName = request.senderName || "Someone";

        await sendPushNotification(recipientId, "dm_request", {
            title: "New Message Request",
            body: `${senderName} wants to message you.`,
            data: {
                requestId: event.params.requestId,
                senderId: request.senderId,
                navigateTo: "inbox",
            },
        });
    }
);
