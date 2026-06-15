import { describe, expect, it } from 'vitest';
import {
  buildPayoutAccountRecord,
  normalizePromoterCommissionRate,
  sanitizeEventResubmissionPatch,
} from './partner-hardening.js';

describe('partner hardening helpers', () => {
  it('strips unsafe event resubmission fields', () => {
    const sanitized = sanitizeEventResubmissionPatch({
      title: 'Updated Title',
      description: 'Updated description',
      lifecycle: 'approved',
      platformFeeRate: 0,
      ownerPartnerId: 'host_b',
    });

    expect(sanitized).toEqual({
      title: 'Updated Title',
      description: 'Updated description',
    });
  });

  it('normalizes promoter commission rates to approved tiers', () => {
    expect(normalizePromoterCommissionRate(undefined)).toBe(10);
    expect(normalizePromoterCommissionRate(17)).toBe(15);
    expect(normalizePromoterCommissionRate(100)).toBe(20);
  });

  it('builds payout account records without storing raw account numbers', () => {
    const account = buildPayoutAccountRecord(
      {
        accountNumber: '123456789012',
        bankName: 'HDFC',
        accountHolderName: 'Test User',
        ifscCode: 'HDFC0001234',
        isDefault: true,
      },
      {
        partnerId: 'venue_123',
        ownerType: 'venue',
      },
    );

    expect(account.last4).toBe('9012');
    expect(account.record).toMatchObject({
      partnerId: 'venue_123',
      ownerId: 'venue_123',
      ownerType: 'venue',
      bankName: 'HDFC',
      last4: '9012',
      isDefault: true,
    });
    expect(account.record).not.toHaveProperty('accountNumber');
  });
});
