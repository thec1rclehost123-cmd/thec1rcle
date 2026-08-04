import { describe, expect, it } from 'vitest';
import { MockFirestore } from '../../test-utils/mock-firestore.js';
import { PromoterService } from './promoter-service.js';

describe('PromoterService index-independent stats', () => {
  it('normalizes link metrics and canonical commission paise without composite queries', async () => {
    const db = new MockFirestore();
    db.seed('promoter_links/link_1', {
      promoterId: 'promoter_1',
      active: true,
      clickCount: 20,
      conversionCount: 4,
      revenue: 500,
      createdAt: '2026-07-27T10:00:00.000Z',
    });
    db.seed('promoter_links/link_2', {
      promoterId: 'promoter_1',
      active: true,
      clicks: 30,
      conversions: 6,
      attributedRevenue: 700,
      createdAt: '2026-07-28T10:00:00.000Z',
    });
    db.seed('partner_ledger/commission_1', {
      toPartnerId: 'promoter_1',
      type: 'promoter_commission',
      status: 'settled',
      amountPaise: 12500,
    });
    db.seed('partner_ledger/commission_reversed', {
      toPartnerId: 'promoter_1',
      type: 'promoter_commission',
      status: 'reversed',
      amountPaise: -5000,
    });
    const service = new PromoterService({
      db: db as any,
      log: {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
      redis: undefined,
    } as any);

    const overview = await service.getOverview({
      partnerId: 'promoter_1',
      uid: 'promoter_owner',
      type: 'promoter',
      roles: [],
      venueIds: [],
      displayName: 'QA Promoter',
    });

    expect(overview.stats).toEqual({
      totalLinks: 2,
      totalClicks: 50,
      totalConversions: 10,
      totalRevenue: 1200,
      totalCommissionEarned: 125,
      conversionRate: 0.2,
    });
    expect(overview.topLinks.map((link) => link.linkId)).toEqual(['link_2', 'link_1']);
    expect(db.getDoc('promoter_stats/promoter_1')).toMatchObject({
      totalCommissionEarned: 125,
    });
  });
});
