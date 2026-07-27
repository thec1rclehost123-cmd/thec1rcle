import { describe, expect, it } from 'vitest';
import { isBlockingCalendarEvent } from './calendar-visibility.js';

describe('isBlockingCalendarEvent', () => {
  it.each(['draft', 'deleted', 'cancelled', 'denied'])(
    'does not reserve venue time for %s events',
    (lifecycle) => {
      expect(isBlockingCalendarEvent({ lifecycle })).toBe(false);
    },
  );

  it('treats missing lifecycle data as a non-blocking draft', () => {
    expect(isBlockingCalendarEvent({})).toBe(false);
  });

  it.each(['submitted', 'approved', 'scheduled', 'published', 'live'])(
    'keeps %s events on the operating calendar',
    (lifecycle) => {
      expect(isBlockingCalendarEvent({ lifecycle })).toBe(true);
    },
  );

  it('uses legacy status only when lifecycle is absent', () => {
    expect(isBlockingCalendarEvent({ status: 'published' })).toBe(true);
    expect(isBlockingCalendarEvent({ lifecycle: 'draft', status: 'published' })).toBe(false);
  });
});
