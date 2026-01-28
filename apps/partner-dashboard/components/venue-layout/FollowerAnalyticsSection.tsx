"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
    TrendingUp,
    Users,
    Eye,
    Heart,
    MapPin,
    Calendar,
    UserPlus,
    ArrowUpRight,
    ArrowDownRight,
    BarChart3,
    Globe,
    Sparkles,
    Target,
    Zap
} from "lucide-react";

interface FollowerAnalyticsSectionProps {
    stats: any;
    venue: any;
}

export default function FollowerAnalyticsSection({ stats, venue }: FollowerAnalyticsSectionProps) {
    const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");

    // Mock data for demonstration - in production, this would come from real analytics
    const followerGrowth = stats?.followerGrowth || {
        total: stats?.followersCount || 0,
        thisMonth: Math.floor((stats?.followersCount || 0) * 0.18),
        lastMonth: Math.floor((stats?.followersCount || 0) * 0.15),
        growthRate: 18.5
    };

    const cityBreakdown = stats?.cityBreakdown || [
        { city: "Pune", count: Math.floor((stats?.followersCount || 100) * 0.45), percentage: 45 },
        { city: "Mumbai", count: Math.floor((stats?.followersCount || 100) * 0.25), percentage: 25 },
        { city: "Bangalore", count: Math.floor((stats?.followersCount || 100) * 0.15), percentage: 15 },
        { city: "Delhi", count: Math.floor((stats?.followersCount || 100) * 0.10), percentage: 10 },
        { city: "Others", count: Math.floor((stats?.followersCount || 100) * 0.05), percentage: 5 },
    ];

    const conversionMetrics = {
        eventAttendance: Math.floor((stats?.followersCount || 0) * 0.12),
        tableReservations: Math.floor((stats?.followersCount || 0) * 0.08),
        ticketPurchases: Math.floor((stats?.followersCount || 0) * 0.22),
    };

    const topFollowers = stats?.topFollowers || [
        { name: "Priya S.", events: 12, avatar: null },
        { name: "Rahul M.", events: 10, avatar: null },
        { name: "Sneha K.", events: 8, avatar: null },
        { name: "Arjun P.", events: 7, avatar: null },
        { name: "Meera R.", events: 6, avatar: null },
    ];

    return (
        <div className="space-y-12">
            {/* Header Stats */}
            <section className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-start gap-4">
                        <div className="p-2.5 bg-violet-500/10 rounded-xl">
                            <TrendingUp className="w-5 h-5 text-violet-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-[var(--text-primary)]">Audience Insights</h3>
                            <p className="text-sm text-[var(--text-tertiary)]">Understand your community and engagement</p>
                        </div>
                    </div>

                    {/* Time Range Toggle */}
                    <div className="flex p-1 bg-[var(--surface-secondary)] rounded-xl border border-[var(--border-subtle)]">
                        {(["7d", "30d", "90d"] as const).map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`px-4 py-2 rounded-lg text-[11px] font-bold transition-all ${timeRange === range
                                    ? "bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-sm"
                                    : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                                    }`}
                            >
                                {range === "7d" ? "7 Days" : range === "30d" ? "30 Days" : "90 Days"}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                        label="Total Followers"
                        value={followerGrowth.total.toLocaleString()}
                        change={`+${followerGrowth.growthRate}%`}
                        positive
                        icon={Users}
                        iconColor="text-violet-500"
                        iconBg="bg-violet-500/10"
                    />
                    <StatCard
                        label="New This Month"
                        value={followerGrowth.thisMonth.toLocaleString()}
                        change="+24%"
                        positive
                        icon={UserPlus}
                        iconColor="text-emerald-500"
                        iconBg="bg-emerald-500/10"
                    />
                    <StatCard
                        label="Page Views"
                        value={(stats?.totalViews || 0).toLocaleString()}
                        change="+32%"
                        positive
                        icon={Eye}
                        iconColor="text-blue-500"
                        iconBg="bg-blue-500/10"
                    />
                    <StatCard
                        label="Engagement Rate"
                        value={`${((stats?.totalLikes || 0) / Math.max(stats?.followersCount || 1, 1) * 100).toFixed(1)}%`}
                        change="+5.2%"
                        positive
                        icon={Heart}
                        iconColor="text-rose-500"
                        iconBg="bg-rose-500/10"
                    />
                </div>
            </section>

            {/* Follower Growth Chart */}
            <section className="space-y-4 pt-8 border-t border-[var(--border-subtle)]">
                <h4 className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Growth Trend</h4>
                <div className="p-8 bg-gradient-to-br from-violet-900/20 to-slate-900/40 rounded-3xl border border-violet-500/10">
                    {/* Mock Chart Area */}
                    <div className="h-48 flex items-end justify-between gap-2">
                        {Array.from({ length: 12 }).map((_, i) => {
                            const height = Math.random() * 60 + 40;
                            return (
                                <motion.div
                                    key={i}
                                    initial={{ height: 0 }}
                                    animate={{ height: `${height}%` }}
                                    transition={{ delay: i * 0.05, duration: 0.5 }}
                                    className="flex-1 bg-gradient-to-t from-violet-500/40 to-violet-500/80 rounded-t-lg relative group cursor-pointer"
                                >
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black rounded-md text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                        +{Math.floor(Math.random() * 50 + 10)} followers
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                    <div className="flex justify-between mt-4 text-[10px] text-white/40 font-bold">
                        <span>Jan</span>
                        <span>Feb</span>
                        <span>Mar</span>
                        <span>Apr</span>
                        <span>May</span>
                        <span>Jun</span>
                        <span>Jul</span>
                        <span>Aug</span>
                        <span>Sep</span>
                        <span>Oct</span>
                        <span>Nov</span>
                        <span>Dec</span>
                    </div>
                </div>
            </section>

            {/* City Breakdown & Top Followers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-8 border-t border-[var(--border-subtle)]">
                {/* City Breakdown */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-[var(--text-tertiary)]" />
                        <h4 className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Audience by City</h4>
                    </div>
                    <div className="space-y-3">
                        {cityBreakdown.map((city: any, idx: number) => (
                            <div key={city.city} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-[var(--text-primary)]">{city.city}</span>
                                    <span className="text-[11px] font-bold text-[var(--text-tertiary)]">
                                        {city.count.toLocaleString()} ({city.percentage}%)
                                    </span>
                                </div>
                                <div className="h-2 bg-[var(--surface-secondary)] rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${city.percentage}%` }}
                                        transition={{ delay: idx * 0.1, duration: 0.5 }}
                                        className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Top Followers */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[var(--text-tertiary)]" />
                        <h4 className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Top Attending Followers</h4>
                    </div>
                    <div className="space-y-3">
                        {topFollowers.map((follower: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-4 p-4 bg-[var(--surface-secondary)] rounded-2xl border border-[var(--border-subtle)]">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-sm">
                                    {follower.name[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">{follower.name}</p>
                                    <p className="text-[10px] text-[var(--text-tertiary)]">{follower.events} events attended</p>
                                </div>
                                <div className="px-3 py-1 bg-amber-500/10 rounded-full">
                                    <span className="text-[10px] font-bold text-amber-500">VIP</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {/* Conversion Metrics */}
            <section className="space-y-4 pt-8 border-t border-[var(--border-subtle)]">
                <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-[var(--text-tertiary)]" />
                    <h4 className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Follower Conversion</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <ConversionCard
                        label="Ticket Purchases"
                        value={conversionMetrics.ticketPurchases}
                        total={followerGrowth.total}
                        color="emerald"
                    />
                    <ConversionCard
                        label="Event Attendance"
                        value={conversionMetrics.eventAttendance}
                        total={followerGrowth.total}
                        color="violet"
                    />
                    <ConversionCard
                        label="Table Reservations"
                        value={conversionMetrics.tableReservations}
                        total={followerGrowth.total}
                        color="amber"
                    />
                </div>
            </section>

            {/* Broadcast CTA */}
            <section className="pt-8 border-t border-[var(--border-subtle)]">
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-violet-700 p-8">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                    <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Zap className="w-5 h-5 text-white" />
                                <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Reach Your Audience</span>
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Send a Broadcast</h3>
                            <p className="text-white/60 text-sm max-w-md">
                                Push notifications, announcements, and event drops directly to your {followerGrowth.total.toLocaleString()} followers
                            </p>
                        </div>
                        <a
                            href="#broadcast"
                            className="flex items-center gap-2 px-8 py-4 bg-white text-violet-600 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white/90 transition-all shadow-lg"
                        >
                            <Zap className="w-4 h-4" />
                            Create Broadcast
                        </a>
                    </div>
                </div>
            </section>
        </div>
    );
}

function StatCard({ label, value, change, positive, icon: Icon, iconColor, iconBg }: {
    label: string;
    value: string;
    change: string;
    positive: boolean;
    icon: any;
    iconColor: string;
    iconBg: string;
}) {
    return (
        <div className="p-6 bg-[var(--surface-secondary)]/50 rounded-2xl border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all">
            <div className="flex items-center justify-between mb-4">
                <div className={`p-2.5 rounded-xl ${iconBg}`}>
                    <Icon className={`w-4 h-4 ${iconColor}`} />
                </div>
                <div className={`flex items-center gap-1 text-[11px] font-bold ${positive ? "text-emerald-500" : "text-red-500"}`}>
                    {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {change}
                </div>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)] mb-1">{value}</p>
            <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">{label}</p>
        </div>
    );
}

function ConversionCard({ label, value, total, color }: { label: string; value: number; total: number; color: "emerald" | "violet" | "amber" }) {
    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
    const colorClasses = {
        emerald: { bg: "bg-emerald-500/10", text: "text-emerald-500", bar: "from-emerald-500 to-emerald-400" },
        violet: { bg: "bg-violet-500/10", text: "text-violet-500", bar: "from-violet-500 to-fuchsia-500" },
        amber: { bg: "bg-amber-500/10", text: "text-amber-500", bar: "from-amber-500 to-orange-500" },
    }[color];

    return (
        <div className="p-6 bg-[var(--surface-secondary)]/50 rounded-2xl border border-[var(--border-subtle)]">
            <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest mb-4">{label}</p>
            <div className="flex items-end gap-2 mb-3">
                <p className="text-3xl font-bold text-[var(--text-primary)]">{percentage}%</p>
                <p className="text-sm text-[var(--text-tertiary)] pb-1">({value.toLocaleString()} users)</p>
            </div>
            <div className="h-2 bg-[var(--surface-elevated)] rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.8 }}
                    className={`h-full bg-gradient-to-r ${colorClasses.bar} rounded-full`}
                />
            </div>
        </div>
    );
}
