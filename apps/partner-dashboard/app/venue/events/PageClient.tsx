"use client";

import { useState, useEffect, forwardRef, memo, useCallback, useMemo } from "react";
import { VirtuosoGrid } from "react-virtuoso";
import {
    Calendar, DollarSign, Search, Plus, CheckCircle2,
    AlertCircle, Edit, Loader2, BarChart3, ShieldCheck, Play, Pause
} from "lucide-react";
import Link from "next/link";
import { DashboardEventCard } from "@c1rcle/ui";
import { EventDetailsModal } from "@/components/venue-layout/EventDetailsModal";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { mapEventForClient, EVENT_LIFECYCLE } from "@c1rcle/core/events";
import { parseAsIST } from "@c1rcle/core/time";
import { VenuePageShell, VenueActionButton, VenueFilterTabs } from "@/components/venue-layout/VenuePageShell";

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

// ── Virtuoso grid containers ──
const GridList = forwardRef<HTMLDivElement>((props, ref) => (
    <div
        {...props}
        ref={ref}
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
    />
));
GridList.displayName = "GridList";

const GridItem = forwardRef<HTMLDivElement>((props, ref) => (
    <div {...props} ref={ref} className="h-[340px] w-full" />
));
GridItem.displayName = "GridItem";

// ── Memoized event card (unchanged logic) ──
const MemoizedVenueEventCard = memo(({ event, index, handleEventUpdate }: any) => {
    const effectiveStatus = event.lifecycle || event.status;

    const getPrimaryAction = (e: any) => {
        if (e.canApprove) return { label: "Review Submission", href: `/venue/events/${e.id}`, icon: <ShieldCheck size={16} /> };
        return { label: "View Analytics", href: `/venue/events/${e.id}`, icon: <BarChart3 size={16} /> };
    };

    const secondaryActions: any[] = [];
    if (event.canEdit) secondaryActions.push({ label: "Edit Event", icon: <Edit size={16} />, href: `/venue/create?id=${event.id}` });
    if (effectiveStatus === "live") secondaryActions.push({ label: "Pause Ticket Sales", icon: <Pause size={16} />, onClick: () => handleEventUpdate("pause", null, event.id), color: "red" });
    else if (effectiveStatus === "paused") secondaryActions.push({ label: "Resume Ticket Sales", icon: <Play size={16} />, onClick: () => handleEventUpdate("resume", null, event.id) });

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

// ── Page ──
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
                    .sort((a: any, b: any) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
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
                resume: EVENT_LIFECYCLE.SCHEDULED
            };
            const mappedStatus = newStatusMap[action];
            setEvents((prev) => prev.map((e) => e.id === eventId ? { ...e, status: (mappedStatus || e.status) as any } : e));
        } catch (e: any) { alert(e.message); }
    }, [selectedEvent?.id, user]);

    const getStatus = (e: Event) => e.lifecycle || e.status;

    const filteredEvents = useMemo(() => events.filter((e) => {
        const s = getStatus(e);
        let match = filter === "all";
        if (filter === "draft") match = e.eventType === "venue" && s === EVENT_LIFECYCLE.DRAFT;
        if (filter === "pending") match = e.eventType === "host" && s === EVENT_LIFECYCLE.SUBMITTED;
        if (filter === "live") match = s === EVENT_LIFECYCLE.LIVE;
        if (filter === "approved") match = s === EVENT_LIFECYCLE.APPROVED || s === EVENT_LIFECYCLE.SCHEDULED;
        if (filter === "completed") match = s === EVENT_LIFECYCLE.COMPLETED;
        return match && (
            e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.hostName.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }), [events, filter, searchQuery]);

    const liveCount = useMemo(() => events.filter((e) => getStatus(e) === EVENT_LIFECYCLE.LIVE).length, [events]);
    const pendingCount = useMemo(() => events.filter((e) => e.eventType === "host" && getStatus(e) === EVENT_LIFECYCLE.SUBMITTED).length, [events]);
    const draftCount = useMemo(() => events.filter((e) => e.eventType === "venue" && getStatus(e) === EVENT_LIFECYCLE.DRAFT).length, [events]);
    const publishedCount = useMemo(() => events.filter((e) => [EVENT_LIFECYCLE.SCHEDULED, EVENT_LIFECYCLE.APPROVED].includes(getStatus(e) as string)).length, [events]);
    const totalRevenue = useMemo(() => events.reduce((s, e) => s + (e.revenue || 0), 0), [events]);

    const filterTabs = [
        { label: "All", value: "all", count: events.length },
        { label: "Live", value: "live", count: liveCount },
        { label: "Pending", value: "pending", count: pendingCount },
        { label: "Published", value: "approved", count: publishedCount },
        { label: "Drafts", value: "draft", count: draftCount },
        { label: "Completed", value: "completed" },
    ];

    return (
        <VenuePageShell
            title="Events"
            subtitle="Manage every event from draft to post-event review"
            actions={
                <Link href="/venue/create">
                    <VenueActionButton variant="primary">
                        <Plus className="w-4 h-4" /> Create Event
                    </VenueActionButton>
                </Link>
            }
        >
            {/* ── KPI Strip ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "LIVE NOW", value: loading ? "—" : liveCount, color: "var(--v-success)", bg: "var(--v-success-bg)", icon: Play },
                    { label: "REQUESTS", value: loading ? "—" : pendingCount, color: "var(--v-warning)", bg: "var(--v-warning-bg)", icon: AlertCircle },
                    { label: "PUBLISHED", value: loading ? "—" : publishedCount, color: "var(--v-info)", bg: "var(--v-info-bg)", icon: CheckCircle2 },
                    {
                        label: "REVENUE",
                        value: loading ? "—" : totalRevenue >= 100000
                            ? `₹${(totalRevenue / 100000).toFixed(1)}L`
                            : `₹${(totalRevenue / 1000).toFixed(1)}K`,
                        color: "var(--v-orange)",
                        bg: "var(--v-orange-dim)",
                        icon: DollarSign,
                    },
                ].map((stat, i) => (
                    <div key={i} className="rounded-2xl p-4 flex items-center gap-3 border border-white/[0.04]" style={{ background: "var(--v-card)" }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: stat.bg }}>
                            <stat.icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
                        </div>
                        <div>
                            <p className="v-label text-[9px] mb-0">{stat.label}</p>
                            <p className="text-[18px] font-black leading-tight tabular-nums" style={{ color: "var(--v-text-primary)" }}>
                                {stat.value}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Filter bar ── */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <VenueFilterTabs tabs={filterTabs} active={filter} onChange={setFilter} />
                <div className="relative flex-1 sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--v-text-muted)" }} />
                    <input
                        type="text"
                        placeholder="Search events or hosts..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[13px] outline-none focus:ring-1"
                        style={{
                            background: "var(--v-card)",
                            color: "var(--v-text-primary)",
                            border: "1px solid var(--v-border)",
                        }}
                    />
                </div>
            </div>

            {/* ── Events Grid ── */}
            {loading ? (
                <div className="rounded-[32px] py-24 flex flex-col items-center gap-4" style={{ background: "var(--v-card)" }}>
                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--v-orange)" }} />
                    <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--v-text-tertiary)" }}>
                        Loading events...
                    </p>
                </div>
            ) : filteredEvents.length === 0 ? (
                <div className="rounded-[32px] py-24 flex flex-col items-center text-center gap-4" style={{ background: "var(--v-card)" }}>
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "var(--v-elevated)" }}>
                        <Calendar className="w-8 h-8" style={{ color: "var(--v-text-muted)" }} />
                    </div>
                    <div>
                        <h3 className="text-[17px] font-semibold mb-1" style={{ color: "var(--v-text-primary)" }}>
                            No events found
                        </h3>
                        <p className="text-[13px]" style={{ color: "var(--v-text-tertiary)" }}>
                            Try adjusting your filters or search terms.
                        </p>
                    </div>
                    <button
                        onClick={() => { setFilter("all"); setSearchQuery(""); }}
                        className="text-[13px] font-semibold underline"
                        style={{ color: "var(--v-orange)" }}
                    >
                        Reset filters
                    </button>
                </div>
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
