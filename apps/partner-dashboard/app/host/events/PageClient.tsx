"use client";

import { useState, useEffect, forwardRef, memo, useCallback, useMemo, Suspense } from "react";
import { VirtuosoGrid } from "react-virtuoso";
import {
    Calendar, Search, Plus,
    Edit, Loader2, BarChart3, List, CalendarDays, ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { DashboardEventCard } from "@c1rcle/ui";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { mapEventForClient, EVENT_LIFECYCLE } from "@c1rcle/core/events";
import { parseAsIST } from "@c1rcle/core/time";
import { VenuePageShell, VenueActionButton, VenueFilterTabs } from "@/components/venue-layout/VenuePageShell";
import { HubTabBar } from "@/components/shared/HubTabBar";
import { useHubTab } from "@/lib/hooks/useHubTab";
import CalendarClient from "../calendar/PageClient";

const HUB_TABS = [
    { key: "events",   label: "Events",   icon: List },
    { key: "calendar", label: "Calendar", icon: CalendarDays },
];

interface Event {
    id: string;
    title: string;
    date: Date;
    startDate?: string;
    hostId: string;
    hostName: string;
    venueId: string;
    venueName: string;
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
const MemoizedHostEventCard = memo(({ event, index }: any) => {
    const effectiveStatus = event.lifecycle || event.status;

    const getPrimaryAction = (e: any) => {
        if (effectiveStatus === EVENT_LIFECYCLE.DRAFT || effectiveStatus === EVENT_LIFECYCLE.NEEDS_CHANGES) {
            return { label: "Continue", href: `/host/create?id=${e.id}`, icon: <Edit size={16} /> };
        }
        return { label: "More Info", href: `/host/events/${e.id}`, icon: <BarChart3 size={16} /> };
    };

    const secondaryActions: any[] = [];
    if (event.canEdit) secondaryActions.push({ label: "Edit Event", icon: <Edit size={16} />, href: `/host/create?id=${event.id}` });
    secondaryActions.push({ label: "Analytics", icon: <BarChart3 size={16} />, href: `/host/analytics/overview?eventId=${event.id}` });

    return (
        <DashboardEventCard
            event={event}
            index={index}
            role="host"
            primaryAction={getPrimaryAction(event)}
            secondaryActions={secondaryActions}
            showStats={true}
            height="h-full"
        />
    );
});
MemoizedHostEventCard.displayName = "MemoizedHostEventCard";

// ── Page ──
export default function EventsManagementPage() {
    const { activeTab: hubTab, setTab: setHubTab } = useHubTab("events");
    const { profile, user } = useDashboardAuth();
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [fetchError, setFetchError] = useState<string | null>(null);

    useEffect(() => {
        if (!profile?.activeMembership?.partnerId || !user) return;
        const hostId = profile.activeMembership.partnerId;

        (async () => {
            try {
                const token = await user.getIdToken();
                const res = await fetch(`/api/host/events?hostId=${hostId}`, {
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
                            hostName: m.hostName || m.host || profile?.displayName || "Host",
                            hostId: m.hostId || m.creatorId || hostId,
                            venueId: m.venueId || r.venueId || "",
                            venueName: m.venueName || r.venueName || r.venue || "Venue pending",
                            status: m.lifecycle as any,
                            ticketsSold: m.stats?.ticketsSold || 0,
                            ticketsTotal: m.capacity || m.tickets?.reduce((s: number, t: any) => s + (t.quantity || 0), 0) || 0,
                            expectedCrowd: m.capacity || 0,
                            promotersCount: m.promoterSettings?.allowedPromoterIds?.length || 0,
                            revenue: m.stats?.revenue || 0,
                            eventType: "host",
                            canApprove: false,
                            canEdit: [EVENT_LIFECYCLE.DRAFT, EVENT_LIFECYCLE.NEEDS_CHANGES].includes(m.lifecycle),
                            canRequestEdits: false,
                        };
                    })
                    .sort((a: any, b: any) => {
                        const now = new Date();
                        const dateA = a.date instanceof Date ? a.date : new Date(a.date);
                        const dateB = b.date instanceof Date ? b.date : new Date(b.date);

                        const isFutureA = dateA > now && a.status !== 'draft';
                        const isFutureB = dateB > now && b.status !== 'draft';

                        if (isFutureA && !isFutureB) return -1;
                        if (!isFutureA && isFutureB) return 1;

                        if (isFutureA && isFutureB) {
                            return dateA.getTime() - dateB.getTime();
                        }

                        return dateB.getTime() - dateA.getTime();
                    });
                setEvents(mapped);
                setFetchError(null);
            } catch {
                setFetchError("Failed to load events. Please try again.");
            }
            finally { setLoading(false); }
        })();
    }, [profile, user]);

    const getStatus = (e: Event) => e.lifecycle || e.status;

    const filteredEvents = useMemo(() => events.filter((e) => {
        const s = getStatus(e);
        let match = filter === "all";
        if (filter === "draft") match = s === EVENT_LIFECYCLE.DRAFT;
        if (filter === "pending") match = [EVENT_LIFECYCLE.SUBMITTED, EVENT_LIFECYCLE.NEEDS_CHANGES, EVENT_LIFECYCLE.DENIED].includes(s as string);
        if (filter === "live") match = s === EVENT_LIFECYCLE.LIVE;
        if (filter === "approved") match = s === EVENT_LIFECYCLE.APPROVED || s === EVENT_LIFECYCLE.SCHEDULED;
        if (filter === "completed") match = s === EVENT_LIFECYCLE.COMPLETED;
        return match && (
            e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.venueName.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }), [events, filter, searchQuery]);

    const liveCount = useMemo(() => events.filter((e) => getStatus(e) === EVENT_LIFECYCLE.LIVE).length, [events]);
    const pendingCount = useMemo(() => events.filter((e) => [EVENT_LIFECYCLE.SUBMITTED, EVENT_LIFECYCLE.NEEDS_CHANGES, EVENT_LIFECYCLE.DENIED].includes(getStatus(e) as string)).length, [events]);
    const draftCount = useMemo(() => events.filter((e) => getStatus(e) === EVENT_LIFECYCLE.DRAFT).length, [events]);
    const publishedCount = useMemo(() => events.filter((e) => [EVENT_LIFECYCLE.SCHEDULED, EVENT_LIFECYCLE.APPROVED].includes(getStatus(e) as string)).length, [events]);

    const filterTabs = [
        { label: "All", value: "all", count: events.length },
        { label: "Live", value: "live", count: liveCount },
        { label: "Published", value: "approved", count: publishedCount },
        { label: "Drafts", value: "draft", count: draftCount },
        { label: "Completed", value: "completed" },
    ];


    return (
        <VenuePageShell
            title={hubTab === "calendar" ? "Calendar" : "Events"}
            actions={
                hubTab === "calendar" ? null : (
                    <div className="flex items-center gap-3">
                        {[
                            { label: "Live Now", value: loading ? "—" : liveCount, color: "var(--v-text-primary)" },
                            { label: "Requests", value: loading ? "—" : pendingCount, color: "#f59e0b" },
                        ].map((metric, i) => (
                            <div 
                                key={i}
                                className="min-w-[100px] rounded-[22px] px-4 py-2.5 text-center transition-all hover:scale-[1.02]" 
                                style={{ 
                                    background: "rgba(255, 255, 255, 0.03)", 
                                    border: "1px solid rgba(255, 255, 255, 0.08)",
                                    backdropFilter: "blur(12px)",
                                    boxShadow: "0 4px 24px -12px rgba(0,0,0,0.5)"
                                }}
                            >
                                <p className="text-[20px] font-black tabular-nums leading-none tracking-tight" style={{ color: metric.color }}>{metric.value}</p>
                                <p className="mt-1.5 text-[10px] font-black uppercase tracking-[0.15em] opacity-40" style={{ color: "var(--v-text-primary)" }}>{metric.label}</p>
                            </div>
                        ))}
                        <Link
                            href="/host/events/requests"
                            className="inline-flex items-center gap-2 rounded-[22px] px-4 py-3 text-[12px] font-black uppercase tracking-[0.14em] transition-all hover:scale-[1.02]"
                            style={{
                                background: "rgba(255, 255, 255, 0.04)",
                                color: "var(--v-text-primary)",
                                border: "1px solid rgba(255, 255, 255, 0.1)",
                                backdropFilter: "blur(12px)",
                                boxShadow: "0 4px 24px -12px rgba(0,0,0,0.5)",
                            }}
                        >
                            Slot Requests
                            <ArrowUpRight className="h-4 w-4" />
                        </Link>
                    </div>
                )
            }
        >
            {hubTab === "calendar" ? (
                <CalendarClient />
            ) : (
                <div className="space-y-6">
                    {/* ── Filter bar ── */}
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                        <VenueFilterTabs tabs={filterTabs} active={filter} onChange={setFilter} />
                        <div className="relative flex-1 sm:max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--v-text-muted)" }} />
                            <input
                                type="text"
                                placeholder="Search events or venues..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[13px] outline-none focus:ring-1"
                                style={{
                                    background: "rgba(255,255,255,0.02)",
                                    color: "var(--v-text-primary)",
                                    border: "1px solid var(--v-border)",
                                }}
                            />
                        </div>
                    </div>

<<<<<<< HEAD
                        {/* Filters & Search Row */}
                        <div className="flex items-center gap-3">
                            {/* Tab pills */}
                            <div className="flex items-center p-1.5 rounded-2xl shrink-0 overflow-x-auto scrollbar-hide" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                {TAB_DEFS.map(t => {
                                    const Icon = t.icon;
                                    const isActive = activeTab === t.id;
                                    return (
                                        <button
                                            key={t.id}
                                            onClick={() => setActiveTab(t.id)}
                                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all shrink-0 whitespace-nowrap"
                                            style={isActive ? { background: "var(--v-elevated)", color: "var(--v-text-primary)" } : { color: "var(--v-text-tertiary)" }}
                                        >
                                            <Icon className="w-3.5 h-3.5" style={isActive ? { color: t.color } : {}} />
                                            {t.label}
                                            {tabCounts[t.id] > 0 && (
                                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums" style={{ background: isActive ? "rgba(244,74,34,0.15)" : "rgba(255,255,255,0.06)", color: isActive ? "#F44A22" : "var(--v-text-tertiary)" }}>
                                                    {tabCounts[t.id]}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                            {/* Search */}
                            <div className="flex items-center gap-2 flex-1 px-4 py-2.5 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--v-text-tertiary)" }} />
                                <input
                                    type="text"
                                    placeholder="Search events..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="flex-1 bg-transparent text-[13px] font-medium outline-none"
                                    style={{ color: "var(--v-text-primary)" }}
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery("")} className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold transition-all" style={{ background: "rgba(255,255,255,0.1)", color: "var(--v-text-tertiary)" }}>×</button>
                                )}
                            </div>
                        </div>

                        {/* Grid */}
                        <AnimatePresence mode="wait">
                            {loading ? (
                                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                                        <div key={i} className="h-80 rounded-[40px] animate-pulse bg-[var(--v-card)] border border-[var(--v-border)]" />
                                    ))}
                                </motion.div>
                            ) : error ? (
                                <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                    className="py-24 bg-[var(--v-card)] rounded-[56px] border border-red-500/20 flex flex-col items-center text-center px-12 gap-4">
                                    <AlertCircle className="w-10 h-10 text-red-400" />
                                    <div>
                                        <h3 className="text-xl font-black text-text-primary">Failed to load events</h3>
                                        <p className="text-[var(--v-text-tertiary)] text-[14px] font-bold mt-2">Could not fetch your production roster. Check your connection.</p>
                                    </div>
                                    <button onClick={fetchEvents} className="mt-2 h-11 px-8 rounded-2xl bg-surface-tertiary border border-border-subtle text-text-primary text-[13px] font-black uppercase tracking-widest hover:bg-surface-elevated transition-all">
                                        Retry
                                    </button>
                                </motion.div>
                            ) : filteredEvents.length === 0 ? (
                                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                    className="py-32 bg-[var(--v-card)] rounded-[56px] border border-dashed border-[var(--v-border)] flex flex-col items-center text-center px-12">
                                    <div className="p-6 rounded-full bg-surface-tertiary mb-8">
                                        <CalendarDays className="w-12 h-12 text-[var(--v-text-muted)]" />
                                    </div>
                                    <h3 className="text-3xl font-black text-text-primary tracking-tight">
                                        {searchQuery ? "No matches in roster" : "Roster empty"}
                                    </h3>
                                    <p className="text-[var(--v-text-tertiary)] text-[16px] font-bold mt-4 mb-10 max-w-md leading-relaxed">
                                        {searchQuery ? "Try refining your search terms for the current filter." : "Schedule your next production by securing a venue slot in the calendar."}
                                    </p>
                                    <Link href="/host/calendar">
                                        <VenueActionButton variant="primary" className="h-14 px-10 text-[14px]">
                                            Browse Network Calendar
                                        </VenueActionButton>
                                    </Link>
                                </motion.div>
                            ) : (
                                <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                    <VirtuosoGrid
                                        useWindowScroll
                                        data={filteredEvents}
                                        components={{
                                            List: forwardRef<HTMLDivElement>(function VList(props, ref) {
                                                return <div {...props} ref={ref} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8" />;
                                            }),
                                            Item: forwardRef<HTMLDivElement>(function VItem(props, ref) {
                                                return <div {...props} ref={ref} className="h-full w-full" />;
                                            }),
                                        }}
                                        itemContent={(index, event) => (
                                            <DashboardEventCard
                                                event={event}
                                                index={index}
                                                role="host"
                                                primaryAction={getPrimaryAction(event)}
                                                secondaryActions={[
                                                    { label: "Configure", icon: <Edit3 size={16} />, href: `/host/create?id=${event.id}` },
                                                    { label: "Analytics", icon: <BarChart3 size={16} />, href: `/host/analytics/overview?eventId=${event.id}` },
                                                    {
                                                        label: "Copy URL",
                                                        icon: <Share2 size={16} />,
                                                        onClick: () => {
                                                            const url = `${window.location.origin}/event/${event.slug || event.id}`;
                                                            navigator.clipboard.writeText(url);
                                                        },
                                                    },
                                                ]}
                                            />
                                        )}
                                    />
                                </motion.div>
=======
                    {/* ── Events Grid ── */}
                    {fetchError ? (
                        <div className="p-4 rounded-2xl text-sm font-medium" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "var(--v-error)" }}>
                            {fetchError}
                        </div>
                    ) : loading ? (
                        <div className="rounded-[32px] py-24 flex flex-col items-center gap-4" style={{ background: "transparent", border: "1px solid var(--v-divider)" }}>
                            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--v-orange)" }} />
                            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--v-text-tertiary)" }}>
                                Loading events...
                            </p>
                        </div>
                    ) : filteredEvents.length === 0 ? (
                        <div className="rounded-[32px] py-24 flex flex-col items-center text-center gap-4" style={{ background: "transparent", border: "1px solid var(--v-divider)" }}>
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
                                <MemoizedHostEventCard
                                    key={event.id}
                                    event={event}
                                    index={index}
                                />
>>>>>>> origin/staging
                            )}
                        />
                    )}
                </div>
            )}
        </VenuePageShell>
    );
}
