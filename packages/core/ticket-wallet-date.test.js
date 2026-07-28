import { describe, expect, it } from 'vitest';
import { buildWalletEventSummary } from './ticket-checkout-wallet-service.js';

describe('ticket wallet event time projection', () => {
  it('combines legacy date and time into the authoritative event instant', () => {
    expect(
      buildWalletEventSummary({
        id: 'event_1',
        startDate: '2026-08-29',
        startTime: '21:00',
        timezone: 'Asia/Kolkata',
      }),
    ).toMatchObject({
      id: 'event_1',
      date: '2026-08-29T15:30:00.000Z',
      time: '21:00',
      timezone: 'Asia/Kolkata',
    });
  });

  it('preserves an existing canonical instant', () => {
    expect(
      buildWalletEventSummary({
        id: 'event_2',
        startAt: '2026-08-29T15:30:00.000Z',
        startTime: '21:00',
        timezone: 'Asia/Kolkata',
      }).date,
    ).toBe('2026-08-29T15:30:00.000Z');
  });
});
