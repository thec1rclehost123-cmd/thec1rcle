import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    manageConnectionMock,
    generatePromoterLinkMock,
    getPromoterStatsMock,
    listConnectionsMock,
    trackPromoterLinkClickMock,
} = vi.hoisted(() => ({
    manageConnectionMock: vi.fn(),
    generatePromoterLinkMock: vi.fn(),
    getPromoterStatsMock: vi.fn(),
    listConnectionsMock: vi.fn(),
    trackPromoterLinkClickMock: vi.fn(),
}));

vi.mock('@c1rcle/core/promoter-engine', () => ({
    manageConnection: manageConnectionMock,
    generatePromoterLink: generatePromoterLinkMock,
    getPromoterStats: getPromoterStatsMock,
    listConnections: listConnectionsMock,
    trackPromoterLinkClick: trackPromoterLinkClickMock,
}));

import promoterRoutes from './promoters';
import validatePlugin from '../../plugins/validate';

async function buildServer() {
    const server = Fastify({ logger: false });
    await server.register(validatePlugin);
    await server.register(promoterRoutes, { prefix: '/api/v1' });
    return server;
}

describe('guest promoter click routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('POST /api/v1/promoter/links/click preserves the legacy success contract', async () => {
        trackPromoterLinkClickMock.mockResolvedValueOnce({ status: 'ok', linkId: 'link_123' });

        const server = await buildServer();
        const response = await server.inject({
            method: 'POST',
            url: '/api/v1/promoter/links/click',
            payload: { code: 'PROMO1', source: 'event-rsvp' },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ success: true, linkId: 'link_123' });
        expect(trackPromoterLinkClickMock).toHaveBeenCalledWith('PROMO1', { source: 'event-rsvp' });

        await server.close();
    });

    it('POST /api/v1/promoter/links/click preserves the inactive-link 404 contract', async () => {
        trackPromoterLinkClickMock.mockResolvedValueOnce({ status: 'inactive' });

        const server = await buildServer();
        const response = await server.inject({
            method: 'POST',
            url: '/api/v1/promoter/links/click',
            payload: { code: 'PROMO1' },
        });

        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual({ error: 'Link not active' });

        await server.close();
    });

    it('POST /api/v1/promoter/links/click preserves the no-firebase 503 contract', async () => {
        trackPromoterLinkClickMock.mockResolvedValueOnce({ status: 'unavailable' });

        const server = await buildServer();
        const response = await server.inject({
            method: 'POST',
            url: '/api/v1/promoter/links/click',
            payload: { code: 'PROMO1' },
        });

        expect(response.statusCode).toBe(503);
        expect(response.json()).toEqual({ success: false, reason: 'firebase_not_configured' });

        await server.close();
    });
});
