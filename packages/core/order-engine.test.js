import { test, expect } from "vitest";

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

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/restricted to female attendees only/i);
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

    expect(result.success).toBe(true);
});
