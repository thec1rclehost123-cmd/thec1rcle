import { buildHomepageContent, getHomepageCity } from '../../features/discovery/homepageContent.js';
import {
  GUEST_BFF_CACHE,
  buildGuestBffError,
  buildGuestBffResult,
  buildGuestBffUpstreamTrace,
  guestBffUpstreamJson,
  getGuestBffUpstreamError,
} from './server.js';

function extractItems(payload, primaryKey = 'events') {
  if (Array.isArray(payload?.[primaryKey])) return payload[primaryKey];
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

export async function buildHomeOverviewView({ city = '' } = {}) {
  const selectedCity = getHomepageCity(city);
  const [featuredResult, eventsResult, selectsResult, interviewsResult] = await Promise.all([
    guestBffUpstreamJson(
      `/public/events/featured?limit=6&city=${encodeURIComponent(selectedCity)}`,
      {
        cacheMode: GUEST_BFF_CACHE.PUBLIC_REVALIDATED,
        forwardCookies: false,
        next: { revalidate: 60 },
      },
    ),
    guestBffUpstreamJson(
      `/public/events?city=${encodeURIComponent(selectedCity)}&limit=30&sort=heat`,
      {
        cacheMode: GUEST_BFF_CACHE.PUBLIC_REVALIDATED,
        forwardCookies: false,
        next: { revalidate: 60 },
      },
    ),
    guestBffUpstreamJson('/public/homepage/selects', {
      cacheMode: GUEST_BFF_CACHE.PUBLIC_REVALIDATED,
      forwardCookies: false,
      next: { revalidate: 300 },
    }),
    guestBffUpstreamJson('/public/homepage/interviews', {
      cacheMode: GUEST_BFF_CACHE.PUBLIC_REVALIDATED,
      forwardCookies: false,
      next: { revalidate: 300 },
    }),
  ]);

  const errors = [];
  if (!featuredResult.response.ok) errors.push('Featured events are temporarily unavailable.');
  if (!eventsResult.response.ok) errors.push('The live event feed is temporarily unavailable.');
  if (!selectsResult.response.ok) errors.push('Curated selects could not be loaded.');
  if (!interviewsResult.response.ok) errors.push('Interview stories could not be loaded.');

  const featuredEvents = featuredResult.response.ok
    ? extractItems(featuredResult.data, 'events')
    : [];
  const events = eventsResult.response.ok ? extractItems(eventsResult.data, 'events') : [];
  const selects = selectsResult.response.ok
    ? selectsResult.data?.data || selectsResult.data || []
    : [];
  const interviews = interviewsResult.response.ok
    ? interviewsResult.data?.data || interviewsResult.data || []
    : [];

  return buildGuestBffResult({
    status: eventsResult.response.ok ? 200 : eventsResult.response.status || 502,
    data: {
      city: selectedCity,
      featuredEvents,
      events,
      selects,
      interviews,
      errors,
      content: buildHomepageContent({
        city: selectedCity,
        events,
        featuredEvents,
        interviews,
        selects,
      }),
    },
    error: eventsResult.response.ok
      ? null
      : buildGuestBffError(
          getGuestBffUpstreamError(
            eventsResult.data,
            'The live event feed is temporarily unavailable.',
          ),
          {
            requestId: eventsResult.requestId,
            status: eventsResult.response.status || 502,
          },
        ),
    meta: {
      city: selectedCity,
      requestId: eventsResult.requestId,
      upstreamCalls: buildGuestBffUpstreamTrace(
        featuredResult,
        eventsResult,
        selectsResult,
        interviewsResult,
      ),
    },
  });
}
