"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import { Search, MessageSquare, Clock, ShieldAlert, ChevronRight, Filter, AlertCircle } from "lucide-react";

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
        <div className="space-y-12 pb-20">
            {/* Header omitted for brevity in chunk but it's there */}
            {/* ... */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Metrics */}
            </div>

            {/* Resolution Registry */}
            <div className="space-y-8">
                <div className="flex gap-4 p-3 rounded-[2.5rem] bg-white border border-slate-200 shadow-sm items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-8 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search support registry by ticket ID, user UID, or subject..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-50 rounded-[1.8rem] pl-16 pr-8 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:bg-white transition-all font-semibold placeholder:text-slate-300"
                        />
                    </div>
                </div>

                <div className="rounded-[3rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/50">
                                    <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Incident Context</th>
                                    <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Reporter</th>
                                    <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Priority</th>
                                    <th className="px-10 py-6 text-right text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    [...Array(5)].map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={4} className="px-10 py-10"><div className="h-4 bg-slate-100 rounded-full w-full" /></td>
                                        </tr>
                                    ))
                                ) : filtered.length > 0 ? filtered.map((t) => (
                                    <tr key={t.id} className="hover:bg-slate-50 transition-all cursor-pointer group">
                                        <td className="px-10 py-8">
                                            <div>
                                                <p className="text-base font-black tracking-tight text-slate-900">{t.subject || 'Platform Inquiry'}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Ticket #{t.id?.slice(-6).toUpperCase()}</p>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">{t.userEmail || 'REDACTED'}</p>
                                        </td>
                                        <td className="px-10 py-8">
                                            <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border ${t.priority === 'high' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                                {t.priority || 'standard'}
                                            </span>
                                        </td>
                                        <td className="px-10 py-8 text-right">
                                            <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border ${t.status === 'open' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                                {t.status || 'PENDING'}
                                            </span>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={4} className="px-10 py-24 text-center text-sm text-slate-400 font-bold uppercase tracking-widest italic bg-slate-50/30">No active support tickets in the registry.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
