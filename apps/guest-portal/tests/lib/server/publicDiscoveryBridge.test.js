import test from "node:test";
import assert from "node:assert/strict";

import {
    adaptPublicList,
    adaptSearchResponse,
    adaptVenueList,
    buildSearchSuggestions,
} from "../../../lib/server/publicDiscoveryAdapters.js";

test("adaptPublicList maps Fastify items to legacy route keys", () => {
    const result = adaptPublicList({ items: [{ id: "event_1" }], nextCursor: "event_1", hasMore: true }, "events");

    assert.deepEqual(result, {
        events: [{ id: "event_1" }],
        nextCursor: "event_1",
        hasMore: true,
    });
});

test("adaptVenueList temporarily returns both venues and hosts for current UI compatibility", () => {
    const result = adaptVenueList({ items: [{ id: "venue_1" }], nextCursor: null, hasMore: false });

    assert.deepEqual(result, {
        venues: [{ id: "venue_1" }],
        hosts: [{ id: "venue_1" }],
        nextCursor: null,
        hasMore: false,
    });
});

test("adaptSearchResponse preserves legacy hits and suggestions shapes", () => {
    const data = {
        events: [{ id: "event_1", title: "After Dark" }],
        hosts: [{ id: "host_1", name: "After Dark India" }],
        venues: [{ id: "venue_1", name: "High Spirits" }],
    };

    assert.deepEqual(buildSearchSuggestions(data, 2), ["After Dark", "After Dark India"]);
    assert.deepEqual(adaptSearchResponse(data, { type: "events", query: "after", limit: 1 }), {
        type: "events",
        query: "after",
        hits: [{ id: "event_1", title: "After Dark" }],
        totalHits: 1,
        facetDistribution: {},
    });
    assert.deepEqual(adaptSearchResponse(data, { type: "suggestions", limit: 2 }), {
        suggestions: ["After Dark", "After Dark India"],
    });
});
