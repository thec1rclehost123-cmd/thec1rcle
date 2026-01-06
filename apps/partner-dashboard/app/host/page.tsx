"use client";

import { useEffect, useState } from "react";
import { useDashboardAuth } from "../../components/providers/DashboardAuthProvider";
import {
    Plus,
    CalendarDays,
    TrendingUp,
    Ticket,
    Users,
    Clock,
    ChevronRight,
    ArrowUpRight,
    Loader2,
    Edit3,
    Eye,
    BarChart3,
    Share2
} from "lucide-react";
import Link from "next/link";
import { DashboardEventCard } from "@c1rcle/ui";
import { mapEventForClient } from "@c1rcle/core/events";

export default function HostDashboardHome() {
    const { profile } = useDashboardAuth();
    const [stats, setStats] = useState({
        revenue: 0,
        ticketsSold: 0,
        activePromoters: 0,
        pendingItems: 0
    });
    const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchOverview = async () => {
            if (!profile?.activeMembership?.partnerId) return;
            setIsLoading(true);
            try {
                const hostId = profile.activeMembership.partnerId;
                const res = await fetch(`/api/host/overview?hostId=${hostId}`);
                if (res.ok) {
                    const data = await res.json();
                    setStats(data.stats);
                    const mapped = (data.upcomingEvents || []).map((e: any) => mapEventForClient(e, e.id));
                    setUpcomingEvents(mapped);
                }
            } catch (err) {
                console.error("Host overview fetch error:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchOverview();
    }, [profile]);

    const firstName = profile?.displayName?.split(' ')[0] || 'there';

    if (isLoading && upcomingEvents.length === 0) {
        return (
            <div className="py-24 flex flex-col items-center justify-center">
                <Loader2 className="h-10 w-10 text-slate-200 animate-spin mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Assembling Console...</p>
            </div>
        );
    }

    return (
        <div className="space-y-10 stagger-children pb-20 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-end justify-between">
                <div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Good {getTimeOfDay()}</p>
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">Welcome back, {firstName}</h1>
                </div>
                <Link href="/host/create" className="btn bg-slate-900 text-white hover:bg-slate-800 rounded-2xl px-8 py-4 flex items-center gap-3 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-slate-200">
                    <Plus className="w-5 h-5" />
                    <span className="font-bold text-sm">New Event</span>
                </Link>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    label="Revenue"
                    value={`₹${stats.revenue.toLocaleString()}`}
                    icon={TrendingUp}
                    color="emerald"
                />
                <StatCard
                    label="Tickets Sold"
                    value={stats.ticketsSold.toString()}
                    icon={Ticket}
                    color="indigo"
                />
                <StatCard
                    label="Active Promoters"
                    value={stats.activePromoters.toString()}
                    icon={Users}
                    color="amber"
                />
                <StatCard
                    label="Pending Items"
                    value={stats.pendingItems.toString()}
                    icon={Clock}
                    accent={stats.pendingItems > 0}
                    color="rose"
                />
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Events List */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-10">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Recent Projects</h2>
                            <Link href="/host/events" className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">
                                View All
                                <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>

                        {upcomingEvents.length === 0 ? (
                            <div className="py-20 text-center flex flex-col items-center">
                                <div className="h-20 w-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-6 text-slate-200">
                                    <CalendarDays className="h-10 w-10" />
                                </div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">No active events</h3>
                                <p className="text-slate-500 text-sm font-medium mb-8 max-w-xs mx-auto">
                                    Start your next production by creating an event. Your performance will appear here.
                                </p>
                                <Link href="/host/create" className="px-10 py-5 bg-slate-900 text-white rounded-[2rem] font-bold text-sm shadow-2xl transition-all hover:scale-105 active:scale-95">
                                    Launch First Event
                                </Link>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {upcomingEvents.map((event, index) => {
                                    const getPrimaryAction = (e: any) => {
                                        if (e.lifecycle === "draft")
                                            return {
                                                label: "Continue Editing",
                                                href: `/host/create?id=${e.id}`,
                                                icon: <Edit3 size={16} />,
                                            };
                                        if (e.lifecycle === "submitted")
                                            return {
                                                label: "View Submission",
                                                href: `/host/events/${e.id}`,
                                                icon: <Eye size={16} />,
                                            };
                                        if (e.lifecycle === "denied" || e.lifecycle === "needs_changes")
                                            return {
                                                label: "Fix & Resubmit",
                                                href: `/host/create?id=${e.id}`,
                                                icon: <Edit3 size={16} />,
                                            };
                                        return {
                                            label: "Manage Event",
                                            href: `/host/events/${e.id}`,
                                            icon: <ArrowUpRight size={16} />,
                                        };
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
                                                    },
                                                },
                                            ]}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Side Panel */}
                <div className="space-y-8">
                    {/* Quick Actions */}
                    <div className="bg-slate-900 rounded-[2.5rem] p-10 shadow-2xl shadow-slate-200 text-white">
                        <h3 className="text-lg font-black uppercase tracking-tight mb-8 opacity-60">Operations</h3>
                        <div className="space-y-4">
                            <QuickAction
                                label="Browse Venues"
                                href="/host/partnerships"
                                description="Secure holds for your date"
                            />
                            <QuickAction
                                label="Promoter Network"
                                href="/host/promoters"
                                description="Manage affiliate nodes"
                            />
                            <QuickAction
                                label="Financials"
                                href="/host/analytics"
                                description="Deep dive performance"
                            />
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-10">
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-8">Journal</h3>
                        <div className="space-y-6">
                            <ActivityItem
                                title="System Online"
                                time="Just now"
                            />
                            <ActivityItem
                                title="Dashboard Sync"
                                time="Verified"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
}

function StatCard({ label, value, icon: Icon, accent = false, color }: any) {
    const colors: any = {
        emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
        indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
        amber: "bg-amber-50 text-amber-600 border-amber-100",
        rose: "bg-rose-50 text-rose-600 border-rose-100"
    };

    return (
        <div className={`bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm transition-all hover:scale-[1.02] group`}>
            <div className={`h-12 w-12 rounded-2xl ${colors[color]} flex items-center justify-center mb-6 border group-hover:scale-110 transition-transform`}>
                <Icon className="w-6 h-6" />
            </div>
            <p className="text-4xl font-black text-slate-900 tracking-tighter mb-1 leading-none">{value}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        </div>
    );
}


function QuickAction({ label, href, description }: { label: string; href: string; description: string }) {
    return (
        <Link
            href={href}
            className="flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-all group"
        >
            <div>
                <p className="text-sm font-black text-white group-hover:translate-x-1 transition-transform">{label}</p>
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-1">{description}</p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-white/20 group-hover:text-white transition-colors" />
        </Link>
    );
}

function ActivityItem({ title, time }: { title: string; time: string }) {
    return (
        <div className="flex items-center justify-between py-2">
            <p className="text-sm font-bold text-slate-900">{title}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{time}</p>
        </div>
    );
}

function getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
}
