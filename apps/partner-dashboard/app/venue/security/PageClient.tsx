"use client";

import { useEffect, useState } from "react";
import {
    ShieldCheck,
    Smartphone,
    Users,
    RefreshCw,
    Lock,
    Unlock,
    QrCode,
    Search,
    CheckCircle2,
    XCircle,
    MoreHorizontal,
    Clock,
    Loader2
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

interface SecurityEvent {
    id: string;
    title: string;
    date: string;
    totalTickets: number;
    checkedIn: number;
    syncCode: string | null;
    status: "active" | "standby" | "completed";
}

interface Guest {
    id: string;
    name: string;
    type: string;
    status: string;
    timestamp?: string;
}

export default function GateSecurityPage() {
    const { profile } = useDashboardAuth();
    const [events, setEvents] = useState<SecurityEvent[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string>("");
    const [guestList, setGuestList] = useState<Guest[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);

    const fetchSecurityData = async () => {
        if (!profile?.activeMembership?.partnerId) return;
        setIsLoading(true);
        try {
            const venueId = profile.activeMembership.partnerId;
            const res = await fetch(`/api/venue/security/sync?venueId=${venueId}`);
            if (res.ok) {
                const data = await res.json();
                setEvents(data.events);
                if (data.events.length > 0 && !selectedEventId) {
                    setSelectedEventId(data.events[0].id);
                }
            }
        } catch (err) {
            console.error("Security fetch error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchGuestlist = async (eventId: string) => {
        if (!eventId) return;
        try {
            const res = await fetch(`/api/events/${eventId}/guestlist`);
            if (res.ok) {
                const data = await res.json();
                setGuestList(data.guestlist);
            }
        } catch (err) {
            console.error("Guestlist fetch error:", err);
        }
    };

    useEffect(() => {
        fetchSecurityData();
    }, [profile]);

    useEffect(() => {
        if (selectedEventId) {
            fetchGuestlist(selectedEventId);
        }
    }, [selectedEventId]);

    const selectedEvent = events.find(e => e.id === selectedEventId);

    const generateSyncCode = async (eventId: string) => {
        if (!profile?.activeMembership?.partnerId) return;
        setIsSyncing(true);
        try {
            const venueId = profile.activeMembership.partnerId;
            const res = await fetch(`/api/venue/security/sync`, {
                method: "POST",
                body: JSON.stringify({ eventId, venueId, userId: profile.uid })
            });
            if (res.ok) {
                fetchSecurityData();
            }
        } catch (err) {
            console.error("Sync code error:", err);
        } finally {
            setIsSyncing(false);
        }
    };

    const deactivateSync = async (eventId: string) => {
        if (!profile?.activeMembership?.partnerId) return;
        setIsSyncing(true);
        try {
            const venueId = profile.activeMembership.partnerId;
            const res = await fetch(`/api/venue/security/sync`, {
                method: "POST",
                body: JSON.stringify({ eventId, venueId, action: "deactivate" })
            });
            if (res.ok) {
                fetchSecurityData();
            }
        } catch (err) {
            console.error("Deactivate error:", err);
        } finally {
            setIsSyncing(false);
        }
    };

    const filteredGuests = guestList.filter(g =>
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoading && events.length === 0) {
        return (
            <div className="py-24 flex flex-col items-center justify-center">
                <Loader2 className="h-10 w-10 text-slate-200 animate-spin mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Gate Access Initializing...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                        Gate & Security
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">
                        Deployment center for scanners and manual check-in verification.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={fetchSecurityData}
                        className="flex items-center gap-3 px-6 py-3 bg-white border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 shadow-sm text-slate-700 transition-all hover:scale-105 active:scale-95"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Sync All
                    </button>
                    <button className="flex items-center gap-3 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 shadow-xl transition-all hover:scale-105 active:scale-95">
                        <Users className="h-4 w-4" />
                        Staff Override
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Events & Scanner Sync */}
                <div className="lg:col-span-1 space-y-8">
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-10">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                                <Smartphone className="h-6 w-6 text-indigo-600" />
                                Scanner Sync
                            </h2>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-3">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                                    Operational Event
                                </label>
                                <select
                                    value={selectedEventId}
                                    onChange={(e) => setSelectedEventId(e.target.value)}
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-sm appearance-none cursor-pointer focus:outline-none focus:ring-4 focus:ring-indigo-50 shadow-inner"
                                >
                                    {events.map(e => (
                                        <option key={e.id} value={e.id}>{e.title}</option>
                                    ))}
                                    {events.length === 0 && <option value="">No active events</option>}
                                </select>
                            </div>

                            {selectedEvent && (
                                <div className="mt-8 p-10 bg-slate-950 rounded-[2rem] text-center relative overflow-hidden group shadow-2xl">
                                    <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <QrCode className="h-32 w-32 text-white" />
                                    </div>

                                    <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
                                        Cloud Gateway Code
                                    </p>

                                    {selectedEvent.syncCode ? (
                                        <div className="space-y-6">
                                            <div className="text-5xl font-mono font-black text-white tracking-[0.3em] mb-2 drop-shadow-2xl">
                                                {selectedEvent.syncCode}
                                            </div>
                                            <div className="flex items-center justify-center gap-2 text-emerald-400 text-[10px] font-black uppercase tracking-widest bg-emerald-400/10 py-2 px-4 rounded-full w-fit mx-auto border border-emerald-400/20">
                                                <span className="relative flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                </span>
                                                Active Link
                                            </div>
                                            <button
                                                onClick={() => deactivateSync(selectedEvent.id)}
                                                disabled={isSyncing}
                                                className="w-full py-4 bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10 hover:border-red-500/20"
                                            >
                                                Kill Connection
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            <div className="text-5xl font-mono font-black text-white/5 tracking-[0.3em] mb-2">
                                                --- ---
                                            </div>
                                            <button
                                                onClick={() => generateSyncCode(selectedEvent.id)}
                                                disabled={isSyncing}
                                                className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-2xl shadow-indigo-950 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                                            >
                                                {isSyncing ? "Generating..." : "Boot Sync Gateway"}
                                            </button>
                                        </div>
                                    )}

                                    <p className="text-white/30 text-[9px] font-semibold mt-6 max-w-[200px] mx-auto leading-relaxed">
                                        Sync this code with the C1rcle Guard App to enable distributed scanning.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {selectedEvent && (
                        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-10">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">
                                Entry Saturation
                            </h3>

                            <div className="relative pt-4 pb-10 flex justify-center">
                                <div className="relative h-56 w-56">
                                    <svg className="h-full w-full -rotate-90">
                                        <circle cx="112" cy="112" r="100" className="stroke-slate-50" strokeWidth="16" fill="none" />
                                        <circle
                                            cx="112" cy="112" r="100"
                                            className="stroke-slate-900 transition-all duration-1000 ease-out"
                                            strokeWidth="16"
                                            fill="none"
                                            strokeDasharray={2 * Math.PI * 100}
                                            strokeDashoffset={2 * Math.PI * 100 * (1 - (selectedEvent.checkedIn / (selectedEvent.totalTickets || 1)))}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-5xl font-black text-slate-900 tracking-tighter">{Math.round((selectedEvent.checkedIn / (selectedEvent.totalTickets || 1)) * 100)}%</span>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Checks Done</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div className="p-5 bg-emerald-50/50 rounded-3xl border border-emerald-100">
                                    <p className="text-3xl font-black text-slate-900">{selectedEvent.checkedIn}</p>
                                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Validated</p>
                                </div>
                                <div className="p-5 bg-slate-50/50 rounded-3xl border border-slate-100">
                                    <p className="text-3xl font-black text-slate-900">
                                        {Math.max(0, selectedEvent.totalTickets - selectedEvent.checkedIn)}
                                    </p>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Residual</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column: Live Guestlist */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col h-full min-h-[700px] overflow-hidden">
                        <div className="p-10 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-50/30">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Main Manifest</h2>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Local override & validation terminal</p>
                            </div>
                            <div className="relative group">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="SCAN TICKET OR TYPE NAME..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-14 pr-8 py-5 w-full md:w-80 bg-white border border-slate-200 rounded-2xl text-xs font-black tracking-widest uppercase focus:outline-none focus:ring-8 focus:ring-slate-100 transition-all shadow-inner"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto px-6">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-10 bg-white/80 backdrop-blur-md">
                                    <tr>
                                        <th className="px-6 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Validated Name</th>
                                        <th className="px-6 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Classification</th>
                                        <th className="px-6 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Flow State</th>
                                        <th className="px-6 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Verification</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredGuests.map((guest) => (
                                        <tr key={guest.id} className="hover:bg-slate-50/50 transition-all group">
                                            <td className="px-6 py-6">
                                                <div className="flex flex-col">
                                                    <span className="font-extrabold text-slate-900 text-sm group-hover:translate-x-1 transition-transform">{guest.name || 'Anonymous Guest'}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1">ID: {guest.id.substring(0, 8)}...</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-6 font-black text-[10px] uppercase tracking-widest text-slate-400">
                                                {guest.type || 'Standard'}
                                            </td>
                                            <td className="px-6 py-6">
                                                {guest.status === 'checked_in' ? (
                                                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        CLEARED
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-50 text-slate-400 border border-slate-100">
                                                        <Clock className="h-3 w-3" />
                                                        PNDG
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-6 text-right">
                                                {guest.status !== 'checked_in' ? (
                                                    <button className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg active:scale-90">
                                                        Manual Clear
                                                    </button>
                                                ) : (
                                                    <span className="text-[10px] font-black text-slate-300 uppercase italic">Inside 22:45</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {filteredGuests.length === 0 && (
                                <div className="py-32 text-center">
                                    <Users className="h-20 w-20 mx-auto mb-6 text-slate-100" />
                                    <p className="font-black text-slate-200 uppercase tracking-[0.2em] text-sm">No Matching Identities Found</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
