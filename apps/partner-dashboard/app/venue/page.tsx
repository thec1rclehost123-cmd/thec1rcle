"use client";

import { useState, useEffect } from "react";
import {
    TrendingUp,
    Users,
    Calendar,
    Zap,
    ShieldAlert,
    Activity,
    CheckCircle2,
    Clock,
    ChevronRight,
    Plus,
    Bell,
    BarChart3,
    Ticket,
    ArrowUpRight,
    Sparkles
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { motion } from "framer-motion";
import Link from "next/link";
import { KPITile, KPIGrid, ProgressStat } from "@/components/ui/KPITile";
import { SkeletonKPIGrid, SkeletonCard } from "@/components/ui/Skeleton";

export default function VenueDashboardHome() {
    const { profile } = useDashboardAuth();
    const venueId = profile?.activeMembership?.partnerId;

    const [summary, setSummary] = useState<any>(null);
    const [tonight, setTonight] = useState<any>(null);
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!venueId) return;
        fetchDashboardData();
    }, [venueId]);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const eventsRes = await fetch(`/api/venue/events?venueId=${venueId}`);
            const eventsData = await eventsRes.json();
            const allEvents = eventsData.events || [];

            const normalizedEvents = allEvents.map((e: any) => ({
                ...e,
                startDateStr: e.startDate ? (typeof e.startDate === 'string' ? e.startDate.split('T')[0] : '') : '',
                dateStr: e.date ? (typeof e.date === 'string' ? e.date.split('T')[0] : '') : ''
            }));

            setEvents(normalizedEvents);

            const todayStr = new Date().toISOString().split('T')[0];
            const tonightEvent = normalizedEvents.find((e: any) =>
                e.dateStr === todayStr || e.startDateStr === todayStr
            );

            const [summaryRes, tonightRes] = await Promise.all([
                fetch(`/api/venue/overview/summary?venueId=${venueId}`),
                tonightEvent ? fetch(`/api/venue/overview/tonight?eventId=${tonightEvent.id}`) : Promise.resolve(null)
            ]);

            setSummary(await summaryRes.json());
            if (tonightRes) setTonight(await tonightRes.json());

        } catch (err) {
            console.error("Dashboard Fetch Error:", err);
        } finally {
            setLoading(false);
        }
    };

    // Format currency
    const formatRevenue = (amount: number) => {
        if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
        if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
        return `₹${amount}`;
    };

    if (loading) {
        return (
            <div className="max-w-[1600px] mx-auto space-y-8 animate-fade-in">
                {/* Header Skeleton */}
                <div className="flex items-end justify-between">
                    <div className="space-y-3">
                        <div className="skeleton h-5 w-32 rounded-lg" />
                        <div className="skeleton h-10 w-48 rounded-lg" />
                    </div>
                    <div className="flex gap-3">
                        <div className="skeleton h-12 w-28 rounded-xl" />
                        <div className="skeleton h-12 w-36 rounded-xl" />
                    </div>
                </div>
                <SkeletonKPIGrid count={4} />
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2">
                        <SkeletonCard className="h-[400px]" />
                    </div>
                    <SkeletonCard className="h-[400px]" />
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-20">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col md:flex-row md:items-end justify-between gap-6"
            >
                <div>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="live-indicator">
                            <span className="text-[10px] font-bold text-[var(--state-success)] uppercase tracking-widest">Operational</span>
                        </div>
                    </div>
                    <h1 className="text-display-sm text-[var(--text-primary)]">Dashboard Overview</h1>
                </div>

                <div className="flex items-center gap-3">
                    <button className="btn btn-secondary">
                        <Bell className="w-4 h-4" />
                        <span className="hidden sm:inline">Alerts</span>
                    </button>
                    <Link href="/venue/create" className="btn btn-primary">
                        <Plus className="w-4 h-4" />
                        New Event
                    </Link>
                </div>
            </motion.div>

            {/* KPI Grid */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
            >
                <KPIGrid columns={4}>
                    <KPITile
                        label="Weekend Revenue"
                        value={formatRevenue(summary?.weekendRevenue || 0)}
                        trend={{ value: "12.4%", direction: "up" }}
                        icon={<TrendingUp className="w-6 h-6" />}
                        state="accent"
                        currency="none"
                    />
                    <KPITile
                        label="Upcoming Events"
                        value={summary?.activeEventsCount || 0}
                        subtext="Next 7 days"
                        icon={<Calendar className="w-6 h-6" />}
                        state="info"
                    />
                    <KPITile
                        label="Entry Rate"
                        value={summary?.avgEntryVelocity || "0/hr"}
                        subtext="Last session peak"
                        icon={<Zap className="w-6 h-6" />}
                        state="warning"
                    />
                    <KPITile
                        label="Guest Profiles"
                        value="2.4K"
                        trend={{ value: "180 new", direction: "up" }}
                        icon={<Users className="w-6 h-6" />}
                        state="success"
                    />
                </KPIGrid>
            </motion.div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
                {/* Tonight's Operations - 2/3 Width */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    className="xl:col-span-2 space-y-6"
                >
                    {/* Tonight Card */}
                    <div className="card p-8">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                            <div>
                                <h2 className="text-headline-sm text-[var(--text-primary)] mb-1">Tonight</h2>
                                <p className="text-body-sm text-[var(--text-tertiary)]">Real-time venue operations</p>
                            </div>
                            {tonight ? (
                                <div className="badge badge-success">
                                    <span className="status-dot status-dot-success status-dot-pulse" />
                                    Live: {tonight.checkedIn} Guests In
                                </div>
                            ) : (
                                <div className="badge badge-neutral">No Event Tonight</div>
                            )}
                        </div>

                        {tonight ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                {/* Column 1 - Attendance */}
                                <div className="space-y-6">
                                    <div>
                                        <p className="text-label-sm text-[var(--text-tertiary)] mb-2">Expected</p>
                                        <p className="text-stat-lg text-[var(--text-primary)]">{tonight.expected}</p>
                                        <p className="text-caption text-[var(--text-tertiary)]">Total Guestlist</p>
                                    </div>
                                    <ProgressStat
                                        label="Turnout Rate"
                                        value={tonight.checkedIn}
                                        max={tonight.expected}
                                        displayValue={`${tonight.checkedIn} arrived`}
                                        color="success"
                                    />
                                </div>

                                {/* Column 2 - Revenue */}
                                <div className="space-y-6">
                                    <div>
                                        <p className="text-label-sm text-[var(--text-tertiary)] mb-2">Live Revenue</p>
                                        <p className="text-stat-lg text-[var(--text-primary)]">
                                            {formatRevenue(tonight.revenue)}
                                        </p>
                                        <p className="text-caption text-[var(--text-tertiary)]">Tonight's sales</p>
                                    </div>
                                    <div>
                                        <p className="text-label-sm text-[var(--text-tertiary)] mb-2">Tickets Sold</p>
                                        <p className="text-stat-sm text-[var(--text-primary)]">{tonight.ticketsSold}</p>
                                    </div>
                                </div>

                                {/* Column 3 - Actions */}
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-label-sm text-[var(--text-tertiary)] mb-3">Peak Entry Rate</p>
                                        <div className="flex items-end gap-1 h-12 mb-2">
                                            {[30, 45, 60, 80, 100, 70, 40].map((h, i) => (
                                                <motion.div
                                                    key={i}
                                                    initial={{ height: 0 }}
                                                    animate={{ height: `${h}%` }}
                                                    transition={{ delay: 0.3 + i * 0.05, duration: 0.4 }}
                                                    className="flex-1 bg-[var(--state-success)]/20 hover:bg-[var(--state-success)]/40 rounded-t transition-colors"
                                                />
                                            ))}
                                        </div>
                                        <p className="text-caption font-medium text-[var(--state-success)]">124 guests/hr peak</p>
                                    </div>

                                    <Link
                                        href={`/venue/events/${tonight.id}`}
                                        className="group flex items-center justify-between p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] hover:border-[var(--c1rcle-orange)] hover:bg-[var(--c1rcle-orange-glow)] transition-all"
                                    >
                                        <div>
                                            <p className="text-label-sm text-[var(--text-tertiary)] mb-0.5">Control Panel</p>
                                            <p className="text-title-sm text-[var(--text-primary)]">Guest Entry</p>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)] group-hover:text-[var(--c1rcle-orange)] group-hover:translate-x-1 transition-all" />
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <div className="py-16 text-center border-2 border-dashed border-[var(--border-subtle)] rounded-2xl">
                                <Clock className="mx-auto mb-4 text-[var(--text-placeholder)]" size={48} />
                                <p className="text-body text-[var(--text-tertiary)]">Your venue is quiet tonight.</p>
                                <p className="text-caption text-[var(--text-placeholder)] mt-1">Next event starts in 2 days.</p>
                            </div>
                        )}
                    </div>

                    {/* Upcoming Schedule */}
                    <div className="card p-8">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-headline-sm text-[var(--text-primary)]">Upcoming Schedule</h2>
                            <Link
                                href="/venue/calendar"
                                className="text-label text-[var(--c1rcle-orange)] hover:underline flex items-center gap-1"
                            >
                                View Calendar
                                <ArrowUpRight className="w-3 h-3" />
                            </Link>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {events.slice(0, 4).map((event, i) => (
                                <motion.div
                                    key={event.id || i}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 + i * 0.05 }}
                                    className="p-5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-default)] hover:shadow-md transition-all cursor-pointer group"
                                >
                                    <p className="text-label-sm text-[var(--text-tertiary)] mb-2">
                                        {new Date(event.startDate).toLocaleDateString('en-IN', {
                                            weekday: 'short',
                                            day: 'numeric',
                                            month: 'short'
                                        })}
                                    </p>
                                    <h4 className="text-title-sm text-[var(--text-primary)] line-clamp-1 mb-3 group-hover:text-[var(--c1rcle-orange)] transition-colors">
                                        {event.title}
                                    </h4>
                                    <div className="flex items-center gap-2">
                                        <span className={`status-dot ${event.lifecycle === 'published' ? 'status-dot-success' :
                                                event.lifecycle === 'draft' ? 'status-dot-info' : 'status-dot-neutral'
                                            }`} />
                                        <span className="text-caption capitalize">{event.lifecycle}</span>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {events.length === 0 && (
                            <div className="py-12 text-center">
                                <Calendar className="mx-auto mb-3 text-[var(--text-placeholder)]" size={32} />
                                <p className="text-body-sm text-[var(--text-tertiary)]">No upcoming events scheduled</p>
                                <Link href="/venue/create" className="btn btn-ghost mt-4">
                                    <Plus className="w-4 h-4" />
                                    Create your first event
                                </Link>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Right Sidebar - 1/3 Width */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    className="space-y-6"
                >
                    {/* Alerts & Notifications */}
                    <div className="card p-6">
                        <h3 className="text-title text-[var(--text-primary)] mb-5">Alerts & Notifications</h3>
                        <div className="space-y-3">
                            <AlertItem
                                icon={ShieldAlert}
                                title="Host Request"
                                description="Hyperlink by Anuv Jain"
                                time="2h ago"
                                state="warning"
                                href="/venue/events"
                            />
                            <AlertItem
                                icon={Activity}
                                title="Device Offline"
                                description="Register #04 (Main Gate)"
                                time="15m ago"
                                state="error"
                                href="/venue/settings"
                            />
                            <AlertItem
                                icon={CheckCircle2}
                                title="Security Sync"
                                description="All 12 devices up to date"
                                time="Just now"
                                state="success"
                            />
                        </div>
                        <button className="w-full mt-5 py-3 rounded-xl bg-[var(--surface-secondary)] text-label text-[var(--text-tertiary)] hover:bg-[var(--surface-tertiary)] hover:text-[var(--text-primary)] transition-all">
                            View History
                        </button>
                    </div>

                    {/* Quick Access */}
                    <div className="grid grid-cols-2 gap-3">
                        <QuickLink icon={Users} label="Staff" href="/venue/staff" />
                        <QuickLink icon={Ticket} label="Registers" href="/venue/registers" />
                        <QuickLink icon={BarChart3} label="Analytics" href="/venue/analytics" />
                        <QuickLink icon={Sparkles} label="Marketing" href="/venue/page-management" />
                    </div>

                    {/* Pro Upgrade CTA */}
                    <div className="relative overflow-hidden p-6 rounded-3xl bg-[var(--text-primary)] text-[var(--text-inverse)]">
                        <div className="relative z-10">
                            <h4 className="text-title text-[var(--text-inverse)] mb-2 flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-[var(--c1rcle-orange)]" />
                                C1RCLE PRO
                            </h4>
                            <p className="text-body-sm opacity-70 mb-5">
                                Unlock deeper insights into retention metrics and audience analytics.
                            </p>
                            <button className="btn btn-primary btn-sm">
                                Upgrade Now
                            </button>
                        </div>
                        <div className="absolute -right-8 -bottom-8 w-40 h-40 rounded-full bg-[var(--c1rcle-orange)]/20 blur-2xl" />
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

// Alert Item Component
function AlertItem({ icon: Icon, title, description, time, state, href }: {
    icon: any;
    title: string;
    description: string;
    time: string;
    state: "success" | "warning" | "error" | "info";
    href?: string;
}) {
    const stateClasses = {
        success: "bg-[var(--state-success-bg)] text-[var(--state-success)] border-[var(--state-success)]/20",
        warning: "bg-[var(--state-warning-bg)] text-[var(--state-warning)] border-[var(--state-warning)]/20",
        error: "bg-[var(--state-error-bg)] text-[var(--state-error)] border-[var(--state-error)]/20",
        info: "bg-[var(--state-info-bg)] text-[var(--state-info)] border-[var(--state-info)]/20",
    };

    const Wrapper = href ? Link : "div";

    return (
        <Wrapper
            href={href as string}
            className={`flex items-start gap-3 p-3 rounded-xl border border-transparent transition-all ${href ? "hover:bg-[var(--surface-secondary)] hover:border-[var(--border-subtle)] cursor-pointer" : ""
                }`}
        >
            <div className={`p-2 rounded-lg border ${stateClasses[state]}`}>
                <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="text-title-sm text-[var(--text-primary)] truncate">{title}</p>
                    <span className="text-caption text-[var(--text-placeholder)] whitespace-nowrap">{time}</span>
                </div>
                <p className="text-caption text-[var(--text-tertiary)] truncate">{description}</p>
            </div>
        </Wrapper>
    );
}

// Quick Link Component
function QuickLink({ icon: Icon, label, href }: { icon: any; label: string; href: string }) {
    return (
        <Link
            href={href}
            className="flex flex-col items-center justify-center p-5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] hover:border-[var(--c1rcle-orange)] hover:shadow-md transition-all group"
        >
            <Icon className="w-5 h-5 mb-2 text-[var(--text-tertiary)] group-hover:text-[var(--c1rcle-orange)] transition-colors" />
            <span className="text-label text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] transition-colors">
                {label}
            </span>
        </Link>
    );
}
