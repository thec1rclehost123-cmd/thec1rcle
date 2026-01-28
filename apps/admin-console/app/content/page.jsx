"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Search, Filter, ShieldAlert, MessageSquare, Image as ImageIcon, Trash2, CheckCircle, ShieldCheck, ChevronRight } from "lucide-react";

export default function AdminContent() {
    const { user } = useAuth();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterReported, setFilterReported] = useState(false);

    const fetchContent = async () => {
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/list?collection=media_reports', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();
            setReports(json.data || []);
        } catch (err) {
            console.error("Failed to fetch content reports", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchContent();
    }, [user]);

    const handleExport = () => {
        const headers = ["ID", "Type", "Reporter", "Reason", "Status", "Timestamp"];
        const rows = filtered.map(r => [
            r.id,
            r.type || 'Media',
            r.reporterEmail || 'Anonymous',
            r.reason || 'N/A',
            r.status || 'Pending',
            r.timestamp ? new Date(r.timestamp).toISOString() : 'N/A'
        ]);
        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `content_oversight_report_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filtered = reports.filter(r => {
        const matchesSearch =
            r.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.reporterEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.reason?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterReported ? r.status === 'reported' : true;
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="space-y-12 pb-24">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <ShieldAlert className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">Resource Monitoring</span>
                    </div>
                    <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">Content Oversight</h1>
                    <p className="text-sm text-zinc-500 font-medium max-w-xl">
                        Review reported media, monitor active chat feeds, and manage community interactions.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setFilterReported(!filterReported)}
                        className={`h-9 px-4 rounded-md border text-[11px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${filterReported ? 'bg-iris/10 border-iris text-iris' : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10'}`}
                    >
                        <Filter className="h-3.5 w-3.5" strokeWidth={1.5} />
                        {filterReported ? "View All" : "Filter Reported"}
                    </button>
                    <button
                        onClick={handleExport}
                        className="h-9 px-4 rounded-md bg-white text-black text-[11px] font-bold uppercase tracking-widest hover:bg-zinc-200 transition-colors"
                    >
                        Export Log
                    </button>
                </div>
            </header>

            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-500 group-focus-within:text-zinc-300 transition-colors" strokeWidth={1.5} />
                <input
                    type="text"
                    placeholder="Search by keyword, user email, or report ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-obsidian-surface border border-[#ffffff08] rounded-xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:ring-1 focus:ring-white/10 transition-all font-medium placeholder:text-zinc-700 text-white"
                />
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-64 bg-white/5 animate-pulse rounded-xl border border-white/5" />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-24 rounded-xl border border-[#ffffff08] bg-obsidian-surface/50 text-center">
                    <div className="h-20 w-20 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center mb-8 shadow-inner">
                        <ShieldCheck className="h-10 w-10 text-emerald-500" strokeWidth={1} />
                    </div>
                    <h3 className="text-xl font-semibold tracking-tight text-white uppercase">No Alerts</h3>
                    <p className="text-[10px] text-zinc-600 mt-3 font-bold uppercase tracking-[0.2em] max-w-sm mx-auto leading-relaxed">
                        All community content and media uploads are within safety policy limits. No pending reports require attention.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filtered.map((report) => (
                        <div key={report.id} className="p-8 rounded-xl bg-obsidian-surface border border-[#ffffff08] hover:border-white/10 transition-all relative overflow-hidden group shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center shadow-inner">
                                        {report.type === 'image' ? <ImageIcon className="h-5 w-5 text-iris" /> : <MessageSquare className="h-5 w-5 text-emerald-500" />}
                                    </div>
                                    <div>
                                        <span className="font-bold uppercase tracking-[0.2em] text-[10px] text-zinc-400">{report.type || 'Media Content'}</span>
                                        <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">Ref: {report.id.slice(0, 8)}</p>
                                    </div>
                                </div>
                                <div className={`px-2 py-1 rounded text-[8px] font-bold uppercase tracking-widest ${report.status === 'reported' ? 'bg-iris/10 text-iris border border-iris/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                                    {report.status}
                                </div>
                            </div>
                            <p className="text-sm text-zinc-500 font-medium leading-relaxed mb-8">
                                {(report.reason || 'No description provided for this content alert.')}
                            </p>
                            <div className="flex items-center justify-between pt-6 border-t border-[#ffffff05]">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Reporter: {report.reporterEmail?.split('@')[0] || 'Anonymous'}</span>
                                <button className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">
                                    Review Media
                                    <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Sub-Systems Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-[#ffffff05] pt-12">
                <div className="flex items-center gap-6 p-6 rounded-xl bg-white/[0.01] border border-[#ffffff05]">
                    <div className="h-10 w-10 rounded-lg bg-zinc-900 flex items-center justify-center">
                        <MessageSquare className="h-4 w-4 text-zinc-600" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Scanning Thread</p>
                        <p className="text-[11px] font-bold text-emerald-500 uppercase tracking-widest">Active • Integrity Stable</p>
                    </div>
                </div>
                <div className="flex items-center gap-6 p-6 rounded-xl bg-white/[0.01] border border-[#ffffff05]">
                    <div className="h-10 w-10 rounded-lg bg-zinc-900 flex items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-zinc-600" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Vison API</p>
                        <p className="text-[11px] font-bold text-emerald-500 uppercase tracking-widest">Active • Filter Online</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
