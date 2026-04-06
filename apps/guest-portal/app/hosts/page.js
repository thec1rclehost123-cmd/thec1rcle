import { listVenues } from "../../lib/server/venueStore";
import { listHosts } from "../../lib/server/hostStore";
import HostsClient from "./HostsClient";

// ISR: revalidate every 5 minutes — same as the Redis cache TTL on these stores
export const revalidate = 300;

export default async function HostsPage() {
  let initialVenues = [];
  let initialHosts = [];

  try {
    const [venuesResult, hostsResult] = await Promise.allSettled([
      listVenues({}),
      listHosts({}),
    ]);

    if (venuesResult.status === "fulfilled") initialVenues = venuesResult.value || [];
    if (hostsResult.status === "fulfilled") initialHosts = hostsResult.value || [];
  } catch {
    // HostsClient will client-fetch on mount as fallback
  }

  return <HostsClient initialVenues={initialVenues} initialHosts={initialHosts} />;
}
