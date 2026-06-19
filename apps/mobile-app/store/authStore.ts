import { create } from 'zustand';
import { AppState } from 'react-native';
import { User, subscribeToAuthState } from '@/lib/firebase';
import { syncAuthSession } from '@/lib/api';
import { refreshPushToken } from '@/lib/notifications';
import { wsManager } from '@/lib/websocket';
import { useProfileStore } from './profileStore';
import { useNotificationsStore } from './notificationsStore';
import { useTicketsStore } from './ticketsStore';

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
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
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setInitialized: (initialized) => set({ initialized, loading: false }),
  profileSetupJustCompleted: false,
  setProfileSetupJustCompleted: (val) => set({ profileSetupJustCompleted: val }),
  onboardingJustCompleted: false,
  setOnboardingJustCompleted: (val) => set({ onboardingJustCompleted: val }),
}));

// Initialize auth listener (call this once in root layout)
export function initAuthListener() {
  const { setUser, setInitialized } = useAuthStore.getState();
  let currentUserId: string | null = null;

  async function syncAfterFirebaseAuth(user: User) {
    try {
      const result = await syncAuthSession();
      if (result.requiresTokenRefresh !== false) {
        await user.getIdToken(true);
      }
      const canonicalProfile = result.profile || result.user;
      if (canonicalProfile) {
        useProfileStore.getState().setProfileFromGateway(user.uid, canonicalProfile);
      }
    } catch (error) {
      console.warn('[AuthStore] Server auth sync failed after Firebase sign-in.', error);
    }
  }

  async function hydrateAuthenticatedUser(user: User) {
    currentUserId = user.uid;
    await syncAfterFirebaseAuth(user);
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
    setUser(user);
    setInitialized(true);

    if (user) {
      void hydrateAuthenticatedUser(user);
    } else {
      currentUserId = null;
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
    unsubscribe();
    appStateSubscription.remove();
  };
}
