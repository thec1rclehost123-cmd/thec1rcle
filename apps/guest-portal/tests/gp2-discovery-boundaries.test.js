import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const migratedFiles = [
    "app/explore/page.js",
    "app/hosts/page.js",
    "app/host/[slug]/page.jsx",
    "app/venue/[slug]/page.jsx",
    "app/api/events/route.js",
    "app/api/hosts/route.js",
    "app/api/hosts/[slug]/route.js",
    "app/api/venues/route.js",
    "app/api/venues/[venueId]/route.js",
    "app/api/search/route.js",
];

const forbiddenImports = [
    "lib/server/eventStore",
    "lib/server/hostStore",
    "lib/server/venueStore",
    "lib/server/partnerProfileStore",
    "lib/firebase/client",
    "firebase/firestore",
    "@c1rcle/core/search",
];

test("GP-2 migrated discovery surfaces no longer import app-local Firestore stores/search modules", () => {
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

test("ExploreClient does not use a direct Firebase Firestore discovery listener", () => {
    const source = readFileSync(join(root, "components/ExploreClient.jsx"), "utf8");

    assert.equal(source.includes("getFirebaseDb"), false);
    assert.equal(source.includes("firebase/firestore"), false);
    assert.equal(source.includes("onSnapshot"), false);
});

test("ExploreClient does not compare date-only event end values as raw strings", () => {
    const source = readFileSync(join(root, "components/ExploreClient.jsx"), "utf8");

    assert.equal(source.includes("eventEnd && eventEnd < now.toISOString()"), false);
    assert.equal(source.includes("toEventEndDate"), true);
});
