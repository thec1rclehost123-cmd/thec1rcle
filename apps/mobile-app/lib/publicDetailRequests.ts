import { apiFetch, deduplicateRequest } from './api';

const DETAIL_CACHE_TTL_MS = 5_000;
const DETAIL_CACHE_MAX_ENTRIES = 64;

type DetailCacheEntry = { expiresAt: number; value: unknown };
const successfulDetailCache = new Map<string, DetailCacheEntry>();

type DetailRequestOptions = { bypassCache?: boolean };

function readCachedDetail<T>(key: string): T | undefined {
  const cached = successfulDetailCache.get(key);
  if (!cached) return undefined;
  if (cached.expiresAt <= Date.now()) {
    successfulDetailCache.delete(key);
    return undefined;
  }
  return cached.value as T;
}

function cacheDetail<T>(key: string, value: T): T {
  successfulDetailCache.delete(key);
  successfulDetailCache.set(key, { value, expiresAt: Date.now() + DETAIL_CACHE_TTL_MS });
  while (successfulDetailCache.size > DETAIL_CACHE_MAX_ENTRIES) {
    const oldestKey = successfulDetailCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    successfulDetailCache.delete(oldestKey);
  }
  return value;
}

function fetchCachedDetail<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: DetailRequestOptions = {},
): Promise<T> {
  if (options.bypassCache) {
    successfulDetailCache.delete(key);
  } else {
    const cached = readCachedDetail<T>(key);
    if (cached !== undefined) return Promise.resolve(cached);
  }

  return deduplicateRequest(key, async () => cacheDetail(key, await fetcher()));
}

export type PublicHostProfile = {
  id: string;
  hostId?: string;
  displayName?: string;
  name?: string;
  handle?: string;
  bio?: string;
  description?: string;
  city?: string;
  location?: string;
  avatar?: string;
  avatarUrl?: string;
  photoURL?: string;
  image?: string;
  cover?: string;
  coverUrl?: string;
  coverURL?: string;
  followersCount?: number;
  upcomingEventsCount?: number;
};

export type PublicHostEvent = {
  id?: string;
  eventId?: string;
  title?: string;
  venue?: string;
  venueName?: string;
  startAt?: string;
  startDate?: string;
  image?: string;
  poster?: string;
  posterUrl?: string;
};

export type PublicHostPageResponse = {
  host?: PublicHostProfile;
  stats?: { followersCount?: number; upcomingEventsCount?: number };
  upcomingEvents?: PublicHostEvent[];
};

/**
 * Deep-link navigation can mount the same route more than once while the first
 * effect is still running (React development effect replay is one example).
 * Keep the single-flight boundary outside the screen so those mounts share the
 * same network request.
 */
export function fetchPublicHostPage(
  hostId: string,
  options: DetailRequestOptions = {},
): Promise<PublicHostPageResponse> {
  const encodedHostId = encodeURIComponent(hostId);
  const requestKey = `public-detail:host:${encodedHostId}`;
  return fetchCachedDetail(
    requestKey,
    () =>
      apiFetch<PublicHostPageResponse>(`/api/v1/public/hosts/${encodedHostId}`, {
        requireAuth: false,
      }),
    options,
  );
}

export function fetchPublicVenuePage<T = any>(
  venueIdOrSlug: string,
  options: DetailRequestOptions = {},
): Promise<T> {
  const encodedVenueId = encodeURIComponent(venueIdOrSlug);
  const requestKey = `public-detail:venue:${encodedVenueId}`;
  return fetchCachedDetail(
    requestKey,
    () => apiFetch<T>(`/api/v1/public/venues/${encodedVenueId}`, { requireAuth: false }),
    options,
  );
}
