import PageClient from './PageClient';
import { guestServerJson } from '../lib/api/server';
import { buildHomepageContent } from '../features/discovery/homepageContent';
import { buildHomeOverviewView } from '../lib/bff/home.js';
import { isGuestBffEnabled } from '../lib/bff/flags.js';
import { getSiteUrl } from '../features/seo/seoUtils';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'THE.C1RCLE | Discover the city after dark',
  description: 'Discover C1RCLE events, venues, hosts, popups, and curated nightlife experiences.',
  alternates: { canonical: getSiteUrl() },
};

async function loadHomeData() {
  const city = process.env.NEXT_PUBLIC_DEFAULT_CITY || 'Pune';

  if (isGuestBffEnabled('home')) {
    const result = await buildHomeOverviewView({ city });
    return {
      content: result.data?.content || buildHomepageContent({ city }),
      errors: result.data?.errors || [],
    };
  }

  const errors = [];
  const [featuredResult, eventsResult, selectsResult, interviewsResult] = await Promise.all([
    guestServerJson(`/public/events/featured?limit=6&city=${encodeURIComponent(city)}`, {
      forwardCookies: false,
      next: { revalidate: 60 },
    }),
    guestServerJson(`/public/events?city=${encodeURIComponent(city)}&limit=30&sort=heat`, {
      forwardCookies: false,
      next: { revalidate: 60 },
    }),
    guestServerJson('/public/homepage/selects', {
      forwardCookies: false,
      next: { revalidate: 300 },
    }),
    guestServerJson('/public/homepage/interviews', {
      forwardCookies: false,
      next: { revalidate: 300 },
    }),
  ]);

  if (!featuredResult.response.ok) errors.push('Featured events are temporarily unavailable.');
  if (!eventsResult.response.ok) errors.push('The live event feed is temporarily unavailable.');
  if (!selectsResult.response.ok) errors.push('Curated selects could not be loaded.');
  if (!interviewsResult.response.ok) errors.push('Interview stories could not be loaded.');

  const content = buildHomepageContent({
    featuredEvents: featuredResult.response.ok
      ? featuredResult.data?.items || featuredResult.data?.events || []
      : [],
    events: eventsResult.response.ok
      ? eventsResult.data?.items || eventsResult.data?.events || []
      : [],
    selects: selectsResult.response.ok ? selectsResult.data || [] : [],
    interviews: interviewsResult.response.ok ? interviewsResult.data || [] : [],
    city,
  });

  return { content, errors };
}

export default async function HomePage() {
  const { content, errors } = await loadHomeData();
  return <PageClient initialData={content} initialErrors={errors} />;
}
