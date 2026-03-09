"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
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
    const pathname = usePathname();

    // Store Actions
    const fetchEvents = useExploreStore((s) => s.fetchEvents);
    const fetchHosts = useHostsStore((s) => s.fetchData);
    const loadTickets = useTicketsStore((s) => s.loadTickets);

    useEffect(() => {
        // Skip pre-warming on pages that already self-fetch this data to avoid duplicate Firestore reads:
        // - '/' (home): ISR-served HTML already includes event data
        // - '/explore': ExploreStore.fetchEvents() fires on mount
        // - '/hosts': HostsStore.fetchData() fires on mount
        // Also skip entirely on /checkout/* — user is mid-funnel, don't compete with payment
        if (pathname.startsWith("/checkout")) return;

        const skipEvents = pathname === "/" || pathname === "/explore";
        const skipHosts = pathname === "/hosts";

        if (skipEvents && skipHosts) return;

        // Defer until the browser is idle so we don't compete with the first render / LCP.
        // timeout:3000 ensures it still runs even on busy devices within 3 s.
        const ric = typeof requestIdleCallback !== "undefined" ? requestIdleCallback : (cb) => setTimeout(cb, 200);
        const cancel = typeof cancelIdleCallback !== "undefined" ? cancelIdleCallback : clearTimeout;

        const id = ric(
            () => {
                // 1. Pre-warm Explore (Events)
                if (!skipEvents) {
                    fetchEvents().catch(err => console.error("CacheWarmer: Failed to pre-warm Explore", err));
                }

                // 2. Pre-warm Hosts (Venues default tab)
                if (!skipHosts) {
                    fetchHosts({ activeTab: "venues" }).catch(err => console.error("CacheWarmer: Failed to pre-warm Hosts", err));
                }
            },
            { timeout: 3000 }
        );

        return () => cancel(id);
    }, [fetchEvents, fetchHosts, pathname]);

    useEffect(() => {
        // 3. Pre-warm Tickets (only if user is logged in)
        if (user && !authLoading) {
            const ric = typeof requestIdleCallback !== "undefined" ? requestIdleCallback : (cb) => setTimeout(cb, 200);
            const cancel = typeof cancelIdleCallback !== "undefined" ? cancelIdleCallback : clearTimeout;

            const id = ric(
                () => loadTickets(user.uid).catch(err => console.error("CacheWarmer: Failed to pre-warm Tickets", err)),
                { timeout: 3000 }
            );

            return () => cancel(id);
        }
    }, [user, authLoading, loadTickets]);

    return null;
}
