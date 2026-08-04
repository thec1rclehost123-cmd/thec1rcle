import { describe, expect, it } from 'vitest';
import { buildEvent, deriveEventPricing } from './event-engine.js';

describe('event pricing', () => {
  it('derives the event price summary from authoritative ticket tiers', () => {
    expect(
      deriveEventPricing({
        priceRange: { min: 0, max: 0, currency: 'INR' },
        tickets: [
          { id: 'early-bird', price: 499 },
          { id: 'vip', price: 999 },
        ],
      }),
    ).toMatchObject({
      priceMin: 499,
      priceMax: 999,
      price: 499,
      startingPrice: 499,
      priceRange: { min: 499, max: 999, currency: 'INR' },
      isFree: false,
    });
  });

  it('preserves a mixed free and paid range without marking the event fully free', () => {
    expect(
      deriveEventPricing({
        tickets: [
          { id: 'guest-list', price: 0 },
          { id: 'vip', price: 999 },
        ],
      }),
    ).toMatchObject({
      priceMin: 0,
      priceMax: 999,
      isFree: false,
    });
  });

  it('persists tier-derived pricing when building an event', () => {
    const event = buildEvent({
      title: 'Launch Night',
      lifecycle: 'draft',
      tickets: [
        { id: 'early-bird', price: '499' },
        { id: 'vip', price: 999 },
      ],
    });

    expect(event).toMatchObject({
      priceMin: 499,
      priceMax: 999,
      price: 499,
      startingPrice: 499,
      priceRange: { min: 499, max: 999, currency: 'INR' },
      isFree: false,
    });
  });

  it('persists canonical UTC instants for an IST event', () => {
    const event = buildEvent({
      title: 'Launch Night',
      lifecycle: 'draft',
      startDate: '2026-08-29',
      endDate: '2026-08-29',
      startTime: '21:00',
      endTime: '23:30',
      timezone: 'Asia/Kolkata',
    });

    expect(event.startAt).toBe('2026-08-29T15:30:00.000Z');
    expect(event.endAt).toBe('2026-08-29T18:00:00.000Z');
  });

  it('persists the next-day end instant for an overnight event', () => {
    const event = buildEvent({
      title: 'After Hours',
      lifecycle: 'draft',
      startDate: '2026-08-29',
      endDate: '2026-08-29',
      startTime: '21:00',
      endTime: '04:00',
      timezone: 'Asia/Kolkata',
    });

    expect(event.startAt).toBe('2026-08-29T15:30:00.000Z');
    expect(event.endAt).toBe('2026-08-29T22:30:00.000Z');
  });
});
