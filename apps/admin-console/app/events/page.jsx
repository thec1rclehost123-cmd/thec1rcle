"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import { Search, Filter, Calendar, MapPin, Ticket, ExternalLink, Activity, Clock, User, AlertCircle, TrendingUp, Play, Pause, ShieldAlert, ChevronRight, ArrowUpRight, X } from "lucide-react";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";
import { mapEventForClient } from "@c1rcle/core/events";

export default function AdminEvents() {
    const { user } = useAuth();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [modalConfig, setModalConfig] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");

    const fetchEvents = async () => {
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/list?collection=events', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();
            const mapped = (json.data || []).map((e) => mapEventForClient(e, e.id));
            setEvents(mapped);
        } catch (err) {
            console.error("Failed to fetch events", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchEvents();
    }, [user]);

    const handleAction = async (reason, targetId, inputValue, evidence) => {
        if (!modalConfig) return;

        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/actions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: modalConfig.action,
                    targetId: selectedEvent.id,
                    reason,
                    evidence,
                    params: {
                        type: 'event',
                        message: modalConfig.action === 'WARNING_ISSUE' ? inputValue : undefined,
                        weight: modalConfig.action === 'DISCOVERY_WEIGHT_ADJUST' ? Number(inputValue) : undefined
                    }
                })
            });

            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.error || "Action failed");
            }

            if (json.message) alert(json.message);

            await fetchEvents();
            const updatedRes = await fetch('/api/list?collection=events', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const updatedJson = await updatedRes.json();
            const updated = updatedJson.data?.find(e => e.id === selectedEvent.id);
            if (updated) setSelectedEvent(mapEventForClient(updated, updated.id));

        } catch (err) {
            alert(`Error: ${err.message}`);
            throw err;
        }
    };

    const [showOnlyLive, setShowOnlyLive] = useState(false);

    const exportToCSV = () => {
        const headers = ["ID", "Title", "Status", "Tickets Sold", "Discovery Weight"];
        const rows = filtered.map(e => [
            e.id,
            e.title,
            e.status,
            e.ticketsSold || 0,
            e.discoveryWeight || 0
        ]);

        const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `experiences_report_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    };

    const filtered = events.filter(e => {
        const matchesSearch = e.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            e.id?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = showOnlyLive ? e.status === 'live' : true;
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="space-y-12 pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Activity className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">Inventory Feed</span>
                    </div>
                    <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">Experiences</h1>
                    <p className="text-sm text-zinc-500 font-medium max-w-xl">
                        Monitor active listings, track sales performance, and manage marketplace visibility.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowOnlyLive(!showOnlyLive)}
                        className={`flex items-center gap-2.5 px-6 py-3 rounded-xl border text-[11px] font-bold uppercase tracking-widest transition-all ${showOnlyLive ? 'bg-emerald-500 text-black border-emerald-500' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'}`}
                    >
                        <Filter className="w-4 h-4" />
                        {showOnlyLive ? 'Showing Live' : 'Filter Live'}
                    </button>
                    <button
                        onClick={exportToCSV}
                        className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-zinc-400 text-[11px] font-bold uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all font-mono-numbers"
                    >
                        <ArrowUpRight className="w-4 h-4" />
                        Export Registry
                    </button>
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Main Content Area */}
                <div className="lg:col-span-8 space-y-8">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-600 group-focus-within:text-zinc-300 transition-colors" strokeWidth={1.5} />
                        <input
                            type="text"
                            placeholder="Find experience by title, venue or registry ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-obsidian-surface border border-[#ffffff08] rounded-xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:ring-1 focus:ring-white/10 transition-all font-medium placeholder:text-zinc-700 text-white"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {loading ? (
                            [...Array(6)].map((_, i) => (
                                <div key={i} className="h-48 bg-white/5 animate-pulse rounded-xl border border-white/5"></div>
                            ))
                        ) : filtered.length > 0 ? filtered.map((event) => (
                            <div
                                key={event.id}
                                onClick={() => setSelectedEvent(event)}
                                className={`relative group transition-all duration-300 ${selectedEvent?.id === event.id ? 'ring-1 ring-white/20' : ''} rounded-xl overflow-hidden`}
                            >
                                <div className="bg-obsidian-surface border border-[#ffffff08] p-6 hover:border-[#ffffff15] transition-colors cursor-pointer">
                                    <div className="flex items-start justify-between mb-5">
                                        <div className="h-10 w-10 rounded-lg bg-zinc-900 border border-white/5 overflow-hidden shadow-inner">
                                            {event.poster || event.image ? (
                                                <img src={event.poster || event.image} className="h-full w-full object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500" />
                                            ) : (
                                                <div className="h-full w-full flex items-center justify-center">
                                                    <Activity className="h-4 w-4 text-zinc-800" strokeWidth={1.5} />
                                                </div>
                                            )}
                                        </div>
                                        <div className={`px-2.5 py-1 rounded border text-[9px] font-bold uppercase tracking-widest ${event.status === 'live' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-iris/10 border-iris/20 text-iris'}`}>
                                            {event.status}
                                        </div>
                                    </div>
                                    <h3 className="text-base font-semibold text-white truncate mb-1 uppercase tracking-tight">{event.title}</h3>
                                    <div className="flex items-center gap-3 text-zinc-600 text-[9px] font-bold uppercase tracking-widest">
                                        <span className="flex items-center gap-1.5"><Ticket className="h-3 w-3" strokeWidth={1.5} /> {event.ticketsSold || 0} Sold</span>
                                        <div className="h-1 w-1 rounded-full bg-zinc-800"></div>
                                        <span className="flex items-center gap-1.5 text-zinc-700 font-mono-numbers"><TrendingUp className="h-3 w-3" strokeWidth={1.5} /> Priority: {event.discoveryWeight || 0}</span>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="col-span-full py-24 text-center border border-[#ffffff08] rounded-xl bg-obsidian-surface/50">
                                <Activity className="h-8 w-8 text-zinc-800 mx-auto mb-4" strokeWidth={1} />
                                <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">No listings found</h4>
                                <p className="text-[10px] text-zinc-600 mt-2 font-bold uppercase tracking-widest leading-relaxed">Adjust your search parameters<br />to discover experiences.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Inspection Panel */}
                <aside className="lg:col-span-4 h-fit">
                    {selectedEvent ? (
                        <div className="sticky top-28 space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="bg-obsidian-surface border border-[#ffffff08] rounded-xl overflow-hidden shadow-2xl relative">
                                <div className="aspect-video relative group border-b border-[#ffffff05]">
                                    {selectedEvent.poster || selectedEvent.image ? (
                                        <img src={selectedEvent.poster || selectedEvent.image} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="h-full w-full bg-zinc-900 flex items-center justify-center">
                                            <Activity className="h-12 w-12 text-zinc-900" strokeWidth={1} />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60"></div>
                                    <button
                                        onClick={() => setSelectedEvent(null)}
                                        className="absolute top-4 right-4 h-8 w-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/50 hover:text-white transition-colors border border-white/5"
                                    >
                                        <X className="h-4 w-4" strokeWidth={1.5} />
                                    </button>
                                </div>

                                <div className="p-8 space-y-8">
                                    <div className="space-y-4 text-center">
                                        <h3 className="text-2xl font-semibold tracking-tight text-white leading-tight uppercase tracking-tight">{selectedEvent.title}</h3>
                                        <div className="flex flex-wrap items-center justify-center gap-2">
                                            <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-bold text-zinc-600 uppercase tracking-widest font-mono-numbers">
                                                Ref: {selectedEvent.id.slice(0, 12)}
                                            </div>
                                            <div className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ${selectedEvent.status === 'live' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-iris/10 text-iris border-iris/20'}`}>
                                                {selectedEvent.status}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-px bg-[#ffffff10] border border-[#ffffff10] rounded-xl overflow-hidden shadow-sm">
                                        <div className="bg-obsidian-surface p-5">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-1.5">Visibility Weight</p>
                                            <p className="text-3xl font-light text-white font-mono-numbers">{selectedEvent.discoveryWeight || 0}</p>
                                        </div>
                                        <div className="bg-obsidian-surface p-5 text-right">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-1.5">Total Sales</p>
                                            <p className="text-3xl font-light text-white font-mono-numbers">{selectedEvent.ticketsSold || 0}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-2">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 px-1">Authority Actions</p>

                                        <div className="grid grid-cols-1 gap-2">
                                            <button
                                                onClick={() => setModalConfig({
                                                    action: 'WARNING_ISSUE',
                                                    title: 'Issue Official Notice',
                                                    message: 'Send a formal compliance notice to the organizer regarding this listing.',
                                                    label: 'Send Notice',
                                                    inputLabel: 'Notice Details',
                                                    inputPlaceholder: 'Describe the policy violation...',
                                                    type: 'warning'
                                                })}
                                                className="flex items-center justify-between p-4 rounded-xl bg-black/20 border border-white/[0.02] hover:border-white/10 hover:bg-white/[0.02] transition-all group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <AlertCircle className="h-4 w-4 text-amber-500" strokeWidth={1.5} />
                                                    <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-300">Issue Notice</span>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-zinc-700 group-hover:translate-x-1 transition-transform" />
                                            </button>

                                            <button
                                                onClick={() => setModalConfig({
                                                    action: 'DISCOVERY_WEIGHT_ADJUST',
                                                    title: 'Adjust Visibility Score',
                                                    message: 'Override the discovery priority for this experience across the feed.',
                                                    label: 'Update Weight',
                                                    inputLabel: 'Priority Factor (0-10)',
                                                    inputPlaceholder: '1.0',
                                                    inputType: 'number',
                                                    type: 'info'
                                                })}
                                                className="flex items-center justify-between p-4 rounded-xl bg-black/20 border border-white/[0.02] hover:border-white/10 hover:bg-white/[0.02] transition-all group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <TrendingUp className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
                                                    <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-300">Set Priority Weight</span>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-zinc-700 group-hover:translate-x-1 transition-transform" />
                                            </button>

                                            <div className="pt-4">
                                                {selectedEvent.status === 'live' ? (
                                                    <button
                                                        onClick={() => setModalConfig({
                                                            action: 'EVENT_PAUSE',
                                                            title: 'Restrict Sales Activity',
                                                            message: 'Immediately stop all ticket sales for this listing. Requires secondary authorization.',
                                                            label: 'Confirm Restriction',
                                                            type: 'danger',
                                                            isTier2: true
                                                        })}
                                                        className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-iris/10 border border-iris/20 text-white hover:bg-iris/20 transition-all font-bold text-[11px] uppercase tracking-widest shadow-lg shadow-iris/10"
                                                    >
                                                        <Pause className="h-4 w-4" strokeWidth={2} />
                                                        Restrict Sales
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => setModalConfig({
                                                            action: 'EVENT_RESUME',
                                                            title: 'Restore Sales Activity',
                                                            message: 'Authorized the experience to resume ticket sales and marketplace visibility.',
                                                            label: 'Approve Restoration',
                                                            type: 'info',
                                                            isTier2: true
                                                        })}
                                                        className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 transition-all font-bold text-[11px] uppercase tracking-widest"
                                                    >
                                                        <Play className="h-4 w-4" strokeWidth={2} />
                                                        Restore Sales
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-[#ffffff05] flex items-center justify-between">
                                        <a
                                            href={`/event/${selectedEvent.slug || selectedEvent.id}`}
                                            target="_blank"
                                            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-700 hover:text-white transition-colors group"
                                        >
                                            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
                                            View Public Listing
                                        </a>
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-[400px] flex flex-col items-center justify-center rounded-xl border border-[#ffffff08] bg-white/[0.01] text-center p-8 sticky top-28">
                            <Activity className="h-12 w-12 text-zinc-900 mb-6" strokeWidth={1} />
                            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest leading-relaxed">Select an active listing<br />to review registry details.</p>
                        </div>
                    )}
                </aside>
            </div>

            {modalConfig && (
                <AdminConfirmModal
                    isOpen={!!modalConfig}
                    onClose={() => setModalConfig(null)}
                    onConfirm={handleAction}
                    title={modalConfig.title}
                    message={modalConfig.message}
                    actionLabel={modalConfig.label}
                    type={modalConfig.type}
                    inputLabel={modalConfig.inputLabel}
                    inputType={modalConfig.inputType}
                    inputPlaceholder={modalConfig.inputPlaceholder}
                    isTier2={modalConfig.isTier2}
                />
            )}
        </div>
    );
}
