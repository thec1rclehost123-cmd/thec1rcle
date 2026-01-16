"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import { Search, MessageSquare, Clock, ShieldAlert, ChevronRight, Filter, AlertCircle, CheckCircle2, User } from "lucide-react";

export default function AdminSupport() {
    const { user } = useAuth();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const fetchSupport = async () => {
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/list?collection=support_tickets', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();
            setTickets(json.data || []);
        } catch (err) {
            console.error("Failed to fetch support tickets", err);
        } finally {
            setLoading(false);
        }
    };

    const filtered = tickets.filter(t =>
        t.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        if (user) fetchSupport();
    }, [user]);

    return (
        <div className="space-y-12 pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <MessageSquare className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">Concierge Desk</span>
                    </div>
                    <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">Help Center</h1>
                    <p className="text-sm text-zinc-500 font-medium max-w-xl">
                        Review and resolve incoming customer inquiries and technical issues.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="px-5 py-2.5 bg-white/[0.02] border border-[#ffffff05] rounded-xl flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                        <div className="flex flex-col">
                            <span className="text-[11px] font-bold text-white leading-tight">{tickets.filter(t => t.status === 'open').length}</span>
                            <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest leading-none">Unresolved</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* List Area */}
            <div className="space-y-6">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-600 group-focus-within:text-zinc-300 transition-colors" strokeWidth={1.5} />
                    <input
                        type="text"
                        placeholder="Look up messages by subject, email, or request ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-obsidian-surface border border-[#ffffff08] rounded-xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:ring-1 focus:ring-white/10 transition-all font-medium placeholder:text-zinc-700 text-white"
                    />
                </div>

                <div className="bg-obsidian-surface rounded-xl border border-[#ffffff08] overflow-hidden shadow-sm overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/[0.02] border-b border-[#ffffff08]">
                                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Inquiry Subject</th>
                                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Customer</th>
                                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Priority</th>
                                <th className="px-8 py-4 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#ffffff05]">
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={4} className="px-8 py-8 h-20 bg-white/[0.01]" />
                                    </tr>
                                ))
                            ) : filtered.length > 0 ? filtered.map((t) => (
                                <tr key={t.id} className="hover:bg-white/[0.01] transition-colors cursor-pointer group">
                                    <td className="px-8 py-6">
                                        <p className="text-sm font-semibold text-white tracking-tight uppercase">{t.subject || 'Support Message'}</p>
                                        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-1">ID: {t.id?.slice(-8).toUpperCase()}</p>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-2">
                                            <User className="h-3 w-3 text-zinc-700" strokeWidth={2} />
                                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest truncate max-w-[200px]">{t.userEmail || 'Anonymous'}</p>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className={`inline-flex items-center px-2 py-0.5 rounded border ${t.priority === 'high' ? 'bg-iris/10 text-iris border-iris/20' : 'bg-white/5 text-zinc-600 border-white/5'}`}>
                                            <span className="text-[9px] font-bold uppercase tracking-widest">{t.priority || 'Normal'}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border ${t.status === 'open' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}>
                                            <div className={`h-1 w-1 rounded-full ${t.status === 'open' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                            <span className="text-[9px] font-bold uppercase tracking-widest">
                                                {t.status?.toUpperCase() || 'RESOLVED'}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={4} className="px-8 py-24 text-center">
                                    <div className="h-16 w-16 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/5 shadow-inner">
                                        <MessageSquare className="h-8 w-8 text-zinc-800" strokeWidth={1} />
                                    </div>
                                    <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">No active requests</h4>
                                    <p className="text-[10px] text-zinc-600 mt-2 font-bold uppercase tracking-[0.2em]">The support queue is currently empty.</p>
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
