let mockAuthCallback: any = null;
let mockCurrentUser: any = null;
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
const mockChatState = { clearChats: jest.fn() };

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: mockAppStateRemove })),
    currentState: 'active',
  },
}));

jest.mock('../../lib/firebase', () => ({
  subscribeToAuthState: jest.fn((callback) => {
    mockAuthCallback = (user: any) => {
      mockCurrentUser = user;
      callback(user);
    };
    return mockUnsubscribe;
  }),
  getFirebaseAuth: jest.fn(() => ({ currentUser: mockCurrentUser })),
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

jest.mock('../../store/chatStore', () => ({
  useChatStore: { getState: () => mockChatState },
}));

import { initAuthListener, useAuthStore } from '../../store/authStore';
import { useDatingStore } from '../../store/datingStore';
import { syncAuthSession } from '../../lib/api';
import { refreshPushToken } from '../../lib/notifications';
import { wsManager } from '../../lib/websocket';

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('authStore', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    mockAuthCallback = null;
    mockCurrentUser = null;
    useDatingStore.getState().clearDatingState();
    useAuthStore.setState({
      user: null,
      loading: true,
      initialized: false,
      serverSynced: false,
      authSyncInProgress: false,
      authSyncError: null,
      authSyncFailed: false,
      isGuest: false,
      profileSetupJustCompleted: false,
      onboardingJustCompleted: false,
    });
  });

  describe('setGuestMode', () => {
    it('sets guest state and clears sibling stores', () => {
      useDatingStore.getState().setOwnerUserId('previous-user');
      useDatingStore.setState({
        profilesOwnerUserId: 'previous-user',
        profiles: [{ userId: 'other-user' } as any],
      });

      useAuthStore.getState().setGuestMode(true);

      const state = useAuthStore.getState();
      expect(state.isGuest).toBe(true);
      expect(state.user).toBeNull();
      expect(state.initialized).toBe(true);
      expect(state.loading).toBe(false);
      expect(state.serverSynced).toBe(false);
      expect(state.authSyncFailed).toBe(false);

      expect(mockProfileState.clearProfile).toHaveBeenCalled();
      expect(mockNotificationsState.clearNotifications).toHaveBeenCalled();
      expect(mockTicketsState.clearOrders).toHaveBeenCalled();
      expect(mockSubscriptionState.clearSubscription).toHaveBeenCalled();
      expect(mockChatState.clearChats).toHaveBeenCalled();
      expect(useDatingStore.getState()).toMatchObject({
        ownerUserId: null,
        profilesOwnerUserId: null,
        profiles: [],
      });
      expect(wsManager.stop).toHaveBeenCalled();
    });

    it('does nothing to sibling stores when isGuest is false', () => {
      useAuthStore.getState().setGuestMode(false);

      expect(mockProfileState.clearProfile).not.toHaveBeenCalled();
      expect(wsManager.stop).not.toHaveBeenCalled();
    });
  });

  describe('setUser', () => {
    it('ignores setting a non-null user directly', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const fakeUser = { uid: 'manual_user' };

      useAuthStore.getState().setUser(fakeUser as any);

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().serverSynced).toBe(false);
      warnSpy.mockRestore();
    });

    it('resets user state when null is passed', () => {
      useAuthStore.setState({
        user: { uid: 'existing' } as any,
        serverSynced: true,
        authSyncFailed: true,
      });

      useAuthStore.getState().setUser(null);

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().serverSynced).toBe(false);
      expect(useAuthStore.getState().authSyncFailed).toBe(false);
    });
  });

  describe('state flags', () => {
    it('setLoading updates loading', () => {
      useAuthStore.setState({ loading: false });
      useAuthStore.getState().setLoading(true);
      expect(useAuthStore.getState().loading).toBe(true);
    });

    it('setInitialized sets initialized and clears loading', () => {
      useAuthStore.setState({ loading: true, initialized: false });
      useAuthStore.getState().setInitialized(true);
      expect(useAuthStore.getState().initialized).toBe(true);
      expect(useAuthStore.getState().loading).toBe(false);
    });

    it('setProfileSetupJustCompleted updates flag', () => {
      useAuthStore.getState().setProfileSetupJustCompleted(true);
      expect(useAuthStore.getState().profileSetupJustCompleted).toBe(true);
    });

    it('setOnboardingJustCompleted updates flag', () => {
      useAuthStore.getState().setOnboardingJustCompleted(true);
      expect(useAuthStore.getState().onboardingJustCompleted).toBe(true);
    });
  });

  describe('initAuthListener', () => {
    it('hydrates authenticated user after successful sync', async () => {
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

      await flushPromises();

      expect(syncAuthSession).toHaveBeenCalledTimes(1);
      expect(user.getIdToken).toHaveBeenCalledWith(true);
      expect(mockProfileState.setProfileFromGateway).toHaveBeenCalledWith('user_1', {
        uid: 'user_1',
        role: 'guest',
      });
      expect(mockSubscriptionState.hydrateFromProfile).toHaveBeenCalledWith({
        uid: 'user_1',
        role: 'guest',
      });
      expect(mockSubscriptionState.fetchSubscription).toHaveBeenCalled();

      const state = useAuthStore.getState();
      expect(state.user).toBe(user);
      expect(state.loading).toBe(false);
      expect(state.initialized).toBe(true);
      expect(state.serverSynced).toBe(true);
      expect(state.authSyncError).toBeNull();
      expect(state.isGuest).toBe(false);

      expect(mockTicketsState.clearOrders).toHaveBeenCalledWith();
      expect(mockProfileState.loadProfile).toHaveBeenCalledWith('user_1');
      expect(mockNotificationsState.fetchNotifications).toHaveBeenCalledWith('user_1');
      expect(refreshPushToken).toHaveBeenCalledWith('user_1');
      await flushPromises();
      expect(wsManager.start).toHaveBeenCalledWith('firebase-token');

      cleanup();
    });

    it('clears the previous dating deck immediately when the authenticated UID changes', async () => {
      const firstUser = {
        uid: 'dating-owner-a',
        getIdToken: jest.fn(async () => 'token-a'),
      };
      const secondUser = {
        uid: 'dating-owner-b',
        getIdToken: jest.fn(async () => 'token-b'),
      };
      (syncAuthSession as jest.Mock)
        .mockResolvedValueOnce({
          profile: { uid: firstUser.uid },
          onboarding: { version: 2, currentStage: 'complete', completed: true },
          requiresTokenRefresh: false,
        })
        .mockResolvedValueOnce({
          profile: { uid: secondUser.uid },
          onboarding: { version: 2, currentStage: 'complete', completed: true },
          requiresTokenRefresh: false,
        });

      const cleanup = initAuthListener();
      mockAuthCallback?.(firstUser);
      await flushPromises();
      useDatingStore.setState({
        profilesOwnerUserId: firstUser.uid,
        matchesOwnerUserId: firstUser.uid,
        profiles: [{ userId: 'other-user' } as any],
        matches: [{ id: 'match-1', otherUserId: 'other-user' } as any],
      });

      mockAuthCallback?.(secondUser);

      expect(useDatingStore.getState()).toMatchObject({
        ownerUserId: secondUser.uid,
        profilesOwnerUserId: null,
        matchesOwnerUserId: null,
        profiles: [],
        matches: [],
      });
      await flushPromises();
      cleanup();
    });

    it('clears state and sibling stores on sign out', () => {
      const cleanup = initAuthListener();
      useDatingStore.getState().setOwnerUserId('previous-user');
      useDatingStore.setState({
        matchesOwnerUserId: 'previous-user',
        matches: [{ id: 'match-1', otherUserId: 'other-user' } as any],
      });

      mockAuthCallback?.(null);

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.initialized).toBe(true);
      expect(state.serverSynced).toBe(false);
      expect(state.authSyncFailed).toBe(false);

      expect(mockProfileState.clearProfile).toHaveBeenCalled();
      expect(mockNotificationsState.clearNotifications).toHaveBeenCalled();
      expect(mockTicketsState.clearOrders).toHaveBeenCalled();
      expect(mockSubscriptionState.clearSubscription).toHaveBeenCalled();
      expect(useDatingStore.getState()).toMatchObject({
        ownerUserId: null,
        matchesOwnerUserId: null,
        matches: [],
      });
      expect(wsManager.stop).toHaveBeenCalled();

      cleanup();
    });

    it('retries sync on failure with exponential backoff', async () => {
      jest.useFakeTimers();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
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

      expect(useAuthStore.getState().authSyncError).toBe('gateway unavailable');
      expect(useAuthStore.getState().initialized).toBe(false);
      expect(useAuthStore.getState().loading).toBe(true);

      await jest.advanceTimersByTimeAsync(3000);
      await flushPromises();

      expect(syncAuthSession).toHaveBeenCalledTimes(2);
      expect(useAuthStore.getState().serverSynced).toBe(true);
      expect(useAuthStore.getState().authSyncError).toBeNull();

      warnSpy.mockRestore();
      cleanup();
    });

    it('gives up after 5 retries and sets authSyncFailed', async () => {
      jest.useFakeTimers();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const user = {
        uid: 'user_fail',
        getIdToken: jest.fn(async () => 'fail-token'),
      };
      (syncAuthSession as jest.Mock).mockRejectedValue(new Error('persistent error'));

      const cleanup = initAuthListener();
      mockAuthCallback?.(user);
      await flushPromises();

      for (let i = 0; i < 5; i++) {
        await jest.advanceTimersByTimeAsync(60000);
        await flushPromises();
      }

      expect(useAuthStore.getState().authSyncFailed).toBe(true);
      expect(useAuthStore.getState().serverSynced).toBe(false);

      warnSpy.mockRestore();
      cleanup();
    });

    it('stops retrying if auth sequence changes', async () => {
      jest.useFakeTimers();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const user = {
        uid: 'user_seq',
        getIdToken: jest.fn(async () => 'seq-token'),
      };
      (syncAuthSession as jest.Mock).mockRejectedValue(new Error('error'));

      const cleanup = initAuthListener();
      mockAuthCallback?.(user);
      await flushPromises();

      mockAuthCallback?.(null);
      jest.advanceTimersByTime(3000);
      await flushPromises();

      expect(syncAuthSession).toHaveBeenCalledTimes(1);

      warnSpy.mockRestore();
      cleanup();
    });

    it('registers AppState listener and refreshes push token on foreground', () => {
      const addEventListener = require('react-native').AppState.addEventListener;
      const cleanup = initAuthListener();

      const handler = addEventListener.mock.calls[0][1];
      expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

      handler('active');
      expect(refreshPushToken).not.toHaveBeenCalled();

      cleanup();
    });

    it('calls unsubscribe and appStateSubscription.remove on cleanup', () => {
      const cleanup = initAuthListener();

      cleanup();

      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(mockAppStateRemove).toHaveBeenCalled();
    });

    it('removes previous sync retry timer on new auth event', async () => {
      jest.useFakeTimers();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const user = {
        uid: 'user_stale',
        getIdToken: jest.fn(async () => 'stale-token'),
      };
      (syncAuthSession as jest.Mock).mockRejectedValue(new Error('stale error'));

      const cleanup = initAuthListener();
      mockAuthCallback?.(user);
      await flushPromises();

      const user2 = {
        uid: 'user_fresh',
        getIdToken: jest.fn(async () => 'fresh-token'),
      };
      (syncAuthSession as jest.Mock).mockResolvedValueOnce({
        profile: { uid: 'user_fresh', role: 'guest' },
        requiresTokenRefresh: false,
      });

      mockAuthCallback?.(user2);
      await flushPromises();

      expect(syncAuthSession).toHaveBeenCalledTimes(2);
      expect(useAuthStore.getState().user?.uid).toBe('user_fresh');

      warnSpy.mockRestore();
      cleanup();
    });
  });
});
