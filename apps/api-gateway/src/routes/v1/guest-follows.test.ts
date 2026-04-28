import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    followEntityMock,
    unfollowEntityMock,
    isFollowingMock,
} = vi.hoisted(() => ({
    followEntityMock: vi.fn(async (followerId: string, targetId: string, targetType: string) => ({
        id: `${followerId}_${targetId}`,
        followerId,
        targetId,
        targetType,
    })),
    unfollowEntityMock: vi.fn(async () => ({ unfollowed: true })),
    isFollowingMock: vi.fn(async () => true),
}));

vi.mock('@c1rcle/core/follow-graph-engine', () => ({
    followEntity: followEntityMock,
    unfollowEntity: unfollowEntityMock,
    isFollowing: isFollowingMock,
}));

import socialRoutes from './social';
import validatePlugin from '../../plugins/validate';

async function buildServer() {
    const server = Fastify({ logger: false });
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
            url: '/api/v1/follow?targetId=host_1',
            headers: { authorization: 'Bearer test-token' },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ following: true });
        expect(isFollowingMock).toHaveBeenCalledWith('user_1', 'host_1');

        await server.close();
    });

    it('GET /api/v1/follow returns false when unauthenticated and no fallback userId is provided', async () => {
        const server = await buildServer();

        const response = await server.inject({
            method: 'GET',
            url: '/api/v1/follow?targetId=host_1',
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ following: false });
        expect(isFollowingMock).not.toHaveBeenCalled();

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
                followerId: 'user_1',
                targetId: 'host_1',
                targetType: 'host',
            },
        });
        expect(followEntityMock).toHaveBeenCalledWith('user_1', 'host_1', 'host');

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
        expect(response.json()).toEqual({ success: true, unfollowed: true });
        expect(unfollowEntityMock).toHaveBeenCalledWith('user_1', 'venue_1', 'venue');

        await server.close();
    });

    it('GET /api/v1/venues/:venueId/follow-status returns false when the guest is unauthenticated', async () => {
        const server = await buildServer();

        const response = await server.inject({
            method: 'GET',
            url: '/api/v1/venues/venue_1/follow-status',
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ isFollowing: false });
        expect(isFollowingMock).not.toHaveBeenCalled();

        await server.close();
    });
});
