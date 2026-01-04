"use client";

import { useEffect, useState } from "react";
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
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

type EventTab = "all" | "live" | "submitted" | "approved" | "drafts";

export default function HostEventsPage() {
    const { profile } = useDashboardAuth();
    const [events, setEvents] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<EventTab>("all");
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        if (!profile?.activeMembership?.partnerId) return;

        const db = getFirebaseDb();
        const hostId = profile.activeMembership.partnerId;

        const q = query(
            collection(db, "events"),
            where("hostId", "==", hostId),
            orderBy("startDate", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setEvents(fetched);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [profile]);

    const filteredEvents = events.filter(e => {
        const matchesTab =
            activeTab === "all" ? true :
                activeTab === "live" ? e.status === "live" :
                    activeTab === "submitted" ? e.lifecycle === "submitted" :
                        activeTab === "approved" ? (e.lifecycle === "approved" || e.lifecycle === "scheduled") :
                            activeTab === "drafts" ? e.lifecycle === "draft" : true;

        const matchesSearch = !searchQuery ||
            e.title?.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesTab && matchesSearch;
    });

    const tabCounts = {
        all: events.length,
        live: events.filter(e => e.status === 'live').length,
        submitted: events.filter(e => e.lifecycle === 'submitted').length,
        approved: events.filter(e => e.lifecycle === 'approved' || e.lifecycle === 'scheduled').length,
        drafts: events.filter(e => e.lifecycle === 'draft').length
    };

    return (
        <div className="space-y-8 stagger-children">
            {/* Header */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-headline">Events</h1>
                    <p className="text-body-sm mt-1">Manage your upcoming and past events.</p>
                </div>
                <Link href="/host/create" className="btn btn-primary">
                    <Plus className="w-4 h-4" />
                    New Event
                </Link>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex p-1 bg-[#f5f5f7] rounded-xl w-fit">
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

                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
                    <input
                        type="text"
                        placeholder="Search events..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input pl-11 w-64"
                    />
                </div>
            </div>

            {/* Events Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card h-64 animate-pulse bg-[#f5f5f7]" />
                    ))}
                </div>
            ) : filteredEvents.length === 0 ? (
                <div className="empty-state card py-16">
                    <div className="empty-state-icon">
                        <Calendar />
                    </div>
                    <h3 className="text-headline-sm mb-2">No events found</h3>
                    <p className="text-body-sm mb-6 max-w-xs">
                        {searchQuery
                            ? "Try adjusting your search."
                            : "Create your first event to get started."
                        }
                    </p>
                    <Link href="/host/create" className="btn btn-primary">
                        Create Event
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredEvents.map((event) => (
                        <EventCard key={event.id} event={event} />
                    ))}
                </div>
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
            className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all flex items-center gap-2 ${active
                ? "bg-white text-[#1d1d1f] shadow-sm"
                : "text-[#86868b] hover:text-[#1d1d1f]"
                }`}
        >
            {label}
            {count > 0 && (
                <span className={`text-[11px] ${active ? 'text-[#86868b]' : 'text-[#86868b]/60'}`}>
                    {count}
                </span>
            )}
        </button>
    );
}

function EventCard({ event }: { event: any }) {
    const statusConfig: Record<string, { label: string; class: string }> = {
        scheduled: { label: "Approved", class: "badge-green" },
        approved: { label: "Approved", class: "badge-green" },
        submitted: { label: "Submitted", class: "badge-orange" },
        needs_changes: { label: "Changes Requested", class: "badge-red" },
        draft: { label: "Draft", class: "badge-gray" },
        live: { label: "Live", class: "badge-green" },
        cancelled: { label: "Cancelled", class: "badge-red" }
    };

    const status = statusConfig[event.lifecycle] || statusConfig[event.status] || statusConfig.draft;

    return (
        <Link
            href={`/host/events/${event.id}`}
            className="card card-interactive p-5 block"
        >
            <div className="flex items-start justify-between mb-4">
                <span className={`badge ${status.class}`}>
                    {status.label}
                </span>
                <button
                    onClick={(e) => e.preventDefault()}
                    className="p-1 rounded-lg hover:bg-black/[0.04] text-[#86868b]"
                >
                    <MoreHorizontal className="w-4 h-4" />
                </button>
            </div>

            <h3 className="text-headline-sm mb-2 line-clamp-2">{event.title || event.name}</h3>

            <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-caption">
                    <Calendar className="w-4 h-4" />
                    {event.date}
                </div>
                <div className="flex items-center gap-2 text-caption">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate">{event.venueName || event.venue_name || "Venue TBD"}</span>
                </div>
            </div>


            <div className="divider mb-4" />

            <div className="flex items-center justify-between">
                <div>
                    <p className="stat-label">Tickets</p>
                    <p className="text-headline-sm">
                        {event.tickets_sold || 0}
                        <span className="text-caption ml-1">/ {event.capacity || '—'}</span>
                    </p>
                </div>
                <div className="flex items-center gap-2 text-accent text-[13px] font-medium">
                    View <ArrowUpRight className="w-4 h-4" />
                </div>
            </div>
        </Link>
    );
}
