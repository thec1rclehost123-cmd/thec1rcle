import { describe, it, expect, vi } from 'vitest';
import { validatePurchase } from './inventory-engine.js';

// Mock Redis to avoid connection errors during logic tests
vi.mock('./redis.js', () => ({
  getRedisClient: () => null,
}));

describe('Inventory Engine', () => {
  describe('validatePurchase', () => {
    const mockEvent = {
      id: 'event-1',
      tickets: [
        {
          id: 'tier-1',
          name: 'Early Bird',
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
  });
});
