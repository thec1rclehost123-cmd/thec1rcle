import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/guest-gp5', () => ({
  createGuestShareBundle: vi.fn(async () => ({
    id: 'bundle_1',
    orderId: 'ord_1',
    token: 'share_tok',
  })),
  getGuestShareState: vi.fn(async () => ({
    order: { id: 'ord_1', userId: 'user_1' },
    bundles: [{ id: 'bundle_1' }],
    assignments: [{ id: 'assign_1' }],
  })),
  reclaimGuestShareSlot: vi.fn(async () => ({ success: true })),
  cancelGuestShareBundle: vi.fn(async () => ({ success: true })),
  previewGuestShareBundle: vi.fn(async () => ({
    id: 'bundle_1',
    event: {
      title: 'After Dark',
      image: 'poster.jpg',
      startDate: '2099-01-01T20:00:00.000Z',
      venue: 'High Spirits',
    },
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
  getGuestCoverWalletsByOrderIds: vi.fn(async () => ({
    ord_1: [{ id: 'wallet_1', orderId: 'ord_1', currentBalancePaise: 3200 }],
    ord_2: [],
  })),
  generateGuestTicketDownload: vi.fn(async () => ({
    buffer: Buffer.from('pdf'),
    filename: 'ticket-ord_1.pdf',
  })),
}));

vi.mock('@c1rcle/core/guest-wallet-profile-notification-service', () => ({
  getGuestWallet: vi.fn(async () => ({
    upcomingTickets: [{ ticketId: 'ticket_1' }],
    pastTickets: [],
    actionNeeded: [],
    cancelledTickets: [],
    coverWalletsByOrder: {
      ord_1: [{ id: 'wallet_1', orderId: 'ord_1', currentBalancePaise: 3200 }],
    },
    shareBundles: {},
  })),
  getGuestWalletTicket: vi.fn(async () => ({ ticketId: 'ticket_1', eventId: 'event_1' })),
  getGuestProfileSummary: vi.fn(async () => ({
    profile: { uid: 'user_2', displayName: 'Member' },
    events: { upcoming: [], attended: [] },
  })),
  findGuestUserByEmail: vi.fn(async () => ({
    uid: 'user_2',
    email: 'guest@example.com',
    displayName: 'Guest',
  })),
  getGuestNotifications: vi.fn(async () => [{ id: 'notif_1' }]),
  getGuestUnreadCount: vi.fn(async () => 3),
  markGuestNotificationRead: vi.fn(async () => ({ id: 'notif_1', isRead: true })),
  markAllGuestNotificationsRead: vi.fn(async () => ({ updated: 2 })),
}));

vi.mock('@c1rcle/core/guest-pass-engine', () => ({
  buildGuestPass: vi.fn(async () => ({
    statusCode: 503,
    body: {
      success: false,
      code: 'not_configured',
      provider: 'apple',
      missing: ['APPLE_PASS_TYPE_ID'],
      fallback: 'pdf',
    },
  })),
}));

import validatePlugin from '../../plugins/validate';
import ticketRoutes from './tickets';
import guestProfileRoutes from './guest-profiles';
import guestNotificationRoutes from './guest-notifications';
import guestPassRoutes from './guest-passes';
// @ts-ignore
import { buildGuestPass } from '@c1rcle/core/guest-pass-engine';

// @ts-ignore
import { initiateGuestTransfer } from '../../services/guest-gp5';

async function buildServer() {
  const server = Fastify({ logger: false });
  const requireAuthenticatedUser = async (request: any, reply: any) => {
    if (!request.user?.uid) {
      return reply.status(401).send({ success: false, error: 'Unauthorized' });
    }
  };
  server.decorate('requireAuth', requireAuthenticatedUser);
  server.decorate('requireVerifiedPhone', requireAuthenticatedUser);
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
  server.decorate('requireVerifiedPhone', async (request: any, reply: any) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    if (!request.user.phone_number) {
      return reply.status(403).send({
        error: { code: 'PHONE_VERIFICATION_REQUIRED', message: 'Phone verification required' },
      });
    }
  });

  server.addHook('onRequest', async (request: any) => {
    if (request.headers.authorization) {
      request.user = {
        uid: 'user_1',
        email: 'user@example.com',
        ...(request.headers['x-test-unverified'] === '1' ? {} : { phone_number: '+919999999999' }),
      };
    }
  });

  await server.register(validatePlugin);
  await server.register(ticketRoutes, { prefix: '/api/v1' });
  await server.register(guestProfileRoutes, { prefix: '/api/v1' });
  await server.register(guestNotificationRoutes, { prefix: '/api/v1' });
  await server.register(guestPassRoutes, { prefix: '/api/v1' });
  return server;
}

describe('GP-5 gateway wallet/profile/notification routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects ticket delivery, transfer, share and claim operations without a Firebase phone claim', async () => {
    const server = await buildServer();
    const headers = { authorization: 'Bearer test-token', 'x-test-unverified': '1' };
    const cases = [
      ['GET', '/api/v1/tickets', undefined],
      ['GET', '/api/v1/tickets/me', undefined],
      ['GET', '/api/v1/tickets/my-wallet', undefined],
      ['POST', '/api/v1/ticket_1/transfer', {}],
      ['POST', '/api/v1/claim', {}],
      [
        'POST',
        '/api/v1/tickets/transfer',
        { ticketId: 'ticket_1', recipientEmail: 'recipient@example.com' },
      ],
      ['PATCH', '/api/v1/tickets/transfer', {}],
      ['DELETE', '/api/v1/tickets/transfer?transferId=transfer_1', undefined],
      ['GET', '/api/v1/tickets/transfer/pending', undefined],
      ['POST', '/api/v1/tickets/share', { orderId: 'ord_1', eventId: 'event_1', quantity: 1 }],
      ['GET', '/api/v1/tickets/share?orderId=ord_1', undefined],
      ['DELETE', '/api/v1/tickets/share', {}],
      ['POST', '/api/v1/tickets/share/revoke', {}],
      ['POST', '/api/v1/tickets/claim/share', { token: 'share_tok' }],
      ['GET', '/api/v1/tickets/pair?bundleId=bundle_1', undefined],
      ['POST', '/api/v1/tickets/pair', { token: 'pair_tok' }],
      ['DELETE', '/api/v1/tickets/pair', {}],
      ['POST', '/api/v1/tickets/pair/link', {}],
      ['POST', '/api/v1/tickets/pair/assign', {}],
      ['POST', '/api/v1/tickets/pair/transfer', {}],
      ['GET', '/api/v1/tickets/cover-wallet?orderId=ord_1', undefined],
      ['POST', '/api/v1/tickets/cover-wallets', {}],
      ['GET', '/api/v1/tickets/download?orderId=ord_1', undefined],
      ['GET', '/api/v1/tickets/ticket_1', undefined],
      ['POST', '/api/v1/tickets/ticket_1/refresh-qr', {}],
    ] as const;

    for (const [method, url, payload] of cases) {
      const response = await server.inject({ method, url, headers, payload });
      expect(response.statusCode, `${method} ${url}`).toBe(403);
      expect(response.json(), `${method} ${url}`).toMatchObject({
        error: { code: 'PHONE_VERIFICATION_REQUIRED' },
      });
    }

    await server.close();
  });

  it('keeps share and pair token previews public without allowing a claim', async () => {
    const server = await buildServer();
    const sharePreview = await server.inject({
      method: 'GET',
      url: '/api/v1/tickets/claim?token=share_tok',
    });
    const pairPreview = await server.inject({
      method: 'GET',
      url: '/api/v1/tickets/pair?token=pair_tok',
    });

    expect(sharePreview.statusCode).toBe(200);
    expect(pairPreview.statusCode).toBe(200);
    await server.close();
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
      coverWalletsByOrder: {
        ord_1: [{ id: 'wallet_1', orderId: 'ord_1', currentBalancePaise: 3200 }],
      },
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

  it('POST /api/v1/tickets/cover-wallets returns wallets grouped by order id', async () => {
    const server = await buildServer();
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/tickets/cover-wallets',
      headers: { authorization: 'Bearer test-token' },
      payload: { orderIds: ['ord_1', 'ord_2'] },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      walletsByOrder: {
        ord_1: [{ id: 'wallet_1', orderId: 'ord_1', currentBalancePaise: 3200 }],
        ord_2: [],
      },
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
    expect(response.json()).toMatchObject({ success: true, unreadCount: 3, notifications: [] });
    await server.close();
  });

  it('GET /api/v1/passes/:platform returns structured not_configured wallet fallback', async () => {
    const server = await buildServer();
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/passes/apple?orderId=ord_1',
      headers: { authorization: 'Bearer test-token' },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      success: false,
      code: 'not_configured',
      provider: 'apple',
      fallback: 'pdf',
    });
    expect(buildGuestPass).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'ord_1', platform: 'apple' }),
    );
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
    expect(response.json()).toEqual({ success: true });
    await server.close();
  });

  it('POST /api/v1/tickets/transfer returns 403 GENDER_UPDATE_REQUIRED when recipient gender is prefer_not_to_say', async () => {
    vi.mocked(initiateGuestTransfer).mockRejectedValueOnce(
      Object.assign(new Error('Recipient must update their gender to proceed with this transfer'), {
        statusCode: 403,
        code: 'GENDER_UPDATE_REQUIRED',
      }),
    );

    const server = await buildServer();
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/tickets/transfer',
      headers: { authorization: 'Bearer test-token' },
      payload: { ticketId: 'ENT-TKT-1', recipientEmail: 'recipient@example.com' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      error: { code: 'GENDER_UPDATE_REQUIRED' },
    });
    await server.close();
  });

  it('POST /api/v1/tickets/transfer returns 403 GENDER_RESTRICTION when recipient gender does not match ticket requirement', async () => {
    vi.mocked(initiateGuestTransfer).mockRejectedValueOnce(
      Object.assign(new Error('This ticket is restricted to female attendees'), {
        statusCode: 403,
        code: 'GENDER_RESTRICTION',
      }),
    );

    const server = await buildServer();
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/tickets/transfer',
      headers: { authorization: 'Bearer test-token' },
      payload: { ticketId: 'ENT-TKT-1', recipientEmail: 'male@example.com' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      error: { code: 'GENDER_RESTRICTION' },
    });
    await server.close();
  });
});
