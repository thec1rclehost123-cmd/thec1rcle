"use client";

import { useState, useEffect } from "react";
import {
    Calendar,
    Users,
    Ticket,
    DollarSign,
    Search,
    Filter,
    Plus,
    MoreHorizontal,
    Eye,
    Edit,
    Pause,
    Play,
    Lock,
    AlertCircle,
    Loader2,
    CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { EventDetailsModal } from "@/components/club-layout/EventDetailsModal";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { collection, query, where, onSnapshot, orderBy, or } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";

interface Event {
    id: string;
    title: string;
    date: Date;
    startDate?: string;
    hostId: string;
    hostName: string;
    venueId: string;
    lifecycle?: string;
    status: "draft" | "pending" | "approved" | "live" | "completed" | "cancelled" | "locked" | "scheduled";
    ticketsSold: number;
    ticketsTotal: number;
    capacity?: number;
    expectedCrowd: number;
    promotersEnabled: boolean;
    promotersCount?: number;
    revenue?: number;
    stats?: {
        ticketsSold?: number;
        revenue?: number;
    };
}

const STATUS_BADGES: Record<string, string> = {
    draft: "bg-slate-100 text-slate-600 border-slate-200",
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    submitted: "bg-amber-100 text-amber-700 border-amber-200",
    approved: "bg-blue-100 text-blue-700 border-blue-200",
    scheduled: "bg-blue-100 text-blue-700 border-blue-200",
    live: "bg-emerald-100 text-emerald-700 border-emerald-200",
    completed: "bg-purple-100 text-purple-700 border-purple-200",
    cancelled: "bg-red-100 text-red-700 border-red-200",
    locked: "bg-slate-200 text-slate-600 border-slate-300",
    paused: "bg-orange-100 text-orange-700 border-orange-200",
};

const STATUS_LABELS: Record<string, string> = {
    draft: "Draft",
    pending: "Pending",
    submitted: "Pending Review",
    approved: "Approved",
    scheduled: "Published",
    live: "Live",
    completed: "Completed",
    cancelled: "Cancelled",
    locked: "Locked",
    paused: "Paused",
};

export default function EventsManagementPage() {
    const { profile } = useDashboardAuth();
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Fetch events from Firestore in real-time
    useEffect(() => {
        if (!profile?.activeMembership?.partnerId) return;

        const db = getFirebaseDb();
        const clubId = profile.activeMembership.partnerId;

        // Query events where venueId matches this club OR creatorId matches this club
        const q = query(
            collection(db, "events"),
            where("venueId", "==", clubId)
            // orderBy("startDate", "desc")
        );

        console.log("[Club Events] Setting up listener for clubId:", clubId);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedEvents: Event[] = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    title: data.title || data.name || "Untitled Event",
                    date: data.startDate ? new Date(data.startDate) : new Date(),
                    startDate: data.startDate,
                    hostId: data.hostId || data.creatorId,
                    hostName: data.hostName || data.host || "Unknown Host",
                    venueId: data.venueId || clubId,
                    lifecycle: data.lifecycle,
                    status: data.lifecycle || data.status || "draft",
                    ticketsSold: data.stats?.ticketsSold || 0,
                    ticketsTotal: data.capacity || data.tickets?.reduce((sum: number, t: any) => sum + (t.quantity || 0), 0) || 0,
                    capacity: data.capacity,
                    expectedCrowd: data.capacity || 0,
                    promotersEnabled: data.promotersEnabled !== false,
                    promotersCount: 0, // Would need separate query
                    revenue: data.stats?.revenue || 0,
                    stats: data.stats
                };
            }).sort((a, b) => {
                const dateA = new Date(a.startDate || 0).getTime();
                const dateB = new Date(b.startDate || 0).getTime();
                return dateB - dateA; // Descending
            });
            setEvents(fetchedEvents);
            setLoading(false);
        }, (error) => {
            console.error("[Club Events] Firestore error:", error);
            if (error.message.includes("index")) {
                alert("Firestore Index Required: Please check the browser console for the link to create the index.");
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [profile]);

    const handleEventUpdate = async (action: string, data?: any) => {
        if (!selectedEvent) return;

        try {
            const response = await fetch("/api/club/events", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    eventId: selectedEvent.id,
                    action,
                    data,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to update event");
            }

            // Refresh events list (in production, fetch from API)
            // For now, update local state
            setEvents(prevEvents =>
                prevEvents.map(e =>
                    e.id === selectedEvent.id
                        ? { ...e, status: getNewStatus(action, e.status) as any }
                        : e
                )
            );
        } catch (error: any) {
            alert(error.message);
            throw error;
        }
    };

    const getNewStatus = (action: string, currentStatus: string) => {
        switch (action) {
            case "approve": return "approved";
            case "reject": return "cancelled";
            case "pause": return "paused";
            case "resume": return "live";
            case "lock": return "locked";
            default: return currentStatus;
        }
    };

    const handleViewEvent = (event: Event) => {
        setSelectedEvent(event);
        setIsModalOpen(true);
    };

    const getEffectiveStatus = (event: Event) => event.lifecycle || event.status;

    const filteredEvents = events.filter((event) => {
        const effectiveStatus = getEffectiveStatus(event);
        const matchesFilter = filter === "all" ||
            effectiveStatus === filter ||
            (filter === "pending" && (effectiveStatus === "submitted" || effectiveStatus === "pending")) ||
            (filter === "approved" && (effectiveStatus === "approved" || effectiveStatus === "scheduled")) ||
            (filter === "draft" && effectiveStatus === "draft");
        const matchesSearch =
            event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            event.hostName.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const liveEvents = events.filter((e) => getEffectiveStatus(e) === "live").length;
    const pendingApprovals = events.filter((e) => ["pending", "submitted"].includes(getEffectiveStatus(e))).length;
    const draftEvents = events.filter((e) => getEffectiveStatus(e) === "draft").length;
    const publishedEvents = events.filter((e) => ["scheduled", "approved"].includes(getEffectiveStatus(e))).length;
    const completedThisMonth = events.filter(
        (e) => getEffectiveStatus(e) === "completed" && e.date.getMonth() === new Date().getMonth()
    ).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                        Events Management
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Full lifecycle control from draft to post-event review
                    </p>
                </div>
                <Link href="/club/create" className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 shadow-sm">
                    <Plus className="h-4 w-4" />
                    Create Event
                </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
                        <Play className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                            Live Now
                        </p>
                        <p className="text-xl font-bold text-slate-900">{liveEvents}</p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
                        <AlertCircle className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                            Pending
                        </p>
                        <p className="text-xl font-bold text-slate-900">{pendingApprovals}</p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                        <Calendar className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                            Published
                        </p>
                        <p className="text-xl font-bold text-slate-900">{publishedEvents}</p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-slate-50 rounded-lg text-slate-600">
                        <Edit className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                            Drafts
                        </p>
                        <p className="text-xl font-bold text-slate-900">{draftEvents}</p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-purple-50 rounded-lg text-purple-600">
                        <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                            Done
                        </p>
                        <p className="text-xl font-bold text-slate-900">{completedThisMonth}</p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                        <DollarSign className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                            Revenue
                        </p>
                        <p className="text-xl font-bold text-slate-900 text-sm">
                            ₹{(events.reduce((sum, e) => sum + (e.revenue || 0), 0) / 100000).toFixed(1)}L
                        </p>
                    </div>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by event name or host..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                    </div>

                    <div className="flex gap-2 flex-wrap">
                        {["all", "live", "pending", "approved", "completed", "draft", "locked"].map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilter(status)}
                                className={`px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${filter === status
                                    ? "bg-indigo-600 text-white shadow-sm"
                                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                                    }`}
                            >
                                {status === 'draft' ? 'Drafts' : status}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Events List */}
            <div className="space-y-4">
                {loading ? (
                    <div className="bg-white p-12 rounded-xl border border-slate-200 text-center">
                        <Loader2 className="h-8 w-8 text-indigo-600 mx-auto mb-4 animate-spin" />
                        <p className="text-slate-500 font-semibold">Loading events...</p>
                    </div>
                ) : filteredEvents.length === 0 ? (
                    <div className="bg-white p-12 rounded-xl border border-slate-200 text-center">
                        <Calendar className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500 font-semibold">
                            {events.length === 0 ? "No events yet" : "No events match your filters"}
                        </p>
                        {events.length === 0 && (
                            <Link href="/club/create" className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700">
                                <Plus className="h-4 w-4" />
                                Create First Event
                            </Link>
                        )}
                    </div>
                ) : (
                    filteredEvents.map((event) => (
                        <div
                            key={event.id}
                            className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                        >
                            <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                                {/* Event Info */}
                                <div className="flex-1">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900">
                                                {event.title}
                                            </h3>
                                            <p className="text-sm text-slate-500 mt-1">
                                                Hosted by{" "}
                                                <span className="font-semibold text-indigo-600">
                                                    {event.hostName}
                                                </span>
                                            </p>
                                        </div>
                                        <span
                                            className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase ${STATUS_BADGES[getEffectiveStatus(event)] || STATUS_BADGES.draft
                                                }`}
                                        >
                                            {STATUS_LABELS[getEffectiveStatus(event)] || getEffectiveStatus(event)}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-slate-400" />
                                            <span className="text-sm font-medium text-slate-600">
                                                {event.date.toLocaleDateString("en-US", {
                                                    month: "short",
                                                    day: "numeric",
                                                })}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Ticket className="h-4 w-4 text-slate-400" />
                                            <span className="text-sm font-medium text-slate-600">
                                                {event.ticketsSold}/{event.ticketsTotal} sold
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Users className="h-4 w-4 text-slate-400" />
                                            <span className="text-sm font-medium text-slate-600">
                                                {event.expectedCrowd} expected
                                            </span>
                                        </div>

                                        {event.revenue && (
                                            <div className="flex items-center gap-2">
                                                <DollarSign className="h-4 w-4 text-slate-400" />
                                                <span className="text-sm font-medium text-slate-600">
                                                    ₹{(event.revenue / 1000).toFixed(0)}K
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <Link
                                        href={`/club/events/${event.id}`}
                                        className="p-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                                    >
                                        <Eye className="h-4 w-4" />
                                    </Link>

                                    {getEffectiveStatus(event) !== "locked" && getEffectiveStatus(event) !== "completed" && (
                                        <Link
                                            href={`/club/create?id=${event.id}`}
                                            className="p-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Link>
                                    )}

                                    {getEffectiveStatus(event) === "live" && (
                                        <button className="p-2.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors">
                                            <Pause className="h-4 w-4" />
                                        </button>
                                    )}

                                    {getEffectiveStatus(event) === "completed" && (
                                        <button className="p-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                                            <Lock className="h-4 w-4" />
                                        </button>
                                    )}

                                    <button className="p-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
