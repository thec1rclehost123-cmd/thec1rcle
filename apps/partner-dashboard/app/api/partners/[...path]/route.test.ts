import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const requireVenueAccessMock = vi.fn();
const getAdminDbMock = vi.fn();

vi.mock('@/lib/rbac/staffProfileEnforcer', () => ({
  requireVenueAccess: requireVenueAccessMock,
}));

vi.mock('@/lib/firebase/admin', () => ({
  getAdminDb: getAdminDbMock,
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

  it('returns 404 Not Found if the event does not exist in Firestore', async () => {
    requireVenueAccessMock.mockResolvedValue({
      uid: 'user_123',
      venueId: 'venue_A',
    });

    const getDocMock = vi.fn().mockResolvedValue({
      exists: false,
    });

    getAdminDbMock.mockReturnValue({
      collection: () => ({
        doc: (id: string) => {
          expect(id).toBe('evt_123');
          return { get: getDocMock };
        },
      }),
    });

    const { GET } = await import('./route');
    const req = makeRequest();
    const response = await GET(req, {
      params: Promise.resolve({ path: ['venues', 'events', 'evt_123', 'computed-analytics'] }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 Forbidden if the event venueId does not match the user venueId', async () => {
    requireVenueAccessMock.mockResolvedValue({
      uid: 'user_123',
      venueId: 'venue_A',
    });

    const getDocMock = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        venueId: 'venue_B', // Different venue
      }),
    });

    getAdminDbMock.mockReturnValue({
      collection: () => ({
        doc: () => ({ get: getDocMock }),
      }),
    });

    const { GET } = await import('./route');
    const req = makeRequest();
    const response = await GET(req, {
      params: Promise.resolve({ path: ['venues', 'events', 'evt_123', 'computed-analytics'] }),
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.message).toContain('does not belong to this venue');
  });

  it('continues and loads analytics if the event belongs to the venue', async () => {
    requireVenueAccessMock.mockResolvedValue({
      uid: 'user_123',
      venueId: 'venue_A',
    });

    const getDocMock = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        venueId: 'venue_A', // Matching venue
      }),
    });

    getAdminDbMock.mockReturnValue({
      collection: () => ({
        doc: () => ({ get: getDocMock }),
      }),
    });

    // Mock fetch for gateway routes
    const globalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('overview') || url.includes('finance')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ gross: 100, grossRevenue: 100 }),
        });
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
      expect(body.totalRevenue).toBe(100);
    } finally {
      global.fetch = globalFetch;
    }
  });
});
