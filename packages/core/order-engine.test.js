import test from "node:test";
import assert from "node:assert/strict";

import { validateOrder } from "./order-engine.js";

test("validateOrder rejects gender-mismatched buyers for female-only tiers", async () => {
    const result = await validateOrder(
        {
            tickets: [
                { id: "ladies", name: "Ladies Entry", entryType: "female" },
            ],
        },
        [
            { ticketId: "ladies", quantity: 1 },
        ],
        {
            existingTicketCount: 0,
            hasExistingRSVP: false,
            userGender: "male",
        }
    );

    assert.equal(result.success, false);
    assert.match(result.error, /restricted to female attendees only/i);
});

test("validateOrder allows matching buyers for female-only tiers", async () => {
    const result = await validateOrder(
        {
            tickets: [
                { id: "ladies", name: "Ladies Entry", entryType: "female" },
            ],
        },
        [
            { ticketId: "ladies", quantity: 1 },
        ],
        {
            existingTicketCount: 0,
            hasExistingRSVP: false,
            userGender: "female",
        }
    );

    assert.equal(result.success, true);
});
