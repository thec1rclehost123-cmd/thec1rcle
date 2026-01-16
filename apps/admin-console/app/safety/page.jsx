"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import { ShieldAlert, ShieldCheck, AlertCircle, Search, Filter, Ban, ChevronRight, X, Activity, Flame, User } from "lucide-react";

export default function AdminSafety() {
    const { user } = useAuth();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const fetchSafety = async () => {
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/list?collection=safety_reports', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();
            setReports(json.data || []);
        } catch (err) {
            console.error("Failed to fetch safety reports", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchSafety();
    }, [user]);

    const filteredReports = reports.filter(r =>
        r.reporterEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-12 pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <ShieldAlert className="h-4 w-4 text-iris" strokeWidth={1.5} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-iris">Security Oversight</span>
                    </div>
                    <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">Safety Center</h1>
                    <p className="text-sm text-zinc-500 font-medium max-w-xl">
                        Monitor user reports, investigate incidents, and maintain platform security.
                    </p>
                </div>
            </div>

            {/* Status Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-8 rounded-xl bg-obsidian-surface border border-[#ffffff08] flex items-center gap-6 shadow-sm overflow-hidden relative group hover:border-iris/20 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Flame className="h-24 w-24 text-iris" />
                    </div>
                    <div className="h-12 w-12 rounded-lg bg-iris/10 flex items-center justify-center border border-iris/20 shadow-inner">
                        <ShieldAlert className="h-5 w-5 text-iris" strokeWidth={1.5} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500 mb-0.5">Critical Incidents</p>
                        <p className="text-3xl font-light text-white tracking-tighter font-mono-numbers">0</p>
                    </div>
                </div>
                <div className="p-8 rounded-xl bg-obsidian-surface border border-[#ffffff08] flex items-center gap-6 shadow-sm overflow-hidden relative group hover:border-amber-500/20 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <AlertCircle className="h-24 w-24 text-amber-500" />
                    </div>
                    <div className="h-12 w-12 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shadow-inner">
                        <AlertCircle className="h-5 w-5 text-amber-500" strokeWidth={1.5} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500 mb-0.5">Active Reports</p>
                        <p className="text-3xl font-light text-white tracking-tighter font-mono-numbers">{reports.length}</p>
                    </div>
                </div>
                <div className="p-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-6 shadow-lg shadow-emerald-500/5 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-emerald-500">
                        <Activity className="h-24 w-24" />
                    </div>
                    <div className="h-12 w-12 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                        <ShieldCheck className="h-5 w-5 text-emerald-500" strokeWidth={1.5} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-500 mb-0.5">Safety Rating</p>
                        <p className="text-3xl font-light text-white tracking-tighter font-mono-numbers">99.9%</p>
                    </div>
                </div>
            </div>

            {/* Moderation Queue */}
            <div className="space-y-6">
                <div className="flex gap-4 items-center px-1">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-500 group-focus-within:text-zinc-300 transition-colors" strokeWidth={1.5} />
                        <input
                            type="text"
                            placeholder="Search reports by email, reason, or report ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-obsidian-surface border border-[#ffffff08] rounded-xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:ring-1 focus:ring-white/10 transition-all font-medium placeholder:text-zinc-700 text-white"
                        />
                    </div>
                </div>

                <div className="rounded-xl border border-[#ffffff08] bg-obsidian-surface overflow-hidden shadow-sm">
                    {loading ? (
                        <div className="p-12 space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="h-20 bg-white/5 animate-pulse rounded-lg border border-white/5" />
                            ))}
                        </div>
                    ) : reports.length === 0 ? (
                        <div className="py-24 text-center">
                            <div className="h-16 w-16 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/5 shadow-inner">
                                <ShieldCheck className="h-8 w-8 text-emerald-500" strokeWidth={1} />
                            </div>
                            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">Queue Empty</h3>
                            <p className="text-[10px] text-zinc-600 mt-2 font-bold uppercase tracking-widest leading-relaxed">No pending safety reports or security incidents at this time.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[#ffffff05]">
                            {filteredReports.length > 0 ? filteredReports.map((r) => (
                                <div key={r.id} className="p-8 hover:bg-white/[0.01] transition-colors group">
                                    <div className="flex items-center gap-8">
                                        <div className="p-4 rounded-lg bg-zinc-900 border border-white/5 text-iris group-hover:border-iris/20 transition-all">
                                            <ShieldAlert className="h-6 w-6" strokeWidth={1.5} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-lg font-semibold tracking-tight text-white mb-1.5 truncate uppercase">{(r.reason || 'Reported Incident')}</p>
                                            <div className="flex items-center gap-4 text-[9px] font-bold uppercase tracking-widest text-zinc-600">
                                                <span className="flex items-center gap-1.5"><User className="h-3 w-3" strokeWidth={1.5} /> {r.reporterEmail || 'Anonymous'}</span>
                                                <div className="h-1 w-1 bg-zinc-800 rounded-full" />
                                                <span className={`${r.priority === 'CRITICAL' ? 'text-iris' : 'text-amber-500'}`}>Priority: {r.priority || 'Normal'}</span>
                                            </div>
                                        </div>
                                        <button className="flex items-center gap-2 px-5 py-3 rounded-lg bg-white/5 border border-white/5 text-zinc-400 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all group-hover:border-white/10">
                                            Review Case
                                            <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                                        </button>
                                    </div>
                                </div>
                            )) : (
                                <div className="py-20 text-center">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-700 italic">No reports found matching your search.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
