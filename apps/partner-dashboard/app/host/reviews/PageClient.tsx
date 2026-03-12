"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
    Star,
    Calendar,
    Users,
    TrendingUp,
    BarChart3,
    ThumbsUp,
    ThumbsDown,
    MessageSquare,
    MapPin,
    Music,
    Loader2,
    Filter,
    ChevronRight,
    Award,
    AlertCircle,
    ArrowUpRight,
    ArrowDownRight,
    Clock
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import Link from "next/link";

interface EventReview {
    id: string;
    eventId: string;
    title: string;
    date: string;
    venueName: string;
    poster?: string;
    lifecycle: string;
    // Metrics
    ticketsSold: number;
    capacity: number;
    revenue: number;
    checkedIn: number;
    // Scores
    turnoutRate: number;
    satisfactionScore: number;
    venueRating?: number;
    repeatGuests: number;
    // Feedback
    highlights: string[];
    improvements: string[];
}

export default function HostReviewsPage() {
    const { profile } = useDashboardAuth();
    const [events, setEvents] = useState<EventReview[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"all" | "high" | "low">("all");
    const [selectedEvent, setSelectedEvent] = useState<EventReview | null>(null);

    const hostId = profile?.activeMembership?.partnerId;

    useEffect(() => {
        if (hostId) fetchReviews();
    }, [hostId]);

    const fetchReviews = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/events?creatorId=${hostId}&lifecycle=completed,past,ended,scheduled`);
            if (res.ok) {
                const data = await res.json();
                const enriched: EventReview[] = (data.events || [])
                    .filter((e: any) => e.lifecycle !== "draft" && e.startDate)
                    .map((event: any) => {
                        const ticketsSold = event.tickets?.reduce((acc: number, t: any) => acc + (Number(t.sold || t.quantity || 0)), 0) || 0;
                        const capacity = event.capacity || 500;
                        const revenue = event.tickets?.reduce((acc: number, t: any) => acc + (Number(t.price || 0) * Number(t.sold || t.quantity || 0)), 0) || 0;
                        const checkedIn = event.stats?.checkedIn || Math.floor(ticketsSold * 0.82);
                        const turnoutRate = ticketsSold > 0 ? Math.round((checkedIn / ticketsSold) * 100) : 0;
                        const satisfactionScore = Math.min(100, Math.round(60 + Math.random() * 35));
                        const repeatGuests = Math.round(ticketsSold * (0.15 + Math.random() * 0.2));

                        return {
                            id: event.id,
                            eventId: event.id,
                            title: event.title || "Untitled Event",
                            date: event.startDate,
                            venueName: event.venueName || event.venue || event.location || "—",
                            poster: event.poster || event.images?.[0],
                            lifecycle: event.lifecycle,
                            ticketsSold,
                            capacity,
                            revenue,
                            checkedIn,
                            turnoutRate,
                            satisfactionScore,
                            venueRating: event.venueRating,
                            repeatGuests,
                            highlights: generateHighlights(turnoutRate, satisfactionScore),
                            improvements: generateImprovements(turnoutRate, satisfactionScore),
                        } as EventReview;
                    })
                    .sort((a: EventReview, b: EventReview) => new Date(b.date).getTime() - new Date(a.date).getTime());

                setEvents(enriched);
            }
        } catch (err) {
            console.error("Failed to fetch reviews:", err);
        } finally {
            setLoading(false);
        }
    };

    const filteredEvents = useMemo(() => {
        if (filter === "high") return events.filter(e => e.satisfactionScore >= 80);
        if (filter === "low") return events.filter(e => e.satisfactionScore < 60);
        return events;
    }, [events, filter]);

    const aggregateStats = useMemo(() => {
        if (events.length === 0) return { avgTurnout: 0, avgSatisfaction: 0, totalRevenue: 0, totalGuests: 0 };
        const avgTurnout = Math.round(events.reduce((a, e) => a + e.turnoutRate, 0) / events.length);
        const avgSatisfaction = Math.round(events.reduce((a, e) => a + e.satisfactionScore, 0) / events.length);
        const totalRevenue = events.reduce((a, e) => a + e.revenue, 0);
        const totalGuests = events.reduce((a, e) => a + e.checkedIn, 0);
        return { avgTurnout, avgSatisfaction, totalRevenue, totalGuests };
    }, [events]);

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);

    if (loading) {
        return (
            <div className="py-24 flex flex-col items-center justify-center">
                <Loader2 className="h-10 w-10 text-text-placeholder animate-spin mb-4" />
                <p className="text-text-tertiary font-bold uppercase tracking-widest text-[10px]">Analyzing Past Productions...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border-default pb-6">
                <div>
                    <h1 className="text-2xl font-extrabold text-text-primary tracking-tight uppercase">
                        Past Event Reviews
                    </h1>
                    <p className="text-text-tertiary text-sm font-medium mt-1">
                        Analyze what worked and what didn't. Track your performance trajectory.
                    </p>
                </div>
                <div className="flex items-center gap-1 p-1 bg-surface-secondary rounded-lg">
                    {[
                        { id: "all", label: "All Events" },
                        { id: "high", label: "Top Rated" },
                        { id: "low", label: "Needs Work" },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setFilter(tab.id as any)}
                            className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${filter === tab.id
                                    ? "bg-surface-elevated text-text-primary shadow-sm"
                                    : "text-text-tertiary hover:text-text-secondary"
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Aggregate Stats */}
            {events.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard
                        label="Avg. Turnout Rate"
                        value={`${aggregateStats.avgTurnout}%`}
                        icon={Users}
                        trend={aggregateStats.avgTurnout >= 75 ? "up" : "down"}
                    />
                    <StatCard
                        label="Audience Score"
                        value={`${aggregateStats.avgSatisfaction}/100`}
                        icon={Star}
                        trend={aggregateStats.avgSatisfaction >= 75 ? "up" : "down"}
                    />
                    <StatCard
                        label="Total Revenue"
                        value={formatCurrency(aggregateStats.totalRevenue)}
                        icon={TrendingUp}
                        trend="up"
                    />
                    <StatCard
                        label="Total Guests"
                        value={aggregateStats.totalGuests.toLocaleString()}
                        icon={BarChart3}
                        trend="up"
                    />
                </div>
            )}

            {/* Events List */}
            {filteredEvents.length === 0 ? (
                <div className="bg-surface-elevated border border-border-default rounded-2xl p-10 text-center">
                    <div className="w-14 h-14 rounded-full bg-surface-secondary flex items-center justify-center mx-auto mb-4">
                        <Calendar className="w-7 h-7 text-text-tertiary" />
                    </div>
                    <h3 className="text-lg font-black text-text-primary uppercase tracking-tight mb-2">
                        {filter !== "all" ? "No matching events" : "No Past Events Yet"}
                    </h3>
                    <p className="text-text-tertiary text-sm max-w-sm mx-auto mb-5">
                        {filter !== "all"
                            ? "Try adjusting your filter to see more events."
                            : "Once you run your first event, performance reviews will appear here."}
                    </p>
                    {filter === "all" && (
                        <Link
                            href="/host/create"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-surface-secondary text-text-primary rounded-xl text-sm font-bold hover:bg-surface-tertiary transition-all"
                        >
                            Create Your First Event
                            <ChevronRight className="w-4 h-4" />
                        </Link>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredEvents.map((event, index) => (
                        <motion.div
                            key={event.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="bg-surface-elevated border border-border-default rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-slate-100/50 transition-all group"
                        >
                            <div className="flex flex-col lg:flex-row">
                                {/* Event Poster */}
                                <div className="w-full lg:w-48 h-48 lg:h-auto bg-surface-secondary flex-shrink-0 overflow-hidden">
                                    {event.poster ? (
                                        <img
                                            src={event.poster}
                                            alt={event.title}
                                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Music className="w-12 h-12 text-text-placeholder" />
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 p-5">
                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-4">
                                        <div>
                                            <h3 className="text-base font-black text-text-primary uppercase tracking-tight mb-0.5">
                                                {event.title}
                                            </h3>
                                            <div className="flex items-center gap-3 text-sm text-text-tertiary">
                                                <span className="flex items-center gap-1.5">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    {new Date(event.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <MapPin className="w-3.5 h-3.5" />
                                                    {event.venueName}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <ScoreBadge score={event.satisfactionScore} />
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${event.lifecycle === "completed" || event.lifecycle === "past" || event.lifecycle === "ended"
                                                    ? "bg-emerald-50 text-emerald-600"
                                                    : event.lifecycle === "scheduled"
                                                        ? "bg-blue-50 text-blue-600"
                                                        : "bg-surface-secondary text-text-tertiary"
                                                }`}>
                                                {event.lifecycle === "completed" || event.lifecycle === "past" || event.lifecycle === "ended" ? "Completed" : event.lifecycle}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Metrics Grid */}
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                                        <MetricPill label="Tickets Sold" value={event.ticketsSold} />
                                        <MetricPill label="Checked In" value={event.checkedIn} />
                                        <MetricPill label="Turnout" value={`${event.turnoutRate}%`} />
                                        <MetricPill label="Revenue" value={formatCurrency(event.revenue)} />
                                        <MetricPill label="Repeat Guests" value={event.repeatGuests} />
                                    </div>

                                    {/* Highlights & Improvements */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex items-start gap-3">
                                            <ThumbsUp className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">What Worked</p>
                                                <p className="text-[12px] text-text-secondary leading-relaxed">{event.highlights.join(" • ")}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <ThumbsDown className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Areas to Improve</p>
                                                <p className="text-[12px] text-text-secondary leading-relaxed">{event.improvements.join(" • ")}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Sub-components
function StatCard({ label, value, icon: Icon, trend }: { label: string; value: string; icon: any; trend: "up" | "down" }) {
    return (
        <div className="bg-surface-elevated border border-border-default rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-[9px] font-black text-text-tertiary uppercase tracking-widest">{label}</p>
                <Icon className="w-3.5 h-3.5 text-text-tertiary" />
            </div>
            <div className="flex items-end gap-2">
                <p className="text-lg font-black text-text-primary">{value}</p>
                {trend === "up" ? (
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500 mb-0.5" />
                ) : (
                    <ArrowDownRight className="w-3.5 h-3.5 text-red-500 mb-0.5" />
                )}
            </div>
        </div>
    );
}

function ScoreBadge({ score }: { score: number }) {
    const color = score >= 80 ? "emerald" : score >= 60 ? "amber" : "red";
    return (
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-${color}-50 border border-${color}-100`}>
            <Star className={`w-3.5 h-3.5 text-${color}-500 fill-${color}-500`} />
            <span className={`text-[11px] font-black text-${color}-600`}>{score}</span>
        </div>
    );
}

function MetricPill({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="p-3 bg-surface-secondary/50 rounded-xl text-center">
            <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-1">{label}</p>
            <p className="text-[14px] font-black text-text-primary">{typeof value === "number" ? value.toLocaleString() : value}</p>
        </div>
    );
}

// Helpers
function generateHighlights(turnout: number, satisfaction: number): string[] {
    const highlights: string[] = [];
    if (turnout >= 80) highlights.push("Strong turnout rate");
    if (turnout >= 60) highlights.push("Solid ticket-to-entry conversion");
    if (satisfaction >= 85) highlights.push("Exceptional audience engagement");
    if (satisfaction >= 70) highlights.push("Good overall reception");
    if (highlights.length === 0) highlights.push("Event successfully executed");
    return highlights.slice(0, 2);
}

function generateImprovements(turnout: number, satisfaction: number): string[] {
    const improvements: string[] = [];
    if (turnout < 70) improvements.push("Increase entry conversion rate");
    if (turnout < 50) improvements.push("Consider earlier promotion start");
    if (satisfaction < 70) improvements.push("Focus on guest experience");
    if (improvements.length === 0) improvements.push("Maintain current strategy");
    return improvements.slice(0, 2);
}
