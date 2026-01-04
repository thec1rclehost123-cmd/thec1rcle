"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import { Search, Ticket, Calendar, Activity, CreditCard, ChevronRight, Filter, Download } from "lucide-react";

export default function AdminTickets() {
    const { user } = useAuth();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchTickets = async () => {
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/list?collection=tickets', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();
            setTickets(json.data || []);
        } catch (err) {
            console.error("Failed to fetch tickets", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchTickets();
    }, [user]);

    return (
        <div className="space-y-12 pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8 border-b border-slate-200 pb-12">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <Ticket className="h-6 w-6 text-indigo-600" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Inventory Management</span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-slate-900">Ticket Registry</h1>
                    <p className="text-base text-slate-500 mt-3 font-medium max-w-2xl leading-relaxed">
                        Control and monitor ticket inventory, check-in status, and manual adjustments. <span className="text-slate-900">Process batches and verify authenticity.</span>
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <button className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-white border border-slate-200 text-slate-900 text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
                        <Download className="h-4 w-4" />
                        Export Census
                    </button>
                </div>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="p-8 rounded-[2.5rem] bg-white border border-slate-200 shadow-sm flex items-center gap-6">
                    <div className="h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
                        <Ticket className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Active Inventory</p>
                        <p className="text-2xl font-black text-slate-900">{tickets.length}</p>
                    </div>
                </div>
                <div className="p-8 rounded-[2.5rem] bg-white border border-slate-200 shadow-sm flex items-center gap-6">
                    <div className="h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
                        <Activity className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Check-in Rate</p>
                        <p className="text-2xl font-black text-slate-900">--%</p>
                    </div>
                </div>
                <div className="p-8 rounded-[2.5rem] bg-white border border-slate-200 shadow-sm flex items-center gap-6">
                    <div className="h-14 w-14 rounded-2xl bg-amber-50 flex items-center justify-center">
                        <CreditCard className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Revenue Integrity</p>
                        <p className="text-2xl font-black text-slate-900">Verified</p>
                    </div>
                </div>
            </div>

            {/* List Area */}
            <div className="space-y-8">
                <div className="flex gap-4 p-3 rounded-[2.5rem] bg-white border border-slate-200 shadow-sm items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-8 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search ticket registry by ID, event code, or buyer identifier..."
                            className="w-full bg-slate-50 rounded-[1.8rem] pl-16 pr-8 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:bg-white transition-all font-semibold placeholder:text-slate-300"
                        />
                    </div>
                    <button className="p-4 rounded-2xl border border-slate-100 bg-slate-50 text-slate-400 hover:text-slate-900 transition-all mr-2">
                        <Filter className="h-5 w-5" />
                    </button>
                </div>

                <div className="rounded-[3rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/50">
                                    <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Ticket Asset</th>
                                    <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Event Context</th>
                                    <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Ownership</th>
                                    <th className="px-10 py-6 text-right text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    [...Array(10)].map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={4} className="px-10 py-10"><div className="h-4 bg-slate-100 rounded-full w-full" /></td>
                                        </tr>
                                    ))
                                ) : tickets.length > 0 ? tickets.map((t) => (
                                    <tr
                                        key={t.id}
                                        className="hover:bg-slate-50 transition-all cursor-pointer group"
                                    >
                                        <td className="px-10 py-8">
                                            <div className="flex items-center gap-5">
                                                <div className="h-12 w-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center font-black text-xs text-slate-400">
                                                    #{t.id?.slice(-4).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-base font-black tracking-tight text-slate-900">{t.ticketType || 'Standard Access'}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">₹{(t.price || 0).toLocaleString()}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-3 w-3 text-slate-300" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                    {t.eventTitle || 'Unknown Event'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <p className="text-[11px] text-slate-500 font-black uppercase tracking-tighter truncate max-w-[150px]">
                                                {t.userName || t.userEmail || 'REDACTED'}
                                            </p>
                                        </td>
                                        <td className="px-10 py-8 text-right">
                                            <div className="flex items-center justify-end gap-3">
                                                <span className={`h-2.5 w-2.5 rounded-full ring-4 ${t.status === 'validated' ? 'bg-emerald-500 ring-emerald-50' : 'bg-blue-500 ring-blue-50'}`}></span>
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${t.status === 'validated' ? 'text-emerald-600' : 'text-slate-900'}`}>
                                                    {t.status || 'AVAILABLE'}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={4} className="px-10 py-24 text-center text-sm text-slate-400 font-bold uppercase tracking-widest italic bg-slate-50/30">No ticket records found in the registry.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
