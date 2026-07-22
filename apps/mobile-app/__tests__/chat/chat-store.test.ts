/**
 * Tests for chatStore
 * Verifies fetching chats, subscribing to updates, and error handling.
 */
import { useChatStore } from '../../store/chatStore';
import { apiFetch } from '../../lib/api';

jest.mock('../../lib/api', () => ({
  apiFetch: jest.fn(),
  deduplicateRequest: jest.fn((_key: string, request: () => Promise<unknown>) => request()),
}));

jest.mock('../../lib/social/groupChat', () => ({
  subscribeToGroupChat: jest.fn(() => jest.fn()),
}));

jest.mock('../../lib/social/privateDM', () => ({
  subscribeToDirectMessages: jest.fn(() => jest.fn()),
}));

const mockApiFetch = apiFetch as jest.Mock;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('chatStore', () => {
  beforeEach(() => {
    useChatStore.getState().clearChats();
    jest.clearAllMocks();
    useChatStore.setState({
      ownerUserId: null,
      eventChats: [],
      privateChats: [],
      newMatches: [],
      totalUnread: 0,
      loading: false,
      error: null,
      _unsubscribe: null,
    });
  });

  it('fetches event and private chats on fetchAll', async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        eventChats: [
          {
            id: 'event_1',
            eventId: 'evt-1',
            eventTitle: 'Test Event',
            eventDate: new Date().toISOString(),
            participants: ['u1', 'u2'],
            participantCount: 5,
            createdAt: new Date().toISOString(),
            lastMessage: {
              content: 'Hey!',
              senderId: 'u1',
              senderName: 'Alice',
              createdAt: new Date().toISOString(),
            },
          },
        ],
        privateChats: [{ id: 'dm_1', participants: ['u1', 'u2'], status: 'accepted' }],
        totalUnread: 2,
      })
      .mockResolvedValueOnce({
        matches: [{ id: 'm1', name: 'Bob', isNew: true }],
      });

    await useChatStore.getState().fetchAll('test-user');

    const state = useChatStore.getState();
    expect(state.eventChats).toHaveLength(1);
    expect(state.eventChats[0].eventId).toBe('evt-1');
    expect(state.privateChats).toHaveLength(1);
    expect(state.newMatches).toHaveLength(1);
    expect(state.totalUnread).toBe(2);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('sets loading state during fetch', async () => {
    let resolvePromise: any;
    mockApiFetch.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );

    const fetchPromise = useChatStore.getState().fetchAll('test-user');

    expect(useChatStore.getState().loading).toBe(true);

    resolvePromise({
      eventChats: [],
      privateChats: [],
      totalUnread: 0,
    });

    await fetchPromise;
    expect(useChatStore.getState().loading).toBe(false);
  });

  it('handles fetch errors gracefully', async () => {
    mockApiFetch.mockRejectedValue(new Error('Network error'));

    await useChatStore.getState().fetchAll('test-user');

    const state = useChatStore.getState();
    expect(state.error).toBe('Network error');
    expect(state.loading).toBe(false);
    expect(state.eventChats).toEqual([]);
  });

  it('handles matches fetch failure without breaking', async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        eventChats: [],
        privateChats: [{ id: 'dm_1', participants: ['u1', 'u2'] }],
        totalUnread: 1,
      })
      .mockRejectedValueOnce(new Error('Matches unavailable'));

    await useChatStore.getState().fetchAll('test-user');

    const state = useChatStore.getState();
    expect(state.privateChats).toHaveLength(1);
    expect(state.newMatches).toEqual([]); // Graceful degradation
    expect(state.error).toBeNull(); // Matches failure shouldn't set global error
  });

  it('rejects User A responses after switching to User B', async () => {
    const userAChats = deferred<any>();
    const userAMatches = deferred<any>();
    mockApiFetch
      .mockReturnValueOnce(userAChats.promise)
      .mockReturnValueOnce(userAMatches.promise)
      .mockResolvedValueOnce({
        eventChats: [],
        privateChats: [{ id: 'dm_b', participants: ['user-b', 'user-c'] }],
        totalUnread: 1,
      })
      .mockResolvedValueOnce({ matches: [{ id: 'match_b', name: 'User C', isNew: true }] });

    const userAFetch = useChatStore.getState().fetchAll('user-a');
    const userBFetch = useChatStore.getState().fetchAll('user-b');
    await userBFetch;

    userAChats.resolve({
      eventChats: [{ id: 'event_a', eventId: 'event-a' }],
      privateChats: [{ id: 'dm_a', participants: ['user-a', 'user-d'] }],
      totalUnread: 99,
    });
    userAMatches.resolve({ matches: [{ id: 'match_a', name: 'User D', isNew: true }] });
    await userAFetch;

    expect(useChatStore.getState()).toMatchObject({
      ownerUserId: 'user-b',
      privateChats: [expect.objectContaining({ id: 'dm_b' })],
      newMatches: [expect.objectContaining({ id: 'match_b' })],
      totalUnread: 1,
      loading: false,
    });
  });

  it('clears account-owned chat data and subscriptions on logout', () => {
    const unsubscribe = jest.fn();
    useChatStore.setState({
      ownerUserId: 'user-a',
      privateChats: [{ id: 'dm_a' } as any],
      totalUnread: 4,
      _unsubscribe: unsubscribe,
    });

    useChatStore.getState().clearChats();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(useChatStore.getState()).toMatchObject({
      ownerUserId: null,
      eventChats: [],
      privateChats: [],
      newMatches: [],
      totalUnread: 0,
      loading: false,
      error: null,
    });
  });

  it('subscribes to updates for event chats', () => {
    useChatStore.setState({
      eventChats: [
        {
          id: 'event_1',
          eventId: 'evt-1',
          eventTitle: 'Test',
          eventDate: new Date().toISOString(),
          participants: ['u1'],
          participantCount: 3,
          createdAt: new Date().toISOString(),
          lastMessage: {
            content: 'old',
            senderId: 'u1',
            senderName: 'A',
            createdAt: new Date().toISOString(),
          },
        },
      ],
      privateChats: [],
    });

    const unsub = useChatStore.getState().subscribeToUpdates('test-user');

    expect(typeof unsub).toBe('function');
    unsub();
  });
});
