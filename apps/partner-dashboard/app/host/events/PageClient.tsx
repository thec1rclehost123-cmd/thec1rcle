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
    const { profile, user } = useDashboardAuth();
    const [events, setEvents] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<EventTab>("all");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const fetchEvents = useCallback(async () => {
        const hostId = profile?.activeMembership?.partnerId;
        if (!hostId || !user) { setLoading(false); return; }
        setLoading(true);
        setError(false);
        try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/host/events?hostId=${hostId}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (!res.ok) throw new Error("Failed to fetch events");
            const data = await res.json();
            const fetched = (data.events || []).map((doc: any) => mapEventForClient(doc, doc.id || doc._id));
            setEvents(fetched);
        } catch (error) {
            console.error("Error fetching host events:", error);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [profile, user]);

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
        return { label: "View Analytics", href: `/host/events/${e.id}/analytics`, icon: <BarChart3 size={16} /> };
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
                            )}
                        </AnimatePresence>
                    </>
                )}
            </div>
        </VenuePageShell>
    );
}
