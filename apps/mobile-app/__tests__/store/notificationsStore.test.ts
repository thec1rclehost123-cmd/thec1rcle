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

    it('extracts unreadCount from response.unreadCount when data is top-level', async () => {
      mockApiFetch.mockResolvedValueOnce({
        notifications: [
          {
            id: 'n1',
            type: 'event_reminder',
            title: 'T',
            body: 'B',
            read: false,
            createdAt: '2026-06-25T10:00:00Z',
          },
        ],
        unreadCount: 1,
      });

      await useNotificationsStore.getState().fetchNotifications('user_1');
      expect(useNotificationsStore.getState().unreadCount).toBe(1);
    });

    it('falls back to counting unread from notifications array', async () => {
      mockApiFetch.mockResolvedValueOnce({
        notifications: [
          {
            id: 'n1',
            type: 'event_reminder',
            title: 'T',
            body: 'B',
            read: false,
            createdAt: '2026-06-25T10:00:00Z',
          },
          {
            id: 'n2',
            type: 'dm_message',
            title: 'M',
            body: 'B',
            read: true,
            createdAt: '2026-06-25T09:00:00Z',
          },
        ],
      });

      await useNotificationsStore.getState().fetchNotifications('user_1');
      expect(useNotificationsStore.getState().unreadCount).toBe(1);
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

    it('handles removing non-existent id', () => {
      useNotificationsStore.setState({
        notifications: [makeNotification({ id: 'n1' })],
      });

      useNotificationsStore.getState().clearNotification('nonexistent');

      expect(useNotificationsStore.getState().notifications).toHaveLength(1);
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

    it('calls _unsubscribe on previous listener before creating new one', () => {
      const prevUnsub = jest.fn();
      useNotificationsStore.setState({ _unsubscribe: prevUnsub });
      mockApiFetch.mockResolvedValue({ data: { notifications: [], unreadCount: 0 } });

      useNotificationsStore.getState().subscribeToNotifications('user_1');

      expect(prevUnsub).toHaveBeenCalled();
    });
  });

  describe('getNotificationIcon', () => {
    it('returns the correct icon for each type', () => {
      expect(getNotificationIcon('ticket_purchased')).toBe('🎟️');
      expect(getNotificationIcon('ticket_transfer_received')).toBe('📥');
      expect(getNotificationIcon('ticket_refund')).toBe('💰');
      expect(getNotificationIcon('event_reminder')).toBe('⏰');
      expect(getNotificationIcon('event_changed')).toBe('📝');
      expect(getNotificationIcon('event_cancelled')).toBe('❌');
      expect(getNotificationIcon('dm_request')).toBe('💬');
      expect(getNotificationIcon('dm_message')).toBe('✉️');
      expect(getNotificationIcon('chat_mention')).toBe('@');
      expect(getNotificationIcon('contact_saved')).toBe('👥');
      expect(getNotificationIcon('safety_alert')).toBe('🚨');
      expect(getNotificationIcon('refund_completed')).toBe('✅');
      expect(getNotificationIcon('refund_failed')).toBe('⚠️');
      expect(getNotificationIcon('unknown_type' as any)).toBe('🔔');
    });
  });

  describe('getNotificationDeepLink', () => {
    it('routes ticket types to /tickets', () => {
      const types = [
        'ticket_purchased',
        'ticket_transfer_received',
        'ticket_refund',
        'refund_completed',
        'refund_failed',
      ];
      types.forEach((type) => {
        expect(getNotificationDeepLink(makeNotification({ type }))).toBe('/tickets');
      });
    });

    it('routes event types to event page when eventId exists', () => {
      const n = makeNotification({ type: 'event_reminder', data: { eventId: 'evt_1' } });
      expect(getNotificationDeepLink(n)).toBe('/event/evt_1');
    });

    it('routes event types to explore when no eventId', () => {
      const n = makeNotification({ type: 'event_changed', data: {} });
      expect(getNotificationDeepLink(n)).toBe('/explore');
    });

    it('routes safety_alert to /safety', () => {
      const n = makeNotification({ type: 'safety_alert' });
      expect(getNotificationDeepLink(n)).toBe('/safety');
    });

    it('routes dm_request to DM page when userId exists', () => {
      const n = makeNotification({ type: 'dm_request', data: { userId: 'user_2' } });
      expect(getNotificationDeepLink(n)).toBe('/social/dm/user_2');
    });

    it('routes dm_request to requests page when no userId', () => {
      const n = makeNotification({ type: 'dm_request', data: {} });
      expect(getNotificationDeepLink(n)).toBe('/social/requests');
    });

    it('routes chat_mention to group chat when eventId exists', () => {
      const n = makeNotification({ type: 'chat_mention', data: { eventId: 'evt_1' } });
      expect(getNotificationDeepLink(n)).toBe('/social/group/evt_1');
    });

    it('routes chat_mention to inbox when no eventId', () => {
      const n = makeNotification({ type: 'chat_mention', data: {} });
      expect(getNotificationDeepLink(n)).toBe('/inbox');
    });

    it('routes contact_saved to /social/contacts', () => {
      const n = makeNotification({ type: 'contact_saved' });
      expect(getNotificationDeepLink(n)).toBe('/social/contacts');
    });

    it('defaults to /notifications for unknown types', () => {
      const n = makeNotification({ type: 'unknown_type' as any });
      expect(getNotificationDeepLink(n)).toBe('/notifications');
    });
  });
});
