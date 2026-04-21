import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const migratedFiles = [
    "app/api/tickets/route.js",
    "app/api/tickets/share/route.js",
    "app/api/tickets/claim/route.js",
    "app/api/tickets/transfer/route.js",
    "app/api/tickets/transfer/pending/route.js",
    "app/api/tickets/couple/route.js",
    "app/api/tickets/download/route.js",
    "app/api/tickets/cover-wallet/route.js",
    "app/api/profile/[userId]/route.js",
    "app/api/notifications/route.js",
    "app/tickets/actions.js",
    "app/profile/actions.js",
];

const forbiddenImports = [
    "lib/server/profileStore",
    "lib/server/ticketShareStore",
    "lib/server/notificationStore",
    "lib/server/orderStore",
    "lib/server/eventStore",
    "lib/server/verification",
    "lib/email/generateTicketPDF",
    "lib/firebase/admin",
];

test("GP-5 migrated wallet/profile surfaces no longer import app-local backend truth", () => {
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

test("GP-5 routes and server actions use gateway bridge helpers", () => {
    const ticketsRoute = readFileSync(join(root, "app/api/tickets/route.js"), "utf8");
    const ticketsActions = readFileSync(join(root, "app/tickets/actions.js"), "utf8");
    const profileActions = readFileSync(join(root, "app/profile/actions.js"), "utf8");

    assert.equal(ticketsRoute.includes("proxyGatewayJson"), true);
    assert.equal(ticketsActions.includes("gp5GatewayBridge"), true);
    assert.equal(profileActions.includes("gp5GatewayBridge"), true);
});
