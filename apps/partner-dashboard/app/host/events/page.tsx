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
import { DashboardEventCard } from "@c1rcle/ui";
import { mapEventForClient } from "@c1rcle/core/events";
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

        const db = getFirebaseDb();
        const hostId = profile.activeMembership.partnerId;

        const q = query(
            collection(db, "events"),
            where("hostId", "==", hostId),
            orderBy("startDate", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(doc => mapEventForClient(doc.data(), doc.id));
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
                <div className="flex p-1 bg-[#f5f5f7] rounded-xl w-fit overflow-x-auto max-w-full scrollbar-hide">
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
                    {filteredEvents.map((event, index) => {
                        const getPrimaryAction = (e: any) => {
                            if (e.lifecycle === 'draft') return { label: "Continue Editing", href: `/host/create?id=${e.id}`, icon: <Edit3 size={16} /> };
                            if (e.lifecycle === 'submitted') return { label: "View Submission", href: `/host/events/${e.id}`, icon: <Eye size={16} /> };
                            if (e.lifecycle === 'denied' || e.lifecycle === 'needs_changes') return { label: "Fix & Resubmit", href: `/host/create?id=${e.id}`, icon: <Edit3 size={16} /> };
                            return { label: "Manage Event", href: `/host/events/${e.id}`, icon: <ArrowUpRight size={16} /> };
                        };

                        return (
                            <DashboardEventCard
                                key={event.id}
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
                    })}
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

