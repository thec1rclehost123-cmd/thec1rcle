import { guestApi, guestApiOperationJson } from '../../lib/api/client';

function toQueryString(params = {}) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    searchParams.set(key, String(value));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

async function unwrap(request, fallbackMessage) {
  const { response, data } = await request();
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || data?.error || fallbackMessage);
  }
  return data;
}

function normalizeVenueIdentity(data) {
  if (!data?.venue) return data;
  const venue = data.venue;
  return {
    ...data,
    venue: {
      ...venue,
      id: venue.id || venue.venueId || venue.uid || venue.slug || null,
      slug: venue.slug || venue.handle || venue.id || venue.venueId || null,
    },
  };
}

export async function fetchPublicEvents(params = {}, options = {}) {
  return unwrap(
    () => guestApi.public.events(toQueryString(params), options),
    'Unable to load public events',
  );
}

export async function fetchFeaturedEvents(params = {}, options = {}) {
  return unwrap(
    () => guestApiOperationJson('listFeaturedEvents', { query: params, ...options }),
    'Unable to load featured events',
  );
}

export async function fetchHomepageSelects(options = {}) {
  const data = await unwrap(
    () => guestApiOperationJson('listHomepageSelects', options),
    'Unable to load homepage selects',
  );
  return Array.isArray(data) ? data : [];
}

export async function fetchHomepageInterviews(options = {}) {
  const data = await unwrap(
    () => guestApiOperationJson('listHomepageInterviews', options),
    'Unable to load homepage interviews',
  );
  return Array.isArray(data) ? data : [];
}

export async function fetchPublicEvent(idOrSlug, options = {}) {
  return unwrap(() => guestApi.public.event(idOrSlug, options), 'Unable to load public event');
}

export async function fetchPublicHosts(params = {}, options = {}) {
  return unwrap(
    () => guestApi.public.hosts(toQueryString(params), options),
    'Unable to load public hosts',
  );
}

export async function fetchPublicHost(slug, options = {}) {
  return unwrap(
    () => guestApiOperationJson('getPublicHost', { params: { slug }, ...options }),
    'Unable to load public host',
  );
}

export async function fetchPublicVenues(params = {}, options = {}) {
  return unwrap(
    () => guestApi.public.venues(toQueryString(params), options),
    'Unable to load public venues',
  );
}

export async function searchPublicDiscovery(params = {}, options = {}) {
  return unwrap(
    () => guestApi.public.search(toQueryString(params), options),
    'Unable to search discovery',
  );
}

export async function fetchSearchSuggestions(query, options = {}) {
  if (!query || String(query).trim().length < 2) return [];
  const data = await searchPublicDiscovery(
    { q: String(query).trim(), type: 'suggestions' },
    options,
  );
  return Array.isArray(data?.suggestions) ? data.suggestions : [];
}

export async function fetchPublicVenue(slug, options = {}) {
  const data = await unwrap(
    () => guestApiOperationJson('getPublicVenue', { params: { slug }, ...options }),
    'Unable to load public venue',
  );
  return normalizeVenueIdentity(data);
}

export async function fetchPromoterByUsername(username, options = {}) {
  return unwrap(
    () => guestApiOperationJson('getPublicPromoter', { params: { username }, ...options }),
    'Unable to load promoter',
  );
}

export async function fetchPromoterVanityLink(username, alias, options = {}) {
  const data = await unwrap(
    () =>
      guestApiOperationJson('resolvePromoterVanityLink', {
        params: { username, alias },
        ...options,
      }),
    'Unable to resolve promoter link',
  );
  return data?.link || null;
}
