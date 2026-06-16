/**
 * DemoDataProvider
 *
 * When DEMO_MODE is true (see lib/demo/index.ts), this component hydrates all
 * Zustand stores with realistic dummy data on first mount — bypassing Firestore
 * entirely. Use this to showcase every screen without needing a live backend.
 *
 * Toggle: set DEMO_MODE = true/false in lib/demo/index.ts
 */

import { useEffect } from "react";
import {
    DEMO_MODE,
    DEMO_EVENTS,
    DEMO_VENUES,
    DEMO_ORDERS,
    DEMO_NOTIFICATIONS,
    DEMO_DATING_PROFILES,
    DEMO_EXTRA_DATING_PROFILES,
    DEMO_EXTENDED_PROFILES,
    DEMO_MATCHES,
    DEMO_USER_PROFILE,
    DEMO_SOCIAL_PROFILE,
} from "@/lib/demo";

import { useEventsStore } from "@/store/eventsStore";
import { useVenuesStore } from "@/store/venuesStore";
import { useTicketsStore } from "@/store/ticketsStore";
import { useNotificationsStore } from "@/store/notificationsStore";
import { useDatingStore } from "@/store/datingStore";
import { useProfileStore } from "@/store/profileStore";
import { useSocialProfileStore } from "@/store/socialProfileStore";
import { useFollowStore } from "@/store/followStore";

// No-op async that returns immediately — replaces Firestore fetches in demo mode
const noop = async () => {};

export function DemoDataProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        if (!DEMO_MODE) return;

        // ── Events ──────────────────────────────────────────────────────────
        const featuredEvents = DEMO_EVENTS.filter((e) => e.isFeatured);
        useEventsStore.setState({
            events: DEMO_EVENTS as any,
            featuredEvents: featuredEvents as any,
            loading: false,
            featuredLoading: false,
            searching: false,
            searchResults: [],
            error: null,
            hasMore: false,
            // Replace all fetch methods with no-ops so live re-fetches don't wipe demo data
            fetchEvents: noop,
            fetchFeaturedEvents: noop,
            fetchPublicEvents: noop,
            searchEvents: noop as any,
            loadMoreEvents: noop,
            fetchByCategory: noop as any,
            loadMoreByCategory: noop as any,
        });

        // ── Venues ───────────────────────────────────────────────────────────
        useVenuesStore.setState({
            venues: DEMO_VENUES as any,
            loading: false,
            error: null,
            fetchVenues: noop as any,
        });

        // ── Tickets / Orders ─────────────────────────────────────────────────
        useTicketsStore.setState({
            orders: DEMO_ORDERS as any,
            loading: false,
            error: null,
            fetchUserOrders: noop as any,
        });

        // ── Notifications ────────────────────────────────────────────────────
        const unreadCount = DEMO_NOTIFICATIONS.filter((n) => !n.read).length;
        useNotificationsStore.setState({
            notifications: DEMO_NOTIFICATIONS as any,
            unreadCount,
            loading: false,
            error: null,
            fetchNotifications: noop as any,
            subscribeToNotifications: (() => noop) as any,
        });

        // ── Dating ───────────────────────────────────────────────────────────
        // Combine all profile pools (33 total) so the deck never runs out during a demo
        const allDatingProfiles = [
            ...DEMO_DATING_PROFILES,
            ...DEMO_EXTRA_DATING_PROFILES,
            ...DEMO_EXTENDED_PROFILES,
        ] as any[];

        useDatingStore.setState({
            profiles: allDatingProfiles,
            matches: DEMO_MATCHES as any,
            loading: false,
            matchesLoading: false,
            error: null,
            fetchProfiles: noop as any,
            fetchMatches: noop as any,
            // Override removeTopProfile to cycle back to full pool instead of depleting
            removeTopProfile: () => {
                useDatingStore.setState((s: any) => ({
                    profiles: s.profiles.length <= 1
                        ? [...allDatingProfiles]
                        : s.profiles.slice(1),
                }));
            },
        });

        // ── User Profile ─────────────────────────────────────────────────────
        useProfileStore.setState({
            profile: DEMO_USER_PROFILE as any,
            loading: false,
            error: null,
            loadProfile: noop as any,
        });

        // ── Social Profile ───────────────────────────────────────────────────
        useSocialProfileStore.setState({
            socialState: DEMO_SOCIAL_PROFILE.state,
            socialProfile: DEMO_SOCIAL_PROFILE as any,
            loading: false,
            loadSocialProfile: noop as any,
        });

        // ── Follows ──────────────────────────────────────────────────────────
        // Pre-follow a couple of venues/hosts so the follow button shows active state
        useFollowStore.setState({
            followedVenueIds: new Set(["demo-venue-01", "demo-venue-05"]),
            followedHostIds: new Set(["demo-host-03"]),
            loaded: true,
            fetchFollows: noop as any,
        });
    }, []);

    return <>{children}</>;
}
