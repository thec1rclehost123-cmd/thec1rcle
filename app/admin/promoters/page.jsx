"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import { Users, Search, Filter, Megaphone, ShieldAlert, CheckCircle2, MoreVertical, ExternalLink } from "lucide-react";

export default function AdminPromoters() {
    const { user } = useAuth();
    const [promoters, setPromoters] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchPromoters() {
            try {
                const token = await user.getIdToken();
                const res = await fetch('/api/admin/list?collection=promoters', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.results) setPromoters(data.results);
            } catch (err) {
                console.error("Failed to fetch promoters", err);
            } finally {
                setLoading(false);
            }
        }
        if (user) fetchPromoters();
    }, [user]);

    return (
        <div className="space-y-12 pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8 border-b border-slate-200 pb-12">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <Users className="h-6 w-6 text-indigo-600" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Distribution Governance</span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-slate-900">Promoter Network</h1>
                    <p className="text-base text-slate-500 mt-3 font-medium max-w-2xl leading-relaxed">
                        Authorize distribution partners and monitor individual conversion metrics. <span className="text-slate-900">Scale the circle through verified network effects.</span>
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <button className="px-8 py-4 rounded-[1.8rem] bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
                        Induct Promoter
                    </button>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 relative group">
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 bg-white p-1.5 rounded-xl border border-slate-100 shadow-sm">
                        <Search className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Filter distribution nodes..."
                        className="w-full bg-white border border-slate-200 pl-16 pr-8 py-5 rounded-[2rem] text-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5 focus:border-slate-300 transition-all font-semibold placeholder:text-slate-300 shadow-sm"
                    />
                </div>
                <button className="px-8 py-5 bg-white border border-slate-200 rounded-[2rem] text-sm font-black uppercase tracking-widest text-slate-900 flex items-center justify-center gap-3 hover:bg-slate-50 transition-all shadow-sm">
                    <Filter className="h-4 w-4" />
                    Refine Registry
                </button>
            </div>

            {/* Promoter Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {loading ? (
                    [1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-80 rounded-[3.5rem] bg-white border border-slate-200 animate-pulse shadow-sm" />
                    ))
                ) : promoters.length > 0 ? promoters.map((promoter) => (
                    <div key={promoter.id} className="group relative bg-white rounded-[3.5rem] border border-slate-200 p-10 hover:border-indigo-100 hover:shadow-2xl hover:shadow-slate-200 transition-all duration-500 hover:-translate-y-2">
                        <div className="flex justify-between items-start mb-8">
                            <div className="h-16 w-16 rounded-[1.8rem] bg-slate-50 border border-slate-100 flex items-center justify-center text-xl font-black text-slate-900 group-hover:bg-white transition-colors">
                                {promoter.displayName?.[0] || promoter.email?.[0]?.toUpperCase()}
                            </div>
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-100">
                                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 font-sans">{promoter.status || 'Active'}</span>
                            </div>
                        </div>

                        <div className="space-y-2 mb-8">
                            <h3 className="text-xl font-black tracking-tighter text-slate-900 leading-none">{promoter.displayName || 'Unnamed Partner'}</h3>
                            <p className="text-xs font-bold text-slate-400 lowercase truncate">{promoter.email}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="p-5 rounded-3xl bg-slate-50 border border-slate-100">
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Impact</p>
                                <p className="text-lg font-black text-slate-900 uppercase tracking-tight">{promoter.conversionCount || 0}</p>
                            </div>
                            <div className="p-5 rounded-3xl bg-slate-50 border border-slate-100">
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Tier</p>
                                <p className="text-lg font-black text-slate-900 uppercase tracking-tight">Alpha</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button className="flex-1 px-6 py-4 rounded-[1.5rem] bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-900 hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center gap-3">
                                <ExternalLink className="h-3 w-3" />
                                Credentials
                            </button>
                            <button className="h-12 w-12 rounded-[1.5rem] border border-slate-100 flex items-center justify-center text-slate-300 hover:text-red-500 hover:border-red-100 hover:bg-red-50 transition-all">
                                <ShieldAlert className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                )) : (
                    <div className="col-span-full p-32 text-center rounded-[4rem] border-2 border-slate-200 border-dashed bg-slate-50/50">
                        <Megaphone className="h-16 w-16 text-slate-200 mx-auto mb-6" />
                        <p className="text-sm text-slate-400 font-black uppercase tracking-widest leading-relaxed">No active promoters<br />found in the network.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
