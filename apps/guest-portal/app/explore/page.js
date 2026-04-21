import { fetchFeaturedEvents, fetchPublicEvents } from "../../lib/server/publicDiscoveryBridge.js";
import ExploreClient from "../../components/ExploreClient";

export const revalidate = 60;

export default async function ExplorePage() {
  let initialEvents = [];
  let initialFeaturedEvents = [];
  try {
    const [eventsResult, featuredResult] = await Promise.allSettled([
      fetchPublicEvents({ limit: 12, sort: "soonest" }, { cache: "force-cache" }),
      fetchFeaturedEvents({ limit: 6 }, { cache: "force-cache" }),
    ]);

    if (eventsResult.status === "fulfilled") {
      initialEvents = eventsResult.value?.items || [];
    }
    if (featuredResult.status === "fulfilled") {
      initialFeaturedEvents = featuredResult.value?.items || [];
    }
  } catch {
    // ExploreClient will client-fetch on mount as fallback
  }
  return <ExploreClient initialEvents={initialEvents} initialFeaturedEvents={initialFeaturedEvents} />;
}
