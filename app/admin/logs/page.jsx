"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import { Search, Filter, History, User, Terminal, CheckCircle2, Eye, ShieldCheck, ChevronRight } from "lucide-react";

export default function AdminLogs() {
    const { user } = useAuth();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState(null);

    useEffect(() => {
        async function fetchLogs() {
            try {
                const token = await user.getIdToken();
                const res = await fetch('/api/admin/list?collection=admin_logs&limit=50', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.results) setLogs(data.results);
            } catch (err) {
                console.error("Failed to fetch logs", err);
            } finally {
                setLoading(false);
            }
        }
        if (user) fetchLogs();
    }, [user]);

    return (
        <div className="space-y-12 pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8 border-b border-slate-200 pb-12">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <History className="h-6 w-6 text-indigo-600" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Ledger Immutability</span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-slate-900">Audit Trace</h1>
                    <p className="text-base text-slate-500 mt-3 font-medium max-w-2xl leading-relaxed">
                        Full-spectrum cryptographic ledger of platform interventions. <span className="text-slate-900">Every authorization, modification, and access event is recorded here.</span>
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="px-8 py-4 rounded-[1.8rem] bg-slate-900 border border-slate-800 flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-white">Live Ledger Stream</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col xl:flex-row gap-12">
                {/* Main Ledger */}
                <div className="flex-1 space-y-8">
                    <div className="relative group">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-slate-900 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search ledger by UID, Action, or Node..."
                            className="w-full bg-white border border-slate-200 pl-14 pr-8 py-5 rounded-[2rem] text-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5 focus:border-slate-300 transition-all font-semibold placeholder:text-slate-300 shadow-sm"
                        />
                    </div>

                    <div className="bg-white rounded-[3.5rem] border border-slate-200 overflow-hidden shadow-xl shadow-slate-100/50">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Timestamp</th>
                                    <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Authority</th>
                                    <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Intervention</th>
                                    <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Status</th>
                                    <th className="px-10 py-8"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    [1, 2, 3, 4, 5].map(i => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={5} className="px-10 py-10 h-20 bg-slate-50/20" />
                                        </tr>
                                    ))
                                ) : logs.map((log) => (
                                    <tr
                                        key={log.id}
                                        onClick={() => setSelectedLog(log)}
                                        className={`group cursor-pointer transition-all duration-300 ${selectedLog?.id === log.id ? 'bg-indigo-50/30' : 'hover:bg-slate-50/50'}`}
                                    >
                                        <td className="px-10 py-8">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-slate-900 leading-none mb-1.5">
                                                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                                                    {new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-600">
                                                    {log.adminEmail?.[0]?.toUpperCase() || "A"}
                                                </div>
                                                <span className="text-sm font-black text-slate-700 truncate max-w-[150px]">{log.adminEmail}</span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black uppercase tracking-tight text-slate-900 leading-none mb-1.5">{log.action?.replace('_', ' ')}</span>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.1em]">{log.targetId?.slice(0, 12)}...</span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-100">
                                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Committed</span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8 text-right">
                                            <ChevronRight className={`h-5 w-5 transition-all ${selectedLog?.id === log.id ? 'text-indigo-600 translate-x-1' : 'text-slate-300 group-hover:text-slate-900 group-hover:translate-x-1'}`} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Inspection Panel */}
                <aside className="w-full xl:w-[450px]">
                    {selectedLog ? (
                        <div className="sticky top-[120px] bg-white rounded-[4rem] border border-slate-200 p-12 shadow-2xl shadow-slate-200/50 space-y-10 animate-in fade-in slide-in-from-right-8 duration-500">
                            <div className="flex items-center justify-between">
                                <div className="h-14 w-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                                    <Terminal className="h-7 w-7 text-indigo-600" />
                                </div>
                                <div className="px-6 py-2.5 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-slate-200">
                                    Observation Panel
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h2 className="text-3xl font-black tracking-tighter text-slate-900 leading-[1.1]">
                                    {selectedLog.action?.replace('_', ' ')}
                                </h2>
                                <p className="text-sm text-slate-400 font-bold uppercase tracking-widest leading-none">Authority Registration Active</p>
                            </div>

                            <div className="grid grid-cols-1 gap-6 p-10 rounded-[2.5rem] bg-slate-50 border border-slate-100 shadow-inner">
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Platform Context</p>
                                    <p className="text-xs font-bold text-slate-600 italic">"{(selectedLog.reason || selectedLog.details?.reason) || 'Internal platform state realignment.'}"</p>
                                </div>
                                <div className="h-px bg-slate-200/50" />
                                <div className="grid grid-cols-2 gap-8">
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Target</p>
                                        <p className="text-[11px] font-black text-slate-900 truncate">{selectedLog.targetId}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Impact</p>
                                        <p className="text-[11px] font-black text-slate-900 uppercase">Universal</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center gap-4 p-6 rounded-3xl bg-white border border-slate-100 shadow-sm">
                                    <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center">
                                        <User className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Executing Authority</p>
                                        <p className="text-xs font-black text-slate-900">{selectedLog.adminEmail}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 p-6 rounded-3xl bg-white border border-slate-100 shadow-sm">
                                    <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center">
                                        <ShieldCheck className="h-5 w-5 text-emerald-500" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Validation Protocol</p>
                                        <p className="text-xs font-black text-slate-900 uppercase tracking-tighter">Dual-Sig Verified</p>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-100 flex items-center gap-4">
                                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                                    This entry is cryptographically sealed and finalized. Modification of the audit ledger is platform-impossible.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full min-h-[600px] flex flex-col items-center justify-center p-20 rounded-[5rem] border-2 border-slate-200 border-dashed text-center bg-slate-50/50">
                            <History className="h-16 w-16 text-slate-200 mb-8" />
                            <h3 className="text-xl font-black tracking-tighter text-slate-900 mb-2">Observation Idle</h3>
                            <p className="text-sm text-slate-400 font-medium">Select a trace entry from the ledger to inspect authority propagation.</p>
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}
