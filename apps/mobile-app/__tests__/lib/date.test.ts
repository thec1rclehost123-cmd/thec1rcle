import {
  DEFAULT_EVENT_TIME_ZONE,
  formatEventDate,
  formatEventDateLong,
  formatEventTime,
  safeDate,
} from '@/lib/utils/date';

describe('event date formatting', () => {
  const bollywoodNight = '2026-08-02T20:00:00.000Z';

  it('renders event timestamps in the India event timezone, not the device timezone', () => {
    expect(DEFAULT_EVENT_TIME_ZONE).toBe('Asia/Kolkata');
    expect(formatEventDate(bollywoodNight)).toBe('Mon, 3 Aug');
    expect(formatEventDateLong(bollywoodNight)).toBe('Monday, 3 August');
    expect(formatEventTime(bollywoodNight)).toBe('1:30 am');
  });

  it('honors an explicit venue timezone', () => {
    expect(formatEventDate(bollywoodNight, 'Asia/Dubai')).toBe('Mon, 3 Aug');
    expect(formatEventTime(bollywoodNight, 'Asia/Dubai')).toBe('12:00 am');
  });

  it('fails safely for invalid dates and invalid timezone identifiers', () => {
    expect(safeDate('not-a-date')).toBeNull();
    expect(formatEventDate('not-a-date')).toBe('TBD');
    expect(formatEventTime(bollywoodNight, 'not/a-timezone')).toBe('1:30 am');
  });
});
