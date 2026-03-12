"use client";

import { useEffect, useState, forwardRef, useMemo } from "react";
import { VirtuosoGrid } from "react-virtuoso";
import {
    Plus,
    Search,
    Calendar,
    MapPin,
    ChevronRight,
    MoreHorizontal,
    ArrowUpRight
} from "lucide-react";
import Link from "next/link";

import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { DashboardEventCard } from "@c1rcle/ui";
import { mapEventForClient, EVENT_LIFECYCLE } from "@c1rcle/core/events";
import { Edit3, BarChart3, Share2, Eye } from "lucide-react";

type EventTab = "all" | "live" | "submitted" | "approved" | "drafts";

export default function HostEventsPage() {
    const { profile } = useDashboardAuth();
    const [events, setEvents] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<EventTab>("all");
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        if (!profile?.activeMembership?.partnerId) return;
        const hostId = profile.activeMembership.partnerId;

        const fetchEvents = async () => {
            try {
                // To fetch private events, we might need the auth token
                const token = await (window as any).getAuthToken?.() || "";
                const res = await fetch(`/api/host/events?hostId=${hostId}`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                });
                if (!res.ok) throw new Error("Failed to fetch events");
                const data = await res.json();

                // Assuming mapping is either handled by backend or frontend
                const fetched = (data.events || []).map((doc: any) => mapEventForClient(doc, doc.id || doc._id));
                setEvents(fetched);
            } catch (error) {
                console.error("Error fetching events:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchEvents();
    }, [profile]);

    const filteredEvents = useMemo(() => {
        return events.filter(e => {
            const matchesTab =
                activeTab === "all" ? true :
                    activeTab === "live" ? e.lifecycle === EVENT_LIFECYCLE.LIVE :
                        activeTab === "submitted" ? e.lifecycle === EVENT_LIFECYCLE.SUBMITTED :
                            activeTab === "approved" ? (e.lifecycle === EVENT_LIFECYCLE.APPROVED || e.lifecycle === EVENT_LIFECYCLE.SCHEDULED) :
                                activeTab === "drafts" ? e.lifecycle === EVENT_LIFECYCLE.DRAFT : true;

            const matchesSearch = !searchQuery ||
                e.title?.toLowerCase().includes(searchQuery.toLowerCase());

            return matchesTab && matchesSearch;
        });
    }, [events, activeTab, searchQuery]);

    const tabCounts = useMemo(() => ({
        all: events.length,
        live: events.filter(e => e.lifecycle === EVENT_LIFECYCLE.LIVE).length,
        submitted: events.filter(e => e.lifecycle === EVENT_LIFECYCLE.SUBMITTED).length,
        approved: events.filter(e => e.lifecycle === EVENT_LIFECYCLE.APPROVED || e.lifecycle === EVENT_LIFECYCLE.SCHEDULED).length,
        drafts: events.filter(e => e.lifecycle === EVENT_LIFECYCLE.DRAFT).length
    }), [events]);

    return (
        <div className="space-y-8 pb-16 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/[0.04] pb-8">
                <div>
                    <div className="flex items-center gap-3 mb-3 text-orange-500">
                        <div className="p-2 bg-orange-500/10 rounded-xl">
                            <Calendar className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest">Events</span>
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight uppercase">Event Roster</h1>
                    <p className="text-white/40 text-[13px] font-medium mt-2 max-w-xl">Manage your upcoming, active, and past events.</p>
                </div>
                <Link href="/host/create" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-wider bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-400 hover:to-rose-500 text-white shadow-lg shadow-orange-500/20 transition-all active:scale-95">
                    <Plus className="w-4 h-4" />
                    New Event
                </Link>
            </div>

            {/* Filters */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex p-1.5 bg-[#121216] border border-white/[0.04] rounded-2xl w-fit overflow-x-auto max-w-full scrollbar-hide shadow-xl">
                    <TabButton
                        active={activeTab === "all"}
                        onClick={() => setActiveTab("all")}
                        label="All"
                        count={tabCounts.all}
                    />
                    <TabButton
                        active={activeTab === "live"}
                        onClick={() => setActiveTab("live")}
                        label="Live"
                        count={tabCounts.live}
                    />
                    <TabButton
                        active={activeTab === "submitted"}
                        onClick={() => setActiveTab("submitted")}
                        label="Submitted"
                        count={tabCounts.submitted}
                    />
                    <TabButton
                        active={activeTab === "approved"}
                        onClick={() => setActiveTab("approved")}
                        label="Approved"
                        count={tabCounts.approved}
                    />
                    <TabButton
                        active={activeTab === "drafts"}
                        onClick={() => setActiveTab("drafts")}
                        label="Drafts"
                        count={tabCounts.drafts}
                    />
                </div>

                <div className="relative group w-full lg:w-auto">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-orange-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search events..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full lg:w-80 bg-[#121216] border border-white/[0.04] rounded-[1.25rem] pl-11 pr-4 py-3.5 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all font-medium shadow-xl"
                    />
                </div>
            </div>

            {/* Events Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-72 rounded-[2rem] animate-pulse bg-white/5 border border-white/[0.04]" />
                    ))}
                </div>
            ) : filteredEvents.length === 0 ? (
                <div className="py-24 bg-[#121216] rounded-[3rem] border border-dashed border-white/[0.08] flex flex-col items-center text-center px-10 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-b from-orange-500/[0.02] to-transparent pointer-events-none" />
                    <div className="absolute inset-0 bg-orange-500/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-full" />
                    
                    <div className="relative w-20 h-20 bg-gradient-to-br from-[#1a1a1f] to-[#0f0f12] border border-white/5 rounded-[2rem] flex items-center justify-center text-white/40 shadow-2xl mb-6 group-hover:scale-110 transition-transform duration-500 group-hover:text-orange-500">
                        <Calendar className="w-8 h-8" />
                    </div>
                    <h3 className="relative text-2xl font-black text-white tracking-tight uppercase">No events found</h3>
                    <p className="relative text-white/40 text-[14px] font-medium mt-2 mb-8 max-w-sm leading-relaxed">
                        {searchQuery
                            ? "Try adjusting your search criteria or clear your filters."
                            : "Create your first event to start building your roster and selling tickets."
                        }
                    </p>
                    <Link href="/host/create" className="relative px-8 py-4 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] text-white rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all">
                        Create Event
                    </Link>
                </div>
            ) : (
                <VirtuosoGrid
                    useWindowScroll
                    data={filteredEvents}
                    components={{
                        List: forwardRef<HTMLDivElement>((props, ref) => (
                            <div {...props} ref={ref} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" />
                        )),
                        Item: forwardRef<HTMLDivElement>((props, ref) => (
                            <div {...props} ref={ref} className="h-full w-full" />
                        ))
                    }}
                    itemContent={(index, event) => {
                        const getPrimaryAction = (e: any) => {
                            if (e.lifecycle === EVENT_LIFECYCLE.DRAFT) return { label: "Continue Editing", href: `/host/create?id=${e.id}`, icon: <Edit3 size={16} /> };
                            if (e.lifecycle === EVENT_LIFECYCLE.SUBMITTED) return { label: "View Submission", href: `/host/events/${e.id}`, icon: <Eye size={16} /> };
                            if (e.lifecycle === EVENT_LIFECYCLE.DENIED || e.lifecycle === EVENT_LIFECYCLE.NEEDS_CHANGES) return { label: "Fix & Resubmit", href: `/host/create?id=${e.id}`, icon: <Edit3 size={16} /> };
                            return { label: "Manage Event", href: `/host/events/${e.id}`, icon: <ArrowUpRight size={16} /> };
                        };

                        return (
                            <DashboardEventCard
                                event={event}
                                index={index}
                                role="host"
                                primaryAction={getPrimaryAction(event)}
                                secondaryActions={[
                                    { label: "Edit Event", icon: <Edit3 size={16} />, href: `/host/create?id=${event.id}` },
                                    { label: "View Analytics", icon: <BarChart3 size={16} />, href: `/host/analytics?event=${event.id}` },
                                    {
                                        label: "Copy Link",
                                        icon: <Share2 size={16} />,
                                        onClick: () => {
                                            const url = `${window.location.origin}/event/${event.slug || event.id}`;
                                            navigator.clipboard.writeText(url);
                                            alert("Link copied to clipboard");
                                        }
                                    },
                                ]}
                            />
                        );
                    }}
                />
            )}
        </div>
    );
}

function TabButton({ active, onClick, label, count }: {
    active: boolean;
    onClick: () => void;
    label: string;
    count: number;
}) {
    return (
        <button
            onClick={onClick}
            className={`px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 flex-grow sm:flex-grow-0 ${active
                ? "bg-white/[0.06] text-white shadow-lg shadow-black/20"
                : "text-white/40 hover:text-white/80 hover:bg-white/[0.02]"
                }`}
        >
            {label}
            {count > 0 && (
                <span className={`px-2 py-0.5 rounded-md text-[10px] ${active ? 'bg-orange-500/20 text-orange-500' : 'bg-white/5 text-white/40'}`}>
                    {count}
                </span>
            )}
        </button>
    );
}

