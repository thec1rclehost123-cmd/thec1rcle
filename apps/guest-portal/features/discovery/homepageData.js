import {
  fetchFeaturedEvents,
  fetchHomepageInterviews,
  fetchHomepageSelects,
  fetchPublicEvents,
} from "./publicDiscovery.js";
import { buildHomepageContent, getHomepageCity, heroVideoSrc } from "./homepageContent";

export { buildHomepageContent, heroVideoSrc };

export async function loadHomepageContent(city) {
  const selectedCity = getHomepageCity(city);
  const [featuredEvents, events, selects, interviews] = await Promise.all([
    fetchFeaturedEvents({ limit: 6, city: selectedCity }).then((result) => result?.items || []),
    fetchPublicEvents({ city: selectedCity, limit: 30, sort: "heat" }).then((result) => result?.items || []),
    fetchHomepageSelects(),
    fetchHomepageInterviews(),
  ]);

  return buildHomepageContent({ featuredEvents, events, selects, interviews, city: selectedCity });
}
