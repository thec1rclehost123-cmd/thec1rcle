import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const removedServerModules = [
  "lib/server/checkoutGatewayBridge.js",
  "lib/server/checkoutGatewayAdapters.js",
  "lib/server/checkoutService.js",
  "lib/server/eventStore.js",
  "lib/server/featuredFeedUtils.js",
  "lib/server/gatewayBridge.js",
  "lib/server/publicDiscoveryAdapters.js",
  "lib/server/publicDiscoveryBridge.js",
  "lib/server/security.js",
  "lib/server/ticketingLogic.js",
  "lib/server/validators.js",
];

test("Legacy guest-portal server runtime modules remain deleted", () => {
  for (const relativePath of removedServerModules) {
    assert.equal(
      existsSync(join(root, relativePath)),
      false,
      `${relativePath} should stay deleted after the gateway cutover`
    );
  }
});
