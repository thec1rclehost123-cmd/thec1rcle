import { describe, it, expect, vi } from 'vitest';
import { listAvailableTicketTiers, validatePurchase } from './inventory-engine.js';

// Mock Redis to avoid connection errors during logic tests
vi.mock('./redis.js', () => ({
  getRedisClient: () => null,
}));

describe('Inventory Engine', () => {
  describe('listAvailableTicketTiers', () => {
    function buildDb(event) {
      return {
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            get: vi.fn(async () => ({
              exists: Boolean(event),
              id: event?.id || 'event-1',
              data: () => event,
            })),
          })),
        })),
      };
    }

    it('returns guest-safe tiers with scheduled prices and effective remaining inventory', async () => {
      const result = await listAvailableTicketTiers(
        buildDb({
          id: 'event-1',
          lifecycle: 'scheduled',
          visibility: 'public',
          currency: 'INR',
          tickets: [
            {
              id: 'ga',
              name: 'General Admission',
              price: 1500,
              quantity: 100,
              sold: 25,
              salesStart: '2026-06-01T00:00:00.000Z',
              salesEnd: '2026-06-30T23:59:59.000Z',
              scheduledPrices: [
                {
                  name: 'Early access',
                  price: 1200,
                  startsAt: '2026-06-10T00:00:00.000Z',
                  endsAt: '2026-06-20T00:00:00.000Z',
                },
              ],
            },
            {
              id: 'vip',
              name: 'VIP',
              price: 5000,
              inventory: { totalQuantity: 20, soldQuantity: 5 },
              salesStart: '2026-06-01T00:00:00.000Z',
              salesEnd: '2026-06-30T23:59:59.000Z',
            },
          ],
        }),
        'event-1',
        { timestamp: new Date('2026-06-17T12:00:00.000Z') },
      );

      expect(result).toMatchObject({
        eventId: 'event-1',
        currency: 'INR',
        availableCount: 2,
        hasAvailableTickets: true,
        tiers: [
          {
            tierId: 'ga',
            name: 'General Admission',
            price: 1200,
            priceLabel: 'Early access',
            isScheduledPrice: true,
            remaining: 75,
            isAvailable: true,
          },
          {
            tierId: 'vip',
            name: 'VIP',
            price: 5000,
            remaining: 15,
            isAvailable: true,
          },
        ],
      });
    });

    it('does not expose private events', async () => {
      const result = await listAvailableTicketTiers(
        buildDb({
          id: 'private-event',
          lifecycle: 'scheduled',
          visibility: 'private',
          tickets: [{ id: 'ga', price: 1500, quantity: 10 }],
        }),
        'private-event',
      );

      expect(result).toBeNull();
    });
  });

  describe('validatePurchase', () => {
    const mockEvent = {
      id: 'event-1',
      tickets: [
        {
          id: 'tier-1',
          name: 'Early Bird',
          price: 100,
          quantity: 10,
          sold: 0,
          inventory: { totalQuantity: 10, soldQuantity: 0 },
          saleWindow: {
            startsAt: '2024-01-01T00:00:00Z',
            endsAt: '2024-01-31T23:59:59Z',
          },
        },
      ],
    };

    it('should validate successful purchase within window', async () => {
      const items = [{ tierId: 'tier-1', quantity: 2 }];
      const now = new Date('2024-01-15T00:00:00Z');

      const result = await validatePurchase(mockEvent, items, { timestamp: now });
      expect(result.success).toBe(true);
    });

    it("should fail if sales haven't started", async () => {
      const items = [{ tierId: 'tier-1', quantity: 1 }];
      const before = new Date('2023-12-31T23:59:59Z');

      const result = await validatePurchase(mockEvent, items, { timestamp: before });
      expect(result.success).toBe(false);
      expect(result.items[0].error).toContain("haven't started");
    });

    it('should fail if sales have ended', async () => {
      const items = [{ tierId: 'tier-1', quantity: 1 }];
      const after = new Date('2024-02-01T00:00:00Z');

      const result = await validatePurchase(mockEvent, items, { timestamp: after });
      expect(result.success).toBe(false);
      expect(result.items[0].error).toContain('have ended');
    });

    it('should fail if quantity exceeds availability', async () => {
      const items = [{ tierId: 'tier-1', quantity: 15 }];
      const now = new Date('2024-01-15T00:00:00Z');

      const result = await validatePurchase(mockEvent, items, { timestamp: now });
      expect(result.success).toBe(false);
      expect(result.items[0].error).toContain('left');
    });

    it('defaults zero-priced tiers to one ticket per order', async () => {
      const freeEvent = {
        ...mockEvent,
        tickets: [
          {
            ...mockEvent.tickets[0],
            id: 'free-ga',
            price: 0,
          },
        ],
      };

      const result = await validatePurchase(freeEvent, [{ tierId: 'free-ga', quantity: 2 }], {
        timestamp: new Date('2024-01-15T00:00:00Z'),
      });

      expect(result.success).toBe(false);
      expect(result.items[0]).toMatchObject({
        tierId: 'free-ga',
        error: 'Max 1 per order',
      });
    });
  });
});
