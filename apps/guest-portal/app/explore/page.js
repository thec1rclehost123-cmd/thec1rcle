import { listEvents } from "../../lib/server/eventStore";
import { getFeaturedEvents } from "../../lib/server/featuredFeed";
import ExploreClient from "../../components/ExploreClient";

export const revalidate = 60;

export default async function ExplorePage() {
  let initialEvents = [];
  let initialFeaturedEvents = [];
  try {
    const [eventsResult, featuredResult] = await Promise.allSettled([
      listEvents({ limit: 12, sort: "soonest" }),
      getFeaturedEvents(),
    ]);

    if (eventsResult.status === "fulfilled") {
      initialEvents = eventsResult.value || [];
    }
    if (featuredResult.status === "fulfilled") {
      initialFeaturedEvents = featuredResult.value || [];
    }
  } catch {
    // ExploreClient will client-fetch on mount as fallback
  }
  return <ExploreClient initialEvents={initialEvents} initialFeaturedEvents={initialFeaturedEvents} />;
}
