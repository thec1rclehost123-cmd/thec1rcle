/**
 * Notifications Store
 * Manages in-app notifications and activity feed.
 * Reads through the Fastify gateway. The previous direct Firestore listener
 * is intentionally replaced with short polling for launch data ownership.
 */

import { create } from 'zustand';
import { apiFetch } from '@/lib/api';

export type NotificationType =
  | 'ticket_purchased'
  | 'ticket_transfer_received'
  | 'ticket_refund'
  | 'event_reminder'
  | 'event_changed'
  | 'event_cancelled'
  | 'dm_request'
  | 'dm_message'
  | 'chat_mention'
  | 'contact_saved'
  | 'safety_alert'
  | 'refund_completed'
  | 'refund_failed';

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

  fetchNotifications: async (_userId: string) => {
    if (get().loading) return;
    set({ loading: true, error: null });

    try {
      const response = await apiFetch<{
        success: boolean;
        data?: { notifications?: any[]; unreadCount?: number };
        notifications?: any[];
        unreadCount?: number;
      }>('/api/v1/guest-notifications');
      const rawNotifications = response.data?.notifications || response.notifications || [];
      const notifications: Notification[] = rawNotifications.map((data: any) => ({
        ...data,
        id: data.id,
        createdAt: data.createdAt?.toDate?.() ?? new Date(data.createdAt || Date.now()),
      }));

      set({
        notifications,
        unreadCount:
          response.data?.unreadCount ??
          response.unreadCount ??
          notifications.filter((n) => !n.read).length,
        loading: false,
      });
    } catch (error: any) {
      if (__DEV__)
        console.warn('Unable to fetch notifications; showing an empty notification center.', error);
      set({ notifications: [], unreadCount: 0, error: null, loading: false });
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
      await apiFetch(`/api/v1/guest-notifications/${encodeURIComponent(notificationId)}`, {
        method: 'PATCH',
      });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  },

  markAllAsRead: async (_userId: string) => {
    const { notifications } = get();
    if (notifications.every((n) => n.read)) return;

    // Optimistic update
    set({ notifications: notifications.map((n) => ({ ...n, read: true })), unreadCount: 0 });

    try {
      await apiFetch('/api/v1/guest-notifications', {
        method: 'PATCH',
        body: JSON.stringify({ markAll: true }),
      });
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  },

  subscribeToNotifications: (userId: string) => {
    get()._unsubscribe?.();

    void get().fetchNotifications(userId);

    const intervalId = setInterval(() => {
      void get().fetchNotifications(userId);
    }, 60000);

    const unsubscribe = () => clearInterval(intervalId);

    set({ _unsubscribe: unsubscribe });
    return unsubscribe;
  },

  clearNotification: async (notificationId: string) => {
    const { notifications } = get();
    set({
      notifications: notifications.filter((n) => n.id !== notificationId),
    });

    try {
      await apiFetch(`/api/v1/guest-notifications/${encodeURIComponent(notificationId)}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Failed to clear notification on server:', error);
    }
  },

  clearNotifications: () => {
    get()._unsubscribe?.();
    set({ notifications: [], unreadCount: 0, error: null, _unsubscribe: null });
  },
}));

// Helper to get notification icon by type
export function getNotificationIcon(type: NotificationType): string {
  const icons: Record<NotificationType, string> = {
    ticket_purchased: '🎟️',
    ticket_transfer_received: '📥',
    ticket_refund: '💰',
    event_reminder: '⏰',
    event_changed: '📝',
    event_cancelled: '❌',
    dm_request: '💬',
    dm_message: '✉️',
    chat_mention: '@',
    contact_saved: '👥',
    safety_alert: '🚨',
    refund_completed: '✅',
    refund_failed: '⚠️',
  };
  return icons[type] || '🔔';
}

// Helper to get notification deep link
export function getNotificationDeepLink(notification: Notification): string {
  switch (notification.type) {
    case 'ticket_purchased':
    case 'ticket_transfer_received':
    case 'ticket_refund':
    case 'refund_completed':
    case 'refund_failed':
      return `/tickets`;
    case 'event_reminder':
    case 'event_changed':
    case 'event_cancelled':
      return notification.data?.eventId ? `/event/${notification.data.eventId}` : '/explore';
    case 'dm_request':
    case 'dm_message':
      return notification.data?.userId
        ? `/social/dm/${notification.data.userId}`
        : '/social/requests';
    case 'chat_mention':
      return notification.data?.eventId ? `/social/group/${notification.data.eventId}` : '/inbox';
    case 'contact_saved':
      return '/social/contacts';
    case 'safety_alert':
      return '/safety';
    default:
      return '/notifications';
  }
}

export default useNotificationsStore;
