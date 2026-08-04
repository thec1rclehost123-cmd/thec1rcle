import { buildVenueFeed } from '@/lib/venueFeed';

describe('venue feed spotlight handling', () => {
  const venues = [{ id: 'nowl' }, { id: 'ritz' }];

  it('removes the spotlight only while its hero is visible', () => {
    expect(buildVenueFeed(venues, 'nowl', true)).toEqual([{ id: 'ritz' }]);
  });

  it('keeps a matching spotlight venue when search or filters hide the hero', () => {
    expect(buildVenueFeed([{ id: 'nowl' }], 'nowl', false)).toEqual([{ id: 'nowl' }]);
  });
});
