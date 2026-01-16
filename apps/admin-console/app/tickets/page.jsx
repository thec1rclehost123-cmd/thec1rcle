"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import { Search, Ticket, Calendar, Activity, CreditCard, ChevronRight, Filter, Download } from "lucide-react";

export default function AdminTickets() {
    const { user } = useAuth();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState("all");

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

    const handleExport = () => {
        const headers = ["ID", "Type", "Event", "Attendee", "Price", "Status"];
        const rows = tickets.map(t => [
            t.id,
            t.ticketType || 'General',
            t.eventTitle || 'N/A',
            t.userName || t.userEmail,
            t.price || 0,
            t.status || 'Valid'
        ]);
        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `c1rcle_tickets_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredTickets = tickets.filter(t => {
        const matchesSearch =
            t.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.eventTitle?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesFilter = filterType === "all" || (t.status?.toLowerCase() === filterType);

        return matchesSearch && matchesFilter;
    });

    return (
        <div className="space-y-12 pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Ticket className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">Sales Record</span>
                    </div>
                    <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">Ticket Master</h1>
                    <p className="text-sm text-zinc-500 font-medium max-w-xl">
                        Monitor all ticket sales, track check-ins, and manage attendee details.
                    </p>
                </div>

                <button
                    onClick={handleExport}
                    className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white text-black text-[11px] font-bold uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-lg shadow-white/5"
                >
                    <Download className="h-4 w-4" />
                    Export CSV
                </button>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-8 rounded-xl bg-obsidian-surface border border-[#ffffff08] flex items-center gap-6 shadow-sm group hover:border-[#ffffff15] transition-all">
                    <div className="h-12 w-12 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
                        <Ticket className="h-5 w-5 text-emerald-500" strokeWidth={1.5} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-1">Total Sold</p>
                        <p className="text-2xl font-light text-white tracking-tight font-mono-numbers">{tickets.length}</p>
                    </div>
                </div>
                <div className="p-8 rounded-xl bg-obsidian-surface border border-[#ffffff08] flex items-center gap-6 shadow-sm group hover:border-[#ffffff15] transition-all">
                    <div className="h-12 w-12 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
                        <Activity className="h-5 w-5 text-iris" strokeWidth={1.5} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-1">Active Entries</p>
                        <p className="text-2xl font-light text-white tracking-tight font-mono-numbers">{tickets.filter(t => t.checkedIn).length || '--'}</p>
                    </div>
                </div>
                <div className="p-8 rounded-xl bg-obsidian-surface border border-[#ffffff08] flex items-center gap-6 shadow-sm group hover:border-[#ffffff15] transition-all">
                    <div className="h-12 w-12 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
                        <CreditCard className="h-5 w-5 text-emerald-500" strokeWidth={1.5} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-1">Payment Status</p>
                        <p className="text-2xl font-light text-white tracking-tight font-mono-numbers">Verified</p>
                    </div>
                </div>
            </div>

            {/* List Area */}
            <div className="space-y-6">
                <div className="flex gap-4 items-center px-1">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-600 group-focus-within:text-zinc-300 transition-colors" />
                        <input
                            type="text"
                            placeholder="Find tickets by ID, buyer email, or event title..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-obsidian-surface border border-[#ffffff08] rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-white/10 transition-all font-medium placeholder:text-zinc-700 text-white"
                        />
                    </div>
                    <button
                        onClick={() => setFilterType(filterType === 'all' ? 'valid' : 'all')}
                        className={`h-11 px-4 rounded-xl border flex items-center justify-center gap-2 transition-all font-bold uppercase tracking-widest text-[10px] ${filterType !== 'all' ? 'bg-iris/10 border-iris text-iris' : 'bg-white/[0.02] border-white/10 text-zinc-500 hover:text-white'}`}
                    >
                        <Filter className="h-4 w-4" strokeWidth={1.5} />
                        {filterType === 'all' ? 'Filter' : 'Active Only'}
                    </button>
                </div>

                <div className="rounded-xl border border-[#ffffff08] bg-obsidian-surface shadow-sm overflow-hidden overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/[0.02] border-b border-[#ffffff08]">
                                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Ticket Type</th>
                                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Event Details</th>
                                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Attendee</th>
                                <th className="px-8 py-4 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#ffffff05]">
                            {loading ? (
                                [...Array(10)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={4} className="px-8 py-8 h-20 bg-white/[0.01]" />
                                    </tr>
                                ))
                            ) : filteredTickets.length > 0 ? filteredTickets.map((t) => (
                                <tr
                                    key={t.id}
                                    className="hover:bg-white/[0.01] transition-all cursor-pointer group"
                                >
                                    <td className="px-8 py-8">
                                        <div className="flex items-center gap-5">
                                            <div className="h-10 w-10 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center font-bold text-[10px] text-zinc-600">
                                                #{t.id?.slice(-4).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-[14px] font-semibold tracking-tight text-white uppercase">{t.ticketType || 'General Entry'}</p>
                                                <p className="text-[10px] text-emerald-500/80 font-bold uppercase tracking-widest mt-0.5 font-mono-numbers">₹{(t.price || 0).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-8">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-3 w-3 text-zinc-600" />
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                                                {t.eventTitle || 'No Title Available'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-8">
                                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest truncate max-w-[150px]">
                                            {t.userName || t.userEmail?.split('@')[0] || 'Unknown User'}
                                        </p>
                                    </td>
                                    <td className="px-8 py-8 text-right">
                                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border ${t.status === 'valid' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-zinc-800 border-white/5 text-zinc-500'}`}>
                                            <div className={`h-1 w-1 rounded-full ${t.status === 'valid' ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
                                            <span className="text-[9px] font-bold uppercase tracking-widest">
                                                {t.status?.toUpperCase() || 'VALID'}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={4} className="px-8 py-24 text-center">
                                    <div className="h-16 w-16 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/5 shadow-inner">
                                        <Ticket className="h-8 w-8 text-zinc-800" strokeWidth={1} />
                                    </div>
                                    <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">No tickets found</h4>
                                    <p className="text-[10px] text-zinc-600 mt-2 font-bold uppercase tracking-[0.2em]">Check again later or adjust your search.</p>
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
