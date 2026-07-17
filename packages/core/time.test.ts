import { describe, it, expect } from 'vitest';
import { parseAsIST, formatIST, toISODateIST, getEventTimestamps } from './time.js';

describe('Time Utilities (IST)', () => {
  describe('parseAsIST', () => {
    it('should parse YYYY-MM-DD as IST morning', () => {
      const date = parseAsIST('2024-01-01');
      // 2024-01-01T00:00:00+05:30 -> UTC is 2023-12-31 18:30:00
      expect(date.getUTCFullYear()).toBe(2023);
      expect(date.getUTCMonth()).toBe(11); // December
      expect(date.getUTCDate()).toBe(31);
    });

    it('should handle Firestore-like toDate object', () => {
      const mockTs = { toDate: () => new Date('2024-01-01T12:00:00Z') };
      const date = parseAsIST(mockTs);
      expect(date.toISOString()).toBe('2024-01-01T12:00:00.000Z');
    });
  });

  describe('formatIST', () => {
    it('should format date to IST string', () => {
      const date = new Date('2024-01-01T12:00:00Z');
      const formatted = formatIST(date);
      // 12:00 UTC = 17:30 IST
      expect(formatted).toContain('1/1/2024');
      expect(formatted).toContain('5:30:00 pm');
    });
  });

  describe('toISODateIST', () => {
    it('should return YYYY-MM-DD in IST', () => {
      // Late night UTC (e.g. 11 PM) is next day IST
      const date = new Date('2023-12-31T22:00:00Z');
      const iso = toISODateIST(date);
      expect(iso).toBe('2024-01-01');
    });
  });

  describe('getEventTimestamps', () => {
    it('should handle date-only event without start/end times', () => {
      const event = { startDate: '2026-07-07', endDate: '2026-07-07' };
      const { startAt, endAt } = getEventTimestamps(event);
      expect(new Date(startAt).toISOString()).toBe(
        new Date('2026-07-07T00:00:00+05:30').toISOString(),
      );
      expect(new Date(endAt).toISOString()).toBe(
        new Date('2026-07-07T23:59:59.999+05:30').toISOString(),
      );
    });

    it('should handle single-day event with start and end times', () => {
      const event = {
        startDate: '2026-07-07',
        endDate: '2026-07-07',
        startTime: '18:00',
        endTime: '23:30',
      };
      const { startAt, endAt } = getEventTimestamps(event);
      expect(new Date(startAt).toISOString()).toBe(
        new Date('2026-07-07T18:00:00+05:30').toISOString(),
      );
      expect(new Date(endAt).toISOString()).toBe(
        new Date('2026-07-07T23:30:00+05:30').toISOString(),
      );
    });

    it('should handle overnight event (end time numerically less than start time) by adding 1 day to end date', () => {
      const event = {
        startDate: '2026-07-07',
        endDate: '2026-07-07',
        startTime: '21:00',
        endTime: '03:30',
      };
      const { startAt, endAt } = getEventTimestamps(event);
      expect(new Date(startAt).toISOString()).toBe(
        new Date('2026-07-07T21:00:00+05:30').toISOString(),
      );
      expect(new Date(endAt).toISOString()).toBe(
        new Date('2026-07-08T03:30:00+05:30').toISOString(),
      );
    });

    it('should parse ISO strings or Date objects directly without modification', () => {
      const event = {
        startAt: '2026-07-07T12:00:00.000Z',
        endAt: '2026-07-07T18:00:00.000Z',
      };
      const { startAt, endAt } = getEventTimestamps(event);
      expect(startAt).toBe(new Date('2026-07-07T12:00:00.000Z').getTime());
      expect(endAt).toBe(new Date('2026-07-07T18:00:00.000Z').getTime());
    });
  });
});
