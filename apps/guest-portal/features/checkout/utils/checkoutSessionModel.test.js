import test from 'node:test';
import assert from 'node:assert/strict';

import { isPendingOrderSnapshotCurrent } from './checkoutSessionModel.js';

const currentSnapshot = {
  eventId: 'event-1',
  orderId: 'order-1',
  savedAt: Date.now(),
  ticketSignature: '[{"tierId":"free","quantity":1}]',
  userId: 'user-1',
};

test('pending checkout recovery is scoped to the exact cart', () => {
  assert.equal(
    isPendingOrderSnapshotCurrent({
      eventId: 'event-1',
      snapshot: currentSnapshot,
      ticketSignature: '[{"tierId":"vip","quantity":1}]',
      userId: 'user-1',
    }),
    false,
  );
});

test('legacy unscoped pending orders are not reused by a new checkout', () => {
  assert.equal(
    isPendingOrderSnapshotCurrent({
      eventId: 'event-1',
      snapshot: { ...currentSnapshot, ticketSignature: undefined },
      ticketSignature: currentSnapshot.ticketSignature,
      userId: 'user-1',
    }),
    false,
  );
});

test('pending checkout recovery remains available for the same cart and user', () => {
  assert.equal(
    isPendingOrderSnapshotCurrent({
      eventId: 'event-1',
      snapshot: currentSnapshot,
      ticketSignature: currentSnapshot.ticketSignature,
      userId: 'user-1',
    }),
    true,
  );
});
