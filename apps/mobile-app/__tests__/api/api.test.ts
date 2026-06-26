/* global jest, describe, beforeEach, it, expect */
declare const fetchMock: any;

jest.mock('../../lib/firebase', () => ({
  getFirebaseAuth: jest.fn(),
}));

jest.mock('../../lib/demo', () => ({
  DEMO_MODE: false,
}));

jest.mock('../../lib/api-mock', () => ({
  apiFetchMock: jest.fn(),
}));

import { getFirebaseAuth } from '../../lib/firebase';
import {
  apiFetch,
  API_BASE,
  getAuthToken,
  syncAuthSession,
  markAuthSessionPending,
  clearAuthSessionSync,
  reserveTickets,
  calculatePricing,
  initiateCheckout,
  verifyPayment,
  cancelOrder,
  validatePromoCode,
  getOrders,
  getOrder,
  cancelUserOrder,
  fetchEvents,
  fetchPublicVenues,
  searchEvents,
  getNotifications,
  getShareBundle,
  claimShareTicket,
  createShareBundle,
  getTransferDetails,
  initiateFormalTransfer,
  acceptFormalTransfer,
  cancelFormalTransfer,
  getPendingFormalTransfers,
  getTicketShares,
  reclaimSharedTicket,
  cancelShareBundle,
} from '../../lib/api';

const mockFirebaseAuth = getFirebaseAuth as jest.Mock;
const mockUser = {
  uid: 'user_1',
  getIdToken: jest.fn().mockResolvedValue('mock-token'),
};

// Establish auth sync state so apiFetch auth gate passes
async function syncOnce(): Promise<void> {
  fetchMock.mockResponseOnce(JSON.stringify({ profile: { uid: 'user_1' } }));
  await syncAuthSession();
}

describe('api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFirebaseAuth.mockReturnValue({ currentUser: mockUser });
    fetchMock.resetMocks();
    clearAuthSessionSync();
  });

  describe('apiFetch', () => {
    it('makes a GET request with auth headers', async () => {
      await syncOnce();
      fetchMock.mockResponseOnce(JSON.stringify({ data: 'ok' }));

      const result = await apiFetch('/api/v1/test');

      expect(result).toEqual({ data: 'ok' });
      const request = fetchMock.mock.calls[1][0] as string;
      expect(request).toContain('/api/v1/test');
      expect(fetchMock.mock.calls[1][1]?.headers).toMatchObject({
        Authorization: 'Bearer mock-token',
        'Content-Type': 'application/json',
      });
    });

    it('throws when auth is required but no user', async () => {
      mockFirebaseAuth.mockReturnValueOnce({ currentUser: null });

      await expect(apiFetch('/api/v1/test')).rejects.toThrow('Authentication required');
    });

    it('retries on 401 with _retry flag', async () => {
      await syncOnce();
      fetchMock.mockResponses(
        [JSON.stringify({ error: 'Unauthorized' }), { status: 401 }],
        [JSON.stringify({ data: 'retried' }), { status: 200 }],
      );

      const result = await apiFetch('/api/v1/test');
      expect(result).toEqual({ data: 'retried' });
      expect(fetchMock.mock.calls.length).toBe(3);
    });

    it('handles 429 rate limiting', async () => {
      await syncOnce();
      fetchMock.mockResponseOnce(JSON.stringify({ error: 'Rate limited' }), {
        status: 429,
        headers: { 'Retry-After': '30' },
      });

      try {
        await apiFetch('/api/v1/test');
        fail('Expected error');
      } catch (e: any) {
        expect(e.code).toBe('RATE_LIMITED');
        expect(e.retryAfter).toBe(30);
        expect(e.status).toBe(429);
      }
    });

    it('handles timeout', async () => {
      await syncOnce();
      jest.useFakeTimers();
      fetchMock.mockAbortOnce();

      try {
        const promise = apiFetch('/api/v1/test');
        jest.advanceTimersByTime(15000);
        await promise;
      } catch (e: any) {
        expect(e.isTimeout).toBe(true);
      }

      jest.useRealTimers();
    });
  });

  describe('getAuthToken', () => {
    it('returns token for authenticated user', async () => {
      const token = await getAuthToken();
      expect(token).toBe('mock-token');
    });

    it('returns null when no user', async () => {
      mockFirebaseAuth.mockReturnValueOnce({ currentUser: null });
      const token = await getAuthToken();
      expect(token).toBeNull();
    });
  });

  describe('syncAuthSession', () => {
    it('calls auth sync endpoint and marks user synced', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ profile: { uid: 'user_1' } }));

      const result = await syncAuthSession();
      expect(result).toEqual({ profile: { uid: 'user_1' } });
      expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/auth/sync');
    });

    it('throws when no user', async () => {
      mockFirebaseAuth.mockReturnValueOnce({ currentUser: null });
      await expect(syncAuthSession()).rejects.toThrow('Authentication required');
    });

    it('deduplicates concurrent calls for same uid', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ data: { profile: { uid: 'user_1' } } }));

      const [r1, r2] = await Promise.all([syncAuthSession(), syncAuthSession()]);
      expect(fetchMock.mock.calls.length).toBe(1);
      expect(r1).toEqual(r2);
    });
  });

  describe('markAuthSessionPending / clearAuthSessionSync', () => {
    it('clears synced userId and inflight promise', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({}));
      await syncAuthSession();
      // After sync, syncedAuthUserId is set. Now clear it.
      clearAuthSessionSync();
      fetchMock.mockResponseOnce(JSON.stringify({}));
      await syncAuthSession();
      expect(fetchMock.mock.calls.length).toBe(2);
    });
  });

  describe('checkout APIs', () => {
    beforeEach(async () => {
      await syncOnce();
    });

    it('reserveTickets calls POST /api/v1/checkout/reserve', async () => {
      fetchMock.mockResponseOnce(
        JSON.stringify({
          success: true,
          reservationId: 'r_1',
          items: [],
          expiresAt: '',
          expiresInSeconds: 300,
        }),
      );

      const result = await reserveTickets({
        eventId: 'evt_1',
        items: [{ tierId: 't1', quantity: 2 }],
      });
      expect(result.success).toBe(true);
      expect(fetchMock.mock.calls[1][0]).toContain('/api/v1/checkout/reserve');
    });

    it('calculatePricing calls POST /api/v1/checkout/calculate', async () => {
      fetchMock.mockResponseOnce(
        JSON.stringify({ success: true, pricing: { subtotal: 100, grandTotal: 118 } }),
      );

      const result = await calculatePricing({ eventId: 'evt_1' });
      expect(result.pricing.grandTotal).toBe(118);
    });

    it('initiateCheckout calls POST /api/v1/checkout/initiate', async () => {
      fetchMock.mockResponseOnce(
        JSON.stringify({
          success: true,
          requiresPayment: true,
          order: { id: 'ord_1' },
          razorpay: { orderId: 'rp_1', amount: 100, currency: 'INR' },
        }),
      );

      const result = await initiateCheckout({
        reservationId: 'r_1',
        userName: 'User',
        userEmail: 'u@t.com',
      });
      expect(result.order.id).toBe('ord_1');
    });
  });

  describe('events and search APIs', () => {
    beforeEach(async () => {
      await syncOnce();
    });

    it('fetchEvents builds query params', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ events: [] }));
      await fetchEvents({ category: 'music', city: 'mumbai', limit: 10 });
      expect(fetchMock.mock.calls[1][0]).toContain('category=music');
      expect(fetchMock.mock.calls[1][0]).toContain('city=mumbai');
    });

    it('searchEvents encodes query', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ results: [] }));
      await searchEvents('house music');
      expect(fetchMock.mock.calls[1][0]).toContain('q=house%20music');
    });
  });

  describe('ticket APIs', () => {
    beforeEach(async () => {
      await syncOnce();
    });

    it('getShareBundle calls GET with token', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({}));
      await getShareBundle('tok_abc');
      expect(fetchMock.mock.calls[1][0]).toContain('token=tok_abc');
    });

    it('initiateFormalTransfer calls POST', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({}));
      await initiateFormalTransfer({ ticketId: 't_1', recipientEmail: 'a@b.com' });
      expect(fetchMock.mock.calls[1][0]).toContain('/api/v1/tickets/transfer');
    });
  });

  describe('orders API', () => {
    beforeEach(async () => {
      await syncOnce();
    });

    it('getOrders calls GET /api/v1/orders', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ orders: [] }));
      const result = await getOrders();
      expect(result).toEqual({ orders: [] });
    });
  });

  describe('validatePromoCode', () => {
    it('calls POST /api/v1/checkout/promo without auth', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ valid: true, discountAmount: 50 }));

      const result = await validatePromoCode({ eventId: 'evt_1', code: 'SAVE50' });
      expect(result.valid).toBe(true);
      expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/checkout/promo');
    });
  });
});
