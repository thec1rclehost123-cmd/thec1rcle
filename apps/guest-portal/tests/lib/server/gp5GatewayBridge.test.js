import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const bridgePath = join(process.cwd(), "lib/server/gp5GatewayBridge.js");

test("GP-5 gateway bridge targets the canonical wallet/profile endpoints", () => {
    const source = readFileSync(bridgePath, "utf8");

    assert.equal(source.includes('"/tickets"'), true);
    assert.equal(source.includes('"/guest-notifications"'), true);
    assert.equal(source.includes('"/tickets/claim/share"'), true);
    assert.equal(source.includes('"/tickets/pair/link"'), true);
    assert.equal(source.includes("/guest-profiles/${"), true);
});

test("GP-5 gateway bridge routes mutations through callGatewayJson with explicit methods", () => {
    const source = readFileSync(bridgePath, "utf8");

    assert.equal(source.includes('method: "POST"'), true);
    assert.equal(source.includes('method: "PATCH"'), true);
    assert.equal(source.includes('method: "DELETE"'), true);
    assert.equal(source.includes("getGatewayErrorMessage"), true);
});
