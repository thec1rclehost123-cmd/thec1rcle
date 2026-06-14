/**
 * Notifications Store
 * Manages in-app notifications and activity feed.
 * Reads from the same Firestore 'notifications' collection used by the
 * guest-portal webhook and partner-dashboard notification sender.
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

  // Actions
  fetchNotifications: (userId: string) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: (userId: string) => Promise<void>;
  subscribeToNotifications: (userId: string) => () => void;
  clearNotification: (notificationId: string) => Promise<void>;
}

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
        limit(50),
      );

      const snapshot = await getDocs(q);
      const notifications = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt:
          doc.data().createdAt?.toDate?.() ||
          (typeof doc.data().createdAt === "string" ? new Date(doc.data().createdAt) : new Date()),
      })) as Notification[];

      set({
        notifications,
        unreadCount: notifications.filter((n) => !n.read).length,
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
      notifications: notifications.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
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
      limit(50),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifications = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt:
            doc.data().createdAt?.toDate?.() ||
            (typeof doc.data().createdAt === "string"
              ? new Date(doc.data().createdAt)
              : new Date()),
        })) as Notification[];

        set({
          notifications,
          unreadCount: notifications.filter((n) => !n.read).length,
        });
      },
      (error) => {
        console.error("Notification subscription error:", error);
      },
    );

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
      return notification.data?.eventId ? `/event/${notification.data.eventId}` : "/explore";
    case "dm_request":
    case "dm_message":
      return notification.data?.userId
        ? `/social/dm/${notification.data.userId}`
        : "/social/requests";
    case "chat_mention":
      return notification.data?.eventId ? `/social/group/${notification.data.eventId}` : "/inbox";
    case "contact_saved":
      return "/social/contacts";
    case "safety_alert":
      return "/safety";
    default:
      return "/notifications";
  }
}

export default useNotificationsStore;
