/**
 * Notifications Store
 * Manages in-app notifications and activity feed.
 * Reads from the same Firestore 'notifications' collection used by the
 * guest-portal webhook and partner-dashboard notification sender.
 */

import {
    getFirestore, collection, query, where, orderBy,
    getDocs, doc, updateDoc, writeBatch, onSnapshot,
} from "firebase/firestore";
import { create } from "zustand";

import { getFirebaseApp } from "@/lib/firebase/client";

function getDb() { return getFirestore(getFirebaseApp()); }

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
    | "safety_alert"
    | "refund_completed"
    | "refund_failed";

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
        refundId?: string;
        refundAmount?: number;
    };
    read: boolean;
    createdAt: Date;
}

interface NotificationsState {
    notifications: Notification[];
    unreadCount: number;
    loading: boolean;
    error: string | null;
    _unsubscribe: (() => void) | null;

    // Actions
    fetchNotifications: (userId: string) => Promise<void>;
    markAsRead: (notificationId: string) => Promise<void>;
    markAllAsRead: (userId: string) => Promise<void>;
    subscribeToNotifications: (userId: string) => () => void;
    clearNotification: (notificationId: string) => Promise<void>;
    clearNotifications: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
    notifications: [],
    unreadCount: 0,
    loading: false,
    error: null,
    _unsubscribe: null,

    fetchNotifications: async (userId: string) => {
        if (get().loading) return;
        set({ loading: true, error: null });

        try {
            const snap = await getDocs(
                query(
                    collection(getDb(), "notifications"),
                    where("targetId", "==", userId),
                    orderBy("createdAt", "desc")
                )
            );
            const notifications: Notification[] = snap.docs.map((d) => {
                const data = d.data();
                return {
                    ...data,
                    id: d.id,
                    createdAt: data.createdAt?.toDate?.() ?? new Date(data.createdAt),
                } as Notification;
            });

            set({
                notifications,
                unreadCount: notifications.filter((n) => !n.read).length,
                loading: false,
            });
        } catch (error: any) {
            console.error("Failed to fetch notifications:", error);
            set({ notifications: [], unreadCount: 0, error: error.message, loading: false });
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
            await updateDoc(doc(getDb(), "notifications", notificationId), { read: true });
        } catch (error) {
            console.error("Failed to mark notification as read:", error);
        }
    },

    markAllAsRead: async (userId: string) => {
        const { notifications } = get();

        // Optimistic update
        set({ notifications: notifications.map((n) => ({ ...n, read: true })), unreadCount: 0 });

        try {
            const unread = notifications.filter((n) => !n.read);
            if (unread.length === 0) return;
            const batch = writeBatch(getDb());
            unread.forEach((n) => batch.update(doc(getDb(), "notifications", n.id), { read: true }));
            await batch.commit();
        } catch (error) {
            console.error("Failed to mark all notifications as read:", error);
        }
    },

    subscribeToNotifications: (userId: string) => {
        get()._unsubscribe?.();

        const unsubscribe = onSnapshot(
            query(
                collection(getDb(), "notifications"),
                where("targetId", "==", userId),
                orderBy("createdAt", "desc")
            ),
            (snap) => {
                const notifications: Notification[] = snap.docs.map((d) => {
                    const data = d.data();
                    return {
                        ...data,
                        id: d.id,
                        createdAt: data.createdAt?.toDate?.() ?? new Date(data.createdAt),
                    } as Notification;
                });
                set({
                    notifications,
                    unreadCount: notifications.filter((n) => !n.read).length,
                    loading: false,
                });
            },
            (error) => console.error("Notifications listener error:", error)
        );

        set({ _unsubscribe: unsubscribe });
        return unsubscribe;
    },

    clearNotification: async (notificationId: string) => {
        const { notifications } = get();
        set({
            notifications: notifications.filter((n) => n.id !== notificationId),
        });
    },

    clearNotifications: () => {
        get()._unsubscribe?.();
        set({ notifications: [], unreadCount: 0, error: null, _unsubscribe: null });
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
        refund_completed: "✅",
        refund_failed: "⚠️",
    };
    return icons[type] || "🔔";
}

// Helper to get notification deep link
export function getNotificationDeepLink(notification: Notification): string {
    switch (notification.type) {
        case "ticket_purchased":
        case "ticket_transfer_received":
        case "ticket_refund":
        case "refund_completed":
        case "refund_failed":
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
