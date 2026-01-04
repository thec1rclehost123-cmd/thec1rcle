"use client";

import { useState } from "react";
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
    Clock
} from "lucide-react";

interface SecurityEvent {
    id: string;
    title: string;
    date: Date;
    startTime: string;
    endTime: string;
    totalTickets: number;
    checkedIn: number;
    syncCode: string | null;
    status: "active" | "standby" | "completed";
}

const MOCK_SECURITY_EVENTS: SecurityEvent[] = [
    {
        id: "1",
        title: "Techno Bunker: Berlin Edition",
        date: new Date(2026, 0, 3),
        startTime: "21:00",
        endTime: "03:00",
        totalTickets: 450,
        checkedIn: 124,
        syncCode: "892-104",
        status: "active",
    },
    {
        id: "2",
        title: "Bollywood Retro Night",
        date: new Date(2026, 0, 10),
        startTime: "20:00",
        endTime: "02:00",
        totalTickets: 300,
        checkedIn: 0,
        syncCode: null,
        status: "standby",
    },
];

interface Guest {
    id: string;
    name: string;
    ticketType: string;
    ticketId: string;
    status: "checked-in" | "pending";
    checkInTime?: string;
}

const MOCK_GUESTLIST: Guest[] = [
    { id: "1", name: "Rahul Sharma", ticketType: "VIP", ticketId: "TCK-8821", status: "checked-in", checkInTime: "22:15" },
    { id: "2", name: "Priya Patel", ticketType: "Early Bird", ticketId: "TCK-9921", status: "checked-in", checkInTime: "22:20" },
    { id: "3", name: "Amit Kumar", ticketType: "General", ticketId: "TCK-1123", status: "pending" },
    { id: "4", name: "Sneha Gupta", ticketType: "VIP", ticketId: "TCK-4421", status: "pending" },
    { id: "5", name: "Vikram Singh", ticketType: "General", ticketId: "TCK-5521", status: "pending" },
];

export default function GateSecurityPage() {
    const [events, setEvents] = useState<SecurityEvent[]>(MOCK_SECURITY_EVENTS);
    const [selectedEventId, setSelectedEventId] = useState<string>(MOCK_SECURITY_EVENTS[0].id);
    const [guestList, setGuestList] = useState<Guest[]>(MOCK_GUESTLIST);
    const [searchQuery, setSearchQuery] = useState("");

    const selectedEvent = events.find(e => e.id === selectedEventId);

    const generateSyncCode = (eventId: string) => {
        // In production, this would call API to generate secure code
        const newCode = Math.floor(100000 + Math.random() * 900000).toString();
        const formattedCode = `${newCode.substring(0, 3)}-${newCode.substring(3)}`;

        setEvents(events.map(e =>
            e.id === eventId ? { ...e, syncCode: formattedCode, status: "active" } : e
        ));
    };

    const deactivateSync = (eventId: string) => {
        setEvents(events.map(e =>
            e.id === eventId ? { ...e, syncCode: null, status: "standby" } : e
        ));
    };

    const filteredGuests = guestList.filter(g =>
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.ticketId.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                        Gate & Security
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Manage entry flow, sync scanners, and monitor real-time check-ins
                    </p>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg font-semibold hover:bg-slate-50 shadow-sm text-slate-700">
                        <RefreshCw className="h-4 w-4" />
                        Refresh Stats
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Events & Scanner Sync */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Smartphone className="h-5 w-5 text-indigo-600" />
                            Scanner Sync
                        </h2>

                        <div className="space-y-4">
                            <label className="block text-sm font-semibold text-slate-700">
                                Select Active Event
                            </label>
                            <select
                                value={selectedEventId}
                                onChange={(e) => setSelectedEventId(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            >
                                {events.map(e => (
                                    <option key={e.id} value={e.id}>{e.title}</option>
                                ))}
                            </select>

                            {selectedEvent && (
                                <div className="mt-6 p-6 bg-slate-900 rounded-xl text-center relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-3 opacity-10">
                                        <QrCode className="h-24 w-24 text-white" />
                                    </div>

                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">
                                        Scanner Sync Code
                                    </p>

                                    {selectedEvent.syncCode ? (
                                        <div className="space-y-4">
                                            <div className="text-4xl font-mono font-black text-white tracking-wider">
                                                {selectedEvent.syncCode}
                                            </div>
                                            <div className="flex items-center justify-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wide">
                                                <span className="relative flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                </span>
                                                Live & Syncing
                                            </div>
                                            <button
                                                onClick={() => deactivateSync(selectedEvent.id)}
                                                className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-xs font-bold uppercase transition-colors"
                                            >
                                                Deactivate Code
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="text-4xl font-mono font-black text-slate-700 tracking-wider">
                                                --- ---
                                            </div>
                                            <button
                                                onClick={() => generateSyncCode(selectedEvent.id)}
                                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-900/20 transition-all"
                                            >
                                                Generate Code
                                            </button>
                                        </div>
                                    )}

                                    <p className="text-slate-500 text-[10px] mt-4 max-w-[200px] mx-auto">
                                        Enter this code in the C1rcle Scanner App to download the guestlist.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {selectedEvent && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">
                                Entry Statistics
                            </h3>

                            <div className="relative pt-4 pb-8 flex justify-center">
                                {/* Custom Circular Progress Mockup */}
                                <div className="relative h-48 w-48">
                                    <svg className="h-full w-full -rotate-90">
                                        <circle cx="96" cy="96" r="88" className="stroke-slate-100" strokeWidth="12" fill="none" />
                                        <circle
                                            cx="96" cy="96" r="88"
                                            className="stroke-emerald-500 transition-all duration-1000 ease-out"
                                            strokeWidth="12"
                                            fill="none"
                                            strokeDasharray={2 * Math.PI * 88}
                                            strokeDashoffset={2 * Math.PI * 88 * (1 - (selectedEvent.checkedIn / selectedEvent.totalTickets))}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-4xl font-bold text-slate-900">{Math.round((selectedEvent.checkedIn / selectedEvent.totalTickets) * 100)}%</span>
                                        <span className="text-xs font-bold text-slate-400 uppercase">Capacity</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                                    <p className="text-2xl font-bold text-emerald-700">{selectedEvent.checkedIn}</p>
                                    <p className="text-[10px] font-bold text-emerald-600 uppercase">Inside</p>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <p className="text-2xl font-bold text-slate-700">
                                        {selectedEvent.totalTickets - selectedEvent.checkedIn}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase">Pending</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column: Live Guestlist */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full min-h-[600px]">
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Live Guestlist</h2>
                                <p className="text-sm text-slate-500">Real-time sync with scanner devices</p>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search guest or ticket ID..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 pr-4 py-2 w-64 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Guest Name</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ticket Type</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ticket ID</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Time</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredGuests.map((guest) => (
                                        <tr key={guest.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <span className="font-semibold text-slate-900">{guest.name}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${guest.ticketType === 'VIP' ? 'bg-purple-100 text-purple-800' :
                                                        guest.ticketType === 'Early Bird' ? 'bg-blue-100 text-blue-800' :
                                                            'bg-slate-100 text-slate-800'
                                                    }`}>
                                                    {guest.ticketType}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-mono text-slate-500">
                                                {guest.ticketId}
                                            </td>
                                            <td className="px-6 py-4">
                                                {guest.status === 'checked-in' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        Checked In
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                        <Clock className="h-3 w-3" />
                                                        Pending
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500">
                                                {guest.checkInTime || '--:--'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-200">
                                                    <MoreHorizontal className="h-5 w-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {filteredGuests.length === 0 && (
                                <div className="p-12 text-center text-slate-400">
                                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                    <p className="font-semibold">No guests found</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
