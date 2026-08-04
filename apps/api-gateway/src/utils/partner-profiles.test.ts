import { describe, expect, it, vi } from 'vitest';
import { getPartnerProfileSummary, getPartnerProfileWithPii } from './partner-profiles';

vi.mock('@c1rcle/core/admin', () => ({
  getAdminStorage: () => ({
    bucket: () => ({
      name: 'mock-bucket',
      file: () => ({
        getSignedUrl: async () => ['http://signed.url'],
      }),
    }),
  }),
}));

class MockQuery {
  constructor(private results: any = { empty: true, docs: [] }) {}

  where() {
    return this;
  }
  limit() {
    return this;
  }
  orderBy() {
    return this;
  }
  async get() {
    return this.results;
  }
}

describe('partner-profiles PII isolation validation tests', () => {
  const mockDb = {
    collection: (name: string) => {
      return {
        doc: (id: string) => ({
          get: async () => {
            if (name === 'users') {
              return {
                exists: true,
                data: () => ({
                  uid: id,
                  email: 'user@example.com',
                  phoneNumber: '1234567890',
                  displayName: 'Test User',
                }),
              };
            }
            if (name === 'venues') {
              return {
                exists: true,
                data: () => ({
                  venueName: 'Test Venue',
                  ownerUid: 'owner_123',
                  city: 'Pune',
                }),
              };
            }
            return { exists: false };
          },
        }),
        where: () => {
          if (name === 'promoter_connections' || name === 'partnerships') {
            return new MockQuery({
              empty: false,
              docs: [
                {
                  id: 'conn_123',
                  data: () => ({
                    status: 'active',
                    initiatedBy: 'venue',
                  }),
                },
              ],
            });
          }
          return new MockQuery();
        },
      };
    },
  };

  it('getPartnerProfileSummary does not include PII by default', async () => {
    const profile = await getPartnerProfileSummary(mockDb as any, 'venue_123');
    expect(profile).not.toBeNull();
    expect((profile as any)._pii).toBeUndefined();
    expect((profile as any).email).toBeUndefined();
    expect((profile as any).phone).toBeUndefined();
  });

  it('getPartnerProfileWithPii injects email/phone for self-viewer without a connection', async () => {
    const result = await getPartnerProfileWithPii(mockDb as any, {
      partnerId: 'venue_123',
      viewerRole: 'venue',
      viewerId: 'venue_123',
    });
    expect(result).not.toBeNull();
    expect(result && (result.profile as any).email).toBe('user@example.com');
    expect(result && (result.profile as any).phone).toBe('1234567890');
    expect(result && (result.profile as any)._pii).toBeUndefined();
  });

  it('getPartnerProfileWithPii injects email/phone and removes _pii for active connections', async () => {
    const result = await getPartnerProfileWithPii(mockDb as any, {
      partnerId: 'venue_123',
      viewerRole: 'promoter',
      viewerId: 'promoter_123',
    });
    expect(result).not.toBeNull();
    expect(result && (result.profile as any).email).toBe('user@example.com');
    expect(result && (result.profile as any).phone).toBe('1234567890');
    expect(result && (result.profile as any)._pii).toBeUndefined();
    expect(result && result.connection).not.toBeNull();
    expect(result && result.connection!.status).toBe('active');
  });

  it('prefers a connected legacy record over a newer pending duplicate', async () => {
    const duplicateConnectionDb = {
      collection: (name: string) => ({
        doc: (id: string) => ({
          get: async () => {
            if (name === 'venues') {
              return {
                exists: true,
                data: () => ({ venueName: 'Test Venue', ownerUid: 'owner_123' }),
              };
            }
            if (name === 'users' && id === 'owner_123') {
              return {
                exists: true,
                data: () => ({
                  email: 'connected@example.com',
                  phoneNumber: '9876543210',
                }),
              };
            }
            return { exists: false };
          },
        }),
        where: () =>
          name === 'promoter_connections'
            ? new MockQuery({
                empty: false,
                docs: [
                  {
                    id: 'pending_duplicate',
                    data: () => ({ status: 'pending' }),
                  },
                  {
                    id: 'legacy_connected',
                    data: () => ({ status: 'connected' }),
                  },
                ],
              })
            : new MockQuery(),
      }),
    };

    const result = await getPartnerProfileWithPii(duplicateConnectionDb as any, {
      partnerId: 'venue_123',
      viewerRole: 'promoter',
      viewerId: 'promoter_123',
    });

    expect(result?.connection).toMatchObject({ id: 'legacy_connected', status: 'active' });
    expect((result?.profile as any).email).toBe('connected@example.com');
    expect((result?.profile as any).phone).toBe('9876543210');
  });

  it('getPartnerProfileWithPii does not fetch or expose email/phone in profile or socialLinks when not connected', async () => {
    const mockDbNotConnected = {
      collection: (name: string) => {
        return {
          doc: (id: string) => ({
            get: async () => ({
              exists: true,
              data: () => ({
                venueName: 'Test Venue',
                ownerId: 'owner_123',
                email: 'venue@example.com',
                phone: '5555555',
              }),
            }),
          }),
          where: () => new MockQuery(), // returns empty, i.e., no connection
        };
      },
    };

    const result = await getPartnerProfileWithPii(mockDbNotConnected as any, {
      partnerId: 'venue_123',
      viewerRole: 'promoter',
      viewerId: 'promoter_123',
    });
    expect(result).not.toBeNull();
    expect(result && (result.profile as any).email).toBeUndefined();
    expect(result && (result.profile as any).phone).toBeUndefined();
    expect(result && (result.profile as any)._pii).toBeUndefined();
    expect(result && (result.profile as any).socialLinks.email).toBeUndefined();
    expect(result && (result.profile as any).socialLinks.phone).toBeUndefined();
    expect(result && result.connection).toBeNull();
  });
});
