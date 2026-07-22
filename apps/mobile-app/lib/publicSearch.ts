export type PublicSearchFilter = 'all' | 'events' | 'venues' | 'hosts';
export type PublicSearchResultType = 'event' | 'venue' | 'host';

export interface PublicSearchResult {
  id: string;
  type: PublicSearchResultType;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  data: Record<string, any>;
}

const ALL_CITIES = new Set(['', 'all', 'all cities']);

export function buildPublicSearchPath(
  query: string,
  filter: PublicSearchFilter,
  city?: string | null,
) {
  const params = new URLSearchParams();
  params.set('q', query.trim());
  params.set('limit', filter === 'all' ? '8' : '24');
  if (filter !== 'all') params.set('type', filter);

  const normalizedCity = String(city || '').trim();
  if (!ALL_CITIES.has(normalizedCity.toLowerCase())) {
    params.set('city', normalizedCity);
  }

  return `/api/v1/public/search?${params.toString()}`;
}

function imageUrl(item: Record<string, any>) {
  return (
    item.coverImage ||
    item.posterUrl ||
    item.poster ||
    item.photoURL ||
    item.photoUrl ||
    item.avatarUrl ||
    item.avatar ||
    item.logo ||
    item.image
  );
}

export function mapPublicSearchResponse(
  response: Record<string, any> | null | undefined,
  filter: PublicSearchFilter,
): PublicSearchResult[] {
  const payload = response?.data && typeof response.data === 'object' ? response.data : response || {};
  const results: PublicSearchResult[] = [];

  if (filter === 'all' || filter === 'events') {
    for (const item of Array.isArray(payload.events) ? payload.events : []) {
      const id = item.id || item.eventId;
      if (!id) continue;
      results.push({
        id,
        type: 'event',
        title: item.title || item.name || 'Untitled event',
        subtitle: item.venueName || item.venue || item.location || item.cityLabel || item.city,
        imageUrl: imageUrl(item),
        data: item,
      });
    }
  }

  if (filter === 'all' || filter === 'venues') {
    for (const item of Array.isArray(payload.venues) ? payload.venues : []) {
      const id = item.venueId || item.id;
      if (!id) continue;
      results.push({
        id,
        type: 'venue',
        title: item.displayName || item.name || 'Unnamed venue',
        subtitle: item.area || item.neighborhood || item.cityLabel || item.city,
        imageUrl: imageUrl(item),
        data: { ...item, venueId: id },
      });
    }
  }

  if (filter === 'all' || filter === 'hosts') {
    for (const item of Array.isArray(payload.hosts) ? payload.hosts : []) {
      const id = item.hostId || item.id;
      if (!id) continue;
      results.push({
        id,
        type: 'host',
        title: item.displayName || item.name || 'Unnamed host',
        subtitle:
          item.role ||
          (Number.isFinite(item.upcomingEventsCount)
            ? `${item.upcomingEventsCount} upcoming events`
            : item.cityLabel || item.city),
        imageUrl: imageUrl(item),
        data: { ...item, hostId: id },
      });
    }
  }

  return results;
}
