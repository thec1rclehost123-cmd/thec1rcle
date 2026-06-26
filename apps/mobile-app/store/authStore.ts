import { create } from 'zustand';
import { AppState } from 'react-native';
import { User, subscribeToAuthState } from '@/lib/firebase';
import { clearAuthSessionSync, markAuthSessionPending, syncAuthSession } from '@/lib/api';
import { refreshPushToken } from '@/lib/notifications';
import { wsManager } from '@/lib/websocket';
import { useProfileStore } from './profileStore';
import { useNotificationsStore } from './notificationsStore';
import { useTicketsStore } from './ticketsStore';
import { useSubscriptionStore } from './subscriptionStore';

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  serverSynced: boolean;
  authSyncInProgress: boolean;
  authSyncError: string | null;
  authSyncFailed: boolean;
  isGuest: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  setGuestMode: (isGuest: boolean) => void;
  profileSetupJustCompleted: boolean;
  setProfileSetupJustCompleted: (val: boolean) => void;
  onboardingJustCompleted: boolean;
  setOnboardingJustCompleted: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  initialized: false,
  serverSynced: false,
  authSyncInProgress: false,
  authSyncError: null,
  authSyncFailed: false,
  isGuest: false,
  setGuestMode: (isGuest) => {
    set({
      isGuest,
      user: null,
      initialized: true,
      loading: false,
      serverSynced: false,
      authSyncInProgress: false,
      authSyncError: null,
      authSyncFailed: false,
    });
    if (isGuest) {
      useProfileStore.getState().clearProfile();
      useNotificationsStore.getState().clearNotifications();
      useTicketsStore.getState().clearOrders();
      useSubscriptionStore.getState().clearSubscription();
      try {
        wsManager.stop();
      } catch {
        if (__DEV__) console.warn('[AuthStore] Failed to stop websocket after guest mode.');
      }
    }
  },
  setUser: (user) => {
    if (user) {
      if (__DEV__)
        console.warn('[AuthStore] Ignored direct authenticated user set before server sync.');
      return;
    }
    set({ user: null, serverSynced: false, authSyncFailed: false });
  },
  setLoading: (loading) => set({ loading }),
  setInitialized: (initialized) => set({ initialized, loading: false }),
  profileSetupJustCompleted: false,
  setProfileSetupJustCompleted: (val) => set({ profileSetupJustCompleted: val }),
  onboardingJustCompleted: false,
  setOnboardingJustCompleted: (val) => set({ onboardingJustCompleted: val }),
}));

// Initialize auth listener (call this once in root layout)
export function initAuthListener() {
  let currentUserId: string | null = null;
  let authSequence = 0;
  let authSyncRetryCount = 0;
  let syncRetryTimer: ReturnType<typeof setTimeout> | null = null;

  function clearSyncRetry() {
    if (syncRetryTimer) {
      clearTimeout(syncRetryTimer);
      syncRetryTimer = null;
    }
  }

  function setAwaitingServerSync() {
    useAuthStore.setState({
      user: null,
      loading: true,
      initialized: false,
      serverSynced: false,
      authSyncInProgress: true,
      authSyncError: null,
    });
  }

  function setServerSyncFailed(error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to sync auth session.';
    useAuthStore.setState({
      user: null,
      loading: true,
      initialized: false,
      serverSynced: false,
      authSyncInProgress: false,
      authSyncError: message,
    });
  }

  function setAuthenticatedUser(user: User) {
    useAuthStore.setState({
      user,
      loading: false,
      initialized: true,
      serverSynced: true,
      authSyncInProgress: false,
      authSyncError: null,
      authSyncFailed: false,
      isGuest: false,
    });
  }

  async function syncAfterFirebaseAuth(user: User) {
    const result = await syncAuthSession();
    if (result.requiresTokenRefresh !== false) {
      await user.getIdToken(true);
    }
    const canonicalProfile =
      result.profile || result.user || result.data?.profile || result.data?.user;
    if (canonicalProfile) {
      useProfileStore.getState().setProfileFromGateway(user.uid, canonicalProfile);
      useSubscriptionStore.getState().hydrateFromProfile(canonicalProfile);
    }
    void useSubscriptionStore.getState().fetchSubscription();
  }

  function scheduleServerSyncRetry(user: User, sequence: number) {
    clearSyncRetry();
    authSyncRetryCount += 1;
    if (authSyncRetryCount >= 5) {
      useAuthStore.setState({ authSyncFailed: true });
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, authSyncRetryCount), 30000);
    syncRetryTimer = setTimeout(() => {
      if (sequence === authSequence) {
        void hydrateAuthenticatedUser(user, sequence);
      }
    }, delay);
  }

  async function hydrateAuthenticatedUser(user: User, sequence: number) {
    setAwaitingServerSync();
    try {
      await syncAfterFirebaseAuth(user);
    } catch (error) {
      if (sequence !== authSequence) return;
      if (__DEV__)
        console.warn('[AuthStore] Server auth sync failed after Firebase sign-in.', error);
      setServerSyncFailed(error);
      scheduleServerSyncRetry(user, sequence);
      return;
    }

    if (sequence !== authSequence) return;

    clearSyncRetry();
    currentUserId = user.uid;
    setAuthenticatedUser(user);
    useTicketsStore.getState().clearOrders();
    void useProfileStore.getState().loadProfile(user.uid);
    void useNotificationsStore.getState().fetchNotifications(user.uid);
    void refreshPushToken(user.uid);
    try {
      void user.getIdToken().then((token) => wsManager.start(token));
    } catch {
      if (__DEV__) console.warn('[AuthStore] Failed to start websocket after auth.');
    }
  }

  const unsubscribe = subscribeToAuthState((user) => {
    authSequence += 1;
    const sequence = authSequence;
    clearSyncRetry();
    authSyncRetryCount = 0;

    if (user) {
      markAuthSessionPending(user.uid);
      void hydrateAuthenticatedUser(user, sequence);
    } else {
      currentUserId = null;
      clearAuthSessionSync();
      useAuthStore.setState({
        user: null,
        loading: false,
        initialized: true,
        serverSynced: false,
        authSyncInProgress: false,
        authSyncError: null,
        authSyncFailed: false,
      });
      useProfileStore.getState().clearProfile();
      useNotificationsStore.getState().clearNotifications();
      useTicketsStore.getState().clearOrders();
      useSubscriptionStore.getState().clearSubscription();
      try {
        wsManager.stop();
      } catch {
        if (__DEV__) console.warn('[AuthStore] Failed to stop websocket after sign out.');
      }
    }
  });

  const appStateSubscription = AppState.addEventListener('change', (state) => {
    if (state === 'active' && currentUserId) {
      void refreshPushToken(currentUserId);
    }
  });

  return () => {
    clearSyncRetry();
    unsubscribe();
    appStateSubscription.remove();
  };
}
