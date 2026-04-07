"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
    UserPlus, Circle, ChevronDown, Ticket, UtensilsCrossed,
} from "lucide-react";
import { HubTabBar } from "@/components/shared/HubTabBar";
import { useHubTab } from "@/lib/hooks/useHubTab";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { DoorHubContext } from "@/lib/context/DoorHubContext";
import { cn } from "@/lib/utils";

// Lazy-import existing PageClients — each stays in its own chunk
import { WalkInsClient } from "../walk-ins/PageClient";
import { DoorSellClient } from "./sell/PageClient";
import { DoorDineinClient } from "./dinein/PageClient";

const TABS = [
    { key: "sell",    label: "Ticket Purchase", icon: Ticket },
    { key: "walkins", label: "Walk-Ins",         icon: UserPlus },
    { key: "dinein",  label: "Dine-in",          icon: UtensilsCrossed },
];


function TabContent({ activeTab }: { activeTab: string }) {
    switch (activeTab) {
        case "sell":    return <DoorSellClient />;
        case "walkins": return <WalkInsClient />;
        case "dinein":  return <DoorDineinClient />;
        default:        return <DoorSellClient />;
    }
}

export default function DoorPageClient() {
    const { profile } = useDashboardAuth();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { activeTab, setTab } = useHubTab("sell");

    const venueId = profile?.activeMembership?.partnerId ?? "";
    const eventId = searchParams.get("eventId") ?? "";

    const [events, setEvents] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [eventsOpen, setEventsOpen] = useState(false);

    const authHeaders = useCallback(() => ({
        "Content-Type": "application/json",
        Authorization: `Bearer ${(profile as any)?._token ?? ""}`,
    }), [profile]);

    const handleEventChange = useCallback((id: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("eventId", id);
        router.replace(`${pathname}?${params.toString()}`);
        setEventsOpen(false);
    }, [pathname, router, searchParams]);

    // Fetch events list once (only needs venueId)
    useEffect(() => {
        if (!venueId) return;
        fetch(`/api/venue/events?venueId=${venueId}`, { headers: authHeaders() })
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d) setEvents(d.events ?? []); });
    }, [venueId, authHeaders]);

    const selectedEvent = events.find(e => e.id === eventId);

    return (
        <DoorHubContext.Provider value={{
            eventId,
            venueId,
            events,
            summary: null,
            openExceptions: 0,
            isLoading,
            setEventId: handleEventChange,
        }}>
            <div className="space-y-4">
                {/* Hub header */}
                <div>
                    <h1 className="v-text-title font-semibold" style={{ color: "var(--v-text-primary)" }}>
                        Door
                    </h1>
                    <p className="mt-1 text-[14px]" style={{ color: "var(--v-text-secondary)" }}>
                        On-ground operations — guests, walk-ins, scanning, and registers.
                    </p>
                </div>

                {/* Tab bar */}
                <HubTabBar tabs={TABS} activeTab={activeTab} onTabChange={setTab} />

                {/* Event selector */}
                <div className="relative">
                    <button
                        onClick={() => setEventsOpen(o => !o)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all border"
                        style={{ background: "var(--v-card)", borderColor: "var(--v-border)", color: "var(--v-text-primary)" }}
                    >
                        <Circle
                            size={8}
                            className={selectedEvent?.status === "live" ? "text-green-400 fill-green-400" : "text-slate-400 fill-slate-400"}
                        />
                        <span className="truncate max-w-[260px]">
                            {selectedEvent?.title ?? (events.length === 0 ? "No events found" : "Select an event to begin")}
                        </span>
                        <ChevronDown size={13} className="text-[var(--v-text-muted)] shrink-0 ml-1" />
                    </button>

                    {eventsOpen && events.length > 0 && (
                        <div
                            className="absolute top-full left-0 mt-1 z-50 min-w-[280px] rounded-xl border shadow-xl overflow-hidden"
                            style={{ background: "var(--v-card)", borderColor: "var(--v-border)" }}
                        >
                            {events.map(event => (
                                <button
                                    key={event.id}
                                    onClick={() => handleEventChange(event.id)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-4 py-3 text-left text-[13px] hover:bg-[var(--v-card-hover)] transition-colors",
                                        event.id === eventId && "bg-[var(--v-elevated)]"
                                    )}
                                >
                                    <Circle
                                        size={8}
                                        className={event.status === "live" ? "text-green-400 fill-green-400" : "text-slate-400 fill-slate-400"}
                                    />
                                    <div>
                                        <div className="font-medium text-[var(--v-text-primary)]">{event.title}</div>
                                        {event.startDate && (
                                            <div className="text-[11px] text-[var(--v-text-muted)]">
                                                {new Date(event.startDate).toLocaleDateString("en-IN", {
                                                    weekday: "short", month: "short", day: "numeric",
                                                    hour: "2-digit", minute: "2-digit",
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Tab content */}
                <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
                    <TabContent activeTab={activeTab} />
                </Suspense>
            </div>
        </DoorHubContext.Provider>
    );
}

