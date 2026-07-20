const DEFAULT_SITE_URL = 'https://thec1rcle.com';
const DEFAULT_OG_IMAGE = '/logo.jpg';

export function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    DEFAULT_SITE_URL
  ).replace(/\/+$/, '');
}

export function absoluteUrl(value) {
  if (!value) return `${getSiteUrl()}${DEFAULT_OG_IMAGE}`;
  if (/^https?:\/\//i.test(value)) return value;
  return `${getSiteUrl()}${String(value).startsWith('/') ? value : `/${value}`}`;
}

export function buildTitle(value, fallback = 'THE.C1RCLE') {
  return value ? `${value} | THE.C1RCLE` : fallback;
}

export function getEventImage(event = {}) {
  return absoluteUrl(
    event.ogImage ||
      event.image ||
      event.coverImage ||
      event.poster ||
      event.posterUrl ||
      DEFAULT_OG_IMAGE,
  );
}

export function getEventDescription(event = {}) {
  return (
    event.seoDescription ||
    event.description ||
    event.shortDescription ||
    event.about ||
    'Discover this C1RCLE event, tickets, venue details, and offline social context.'
  );
}

export function buildEventJsonLd(event = {}) {
  const canonical = `${getSiteUrl()}/event/${encodeURIComponent(event.slug || event.id || '')}`;
  const locationName = event.venueName || event.venue || event.location || 'THE.C1RCLE';
  const address = event.address || event.location || event.city || 'India';

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title || event.name || 'C1RCLE Event',
    description: getEventDescription(event),
    image: [getEventImage(event)],
    startDate: event.startDateTime || event.startAt || event.startDate,
    endDate: event.endDateTime || event.endAt || event.endDate,
    eventStatus:
      event.lifecycle === 'cancelled'
        ? 'https://schema.org/EventCancelled'
        : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url: canonical,
    location: {
      '@type': 'Place',
      name: locationName,
      address,
    },
    organizer: {
      '@type': 'Organization',
      name: event.hostName || event.host || event.organizerName || 'THE.C1RCLE',
      url: getSiteUrl(),
    },
  };
}

export function profileDescription(profile = {}, fallback) {
  return (
    profile.seoDescription || profile.bio || profile.description || profile.tagline || fallback
  );
}
