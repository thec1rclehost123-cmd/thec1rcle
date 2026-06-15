import {
  fetchFeaturedEvents,
  fetchHomepageInterviews,
  fetchHomepageSelects,
  fetchPublicEvents,
} from './publicDiscovery.js';
import { buildHomepageContent, getHomepageCity, heroVideoSrc } from './homepageContent';
import { fetchGuestBffHomeOverview } from '../../lib/bff/fetchers.js';
import { isGuestBffEnabled } from '../../lib/bff/flags.js';

export { buildHomepageContent, heroVideoSrc };

export async function loadHomepageContent(city) {
  const selectedCity = getHomepageCity(city);

  if (isGuestBffEnabled('home')) {
    const overview = await fetchGuestBffHomeOverview({ city: selectedCity });
    return (
      overview?.content ||
      buildHomepageContent({
        city: selectedCity,
        events: overview?.events || [],
        featuredEvents: overview?.featuredEvents || [],
        interviews: overview?.interviews || [],
        selects: overview?.selects || [],
      })
    );
  }

  const [featuredEvents, events, selects, interviews] = await Promise.all([
    fetchFeaturedEvents({ limit: 6, city: selectedCity }).then((result) => result?.items || []),
    fetchPublicEvents({ city: selectedCity, limit: 30, sort: 'heat' }).then(
      (result) => result?.items || [],
    ),
    fetchHomepageSelects(),
    fetchHomepageInterviews(),
  ]);

  return buildHomepageContent({ featuredEvents, events, selects, interviews, city: selectedCity });
}
