import test from 'node:test';
import assert from 'node:assert/strict';

import { getTicketSelectionLimit, getTicketSelectionLimitLabel } from './ticketSelectionLimits.js';

test('event-wide limit caps a free tier whose embedded tier default is higher', () => {
  const event = { maxTicketsPerOrder: 1 };
  const ticket = {
    id: 'ga',
    price: 0,
    quantity: 50,
    maxPerOrder: 10,
  };

  assert.equal(getTicketSelectionLimit({ event, ticket }), 1);
  assert.equal(getTicketSelectionLimit({ event, quantities: { ga: 1 }, ticket }), 1);
  assert.equal(getTicketSelectionLimitLabel({ limit: 1, quantity: 1 }), 'Limit Reached');
});

test('free tiers remain capped at one when an event permits larger paid orders', () => {
  const event = { maxTicketsPerOrder: 10 };
  const ticket = {
    id: 'ga',
    price: 0,
    quantity: 50,
    maxPerOrder: 10,
  };

  assert.equal(getTicketSelectionLimit({ event, ticket }), 1);
});

test('event-wide capacity is shared across selected tiers', () => {
  const event = { maxTicketsPerOrder: 2 };
  const ticket = {
    id: 'vip',
    price: 1000,
    quantity: 10,
    maxPerOrder: 10,
  };

  assert.equal(
    getTicketSelectionLimit({
      event,
      quantities: { ga: 1, vip: 0 },
      ticket,
    }),
    1,
  );
});
