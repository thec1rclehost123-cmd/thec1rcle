const mockApiFetch = jest.fn();
const mockDeduplicateRequest = jest.fn();
const mockAuth = { currentUser: { uid: 'user-1' } as { uid: string } | null };

jest.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  deduplicateRequest: (key: string, request: () => Promise<unknown>) =>
    mockDeduplicateRequest(key, request),
}));
jest.mock('@/lib/firebase', () => ({
  getFirebaseAuth: () => mockAuth,
}));

import { recommendationsRequestPath, useRecommendationsStore } from '@/store/recommendationsStore';

describe('recommendations v2 mobile contract', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockDeduplicateRequest.mockReset();
    const inFlight = new Map<string, Promise<unknown>>();
    mockDeduplicateRequest.mockImplementation((key: string, request: () => Promise<unknown>) => {
      const existing = inFlight.get(key);
      if (existing) return existing;
      const pending = request().finally(() => inFlight.delete(key));
      inFlight.set(key, pending);
      return pending;
    });
    mockAuth.currentUser = { uid: 'user-1' };
    useRecommendationsStore.setState({
      recommendations: [],
      scoredEvents: {},
      reasonLabel: 'Recommended for you',
      source: 'local',
      recommendationsOwnerUserId: null,
    });
  });

  it('selects the rollout contract and preserves the server-owned reason label', () => {
    expect(recommendationsRequestPath(true)).toBe('/api/v1/recommendations?limit=10&contract=v2');
    expect(recommendationsRequestPath(false)).toBe(
      '/api/v1/recommendations?limit=10&contract=legacy',
    );
    useRecommendationsStore.getState().setServerRecommendations([
      {
        event: { id: 'evt-1', title: 'Night One', startDate: '2030-01-01T20:00:00Z' } as any,
        reasonLabel: 'Because it matches your nightlife tastes',
      },
    ]);
    expect(useRecommendationsStore.getState().reasonLabel).toBe(
      'Because it matches your nightlife tastes',
    );
    expect(useRecommendationsStore.getState().source).toBe('server');
  });

  it('single-flights concurrent requests by user and exact query', async () => {
    let resolveRequest!: (value: unknown) => void;
    mockApiFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const first = useRecommendationsStore.getState().loadServerRecommendations('user-1');
    const second = useRecommendationsStore.getState().loadServerRecommendations('user-1');

    expect(second).toBe(first);
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/recommendations?limit=10&contract=v2');
    expect(mockDeduplicateRequest).toHaveBeenCalledWith(
      'recommendations:user-1:/api/v1/recommendations?limit=10&contract=v2',
      expect.any(Function),
    );

    resolveRequest({
      items: [{ event: { id: 'event-1', title: 'User One Event' }, reasonLabel: 'For user one' }],
    });
    await expect(first).resolves.toBe(true);
    expect(useRecommendationsStore.getState().recommendations[0]?.id).toBe('event-1');
  });

  it('does not merge requests for different users or apply a stale account response', async () => {
    let resolveUserOne!: (value: unknown) => void;
    let resolveUserTwo!: (value: unknown) => void;
    mockApiFetch
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveUserOne = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveUserTwo = resolve;
          }),
      );

    const userOneRequest = useRecommendationsStore.getState().loadServerRecommendations('user-1');
    mockAuth.currentUser = { uid: 'user-2' };
    const userTwoRequest = useRecommendationsStore.getState().loadServerRecommendations('user-2');

    expect(mockApiFetch).toHaveBeenCalledTimes(2);
    resolveUserTwo({ items: [{ event: { id: 'event-2', title: 'User Two Event' } }] });
    await expect(userTwoRequest).resolves.toBe(true);
    resolveUserOne({ items: [{ event: { id: 'event-1', title: 'User One Event' } }] });
    await expect(userOneRequest).resolves.toBe(false);

    const state = useRecommendationsStore.getState();
    expect(state.recommendationsOwnerUserId).toBe('user-2');
    expect(state.recommendations.map((event) => event.id)).toEqual(['event-2']);
  });

  it('clears account-owned recommendations on logout and rejects the late response', async () => {
    let resolveRequest!: (value: unknown) => void;
    mockApiFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const request = useRecommendationsStore.getState().loadServerRecommendations('user-1');
    mockAuth.currentUser = null;
    useRecommendationsStore.getState().setRecommendationsOwner(null);
    resolveRequest({ items: [{ event: { id: 'private-event', title: 'Private Event' } }] });

    await expect(request).resolves.toBe(false);
    const state = useRecommendationsStore.getState();
    expect(state.recommendationsOwnerUserId).toBeNull();
    expect(state.recommendations).toEqual([]);
    expect(state.source).toBe('local');
  });
});
