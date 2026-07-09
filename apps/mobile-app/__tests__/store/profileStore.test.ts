jest.mock('../../lib/api', () => ({
  apiFetch: jest.fn(),
  deduplicateRequest: jest.fn((_key: string, fetcher: () => Promise<any>) => fetcher()),
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  const store: Record<string, string> = {};
  return {
    setItem: jest.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    getItem: jest.fn(async (key: string) => store[key] ?? null),
    removeItem: jest.fn(async (key: string) => {
      delete store[key];
    }),
  };
});

import { useProfileStore } from '../../store/profileStore';
import { apiFetch } from '../../lib/api';

const mockApiFetch = apiFetch as jest.Mock;

describe('profileStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useProfileStore.setState({
      profile: null,
      loading: false,
      error: null,
      _unsubscribe: null,
      _loadedUserId: null,
      nightlifePromptDismissed: false,
    });
  });

  describe('loadProfile', () => {
    it('fetches and normalizes profile from /api/v1/users/me', async () => {
      mockApiFetch.mockResolvedValueOnce({
        profile: {
          uid: 'user_1',
          email: 'test@example.com',
          displayName: 'Test User',
          bio: 'Hello',
          city: 'Mumbai',
        },
      });

      await useProfileStore.getState().loadProfile('user_1');

      expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/users/me', { requireAuth: true });
      const profile = useProfileStore.getState().profile;
      expect(profile?.uid).toBe('user_1');
      expect(profile?.displayName).toBe('Test User');
      expect(profile?.bio).toBe('Hello');
      expect(profile?.city).toBe('Mumbai');
      expect(profile?.email).toBe('test@example.com');
    });

    it('reads from data.profile when top-level profile is absent', async () => {
      mockApiFetch.mockResolvedValueOnce({
        data: { profile: { uid: 'user_2', email: 'u2@test.com', displayName: 'User 2' } },
      });

      await useProfileStore.getState().loadProfile('user_2');
      expect(useProfileStore.getState().profile?.displayName).toBe('User 2');
    });

    it('sets error state on failure but keeps existing profile', async () => {
      useProfileStore.setState({
        profile: { uid: 'user_1', email: '', displayName: 'Existing' } as any,
      });
      mockApiFetch.mockRejectedValueOnce(new Error('Server error'));

      await useProfileStore.getState().loadProfile('user_1');

      const state = useProfileStore.getState();
      expect(state.error).toBe('Server error');
      expect(state.loading).toBe(false);
      expect(state.profile?.displayName).toBe('Existing');
    });
  });

  describe('updateProfile', () => {
    it('optimistically updates then confirms from server', async () => {
      useProfileStore.setState({
        profile: { uid: 'user_1', email: 'a@b.com', displayName: 'Old Name' } as any,
      });

      mockApiFetch.mockResolvedValueOnce({
        profile: { uid: 'user_1', email: 'a@b.com', displayName: 'New Name' },
      });

      const ok = await useProfileStore
        .getState()
        .updateProfile('user_1', { displayName: 'New Name' });

      expect(ok).toBe(true);
      expect(useProfileStore.getState().profile?.displayName).toBe('New Name');
      expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/users/me/settings', {
        method: 'PATCH',
        body: JSON.stringify({ displayName: 'New Name' }),
      });
    });

    it('returns false and refetches on server error', async () => {
      useProfileStore.setState({
        profile: { uid: 'user_1', email: 'a@b.com', displayName: 'Name' } as any,
      });

      mockApiFetch.mockRejectedValueOnce(new Error('Update failed'));
      mockApiFetch.mockResolvedValueOnce({
        profile: { uid: 'user_1', email: 'a@b.com', displayName: 'Name' },
      });

      const ok = await useProfileStore.getState().updateProfile('user_1', { bio: 'New bio' });

      expect(ok).toBe(false);
      expect(mockApiFetch).toHaveBeenCalledTimes(2);
    });

    it('strips undefined values from the PATCH payload', async () => {
      useProfileStore.setState({
        profile: { uid: 'u1', email: 'a@b.com', displayName: 'U1' } as any,
      });

      mockApiFetch.mockResolvedValueOnce({
        profile: { uid: 'u1', email: 'a@b.com', displayName: 'U1' },
      });

      await useProfileStore
        .getState()
        .updateProfile('u1', { displayName: 'U1', bio: undefined as any, city: undefined as any });

      const callBody = JSON.parse(mockApiFetch.mock.calls[0][1].body);
      expect(callBody).toEqual({ displayName: 'U1' });
      expect(callBody.bio).toBeUndefined();
    });
  });

  describe('setProfileFromGateway', () => {
    it('sets the profile directly from gateway payload', () => {
      useProfileStore.getState().setProfileFromGateway('user_1', {
        displayName: 'Gateway User',
        email: 'gateway@test.com',
      });

      const profile = useProfileStore.getState().profile;
      expect(profile?.displayName).toBe('Gateway User');
      expect(profile?.uid).toBe('user_1');
      expect(useProfileStore.getState().loading).toBe(false);
      expect(useProfileStore.getState().error).toBeNull();
    });
  });

  describe('clearProfile', () => {
    it('resets profile state and calls unsubscribe', () => {
      const unsubscribe = jest.fn();
      useProfileStore.setState({ profile: { uid: 'u1' } as any, _unsubscribe: unsubscribe });

      useProfileStore.getState().clearProfile();

      const state = useProfileStore.getState();
      expect(state.profile).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state._unsubscribe).toBeNull();
      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe('nightlifePrompt', () => {
    it('hydrateNightlifePromptDismissed reads from AsyncStorage', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.getItem.mockResolvedValueOnce('true');

      await useProfileStore.getState().hydrateNightlifePromptDismissed();
      expect(useProfileStore.getState().nightlifePromptDismissed).toBe(true);
    });

    it('dismissNightlifePrompt persists to AsyncStorage', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');

      await useProfileStore.getState().dismissNightlifePrompt();

      expect(useProfileStore.getState().nightlifePromptDismissed).toBe(true);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'c1rcle_nightlife_profile_prompt_dismissed',
        'true',
      );
    });
  });

  describe('subscribeToProfile', () => {
    it('calls loadProfile and returns a dummy unsubscribe', () => {
      mockApiFetch.mockResolvedValue({
        profile: { uid: 'u1', email: 'a@b.com', displayName: 'U1' },
      });

      const unsub = useProfileStore.getState().subscribeToProfile('user_1');

      expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/users/me', { requireAuth: true });
      expect(typeof unsub).toBe('function');
    });
  });

  describe('normalizeProfile', () => {
    it('sets isPremium from multiple sources', async () => {
      mockApiFetch.mockResolvedValueOnce({
        profile: { uid: 'u1', email: 'a@b.com', displayName: 'U1', isPremium: true },
      });

      await useProfileStore.getState().loadProfile('u1');

      expect(useProfileStore.getState().profile?.isPremium).toBe(true);
      expect(useProfileStore.getState().profile?.subscription?.tier).toBe('premium');
    });

    it('sets isPremium from subscription tier', async () => {
      mockApiFetch.mockResolvedValueOnce({
        profile: {
          uid: 'u1',
          email: 'a@b.com',
          displayName: 'U1',
          isPremium: false,
          subscription: { tier: 'premium', status: 'active' },
        },
      });

      await useProfileStore.getState().loadProfile('u1');

      expect(useProfileStore.getState().profile?.isPremium).toBe(true);
      expect(useProfileStore.getState().profile?.subscription?.tier).toBe('premium');
    });

    it('normalizes avatar from photoURL', async () => {
      mockApiFetch.mockResolvedValueOnce({
        profile: {
          uid: 'u1',
          email: 'a@b.com',
          displayName: 'U1',
          avatar: 'https://example.com/avatar.jpg',
        },
      });

      await useProfileStore.getState().loadProfile('u1');
      expect(useProfileStore.getState().profile?.photoURL).toBe('https://example.com/avatar.jpg');
    });

    it('normalizes basicSetupComplete from profileSetupComplete', async () => {
      mockApiFetch.mockResolvedValueOnce({
        profile: { uid: 'u1', email: 'a@b.com', displayName: 'U1', profileSetupComplete: true },
      });

      await useProfileStore.getState().loadProfile('u1');
      expect(useProfileStore.getState().profile?.basicSetupComplete).toBe(true);
    });

    it('normalizes socialSetupComplete from socialProfile.state', async () => {
      mockApiFetch.mockResolvedValueOnce({
        profile: {
          uid: 'u1',
          email: 'a@b.com',
          displayName: 'U1',
          socialProfile: { state: 'complete' },
        },
      });

      await useProfileStore.getState().loadProfile('u1');
      expect(useProfileStore.getState().profile?.socialSetupComplete).toBe(true);
    });
  });
});
