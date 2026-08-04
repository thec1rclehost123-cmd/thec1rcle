/* global jest, describe, beforeEach, it, expect */

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('profileStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useProfileStore.setState({
      profile: null,
      loading: false,
      error: null,
      _unsubscribe: null,
      _loadPromise: null,
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

    it('rejects an old account response after logout and a second-account load', async () => {
      const userAResponse = deferred<any>();
      const userBResponse = deferred<any>();
      mockApiFetch
        .mockReturnValueOnce(userAResponse.promise)
        .mockReturnValueOnce(userBResponse.promise);

      const userALoad = useProfileStore.getState().loadProfile('user-a');
      useProfileStore.getState().clearProfile();
      const userBLoad = useProfileStore.getState().loadProfile('user-b');

      userBResponse.resolve({ profile: { uid: 'user-b', displayName: 'User B' } });
      await userBLoad;
      userAResponse.resolve({ profile: { uid: 'user-a', displayName: 'User A' } });
      await userALoad;

      expect(useProfileStore.getState()).toMatchObject({
        profile: expect.objectContaining({ uid: 'user-b', displayName: 'User B' }),
        _loadedUserId: 'user-b',
        loading: false,
      });
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
      // Optimistic — name updated immediately
      expect(useProfileStore.getState().profile?.displayName).toBe('New Name');
      expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/users/me/settings', {
        method: 'PATCH',
        body: JSON.stringify({ displayName: 'New Name' }),
      });
    });

    it('returns false and rolls back without doubling the failed offline request', async () => {
      useProfileStore.setState({
        profile: { uid: 'user_1', email: 'a@b.com', displayName: 'Name' } as any,
      });

      mockApiFetch.mockRejectedValueOnce(new Error('Update failed'));
      const ok = await useProfileStore.getState().updateProfile('user_1', { bio: 'New bio' });

      expect(ok).toBe(false);
      expect(mockApiFetch).toHaveBeenCalledTimes(1);
      expect(useProfileStore.getState().profile?.displayName).toBe('Name');
      expect(useProfileStore.getState().error).toBe('Update failed');
    });

    it('does not restore an optimistic update after the account is cleared', async () => {
      useProfileStore.setState({
        profile: { uid: 'user-a', email: 'a@b.com', displayName: 'User A' } as any,
      });
      const response = deferred<any>();
      mockApiFetch.mockReturnValueOnce(response.promise);

      const update = useProfileStore
        .getState()
        .updateProfile('user-a', { displayName: 'Updated A' });
      useProfileStore.getState().clearProfile();
      response.resolve({ profile: { uid: 'user-a', displayName: 'Updated A' } });

      await expect(update).resolves.toBe(false);
      expect(useProfileStore.getState().profile).toBeNull();
    });

    it('merges a partial PATCH response without erasing Nightlife fields', async () => {
      useProfileStore.setState({
        profile: {
          uid: 'user_1',
          email: 'a@b.com',
          displayName: 'Old Name',
          photoURL: 'https://cdn/basic.jpg',
          datingPhotos: ['https://cdn/nightlife.jpg'],
          datingActive: true,
        } as any,
      });
      mockApiFetch.mockResolvedValueOnce({ profile: { displayName: 'New Name' } });

      await useProfileStore.getState().updateProfile('user_1', { displayName: 'New Name' });

      expect(useProfileStore.getState().profile).toMatchObject({
        displayName: 'New Name',
        photoURL: 'https://cdn/basic.jpg',
        datingPhotos: ['https://cdn/nightlife.jpg'],
        datingActive: true,
      });
    });
  });

  describe('setProfileFromGateway', () => {
    it('merges the partial auth payload and leaves private hydration open', () => {
      useProfileStore.setState({
        profile: {
          uid: 'user_1',
          datingPhotos: ['https://storage.googleapis.com/c1rcle/nightlife.jpg'],
        } as any,
        _loadedUserId: 'user_1',
      });
      useProfileStore.getState().setProfileFromGateway('user_1', {
        displayName: 'Gateway User',
        email: 'gateway@test.com',
      });

      const profile = useProfileStore.getState().profile;
      expect(profile?.displayName).toBe('Gateway User');
      expect(profile?.uid).toBe('user_1');
      expect(profile?.datingPhotos).toEqual([
        'https://storage.googleapis.com/c1rcle/nightlife.jpg',
      ]);
      expect(useProfileStore.getState().loading).toBe(false);
      expect(useProfileStore.getState().error).toBeNull();
      expect(useProfileStore.getState()._loadedUserId).toBeNull();
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

      await useProfileStore.getState().hydrateNightlifePromptDismissed('user_1');
      expect(useProfileStore.getState().nightlifePromptDismissed).toBe(true);
    });

    it('dismissNightlifePrompt persists to AsyncStorage', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');

      await useProfileStore.getState().dismissNightlifePrompt('user_1');

      expect(useProfileStore.getState().nightlifePromptDismissed).toBe(true);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'c1rcle_nightlife_profile_prompt_dismissed:user_1',
        'true',
      );
    });

    it('ignores an old account dismissal hydration after the account changes', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      const userARead = deferred<string | null>();
      AsyncStorage.getItem.mockReturnValueOnce(userARead.promise).mockResolvedValueOnce(null);

      const hydrateA = useProfileStore.getState().hydrateNightlifePromptDismissed('user-a');
      const hydrateB = useProfileStore.getState().hydrateNightlifePromptDismissed('user-b');
      await hydrateB;
      userARead.resolve('true');
      await hydrateA;

      expect(useProfileStore.getState().nightlifePromptDismissed).toBe(false);
      expect(AsyncStorage.getItem).toHaveBeenNthCalledWith(
        1,
        'c1rcle_nightlife_profile_prompt_dismissed:user-a',
      );
      expect(AsyncStorage.getItem).toHaveBeenNthCalledWith(
        2,
        'c1rcle_nightlife_profile_prompt_dismissed:user-b',
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
});
