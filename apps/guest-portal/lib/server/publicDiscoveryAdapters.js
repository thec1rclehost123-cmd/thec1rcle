export function adaptPublicList(data, key) {
    const items = Array.isArray(data?.items) ? data.items : Array.isArray(data?.[key]) ? data[key] : [];
    return {
        [key]: items,
        nextCursor: data?.nextCursor || null,
        hasMore: data?.hasMore !== undefined ? data.hasMore : false,
    };
}

export function adaptVenueList(data) {
    const venues = Array.isArray(data?.items) ? data.items : Array.isArray(data?.venues) ? data.venues : [];
    return {
        venues,
        hosts: venues,
        nextCursor: data?.nextCursor || null,
        hasMore: data?.hasMore !== undefined ? data.hasMore : false,
    };
}

export function buildSearchSuggestions(data, limit = 5) {
    const candidates = [
        ...(Array.isArray(data?.events) ? data.events : []),
        ...(Array.isArray(data?.hosts) ? data.hosts : []),
        ...(Array.isArray(data?.venues) ? data.venues : []),
    ];
    const seen = new Set();
    return candidates
        .map((item) => item?.title || item?.name || item?.displayName || item?.venueName || item?.hostName || "")
        .filter((value) => {
            const normalized = String(value || "").trim();
            if (!normalized || seen.has(normalized.toLowerCase())) return false;
            seen.add(normalized.toLowerCase());
            return true;
        })
        .slice(0, limit);
}

export function adaptSearchResponse(data, { type = "events", query = "", limit = 20, offset = 0 } = {}) {
    if (type === "suggestions") {
        return { suggestions: buildSearchSuggestions(data, limit) };
    }

    const source = type === "hosts"
        ? data?.hosts
        : type === "venues"
            ? data?.venues
            : data?.events;
    const allHits = Array.isArray(source) ? source : [];
    const hits = allHits.slice(offset, offset + limit);
    return {
        type,
        query,
        hits,
        totalHits: allHits.length,
        facetDistribution: data?.facetDistribution || {},
    };
}
