import { create } from 'zustand';
import { AppState } from 'react-native';
import { User, subscribeToAuthState } from '@/lib/firebase';
import { clearAuthSessionSync, markAuthSessionPending, syncAuthSession } from '@/lib/api';
import { refreshPushToken } from '@/lib/notifications';
import { wsManager } from '@/lib/websocket';
import { useProfileStore } from './profileStore';
import { useNotificationsStore } from './notificationsStore';
import { useTicketsStore } from './ticketsStore';

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  serverSynced: boolean;
  authSyncInProgress: boolean;
  authSyncError: string | null;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
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
  setUser: (user) => {
    if (user) {
      console.warn('[AuthStore] Ignored direct authenticated user set before server sync.');
      return;
    }
    set({ user: null, serverSynced: false });
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
    }
  }

  function scheduleServerSyncRetry(user: User, sequence: number) {
    clearSyncRetry();
    syncRetryTimer = setTimeout(() => {
      if (sequence === authSequence) {
        void hydrateAuthenticatedUser(user, sequence);
      }
    }, 3000);
  }

  async function hydrateAuthenticatedUser(user: User, sequence: number) {
    setAwaitingServerSync();
    try {
      await syncAfterFirebaseAuth(user);
    } catch (error) {
      if (sequence !== authSequence) return;
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
      console.warn('[AuthStore] Failed to start websocket after auth.');
    }
  }

  const unsubscribe = subscribeToAuthState((user) => {
    authSequence += 1;
    const sequence = authSequence;
    clearSyncRetry();

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
      });
      useProfileStore.getState().clearProfile();
      useNotificationsStore.getState().clearNotifications();
      useTicketsStore.getState().clearOrders();
      try {
        wsManager.stop();
      } catch {
        console.warn('[AuthStore] Failed to stop websocket after sign out.');
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
