"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, Users, Ticket, ArrowUpRight, ArrowDownRight, Download } from "lucide-react";

export default function AdminAnalytics() {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchAnalytics() {
            try {
                const token = await user.getIdToken();
                const res = await fetch('/api/snapshot', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const json = await res.json();
                setStats(json.snapshot);
            } catch (err) {
                console.error("Failed to fetch analytics", err);
            } finally {
                setLoading(false);
            }
        }
        if (user) fetchAnalytics();
    }, [user]);

    const metrics = [
        { label: "Total Revenue", value: `₹${(stats?.revenue?.total || 0).toLocaleString()}`, trend: "+12.5%", isUp: true, icon: TrendingUp },
        { label: "Total Users", value: stats?.users_total || 0, trend: "+8.2%", isUp: true, icon: Users },
        { label: "Tickets Sold", value: stats?.tickets_sold_total || 0, trend: "-2.4%", isUp: false, icon: Ticket },
        { label: "Active Venues", value: stats?.venues_total?.active || 0, trend: "+4.1%", isUp: true, icon: BarChart3 }
    ];

    return (
        <div className="space-y-12 pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <BarChart3 className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">Platform Performance</span>
                    </div>
                    <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">Analytics</h1>
                    <p className="text-sm text-zinc-500 font-medium max-w-xl">
                        Monitor revenue growth, track user acquisition, and analyze event performance.
                    </p>
                </div>

                <button className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white/5 border border-white/5 text-zinc-400 text-[11px] font-bold uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all">
                    <Download className="h-4 w-4" />
                    Download Report
                </button>
            </div>

            {/* Core Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {metrics.map((m, i) => (
                    <div key={i} className="p-8 rounded-xl bg-obsidian-surface border border-[#ffffff08] group hover:border-[#ffffff15] transition-all duration-300 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <div className="h-12 w-12 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center group-hover:bg-zinc-800 transition-colors">
                                <m.icon className="h-5 w-5 text-zinc-500 group-hover:text-emerald-500 transition-colors" strokeWidth={1.5} />
                            </div>
                            {loading ? (
                                <div className="h-6 w-12 bg-white/5 animate-pulse rounded" />
                            ) : (
                                <div className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold tracking-widest uppercase ${m.isUp ? 'bg-emerald-500/10 text-emerald-500' : 'bg-iris/10 text-iris'}`}>
                                    {m.isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                    {m.trend}
                                </div>
                            )}
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-2">{m.label}</p>
                        <p className="text-4xl font-light text-white tracking-tight font-mono-numbers">{loading ? '---' : m.value}</p>
                    </div>
                ))}
            </div>

            {/* Chart Placeholders */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="p-10 rounded-xl bg-obsidian-surface border border-[#ffffff08] shadow-sm space-y-10">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">Revenue Growth</h3>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-700 bg-white/5 px-2 py-1 rounded">30 Day Feed</span>
                    </div>
                    <div className="h-64 bg-zinc-900/50 rounded-xl flex items-end justify-between p-8 gap-3 border border-white/[0.02]">
                        {[40, 70, 45, 90, 65, 85, 55, 75, 50, 80].map((h, i) => (
                            <div key={i} className="flex-1 bg-white/[0.03] rounded-t-lg group hover:bg-emerald-500/20 transition-all duration-500 relative" style={{ height: `${h}%` }}>
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-black text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">₹{h}k</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-10 rounded-xl bg-obsidian-surface border border-[#ffffff08] shadow-sm space-y-10">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">Sales Funnel</h3>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-700 bg-white/5 px-2 py-1 rounded">Platform Flow</span>
                    </div>
                    <div className="space-y-8 px-2">
                        {[
                            { label: 'Site Visits', value: '124,000', p: 100 },
                            { label: 'Event Views', value: '86,000', p: 69 },
                            { label: 'Cart Adds', value: '12,400', p: 14 },
                            { label: 'Successful Purchases', value: '8,200', p: 66 }
                        ].map((s, i) => (
                            <div key={i} className="space-y-3">
                                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                                    <span className="text-zinc-600">{s.label}</span>
                                    <span className="text-white">{s.value}</span>
                                </div>
                                <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden border border-white/[0.02]">
                                    <div className="h-full bg-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.2)] rounded-full transition-all duration-1000" style={{ width: `${s.p}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
