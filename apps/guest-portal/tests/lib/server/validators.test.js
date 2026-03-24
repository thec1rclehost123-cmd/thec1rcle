import test from "node:test";
import assert from "node:assert/strict";

import {
  createOrderSchema,
  joinWaitlistSchema,
  validateBody,
} from "../../../lib/server/validators.js";

test("createOrderSchema accepts valid order payloads and applies the default payment method", () => {
  const payload = createOrderSchema.parse({
    eventId: "evt_123",
    tickets: [{ ticketId: "ticket_vip", quantity: 2 }],
    userEmail: "guest@example.com",
    userName: "Guest User",
  });

  assert.equal(payload.paymentMethod, "card");
  assert.deepEqual(payload.tickets, [{ ticketId: "ticket_vip", quantity: 2 }]);
});

test("joinWaitlistSchema rejects malformed phone numbers", () => {
  assert.throws(
    () =>
      joinWaitlistSchema.parse({
        eventId: "evt_123",
        email: "guest@example.com",
        phone: "123-456-7890",
      }),
    /Invalid phone number/,
  );
});

test("validateBody returns parsed data for a valid request", async () => {
  const request = {
    async json() {
      return {
        eventId: "evt_123",
        tickets: [{ ticketId: "ticket_vip", quantity: 1 }],
        userEmail: "guest@example.com",
      };
    },
  };

  const result = await validateBody(request, createOrderSchema);

  assert.equal(result.error, null);
  assert.equal(result.data.paymentMethod, "card");
});

test("validateBody returns the first zod error message for invalid input", async () => {
  const request = {
    async json() {
      return {
        eventId: "evt_123",
        tickets: [],
        userEmail: "not-an-email",
      };
    },
  };

  const result = await validateBody(request, createOrderSchema);

  assert.equal(result.data, null);
  assert.equal(result.error, "At least one ticket is required");
});

test("validateBody returns a generic error when request parsing fails", async () => {
  const request = {
    async json() {
      throw new Error("invalid json");
    },
  };

  const result = await validateBody(request, createOrderSchema);

  assert.equal(result.data, null);
  assert.equal(result.error, "Invalid request body");
});
