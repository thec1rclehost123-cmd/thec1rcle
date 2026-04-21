import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const homepageDataPath = path.resolve(process.cwd(), "lib/homepageData.js");

test("homepage discovery content uses the Fastify public discovery bridge", () => {
  const source = readFileSync(homepageDataPath, "utf8");

  assert.equal(source.includes("./server/eventStore"), false);
  assert.equal(source.includes("./server/featuredFeed"), false);
  assert.equal(source.includes("./server/publicDiscoveryBridge.js"), true);
  assert.equal(source.includes("fetchPublicEvents"), true);
  assert.equal(source.includes("fetchFeaturedEvents"), true);
});
