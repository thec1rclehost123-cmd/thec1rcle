import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/guest-gp5', () => ({
    getGuestWallet: vi.fn(async () => ({
        upcomingTickets: [{ ticketId: 'ticket_1' }],
        pastTickets: [],
        actionNeeded: [],
        cancelledTickets: [],
        shareBundles: {},
    })),
    getGuestWalletTicket: vi.fn(async () => ({ ticketId: 'ticket_1', eventId: 'event_1' })),
    createGuestShareBundle: vi.fn(async () => ({ id: 'bundle_1', orderId: 'ord_1', token: 'share_tok' })),
    getGuestShareState: vi.fn(async () => ({
        order: { id: 'ord_1', userId: 'user_1' },
        bundles: [{ id: 'bundle_1' }],
        assignments: [{ id: 'assign_1' }],
    })),
    reclaimGuestShareSlot: vi.fn(async () => ({ success: true })),
    cancelGuestShareBundle: vi.fn(async () => ({ success: true })),
    previewGuestShareBundle: vi.fn(async () => ({
        id: 'bundle_1',
        event: { title: 'After Dark', image: 'poster.jpg', startDate: '2099-01-01T20:00:00.000Z', venue: 'High Spirits' },
        slots: [{ claimStatus: 'unclaimed' }],
        remainingSlots: 1,
    })),
    claimGuestShareBundle: vi.fn(async () => ({ assignment: { id: 'assign_1' } })),
    initiateGuestTransfer: vi.fn(async () => ({ id: 'transfer_1' })),
    acceptGuestTransfer: vi.fn(async () => ({ success: true })),
    cancelGuestTransfer: vi.fn(async () => ({ success: true })),
    getGuestPendingTransfers: vi.fn(async () => [{ id: 'transfer_1' }]),
    createGuestPartnerClaimLink: vi.fn(async () => ({ token: 'pair_tok' })),
    claimGuestPartnerSlot: vi.fn(async () => ({ ticketId: 'ticket_1' })),
    assignGuestPartner: vi.fn(async () => ({ id: 'couple_assign_1' })),
    transferGuestCoupleTicket: vi.fn(async () => ({ success: true })),
    getGuestCoupleStatus: vi.fn(async () => ({ state: 'partial' })),
    cancelGuestPartnerSlot: vi.fn(async () => ({ success: true })),
    previewGuestPairClaim: vi.fn(async () => ({ id: 'claim_1', eventId: 'event_1' })),
    getGuestCoverWallet: vi.fn(async () => [{ id: 'wallet_1' }]),
    generateGuestTicketDownload: vi.fn(async () => ({ buffer: Buffer.from('pdf'), filename: 'ticket-ord_1.pdf' })),
    getGuestProfileSummary: vi.fn(async () => ({
        profile: { uid: 'user_2', displayName: 'Member' },
        events: { upcoming: [], attended: [] },
    })),
    findGuestUserByEmail: vi.fn(async () => ({ uid: 'user_2', email: 'guest@example.com', displayName: 'Guest' })),
    getGuestNotifications: vi.fn(async () => [{ id: 'notif_1' }]),
    getGuestUnreadCount: vi.fn(async () => 3),
    markGuestNotificationRead: vi.fn(async () => ({ id: 'notif_1', isRead: true })),
    markAllGuestNotificationsRead: vi.fn(async () => ({ updated: 2 })),
}));

import validatePlugin from '../../plugins/validate';
import ticketRoutes from './tickets';
import guestProfileRoutes from './guest-profiles';
import guestNotificationRoutes from './guest-notifications';

async function buildServer() {
    const server = Fastify({ logger: false });
    server.decorate('db', {
        collection: vi.fn(() => ({
            where: vi.fn(() => ({
                limit: vi.fn(() => ({
                    get: vi.fn(async () => ({ empty: true, docs: [] })),
                })),
            })),
            doc: vi.fn(() => ({
                get: vi.fn(async () => ({ exists: false, data: () => null })),
            })),
        })),
    } as any);

    server.addHook('onRequest', async (request: any) => {
        if (request.headers.authorization) {
            request.user = { uid: 'user_1', email: 'user@example.com' };
        }
    });

    await server.register(validatePlugin);
    await server.register(ticketRoutes, { prefix: '/api/v1' });
    await server.register(guestProfileRoutes, { prefix: '/api/v1' });
    await server.register(guestNotificationRoutes, { prefix: '/api/v1' });
    return server;
}

describe('GP-5 gateway wallet/profile/notification routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('GET /api/v1/tickets returns the legacy wallet buckets for the authenticated guest', async () => {
        const server = await buildServer();
        const response = await server.inject({
            method: 'GET',
            url: '/api/v1/tickets',
            headers: { authorization: 'Bearer test-token' },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            upcomingTickets: [{ ticketId: 'ticket_1' }],
            pastTickets: [],
            actionNeeded: [],
            cancelledTickets: [],
        });
        await server.close();
    });

    it('GET /api/v1/tickets/share enforces order ownership through the wallet service state', async () => {
        const server = await buildServer();
        const response = await server.inject({
            method: 'GET',
            url: '/api/v1/tickets/share?orderId=ord_1',
            headers: { authorization: 'Bearer test-token' },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            success: true,
            bundles: [{ id: 'bundle_1' }],
            assignments: [{ id: 'assign_1' }],
        });
        await server.close();
    });

    it('GET /api/v1/guest-profiles/:id returns the guest profile aggregate', async () => {
        const server = await buildServer();
        const response = await server.inject({
            method: 'GET',
            url: '/api/v1/guest-profiles/user_2',
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            profile: { uid: 'user_2', displayName: 'Member' },
            events: { upcoming: [], attended: [] },
        });
        await server.close();
    });

    it('GET /api/v1/guest-notifications supports unread counts for the authenticated guest', async () => {
        const server = await buildServer();
        const response = await server.inject({
            method: 'GET',
            url: '/api/v1/guest-notifications?countOnly=true',
            headers: { authorization: 'Bearer test-token' },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ unreadCount: 3 });
        await server.close();
    });

    it('PATCH /api/v1/guest-notifications/:id marks an owned notification as read', async () => {
        const server = await buildServer();
        const response = await server.inject({
            method: 'PATCH',
            url: '/api/v1/guest-notifications/notif_1',
            headers: { authorization: 'Bearer test-token' },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ id: 'notif_1', isRead: true });
        await server.close();
    });
});
