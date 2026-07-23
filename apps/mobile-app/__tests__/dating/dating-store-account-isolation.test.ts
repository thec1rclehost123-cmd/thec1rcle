const mockApiFetch = jest.fn();
const mockApplyServerContext = jest.fn();
const mockOpenPaywall = jest.fn();

jest.mock('../../lib/api', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

jest.mock('../../store/subscriptionStore', () => ({
  useSubscriptionStore: {
    getState: () => ({
      applyServerContext: mockApplyServerContext,
      openPaywall: mockOpenPaywall,
    }),
  },
}));

import { useDatingStore, type DatingProfile, type Match } from '../../store/datingStore';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function profile(userId: string, displayName = userId): DatingProfile {
  return {
    userId,
    id: userId,
    displayName,
    name: displayName,
    age: 25,
    headline: 'Nightlife profile',
    sharedEventId: 'event-1',
    sharedEventTitle: 'Test Event',
    sharedEventDate: '2026-08-01T18:00:00.000Z',
    venue: 'Test Venue',
    distance: '1.0 km away',
    profileRouteId: userId,
    tags: [],
    photos: [],
    prompts: [],
  };
}

function match(otherUserId: string): Match {
  return {
    id: `match-${otherUserId}`,
    otherUserId,
    displayName: otherUserId,
    sharedEventTitle: 'Test Event',
    matchedAt: '2026-07-18T00:00:00.000Z',
  };
}

describe('dating store account isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useDatingStore.getState().clearDatingState();
  });

  it('rejects an old profile response after account switch and filters the new account itself', async () => {
    const oldResponse = deferred<any>();
    mockApiFetch.mockReturnValueOnce(oldResponse.promise);

    useDatingStore.getState().setOwnerUserId('user-a');
    const oldRequest = useDatingStore.getState().fetchProfiles('user-a');
    expect(useDatingStore.getState().loading).toBe(true);

    useDatingStore.getState().setOwnerUserId('user-b');
    oldResponse.resolve({ profiles: [profile('user-b', 'User B')] });
    await oldRequest;

    expect(useDatingStore.getState()).toMatchObject({
      ownerUserId: 'user-b',
      profilesOwnerUserId: null,
      profiles: [],
      loading: false,
    });

    mockApiFetch.mockResolvedValueOnce({
      profiles: [profile('user-b', 'User B'), profile('user-c', 'User C')],
      hasMore: false,
    });
    await useDatingStore.getState().fetchProfiles('user-b');

    expect(useDatingStore.getState().profilesOwnerUserId).toBe('user-b');
    expect(useDatingStore.getState().profiles.map((item) => item.userId)).toEqual(['user-c']);
  });

  it('rejects old match responses and scopes matches to the current account', async () => {
    const oldResponse = deferred<any>();
    mockApiFetch.mockReturnValueOnce(oldResponse.promise);

    useDatingStore.getState().setOwnerUserId('user-a');
    const oldRequest = useDatingStore.getState().fetchMatches('user-a');
    useDatingStore.getState().setOwnerUserId('user-b');
    oldResponse.resolve({ matches: [match('user-b')] });
    await oldRequest;

    expect(useDatingStore.getState()).toMatchObject({
      ownerUserId: 'user-b',
      matchesOwnerUserId: null,
      matches: [],
      matchesLoading: false,
    });

    mockApiFetch.mockResolvedValueOnce({
      matches: [match('user-b'), match('user-c')],
    });
    await useDatingStore.getState().fetchMatches('user-b');

    expect(useDatingStore.getState().matchesOwnerUserId).toBe('user-b');
    expect(useDatingStore.getState().matches.map((item) => item.otherUserId)).toEqual(['user-c']);
  });

  it('clears account-owned profiles and matches on logout', () => {
    useDatingStore.getState().setOwnerUserId('user-a');
    useDatingStore.setState({
      profilesOwnerUserId: 'user-a',
      matchesOwnerUserId: 'user-a',
      profiles: [profile('user-b')],
      matches: [match('user-b')],
    });

    const profileRequestId = useDatingStore.getState().profileRequestId;
    const matchesRequestId = useDatingStore.getState().matchesRequestId;
    useDatingStore.getState().clearDatingState();

    expect(useDatingStore.getState()).toMatchObject({
      ownerUserId: null,
      profilesOwnerUserId: null,
      matchesOwnerUserId: null,
      profiles: [],
      matches: [],
      loading: false,
      matchesLoading: false,
    });
    expect(useDatingStore.getState().profileRequestId).toBe(profileRequestId + 1);
    expect(useDatingStore.getState().matchesRequestId).toBe(matchesRequestId + 1);
  });

  it('does not let a stale screen change the authoritative account owner', async () => {
    useDatingStore.getState().setOwnerUserId('user-b');

    await useDatingStore.getState().fetchProfiles('user-a');
    await useDatingStore.getState().fetchMatches('user-a');

    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(useDatingStore.getState().ownerUserId).toBe('user-b');
  });

  it('blocks self and stale-account swipe or reply actions before any API call', async () => {
    useDatingStore.getState().setOwnerUserId('user-a');
    useDatingStore.setState({
      profilesOwnerUserId: 'user-a',
      profiles: [profile('user-a'), profile('user-b')],
    });

    await expect(useDatingStore.getState().likeUser('user-a', profile('user-a'))).resolves.toEqual({
      isMatch: false,
    });
    await expect(
      useDatingStore.getState().sendAskOut('user-a', profile('user-a'), 'hello'),
    ).resolves.toEqual({ sent: false, isMatch: false });
    await useDatingStore.getState().passUser('user-a', 'user-a');
    await expect(useDatingStore.getState().likeUser('user-b', profile('user-a'))).resolves.toEqual({
      isMatch: false,
    });
    await expect(useDatingStore.getState().likeUser('user-a', profile('user-c'))).resolves.toEqual({
      isMatch: false,
    });

    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(useDatingStore.getState().profiles.map((item) => item.userId)).toEqual([
      'user-a',
      'user-b',
    ]);
  });

  it('removes only the acted-on profile and ignores its response after an account switch', async () => {
    const response = deferred<any>();
    mockApiFetch.mockReturnValueOnce(response.promise);
    useDatingStore.getState().setOwnerUserId('user-a');
    useDatingStore.setState({
      profilesOwnerUserId: 'user-a',
      profiles: [profile('user-b'), profile('user-c')],
    });

    const likeRequest = useDatingStore.getState().likeUser('user-a', profile('user-c'));
    expect(useDatingStore.getState().profiles.map((item) => item.userId)).toEqual(['user-b']);

    useDatingStore.getState().setOwnerUserId('user-d');
    response.resolve({ match: true, conversationId: 'conversation-a-c' });
    await expect(likeRequest).resolves.toEqual({ isMatch: false });

    expect(useDatingStore.getState()).toMatchObject({
      ownerUserId: 'user-d',
      profiles: [],
      matches: [],
    });
    expect(mockApplyServerContext).not.toHaveBeenCalled();
  });
});
