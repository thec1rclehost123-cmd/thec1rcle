import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// @ts-ignore - JavaScript runtime module
import {
  buildPromoterAttributionPayload,
  signPromoterAttribution,
  verifyPromoterAttribution,
} from './promoter-attribution.js';

const terms = {
  assignmentId: 'promoter_1_event_1',
  assignmentVersion: 2,
  termsVersion: 7,
  promoterId: 'promoter_1',
  eventId: 'event_1',
  commissionRate: 12.5,
  commissionType: 'percentage',
  ticketTierIds: ['vip', 'ga'],
  tierCommissions: {
    vip: { rate: 500, type: 'fixed' },
    ga: { rate: 10, type: 'percentage' },
  },
};

describe('signed promoter attribution', () => {
  const originalSecret = process.env.PROMOTER_ATTRIBUTION_SECRET;

  beforeEach(() => {
    process.env.PROMOTER_ATTRIBUTION_SECRET = 'test-secret-that-is-longer-than-thirty-two-characters';
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.PROMOTER_ATTRIBUTION_SECRET;
    else process.env.PROMOTER_ATTRIBUTION_SECRET = originalSecret;
  });

  it('signs the canonical assignment terms and verifies the exact snapshot', () => {
    const signature = signPromoterAttribution(terms);
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyPromoterAttribution(terms, signature)).toBe(true);
  });

  it('rejects a one-paise-equivalent commission manipulation', () => {
    const signature = signPromoterAttribution(terms);
    expect(
      verifyPromoterAttribution({ ...terms, commissionRate: terms.commissionRate + 0.01 }, signature),
    ).toBe(false);
  });

  it('canonicalizes tier ordering without changing the signature payload', () => {
    const reordered = {
      ...terms,
      ticketTierIds: ['ga', 'vip'],
      tierCommissions: {
        ga: { rate: 10, type: 'percentage' },
        vip: { rate: 500, type: 'fixed' },
      },
    };
    expect(buildPromoterAttributionPayload(reordered)).toBe(
      buildPromoterAttributionPayload(terms),
    );
  });
});
