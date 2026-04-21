import { fetchPublicHosts, fetchPublicVenues } from "../../lib/server/publicDiscoveryBridge.js";
import HostsClient from "./HostsClient";

// ISR: revalidate every 5 minutes — same as the Redis cache TTL on these stores
export const revalidate = 300;

export default async function HostsPage() {
  let initialVenues = [];
  let initialHosts = [];

  try {
    const [venuesResult, hostsResult] = await Promise.allSettled([
      fetchPublicVenues({ limit: 12, sort: "Popular" }, { cache: "force-cache" }),
      fetchPublicHosts({ limit: 12, sort: "Popular" }, { cache: "force-cache" }),
    ]);

    if (venuesResult.status === "fulfilled") initialVenues = venuesResult.value?.items || [];
    if (hostsResult.status === "fulfilled") initialHosts = hostsResult.value?.items || [];
  } catch {
    // HostsClient will client-fetch on mount as fallback
  }

  return <HostsClient initialVenues={initialVenues} initialHosts={initialHosts} />;
}
