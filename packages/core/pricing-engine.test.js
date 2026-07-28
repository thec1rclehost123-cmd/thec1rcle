import { describe, it, expect } from 'vitest';
import { getEffectivePrice, calculateFees, calculatePricing } from './pricing-engine.js';

describe('Pricing Engine', () => {
  describe('getEffectivePrice', () => {
    it('should return base price when no schedules exist', () => {
      const tier = { basePrice: 500, name: 'Normal' };
      const result = getEffectivePrice(tier);
      expect(result.price).toBe(500);
      expect(result.isScheduled).toBe(false);
    });

    it('should return scheduled price if within time range', () => {
      const now = new Date('2024-01-01T12:00:00Z');
      const tier = {
        basePrice: 1000,
        scheduledPrices: [
          {
            startsAt: '2024-01-01T00:00:00Z',
            endsAt: '2024-01-01T23:59:59Z',
            price: 500,
            name: 'Early Bird',
          },
        ],
      };
      const result = getEffectivePrice(tier, now);
      expect(result.price).toBe(500);
      expect(result.isScheduled).toBe(true);
      expect(result.label).toBe('Early Bird');
    });

    it('should fall back to base price if schedule expired', () => {
      const now = new Date('2024-01-02T00:00:00Z');
      const tier = {
        basePrice: 1000,
        scheduledPrices: [
          {
            startsAt: '2024-01-01T00:00:00Z',
            endsAt: '2024-01-01T23:59:59Z',
            price: 500,
            name: 'Early Bird',
          },
        ],
      };
      const result = getEffectivePrice(tier, now);
      expect(result.price).toBe(1000);
      expect(result.isScheduled).toBe(false);
    });
  });

  describe('calculateFees', () => {
    it('should calculate correct platform and payment fees', () => {
      const amount = 100;
      const fees = calculateFees(amount);

      // 5% platform = 5
      // 2.5% payment = 2.5
      // 18% GST on (5 + 2.5) = 1.35
      // Total = 5 + 2.5 + 1.35 = 8.85

      expect(fees.platform).toBe(5);
      expect(fees.payment).toBe(2.5);
      expect(fees.gst).toBe(1.35);
      expect(fees.total).toBe(8.85);
    });

    it('should return zero for zero or negative subtotal', () => {
      expect(calculateFees(0).total).toBe(0);
      expect(calculateFees(-10).total).toBe(0);
    });
  });

  describe('calculatePricing', () => {
    it('should calculate complete pricing for items', async () => {
      const event = {
        id: 'event-1',
        ticketCatalog: {
          tiers: [{ id: 'tier-1', name: 'General', basePrice: 100 }],
        },
      };
      const items = [{ tierId: 'tier-1', quantity: 2 }];

      const result = await calculatePricing({ event, items });

      expect(result.success).toBe(true);
      expect(result.pricing.subtotal).toBe(200);
      expect(result.pricing.grandTotal).toBe(217.7); // 200 + fees(17.7)
    });

    it('persists an exactly funded integer-paise Cover Wallet liability', async () => {
      const event = {
        id: 'cover-event',
        ticketCatalog: {
          tiers: [
            {
              id: 'cover-tier',
              name: 'Cover Package',
              basePrice: 999,
              coverChargeConfig: { enabled: true, walletAmountPaise: 50_000 },
            },
          ],
        },
      };

      const result = await calculatePricing({
        event,
        items: [{ tierId: 'cover-tier', quantity: 2 }],
      });

      expect(result.pricing.coverCreditLiabilityPaise).toBe(100_000);
      expect(result.pricing.items[0].coverCreditPaise).toBe(50_000);
    });

    it('rejects a Cover Wallet credit larger than the effective ticket price', async () => {
      const event = {
        id: 'unfunded-cover-event',
        ticketCatalog: {
          tiers: [
            {
              id: 'cover-tier',
              name: 'Underfunded Cover Package',
              basePrice: 499,
              coverChargeConfig: { enabled: true, walletAmountPaise: 50_000 },
            },
          ],
        },
      };

      await expect(
        calculatePricing({
          event,
          items: [{ tierId: 'cover-tier', quantity: 1 }],
        }),
      ).rejects.toMatchObject({ code: 'COVER_WALLET_UNFUNDED' });
    });

    it('rejects discounts that would make Cover Wallet credit underfunded', async () => {
      const event = {
        id: 'discounted-cover-event',
        ticketCatalog: {
          tiers: [
            {
              id: 'cover-tier',
              name: 'Cover Package',
              basePrice: 600,
              coverChargeConfig: { enabled: true, walletAmountPaise: 50_000 },
            },
          ],
        },
      };

      await expect(
        calculatePricing({
          event,
          items: [{ tierId: 'cover-tier', quantity: 1 }],
          promoCode: 'TOO_LARGE',
          promoValidator: async () => ({
            valid: true,
            discountAmount: 150,
            promoCode: { id: 'promo-1' },
          }),
        }),
      ).rejects.toMatchObject({ code: 'COVER_WALLET_UNFUNDED' });
    });
  });
});
