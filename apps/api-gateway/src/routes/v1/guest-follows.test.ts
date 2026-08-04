import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  followGuestEntityMock,
  unfollowGuestEntityMock,
  isGuestFollowingMock,
  listGuestFollowsMock,
} = vi.hoisted(() => ({
  followGuestEntityMock: vi.fn(
    async (_db: any, userId: string, entityType: string, entityId: string) => ({
      following: true,
      userId,
      entityId,
      entityType,
    }),
  ),
  unfollowGuestEntityMock: vi.fn(
    async (_db: any, userId: string, entityType: string, entityId: string) => ({
      following: false,
      userId,
      entityId,
      entityType,
    }),
  ),
  isGuestFollowingMock: vi.fn(async () => true),
  listGuestFollowsMock: vi.fn(async () => ({
    venueIds: ['venue_1'],
    hostIds: ['host_1'],
  })),
}));

vi.mock('@c1rcle/core/guest-follow-service', () => ({
  followGuestEntity: followGuestEntityMock,
  unfollowGuestEntity: unfollowGuestEntityMock,
  isGuestFollowing: isGuestFollowingMock,
  listGuestFollows: listGuestFollowsMock,
}));

import socialRoutes from './social';
import validatePlugin from '../../plugins/validate';

async function buildServer() {
  const server = Fastify({ logger: false });
  const fakeDb = {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            get: vi.fn(async () => ({ exists: true })),
          })),
        })),
      })),
    })),
  };
  server.decorate('db', fakeDb as any);
  server.decorate('requireAuth', async (_request: any, reply: any) => {
    if (!_request.user) return reply.status(401).send({ error: 'Unauthorized' });
  });
  server.addHook('onRequest', async (request: any) => {
    if (request.headers.authorization) {
      request.user = { uid: 'user_1' };
    }
  });
  await server.register(validatePlugin);
  await server.register(socialRoutes, { prefix: '/api/v1' });
  return server;
}

describe('guest follow routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/v1/follow derives the follower from auth when available', async () => {
    const server = await buildServer();

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/follow?targetId=host_1&targetType=host',
      headers: { authorization: 'Bearer test-token' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      data: { following: true, isFollowing: true },
      following: true,
    });
    expect(isGuestFollowingMock).toHaveBeenCalledWith(
      expect.any(Object),
      'user_1',
      'host',
      'host_1',
    );

    await server.close();
  });

  it('GET /api/v1/follow returns false when unauthenticated and no fallback userId is provided', async () => {
    const server = await buildServer();

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/follow?targetId=host_1',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      data: { following: false, isFollowing: false },
      following: false,
    });
    expect(isGuestFollowingMock).not.toHaveBeenCalled();

    await server.close();
  });

  it('POST /api/v1/follow requires auth and returns the legacy follow wrapper', async () => {
    const server = await buildServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/follow',
      headers: { authorization: 'Bearer test-token' },
      payload: { targetId: 'host_1', targetType: 'host' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      success: true,
      follow: {
        userId: 'user_1',
        entityId: 'host_1',
        entityType: 'host',
      },
    });
    expect(followGuestEntityMock).toHaveBeenCalledWith(
      expect.any(Object),
      'user_1',
      'host',
      'host_1',
    );

    await server.close();
  });

  it('DELETE /api/v1/venues/:venueId/follow preserves the venue-specific success contract', async () => {
    const server = await buildServer();

    const response = await server.inject({
      method: 'DELETE',
      url: '/api/v1/venues/venue_1/follow',
      headers: { authorization: 'Bearer test-token' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      following: false,
      userId: 'user_1',
      entityId: 'venue_1',
      entityType: 'venue',
    });
    expect(unfollowGuestEntityMock).toHaveBeenCalledWith(
      expect.any(Object),
      'user_1',
      'venue',
      'venue_1',
    );

    await server.close();
  });

  it('GET /api/v1/venues/:venueId/follow-status returns false when the guest is unauthenticated', async () => {
    const server = await buildServer();

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/venues/venue_1/follow-status',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      data: { isFollowing: false },
      isFollowing: false,
    });
    expect(isGuestFollowingMock).not.toHaveBeenCalled();

    await server.close();
  });

  it('GET /api/v1/users/me/follows returns the canonical user-scoped graph', async () => {
    const server = await buildServer();

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/users/me/follows',
      headers: { authorization: 'Bearer test-token' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      data: { follows: { venueIds: ['venue_1'], hostIds: ['host_1'] } },
    });
    expect(listGuestFollowsMock).toHaveBeenCalledWith(expect.any(Object), 'user_1');

    await server.close();
  });

  it('POST /api/v1/hosts/:hostId/follow uses the canonical bidirectional graph', async () => {
    const server = await buildServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/hosts/host_1/follow',
      headers: { authorization: 'Bearer test-token' },
      payload: { hostName: 'QA Host' },
    });

    expect(response.statusCode).toBe(201);
    expect(followGuestEntityMock).toHaveBeenCalledWith(
      expect.any(Object),
      'user_1',
      'host',
      'host_1',
      { displayName: 'QA Host' },
    );

    await server.close();
  });
});
