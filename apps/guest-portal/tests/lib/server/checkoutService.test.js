import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  initiateCheckout,
  getReservation,
  __resetCheckoutStateForTests,
  __seedReservationForTests,
} from "../../../lib/server/checkoutService.js";
import {
  __getFallbackOrdersForTests,
  __resetOrderStoreForTests,
} from "../../../lib/server/orderStore.js";
import {
  __resetFallbackEventsForTests,
  __setFallbackEventsForTests,
} from "../../../lib/server/eventStore.js";

const futureIso = () => new Date(Date.now() + 60_000).toISOString();
const pastIso = () => new Date(Date.now() - 60_000).toISOString();

const baseUser = {
  name: "Test User",
  email: "test@example.com",
  phone: "+15555550123",
};

const buildEvent = ({ id, isRSVP = false, price = 500 }) => ({
  id,
  title: `Event ${id}`,
  image: "https://example.com/event.jpg",
  date: "2026-05-01",
  time: "20:00",
  location: "Phoenix",
  venueId: "venue-1",
  lifecycle: "scheduled",
  isRSVP,
  minTicketsPerOrder: 1,
  maxTicketsPerOrder: 10,
  tickets: [
    {
      id: "tier-1",
      name: price === 0 ? "Guestlist" : "General Admission",
      entryType: "general",
      price,
      quantity: 100,
      remaining: 100,
      salesStart: pastIso(),
      salesEnd: futureIso(),
    },
  ],
});

const seedReservation = ({ id, eventId, status = "active" }) => {
  __seedReservationForTests({
    id,
    eventId,
    status,
    expiresAt: futureIso(),
    items: [
      {
        tierId: "tier-1",
        tierName: "General Admission",
        entryType: "general",
        quantity: 1,
      },
    ],
  });
};

afterEach(() => {
  __resetCheckoutStateForTests();
  __resetOrderStoreForTests();
  __resetFallbackEventsForTests();
});

test("initiateCheckout reuses the same paid order for repeated calls on one reservation", async () => {
  __setFallbackEventsForTests([buildEvent({ id: "evt-paid", price: 500 })]);
  seedReservation({ id: "res-paid", eventId: "evt-paid" });

  const firstResult = await initiateCheckout("res-paid", "user-1", baseUser);
  const secondResult = await initiateCheckout("res-paid", "user-1", baseUser);

  assert.equal(firstResult.success, true);
  assert.equal(firstResult.requiresPayment, true);
  assert.equal(secondResult.success, true);
  assert.equal(secondResult.requiresPayment, true);
  assert.equal(secondResult.order.id, firstResult.order.id);
  assert.equal(secondResult.pricing.grandTotal, firstResult.pricing.grandTotal);
  assert.equal(__getFallbackOrdersForTests().length, 1);
});

test("initiateCheckout returns the existing confirmed order after a free reservation is converted", async () => {
  __setFallbackEventsForTests([buildEvent({ id: "evt-free", price: 0 })]);
  seedReservation({ id: "res-free", eventId: "evt-free" });

  const firstResult = await initiateCheckout("res-free", "user-1", baseUser);
  const convertedReservation = await getReservation("res-free");
  const secondResult = await initiateCheckout("res-free", "user-1", baseUser);

  assert.equal(firstResult.success, true);
  assert.equal(firstResult.requiresPayment, false);
  assert.equal(convertedReservation?.status, "converted");
  assert.equal(secondResult.success, true);
  assert.equal(secondResult.requiresPayment, false);
  assert.equal(secondResult.order.id, firstResult.order.id);
  assert.equal(__getFallbackOrdersForTests().length, 1);
});
