"use client";

import { useEffect, useState } from "react";
import {
    Users,
    Building2,
    UserRound,
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
    Filter
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

export default function AdminDashboard() {
    const { user } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchSnapshot() {
            try {
                const token = await user.getIdToken();
                const res = await fetch('/api/admin/snapshot', {
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
            <div className="space-y-12 animate-pulse pb-20">
                <div className="h-48 bg-slate-50 rounded-[3rem] border border-slate-200" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="h-48 bg-white rounded-[3rem] border border-slate-200 shadow-sm" />
                    ))}
                </div>
            </div>
        );
    }

    const snapshot = data?.snapshot || {};
    const alerts = data?.alerts || [];
    const logs = data?.recentLogs || [];

    const stats = [
        { label: "Platform Users", value: snapshot.users_total || 0, icon: Users, color: "blue" },
        { label: "Active Venues", value: snapshot.venues_total?.active || 0, icon: Building2, color: "indigo" },
        { label: "Verified Hosts", value: snapshot.hosts_total || 0, icon: UserRound, color: "orange" },
        { label: "Live Events", value: snapshot.events?.live || 0, icon: Calendar, color: "emerald" },
        { label: "Platform Revenue", value: `₹${(snapshot.revenue?.total || 0).toLocaleString()}`, icon: TrendingUp, color: "indigo" },
        { label: "Total Tickets", value: snapshot.tickets_sold_total || 0, icon: Ticket, color: "rose" },
        { label: "Pending Reviews", value: alerts.length, icon: ShieldAlert, color: "amber" },
        { label: "Upcoming Registry", value: snapshot.events?.upcoming || 0, icon: Clock, color: "sky" },
    ];

    return (
        <div className="space-y-16 pb-20">
            {/* Executive Header & System Status Alignment */}
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-12 border-b border-slate-200 pb-16">
                <div className="flex-1">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-100/50">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-700">Live Authority Node</span>
                        </div>
                        <div className="h-px w-12 bg-slate-200" />
                        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Node 01-IN-MUM</span>
                    </div>
                    <h1 className="text-7xl font-black tracking-tighter text-slate-900 leading-[0.85] mb-6">Platform Intelligence</h1>
                    <p className="text-lg text-slate-500 font-medium max-w-2xl leading-relaxed">
                        Precision observational snapshot of the c1rcle network. <span className="text-slate-900/80">Monitor system health, verify authority, and audit immutable registries in one coherent view.</span>
                    </p>
                </div>

                <div className="flex flex-shrink-0">
                    <div className="px-10 py-8 rounded-[3rem] bg-white border border-slate-200 flex items-center gap-8 shadow-sm group hover:border-slate-300 transition-all duration-500">
                        <div className="h-16 w-16 rounded-[1.5rem] bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                            <Activity className="h-8 w-8 text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5">Registry Status</p>
                            <div className="flex items-center gap-3">
                                <p className="text-2xl font-black text-slate-900 tracking-tighter leading-none">Vitals Stable</p>
                                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Platform Metrics Engine - Strict Grid */}
            <section>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {stats.map((stat, i) => (
                        <div
                            key={i}
                            className="group relative flex flex-col p-10 rounded-[3.5rem] bg-white border border-slate-200 overflow-hidden transition-all duration-500 hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.06)] hover:-translate-y-2 hover:border-indigo-100 shadow-sm"
                        >
                            <div className="absolute -top-6 -right-6 p-12 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-700 group-hover:rotate-12 group-hover:scale-110">
                                <stat.icon className="h-32 w-32 text-slate-900" />
                            </div>

                            <div className="flex items-center gap-4 mb-10 relative z-10">
                                <div className="h-12 w-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shadow-inner group-hover:bg-white transition-colors">
                                    <stat.icon className="h-6 w-6 text-slate-900" />
                                </div>
                                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-slate-900 transition-colors">{stat.label}</p>
                            </div>

                            <div className="mt-auto relative z-10">
                                <h3 className="text-5xl font-black tracking-tighter text-slate-900 group-hover:text-indigo-600 transition-colors">{stat.value}</h3>
                                <div className="mt-10 flex items-center justify-between border-t border-slate-100 pt-8">
                                    <div className="flex gap-1.5">
                                        {[...Array(4)].map((_, j) => (
                                            <div key={j} className={`h-1.5 w-6 rounded-full transition-all duration-500 ${j < 3 ? 'bg-slate-900 group-hover:bg-indigo-600' : 'bg-slate-100'}`} />
                                        ))}
                                    </div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">Verified</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Intelligence Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">

                {/* Left: Alerts & Status */}
                <div className="lg:col-span-2 space-y-16">
                    <section>
                        <div className="flex items-center justify-between mb-10 px-4">
                            <div className="flex items-center gap-4">
                                <div className="h-6 w-1.5 bg-indigo-600 rounded-full"></div>
                                <h2 className="text-lg font-black uppercase tracking-[0.2em] text-slate-900">Moderation Signals</h2>
                            </div>
                            <span className="text-xs text-slate-500 font-black bg-white border border-slate-200 px-5 py-2 rounded-full uppercase tracking-widest shadow-sm">Queue Intensity: {alerts.length}</span>
                        </div>

                        <div className="space-y-6">
                            {alerts.length > 0 ? alerts.map((alert) => (
                                <div
                                    key={alert.id}
                                    className="flex items-center gap-10 p-10 rounded-[3rem] bg-white border border-slate-200 hover:border-slate-300 transition-all shadow-sm hover:shadow-xl hover:shadow-slate-100 group"
                                >
                                    <div className={`p-6 rounded-2xl shadow-inner ${alert.priority === 'high' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                                        <AlertCircle className="h-8 w-8" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xl font-black tracking-tight text-slate-900 leading-tight mb-2 truncate">{alert.message}</p>
                                        <p className="text-[11px] text-slate-400 uppercase tracking-[0.15em] font-black">Escalation Protocol Required • Urgent Review</p>
                                    </div>
                                    <button className="flex items-center gap-3 px-8 py-4 rounded-[1.8rem] bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 group-hover:scale-105 transition-transform shrink-0">
                                        Resolve
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            )) : (
                                <div className="p-32 text-center rounded-[3rem] border-2 border-slate-200 border-dashed bg-slate-50/50">
                                    <div className="h-24 w-24 bg-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-sm border border-slate-100">
                                        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                                    </div>
                                    <h3 className="text-2xl font-black tracking-tighter text-slate-900">Universal Calm</h3>
                                    <p className="text-base text-slate-500 mt-3 font-medium max-w-xs mx-auto">Zero active incidents recorded. Platform integrity is within expected norms.</p>
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                {/* Right: Immutability Feed */}
                <aside>
                    <div className="sticky top-[120px] space-y-12">
                        <section className="bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-xl shadow-slate-100">
                            <div className="flex items-center justify-between mb-12">
                                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-900">Audit Trace</h2>
                                <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                                    <History className="h-5 w-5 text-indigo-600" />
                                </div>
                            </div>
                            <div className="space-y-12">
                                {logs.map((log) => (
                                    <div key={log.id} className="relative pl-10 border-l-2 border-slate-100">
                                        <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-white border-2 border-indigo-600 shadow-[0_0_12px_rgba(79,70,229,0.4)]"></div>
                                        <div className="space-y-4">
                                            <p className="text-sm font-black tracking-tight uppercase text-slate-900 leading-none">
                                                {log.action?.replace('_', ' ')}
                                            </p>
                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-2">
                                                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                <span className="h-1 w-1 rounded-full bg-slate-200" />
                                                {new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                            </p>
                                            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500 leading-relaxed font-bold italic shadow-inner">
                                                "{log.reason || 'Manual system bypass recorded.'}"
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {logs.length === 0 && (
                                    <div className="text-center py-20">
                                        <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <Clock className="h-8 w-8 text-slate-200" />
                                        </div>
                                        <p className="text-[11px] text-slate-400 uppercase tracking-widest font-black">Observing Entrypoints...</p>
                                    </div>
                                )}
                            </div>
                            <button className="w-full mt-12 py-5 rounded-[1.8rem] bg-white border border-slate-200 text-slate-900 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-3">
                                View Registry
                                <ChevronRight className="h-3 w-3" />
                            </button>
                        </section>
                    </div>
                </aside>
            </div>
        </div>
    );
}
