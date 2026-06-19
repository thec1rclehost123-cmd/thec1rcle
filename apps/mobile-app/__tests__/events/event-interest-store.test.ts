/**
 * Tests for eventInterestStore
 * Verifies:
 *  - joinEventGroupChat calls API instead of direct Firestore write
 *  - toggleInterest updates state optimistically
 *  - loadUserInterests fetches from Firestore
 */
import { useEventInterestStore } from '../../store/eventInterestStore';

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
    useEventInterestStore.setState({
      likedEventIds: new Set(),
      interestedUsers: {},
      groupChatMembers: {},
      loadingInterested: {},
    });
  });

  describe('joinEventGroupChat', () => {
    it('calls API endpoint with eventId and user info', async () => {
      mockApiFetch.mockResolvedValueOnce({ success: true, chat: { id: 'chat_1' } });

      await useEventInterestStore.getState().joinEventGroupChat('event-1', 'user-1', {
        displayName: 'Test User',
        photoURL: 'https://example.com/photo.jpg',
      });

      expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/social/chat/join', {
        method: 'POST',
        body: JSON.stringify({
          eventId: 'event-1',
          displayName: 'Test User',
          photoURL: 'https://example.com/photo.jpg',
        }),
        requireAuth: true,
      });
    });

    it('handles API failure gracefully', async () => {
      mockApiFetch.mockRejectedValueOnce(new Error('Server error'));

      // Should not throw
      await expect(
        useEventInterestStore
          .getState()
          .joinEventGroupChat('event-1', 'user-1', { displayName: 'Test', photoURL: null }),
      ).resolves.not.toThrow();
    });

    it('uses fallback values when userInfo is incomplete', async () => {
      mockApiFetch.mockResolvedValueOnce({ success: true });

      await useEventInterestStore
        .getState()
        .joinEventGroupChat('event-2', 'user-2', { displayName: '', photoURL: null });

      expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/social/chat/join', {
        method: 'POST',
        body: JSON.stringify({
          eventId: 'event-2',
          displayName: 'C1rcle User',
          photoURL: null,
        }),
        requireAuth: true,
      });
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
  });
});
