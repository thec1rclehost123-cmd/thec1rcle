"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import { Search, Filter, History, User, Terminal, CheckCircle2, Eye, ShieldCheck, ChevronRight, X } from "lucide-react";

export default function AdminLogs() {
    const { user } = useAuth();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState(null);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        if (!user) return;

        let unsubscribe;
        const fetchLogsRealtime = async () => {
            try {
                const { getFirebaseDb } = await import("@/lib/firebase/client");
                const { collection, query, orderBy, limit, onSnapshot } = await import("firebase/firestore");

                const dbClient = getFirebaseDb();
                const q = query(
                    collection(dbClient, "admin_audit_logs"),
                    orderBy("createdAt", "desc"),
                    limit(50)
                );

                unsubscribe = onSnapshot(q, (snapshot) => {
                    const results = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                        ts: doc.data().createdAt?.toDate() || new Date()
                    }));
                    setLogs(results);
                    setLoading(false);
                }, (err) => {
                    console.error("Real-time listener failed", err);
                    setError(err.message);
                    setLoading(false);
                });
            } catch (err) {
                console.error("Failed to initialize logs stream", err);
                setError(err.message);
                setLoading(false);
            }
        };

        fetchLogsRealtime();
        return () => unsubscribe?.();
    }, [user]);

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

        return cleaned
            .replace(/Manual Migration Bridge Executed/i, 'Administrative bridge sync completed')
            .replace(/Processed (\d+) Identities/i, '$1 profiles updated')
            .replace(/Admin action recorded in log/i, 'System verification recorded');
    };

    const filtered = logs.filter(l =>
        l.actionType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.actorEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.targetId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.reason?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-12 pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <History className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">Activity History</span>
                    </div>
                    <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">Audit Logs</h1>
                    <p className="text-sm text-zinc-500 font-medium max-w-xl">
                        A complete record of all administrative actions and system updates.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="h-8 px-3 rounded-md bg-white/5 border border-white/5 flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Live Feed Active</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Main Ledger */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-500 group-focus-within:text-zinc-300 transition-colors" strokeWidth={1.5} />
                        <input
                            type="text"
                            placeholder="Find logs by admin, action, or target ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-obsidian-surface border border-[#ffffff08] rounded-xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:ring-1 focus:ring-white/10 focus:bg-zinc-900 transition-all font-medium placeholder:text-zinc-600 text-white"
                        />
                    </div>

                    <div className="bg-obsidian-surface rounded-xl border border-[#ffffff08] overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white/[0.02] border-b border-[#ffffff08]">
                                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Time</th>
                                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Admin</th>
                                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Action</th>
                                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Status</th>
                                        <th className="px-6 py-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#ffffff05]">
                                    {loading ? (
                                        [...Array(8)].map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                <td colSpan={5} className="px-6 py-6 h-16 bg-white/[0.01]" />
                                            </tr>
                                        ))
                                    ) : error ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <Terminal className="h-8 w-8 text-iris mb-2" strokeWidth={1.5} />
                                                    <p className="text-[10px] font-bold text-iris uppercase tracking-widest">Connection Error</p>
                                                    <p className="text-[11px] text-zinc-600 font-mono tracking-tighter">{error}</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filtered.length > 0 ? filtered.map((log) => (
                                        <tr
                                            key={log.id}
                                            onClick={() => setSelectedLog(log)}
                                            className={`group cursor-pointer transition-colors ${selectedLog?.id === log.id ? 'bg-white/[0.05]' : 'hover:bg-white/[0.03]'}`}
                                        >
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[11px] font-medium text-white leading-tight">
                                                        {new Date(log.ts || log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest leading-tight">
                                                        {new Date(log.ts || log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded bg-zinc-900 border border-white/5 flex items-center justify-center text-[10px] font-bold text-zinc-700">
                                                        {log.actorEmail?.[0]?.toUpperCase() || "A"}
                                                    </div>
                                                    <span className="text-xs font-semibold text-zinc-400 truncate max-w-[150px]">{log.actorEmail}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-white">{cleanJargon(log.actionType || log.action)}</span>
                                                    <span className="text-[9px] font-bold text-zinc-500 tracking-widest uppercase">Target: {log.targetId?.slice(0, 12)}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded border ${log.status === 'failed' ? 'bg-iris/10 border-iris/20 text-iris' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}>
                                                    <div className={`h-1.5 w-1.5 rounded-full ${log.status === 'failed' ? 'bg-iris' : 'bg-emerald-500'}`} />
                                                    <span className="text-[9px] font-bold uppercase tracking-widest">
                                                        {log.status === 'failed' ? 'Failed' : 'Success'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <ChevronRight className={`h-4 w-4 transition-all ${selectedLog?.id === log.id ? 'text-white translate-x-1' : 'text-zinc-700 group-hover:text-white group-hover:translate-x-1'}`} strokeWidth={1.5} />
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-20 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-700 italic">No logs found matching your search.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Inspection Panel */}
                <aside className="lg:col-span-4 h-fit">
                    {selectedLog ? (
                        <div className="sticky top-28 space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="bg-obsidian-surface border border-[#ffffff08] rounded-xl p-8 space-y-8 shadow-2xl relative">
                                <button
                                    onClick={() => setSelectedLog(null)}
                                    className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
                                >
                                    <X className="h-4 w-4" strokeWidth={1.5} />
                                </button>

                                <div className="flex flex-col items-center text-center pt-2 space-y-4">
                                    <div className="h-16 w-16 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-700 shadow-inner">
                                        <Terminal className="h-8 w-8" strokeWidth={1.5} />
                                    </div>
                                    <div className="space-y-1">
                                        <h2 className="text-2xl font-semibold tracking-tight text-white leading-tight">
                                            {cleanJargon(selectedLog.actionType || selectedLog.action)}
                                        </h2>
                                        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Log Details Reviewed</p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="p-5 rounded-xl bg-white/[0.02] border border-[#ffffff05] space-y-6">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">Admin Reason</p>
                                            <p className="text-sm font-medium text-zinc-400 italic leading-relaxed">"{cleanJargon((selectedLog.reason || selectedLog.details?.reason) || 'Authenticated administrative action.')}"</p>
                                        </div>

                                        {(selectedLog.before || selectedLog.after) && (
                                            <div className="space-y-4 pt-4 border-t border-[#ffffff05]">
                                                {selectedLog.before && (
                                                    <div className="space-y-2">
                                                        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Previous State</p>
                                                        <div className="max-h-[120px] overflow-y-auto custom-scrollbar bg-black/40 p-3 rounded-lg border border-white/5">
                                                            <pre className="text-[10px] font-mono text-zinc-500 whitespace-pre-wrap">
                                                                {JSON.stringify(selectedLog.before, null, 2)}
                                                            </pre>
                                                        </div>
                                                    </div>
                                                )}
                                                {selectedLog.after && (
                                                    <div className="space-y-2">
                                                        <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-500">Final State</p>
                                                        <div className="max-h-[120px] overflow-y-auto custom-scrollbar bg-emerald-500/5 p-3 rounded-lg border border-emerald-500/10">
                                                            <pre className="text-[10px] font-mono text-emerald-500/70 whitespace-pre-wrap">
                                                                {JSON.stringify(selectedLog.after, null, 2)}
                                                            </pre>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="pt-4 border-t border-[#ffffff05] grid grid-cols-2 gap-6">
                                            <div>
                                                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-1">Target ID</p>
                                                <p className="text-[10px] font-bold text-zinc-400 truncate tracking-tight uppercase">#{selectedLog.targetId?.slice(0, 12)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-1">IP Address</p>
                                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">{(selectedLog.ipAddress || selectedLog.ip) || 'HIDDEN'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900 border border-white/5">
                                            <User className="h-4 w-4 text-zinc-600" strokeWidth={1.5} />
                                            <div className="min-w-0">
                                                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-0.5">Performed By</p>
                                                <p className="text-[11px] font-bold text-white truncate">{selectedLog.actorEmail || selectedLog.adminEmail}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900 border border-white/5">
                                            <ShieldCheck className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
                                            <div className="min-w-0">
                                                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-0.5">Authorization</p>
                                                <p className="text-[11px] font-bold text-white uppercase tracking-widest">{selectedLog.proposalId ? 'Approved Proposal' : 'Standard Access'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-2 text-center">
                                    <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest italic opacity-50">Log entry verified for platform record.</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-[400px] flex flex-col items-center justify-center rounded-xl border border-[#ffffff05] bg-white/[0.01] text-center p-8 sticky top-28">
                            <History className="h-12 w-12 text-zinc-800 mb-6" strokeWidth={1} />
                            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest leading-relaxed">Select a log entry<br />to view full details.</p>
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}
