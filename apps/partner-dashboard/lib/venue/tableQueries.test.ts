import { describe, expect, it } from 'vitest';
import { buildTonightEventUrl, calculateTableCapacity } from './tableQueries';

describe('Venue table queries', () => {
  it('requests only one event from the server-side today filter', () => {
    expect(buildTonightEventUrl('venue 1')).toBe(
      '/api/partners/venues/events?venueId=venue+1&date=today&limit=1',
    );
  });

  it('calculates capacity from the serialized table rows', () => {
    expect(calculateTableCapacity([{ capacity: 4 }, { capacity: '6' }, {}])).toBe(10);
  });
});
