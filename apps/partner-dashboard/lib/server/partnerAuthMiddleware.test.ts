import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  getAdminDb: vi.fn(),
}));

vi.mock('@/lib/server/auth', () => ({
  verifyAuth: mocks.verifyAuth,
}));

vi.mock('@/lib/firebase/admin', () => ({
  getAdminDb: mocks.getAdminDb,
  isFirebaseConfigured: () => true,
}));

import { requirePartnerAccess } from './partnerAuthMiddleware';

function makeRequest(partnerIdHeader: string | null = null) {
  return {
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === 'x-partner-id') return partnerIdHeader;
        return null;
      },
    },
    url: 'http://localhost/api/partners/venues/events',
  } as unknown as NextRequest;
}

describe('partnerAuthMiddleware requirePartnerAccess', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('rejects if verifyAuth fails', async () => {
    mocks.verifyAuth.mockResolvedValue(null);

    const req = makeRequest();
    const result = await requirePartnerAccess(req, { type: 'promoter' });

    expect('error' in result).toBe(true);
    expect((result as any).status).toBe(401);
  });

  it('forces Firestore validation even if JWT claims match the partnerId (no fast-path bypass)', async () => {
    mocks.verifyAuth.mockResolvedValue({
      uid: 'user_123',
      partnerId: 'promoter_123',
      partnerType: 'promoter',
      partnerRole: 'PROMOTER',
    });

    // Mock Firestore partner_memberships to return inactive/deactivated status
    const getDocsMock = vi.fn().mockResolvedValue({
      empty: false,
      docs: [
        {
          id: 'membership_123',
          data: () => ({
            partnerId: 'promoter_123',
            isActive: false, // Deactivated membership!
            status: 'inactive',
          }),
        },
      ],
    });

    mocks.getAdminDb.mockReturnValue({
      collection: (col: string) => {
        expect(col).toBe('partner_memberships');
        return {
          where: () => ({
            where: () => ({
              where: () => ({
                limit: () => ({
                  get: getDocsMock,
                }),
              }),
            }),
          }),
        };
      },
    });

    const req = makeRequest('promoter_123');
    const result = await requirePartnerAccess(req, { type: 'promoter' });

    expect('error' in result).toBe(true);
    expect((result as any).status).toBe(403);
    expect((result as any).error.message).toContain('membership is not active');
  });

  it('checks solo promoter account status in promoters collection if membership is not found', async () => {
    mocks.verifyAuth.mockResolvedValue({
      uid: 'user_123',
    });

    // Mock memberships search returning empty (no team membership)
    const getDocsMock = vi.fn().mockResolvedValue({
      empty: true,
    });

    // Mock solo promoter doc to be inactive/suspended
    const getPromoterDocMock = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        status: 'suspended', // Suspended promoter
        displayName: 'John Doe',
      }),
    });

    mocks.getAdminDb.mockReturnValue({
      collection: (col: string) => {
        if (col === 'partner_memberships') {
          return {
            where: () => ({
              where: () => ({
                where: () => ({
                  limit: () => ({
                    get: getDocsMock,
                  }),
                }),
              }),
            }),
          };
        }
        if (col === 'promoters') {
          return {
            doc: (id: string) => {
              expect(id).toBe('user_123');
              return { get: getPromoterDocMock };
            },
          };
        }
        return {};
      },
    });

    const req = makeRequest('user_123');
    const result = await requirePartnerAccess(req, { type: 'promoter' });

    expect('error' in result).toBe(true);
    expect((result as any).status).toBe(403);
    expect((result as any).error.message).toContain('promoter account is inactive or suspended');
  });
});
