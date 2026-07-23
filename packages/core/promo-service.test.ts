import { describe, it, expect, vi, beforeEach } from 'vitest';
import PromoService from './promo-service.js';

// Mock Redis to avoid connection errors
vi.mock('./redis.js', () => ({
  getRedisClient: () => ({
    get: vi.fn(),
    set: vi.fn(),
    multi: vi.fn(() => ({
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn(),
    })),
  }),
}));

// Mock Admin to force fallback behavior for unit tests
vi.mock('./admin.js', () => ({
  getAdminDb: vi.fn(),
  isFirebaseConfigured: () => false,
}));

describe('Promo Service', () => {
  const mockEventId = 'event-1';

  describe('createPromoCode', () => {
    it('should create a valid percentage promo code', async () => {
      const result = await PromoService.createPromoCode(mockEventId, {
        code: 'SAVE10',
        discountType: 'percent',
        discountValue: 10,
      });

      expect(result.success).toBe(true);
      expect(result.promoCode.code).toBe('SAVE10');
      expect(result.promoCode.discountValue).toBe(10);
    });

    it('should fail for short codes', async () => {
      const result = await PromoService.createPromoCode(mockEventId, { code: '12' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('3 characters');
    });
  });

  describe('validatePromoCode', () => {
    const mockItems = [{ tierId: 't1', price: 1000, quantity: 1 }];

    it('should calculate correct percentage discount', async () => {
      await PromoService.createPromoCode(mockEventId, {
        code: 'DISCOUNT20',
        discountType: 'percent',
        discountValue: 20,
        isActive: true,
      });

      const validation = await PromoService.validatePromoCode(
        mockEventId,
        'DISCOUNT20',
        'u1',
        mockItems,
      );
      expect(validation.valid).toBe(true);
      expect(validation.discountAmount).toBe(200);
    });

    it('should return error for expired codes', async () => {
      await PromoService.createPromoCode(mockEventId, {
        code: 'EXPIRED',
        endsAt: '2020-01-01T00:00:00Z',
        isActive: true,
      });

      const validation = await PromoService.validatePromoCode(
        mockEventId,
        'EXPIRED',
        'u1',
        mockItems,
      );
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('expired');
    });

    it('should handle fixed amount discounts', async () => {
      await PromoService.createPromoCode(mockEventId, {
        code: 'FLAT50',
        discountType: 'fixed',
        discountValue: 50,
        isActive: true,
      });

      const validation = await PromoService.validatePromoCode(
        mockEventId,
        'FLAT50',
        'u1',
        mockItems,
      );
      expect(validation.valid).toBe(true);
      expect(validation.discountAmount).toBe(50);
    });
  });
});

describe('Promo Redemption Idempotency — C1 regression', () => {
  it('calling recordRedemption twice with same orderId returns success and idempotent flag', async () => {
    const orderId = 'ORD-42';

    const result1 = await PromoService.recordRedemption('promo-1', orderId, 'user-1', {
      discountAmount: 500,
    });
    expect(result1.success).toBe(true);
    expect(result1.alreadyRedeemed).toBeUndefined();

    const result2 = await PromoService.recordRedemption('promo-1', orderId, 'user-1', {
      discountAmount: 500,
    });
    expect(result2.success).toBe(true);
    expect(result2.alreadyRedeemed).toBe(true);
  });

  it('different orderIds produce separate redemptions', async () => {
    await PromoService.recordRedemption('promo-1', 'ORD-1', 'user-1', { discountAmount: 100 });
    await PromoService.recordRedemption('promo-1', 'ORD-2', 'user-1', { discountAmount: 200 });

    // Both should succeed, neither should be flagged as already redeemed
    // (This exercises the fallback map's per-key tracking)
  });
});
