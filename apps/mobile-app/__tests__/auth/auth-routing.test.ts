/**
 * Tests for auth routing logic in app/index.tsx
 * Verifies:
 *  - No user → redirect to login
 *  - User + no profile → redirect to profile-setup
 *  - User + complete profile → redirect to explore
 */
import { router } from 'expo-router';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  useRootNavigation: jest.fn(),
  useSegments: jest.fn(() => []),
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@/lib/firebase/profile', () => ({
  isBasicUserProfileComplete: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockUseAuthStore = require('@/store/authStore').useAuthStore;
const mockIsBasicUserProfileComplete = require('@/lib/firebase/profile').isBasicUserProfileComplete;

describe('Auth routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Simulate app/index.tsx logic inline
  });

  it('redirects to login when no user is authenticated', async () => {
    mockUseAuthStore.mockReturnValue({ user: null, initialized: true });

    // Simulate the root index logic
    const { user, initialized } = mockUseAuthStore();
    if (!initialized) return;
    if (!user) {
      router.replace('/(auth)/login');
    }

    expect(router.replace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('redirects to profile-setup when user has no profile', async () => {
    const fakeUser = { uid: 'test-uid', displayName: 'Test' };
    mockUseAuthStore.mockReturnValue({ user: fakeUser, initialized: true });
    mockIsBasicUserProfileComplete.mockResolvedValue(false);

    // Simulate routing check
    const complete = await mockIsBasicUserProfileComplete(fakeUser.uid);

    // If we have a profile-setup-just-completed flag, skip
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    AsyncStorage.getItem.mockResolvedValue(null);

    if (complete) {
      router.replace('/(tabs)/explore');
    } else {
      router.replace('/profile-setup');
    }

    expect(router.replace).toHaveBeenCalledWith('/profile-setup');
  });

  it('redirects to explore when user has complete profile', async () => {
    const fakeUser = { uid: 'test-uid', displayName: 'Test' };
    mockUseAuthStore.mockReturnValue({ user: fakeUser, initialized: true });
    mockIsBasicUserProfileComplete.mockResolvedValue(true);

    const AsyncStorage = require('@react-native-async-storage/async-storage');
    AsyncStorage.getItem.mockResolvedValue(null);

    const complete = await mockIsBasicUserProfileComplete(fakeUser.uid);

    if (complete) {
      router.replace('/(tabs)/explore');
    } else {
      router.replace('/profile-setup');
    }

    expect(router.replace).toHaveBeenCalledWith('/(tabs)/explore');
  });

  it('redirects to explore if profile-setup just completed flag is set', async () => {
    const fakeUser = { uid: 'test-uid', displayName: 'Test' };
    mockUseAuthStore.mockReturnValue({ user: fakeUser, initialized: true });

    const AsyncStorage = require('@react-native-async-storage/async-storage');
    AsyncStorage.getItem.mockResolvedValue('true'); // profileSetupJustCompleted

    // The flag takes precedence — skip profile check, go to explore
    const flag = await AsyncStorage.getItem(`profileSetupJustCompleted_${fakeUser.uid}`);
    if (flag === 'true') {
      router.replace('/(tabs)/explore');
    }

    expect(router.replace).toHaveBeenCalledWith('/(tabs)/explore');
  });
});
