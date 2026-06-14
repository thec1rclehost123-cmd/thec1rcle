import {
  GUEST_BFF_CACHE,
  buildGuestBffError,
  buildGuestBffResult,
  buildGuestBffUpstreamTrace,
  guestBffUpstreamJson,
  getGuestBffUpstreamError,
} from "./server.js";

function extractItems(payload, primaryKey = "events") {
  if (Array.isArray(payload?.[primaryKey])) return payload[primaryKey];
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function buildExploreQuery({
  city = "",
  curatedCategory = "",
  datePreset = "",
  endDate = "",
  eventType = "",
  lastId = "",
  limit = 24,
  priceType = "",
  search = "",
  sort = "heat",
  startDate = "",
} = {}) {
  const params = new URLSearchParams();

  params.set("limit", String(limit));
  params.set("sort", sort || "heat");

  for (const [key, value] of Object.entries({
    city,
    curatedCategory,
    datePreset,
    endDate,
    eventType,
    lastId,
    priceType,
    search,
    startDate,
  })) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  return params.toString();
}

export async function buildExploreFeedView({
  city = "",
  curatedCategory = "",
  datePreset = "",
  endDate = "",
  eventType = "",
  includeFeatured = true,
  lastId = "",
  limit = 24,
  priceType = "",
  search = "",
  sort = "heat",
  startDate = "",
} = {}) {
  const eventQuery = buildExploreQuery({
    city,
    curatedCategory,
    datePreset,
    endDate,
    eventType,
    lastId,
    limit,
    priceType,
    search,
    sort,
    startDate,
  });

  const featuredQuery = new URLSearchParams();
  featuredQuery.set("limit", "6");
  if (city) featuredQuery.set("city", city);

  const calls = [
    guestBffUpstreamJson(`/public/events?${eventQuery}`, {
      cacheMode: GUEST_BFF_CACHE.PUBLIC_REVALIDATED,
      forwardCookies: false,
      next: { revalidate: 60 },
    }),
  ];

  if (includeFeatured) {
    calls.push(
      guestBffUpstreamJson(`/public/events/featured?${featuredQuery.toString()}`, {
        cacheMode: GUEST_BFF_CACHE.PUBLIC_REVALIDATED,
        forwardCookies: false,
        next: { revalidate: 60 },
      }),
    );
  }

  const [eventsResult, featuredResult] = await Promise.all(calls);
  const errors = [];

  if (!eventsResult.response.ok) {
    errors.push(getGuestBffUpstreamError(eventsResult.data, "The explore event feed is temporarily unavailable."));
  }
  if (includeFeatured && featuredResult && !featuredResult.response.ok) {
    errors.push(getGuestBffUpstreamError(featuredResult.data, "Featured explore events could not be loaded."));
  }

  return buildGuestBffResult({
    status: eventsResult.response.ok ? 200 : eventsResult.response.status || 502,
    data: {
      events: eventsResult.response.ok ? extractItems(eventsResult.data, "events") : [],
      featuredEvents:
        includeFeatured && featuredResult?.response?.ok
          ? extractItems(featuredResult.data, "events")
          : [],
      hasMore: Boolean(eventsResult.data?.hasMore),
      nextCursor: eventsResult.data?.nextCursor || null,
      errors,
      meta: {
        city,
        includeFeatured,
        lastId: lastId || null,
        sort,
      },
    },
    error: eventsResult.response.ok
      ? null
      : buildGuestBffError(
          getGuestBffUpstreamError(eventsResult.data, "The explore event feed is temporarily unavailable."),
          {
            requestId: eventsResult.requestId,
            status: eventsResult.response.status || 502,
          },
        ),
    meta: {
      city,
      requestId: eventsResult.requestId,
      includeFeatured,
      lastId: lastId || null,
      sort,
      upstreamCalls: buildGuestBffUpstreamTrace(eventsResult, featuredResult),
    },
  });
}
