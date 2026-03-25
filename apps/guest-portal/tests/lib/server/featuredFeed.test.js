import test from "node:test";
import assert from "node:assert/strict";

import { FEATURED_EVENT_LIMIT, mergePinnedAndHeatEvents } from "../../../lib/server/featuredFeedUtils.js";

test("mergePinnedAndHeatEvents keeps manual pins first and fills the rest from heat-ranked events", () => {
  const pinned = [
    { id: "manual-1", heatScore: 5 },
    { id: "manual-2", heatScore: 10 },
  ];
  const heatRanked = [
    { id: "manual-2", heatScore: 999 },
    { id: "auto-1", heatScore: 90 },
    { id: "auto-2", heatScore: 80 },
    { id: "auto-3", heatScore: 70 },
  ];

  const featured = mergePinnedAndHeatEvents(pinned, heatRanked, 4);

  assert.deepEqual(featured.map((event) => event.id), ["manual-1", "manual-2", "auto-1", "auto-2"]);
});

test("mergePinnedAndHeatEvents deduplicates ids and respects the configured slot limit", () => {
  const pinned = [
    { id: "manual-1", heatScore: 5 },
    { id: "manual-1", heatScore: 999 },
    { id: "manual-2", heatScore: 10 },
  ];
  const heatRanked = Array.from({ length: 10 }, (_, index) => ({
    id: `auto-${index + 1}`,
    heatScore: 100 - index,
  }));

  const featured = mergePinnedAndHeatEvents(pinned, heatRanked, FEATURED_EVENT_LIMIT);

  assert.equal(featured.length, FEATURED_EVENT_LIMIT);
  assert.deepEqual(featured.map((event) => event.id), ["manual-1", "manual-2", "auto-1", "auto-2", "auto-3", "auto-4"]);
});
