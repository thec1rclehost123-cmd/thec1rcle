import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const requireVenueAccessMock = vi.fn();

vi.mock('@/lib/rbac/staffProfileEnforcer', () => ({
  requireVenueAccess: requireVenueAccessMock,
}));

vi.mock('@/lib/server/apiGateway', () => ({
  GATEWAY_URL: 'http://gateway.test',
  proxyToGateway: vi.fn(),
}));

function makeRequest(authHeader: string = 'Bearer test-token') {
  return {
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === 'authorization') return authHeader;
        if (name.toLowerCase() === 'x-request-id') return 'req-123';
        return null;
      },
    },
    url: 'http://localhost/api/partners/venues/events/evt_123/computed-analytics',
    method: 'GET',
  } as unknown as NextRequest;
}

describe('handleComputedAnalytics cross-tenant IDOR validation', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 403 Forbidden if the user lacks view_analytics permission', async () => {
    requireVenueAccessMock.mockResolvedValue({
      error: { code: 'FORBIDDEN', message: 'Forbidden' },
      status: 403,
    });

    const { GET } = await import('./route');
    const req = makeRequest();
    const response = await GET(req, {
      params: Promise.resolve({ path: ['venues', 'events', 'evt_123', 'computed-analytics'] }),
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('returns 502 BAD_GATEWAY when the gateway responds with an error for a non-existent event', async () => {
    requireVenueAccessMock.mockResolvedValue({
      uid: 'user_123',
      venueId: 'venue_A',
    });

    const origFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: { code: 'NOT_FOUND', message: 'Event not found' } }),
    }) as any;

    try {
      const { GET } = await import('./route');
      const req = makeRequest();
      const response = await GET(req, {
        params: Promise.resolve({ path: ['venues', 'events', 'evt_123', 'computed-analytics'] }),
      });

      expect(response.status).toBe(502);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('BAD_GATEWAY');
    } finally {
      global.fetch = origFetch;
    }
  });

  it('returns 502 BAD_GATEWAY when the gateway rejects a cross-tenant request', async () => {
    requireVenueAccessMock.mockResolvedValue({
      uid: 'user_123',
      venueId: 'venue_A',
    });

    const origFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: { code: 'FORBIDDEN', message: 'Venue mismatch' } }),
    }) as any;

    try {
      const { GET } = await import('./route');
      const req = makeRequest();
      const response = await GET(req, {
        params: Promise.resolve({ path: ['venues', 'events', 'evt_123', 'computed-analytics'] }),
      });

      expect(response.status).toBe(502);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('BAD_GATEWAY');
    } finally {
      global.fetch = origFetch;
    }
  });

  it('proxies to the gateway and returns the transformed analytics response', async () => {
    requireVenueAccessMock.mockResolvedValue({
      uid: 'user_123',
      venueId: 'venue_A',
    });

    const analyticsData = {
      totalRevenue: 5000,
      ticketsSold: 100,
      totalCheckIns: 75,
      capacity: 200,
      views: 1500,
      salesTimeline: [
        { date: '2026-07-28', revenue: 3000, tickets: 60 },
        { date: '2026-07-29', revenue: 2000, tickets: 40 },
      ],
      ticketMix: [
        { tierName: 'General', revenue: 4000 },
        { tierName: 'VIP', revenue: 1000 },
      ],
      salesByPhase: {
        'Early Bird': { ticketsSold: 50, revenue: 2500 },
        Regular: { ticketsSold: 30, revenue: 1500 },
        'Last Call': { ticketsSold: 20, revenue: 1000 },
      },
      hourlyTimeline: [
        { hour: 21, label: '21:00', checkIns: 30 },
        { hour: 22, label: '22:00', checkIns: 45 },
      ],
    };

    const financeData = { net: 4200, settlementStatus: 'pending' };

    const origFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/analytics/event/')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(analyticsData) });
      }
      if (url.includes('/finance')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(financeData) });
      }
      return Promise.reject(new Error('Unknown url'));
    }) as any;

    try {
      const { GET } = await import('./route');
      const req = makeRequest();
      const response = await GET(req, {
        params: Promise.resolve({ path: ['venues', 'events', 'evt_123', 'computed-analytics'] }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.totalRevenue).toBe(5000);
      expect(body.ticketsSold).toBe(100);
      expect(body.totalCheckIns).toBe(75);
      expect(body.capacity).toBe(200);
      expect(body.views).toBe(1500);
      expect(body.revenueTimeline).toHaveLength(30);
      expect(body.revenueTimeline.some((d: any) => d.gross === 3000)).toBe(true);
      expect(body.revenueTimeline.some((d: any) => d.gross === 2000)).toBe(true);
      expect(body.ticketsTimeline).toHaveLength(2);
      expect(body.revenueByTicketType).toHaveLength(2);
      expect(body.revenueByPhase).toHaveLength(3);
      expect(body.revenueByPhase[0]).toMatchObject({
        phase: 'Early Bird',
        revenue: 2500,
        ticketsSold: 50,
      });
      expect(body.funnel).toHaveLength(4);
      expect(body.entryCurve).toHaveLength(2);
      expect(body.profitEstimate).toBe(4200);
      expect(body.pendingPayout).toBe(4200);
    } finally {
      global.fetch = origFetch;
    }
  });
});
