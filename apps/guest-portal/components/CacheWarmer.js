"use client";

import { useEffect } from "react";
import { useAuth } from "./providers/AuthProvider";
import { useExploreStore } from "../store/exploreStore";
import { useHostsStore } from "../store/hostsStore";
import { useTicketsStore } from "../store/ticketsStore";

/**
 * ⚡ CacheWarmer: Proactive Background Data Loading
 *
 * This component runs once at the root layout (under providers).
 * It "pre-warms" the global Zustand caches for high-traffic pages
 * so that when the user clicks 'Explore' or 'Hosts', the data is
 * already there — zero loading spinner.
 */
export default function CacheWarmer() {
  const { user, loading: authLoading } = useAuth();

  // Store Actions
  const fetchEvents = useExploreStore((s) => s.fetchEvents);
  const fetchHosts = useHostsStore((s) => s.fetchData);
  const loadTickets = useTicketsStore((s) => s.loadTickets);

  useEffect(() => {
    // 1. Pre-warm Explore (Events)
    // This is the most common landing page logic
    fetchEvents().catch((err) => console.error("CacheWarmer: Failed to pre-warm Explore", err));

    // 2. Pre-warm Hosts (Venues default tab)
    fetchHosts({ activeTab: "venues" }).catch((err) =>
      console.error("CacheWarmer: Failed to pre-warm Hosts", err),
    );
  }, [fetchEvents, fetchHosts]);

  useEffect(() => {
    // 3. Pre-warm Tickets (only if user is logged in)
    if (user && !authLoading) {
      loadTickets(user.uid).catch((err) =>
        console.error("CacheWarmer: Failed to pre-warm Tickets", err),
      );
    }
  }, [user, authLoading, loadTickets]);

  // This component renders nothing, it just manages side effects
  return null;
}
