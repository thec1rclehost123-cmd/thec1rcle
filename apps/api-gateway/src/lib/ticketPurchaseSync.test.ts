import { describe, expect, it, vi } from 'vitest';
import { publishTicketPurchaseSync } from './ticketPurchaseSync.js';

describe('publishTicketPurchaseSync', () => {
  it('invalidates partner analytics after a confirmed ticket purchase', async () => {
    const invalidateNamespace = vi.fn().mockResolvedValue(undefined);
    const fastify = {
      cache: {
        delete: vi.fn().mockResolvedValue(undefined),
        invalidateNamespace,
      },
      redis: { del: vi.fn().mockResolvedValue(undefined) },
      invalidatePublicDiscovery: vi.fn().mockResolvedValue(undefined),
      broadcast: vi.fn(),
    } as any;

    await publishTicketPurchaseSync(fastify, {
      orderId: 'order-1',
      ticketIds: ['ticket-1'],
      order: {
        eventId: 'event-1',
        venueId: 'venue-1',
        hostId: 'host-1',
      },
    });

    expect(invalidateNamespace).toHaveBeenCalledWith('partner-analytics');
    expect(invalidateNamespace).toHaveBeenCalledWith('partner-finance-ledger');
    expect(invalidateNamespace).toHaveBeenCalledWith('promoter-analytics');
    expect(invalidateNamespace).toHaveBeenCalledWith('promoter-links');
    expect(invalidateNamespace).toHaveBeenCalledWith('partners');
  });
});
