import { callGatewayJson } from "./gatewayBridge.js";
export {
    adaptPublicList,
    adaptSearchResponse,
    adaptVenueList,
    buildSearchSuggestions,
} from "./publicDiscoveryAdapters.js";

function toQueryString(params = {}) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === "") continue;
        searchParams.set(key, String(value));
    }
    const query = searchParams.toString();
    return query ? `?${query}` : "";
}

export async function fetchPublicEvents(params = {}, options = {}) {
    const { response, data } = await callGatewayJson(`/public/events${toQueryString(params)}`, options);
    if (!response.ok) throw new Error(data?.error?.message || "Unable to load public events");
    return data;
}

export async function fetchFeaturedEvents(params = {}, options = {}) {
    const { response, data } = await callGatewayJson(`/public/events/featured${toQueryString(params)}`, options);
    if (!response.ok) throw new Error(data?.error?.message || "Unable to load featured events");
    return data;
}

export async function fetchPublicEvent(idOrSlug, options = {}) {
    const { response, data } = await callGatewayJson(`/public/events/${encodeURIComponent(idOrSlug)}`, options);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(data?.error?.message || "Unable to load public event");
    return data;
}

export async function fetchPublicHosts(params = {}, options = {}) {
    const { response, data } = await callGatewayJson(`/public/hosts${toQueryString(params)}`, options);
    if (!response.ok) throw new Error(data?.error?.message || "Unable to load public hosts");
    return data;
}

export async function fetchPublicHost(slug, options = {}) {
    const { response, data } = await callGatewayJson(`/public/hosts/${encodeURIComponent(slug)}`, options);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(data?.error?.message || "Unable to load public host");
    return data;
}

export async function fetchPublicVenues(params = {}, options = {}) {
    const { response, data } = await callGatewayJson(`/public/venues${toQueryString(params)}`, options);
    if (!response.ok) throw new Error(data?.error?.message || "Unable to load public venues");
    return data;
}

export async function fetchPublicVenue(slug, options = {}) {
    const { response, data } = await callGatewayJson(`/public/venues/${encodeURIComponent(slug)}`, options);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(data?.error?.message || "Unable to load public venue");
    return data;
}

export async function searchPublicDiscovery(params = {}, options = {}) {
    const { response, data } = await callGatewayJson(`/public/search${toQueryString(params)}`, options);
    if (!response.ok) throw new Error(data?.error?.message || "Unable to search public discovery");
    return data;
}
