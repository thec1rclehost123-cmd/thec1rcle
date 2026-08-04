import { describe, expect, it } from 'vitest';
import { buildPromoterShareUrl, buildPromoterVanityPrefix } from './linkUrl';

describe('promoter link URL mapping', () => {
  it('maps a relative signed vanity prefix to the guest portal', () => {
    const link = {
      promoterHandle: 'qa_promoter',
      vanityPrefix: '/qa_promoter/',
      vanityAlias: 'e2e-20260729t203208z',
    };

    expect(buildPromoterVanityPrefix(link, 'http://localhost:3000')).toBe(
      'http://localhost:3000/qa_promoter/',
    );
    expect(buildPromoterShareUrl(link, 'http://localhost:3000')).toBe(
      'http://localhost:3000/qa_promoter/e2e-20260729t203208z',
    );
  });

  it('keeps the ref-based event URL when no vanity alias exists', () => {
    expect(
      buildPromoterShareUrl(
        {
          eventId: 'event-1',
          code: 'promo123',
          channel: 'organic',
        },
        'http://localhost:3000',
      ),
    ).toBe('http://localhost:3000/event/event-1?ref=promo123&s=organic');
  });
});
