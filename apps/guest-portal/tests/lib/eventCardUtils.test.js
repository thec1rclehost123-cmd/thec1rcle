import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatEventTime,
  getEventHref,
  getGuestInitials,
  getGuestList,
} from '../../lib/eventCardUtils.js';

test('getGuestList normalizes mixed guest payloads and applies the limit', () => {
  const guests = getGuestList(
    {
      guests: ['Aarav', { name: 'Mira Kapoor' }, { handle: 'neon.nights' }, null, {}],
    },
    3,
  );

  assert.deepEqual(guests, ['Aarav', 'Mira Kapoor', 'neon.nights']);
});

test('getGuestList returns an empty list when event guests are empty', () => {
  assert.deepEqual(getGuestList({ guests: [] }), []);
});

test('getGuestInitials handles missing, blank, and multi-word names', () => {
  assert.equal(getGuestInitials(), 'GL');
  assert.equal(getGuestInitials('   '), 'GL');
  assert.equal(getGuestInitials('Ada Lovelace'), 'AL');
  assert.equal(getGuestInitials('Prince'), 'P');
});

test('formatEventTime prefers a preformatted time and formats ISO timestamps when needed', () => {
  assert.equal(formatEventTime({ time: 'Doors 9 PM' }), 'Doors 9 PM');
  assert.equal(formatEventTime({ startDateTime: '2026-06-01T14:30:00Z' }), '8:00 pm');
  assert.equal(formatEventTime({ startDateTime: 'not-a-date' }), '');
  assert.equal(formatEventTime({}), '');
});

test('getEventHref prefers slug, then id, then handle, and finally the fallback route', () => {
  assert.equal(getEventHref({ slug: 'summer-social' }), '/event/summer-social');
  assert.equal(getEventHref({ id: 'evt_123' }), '/event/evt_123');
  assert.equal(getEventHref({ handle: 'late-night-set' }), '/event/late-night-set');
  assert.equal(getEventHref({}), '/event');
});
