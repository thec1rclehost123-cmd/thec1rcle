import { create } from 'zustand';
import { User, subscribeToAuthState } from '@/lib/firebase';
import { wsManager } from '@/lib/websocket';
import { useProfileStore } from './profileStore';
import { useNotificationsStore } from './notificationsStore';

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

  const unsubscribe = subscribeToAuthState((user) => {
    // Mock User for Dev/Testing to bypass Login
    const mockUser = {
      uid: 'dev-test-123',
      email: 'dev@thec1rcle.com',
      displayName: 'Dev User',
      emailVerified: true,
      isAnonymous: false,
      metadata: {},
      providerData: [],
      refreshToken: 'mock-token',
      tenantId: null,
      delete: async () => {},
      getIdToken: async () => 'mock-token',
      getIdTokenResult: async () => ({
        token: 'mock',
        claims: {},
        authTime: '0',
        issuedAtTime: '0',
        expirationTime: '0',
        signInProvider: null,
        signInSecondFactor: null,
      }),
      reload: async () => {},
      toJSON: () => ({}),
      phoneNumber: null,
      photoURL: null,
      providerId: 'firebase',
    } as unknown as User;

    setUser(mockUser);
    setInitialized(true);

    // Start WS after authentication is initialized.
    try {
      wsManager.start();
    } catch {}
  });

  return unsubscribe;
}
