"use client";

import { useState } from "react";
import {
    Calendar,
    Users,
    Clock,
    CheckCircle2,
    XCircle,
    MoreHorizontal,
    Mail,
    Phone,
    Search,
    Filter,
    ArrowUpRight,
    Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ReservationsPage() {
    const [filter, setFilter] = useState("pending");
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Mock Reservations Data
    const [reservations, setReservations] = useState([
        {
            id: "res-101",
            guestName: "Aayush Divase",
            email: "aayush@example.com",
            phone: "+91 98765 43210",
            date: "2026-02-14",
            time: "21:00",
            guests: 4,
            status: "pending",
            requestedAt: "2h ago"
        },
        {
            id: "res-102",
            guestName: "Sarah Chen",
            email: "sarah@example.com",
            phone: "+91 91234 56789",
            date: "2026-02-15",
            time: "20:30",
            guests: 2,
            status: "pending",
            requestedAt: "5h ago"
        },
        {
            id: "res-103",
            guestName: "Rohan Mehta",
            email: "rohan@example.com",
            phone: "+91 99887 76655",
            date: "2026-02-14",
            time: "22:00",
            guests: 6,
            status: "approved",
            requestedAt: "1d ago"
        }
    ]);

    const handleAction = async (id: string, newStatus: string) => {
        setProcessingId(id);
        // Simulate API call/Email sending
        await new Promise(r => setTimeout(r, 1500));
        setReservations(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
        setProcessingId(null);
    };

    const filteredReservations = reservations.filter(r => r.status === filter);

    return (
        <div className="max-w-[1400px] mx-auto space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="px-3 py-1 bg-indigo-500/10 rounded-full text-[10px] font-bold text-indigo-600 uppercase tracking-widest border border-indigo-500/20">
                            Table Management
                        </div>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
                        <Calendar className="w-10 h-10" />
                        Reservations
                    </h1>
                </div>

                <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200">
                    {["pending", "approved", "rejected"].map((s) => (
                        <button
                            key={s}
                            onClick={() => setFilter(s)}
                            className={`px-6 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${filter === s
                                    ? "bg-white text-slate-900 shadow-sm"
                                    : "text-slate-400 hover:text-slate-600"
                                }`}
                        >
                            {s} {filter === s && `(${filteredReservations.length})`}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Today</p>
                    <p className="text-3xl font-black text-slate-900">12</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Pending Requests</p>
                    <p className="text-3xl font-black text-indigo-600">{reservations.filter(r => r.status === 'pending').length}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Confirmed Guests</p>
                    <p className="text-3xl font-black text-slate-900">42</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Available Capacity</p>
                    <p className="text-3xl font-black text-emerald-600">65%</p>
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                {filteredReservations.length === 0 ? (
                    <div className="py-24 text-center space-y-4">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                            <Search className="w-6 h-6 text-slate-200" />
                        </div>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No {filter} reservations</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100 text-left">
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Guest</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date & Time</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Guests</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredReservations.map((res) => (
                                    <tr key={res.id} className="group hover:bg-slate-50/50 transition-all">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-black">
                                                    {res.guestName[0]}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900">{res.guestName}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Mail className="w-3 h-3 text-slate-300" />
                                                        <span className="text-[10px] text-slate-400 font-medium">{res.email}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                                <Calendar className="w-4 h-4 text-slate-300" />
                                                {res.date}
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold mt-1">
                                                <Clock className="w-3 h-3 text-slate-300" />
                                                {res.time}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                                                <Users className="w-4 h-4 text-slate-300" />
                                                {res.guests}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${res.status === 'approved'
                                                    ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                                    : res.status === 'rejected'
                                                        ? "bg-red-50 text-red-600 border-red-100"
                                                        : "bg-indigo-50 text-indigo-600 border-indigo-100"
                                                }`}>
                                                {res.status}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            {filter === 'pending' ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleAction(res.id, 'approved')}
                                                        disabled={processingId === res.id}
                                                        className="h-10 px-4 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
                                                    >
                                                        {processingId === res.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => handleAction(res.id, 'rejected')}
                                                        disabled={processingId === res.id}
                                                        className="h-10 px-4 bg-white border border-slate-200 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all flex items-center gap-2"
                                                    >
                                                        <XCircle className="w-3 h-3" />
                                                        Reject
                                                    </button>
                                                </div>
                                            ) : (
                                                <button className="p-2 text-slate-300 hover:text-slate-600 transition-colors">
                                                    <MoreHorizontal className="w-5 h-5" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
