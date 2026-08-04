import ExploreClient from '../../components/ExploreClient';
import { guestServerJson } from '../../lib/api/server';
import { getSiteUrl } from '../../features/seo/seoUtils';

export const revalidate = 60;

export const metadata = {
  title: 'Explore Events | THE.C1RCLE',
  description:
    'Explore public C1RCLE events, venues, popups, campus nights, and nightlife experiences.',
  alternates: { canonical: `${getSiteUrl()}/explore` },
};

async function loadExploreData() {
  const [eventsResult, featuredResult] = await Promise.all([
    guestServerJson('/public/events?limit=24&sort=heat', {
      forwardCookies: false,
      next: { revalidate: 60 },
    }),
    guestServerJson('/public/events/featured?limit=6', {
      forwardCookies: false,
      next: { revalidate: 60 },
    }),
  ]);

  const errors = [];
  if (!eventsResult.response.ok) errors.push('The explore event feed is temporarily unavailable.');
  if (!featuredResult.response.ok) errors.push('Featured explore events could not be loaded.');

  return {
    events: eventsResult.response.ok
      ? eventsResult.data?.items || eventsResult.data?.events || []
      : [],
    featuredEvents: featuredResult.response.ok
      ? featuredResult.data?.items || featuredResult.data?.events || []
      : [],
    errors,
  };
}

export default async function ExplorePage() {
  const { events, featuredEvents, errors } = await loadExploreData();
  return (
    <ExploreClient
      initialEvents={events}
      initialFeaturedEvents={featuredEvents}
      initialErrors={errors}
    />
  );
}
