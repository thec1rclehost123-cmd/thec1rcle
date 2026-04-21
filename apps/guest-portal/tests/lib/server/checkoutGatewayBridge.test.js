import test from "node:test";
import assert from "node:assert/strict";

import {
    adaptGatewayPaymentConfig,
    adaptGatewayPaymentOrder,
} from "../../../lib/server/checkoutGatewayAdapters.js";

test("adaptGatewayPaymentConfig preserves the gateway config envelope", () => {
    assert.deepEqual(
        adaptGatewayPaymentConfig({
            config: {
                key: "rzp_test_live",
                currency: "INR",
                name: "THE C1RCLE",
                description: "Event Tickets",
                theme: { color: "#111111" },
            }
        }),
        {
            config: {
                key: "rzp_test_live",
                currency: "INR",
                name: "THE C1RCLE",
                description: "Event Tickets",
                theme: { color: "#111111" },
            }
        }
    );
});

test("adaptGatewayPaymentOrder keeps the legacy Guest Portal payment shape", () => {
    assert.deepEqual(
        adaptGatewayPaymentOrder(
            {
                razorpayOrderId: "order_123",
                amount: 1499,
                currency: "INR",
            },
            {
                config: {
                    key: "rzp_test_123",
                    currency: "INR",
                    name: "THE C1RCLE",
                    description: "Event Tickets",
                    theme: { color: "#1d1d1f" },
                }
            }
        ),
        {
            razorpayOrderId: "order_123",
            amount: 1499,
            currency: "INR",
            config: {
                key: "rzp_test_123",
                currency: "INR",
                name: "THE C1RCLE",
                description: "Event Tickets",
                theme: { color: "#1d1d1f" },
            }
        }
    );
});
