import { create } from 'zustand';
import { AppState } from 'react-native';
import { getFirebaseAuth, subscribeToAuthState, type User } from '@/lib/firebase';
import { syncAuthSession } from '@/lib/api';
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

let activeAuthUserId: string | null = null;
let authGeneration = 0;

function setAwaitingServerSync() {
  useAuthStore.setState({
    user: null,
    loading: true,
    initialized: false,
    serverSynced: false,
    authSyncInProgress: true,
    authSyncError: null,
    authSyncFailed: false,
    isGuest: false,
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

function startAuthenticatedSideEffects(user: User) {
  activeAuthUserId = user.uid;
  void useSubscriptionStore.getState().fetchRevenueCatSubscription();
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

export async function completeAuthSessionAfterSignIn(user: User) {
  setAwaitingServerSync();

  try {
    await syncAfterFirebaseAuth(user);
  } catch (error) {
    setServerSyncFailed(error);
    throw error;
  }

  const currentUser = getFirebaseAuth().currentUser;
  if (!currentUser || currentUser.uid !== user.uid) {
    throw new Error('Authenticated user changed before session completed.');
  }

  setAuthenticatedUser(currentUser);
  startAuthenticatedSideEffects(currentUser);
}

export function initAuthListener() {
  let retryCount = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  function cancelRetry() {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  function scheduleRetry(user: User, generation: number) {
    cancelRetry();
    retryCount += 1;
    if (retryCount >= 5) {
      useAuthStore.setState({ authSyncFailed: true });
      if (__DEV__) console.warn('[AuthStore] Server sync retries exhausted. authSyncFailed=true');
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
    retryTimer = setTimeout(() => {
      if (generation === authGeneration) {
        void hydrateAuthenticatedUser(user, generation);
      }
    }, delay);
  }

  async function hydrateAuthenticatedUser(user: User, generation: number) {
    if (generation !== authGeneration) return;
    if (__DEV__) console.log('[AuthStore] hydrateAuthenticatedUser starting');
    setAwaitingServerSync();
    try {
      if (__DEV__) console.log('[AuthStore] Calling syncAfterFirebaseAuth...');
      await syncAfterFirebaseAuth(user);
      if (__DEV__) console.log('[AuthStore] syncAfterFirebaseAuth completed successfully!');
    } catch (error) {
      if (__DEV__) console.log('[AuthStore] syncAfterFirebaseAuth FAILED:', error);
      if (generation !== authGeneration) return;
      if (__DEV__)
        console.warn('[AuthStore] Server auth sync failed after Firebase sign-in.', error);
      setServerSyncFailed(error);
      scheduleRetry(user, generation);
      return;
    }

    if (generation !== authGeneration) return;
    if (__DEV__) console.log('[AuthStore] Marking user as authenticated...');

    cancelRetry();
    setAuthenticatedUser(user);
    startAuthenticatedSideEffects(user);
    if (__DEV__) console.log('[AuthStore] setAuthenticatedUser called successfully.');
  }

  let currentAuthUserUid: string | null = null;

  const unsubscribe = subscribeToAuthState((user) => {
    if (user?.uid === currentAuthUserUid) {
      if (__DEV__) console.log('[AuthStore] Ignoring redundant auth state change for same user UID');
      return;
    }
    currentAuthUserUid = user?.uid || null;

    authGeneration += 1;
    const generation = authGeneration;
    if (__DEV__) console.log('[AuthStore] subscribeToAuthState fired. User exists:', !!user, 'Generation:', generation);

    cancelRetry();
    retryCount = 0;

    if (user) {
      void hydrateAuthenticatedUser(user, generation);
    } else {
      activeAuthUserId = null;
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
    if (state === 'active' && activeAuthUserId) {
      void refreshPushToken(activeAuthUserId);
      wsManager.onAppForeground();
    }
  });

  return () => {
    cancelRetry();
    unsubscribe();
    appStateSubscription.remove();
  };
}
