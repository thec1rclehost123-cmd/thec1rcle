import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const migratedFiles = [
    "app/checkout/[eventId]/page.jsx",
    "app/confirmation/[orderId]/page.jsx",
    "app/api/checkout/calculate/route.js",
    "app/api/checkout/reserve/route.js",
    "app/api/checkout/initiate/route.js",
    "app/api/checkout/promo/route.js",
    "app/api/checkout/cancel/route.js",
    "app/api/checkout/failure/route.js",
    "app/api/payments/route.js",
    "app/api/orders/route.js",
    "app/api/orders/[orderId]/cancel/route.js",
    "app/api/webhooks/payment/route.js",
];

const forbiddenImports = [
    "lib/server/eventStore",
    "lib/server/orderStore",
    "lib/server/checkoutService",
    "lib/server/payments/razorpay",
    "lib/firebase/client",
    "firebase/firestore",
];

test("GP-4 migrated checkout/payment surfaces no longer import app-local checkout truth", () => {
    for (const relativePath of migratedFiles) {
        const source = readFileSync(join(root, relativePath), "utf8");
        for (const forbidden of forbiddenImports) {
            assert.equal(
                source.includes(forbidden),
                false,
                `${relativePath} still imports ${forbidden}`
            );
        }
    }
});

test("CheckoutContainer no longer uses a direct Firebase inventory listener", () => {
    const source = readFileSync(join(root, "components/CheckoutContainer.jsx"), "utf8");

    assert.equal(source.includes("getFirebaseDb"), false);
    assert.equal(source.includes("firebase/firestore"), false);
    assert.equal(source.includes("onSnapshot"), false);
    assert.equal(source.includes('fetch(`/api/events/${encodeURIComponent(event.id)}`'), true);
});
