import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/providers/DashboardAuthProvider', () => ({
  useDashboardAuth: () => ({
    profile: null,
    user: null,
  }),
}));

import {
  buildMarkAllReadRequest,
  buildQuickActionRequest,
  formatNotificationTimestamp,
  getNotificationFetchUrl,
  normalizeNotification,
} from './NotificationCenter';

describe('NotificationCenter helpers', () => {
  it('routes venue fetches to the venue notifications endpoint', () => {
    expect(getNotificationFetchUrl('venue', 'venue_123')).toBe(
      '/api/venue/notifications?venueId=venue_123&limit=20',
    );
  });

  it('routes host fetches to the host notifications endpoint', () => {
    expect(getNotificationFetchUrl('host', 'host_123')).toBe('/api/host/notifications?limit=20');
  });

  it('routes promoter fetches to the promoter notifications endpoint', () => {
    expect(getNotificationFetchUrl('promoter', 'promoter_123')).toBe(
      '/api/promoter/notifications?limit=20',
    );
  });

  it('builds the venue quick-action payload expected by the BFF', () => {
    const request = buildQuickActionRequest(
      'venue',
      'venue_123',
      {
        id: 'notif_1',
        type: 'connection_request',
        title: 't',
        description: 'd',
        timestamp: '1m',
        isRead: false,
      },
      'approve',
    );

    expect(request).toEqual({
      url: '/api/venue/notifications',
      body: {
        venueId: 'venue_123',
        notificationId: 'notif_1',
        notificationType: 'connection_request',
        action: 'approve',
      },
    });
  });

  it('builds the correct mark-all payloads for venue and host', () => {
    expect(buildMarkAllReadRequest('venue', 'venue_123')).toEqual({
      url: '/api/venue/notifications',
      body: { venueId: 'venue_123', markAllRead: true },
    });

    expect(buildMarkAllReadRequest('host', 'host_123')).toEqual({
      url: '/api/host/notifications',
      body: { markAllRead: true },
    });

    expect(buildMarkAllReadRequest('promoter', 'promoter_123')).toEqual({
      url: '/api/promoter/notifications',
      body: { markAllRead: true },
    });
  });

  it('normalizes gateway notifications into the UI shape', () => {
    const now = new Date(Date.now() - 2 * 60_000).toISOString();
    const notification = normalizeNotification(
      {
        id: 'notif_2',
        type: 'slot_request',
        title: 'Slot Request',
        message: 'Promoter requested a slot',
        createdAt: now,
        metadata: { promoterId: 'prom_1' },
      },
      'venue',
    );

    expect(notification.description).toBe('Promoter requested a slot');
    expect(notification.data).toEqual({ promoterId: 'prom_1' });
    expect(notification.actionable).toBe(true);
    expect(notification.isRead).toBe(false);
    expect(notification.timestamp).toMatch(/m|h|d|Now/);
  });

  it('respects host read fields from the host endpoint shape', () => {
    const notification = normalizeNotification(
      {
        id: 'notif_3',
        type: 'info',
        title: 'Host notification',
        message: 'Body',
        read: true,
        createdAt: '2026-04-02T00:00:00.000Z',
      },
      'host',
    );

    expect(notification.isRead).toBe(true);
    expect(notification.actionable).toBe(false);
  });

  it('formats invalid timestamps safely', () => {
    expect(formatNotificationTimestamp('not-a-date')).toBe('');
  });

  it('formats recent timestamps relatively', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-02T12:00:00.000Z'));

    expect(formatNotificationTimestamp('2026-04-02T11:58:00.000Z')).toBe('2m');

    vi.useRealTimers();
  });
});
