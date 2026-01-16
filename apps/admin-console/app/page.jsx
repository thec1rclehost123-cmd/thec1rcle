"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Users,
    Building2,
    User,
    Calendar,
    Ticket,
    TrendingUp,
    AlertCircle,
    CheckCircle2,
    Clock,
    ShieldAlert,
    History,
    Activity,
    ChevronRight,
    Search,
    Filter,
    ArrowUpRight,
    ArrowDownRight
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

export default function AdminDashboard() {
    const { user } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filterActive, setFilterActive] = useState(false);

    useEffect(() => {
        async function fetchSnapshot() {
            try {
                const token = await user.getIdToken();
                const res = await fetch('/api/snapshot', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const json = await res.json();
                setData(json);
            } catch (err) {
                console.error("Failed to fetch admin snapshot", err);
            } finally {
                setLoading(false);
            }
        }

        if (user) fetchSnapshot();
    }, [user]);

    if (loading) {
        return (
            <div className="space-y-8 animate-pulse pb-20">
                <div className="h-32 bg-white/5 rounded-xl border border-white/5" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="h-32 bg-white/5 rounded-xl border border-white/5" />
                    ))}
                </div>
            </div>
        );
    }

    const snapshot = data?.snapshot || {};
    const stats = [
        { label: "Platform Users", value: snapshot.users_total || 0, icon: Users, trend: "+12.5%", trendUp: true, href: "/users" },
        { label: "Active Venues", value: snapshot.venues_total?.active || 0, icon: Building2, trend: "+2", trendUp: true, href: "/venues" },
        { label: "Verified Hosts", value: snapshot.hosts_total || 0, icon: User, trend: "+8", trendUp: true, href: "/hosts" },
        { label: "Live Events", value: snapshot.events?.live || 0, icon: Calendar, trend: "-3", trendUp: false, href: "/events" },
        { label: "Total Revenue", value: (snapshot.revenue?.total || 0).toLocaleString(), prefix: "₹", icon: TrendingUp, trend: "+₹14k", trendUp: true, href: "/payments" },
        { label: "Tickets Sold", value: snapshot.tickets_sold_total || 0, icon: Ticket, trend: "+142", trendUp: true, href: "/events" },
        { label: "Action Items", value: data?.alertsCount || 0, icon: ShieldAlert, trend: "Stable", trendUp: null, href: "/approvals" },
        { label: "Upcoming Events", value: snapshot.events?.upcoming || 0, icon: Clock, trend: "+5", trendUp: true, href: "/events" },
    ];

    const handleExport = () => {
        const headers = ["Metric", "Value", "Trend"];
        const rows = stats.map(s => [s.label, s.value, s.trend]);
        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `c1rcle_dashboard_report_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const logs = data?.recentLogs || [];
    const alerts = data?.alerts || [];

    const displayedStats = filterActive ? stats.slice(0, 4) : stats;

    const cleanJargon = (text) => {
        if (!text) return text;
        const normalized = text.replace(/ /g, '_').toUpperCase();
        const mapping = {
            'IDENTITY_MIGRATION_RUN': 'System Profile Sync',
            'IDENTITY_MIGRATION': 'System Profile Sync',
            'ONBOARDING_REJECT': 'Application Denied',
            'ONBOARDING_APPROVE': 'Member Verified',
            'EVENT_PAUSE': 'Sales Restricted',
            'EVENT_RESUME': 'Sales Restored',
            'USER_BAN': 'Access Revoked',
            'USER_UNBAN': 'Access Restored',
            'VENUE_SUSPEND': 'Partner Restricted',
            'VENUE_REINSTATE': 'Partner Restored',
            'PROMOTER_SUSPEND': 'Network Access Restricted',
            'PROMOTER_ACTIVATE': 'Network Access Restored',
            'PROMOTER_DISABLE': 'Access Permanently Revoked',
            'DISCOVERY_WEIGHT_ADJUST': 'Priority Score Update',
            'WARNING_ISSUE': 'Compliance Notice Sent',
            'VERIFICATION_ISSUE': 'Partner Verified',
            'VERIFICATION_REVOKE': 'Verification Withdrawn',
            'COMMISSION_ADJUST': 'Fee Structure Modified',
            'PAYOUT_FREEZE': 'Payouts Restricted',
            'PAYOUT_RELEASE': 'Payouts Authorized'
        };

        let cleaned = mapping[normalized] || text.replace(/_/g, ' ').split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');

        // Final polish for known phrases
        return cleaned
            .replace(/Manual Migration Bridge Executed/i, 'Administrative bridge sync completed')
            .replace(/Processed (\d+) Identities/i, '$1 profiles updated')
            .replace(/Admin action recorded in log/i, 'System verification recorded');
    };

    return (
        <div className="space-y-12 pb-24">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">System Online</span>
                    </div>
                    <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">Admin Dashboard</h1>
                    <p className="text-sm text-zinc-500 font-medium max-w-xl">
                        Monitor performance and manage core operations across THE C1RCLE.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setFilterActive(!filterActive)}
                        className={`h-9 px-4 rounded-md border text-[11px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${filterActive ? 'bg-iris/10 border-iris text-iris' : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10'}`}
                    >
                        <Filter className="h-3.5 w-3.5" strokeWidth={1.5} />
                        {filterActive ? "View All" : "Filter"}
                    </button>
                    <button
                        onClick={handleExport}
                        className="h-9 px-4 rounded-md bg-white text-black text-[11px] font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors"
                    >
                        Export Report
                    </button>
                </div>
            </header>

            {/* Metrics Grid */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {displayedStats.map((stat, i) => (
                    <Link href={stat.href} key={i} className="group">
                        <div className="p-6 rounded-xl bg-obsidian-surface border border-[#ffffff08] hover:border-[#ffffff12] transition-all relative overflow-hidden shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500 group-hover:text-zinc-300 transition-colors">{stat.label}</p>
                                <stat.icon className="h-4 w-4 text-zinc-600 group-hover:text-white transition-colors" strokeWidth={1.5} />
                            </div>
                            <div className="flex items-baseline gap-1">
                                {stat.prefix && <span className="text-xl font-medium text-zinc-500 tracking-tighter">{stat.prefix}</span>}
                                <span className="text-4xl font-light tracking-tight text-white font-mono-numbers">{stat.value}</span>
                            </div>
                            <div className="mt-5 flex items-center gap-2">
                                {stat.trendUp !== null ? (
                                    <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm text-[10px] font-bold ${stat.trendUp ? 'text-emerald-500 bg-emerald-500/10' : 'text-iris bg-iris/10'}`}>
                                        {stat.trendUp ? <ArrowUpRight className="h-3 w-3" strokeWidth={2} /> : <ArrowDownRight className="h-3 w-3" strokeWidth={2} />}
                                        {stat.trend}
                                    </div>
                                ) : (
                                    <div className="h-1.5 w-6 rounded-full bg-white/5"></div>
                                )}
                                <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Growth</span>
                            </div>
                        </div>
                    </Link>
                ))}
            </section>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Alerts & Tasks */}
                <div className="lg:col-span-8 space-y-12">
                    {/* Active Tasks */}
                    <section>
                        <div className="flex items-center justify-between mb-6 px-1">
                            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500 uppercase">Management Queues</h2>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {[
                                { label: "Venues Pending", count: snapshot.queues?.venues || 0, href: "/venues" },
                                { label: "Host Approvals", count: snapshot.queues?.hosts || 0, href: "/hosts" },
                                { label: "Refund Requests", count: snapshot.queues?.refunds || 0, href: "/payments" },
                                { label: "Support Tickets", count: snapshot.queues?.incidents || 0, href: "/support" },
                                { label: "System Alerts", count: snapshot.queues?.webhooks || 0, href: "/logs" },
                                { label: "Payout Batches", count: snapshot.queues?.payouts || 0, href: "/payments" },
                            ].map((q, i) => (
                                <Link href={q.href} key={i}>
                                    <div className="p-5 rounded-xl bg-obsidian-surface border border-[#ffffff08] hover:bg-white/[0.02] hover:border-[#ffffff15] transition-all group">
                                        <p className="text-3xl font-light text-white mb-1 font-mono-numbers group-hover:translate-x-1 transition-transform">{q.count}</p>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{q.label}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>

                    {/* Alerts */}
                    <section>
                        <div className="flex items-center justify-between mb-6 px-1">
                            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500 uppercase">Security Alerts</h2>
                            <div className="px-2 py-1 rounded bg-zinc-900 border border-white/5 text-[9px] font-bold text-iris uppercase tracking-widest">
                                {alerts.length} Flagged
                            </div>
                        </div>
                        <div className="space-y-2">
                            {alerts.length > 0 ? alerts.map((alert) => (
                                <div key={alert.id} className="flex items-center gap-4 p-4 rounded-xl bg-obsidian-surface border border-[#ffffff08] group">
                                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${alert.priority === 'high' ? 'bg-iris/10 text-iris' : 'bg-amber-500/10 text-amber-500'}`}>
                                        <AlertCircle className="h-4.5 w-4.5" strokeWidth={1.5} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-white truncate">{alert.message}</p>
                                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5 font-bold">Priority: {alert.priority}</p>
                                    </div>
                                    <Link href={alert.type === 'approval' ? '/approvals' : '/support'}>
                                        <button className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100">
                                            Resolve Tool
                                        </button>
                                    </Link>
                                </div>
                            )) : (
                                <div className="py-16 text-center rounded-xl border border-[#ffffff08] bg-white/[0.01]">
                                    <CheckCircle2 className="h-8 w-8 text-zinc-800 mx-auto mb-4" strokeWidth={1} />
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">No active alerts detected.</p>
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                {/* Right Column: Activity Feed */}
                <aside className="lg:col-span-4 h-fit">
                    <div className="p-6 rounded-xl bg-obsidian-surface border border-[#ffffff08] bg-obsidian-surface/50 sticky top-28 shadow-2xl">
                        <div className="flex items-center justify-between mb-10 px-2">
                            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">Audit Log</h2>
                            <History className="h-4 w-4 text-zinc-600" strokeWidth={1.5} />
                        </div>
                        <div className="space-y-8 relative">
                            {/* Linear timeline line */}
                            <div className="absolute left-[7px] top-1 bottom-1 w-px bg-white/5" />

                            {logs.map((log) => (
                                <div key={log.id} className="relative pl-8">
                                    <div className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full bg-obsidian-surface border border-white/10 flex items-center justify-center z-10 shadow-sm">
                                        <div className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
                                    </div>
                                    <p className="text-[11px] font-bold text-white uppercase tracking-widest mb-1.5 leading-none">{cleanJargon(log.action)}</p>
                                    <p className="text-[10px] text-zinc-600 mb-2 font-bold uppercase tracking-widest">
                                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                    </p>
                                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.03] text-[10px] text-zinc-500 leading-relaxed font-bold uppercase tracking-tight transition-colors hover:border-white/10 hover:text-zinc-400">
                                        {cleanJargon(log.reason) || 'System verification recorded.'}
                                    </div>
                                </div>
                            ))}

                            {logs.length === 0 && (
                                <div className="text-center py-12">
                                    <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Monitoring active traffic...</p>
                                </div>
                            )}
                        </div>
                        <Link href="/logs">
                            <button className="w-full mt-10 py-4 rounded-xl bg-white/5 border border-white/5 text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                                View Full History
                                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                            </button>
                        </Link>
                    </div>
                </aside>
            </div>
        </div>
    );
}
