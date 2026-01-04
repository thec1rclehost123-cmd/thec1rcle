"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useEffect, useState } from "react";
import { Search, Filter, Calendar, MapPin, Ticket, ExternalLink, Activity, Clock, User, AlertCircle, TrendingUp, Play, Pause, ShieldAlert, ChevronRight } from "lucide-react";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";

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
            setEvents(json.data || []);
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

            if (json.message) alert(json.message); // Governance feedback

            await fetchEvents();
            const updated = events.find(e => e.id === selectedEvent.id);
            if (updated) setSelectedEvent(updated);

        } catch (err) {
            alert(`Authority Error: ${err.message}`);
            throw err;
        }
    };

    return (
        <div className="space-y-12 pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8 border-b border-slate-200 pb-12">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <Activity className="h-6 w-6 text-indigo-600" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Yield Management</span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-slate-900">Event Registry Monitor</h1>
                    <p className="text-base text-slate-500 mt-3 font-medium max-w-2xl leading-relaxed">
                        Real-time observational feed of platform-wide event distribution. <span className="text-slate-900">Monitor health, adjust amplification, and halt operations.</span>
                    </p>
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">

                {/* Scrollable Table Area */}
                <div className="lg:col-span-3 space-y-8">
                    <div className="flex gap-4 p-3 rounded-[2.5rem] bg-white border border-slate-200 shadow-sm">
                        <div className="relative flex-1">
                            <Search className="absolute left-8 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search registry by title, venue or unique ID..."
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
                                        <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Intelligence Asset</th>
                                        <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Yield</th>
                                        <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Temporal State</th>
                                        <th className="px-10 py-6 text-right text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Asset Health</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        [...Array(10)].map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                <td colSpan={4} className="px-10 py-10"><div className="h-4 bg-slate-100 rounded-full w-full"></div></td>
                                            </tr>
                                        ))
                                    ) : events.filter(e =>
                                        e.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        e.venueName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        e.id?.toLowerCase().includes(searchTerm.toLowerCase())
                                    ).length > 0 ? events.filter(e =>
                                        e.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        e.venueName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        e.id?.toLowerCase().includes(searchTerm.toLowerCase())
                                    ).map((event) => (
                                        <tr
                                            key={event.id}
                                            onClick={() => setSelectedEvent(event)}
                                            className={`hover:bg-slate-50 transition-all cursor-pointer group ${selectedEvent?.id === event.id ? 'bg-indigo-50/50' : ''}`}
                                        >
                                            <td className="px-10 py-8">
                                                <div className="flex items-center gap-5">
                                                    <div className="h-14 w-14 rounded-2xl bg-white border border-slate-100 overflow-hidden flex-shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                                                        {event.posterUrl ? (
                                                            <img src={event.posterUrl} className="h-full w-full object-cover" />
                                                        ) : (
                                                            <div className="h-full w-full flex items-center justify-center">
                                                                <Calendar className="h-5 w-5 text-slate-200" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-base font-black tracking-tight text-slate-900 line-clamp-1">{event.title}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{event.venueName || 'VENUE TBA'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-10 py-8">
                                                <div className="flex items-center gap-3">
                                                    <Ticket className="h-4 w-4 text-indigo-600" />
                                                    <span className="text-sm font-black text-slate-900">{event.ticketsSold || 0}</span>
                                                </div>
                                            </td>
                                            <td className="px-10 py-8">
                                                <p className="text-[11px] text-slate-500 font-black uppercase tracking-tighter">
                                                    {event.startTime ? new Date(event.startTime).toLocaleDateString() : 'DRAFT'}
                                                </p>
                                            </td>
                                            <td className="px-10 py-8 text-right">
                                                <div className="flex items-center justify-end gap-3">
                                                    <span className={`h-2.5 w-2.5 rounded-full ring-4 ${event.status === 'live' ? 'bg-emerald-500 ring-emerald-50' :
                                                        event.status === 'paused' ? 'bg-red-500 ring-red-50' :
                                                            event.status === 'under_review' ? 'bg-amber-500 ring-amber-50' : 'bg-slate-100 ring-slate-50'
                                                        }`}></span>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">{event.status}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={4} className="px-10 py-24 text-center text-sm text-slate-400 font-bold uppercase tracking-widest italic bg-slate-50/30">Universal event registry is clear.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Inspection Panel */}
                <aside className="lg:col-span-1">
                    {selectedEvent ? (
                        <div className="sticky top-24 p-10 rounded-[3rem] border border-slate-200 bg-white shadow-xl space-y-10 animate-in fade-in slide-in-from-right-8 duration-500">

                            <div className="space-y-6">
                                <div className="aspect-[4/5] rounded-[2rem] bg-slate-50 border border-slate-100 overflow-hidden shadow-inner">
                                    {selectedEvent.posterUrl ? (
                                        <img src={selectedEvent.posterUrl} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center">
                                            <Activity className="h-12 w-12 text-slate-200" />
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    <h3 className="text-3xl font-black tracking-tighter text-slate-900 leading-[0.9]">{selectedEvent.title}</h3>
                                    <div className="flex flex-wrap items-center gap-3 pt-2">
                                        <div className={`px-4 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${selectedEvent.status === 'live' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                                            selectedEvent.status === 'under_review' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                                                'bg-red-50 border-red-100 text-red-600'
                                            }`}>
                                            {selectedEvent.status}
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-bold tracking-widest italic">REF: {selectedEvent.id.slice(0, 12)}...</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-10 pt-4">
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 shadow-inner">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Discovery Bias</p>
                                        <p className="text-2xl font-black tracking-tighter text-slate-900">{selectedEvent.discoveryWeight || 0}</p>
                                    </div>
                                    <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 shadow-inner">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Total Yield (Sold)</p>
                                        <p className="text-2xl font-black tracking-tighter text-slate-900">{selectedEvent.ticketsSold || 0}</p>
                                    </div>
                                </div>

                                {/* Tier 1 & 2 Governance */}
                                <div className="pt-10 border-t border-slate-100 space-y-10">
                                    <div className="space-y-6">
                                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900 border-b border-slate-100 pb-2">Operational Controls — Tier 1</p>

                                        <div className="grid grid-cols-1 gap-3">
                                            <button
                                                onClick={() => setModalConfig({
                                                    action: 'WARNING_ISSUE',
                                                    title: 'Asset Formal Warning',
                                                    message: 'Dispatches a compliance notice to the event holder. Immutably logged.',
                                                    label: 'Log Warning',
                                                    inputLabel: 'Incident Premise',
                                                    inputPlaceholder: 'Behavioral or content violation...',
                                                    type: 'warning'
                                                })}
                                                className="flex items-center justify-between p-5 rounded-2xl bg-white border border-slate-200 hover:border-amber-600 hover:bg-slate-50 transition-all group shadow-sm"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <AlertCircle className="h-5 w-5 text-amber-500" />
                                                    <span className="text-xs font-black uppercase tracking-widest text-slate-900">Issue Warning</span>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-amber-600 transition-transform group-hover:translate-x-1" />
                                            </button>

                                            <button
                                                onClick={() => setModalConfig({
                                                    action: 'DISCOVERY_WEIGHT_ADJUST',
                                                    title: 'Adjust Asset Weight',
                                                    message: 'Modify algorithmic visibility. Impact is immediate. (Range: -10 to 50)',
                                                    label: 'Update Bias',
                                                    inputLabel: 'Numerical Bias',
                                                    inputPlaceholder: '0.00',
                                                    inputType: 'number',
                                                    type: 'info'
                                                })}
                                                className="flex items-center justify-between p-5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-600 hover:bg-slate-50 transition-all group shadow-sm"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <TrendingUp className="h-5 w-5 text-indigo-600" />
                                                    <span className="text-xs font-black uppercase tracking-widest text-slate-900">Visibility Bias</span>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-600 transition-transform group-hover:translate-x-1" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900 border-b border-slate-100 pb-2">Platform Authority — Tier 2</p>

                                        <div className="grid grid-cols-1 gap-3">
                                            {selectedEvent.status === 'live' ? (
                                                <button
                                                    onClick={() => setModalConfig({
                                                        action: 'EVENT_PAUSE',
                                                        title: 'Halt Asset Transactions',
                                                        message: 'Stops all ticket sales and distribution immediately.',
                                                        label: 'Execute Pause',
                                                        type: 'danger',
                                                        isTier2: true
                                                    })}
                                                    className="flex items-center gap-5 p-6 rounded-3xl bg-red-600 text-white hover:bg-red-700 transition-all shadow-xl shadow-red-200"
                                                >
                                                    <Pause className="h-6 w-6" />
                                                    <div className="text-left">
                                                        <span className="block text-sm font-black uppercase tracking-widest">Halt Sales</span>
                                                        <span className="block text-[9px] opacity-70 mt-1 font-bold">Emergency Operational Freeze</span>
                                                    </div>
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => setModalConfig({
                                                        action: 'EVENT_RESUME',
                                                        title: 'Resume Asset Authority',
                                                        message: 'Restores public visibility and transaction capabilities.',
                                                        label: 'Restore Operations',
                                                        type: 'info',
                                                        isTier2: true
                                                    })}
                                                    className="flex items-center gap-5 p-6 rounded-3xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200"
                                                >
                                                    <Play className="h-6 w-6" />
                                                    <div className="text-left">
                                                        <span className="block text-sm font-black uppercase tracking-widest">Restore Yield</span>
                                                        <span className="block text-[9px] opacity-70 mt-1 font-bold">Unfreeze Attribution & Sales</span>
                                                    </div>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-10 border-t border-slate-100 flex items-center justify-between">
                                <a
                                    href={`/events/${selectedEvent.id}`}
                                    target="_blank"
                                    className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-all group"
                                >
                                    <ExternalLink className="h-4 w-4 group-hover:scale-110" />
                                    Public State
                                </a>
                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            </div>
                        </div>
                    ) : (
                        <div className="h-full min-h-[500px] flex flex-col items-center justify-center p-16 rounded-[4rem] border-2 border-slate-200 border-dashed text-center bg-slate-50/50">
                            <Activity className="h-16 w-16 text-slate-200 mb-6" />
                            <p className="text-sm text-slate-400 font-black uppercase tracking-widest leading-relaxed">Select an asset<br />from the registry<br />for intelligence depth.</p>
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
