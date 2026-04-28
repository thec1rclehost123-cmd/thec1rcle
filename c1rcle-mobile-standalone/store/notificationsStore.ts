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

// Real notifications are fetched from Firestore
// No mock data - all notifications come from the backend

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
    notifications: [],
    unreadCount: 0,
    loading: false,
    error: null,

    fetchNotifications: async (userId: string) => {
        set({ loading: true, error: null });

        try {
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
            console.warn("[NotificationsStore] Failed to fetch notifications:", error.message);
            set({ error: error.message, loading: false, notifications: [] });
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
            await updateDoc(doc(getFirebaseDb(), "notifications", notificationId), {
                read: true,
            });
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
            const batch = writeBatch(getFirebaseDb());
            notifications
                .filter((n) => !n.read)
                .forEach((n) => {
                    batch.update(doc(getFirebaseDb(), "notifications", n.id), { read: true });
                });
            await batch.commit();
        } catch (error) {
            console.error("Failed to mark all notifications as read:", error);
        }
    },

    subscribeToNotifications: (userId: string) => {
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
export function getNotificationIcon(type: NotificationType): keyof typeof import("@expo/vector-icons").Ionicons.glyphMap {
    const icons: Record<NotificationType, keyof typeof import("@expo/vector-icons").Ionicons.glyphMap> = {
        ticket_purchased: "ticket-outline",
        ticket_transfer_received: "download-outline",
        ticket_refund: "cash-outline",
        event_reminder: "time-outline",
        event_changed: "create-outline",
        event_cancelled: "close-circle-outline",
        dm_request: "chatbubbles-outline",
        dm_message: "mail-outline",
        chat_mention: "at-outline",
        contact_saved: "people-outline",
        safety_alert: "alert-circle-outline",
    };
    return icons[type] || "notifications-outline";
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
