import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const pageClientPath = path.resolve(process.cwd(), "app/tickets/PageClient.jsx");
const ticketsStorePath = path.resolve(process.cwd(), "store/ticketsStore.js");
const cacheWarmerPath = path.resolve(process.cwd(), "components/CacheWarmer.js");

test("tickets page waits for auth bootstrap before loading tickets", () => {
  const source = readFileSync(pageClientPath, "utf8");

  assert.equal(source.includes("bootstrap?.routeAccess?.isAuthenticated"), true);
  assert.equal(source.includes("if (!authLoading && bootstrap?.routeAccess?.isAuthenticated && user?.uid)"), true);
});

test("tickets store explicitly sends same-origin credentials", () => {
  const source = readFileSync(ticketsStorePath, "utf8");

  assert.equal(source.includes('credentials: "same-origin"'), true);
});

test("cache warmer only preloads tickets after canonical auth bootstrap succeeds", () => {
  const source = readFileSync(cacheWarmerPath, "utf8");

  assert.equal(source.includes("bootstrap?.routeAccess?.isAuthenticated"), true);
});
