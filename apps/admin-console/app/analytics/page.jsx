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
        { label: "Gross Merchant Volume", value: `₹${(stats?.revenue?.total || 0).toLocaleString()}`, trend: "+12.5%", isUp: true, icon: TrendingUp },
        { label: "Accumulated Users", value: stats?.users_total || 0, trend: "+8.2%", isUp: true, icon: Users },
        { label: "Ticket Velocity", value: stats?.tickets_sold_total || 0, trend: "-2.4%", isUp: false, icon: Ticket },
        { label: "Venue Growth", value: stats?.venues_total?.active || 0, trend: "+4.1%", isUp: true, icon: BarChart3 }
    ];

    return (
        <div className="space-y-12 pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8 border-b border-slate-200 pb-12">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <BarChart3 className="h-6 w-6 text-indigo-600" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Data Intelligence</span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-slate-900">Platform Analytics</h1>
                    <p className="text-base text-slate-500 mt-3 font-medium max-w-2xl leading-relaxed">
                        Deep dive into revenue, GMV, and platform retention. <span className="text-slate-900">Visualize growth vectors and performance cohorts.</span>
                    </p>
                </div>

                <button className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-white border border-slate-200 text-slate-900 text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
                    <Download className="h-4 w-4" />
                    Export Analytics
                </button>
            </div>

            {/* Core Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {metrics.map((m, i) => (
                    <div key={i} className="p-10 rounded-[3.5rem] bg-white border border-slate-200 shadow-sm group hover:border-indigo-100 transition-all duration-500">
                        <div className="flex items-center justify-between mb-8">
                            <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                                <m.icon className="h-6 w-6 text-slate-900 group-hover:text-indigo-600 transition-colors" />
                            </div>
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest ${m.isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                {m.isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                {m.trend}
                            </div>
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{m.label}</p>
                        <p className="text-4xl font-black text-slate-900 tracking-tighter">{loading ? '...' : m.value}</p>
                    </div>
                ))}
            </div>

            {/* Chart Placeholders */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="p-12 rounded-[4rem] bg-white border border-slate-200 shadow-sm space-y-8">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black tracking-tight text-slate-900">Revenue Velocity</h3>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Past 30 Days</span>
                    </div>
                    <div className="h-64 bg-slate-50 rounded-[3rem] flex items-end justify-between p-10 gap-4 shadow-inner">
                        {[40, 70, 45, 90, 65, 85, 55, 75, 50, 80].map((h, i) => (
                            <div key={i} className="flex-1 bg-indigo-600/20 rounded-full group hover:bg-indigo-600 transition-all duration-500 relative" style={{ height: `${h}%` }}>
                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">₹{h}k</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-12 rounded-[4rem] bg-white border border-slate-200 shadow-sm space-y-8">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black tracking-tight text-slate-900">Acquisition Conversion</h3>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Funnel Integrity</span>
                    </div>
                    <div className="space-y-6">
                        {[
                            { label: 'Platform Visits', value: '124,000', p: 100 },
                            { label: 'Event Discovery', value: '86,000', p: 69 },
                            { label: 'Checkout Initiation', value: '12,400', p: 14 },
                            { label: 'Registry Completion', value: '8,200', p: 66 }
                        ].map((s, i) => (
                            <div key={i} className="space-y-2">
                                <div className="flex justify-between text-[11px] font-black uppercase tracking-widest">
                                    <span className="text-slate-400">{s.label}</span>
                                    <span className="text-slate-900">{s.value}</span>
                                </div>
                                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                    <div className="h-full bg-slate-900 rounded-full transition-all duration-1000" style={{ width: `${s.p}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
