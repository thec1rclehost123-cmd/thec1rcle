/* global jest, describe, beforeEach, it, expect */

jest.mock('expo-linking', () => ({
  parse: jest.fn(),
  getInitialURL: jest.fn().mockResolvedValue(null),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}));

jest.mock('react-native', () => ({
  Share: { share: jest.fn(), sharedAction: 'sharedAction' },
  Platform: { OS: 'ios' },
}));

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}));

jest.mock('../../store/authStore', () => ({
  useAuthStore: { getState: jest.fn() },
}));

jest.mock('../../store/profileStore', () => ({
  useProfileStore: { getState: jest.fn(() => ({ profile: {} })) },
}));

jest.mock('../../store/firstRunStore', () => ({
  useFirstRunStore: { getState: jest.fn(() => ({ snapshot: {} })) },
}));

jest.mock('../../lib/firstRun', () => ({
  resolveFirstRunStage: jest.fn(() => 'complete'),
}));

import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { resolveFirstRunStage } from '../../lib/firstRun';

import {
  buildDeepLink,
  buildAppLink,
  shareEventLink,
  shareTransferCode,
  shareInviteLink,
  copyToClipboard,
  parseDeepLink,
  handleDeepLink,
  subscribeToDeepLinks,
} from '../../lib/deeplinks';

describe('deeplinks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildDeepLink', () => {
    it('builds a universal link with query params', () => {
      const link = buildDeepLink('event', { id: 'evt_123' });
      expect(link).toBe('https://thec1rcle.com/app/event?id=evt_123');
    });
  });

  describe('buildAppLink', () => {
    it('builds an app scheme link', () => {
      const link = buildAppLink('event', { id: 'evt_123' });
      expect(link).toBe('c1rcle://event?id=evt_123');
    });
  });

  describe('shareEventLink', () => {
    it('shares with custom message when provided', async () => {
      (Share.share as jest.Mock).mockResolvedValueOnce({ action: 'sharedAction' });

      const result = await shareEventLink('evt_1', 'Cool Event', 'Custom msg');

      expect(result).toBe(true);
      expect(Share.share).toHaveBeenCalledWith({
        message: 'Custom msg',
        url: 'https://thec1rcle.com/event/evt_1',
        title: 'Cool Event',
      });
    });

    it('returns false on error', async () => {
      (Share.share as jest.Mock).mockRejectedValueOnce(new Error('fail'));

      const result = await shareEventLink('evt_1', 'Event');
      expect(result).toBe(false);
    });
  });

  describe('shareTransferCode', () => {
    it('shares transfer code message', async () => {
      (Share.share as jest.Mock).mockResolvedValueOnce({ action: 'sharedAction' });

      const result = await shareTransferCode('ABC123', 'My Event');
      expect(result).toBe(true);
      expect(Share.share).toHaveBeenCalledWith({
        message: expect.stringContaining('ABC123'),
        title: 'Ticket Transfer',
      });
    });
  });

  describe('shareInviteLink', () => {
    it('includes referral code in link', async () => {
      (Share.share as jest.Mock).mockResolvedValueOnce({ action: 'sharedAction' });

      const result = await shareInviteLink('ref_abc');
      expect(result).toBe(true);
      expect(Share.share).toHaveBeenCalledWith({
        message: expect.stringContaining('ref=ref_abc'),
        title: 'Join THE C1RCLE',
      });
    });
  });

  describe('copyToClipboard', () => {
    it('copies text to clipboard', async () => {
      await copyToClipboard('hello');
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('hello');
    });
  });

  describe('parseDeepLink', () => {
    it('parses event deep link with path ID', () => {
      (Linking.parse as jest.Mock).mockReturnValueOnce({
        path: 'event/evt_456',
        queryParams: {},
      });

      const result = parseDeepLink('c1rcle://event/evt_456');
      expect(result).toEqual({
        type: 'event',
        params: { id: 'evt_456', eventId: 'evt_456' },
      });
    });

    it('parses link with query params', () => {
      (Linking.parse as jest.Mock).mockReturnValueOnce({
        path: 'event',
        queryParams: { id: 'evt_789' },
      });

      const result = parseDeepLink('c1rcle://event?id=evt_789');
      expect(result).toEqual({
        type: 'event',
        params: { id: 'evt_789' },
      });
    });

    it('parses safety type (no ID)', () => {
      (Linking.parse as jest.Mock).mockReturnValueOnce({
        path: 'safety',
        queryParams: {},
      });

      const result = parseDeepLink('c1rcle://safety');
      expect(result).toEqual({ type: 'safety', params: {} });
    });

    it('parses a custom-scheme host link using Expo Linking hostname semantics', () => {
      (Linking.parse as jest.Mock).mockReturnValueOnce({
        hostname: 'host',
        path: 'demo-host-03',
        queryParams: {},
      });

      expect(parseDeepLink('c1rcle://host/demo-host-03')).toEqual({
        type: 'host',
        params: { id: 'demo-host-03', hostId: 'demo-host-03' },
      });
    });

    it('parses a universal venue link with the app path prefix', () => {
      (Linking.parse as jest.Mock).mockReturnValueOnce({
        hostname: 'thec1rcle.com',
        path: 'app/venue/demo-venue-01',
        queryParams: {},
      });

      expect(parseDeepLink('https://thec1rcle.com/app/venue/demo-venue-01')).toEqual({
        type: 'venue',
        params: { id: 'demo-venue-01', venueId: 'demo-venue-01' },
      });
    });

    it('returns null type for unknown links', () => {
      (Linking.parse as jest.Mock).mockReturnValueOnce({
        path: '',
        queryParams: {},
      });

      const result = parseDeepLink('garbage');
      expect(result.type).toBeNull();
    });

    it('returns null type on parse error', () => {
      (Linking.parse as jest.Mock).mockImplementationOnce(() => {
        throw new Error('parse fail');
      });

      const result = parseDeepLink('bad');
      expect(result).toEqual({ type: null, params: {} });
    });
  });

  describe('handleDeepLink', () => {
    it('redirects to login when user is not authenticated', () => {
      (useAuthStore.getState as jest.Mock).mockReturnValueOnce({ user: null });

      handleDeepLink('c1rcle://event?id=evt_1');

      expect(router.replace).toHaveBeenCalledWith('/(auth)/login');
      expect(router.push).not.toHaveBeenCalled();
    });

    it('routes to event page when authenticated', () => {
      (useAuthStore.getState as jest.Mock).mockReturnValueOnce({ user: { uid: 'u1' } });
      (Linking.parse as jest.Mock).mockReturnValueOnce({
        path: 'event/evt_1',
        queryParams: {},
      });

      handleDeepLink('c1rcle://event/evt_1');

      expect(router.push).toHaveBeenCalledWith('/event/evt_1');
    });

    it('routes to safety page', () => {
      (useAuthStore.getState as jest.Mock).mockReturnValueOnce({ user: { uid: 'u1' } });
      (Linking.parse as jest.Mock).mockReturnValueOnce({
        path: 'safety',
        queryParams: {},
      });

      handleDeepLink('c1rcle://safety');
      expect(router.push).toHaveBeenCalledWith('/safety');
    });

    it('routes custom-scheme host links to the Expo Router host screen', () => {
      (useAuthStore.getState as jest.Mock).mockReturnValueOnce({ user: { uid: 'u1' } });
      (Linking.parse as jest.Mock).mockReturnValueOnce({
        hostname: 'host',
        path: 'demo-host-03',
        queryParams: {},
      });

      handleDeepLink('c1rcle://host/demo-host-03');

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/host/[id]',
        params: { id: 'demo-host-03' },
      });
    });

    it('routes custom-scheme venue links to the Expo Router venue screen', () => {
      (useAuthStore.getState as jest.Mock).mockReturnValueOnce({ user: { uid: 'u1' } });
      (Linking.parse as jest.Mock).mockReturnValueOnce({
        hostname: 'venue',
        path: 'demo-venue-01',
        queryParams: {},
      });

      handleDeepLink('c1rcle://venue/demo-venue-01');

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/venue/[id]',
        params: { id: 'demo-venue-01' },
      });
    });

    it('does not manually push a host route already handled by native Expo Router', () => {
      (useAuthStore.getState as jest.Mock).mockReturnValueOnce({ user: { uid: 'u1' } });
      (Linking.parse as jest.Mock).mockReturnValueOnce({
        hostname: 'host',
        path: 'demo-host-03',
        queryParams: {},
      });

      handleDeepLink('c1rcle://host/demo-host-03', {
        nativeFileRouteAlreadyHandled: true,
      });

      expect(router.push).not.toHaveBeenCalled();
    });

    it('does not manually push a venue route already handled by native Expo Router', () => {
      (useAuthStore.getState as jest.Mock).mockReturnValueOnce({ user: { uid: 'u1' } });
      (Linking.parse as jest.Mock).mockReturnValueOnce({
        hostname: 'venue',
        path: 'demo-venue-01',
        queryParams: {},
      });

      handleDeepLink('c1rcle://venue/demo-venue-01', {
        nativeFileRouteAlreadyHandled: true,
      });

      expect(router.push).not.toHaveBeenCalled();
    });

    it('keeps auth gating for a native file route owned by Expo Router', () => {
      (useAuthStore.getState as jest.Mock).mockReturnValueOnce({ user: null });

      handleDeepLink('c1rcle://host/demo-host-03', {
        nativeFileRouteAlreadyHandled: true,
      });

      expect(router.replace).toHaveBeenCalledWith('/(auth)/login');
      expect(router.push).not.toHaveBeenCalled();
    });

    it('keeps first-run gating for a native file route owned by Expo Router', () => {
      (useAuthStore.getState as jest.Mock).mockReturnValueOnce({ user: { uid: 'u1' } });
      (resolveFirstRunStage as jest.Mock).mockReturnValueOnce('account');

      handleDeepLink('c1rcle://venue/demo-venue-01', {
        nativeFileRouteAlreadyHandled: true,
      });

      expect(router.replace).toHaveBeenCalledWith('/');
      expect(router.push).not.toHaveBeenCalled();
    });
  });

  describe('subscribeToDeepLinks', () => {
    it('subscribes and returns unsubscribe', async () => {
      const handler = jest.fn();
      const subscription = { remove: jest.fn() };
      (Linking.addEventListener as jest.Mock).mockReturnValueOnce(subscription);

      const unsubscribe = subscribeToDeepLinks(handler);

      expect(Linking.getInitialURL).toHaveBeenCalled();
      expect(Linking.addEventListener).toHaveBeenCalledWith('url', expect.any(Function));

      unsubscribe();
      expect(subscription.remove).toHaveBeenCalled();
    });
  });
});
