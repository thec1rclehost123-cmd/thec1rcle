import { beforeEach, describe, expect, it, vi } from 'vitest';

const { terminateDueCoverWallets, processCoverExpiryRefundOutbox } = vi.hoisted(() => ({
  terminateDueCoverWallets: vi.fn(),
  processCoverExpiryRefundOutbox: vi.fn(),
}));

vi.mock('@c1rcle/core/cover-charge-engine', () => ({
  terminateDueCoverWallets,
}));
vi.mock('../../lib/coverExpiryRefund', () => ({
  processCoverExpiryRefundOutbox,
}));
vi.mock('@c1rcle/core/guest-chat-service', () => ({
  archiveExpiredEventChats: vi.fn(),
}));
vi.mock('@c1rcle/core/workflows/ticketing', () => ({
  retryPendingTicketPurchaseOutbox: vi.fn(),
}));

import cronRoutes from './cron';

function createReply() {
  return {
    statusCode: 200,
    payload: undefined as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload: any) {
      this.payload = payload;
      return payload;
    },
  };
}

describe('Cover expiry cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'qa-cron-secret';
    terminateDueCoverWallets.mockResolvedValue({
      dueWallets: 1,
      eventsProcessed: 1,
      terminated: 1,
      failed: 0,
      hasMore: false,
      results: [],
    });
    processCoverExpiryRefundOutbox.mockResolvedValue({
      processed: 1,
      succeeded: 1,
      skipped: 0,
      failed: 0,
      results: [],
    });
  });

  it('terminates due wallets before dispatching their deterministic refunds', async () => {
    const handlers = new Map<string, any>();
    const fastify: any = {
      db: { kind: 'firestore' },
      validate: () => async () => undefined,
      post(path: string, _options: any, handler: any) {
        handlers.set(path, handler);
      },
    };
    await cronRoutes(fastify);
    const reply = createReply();

    const response = await handlers.get('/cron/process-cover-expiry-refunds')(
      {
        body: { limit: 25 },
        headers: { 'x-cron-secret': 'qa-cron-secret' },
        id: 'request-1',
        log: { error: vi.fn() },
      },
      reply,
    );

    expect(reply.statusCode).toBe(200);
    expect(terminateDueCoverWallets).toHaveBeenCalledWith({
      db: fastify.db,
      limit: 25,
    });
    expect(processCoverExpiryRefundOutbox).toHaveBeenCalledWith(fastify, { limit: 25 });
    expect(terminateDueCoverWallets.mock.invocationCallOrder[0]).toBeLessThan(
      processCoverExpiryRefundOutbox.mock.invocationCallOrder[0],
    );
    expect(response).toMatchObject({
      success: true,
      data: {
        termination: { terminated: 1, failed: 0 },
        refunds: { processed: 1, succeeded: 1, failed: 0 },
      },
    });
  });
});
