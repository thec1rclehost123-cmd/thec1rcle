import { describe, expect, it } from 'vitest';
import {
  CheckoutReconciliationError,
  assertCheckoutSnapshotCurrent,
  buildCheckoutSnapshot,
} from './checkout-reconciliation.js';

const now = new Date('2026-07-18T12:00:00.000Z');

function event(overrides: Record<string, any> = {}) {
  return {
    id: 'event_1',
    currency: 'INR',
    lifecycle: 'scheduled',
    startDate: '2026-07-20T20:00:00.000Z',
    endDate: '2026-07-21T01:00:00.000Z',
    tickets: [
      {
        id: 'ga',
        name: 'General Admission',
        price: 499.5,
        remaining: 20,
        salesStart: '2026-07-01T00:00:00.000Z',
        salesEnd: '2026-07-20T19:00:00.000Z',
      },
    ],
    ...overrides,
  };
}

const items = [{ tierId: 'ga', quantity: 2 }];

describe('checkout reconciliation snapshot', () => {
  it('accepts an unchanged canonical cart and stores exact paise', () => {
    const snapshot = buildCheckoutSnapshot(event(), items, now);

    expect(snapshot.items[0]).toMatchObject({
      tierId: 'ga',
      quantity: 2,
      unitPricePaise: 49_950,
    });
    expect(assertCheckoutSnapshotCurrent(snapshot, event(), items, now)).toMatchObject({
      eventId: 'event_1',
    });
  });

  it('rejects a canonical price change instead of silently repricing', () => {
    const snapshot = buildCheckoutSnapshot(event(), items, now);
    const changed = event({ tickets: [{ ...event().tickets[0], price: 500 }] });

    expect(() => assertCheckoutSnapshotCurrent(snapshot, changed, items, now)).toThrowError(
      CheckoutReconciliationError,
    );
    expect(() => assertCheckoutSnapshotCurrent(snapshot, changed, items, now)).toThrow(
      /cart changed/i,
    );
  });

  it.each([
    ['event start', { startDate: '2026-07-20T21:00:00.000Z' }],
    ['event end', { endDate: '2026-07-21T02:00:00.000Z' }],
    [
      'tier sale window',
      { tickets: [{ ...event().tickets[0], salesEnd: '2026-07-20T18:00:00.000Z' }] },
    ],
  ])('rejects %s drift', (_label, overrides) => {
    const snapshot = buildCheckoutSnapshot(event(), items, now);
    expect(() => assertCheckoutSnapshotCurrent(snapshot, event(overrides), items, now)).toThrowError(
      CheckoutReconciliationError,
    );
  });

  it('rejects a tier that becomes hidden', () => {
    const snapshot = buildCheckoutSnapshot(event(), items, now);
    const changed = event({ tickets: [{ ...event().tickets[0], status: 'hidden' }] });

    expect(() => assertCheckoutSnapshotCurrent(snapshot, changed, items, now)).toThrow(
      /no longer available/i,
    );
  });

  it('rejects event and tier purchase-policy drift', () => {
    const snapshot = buildCheckoutSnapshot(event(), items, now);
    const changed = event({
      maxTicketsPerOrder: 1,
      tickets: [{ ...event().tickets[0], maxPerOrder: 1 }],
    });

    expect(() => assertCheckoutSnapshotCurrent(snapshot, changed, items, now)).toThrowError(
      CheckoutReconciliationError,
    );
  });

  it('rejects an absent legacy reservation snapshot', () => {
    expect(() => assertCheckoutSnapshotCurrent(undefined, event(), items, now)).toThrowError(
      expect.objectContaining({ code: 'STALE_CART', statusCode: 409 }),
    );
  });

  it('rejects a scheduled-price rollover inside the reservation window', () => {
    const scheduledEvent = event({
      tickets: [
        {
          ...event().tickets[0],
          price: 600,
          scheduledPrices: [
            {
              startsAt: '2026-07-18T11:00:00.000Z',
              endsAt: '2026-07-18T12:00:30.000Z',
              price: 450,
            },
          ],
        },
      ],
    });
    const snapshot = buildCheckoutSnapshot(scheduledEvent, items, now);

    expect(() =>
      assertCheckoutSnapshotCurrent(
        snapshot,
        scheduledEvent,
        items,
        new Date('2026-07-18T12:01:00.000Z'),
      ),
    ).toThrowError(CheckoutReconciliationError);
  });

  it('rejects fractional paise rather than rounding the provider amount', () => {
    const invalid = event({ tickets: [{ ...event().tickets[0], price: 10.001 }] });
    expect(() => buildCheckoutSnapshot(invalid, items, now)).toThrow(/price is invalid/i);
  });

  it('normalizes Firestore timestamp-like values before comparison', () => {
    const timestampLike = {
      toDate: () => new Date('2026-07-20T20:00:00.000Z'),
    };
    const canonical = event({ startDate: timestampLike });
    const snapshot = buildCheckoutSnapshot(canonical, items, now);

    expect(snapshot.eventStartAt).toBe('2026-07-20T20:00:00.000Z');
  });
});
