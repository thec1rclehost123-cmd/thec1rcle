import { describe, expect, it } from 'vitest';
import {
  buildHostVenueCalendarUrl,
  getHostVenueCalendarDays,
  hostVenueDayStatus,
  nightlifeTimeRangesOverlap,
} from './venueCalendar';

describe('Host venue calendar contract', () => {
  it('builds the single canonical Host calendar endpoint', () => {
    expect(
      buildHostVenueCalendarUrl({
        venueId: 'venue/one',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      }),
    ).toBe(
      '/api/partners/hosts/venue-calendar?venueId=venue%2Fone&startDate=2026-08-01&endDate=2026-08-31&view=operating',
    );
  });

  it('normalizes both canonical response envelopes without extra requests', () => {
    const days = [{ date: '2026-08-01', state: 'OPEN', slots: [] }];
    expect(getHostVenueCalendarDays({ calendar: days })).toBe(days);
    expect(getHostVenueCalendarDays({ days })).toBe(days);
    expect(getHostVenueCalendarDays(null)).toEqual([]);
  });

  it('detects overnight conflicts using nightlife-day semantics', () => {
    expect(nightlifeTimeRangesOverlap('21:00', '03:00', '01:00', '02:00')).toBe(true);
    expect(nightlifeTimeRangesOverlap('21:00', '23:00', '01:00', '02:00')).toBe(false);
  });

  it('maps canonical day state to fail-closed preview status', () => {
    expect(hostVenueDayStatus({ state: 'BLOCKED' })).toBe('blocked');
    expect(hostVenueDayStatus({ state: 'CONFIRMED' })).toBe('booked');
    expect(hostVenueDayStatus({ state: 'OPEN', slots: [{ status: 'pending' }] })).toBe('partial');
    expect(hostVenueDayStatus({ state: 'OPEN', slots: [] })).toBe('available');
  });
});
