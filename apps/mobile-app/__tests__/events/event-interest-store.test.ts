/**
 * Tests for eventInterestStore
 * Verifies:
 *  - toggleInterest updates state optimistically
 *  - loadUserInterests fetches from Firestore
 */
import {
  __resetRecentInterestTogglesForTests,
  useEventInterestStore,
} from '../../store/eventInterestStore';

// Mock API
jest.mock('../../lib/api', () => ({
  apiFetch: jest.fn(),
}));

// Mock Firebase
jest.mock('../../lib/firebase/client', () => ({
  getFirebaseApp: jest.fn(() => ({})),
}));

jest.mock('firebase/firestore', () => {
  const mockDoc = jest.fn();
  const mockCollection = jest.fn();
  const mockGetDocs = jest.fn();
  const mockSetDoc = jest.fn();
  const mockDeleteDoc = jest.fn();
  const mockServerTimestamp = jest.fn(() => null);

  return {
    getFirestore: jest.fn(() => ({})),
    doc: mockDoc,
    setDoc: mockSetDoc,
    deleteDoc: mockDeleteDoc,
    getDocs: mockGetDocs,
    collection: mockCollection,
    query: jest.fn(),
    where: jest.fn(),
    serverTimestamp: mockServerTimestamp,
  };
});

const mockApiFetch = require('../../lib/api').apiFetch as jest.Mock;

describe('eventInterestStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetRecentInterestTogglesForTests();
    useEventInterestStore.setState({
      likedEventIds: new Set(),
      interestOverrides: {},
      interestedUsers: {},
      groupChatMembers: {},
      loadingInterested: {},
    });
  });

  describe('toggleInterest', () => {
    it('adds event to likedEventIds optimistically', async () => {
      const { toggleInterest } = useEventInterestStore.getState();
      await toggleInterest('event-1', 'user-1', { displayName: 'User', photoURL: null });

      expect(useEventInterestStore.getState().likedEventIds.has('event-1')).toBe(true);
    });

    it('removes event from likedEventIds when toggled off', async () => {
      useEventInterestStore.setState({
        likedEventIds: new Set(['event-1']),
      });

      await useEventInterestStore.getState().toggleInterest('event-1', 'user-1', {
        displayName: 'User',
        photoURL: null,
      });

      expect(useEventInterestStore.getState().likedEventIds.has('event-1')).toBe(false);
    });

    it('keeps the heart lit after a transient RSVP failure', async () => {
      mockApiFetch.mockRejectedValueOnce(new Error('Network request failed'));

      await useEventInterestStore.getState().toggleInterest('event-1', 'user-1', {
        displayName: 'User',
        photoURL: null,
      });

      expect(useEventInterestStore.getState().likedEventIds.has('event-1')).toBe(true);
      expect(useEventInterestStore.getState().interestedUsers['event-1']).toEqual([
        expect.objectContaining({
          userId: 'user-1',
          displayName: 'User',
        }),
      ]);
      expect(useEventInterestStore.getState().isInterested('event-1')).toBe(true);
    });

    it('keeps the effective heart state from the local override even if the raw set is replaced', async () => {
      mockApiFetch.mockResolvedValueOnce({ success: true });

      await useEventInterestStore.getState().toggleInterest('event-1', 'user-1', {
        displayName: 'User',
        photoURL: null,
      });
      useEventInterestStore.setState({ likedEventIds: new Set() });

      expect(useEventInterestStore.getState().likedEventIds.has('event-1')).toBe(false);
      expect(useEventInterestStore.getState().isInterested('event-1')).toBe(true);
    });

    it('rolls back the heart on auth failures', async () => {
      const error = new Error('Unauthorized') as Error & { status: number };
      error.status = 401;
      mockApiFetch.mockRejectedValueOnce(error);

      await useEventInterestStore.getState().toggleInterest('event-1', 'user-1', {
        displayName: 'User',
        photoURL: null,
      });

      expect(useEventInterestStore.getState().likedEventIds.has('event-1')).toBe(false);
      expect(useEventInterestStore.getState().interestedUsers['event-1']).toBeUndefined();
      expect(useEventInterestStore.getState().isInterested('event-1')).toBe(false);
    });
  });

  describe('loadUserInterests', () => {
    it('hydrates liked events from the gateway attendedEvents field used by RSVP', async () => {
      mockApiFetch.mockResolvedValueOnce({
        profile: {
          attendedEvents: ['event-1'],
        },
      });

      await useEventInterestStore.getState().loadUserInterests('user-1');

      expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/users/me', { requireAuth: true });
      expect(useEventInterestStore.getState().likedEventIds.has('event-1')).toBe(true);
    });

    it('does not clear a recent optimistic heart from a stale user profile response', async () => {
      mockApiFetch.mockResolvedValueOnce({ success: true });
      await useEventInterestStore.getState().toggleInterest('event-1', 'user-1', {
        displayName: 'User',
        photoURL: null,
      });

      mockApiFetch.mockResolvedValueOnce({ profile: { attendedEvents: [] } });
      await useEventInterestStore.getState().loadUserInterests('user-1');

      expect(useEventInterestStore.getState().likedEventIds.has('event-1')).toBe(true);
      expect(useEventInterestStore.getState().isInterested('event-1')).toBe(true);
    });
  });

  describe('fetchEventInterestState', () => {
    it('hydrates the lit heart from event viewer state', async () => {
      mockApiFetch.mockResolvedValueOnce({ data: { hasRsvped: true } });

      await useEventInterestStore.getState().fetchEventInterestState('event-1');

      expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/events/event-1/viewer-state', {
        requireAuth: true,
      });
      expect(useEventInterestStore.getState().likedEventIds.has('event-1')).toBe(true);
    });

    it('does not overwrite a local optimistic toggle with stale viewer state', async () => {
      mockApiFetch.mockResolvedValueOnce({ data: { hasRsvped: false } });

      const pending = useEventInterestStore.getState().fetchEventInterestState('event-1');
      useEventInterestStore.setState({ likedEventIds: new Set(['event-1']) });
      await pending;

      expect(useEventInterestStore.getState().likedEventIds.has('event-1')).toBe(true);
    });

    it('ignores stale false viewer state shortly after a successful local like', async () => {
      mockApiFetch.mockResolvedValueOnce({ success: true });
      await useEventInterestStore.getState().toggleInterest('event-1', 'user-1', {
        displayName: 'User',
        photoURL: null,
      });

      mockApiFetch.mockResolvedValueOnce({ data: { hasRsvped: false } });
      await useEventInterestStore.getState().fetchEventInterestState('event-1');

      expect(useEventInterestStore.getState().likedEventIds.has('event-1')).toBe(true);
    });
  });

  describe('fetchInterestedUsers', () => {
    it('loads hearted profiles from the interested list endpoint instead of attendees', async () => {
      mockApiFetch.mockResolvedValueOnce({
        data: {
          users: [
            {
              userId: 'user-2',
              displayName: 'Interested Guest',
              photoURL: 'https://example.com/avatar.jpg',
              likedAt: '2026-06-23T00:00:00.000Z',
            },
          ],
        },
      });

      await useEventInterestStore.getState().fetchInterestedUsers('event-1');

      expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/events/event-1/interested?limit=24', {
        requireAuth: true,
      });
      expect(useEventInterestStore.getState().interestedUsers['event-1']).toEqual([
        {
          userId: 'user-2',
          displayName: 'Interested Guest',
          photoURL: 'https://example.com/avatar.jpg',
          likedAt: '2026-06-23T00:00:00.000Z',
        },
      ]);
    });

    it('preserves the current optimistic interested user while the server list catches up', async () => {
      useEventInterestStore.setState({
        likedEventIds: new Set(['event-1']),
        interestedUsers: {
          'event-1': [
            {
              userId: 'user-1',
              displayName: 'Current User',
              photoURL: null,
              likedAt: '2026-07-01T00:00:00.000Z',
            },
          ],
        },
      });
      mockApiFetch.mockResolvedValueOnce({ data: { users: [] } });

      await useEventInterestStore.getState().fetchInterestedUsers('event-1');

      expect(useEventInterestStore.getState().interestedUsers['event-1']).toEqual([
        {
          userId: 'user-1',
          displayName: 'Current User',
          photoURL: null,
          likedAt: '2026-07-01T00:00:00.000Z',
        },
      ]);
    });
  });
});
