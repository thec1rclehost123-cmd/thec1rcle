/* global jest, describe, beforeEach, it, expect */

jest.mock('../../lib/api', () => ({
  apiFetch: jest.fn(),
}));

import {
  useNotificationsStore,
  getNotificationIcon,
  getNotificationDeepLink,
} from '../../store/notificationsStore';
import { apiFetch } from '../../lib/api';

const mockApiFetch = apiFetch as jest.Mock;
const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const makeNotification = (overrides = {}) => ({
  id: 'notif_1',
  type: 'event_reminder',
  title: 'Test Notification',
  body: 'This is a test',
  read: false,
  createdAt: new Date('2026-06-25T10:00:00Z'),
  ...overrides,
});

describe('notificationsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useNotificationsStore.setState({
      notifications: [],
      unreadCount: 0,
      loading: false,
      error: null,
      _unsubscribe: null,
    });
  });

  describe('fetchNotifications', () => {
    it('fetches and parses notifications from the API', async () => {
      const apiData = {
        data: {
          notifications: [
            {
              id: 'n1',
              type: 'event_reminder',
              title: 'Event',
              body: 'Reminder',
              read: false,
              createdAt: '2026-06-25T10:00:00Z',
            },
          ],
          unreadCount: 1,
        },
      };
      mockApiFetch.mockResolvedValueOnce(apiData);

      await useNotificationsStore.getState().fetchNotifications('user_1');

      expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/guest-notifications');
      const state = useNotificationsStore.getState();
      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0].id).toBe('n1');
      expect(state.unreadCount).toBe(1);
      expect(state.loading).toBe(false);
    });

    it('falls back to top-level notifications field when data.notifications is absent', async () => {
      mockApiFetch.mockResolvedValueOnce({
        notifications: [
          {
            id: 'n2',
            type: 'dm_message',
            title: 'DM',
            body: 'Hello',
            read: true,
            createdAt: '2026-06-25T09:00:00Z',
          },
        ],
        unreadCount: 0,
      });

      await useNotificationsStore.getState().fetchNotifications('user_1');
      expect(useNotificationsStore.getState().notifications).toHaveLength(1);
    });

    it('sets empty state on error', async () => {
      mockApiFetch.mockRejectedValueOnce(new Error('Network error'));

      await useNotificationsStore.getState().fetchNotifications('user_1');
      const state = useNotificationsStore.getState();
      expect(state.notifications).toEqual([]);
      expect(state.unreadCount).toBe(0);
      expect(state.loading).toBe(false);
    });

    it('does not fetch if already loading', async () => {
      useNotificationsStore.setState({ loading: true });
      await useNotificationsStore.getState().fetchNotifications('user_1');
      expect(mockApiFetch).not.toHaveBeenCalled();
    });
  });

  describe('markAsRead', () => {
    it('updates optimistically and calls PATCH', async () => {
      useNotificationsStore.setState({
        notifications: [
          makeNotification({ id: 'n1', read: false }),
          makeNotification({ id: 'n2', read: false }),
        ],
        unreadCount: 2,
      });

      await useNotificationsStore.getState().markAsRead('n1');

      const state = useNotificationsStore.getState();
      expect(state.notifications.find((n) => n.id === 'n1')?.read).toBe(true);
      expect(state.unreadCount).toBe(1);
      expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/guest-notifications/n1', {
        method: 'PATCH',
      });
    });
  });

  describe('markAllAsRead', () => {
    it('marks all notifications read optimistically', async () => {
      useNotificationsStore.setState({
        notifications: [
          makeNotification({ id: 'n1', read: false }),
          makeNotification({ id: 'n2', read: false }),
        ],
        unreadCount: 2,
      });

      await useNotificationsStore.getState().markAllAsRead('user_1');

      const state = useNotificationsStore.getState();
      expect(state.notifications.every((n) => n.read)).toBe(true);
      expect(state.unreadCount).toBe(0);
      expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/guest-notifications', {
        method: 'PATCH',
        body: JSON.stringify({ markAll: true }),
      });
    });

    it('skips PATCH if all already read', async () => {
      useNotificationsStore.setState({
        notifications: [makeNotification({ id: 'n1', read: true })],
        unreadCount: 0,
      });

      await useNotificationsStore.getState().markAllAsRead('user_1');
      expect(mockApiFetch).not.toHaveBeenCalled();
    });
  });

  describe('clearNotification', () => {
    it('removes the notification from the list', () => {
      useNotificationsStore.setState({
        notifications: [makeNotification({ id: 'n1' }), makeNotification({ id: 'n2' })],
      });

      useNotificationsStore.getState().clearNotification('n1');

      expect(useNotificationsStore.getState().notifications).toHaveLength(1);
      expect(useNotificationsStore.getState().notifications[0].id).toBe('n2');
    });
  });

  describe('clearNotifications', () => {
    it('resets state and calls unsubscribe', () => {
      const unsubscribe = jest.fn();
      useNotificationsStore.setState({
        notifications: [makeNotification()],
        unreadCount: 1,
        _unsubscribe: unsubscribe,
      });

      useNotificationsStore.getState().clearNotifications();

      const state = useNotificationsStore.getState();
      expect(state.notifications).toEqual([]);
      expect(state.unreadCount).toBe(0);
      expect(state._unsubscribe).toBeNull();
      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe('subscribeToNotifications', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('fetches immediately and polls every 15s', async () => {
      mockApiFetch.mockResolvedValue({ data: { notifications: [], unreadCount: 0 } });

      useNotificationsStore.getState().subscribeToNotifications('user_1');
      // Let the initial async fetch complete
      await flushMicrotasks();

      expect(mockApiFetch).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(15000);
      await flushMicrotasks();
      expect(mockApiFetch).toHaveBeenCalledTimes(2);

      jest.advanceTimersByTime(15000);
      await flushMicrotasks();
      expect(mockApiFetch).toHaveBeenCalledTimes(3);
    });

    it('unsubscribes and clears interval', () => {
      mockApiFetch.mockResolvedValue({ data: { notifications: [], unreadCount: 0 } });

      const cleanup = useNotificationsStore.getState().subscribeToNotifications('user_1');
      const initialCount = mockApiFetch.mock.calls.length;

      cleanup();
      jest.advanceTimersByTime(30000);

      expect(mockApiFetch.mock.calls.length).toBe(initialCount);
    });
  });

  describe('getNotificationIcon', () => {
    it('returns the correct icon for each type', () => {
      expect(getNotificationIcon('ticket_purchased')).toBe('🎟️');
      expect(getNotificationIcon('safety_alert')).toBe('🚨');
      expect(getNotificationIcon('dm_request')).toBe('💬');
      expect(getNotificationIcon('unknown_type' as any)).toBe('🔔');
    });
  });

  describe('getNotificationDeepLink', () => {
    it('routes ticket types to /tickets', () => {
      const n = makeNotification({ type: 'ticket_purchased' });
      expect(getNotificationDeepLink(n)).toBe('/tickets');
    });

    it('routes event types to event page when eventId exists', () => {
      const n = makeNotification({ type: 'event_reminder', data: { eventId: 'evt_1' } });
      expect(getNotificationDeepLink(n)).toBe('/event/evt_1');
    });

    it('routes safety_alert to /safety', () => {
      const n = makeNotification({ type: 'safety_alert' });
      expect(getNotificationDeepLink(n)).toBe('/safety');
    });
  });
});
