"use client";

import { useState, useEffect } from "react";
import {
    Activity,
    Users,
    TrendingUp,
    ShieldAlert,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    Clock,
    Zap,
    Ticket,
    ChevronRight,
    Search,
    Plus,
    Bell,
    CheckCircle2,
    ArrowRight
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { motion } from "framer-motion";
import Link from "next/link";
import { parseAsIST } from "@c1rcle/core/time";

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
            // 1. Fetch Events to find tonight
            const eventsRes = await fetch(`/api/venue/events?venueId=${venueId}`);
            const eventsData = await eventsRes.json();
            const allEvents = eventsData.events || [];

            // Normalize events for display
            const normalizedEvents = allEvents.map((e: any) => ({
                ...e,
                startDateStr: e.startDate ? (typeof e.startDate === 'string' ? e.startDate.split('T')[0] : '') : '',
                dateStr: e.date ? (typeof e.date === 'string' ? e.date.split('T')[0] : '') : ''
            }));

            setEvents(normalizedEvents);

            // Find tonight's event (if any)
            const todayStr = new Date().toISOString().split('T')[0];
            const tonightEvent = normalizedEvents.find((e: any) =>
                e.dateStr === todayStr || e.startDateStr === todayStr
            );

            // 2. Fetch parallel summary and tonight data
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

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] space-y-4">
                <div className="w-12 h-12 border-4 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Synchronizing Dashboard...</p>
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto space-y-6 md:space-y-10 pb-20 animate-in fade-in duration-700">
            {/* Header: Visual Silence + Clear Status */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-4 md:px-0">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-tertiary)]">Operational</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] tracking-tight">Overview</h1>
                </div>

                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[11px] font-black uppercase tracking-widest hover:bg-[var(--surface-active)] transition-all">
                        <Bell size={14} />
                        Alerts
                    </button>
                    <Link
                        href="/venue/create"
                        className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[var(--text-primary)] text-[var(--surface-primary)] text-[11px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-xl shadow-black/10"
                    >
                        <Plus size={14} />
                        New Event
                    </Link>
                </div>
            </div>

            {/* Row 1: High Density Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 px-4 md:px-0">
                <MetricCard
                    label="Weekend Revenue"
                    value={`₹${(summary?.weekendRevenue / 100000).toFixed(2)}L`}
                    trend="+12.4%"
                    icon={TrendingUp}
                    color="indigo"
                />
                <MetricCard
                    label="Upcoming Events"
                    value={summary?.activeEventsCount || "0"}
                    trend="Next 7 Days"
                    icon={Calendar}
                    color="emerald"
                />
                <MetricCard
                    label="Entry Rate"
                    value={summary?.avgEntryVelocity || "0/hr"}
                    trend="Last Session"
                    icon={Zap}
                    color="amber"
                />
                <MetricCard
                    label="Guest Profiles"
                    value="2.4k"
                    trend="+180 New"
                    icon={Users}
                    color="slate"
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8 px-4 md:px-0">
                {/* Tonight's Reality (2/3 Width) */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="bg-[var(--surface-primary)] border border-[var(--border-subtle)] rounded-3xl md:rounded-[2.5rem] overflow-hidden shadow-sm">
                        <div className="p-6 md:p-10">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 md:mb-10">
                                <div>
                                    <h2 className="text-xl md:text-2xl font-black mb-1">Tonight</h2>
                                    <p className="text-sm text-[var(--text-tertiary)] font-medium">Real-time updates for your venue.</p>
                                </div>
                                {tonight ? (
                                    <div className="px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 w-fit">
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        Live: {tonight.checkedIn} In
                                    </div>
                                ) : (
                                    <div className="px-4 py-2 rounded-full bg-[var(--surface-secondary)] border border-[var(--border-subtle)] text-[var(--text-tertiary)] text-[10px] font-black uppercase tracking-widest w-fit">
                                        No Event Tonight
                                    </div>
                                )}
                            </div>

                            {tonight ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
                                    <div className="space-y-6">
                                        <TonightStat label="Expected" value={tonight.expected} sub="Total Guestlist" />
                                        <TonightStat label="Arrived" value={tonight.checkedIn} sub={`${Math.round((tonight.checkedIn / tonight.expected) * 100)}% Turnout`} progress={(tonight.checkedIn / tonight.expected) * 100} color="emerald" />
                                    </div>
                                    <div className="space-y-6">
                                        <TonightStat label="Revenue" value={`₹${(tonight.revenue / 1000).toFixed(1)}k`} sub="Live Sales" />
                                        <TonightStat label="Tickets" value={tonight.ticketsSold} sub="Total Sold" progress={100} color="indigo" />
                                    </div>
                                    <div className="flex flex-col justify-between">
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] mb-3">Peak Entry Rate</p>
                                            <div className="flex items-end gap-1 h-12">
                                                {[30, 45, 60, 80, 100, 70, 40].map((h, i) => (
                                                    <div key={i} className="flex-1 bg-emerald-500/20 rounded-t-sm transition-all hover:bg-emerald-500/40" style={{ height: `${h}%` }} />
                                                ))}
                                            </div>
                                            <p className="text-[10px] font-bold text-emerald-500">124 people / hr peak</p>
                                        </div>
                                        <Link
                                            href={`/venue/events/${tonight.id}`}
                                            className="group flex items-center justify-between p-5 mt-4 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] hover:border-[var(--brand-primary)] transition-all"
                                        >
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] mb-0.5">Control Panel</p>
                                                <p className="font-bold text-sm">Guest Entry</p>
                                            </div>
                                            <ChevronRight className="text-[var(--text-tertiary)] group-hover:text-[var(--brand-primary)] group-hover:translate-x-1 transition-all" size={18} />
                                        </Link>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-20 text-center border-2 border-dashed border-[var(--border-subtle)] rounded-3xl">
                                    <Clock className="mx-auto mb-4 text-[var(--text-tertiary)] opacity-20" size={48} />
                                    <p className="text-sm text-[var(--text-tertiary)] font-bold">Your venue is quiet tonight.</p>
                                    <p className="text-xs text-[var(--text-tertiary)] opacity-60 mt-1">Next event starts in 2 days.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Upcoming Schedule Summary */}
                    <div className="bg-[var(--surface-primary)] border border-[var(--border-subtle)] rounded-3xl md:rounded-[2.5rem] p-6 md:p-10 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl md:text-2xl font-black">Upcoming Schedule</h2>
                            <Link href="/venue/calendar" className="text-[10px] font-black uppercase tracking-widest text-[var(--brand-primary)] hover:underline">View Full Calendar</Link>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {events.slice(0, 4).map((event, i) => (
                                <div key={i} className="p-6 rounded-3xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] hover:shadow-lg transition-all cursor-pointer">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] mb-2">
                                        {new Date(event.startDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                                    </p>
                                    <h4 className="font-bold line-clamp-1 mb-4 uppercase text-xs">{event.title}</h4>
                                    <div className="flex items-center gap-2">
                                        <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                                        <span className="text-[10px] font-bold text-[var(--text-tertiary)]">{event.lifecycle}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Operations Sidebar (1/3 Width) */}
                <div className="space-y-6 md:space-y-8">
                    {/* Ops Queue */}
                    <div className="bg-[var(--surface-primary)] border border-[var(--border-subtle)] rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 shadow-sm h-fit">
                        <h3 className="text-lg md:text-xl font-black mb-6">Alerts & Notifications</h3>
                        <div className="space-y-4">
                            <QueueItem
                                icon={ShieldAlert}
                                title="Host Request"
                                desc="Hyperlink by Anuv Jain"
                                time="2h ago"
                                color="amber"
                                href="/venue/events"
                            />
                            <QueueItem
                                icon={Activity}
                                title="Device Offline"
                                desc="Register #04 (Main Gate)"
                                time="15m ago"
                                color="red"
                                href="/venue/settings"
                            />
                            <QueueItem
                                icon={CheckCircle2}
                                title="Security Sync"
                                desc="All 12 devices up to date"
                                time="Just now"
                                color="emerald"
                            />
                        </div>
                        <button className="w-full mt-8 py-4 rounded-2xl bg-[var(--surface-secondary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] hover:bg-[var(--surface-active)] hover:text-[var(--text-primary)] transition-all">
                            View History
                        </button>
                    </div>

                    {/* Quick Access Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <QuickLink icon={Users} label="Staff List" href="/venue/staff" />
                        <QuickLink icon={Ticket} label="Registers" href="/venue/registers" />
                        <QuickLink icon={Activity} label="Analytics" href="/venue/analytics" />
                        <QuickLink icon={Zap} label="Marketing" href="/venue/page-management" />
                    </div>

                    <div className="p-6 md:p-8 rounded-3xl md:rounded-[2.5rem] bg-[var(--text-primary)] text-[var(--surface-primary)] relative overflow-hidden">
                        <div className="relative z-10">
                            <h4 className="text-xl font-black mb-2 uppercase tracking-tighter italic">C1RCLE PRO</h4>
                            <p className="text-xs font-medium opacity-60 mb-6 leading-relaxed">Derive deeper insights into female retention and repeat audience rate.</p>
                            <button className="px-6 py-2.5 rounded-xl bg-[var(--surface-primary)] text-[var(--text-primary)] text-[10px] font-black uppercase tracking-widest">Upgrade Now</button>
                        </div>
                        <Zap className="absolute -right-6 -bottom-6 opacity-10" size={160} />
                    </div>
                </div>
            </div>
        </div>
    );
}

function MetricCard({ label, value, trend, icon: Icon, color }: any) {
    const colorClasses: any = {
        indigo: "text-indigo-500 bg-indigo-500/10",
        emerald: "text-emerald-500 bg-emerald-500/10",
        amber: "text-amber-500 bg-amber-500/10",
        slate: "text-slate-500 bg-slate-500/10"
    };

    return (
        <div className="bg-[var(--surface-primary)] border border-[var(--border-subtle)] p-6 md:p-8 rounded-3xl md:rounded-[2.5rem] shadow-sm hover:shadow-md transition-all group">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${colorClasses[color]}`}>
                <Icon size={22} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-tertiary)] mb-1">{label}</p>
            <div className="flex items-baseline justify-between">
                <h3 className="text-2xl md:text-3xl font-black tracking-tight">{value}</h3>
                <span className="text-[10px] font-bold text-[var(--text-tertiary)] opacity-60">{trend}</span>
            </div>
        </div>
    );
}

function TonightStat({ label, value, sub, progress, color }: any) {
    return (
        <div className="space-y-2">
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] mb-1">{label}</p>
                <p className="text-4xl font-black tracking-tight">{value}</p>
                <p className="text-[10px] font-bold text-[var(--text-tertiary)] opacity-60">{sub}</p>
            </div>
            {progress !== undefined && (
                <div className="h-1 w-full bg-[var(--surface-secondary)] rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={`h-full rounded-full ${color === 'emerald' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]'}`}
                    />
                </div>
            )}
        </div>
    );
}

function QueueItem({ icon: Icon, title, desc, time, color, href }: any) {
    const colorClasses: any = {
        amber: "text-amber-500 bg-amber-500/10 border-amber-500/20",
        red: "text-red-500 bg-red-500/10 border-red-500/20",
        emerald: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
    };

    const Wrapper = href ? Link : "div";

    return (
        <Wrapper
            href={href as any}
            className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${href ? 'hover:bg-[var(--surface-secondary)] cursor-pointer' : ''} border-transparent`}
        >
            <div className={`p-2.5 rounded-xl border ${colorClasses[color]}`}>
                <Icon size={18} />
            </div>
            <div className="flex-1">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="text-xs font-black uppercase tracking-tight">{title}</p>
                    <span className="text-[9px] font-bold text-[var(--text-tertiary)] opacity-60">{time}</span>
                </div>
                <p className="text-xs text-[var(--text-tertiary)] font-medium line-clamp-1">{desc}</p>
            </div>
        </Wrapper>
    );
}

function QuickLink({ icon: Icon, label, href }: any) {
    return (
        <Link
            href={href}
            className="flex flex-col items-center justify-center p-6 rounded-[2rem] bg-[var(--surface-primary)] border border-[var(--border-subtle)] hover:border-[var(--brand-primary)] hover:shadow-lg transition-all group"
        >
            <Icon size={20} className="mb-3 text-[var(--text-tertiary)] group-hover:text-[var(--brand-primary)] transition-all" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] transition-all">{label}</span>
        </Link>
    );
}
