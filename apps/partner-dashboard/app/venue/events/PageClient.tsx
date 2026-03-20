"use client";

import { useState, useEffect, forwardRef, memo, useCallback, useMemo } from "react";
import { VirtuosoGrid } from "react-virtuoso";
import {
    Calendar, Plus, BarChart3, ShieldCheck, Edit, Loader2, Play, Pause,
} from "lucide-react";
import Link from "next/link";
import { DashboardEventCard } from "@c1rcle/ui";
import { EventDetailsModal } from "@/components/venue-layout/EventDetailsModal";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { mapEventForClient, EVENT_LIFECYCLE } from "@c1rcle/core/events";
import { parseAsIST } from "@c1rcle/core/time";
import { VenuePageShell } from "@/components/venue-layout/VenuePageShell";
import { PageToolbar, SearchInput } from "@/components/ui/PageToolbar";
import { TabBar } from "@/components/ui/TabBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { SurfaceCard } from "@/components/ui/SurfaceCard";

interface Event {
    id: string;
    title: string;
    date: Date;
    startDate?: string;
    hostId: string;
    hostName: string;
    venueId: string;
    lifecycle?: string;
    status: "draft" | "pending" | "approved" | "live" | "completed" | "cancelled" | "scheduled";
    ticketsSold: number;
    ticketsTotal: number;
    capacity?: number;
    expectedCrowd: number;
    promotersEnabled: boolean;
    promotersCount?: number;
    revenue?: number;
    stats?: { ticketsSold?: number; revenue?: number };
    eventType: "venue" | "host";
    canApprove: boolean;
    canEdit: boolean;
    canRequestEdits: boolean;
}

// ── Virtuoso grid containers ──────────────────────────────────────────────────
const GridList = forwardRef<HTMLDivElement>((props, ref) => (
    <div {...props} ref={ref} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5" />
));
GridList.displayName = "GridList";

// Natural height — no fixed 340px
const GridItem = forwardRef<HTMLDivElement>((props, ref) => (
    <div {...props} ref={ref} />
));
GridItem.displayName = "GridItem";

// ── Memoized event card ───────────────────────────────────────────────────────
const MemoizedVenueEventCard = memo(({ event, index, handleEventUpdate }: any) => {
    const effectiveStatus = event.lifecycle || event.status;

    const getPrimaryAction = (e: any) => {
        if (e.canApprove) return { label: "Review", href: `/venue/events/${e.id}`, icon: <ShieldCheck size={14} /> };
        return { label: "Analytics", href: `/venue/analytics/overview?eventId=${e.id}`, icon: <BarChart3 size={14} /> };
    };

    const secondaryActions: any[] = [];
    if (event.canEdit) secondaryActions.push({ label: "Edit", icon: <Edit size={14} />, href: `/venue/create?id=${event.id}` });
    if (effectiveStatus === "live") secondaryActions.push({ label: "Pause Sales", icon: <Pause size={14} />, onClick: () => handleEventUpdate("pause", null, event.id), color: "red" });
    else if (effectiveStatus === "paused") secondaryActions.push({ label: "Resume Sales", icon: <Play size={14} />, onClick: () => handleEventUpdate("resume", null, event.id) });

    return (
        <DashboardEventCard
            event={event}
            index={index}
            role="venue"
            primaryAction={getPrimaryAction(event)}
            secondaryActions={secondaryActions}
            showStats={true}
            height="h-full"
        />
    );
});
MemoizedVenueEventCard.displayName = "MemoizedVenueEventCard";

// ── Page ──────────────────────────────────────────────────────────────────────
export default function EventsManagementPage() {
    const { profile, user } = useDashboardAuth();
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        if (!profile?.activeMembership?.partnerId || !user) return;
        const venueId = profile.activeMembership.partnerId;

        (async () => {
            try {
                const token = await user.getIdToken();
                const res = await fetch(`/api/venue/events?venueId=${venueId}&status=all`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) throw new Error("API Route failed");
                const { events: raw } = await res.json();
                const mapped: Event[] = raw
                    .map((r: any) => {
                        const m = mapEventForClient(r, r.id) as any;
                        return {
                            ...m,
                            title: m.title || m.name || "Untitled Event",
                            date: parseAsIST(m.startDate || m.date),
                            hostName: m.hostName || m.host || "Unknown Host",
                            hostId: m.hostId || m.creatorId,
                            venueId: m.venueId || r.venueId || venueId,
                            venueName: m.venueName || r.venueName || r.venue || profile?.activeMembership?.partnerName || "Your Venue",
                            status: m.lifecycle as any,
                            ticketsSold: m.stats?.ticketsSold || 0,
                            ticketsTotal: m.capacity || m.tickets?.reduce((s: number, t: any) => s + (t.quantity || 0), 0) || 0,
                            expectedCrowd: m.capacity || 0,
                            promotersCount: m.promoterSettings?.allowedPromoterIds?.length || 0,
                            revenue: m.stats?.revenue || 0,
                        };
                    })
                    .filter((e: any) => !(e.eventType === "host" && e.creatorId !== venueId && e.lifecycle === "draft"))
                    .sort((a: any, b: any) => {
                        const now = new Date();
                        const dateA = a.date instanceof Date ? a.date : new Date(a.date);
                        const dateB = b.date instanceof Date ? b.date : new Date(b.date);
                        const isFutureA = dateA > now && a.status !== "draft";
                        const isFutureB = dateB > now && b.status !== "draft";
                        if (isFutureA && !isFutureB) return -1;
                        if (!isFutureA && isFutureB) return 1;
                        if (isFutureA && isFutureB) return dateA.getTime() - dateB.getTime();
                        return dateB.getTime() - dateA.getTime();
                    });
                setEvents(mapped);
            } catch { }
            finally { setLoading(false); }
        })();
    }, [profile, user]);

    const handleEventUpdate = useCallback(async (action: string, data?: any, overrideEventId?: string) => {
        const eventId = overrideEventId || selectedEvent?.id;
        if (!eventId || !user) return;
        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/venue/events", {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ eventId, action, data }),
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
            const newStatusMap: Record<string, string> = {
                approve: EVENT_LIFECYCLE.SCHEDULED,
                reject: EVENT_LIFECYCLE.DENIED,
                pause: EVENT_LIFECYCLE.PAUSED,
                resume: EVENT_LIFECYCLE.SCHEDULED,
            };
            const mappedStatus = newStatusMap[action];
            setEvents((prev) => prev.map((e) => e.id === eventId ? { ...e, status: (mappedStatus || e.status) as any } : e));
        } catch (e: any) { alert(e.message); }
    }, [selectedEvent?.id, user]);

    const getStatus = (e: Event) => e.lifecycle || e.status;

    // ── Counts ────────────────────────────────────────────────────────────────
    const liveCount      = useMemo(() => events.filter((e) => getStatus(e) === EVENT_LIFECYCLE.LIVE).length, [events]);
    const pendingCount   = useMemo(() => events.filter((e) => e.eventType === "host" && getStatus(e) === EVENT_LIFECYCLE.SUBMITTED).length, [events]);
    const draftCount     = useMemo(() => events.filter((e) => e.eventType === "venue" && getStatus(e) === EVENT_LIFECYCLE.DRAFT).length, [events]);
    const publishedCount = useMemo(() => events.filter((e) => [EVENT_LIFECYCLE.SCHEDULED, EVENT_LIFECYCLE.APPROVED].includes(getStatus(e) as string)).length, [events]);
    const totalRevenue   = useMemo(() => events.reduce((s, e) => s + (e.revenue || 0), 0), [events]);

    const filterTabs = [
        { key: "all",       label: "All",       count: events.length  },
        { key: "live",      label: "Live",      count: liveCount      },
        { key: "pending",   label: "Pending",   count: pendingCount   },
        { key: "approved",  label: "Published", count: publishedCount },
        { key: "draft",     label: "Drafts",    count: draftCount     },
        { key: "completed", label: "Completed"                        },
    ];

    const filteredEvents = useMemo(() => events.filter((e) => {
        const s = getStatus(e);
        let match = filter === "all";
        if (filter === "draft")     match = e.eventType === "venue" && s === EVENT_LIFECYCLE.DRAFT;
        if (filter === "pending")   match = e.eventType === "host"  && s === EVENT_LIFECYCLE.SUBMITTED;
        if (filter === "live")      match = s === EVENT_LIFECYCLE.LIVE;
        if (filter === "approved")  match = s === EVENT_LIFECYCLE.APPROVED || s === EVENT_LIFECYCLE.SCHEDULED;
        if (filter === "completed") match = s === EVENT_LIFECYCLE.COMPLETED;
        return match && (
            e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.hostName.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }), [events, filter, searchQuery]);

    return (
        <VenuePageShell
            title="Events"
            actions={
                <Link href="/venue/create">
                    <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-sm)] text-[12px] font-[600] bg-[var(--accent)] text-white hover:opacity-90 transition-opacity active:scale-[0.98]">
                        <Plus className="w-3.5 h-3.5" />
                        New Event
                    </button>
                </Link>
            }
            toolbar={
                <PageToolbar
                    left={
                        <TabBar
                            mode="underline"
                            tabs={filterTabs}
                            active={filter}
                            onChange={setFilter}
                        />
                    }
                    right={
                        <SearchInput
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder="Search events or hosts…"
                        />
                    }
                />
            }
        >
            <div className="flex flex-col gap-5">

                {/* ── Compact ambient KPI strip ── */}
                <SurfaceCard padding="none">
                    <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[var(--border-subtle)]">
                        {[
                            { label: "LIVE NOW",  value: loading ? "—" : liveCount,      sub: "active"       },
                            { label: "PENDING",   value: loading ? "—" : pendingCount,    sub: "for review"   },
                            { label: "PUBLISHED", value: loading ? "—" : publishedCount,  sub: "scheduled"    },
                            {
                                label: "REVENUE",
                                value: loading ? "—" : totalRevenue >= 100000
                                    ? `₹${(totalRevenue / 100000).toFixed(1)}L`
                                    : `₹${(totalRevenue / 1000).toFixed(1)}K`,
                                sub: "all time",
                            },
                        ].map((stat, i) => (
                            <div key={i} className="px-5 py-3 flex flex-col gap-0.5">
                                <p className="text-[12px] font-[600] uppercase tracking-[0.05em] text-[var(--text-tertiary)]">{stat.label}</p>
                                <p className="text-[22px] font-[600] leading-none tabular-nums text-[var(--text-primary)]"
                                    style={{ fontVariantNumeric: "tabular-nums" }}>
                                    {stat.value}
                                </p>
                                <p className="text-[13px] text-[var(--text-tertiary)]">{stat.sub}</p>
                            </div>
                        ))}
                    </div>
                </SurfaceCard>

                {/* ── Events Grid ── */}
                {loading ? (
                    <div className="py-20 flex flex-col items-center gap-3">
                        <Loader2 className="w-5 h-5 animate-spin text-[var(--text-tertiary)]" />
                        <p className="text-[12px] text-[var(--text-tertiary)]">Loading events…</p>
                    </div>
                ) : filteredEvents.length === 0 ? (
                    <EmptyState
                        icon={Calendar}
                        title="No events found"
                        description="Try adjusting your filters or search terms."
                        action={
                            <button
                                onClick={() => { setFilter("all"); setSearchQuery(""); }}
                                className="text-[13px] font-[500] text-[var(--text-secondary)] underline"
                            >
                                Reset filters
                            </button>
                        }
                    />
                ) : (
                    <VirtuosoGrid
                        useWindowScroll
                        data={filteredEvents}
                        components={{ List: GridList, Item: GridItem }}
                        itemContent={(index, event) => (
                            <MemoizedVenueEventCard
                                key={event.id}
                                event={event}
                                index={index}
                                handleEventUpdate={handleEventUpdate}
                            />
                        )}
                    />
                )}
            </div>

            {selectedEvent && (
                <EventDetailsModal
                    event={selectedEvent as any}
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onEventUpdate={handleEventUpdate}
                />
            )}
        </VenuePageShell>
    );
}
