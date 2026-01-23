/**
 * Notifications Store
 * Manages in-app notifications and activity feed
 */

import { create } from "zustand";
import { getFirebaseDb } from "@/lib/firebase";
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    updateDoc,
    doc,
    onSnapshot,
    Timestamp,
    writeBatch,
} from "firebase/firestore";

export type NotificationType =
    | "ticket_purchased"
    | "ticket_transfer_received"
    | "ticket_refund"
    | "event_reminder"
    | "event_changed"
    | "event_cancelled"
    | "dm_request"
    | "dm_message"
    | "chat_mention"
    | "contact_saved"
    | "safety_alert";

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    body: string;
    imageUrl?: string;
    data?: {
        eventId?: string;
        ticketId?: string;
        orderId?: string;
        chatId?: string;
        userId?: string;
    };
    read: boolean;
    createdAt: Date;
}

interface NotificationsState {
    notifications: Notification[];
    unreadCount: number;
    loading: boolean;
    error: string | null;

    // Actions
    fetchNotifications: (userId: string) => Promise<void>;
    markAsRead: (notificationId: string) => Promise<void>;
    markAllAsRead: (userId: string) => Promise<void>;
    subscribeToNotifications: (userId: string) => () => void;
    clearNotification: (notificationId: string) => Promise<void>;
}

// Mock notifications for development
const mockNotifications: Notification[] = [
    {
        id: "1",
        type: "ticket_purchased",
        title: "Ticket Confirmed! 🎉",
        body: "Your tickets for NEON NIGHTS are ready. See you there!",
        data: { eventId: "event-1", orderId: "order-1" },
        read: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
    },
    {
        id: "2",
        type: "event_reminder",
        title: "Event Tomorrow ⏰",
        body: "NEON NIGHTS starts in 24 hours. Don't forget your ticket!",
        data: { eventId: "event-1" },
        read: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    },
    {
        id: "3",
        type: "dm_request",
        title: "New Message Request",
        body: "Someone from NEON NIGHTS wants to connect with you.",
        data: { userId: "user-123", eventId: "event-1" },
        read: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    },
    {
        id: "4",
        type: "contact_saved",
        title: "New Connection 🤝",
        body: "Alex saved you as a contact from NEON NIGHTS.",
        data: { userId: "user-456" },
        read: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
    },
];

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
    notifications: [],
    unreadCount: 0,
    loading: false,
    error: null,

    fetchNotifications: async (userId: string) => {
        set({ loading: true, error: null });

        try {
            // For development, use mock data
            if (__DEV__) {
                set({
                    notifications: mockNotifications,
                    unreadCount: mockNotifications.filter((n) => !n.read).length,
                    loading: false,
                });
                return;
            }

            const q = query(
                collection(getFirebaseDb(), "notifications"),
                where("userId", "==", userId),
                orderBy("createdAt", "desc"),
                limit(50)
            );

            const snapshot = await getDocs(q);
            const notifications = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate() || new Date(),
            })) as Notification[];

            set({
                notifications,
                unreadCount: notifications.filter((n) => !n.read).length,
                loading: false,
            });
        } catch (error: any) {
            set({ error: error.message, loading: false });
        }
    },

    markAsRead: async (notificationId: string) => {
        const { notifications } = get();

        // Optimistic update
        set({
            notifications: notifications.map((n) =>
                n.id === notificationId ? { ...n, read: true } : n
            ),
            unreadCount: notifications.filter((n) => !n.read && n.id !== notificationId).length,
        });

        try {
            if (!__DEV__) {
                await updateDoc(doc(getFirebaseDb(), "notifications", notificationId), {
                    read: true,
                });
            }
        } catch (error) {
            console.error("Failed to mark notification as read:", error);
        }
    },

    markAllAsRead: async (userId: string) => {
        const { notifications } = get();

        // Optimistic update
        set({
            notifications: notifications.map((n) => ({ ...n, read: true })),
            unreadCount: 0,
        });

        try {
            if (!__DEV__) {
                const batch = writeBatch(getFirebaseDb());
                notifications
                    .filter((n) => !n.read)
                    .forEach((n) => {
                        batch.update(doc(getFirebaseDb(), "notifications", n.id), { read: true });
                    });
                await batch.commit();
            }
        } catch (error) {
            console.error("Failed to mark all notifications as read:", error);
        }
    },

    subscribeToNotifications: (userId: string) => {
        if (__DEV__) {
            // For dev, just fetch once
            get().fetchNotifications(userId);
            return () => { };
        }

        const q = query(
            collection(getFirebaseDb(), "notifications"),
            where("userId", "==", userId),
            orderBy("createdAt", "desc"),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notifications = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate() || new Date(),
            })) as Notification[];

            set({
                notifications,
                unreadCount: notifications.filter((n) => !n.read).length,
            });
        });

        return unsubscribe;
    },

    clearNotification: async (notificationId: string) => {
        const { notifications } = get();

        set({
            notifications: notifications.filter((n) => n.id !== notificationId),
        });

        // Note: In production, you might want to actually delete or archive
    },
}));

// Helper to get notification icon by type
export function getNotificationIcon(type: NotificationType): string {
    const icons: Record<NotificationType, string> = {
        ticket_purchased: "🎟️",
        ticket_transfer_received: "📥",
        ticket_refund: "💰",
        event_reminder: "⏰",
        event_changed: "📝",
        event_cancelled: "❌",
        dm_request: "💬",
        dm_message: "✉️",
        chat_mention: "@",
        contact_saved: "👥",
        safety_alert: "🚨",
    };
    return icons[type] || "🔔";
}

// Helper to get notification deep link
export function getNotificationDeepLink(notification: Notification): string {
    switch (notification.type) {
        case "ticket_purchased":
        case "ticket_transfer_received":
        case "ticket_refund":
            return `/tickets`;
        case "event_reminder":
        case "event_changed":
        case "event_cancelled":
            return notification.data?.eventId
                ? `/event/${notification.data.eventId}`
                : "/explore";
        case "dm_request":
        case "dm_message":
            return notification.data?.userId
                ? `/social/dm/${notification.data.userId}`
                : "/social/requests";
        case "chat_mention":
            return notification.data?.eventId
                ? `/social/group/${notification.data.eventId}`
                : "/inbox";
        case "contact_saved":
            return "/social/contacts";
        case "safety_alert":
            return "/safety";
        default:
            return "/notifications";
    }
}

export default useNotificationsStore;
