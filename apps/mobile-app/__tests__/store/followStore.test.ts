jest.mock('../../lib/api', () => {
  const flights = new Map<string, Promise<unknown>>();
  return {
    apiFetch: jest.fn(),
    deduplicateRequest: jest.fn((key: string, fetcher: () => Promise<unknown>) => {
      const existing = flights.get(key);
      if (existing) return existing;
      const promise = fetcher().finally(() => flights.delete(key));
      flights.set(key, promise);
      return promise;
    }),
  };
});

import { apiFetch } from '../../lib/api';
import { useFollowStore } from '../../store/followStore';

const mockApiFetch = apiFetch as jest.Mock;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('followStore request ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useFollowStore.getState().clearFollows();
  });

  it('single-flights duplicate follow reads for the same authenticated user', async () => {
    const request = deferred<any>();
    mockApiFetch.mockReturnValueOnce(request.promise);

    const first = useFollowStore.getState().fetchFollows('user-a');
    const second = useFollowStore.getState().fetchFollows('user-a');

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/users/me/follows');

    request.resolve({ follows: { venueIds: ['venue-a'], hostIds: ['host-a'] } });
    await Promise.all([first, second]);

    const state = useFollowStore.getState();
    expect(state.loadedUserId).toBe('user-a');
    expect(state.followedVenueIds).toEqual(new Set(['venue-a']));
    expect(state.followedHostIds).toEqual(new Set(['host-a']));
  });

  it('rejects a late response from the previous account', async () => {
    const userARequest = deferred<any>();
    const userBRequest = deferred<any>();
    mockApiFetch
      .mockReturnValueOnce(userARequest.promise)
      .mockReturnValueOnce(userBRequest.promise);

    const userA = useFollowStore.getState().fetchFollows('user-a');
    const userB = useFollowStore.getState().fetchFollows('user-b');

    userBRequest.resolve({ follows: { venueIds: ['venue-b'], hostIds: ['host-b'] } });
    await userB;
    userARequest.resolve({ follows: { venueIds: ['venue-a'], hostIds: ['host-a'] } });
    await userA;

    const state = useFollowStore.getState();
    expect(state.loadedUserId).toBe('user-b');
    expect(state.followedVenueIds).toEqual(new Set(['venue-b']));
    expect(state.followedHostIds).toEqual(new Set(['host-b']));
    expect(state.isFollowingVenue('venue-a', 'user-a')).toBe(false);
    expect(state.isFollowingVenue('venue-b', 'user-b')).toBe(true);
  });

  it('never exposes one account follows to another account or a signed-out viewer', () => {
    useFollowStore.setState({
      followedVenueIds: new Set(['venue-a']),
      followedHostIds: new Set(['host-a']),
      loaded: true,
      loadedUserId: 'user-a',
      loadingUserId: null,
    });

    const state = useFollowStore.getState();
    expect(state.isFollowingVenue('venue-a', 'user-a')).toBe(true);
    expect(state.isFollowingVenue('venue-a', 'user-b')).toBe(false);
    expect(state.isFollowingVenue('venue-a', null)).toBe(false);
    expect(state.isFollowingHost('host-a', undefined)).toBe(false);
  });
});
