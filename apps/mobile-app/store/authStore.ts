import { create } from 'zustand';
import { AppState } from 'react-native';
import { getFirebaseAuth, subscribeToAuthState, type User } from '@/lib/firebase';
import { apiFetch, syncAuthSession } from '@/lib/api';
import { finishFirstRunMetric, startFirstRunMetric } from '@/lib/firstRunPerformance';
import { refreshPushToken } from '@/lib/notifications';
import { wsManager } from '@/lib/websocket';
import { useProfileStore } from './profileStore';
import { useNotificationsStore } from './notificationsStore';
import { useTicketsStore } from './ticketsStore';
import { useSubscriptionStore } from './subscriptionStore';
import { useFirstRunStore } from './firstRunStore';
import { useDatingStore } from './datingStore';
import { useChatStore } from './chatStore';
import { resolveFirstRunStage, unwrapFirstRunSnapshot } from '@/lib/firstRun';

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
      useFirstRunStore.getState().clear();
      useDatingStore.getState().clearDatingState();
      useChatStore.getState().clearChats();
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
    useDatingStore.getState().clearDatingState();
    useChatStore.getState().clearChats();
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
let serverSyncedUserId: string | null = null;
let authSyncFlight: { uid: string; promise: Promise<void> } | null = null;
let realtimeSessionTimer: ReturnType<typeof setTimeout> | null = null;
let realtimeSessionFlight: Promise<void> | null = null;

function stopRealtimeSessionRefresh() {
  if (realtimeSessionTimer) clearTimeout(realtimeSessionTimer);
  realtimeSessionTimer = null;
  realtimeSessionFlight = null;
}

function startRealtimeSession(userId: string): Promise<void> {
  if (realtimeSessionFlight) return realtimeSessionFlight;
  const flight = (async () => {
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser || currentUser.uid !== userId) return;
    const result = await apiFetch<{
      success: boolean;
      data: { token: string; expiresAt: string; expiresInSeconds: number };
    }>('/realtime/session', { method: 'POST' });
    if (getFirebaseAuth().currentUser?.uid !== userId) return;
    wsManager.start(result.data.token);
    if (realtimeSessionTimer) clearTimeout(realtimeSessionTimer);
    realtimeSessionTimer = setTimeout(
      () => void startRealtimeSession(userId),
      Math.max(15_000, Number(result.data.expiresInSeconds || 60) * 800),
    );
    (realtimeSessionTimer as any)?.unref?.();
  })();
  realtimeSessionFlight = flight;
  const clear = () => {
    if (realtimeSessionFlight === flight) realtimeSessionFlight = null;
  };
  void flight.then(clear, clear);
  return flight;
}

function resetAuthSyncCoordinator() {
  serverSyncedUserId = null;
  authSyncFlight = null;
}

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

async function performAuthSync(user: User): Promise<void> {
  startFirstRunMetric('auth_sync');
  let result;
  try {
    result = await syncAuthSession();
    finishFirstRunMetric('auth_sync', 'success');
  } catch (error) {
    finishFirstRunMetric('auth_sync', 'failure');
    throw error;
  }

  const currentUser = getFirebaseAuth().currentUser;
  if (!currentUser || currentUser.uid !== user.uid) {
    throw new Error('Authenticated user changed before session sync completed.');
  }

  if (result.requiresTokenRefresh !== false) {
    await user.getIdToken(true);
  }

  const refreshedUser = getFirebaseAuth().currentUser;
  if (!refreshedUser || refreshedUser.uid !== user.uid) {
    throw new Error('Authenticated user changed before session hydration completed.');
  }

  const canonicalProfile =
    result.profile || result.user || result.data?.profile || result.data?.user;
  if (canonicalProfile) {
    useProfileStore.getState().setProfileFromGateway(user.uid, canonicalProfile);
    useSubscriptionStore.getState().hydrateFromProfile(canonicalProfile);
  }
  useFirstRunStore.getState().setSnapshot(unwrapFirstRunSnapshot(result));
  void useSubscriptionStore.getState().fetchSubscription();
  serverSyncedUserId = user.uid;
}

function syncAfterFirebaseAuth(user: User): Promise<void> {
  if (serverSyncedUserId === user.uid) return Promise.resolve();
  if (authSyncFlight?.uid === user.uid) return authSyncFlight.promise;

  const promise = performAuthSync(user);
  authSyncFlight = { uid: user.uid, promise };
  const clearFlight = () => {
    if (authSyncFlight?.promise === promise) authSyncFlight = null;
  };
  void promise.then(clearFlight, clearFlight);
  return promise;
}

function startAuthenticatedSideEffects(user: User) {
  const profile = useProfileStore.getState().profile;
  const snapshot = useFirstRunStore.getState().snapshot;
  if (resolveFirstRunStage(user, profile, snapshot) !== 'complete') return;
  if (activeAuthUserId === user.uid) return;
  activeAuthUserId = user.uid;
  void useSubscriptionStore.getState().fetchRevenueCatSubscription();
  useTicketsStore.getState().clearOrders();
  void useProfileStore.getState().loadProfile(user.uid);
  void useNotificationsStore.getState().fetchNotifications(user.uid);
  void refreshPushToken(user.uid);
  try {
    wsManager.setConfig({
      onAuthFailure: () => void startRealtimeSession(user.uid),
    });
    void startRealtimeSession(user.uid);
  } catch {
    if (__DEV__) console.warn('[AuthStore] Failed to start websocket after auth.');
  }
}

export function startCompletedSessionSideEffects() {
  const user = getFirebaseAuth().currentUser;
  if (user) startAuthenticatedSideEffects(user);
}

export async function completeAuthSessionAfterSignIn(user: User) {
  useDatingStore.getState().setOwnerUserId(user.uid);
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
      useAuthStore.setState({
        authSyncFailed: true,
        initialized: true,
        loading: false,
        authSyncInProgress: false,
      });
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
      if (__DEV__)
        console.log('[AuthStore] Ignoring redundant auth state change for same user UID');
      return;
    }
    currentAuthUserUid = user?.uid || null;

    authGeneration += 1;
    const generation = authGeneration;
    if (__DEV__)
      console.log(
        '[AuthStore] subscribeToAuthState fired. User exists:',
        !!user,
        'Generation:',
        generation,
      );

    cancelRetry();
    retryCount = 0;

    if (user) {
      useDatingStore.getState().setOwnerUserId(user.uid);
      if (serverSyncedUserId && serverSyncedUserId !== user.uid) {
        resetAuthSyncCoordinator();
      }
      void hydrateAuthenticatedUser(user, generation);
    } else {
      activeAuthUserId = null;
      stopRealtimeSessionRefresh();
      resetAuthSyncCoordinator();
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
      useFirstRunStore.getState().clear();
      useDatingStore.getState().clearDatingState();
      useChatStore.getState().clearChats();
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
      if (!wsManager.isConnected) void startRealtimeSession(activeAuthUserId);
      wsManager.onAppForeground();
    }
  });

  return () => {
    cancelRetry();
    stopRealtimeSessionRefresh();
    unsubscribe();
    appStateSubscription.remove();
  };
}
