"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import { ShieldAlert, ShieldCheck, AlertCircle, Search, Filter, Ban, ChevronRight } from "lucide-react";

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
        <div className="space-y-12 pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8 border-b border-slate-200 pb-12">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <ShieldAlert className="h-6 w-6 text-red-600" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Trust & Safety</span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-slate-900">Safety Governance</h1>
                    <p className="text-base text-slate-500 mt-3 font-medium max-w-2xl leading-relaxed">
                        Monitor suspicious activity, manage user reports, and enforce platform boundaries. <span className="text-slate-900">Protect the ecosystem for all participants.</span>
                    </p>
                </div>
            </div>

            {/* Risk Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="p-10 rounded-[3.5rem] bg-white border border-slate-200 shadow-sm flex items-center gap-8">
                    <div className="h-16 w-16 rounded-[1.8rem] bg-red-50 flex items-center justify-center border border-red-100/50">
                        <ShieldAlert className="h-8 w-8 text-red-600" />
                    </div>
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">High Risk Signals</p>
                        <p className="text-4xl font-black text-slate-900 tracking-tighter">0</p>
                    </div>
                </div>
                <div className="p-10 rounded-[3.5rem] bg-white border border-slate-200 shadow-sm flex items-center gap-8">
                    <div className="h-16 w-16 rounded-[1.8rem] bg-amber-50 flex items-center justify-center border border-amber-100/50">
                        <AlertCircle className="h-8 w-8 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Pending Reports</p>
                        <p className="text-4xl font-black text-slate-900 tracking-tighter">{reports.length}</p>
                    </div>
                </div>
                <div className="p-10 rounded-[3.5rem] bg-emerald-600 shadow-xl shadow-emerald-100 flex items-center gap-8">
                    <div className="h-16 w-16 rounded-[1.8rem] bg-white/10 flex items-center justify-center">
                        <ShieldCheck className="h-8 w-8 text-white" />
                    </div>
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-white/50 mb-1">Safe Sessions</p>
                        <p className="text-4xl font-black text-white tracking-tighter">99.9%</p>
                    </div>
                </div>
            </div>

            {/* Moderation Queue */}
            <div className="space-y-8">
                <div className="flex gap-4 p-3 rounded-[2.5rem] bg-white border border-slate-200 shadow-sm items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-8 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Screen identity flags, reported assets, or behavior logs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-50 rounded-[1.8rem] pl-16 pr-8 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:bg-white transition-all font-semibold placeholder:text-slate-300"
                        />
                    </div>
                    <button className="p-4 rounded-2xl border border-slate-100 bg-slate-50 text-slate-400 hover:text-slate-900 transition-all mr-2">
                        <Filter className="h-5 w-5" />
                    </button>
                </div>

                <div className="rounded-[4rem] border border-slate-200 bg-white shadow-sm overflow-hidden p-12">
                    {reports.length === 0 ? (
                        <div className="py-32 text-center rounded-[3rem] border-2 border-slate-100 border-dashed bg-slate-50/50">
                            <div className="h-24 w-24 bg-white rounded-full flex items-center justify-center mx-auto mb-10 shadow-sm border border-slate-100">
                                <ShieldCheck className="h-12 w-12 text-emerald-500" />
                            </div>
                            <h3 className="text-3xl font-black tracking-tighter text-slate-900">Integrity Intact</h3>
                            <p className="text-lg text-slate-500 mt-4 font-medium max-w-md mx-auto leading-relaxed">No reports require immediate intervention. All safety signals are within acceptable deviation parameters.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {filteredReports.length > 0 ? filteredReports.map((r) => (
                                <div key={r.id} className="p-10 rounded-[3rem] bg-white border border-slate-200 hover:border-red-100 transition-all shadow-sm group">
                                    <div className="flex items-center gap-10">
                                        <div className="p-6 rounded-2xl bg-red-50 text-red-600 shadow-inner">
                                            <ShieldAlert className="h-8 w-8" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xl font-black tracking-tight text-slate-900 mb-2">{r.reason || 'Safety Violation Reported'}</p>
                                            <div className="flex items-center gap-4 text-[11px] font-black uppercase tracking-widest text-slate-400">
                                                <span>Reporter: {r.reporterEmail || 'Anonymous'}</span>
                                                <div className="h-1 w-1 bg-slate-200 rounded-full" />
                                                <span className="text-red-600">Urgency: {r.priority || 'NORMAL'}</span>
                                            </div>
                                        </div>
                                        <button className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest hover:bg-red-600 transition-all group-hover:scale-105">
                                            Handle Case
                                            <ChevronRight className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            )) : (
                                <div className="py-24 text-center">
                                    <p className="text-sm font-black uppercase tracking-widest text-slate-300 italic">No reports match the current filter criteria.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
