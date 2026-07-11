/* global jest, describe, beforeEach, it, expect */

let mockAuthCallback: ((user: any) => void) | null = null;
const mockUnsubscribe = jest.fn();
const mockAppStateRemove = jest.fn();
const mockProfileState = {
  setProfileFromGateway: jest.fn(),
  loadProfile: jest.fn(),
  clearProfile: jest.fn(),
};
const mockNotificationsState = {
  fetchNotifications: jest.fn(),
  clearNotifications: jest.fn(),
};
const mockTicketsState = {
  clearOrders: jest.fn(),
};
const mockSubscriptionState = {
  hydrateFromProfile: jest.fn(),
  fetchSubscription: jest.fn(),
  fetchRevenueCatSubscription: jest.fn(),
  clearSubscription: jest.fn(),
};

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: mockAppStateRemove })),
  },
}));

jest.mock('../../lib/firebase', () => ({
  subscribeToAuthState: jest.fn((callback) => {
    mockAuthCallback = callback;
    return mockUnsubscribe;
  }),
}));

jest.mock('../../lib/api', () => ({
  syncAuthSession: jest.fn(),
}));

jest.mock('../../lib/notifications', () => ({
  refreshPushToken: jest.fn(),
}));

jest.mock('../../lib/websocket', () => ({
  wsManager: {
    start: jest.fn(),
    stop: jest.fn(),
  },
}));

jest.mock('../../store/profileStore', () => ({
  useProfileStore: { getState: () => mockProfileState },
}));

jest.mock('../../store/notificationsStore', () => ({
  useNotificationsStore: { getState: () => mockNotificationsState },
}));

jest.mock('../../store/ticketsStore', () => ({
  useTicketsStore: { getState: () => mockTicketsState },
}));

jest.mock('../../store/subscriptionStore', () => ({
  useSubscriptionStore: { getState: () => mockSubscriptionState },
}));

import { initAuthListener, useAuthStore } from '../../store/authStore';
import { syncAuthSession } from '../../lib/api';
import { refreshPushToken } from '../../lib/notifications';
import { wsManager } from '../../lib/websocket';

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('authStore server handshake', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    mockAuthCallback = null;
    useAuthStore.setState({
      user: null,
      loading: true,
      initialized: false,
      serverSynced: false,
      authSyncInProgress: false,
      authSyncError: null,
      profileSetupJustCompleted: false,
      onboardingJustCompleted: false,
    });
  });

  it('does not expose the Firebase user until auth sync succeeds', async () => {
    const user = {
      uid: 'user_1',
      phoneNumber: '+919876543210',
      providerData: [{ providerId: 'phone' }],
      getIdToken: jest.fn(async () => 'firebase-token'),
    };
    (syncAuthSession as jest.Mock).mockResolvedValueOnce({
      profile: { uid: 'user_1', role: 'guest' },
      onboarding: { version: 2, currentStage: 'complete', completed: true },
      claims: { role: 'guest' },
      requiresTokenRefresh: true,
    });

    const cleanup = initAuthListener();
    mockAuthCallback?.(user);

    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      loading: true,
      initialized: false,
      serverSynced: false,
      authSyncInProgress: true,
    });

    await flushPromises();

    expect(syncAuthSession).toHaveBeenCalledTimes(1);
    expect(user.getIdToken).toHaveBeenCalledWith(true);
    expect(mockProfileState.setProfileFromGateway).toHaveBeenCalledWith('user_1', {
      uid: 'user_1',
      role: 'guest',
    });
    expect(useAuthStore.getState()).toMatchObject({
      user,
      loading: false,
      initialized: true,
      serverSynced: true,
      authSyncInProgress: false,
      authSyncError: null,
    });
    expect(refreshPushToken).toHaveBeenCalledWith('user_1');
    await flushPromises();
    expect(wsManager.start).toHaveBeenCalledWith('firebase-token');

    cleanup();
  });

  it('keeps the app in loading state and retries when auth sync fails', async () => {
    jest.useFakeTimers();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const user = {
      uid: 'user_retry',
      getIdToken: jest.fn(async () => 'retry-token'),
    };
    (syncAuthSession as jest.Mock)
      .mockRejectedValueOnce(new Error('gateway unavailable'))
      .mockResolvedValueOnce({
        data: { profile: { uid: 'user_retry', role: 'guest' } },
        requiresTokenRefresh: false,
      });

    const cleanup = initAuthListener();
    mockAuthCallback?.(user);
    await flushPromises();

    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      loading: true,
      initialized: false,
      serverSynced: false,
      authSyncInProgress: false,
      authSyncError: 'gateway unavailable',
    });

    await jest.advanceTimersByTimeAsync(3000);
    await flushPromises();

    expect(syncAuthSession).toHaveBeenCalledTimes(2);
    expect(useAuthStore.getState()).toMatchObject({
      user,
      loading: false,
      initialized: true,
      serverSynced: true,
      authSyncError: null,
    });

    warnSpy.mockRestore();
    cleanup();
  });

  it('ignores direct non-null user writes so the server handshake cannot be bypassed', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    useAuthStore.getState().setUser({ uid: 'manual_user' } as any);

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().serverSynced).toBe(false);

    warnSpy.mockRestore();
  });
});
