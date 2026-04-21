import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const modalPath = path.resolve(process.cwd(), "components/EditProfileModal.jsx");

test("edit profile modal is viewport-bounded and scrollable", () => {
  const source = readFileSync(modalPath, "utf8");

  assert.equal(source.includes("overflow-y-auto overflow-x-hidden overscroll-contain"), true);
  assert.equal(source.includes("max-h-[calc(100dvh-2rem)]"), true);
  assert.equal(source.includes("sm:max-h-[calc(100dvh-3rem)]"), true);
  assert.equal(source.includes("min-h-[100dvh] items-start justify-center"), true);
});
