import { describe, expect, it } from 'vitest';
import { buildHostEventUpdatePatch, buildHostTicketTierUpdate } from './event-update-policy.js';

const event = {
  title: 'Published Event',
  lifecycle: 'published',
  startDate: '2026-08-10T18:00:00.000Z',
  endDate: '2026-08-10T21:00:00.000Z',
  capacity: 100,
  ticketTiers: [
    {
      id: 'general',
      name: 'General',
      price: 500,
      quantity: 100,
      sold: 12,
      maxPurchaseQuantity: 6,
    },
  ],
};

describe('host event update policy', () => {
  it('allows published-event content edits without changing lifecycle', () => {
    expect(
      buildHostEventUpdatePatch(event, {
        title: 'Updated Event',
        description: 'Updated description',
        coverImage: 'https://storage.example/poster.webp',
        lifecycle: 'draft',
        creatorId: 'attacker',
      }),
    ).toMatchObject({
      title: 'Updated Event',
      description: 'Updated description',
      coverImage: 'https://storage.example/poster.webp',
      image: 'https://storage.example/poster.webp',
    });
    expect(buildHostEventUpdatePatch(event, { title: 'Updated Event' })).not.toHaveProperty(
      'lifecycle',
    );
  });

  it('rejects capacity below confirmed sales', () => {
    expect(() => buildHostEventUpdatePatch(event, { capacity: 10 })).toThrow(
      'Event update validation failed',
    );
  });

  it('updates one stable ticket tier and preserves sold inventory', () => {
    const [tier] = buildHostTicketTierUpdate(event, {
      tierId: 'general',
      name: 'General Admission',
      price: 600,
      quantity: 120,
      minPerOrder: 1,
      maxPerOrder: 6,
    });
    expect(tier).toMatchObject({
      id: 'general',
      name: 'General Admission',
      price: 600,
      quantity: 120,
      sold: 12,
      remaining: 108,
    });
  });

  it('rejects inventory reductions below sales and deletion of a sold tier', () => {
    expect(() =>
      buildHostTicketTierUpdate(event, {
        tierId: 'general',
        name: 'General',
        price: 500,
        quantity: 10,
        maxPerOrder: 6,
      }),
    ).toThrow('Ticket tier update validation failed');
    expect(() => buildHostTicketTierUpdate(event, { tiers: [] })).toThrow(
      'Sold ticket tiers cannot be deleted',
    );
  });
});
