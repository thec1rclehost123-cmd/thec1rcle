import { listEvents } from "../../lib/server/eventStore";
import ExploreClient from "../../components/ExploreClient";

export const revalidate = 60;

export default async function ExplorePage() {
  let initialEvents = [];
  try {
    const events = await listEvents({ limit: 12, sort: "soonest" });
    initialEvents = events || [];
  } catch {
    // ExploreClient will client-fetch on mount as fallback
  }
  return <ExploreClient initialEvents={initialEvents} />;
}
