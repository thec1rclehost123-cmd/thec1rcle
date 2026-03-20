"use client";

import { useEffect, useState, forwardRef, useMemo, useCallback, Suspense } from "react";
import { VirtuosoGrid } from "react-virtuoso";
import {
    Zap,
    Search,
    Calendar,
    MapPin,
    ChevronRight,
    CalendarDays,
    AlertCircle,
    Clock,
    CheckCircle2,
    Radio,
    Archive,
    FileEdit,
    BarChart3,
    Share2,
    ArrowUpRight,
    Edit3,
    Eye,
    RotateCcw,
    TrendingUp,
    Plus,
    List,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { DashboardEventCard } from "@c1rcle/ui";
import { mapEventForClient, EVENT_LIFECYCLE } from "@c1rcle/core/events";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { HubTabBar } from "@/components/shared/HubTabBar";
import { useHubTab } from "@/lib/hooks/useHubTab";
import { Skeleton } from "@/components/ui/Skeleton";
import CalendarClient from "../calendar/PageClient";

const HUB_TABS = [
    { key: "events", label: "Events", icon: List },
    { key: "calendar", label: "Calendar", icon: CalendarDays },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type EventTab = "all" | "live" | "pending" | "approved" | "needs_changes" | "drafts" | "completed";

const LIFECYCLE_TAB_MAP: Record<string, EventTab> = {
    [EVENT_LIFECYCLE.LIVE]: "live",
    [EVENT_LIFECYCLE.SUBMITTED]: "pending",
    [EVENT_LIFECYCLE.APPROVED]: "approved",
    [EVENT_LIFECYCLE.SCHEDULED]: "approved",
    [EVENT_LIFECYCLE.NEEDS_CHANGES]: "needs_changes",
    [EVENT_LIFECYCLE.DRAFT]: "drafts",
    [EVENT_LIFECYCLE.COMPLETED]: "completed",
    [EVENT_LIFECYCLE.DENIED]: "pending",
};

const TAB_DEFS: { id: EventTab; label: string; icon: any; color: string }[] = [
    { id: "all", label: "All Events", icon: Zap, color: "var(--v-orange)" },
    { id: "live", label: "Live", icon: Radio, color: "var(--v-success)" },
    { id: "pending", label: "Pending", icon: Clock, color: "var(--v-warning)" },
    { id: "needs_changes", label: "Action Reqd", icon: AlertCircle, color: "var(--v-error)" },
    { id: "approved", label: "Approved", icon: CheckCircle2, color: "var(--v-info)" },
    { id: "drafts", label: "Drafts", icon: FileEdit, color: "var(--v-text-tertiary)" },
    { id: "completed", label: "History", icon: Archive, color: "var(--v-text-muted)" },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function HostEventsPage() {
    const { activeTab: hubTab, setTab: setHubTab } = useHubTab("events");
    const { profile, getIdToken } = useDashboardAuth() as any;
    const [events, setEvents] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<EventTab>("all");
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    const fetchEvents = useCallback(async () => {
        const hostId = profile?.activeMembership?.partnerId;
        if (!hostId) { setLoading(false); return; }
        setLoading(true);
        try {
            const token = typeof getIdToken === "function" ? await getIdToken() : "";
            const res = await fetch(`/api/host/events?hostId=${hostId}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (!res.ok) throw new Error("Failed to fetch events");
            const data = await res.json();
            const fetched = (data.events || []).map((doc: any) => mapEventForClient(doc, doc.id || doc._id));
            setEvents(fetched);
        } catch (error) {
            console.error("Error fetching host events:", error);
        } finally {
            setLoading(false);
        }
    }, [profile, getIdToken]);

    useEffect(() => { fetchEvents(); }, [fetchEvents]);

    const tabCounts = useMemo(() => {
        const counts: Record<EventTab, number> = { all: 0, live: 0, pending: 0, approved: 0, needs_changes: 0, drafts: 0, completed: 0 };
        counts.all = events.length;
        events.forEach(e => {
            const lc = (e.lifecycle || "").toLowerCase();
            const mappedTab = LIFECYCLE_TAB_MAP[lc];
            if (mappedTab) counts[mappedTab]++;
        });
        return counts;
    }, [events]);

    const filteredEvents = useMemo(() => {
        return events.filter(e => {
            const lc = (e.lifecycle || "").toLowerCase();
            const matchesTab =
                activeTab === "all" ? true :
                activeTab === "live" ? lc === EVENT_LIFECYCLE.LIVE :
                activeTab === "pending" ? (lc === EVENT_LIFECYCLE.SUBMITTED || lc === EVENT_LIFECYCLE.DENIED) :
                activeTab === "needs_changes" ? lc === EVENT_LIFECYCLE.NEEDS_CHANGES :
                activeTab === "approved" ? (lc === EVENT_LIFECYCLE.APPROVED || lc === EVENT_LIFECYCLE.SCHEDULED) :
                activeTab === "drafts" ? lc === EVENT_LIFECYCLE.DRAFT :
                activeTab === "completed" ? lc === EVENT_LIFECYCLE.COMPLETED : true;

            const matchesSearch = !searchQuery ||
                e.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                e.venueName?.toLowerCase().includes(searchQuery.toLowerCase());

            return matchesTab && matchesSearch;
        }).sort((a, b) => {
            const now = new Date();
            const dateA = a.startDate ? new Date(a.startDate) : null;
            const dateB = b.startDate ? new Date(b.startDate) : null;
            const isFutureA = dateA && dateA > now && a.lifecycle !== EVENT_LIFECYCLE.DRAFT;
            const isFutureB = dateB && dateB > now && b.lifecycle !== EVENT_LIFECYCLE.DRAFT;
            if (isFutureA && !isFutureB) return -1;
            if (!isFutureA && isFutureB) return 1;
            if (isFutureA && isFutureB) return (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
            return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });
    }, [events, activeTab, searchQuery]);

    const getPrimaryAction = (e: any) => {
        const lc = (e.lifecycle || "").toLowerCase();
        if (lc === EVENT_LIFECYCLE.DRAFT) return { label: "Continue", href: `/host/create?id=${e.id}`, icon: <Edit3 size={16} /> };
        if (lc === EVENT_LIFECYCLE.SUBMITTED) return { label: "View Submission", href: `/host/events/${e.id}`, icon: <Eye size={16} /> };
        if (lc === EVENT_LIFECYCLE.DENIED || lc === EVENT_LIFECYCLE.NEEDS_CHANGES) return { label: "Fix & Resubmit", href: `/host/create?id=${e.id}`, icon: <RotateCcw size={16} /> };
        return { label: "View Analytics", href: `/host/analytics/overview?eventId=${e.id}`, icon: <BarChart3 size={16} /> };
    };


    return (
        <VenuePageShell
            title={hubTab === "calendar" ? "Calendar" : "Events"}
            subtitle={hubTab === "calendar" ? "Architect and manage your production roster" : "Architect and manage your production roster"}
        >
            <div className="space-y-8">
                <HubTabBar tabs={HUB_TABS} activeTab={hubTab} onTabChange={setHubTab} />

                {hubTab === "calendar" ? (
                    <CalendarClient />
                ) : (
                    <>
                        {/* Stats Summary Panel */}
                        <div className="rounded-[40px] bg-[var(--v-card)] border border-[var(--v-border)] p-10 flex flex-wrap items-center gap-12">
                            {TAB_DEFS.filter(t => t.id !== "all").map(t => {
                                const count = tabCounts[t.id];
                                if (count === 0 && t.id !== 'live') return null;
                                return (
                                    <div key={t.id} className="flex flex-col gap-3">
                                        <span className="text-[13px] font-black uppercase tracking-[0.2em] text-[var(--v-text-tertiary)]">{t.label}</span>
                                        <div className="flex items-center gap-4">
                                            <span className="text-4xl font-black tracking-tight text-text-primary tabular-nums">{count}</span>
                                            <div className="p-2 rounded-xl bg-surface-tertiary border border-border-subtle">
                                                <t.icon className="w-5 h-5" style={{ color: t.color }} />
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Filters & Search Row */}
                        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
                            <div className="flex p-2 bg-[var(--v-card)] border border-[var(--v-border)] rounded-[24px] overflow-x-auto scrollbar-hide gap-2">
                                {TAB_DEFS.map(t => {
                                    const Icon = t.icon;
                                    return (
                                        <button
                                            key={t.id}
                                            onClick={() => setActiveTab(t.id)}
                                            className={`px-6 py-3 rounded-[16px] text-[13px] font-black uppercase tracking-wider transition-all flex items-center gap-3 whitespace-nowrap shrink-0 ${activeTab === t.id ? "bg-[var(--v-elevated)] text-text-primary shadow-lg" : "text-[var(--v-text-tertiary)] hover:text-text-primary hover:bg-surface-tertiary"}`}
                                        >
                                            <Icon className="w-4 h-4" style={activeTab === t.id ? { color: t.color } : {}} />
                                            {t.label}
                                            {tabCounts[t.id] > 0 && (
                                                <span className={`ml-2 px-2 py-0.5 rounded-md text-[11px] font-black tabular-nums ${activeTab === t.id ? "bg-surface-elevated text-text-primary" : "bg-surface-secondary text-text-tertiary"}`}>{tabCounts[t.id]}</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="relative group w-full xl:w-96">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--v-text-muted)] group-focus-within:text-[var(--v-orange)] transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Locate production..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full bg-[var(--v-card)] border border-[var(--v-border)] rounded-[24px] pl-14 pr-6 py-4 text-[15px] text-text-primary placeholder:text-[var(--v-text-muted)] focus:outline-none focus:border-[var(--v-orange)]/50 transition-all font-bold tracking-tight shadow-sm"
                                />
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
                            )}
                        </AnimatePresence>
                    </>
                )}
            </div>
        </VenuePageShell>
    );
}
