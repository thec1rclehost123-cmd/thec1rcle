"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { useDoorHub } from "@/lib/context/DoorHubContext";
import type { GuestOpsOverview } from "@/lib/types/guestOps";

export interface GuestOpsShellData {
    eventId: string;
    venueId: string;
    events: Array<{ id: string; title: string; startDate?: string; status?: string }>;
    summary: GuestOpsOverview | null;
    openExceptions: number;
    isLoading: boolean;
    authHeaders: () => { "Content-Type": string; Authorization: string };
}

/**
 * Returns shell context data for GuestOps pages.
 * When inside DoorHubContext (hub mode), uses hub's shared state to avoid redundant fetches.
 * When used standalone (direct /venue/guest-ops/* navigation), fetches its own data.
 */
export function useGuestOpsShellData(): GuestOpsShellData {
    const hub = useDoorHub();
    const { profile } = useDashboardAuth();
    const searchParams = useSearchParams();

    const venueId = hub?.venueId ?? profile?.activeMembership?.partnerId ?? "";
    const eventId = hub?.eventId ?? searchParams.get("eventId") ?? "";

    const authHeaders = useCallback(() => ({
        "Content-Type": "application/json" as const,
        Authorization: `Bearer ${(profile as any)?._token ?? ""}`,
    }), [profile]);

    // Standalone state — only populated when NOT in hub mode
    const [standaloneEvents, setStandaloneEvents] = useState<any[]>([]);
    const [standaloneSummary, setStandaloneSummary] = useState<GuestOpsOverview | null>(null);
    const [standaloneOpenExceptions, setStandaloneOpenExceptions] = useState(0);
    const [standaloneLoading, setStandaloneLoading] = useState(true);

    // Fetch events list whenever venueId is known (independent of eventId)
    useEffect(() => {
        if (hub) return;
        if (!venueId) return;
        fetch(`/api/partners/venues/events?venueId=${venueId}`, { headers: authHeaders() })
            .then(r => r.ok ? r.json() : { events: [] })
            .then(d => setStandaloneEvents(d.events ?? []))
            .catch(() => {});
    }, [hub, venueId, authHeaders]);

    // Fetch event-specific data only when an eventId is selected
    useEffect(() => {
        if (hub) return;
        if (!eventId || !venueId) { setStandaloneLoading(false); return; }

        setStandaloneLoading(true);
        Promise.all([
            fetch(`/api/partners/venues/guest-ops/${eventId}/summary?venueId=${venueId}`, { headers: authHeaders() }),
            fetch(`/api/partners/venues/guest-ops/${eventId}/exceptions?venueId=${venueId}&status=open`, { headers: authHeaders() }),
        ]).then(async ([sumRes, excRes]) => {
            if (sumRes.ok) setStandaloneSummary(await sumRes.json());
            if (excRes.ok) { const d = await excRes.json(); setStandaloneOpenExceptions(d.openCount ?? 0); }
        }).finally(() => setStandaloneLoading(false));
    }, [hub, eventId, venueId, authHeaders]);

    if (hub) {
        return {
            eventId,
            venueId,
            events: hub.events,
            summary: hub.summary,
            openExceptions: hub.openExceptions,
            isLoading: hub.isLoading,
            authHeaders,
        };
    }

    return {
        eventId,
        venueId,
        events: standaloneEvents,
        summary: standaloneSummary,
        openExceptions: standaloneOpenExceptions,
        isLoading: standaloneLoading,
        authHeaders,
    };
}
