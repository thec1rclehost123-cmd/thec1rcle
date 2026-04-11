/**
 * Notifications Store
 * Manages in-app notifications and activity feed.
 * Reads from the same Firestore 'notifications' collection used by the
 * guest-portal webhook and partner-dashboard notification sender.
 */

import { create } from "zustand";
import { apiFetch } from "@/lib/api";

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
            const data = await apiFetch<any>(`/api/v1/profiles/notifications`, { requireAuth: true });
            const notifications = (data.notifications || []).map((n: any) => ({
                ...n,
                createdAt: new Date(n.createdAt)
            }));

            set({
                notifications,
                unreadCount: notifications.filter((n: Notification) => !n.read).length,
                loading: false,
            });
        } catch (error: any) {
            console.error("Failed to fetch notifications:", error);
            set({
                notifications: [],
                unreadCount: 0,
                error: error.message,
                loading: false,
            });
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
            await apiFetch(`/api/v1/profiles/notifications/${notificationId}/read`, {
                method: "PATCH",
                requireAuth: true
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
            await apiFetch(`/api/v1/profiles/notifications/read-all`, {
                method: "POST",
                requireAuth: true
            });
        } catch (error) {
            console.error("Failed to mark all notifications as read:", error);
        }
    },

    subscribeToNotifications: (userId: string) => {
        // Switch to API interval polling gracefully degraded
        get()._unsubscribe?.();

        get().fetchNotifications(userId);
        
        const intervalId = setInterval(() => {
            get().fetchNotifications(userId);
        }, 30000); // 30s poll

        const unsubscribe = () => clearInterval(intervalId);
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
