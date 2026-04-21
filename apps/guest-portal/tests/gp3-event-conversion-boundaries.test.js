import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const migratedFiles = [
    "app/event/[eventId]/page.jsx",
    "app/[handle]/[eventSlug]/page.jsx",
    "app/api/events/[eventId]/route.js",
    "app/api/events/[eventId]/view/route.js",
    "app/api/events/[eventId]/track/route.js",
    "app/api/events/[eventId]/rsvp/route.js",
    "app/api/events/[eventId]/queue/route.js",
    "app/api/waitlist/route.js",
];

const forbiddenImports = [
    "lib/server/eventStore",
    "lib/server/waitlistStore",
    "lib/server/queueStore",
    "@/lib/firebase/admin",
    "firebase-admin",
    "getAdminDb",
    "isFirebaseConfigured",
];

test("GP-3 migrated event conversion surfaces use Fastify-backed bridges instead of app-local backend logic", () => {
    for (const relativePath of migratedFiles) {
        const source = readFileSync(join(root, relativePath), "utf8");
        for (const forbidden of forbiddenImports) {
            assert.equal(
                source.includes(forbidden),
                false,
                `${relativePath} still references ${forbidden}`
            );
        }
    }
});

test("EventRSVP no longer uses a direct Firebase Firestore listener for interested counts", () => {
    const source = readFileSync(join(root, "components/EventRSVP.jsx"), "utf8");

    assert.equal(source.includes("getFirebaseDb"), false);
    assert.equal(source.includes("firebase/firestore"), false);
    assert.equal(source.includes("onSnapshot"), false);
});
