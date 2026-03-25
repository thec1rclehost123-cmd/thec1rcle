import test from "node:test";
import assert from "node:assert/strict";

import { selectInterestedUsersForDisplay } from "../../../lib/server/eventAudienceUtils.js";

test("selectInterestedUsersForDisplay prefers a 70/30 female-to-male mix when enough profiles exist", () => {
  const users = [
    { id: "f1", gender: "female" },
    { id: "f2", gender: "female" },
    { id: "f3", gender: "female" },
    { id: "f4", gender: "female" },
    { id: "f5", gender: "female" },
    { id: "f6", gender: "female" },
    { id: "f7", gender: "female" },
    { id: "m1", gender: "male" },
    { id: "m2", gender: "male" },
    { id: "m3", gender: "male" },
    { id: "o1", gender: "non-binary" },
  ];

  const selected = selectInterestedUsersForDisplay(users, 10);
  const femaleCount = selected.filter((user) => user.gender === "female").length;
  const maleCount = selected.filter((user) => user.gender === "male").length;

  assert.equal(selected.length, 10);
  assert.equal(femaleCount, 7);
  assert.equal(maleCount, 3);
});

test("selectInterestedUsersForDisplay fills from remaining pools when the preferred split is unavailable", () => {
  const users = [
    { id: "f1", gender: "female" },
    { id: "f2", gender: "female" },
    { id: "m1", gender: "male" },
    { id: "m2", gender: "male" },
    { id: "m3", gender: "male" },
    { id: "o1", gender: "non-binary" },
    { id: "o2", gender: "prefer not to say" },
  ];

  const selected = selectInterestedUsersForDisplay(users, 6);
  const ids = selected.map((user) => user.id);

  assert.equal(selected.length, 6);
  assert.deepEqual(ids, ["f1", "f2", "m1", "m2", "m3", "o1"]);
});
