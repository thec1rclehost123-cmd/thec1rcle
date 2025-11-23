"use client";

import {
    Ticket,
    Crown,
    Armchair,
    CalendarCheck,
    Search,
    Plus,
    X,
    Check,
    Loader2,
    User,
    MoreHorizontal,
    Clock
} from "lucide-react";
import {
    StudioCard,
    MetricCard
} from "../../../components/host/StudioComponents";
import {
    TableBookingGrid
} from "../../../components/host/AdvancedStudioComponents";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, addDoc, query, where, onSnapshot, orderBy, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "../../../lib/firebase/client";
import { useAuth } from "../../../components/providers/AuthProvider";

export default function BookingsPage() {
    const { user } = useAuth();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // New Reservation Form State
    const [newRes, setNewRes] = useState({
        name: "",
        guests: 2,
        time: "22:00",
        type: "Standard Table",
        notes: ""
    });

    // Fetch Bookings
    useEffect(() => {
        if (!user) return;
        const db = getFirebaseDb();

        const q = query(
            collection(db, "bookings"),
            where("hostId", "==", user.uid),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const bookingsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setBookings(bookingsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching bookings:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const handleAddReservation = async (e) => {
        e.preventDefault();
        if (!user) return;
        setSubmitting(true);

        try {
            const db = getFirebaseDb();
            await addDoc(collection(db, "bookings"), {
                hostId: user.uid,
                ...newRes,
                status: "Confirmed",
                createdAt: serverTimestamp(),
                date: new Date().toISOString().split('T')[0]
            });
            setIsAddModalOpen(false);
            setNewRes({ name: "", guests: 2, time: "22:00", type: "Standard Table", notes: "" });
        } catch (error) {
            console.error("Error adding reservation:", error);
            alert("Failed to add reservation");
        } finally {
            setSubmitting(false);
        }
    };

    const updateStatus = async (bookingId, newStatus) => {
        try {
            const db = getFirebaseDb();
            await updateDoc(doc(db, "bookings", bookingId), {
                status: newStatus
            });
        } catch (error) {
            console.error("Error updating status:", error);
        }
    };

    // Stats Calculation
    const stats = {
        totalGuests: bookings.reduce((acc, curr) => acc + parseInt(curr.guests), 0),
        vipCount: bookings.filter(b => b.type.includes("VIP")).length,
        pending: bookings.filter(b => b.status === "Pending").length,
        arrived: bookings.filter(b => b.status === "Arrived").length
    };

    return (
        <div className="max-w-[1800px] mx-auto space-y-8 pb-12 relative">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-heading font-bold text-white mb-1">Reservations</h1>
                    <p className="text-[#888] text-sm font-medium">Manage VIP tables and guestlists.</p>
                </div>
                <div className="flex gap-3">
                    <button className="px-6 py-3 bg-white/[0.03] border border-white/[0.05] text-white rounded-full text-xs font-bold hover:bg-white/[0.08] transition-colors">
                        History
                    </button>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="px-6 py-3 bg-white text-black rounded-full text-xs font-bold uppercase tracking-wider hover:scale-105 transition-transform flex items-center gap-2 shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]"
                    >
                        <Plus className="w-4 h-4" />
                        New Reservation
                    </button>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <MetricCard title="Total Guests" value={stats.totalGuests} change="Tonight" icon={Armchair} delay={0.1} />
                <MetricCard title="VIP Guests" value={stats.vipCount} change="High Value" icon={Crown} delay={0.2} />
                <MetricCard title="Arrived" value={stats.arrived} change="Checked In" icon={User} delay={0.3} />
                <MetricCard title="Pending" value={stats.pending} change="Action Needed" icon={CalendarCheck} delay={0.4} />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Floor Plan - 8 Cols */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                    <StudioCard className="flex-1 min-h-[500px]" delay={0.5}>
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-lg font-bold text-white">Live Floor Plan</h3>
                                <p className="text-xs text-[#666] font-medium mt-1">Real-time Table Status</p>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#111] border border-[#222]">
                                    <div className="w-2 h-2 rounded-full bg-[#C6F432]" />
                                    <span className="text-[10px] font-bold text-[#888]">Available</span>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#111] border border-[#222]">
                                    <div className="w-2 h-2 rounded-full bg-[#FFB020]" />
                                    <span className="text-[10px] font-bold text-[#888]">Reserved</span>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#111] border border-[#222]">
                                    <div className="w-2 h-2 rounded-full bg-[#FF4B55]" />
                                    <span className="text-[10px] font-bold text-[#888]">Occupied</span>
                                </div>
                            </div>
                        </div>
                        <TableBookingGrid />
                    </StudioCard>
                </div>

                {/* Reservation List - 4 Cols */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                    <StudioCard delay={0.6} className="h-full flex flex-col" noPadding>
                        <div className="p-6 border-b border-white/[0.05] flex items-center justify-between bg-[#0A0A0A]">
                            <div>
                                <h3 className="text-lg font-bold text-white">Upcoming</h3>
                                <p className="text-xs text-[#666]">Tonight's List</p>
                            </div>
                            <button className="p-2 hover:bg-white/5 rounded-full transition-colors">
                                <Search className="w-4 h-4 text-[#666]" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2 max-h-[600px]">
                            {loading ? (
                                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[#F44A22]" /></div>
                            ) : bookings.length === 0 ? (
                                <div className="text-center py-12 text-[#444] text-sm">No bookings yet</div>
                            ) : (
                                <AnimatePresence>
                                    {bookings.map((res, i) => (
                                        <motion.div
                                            layout
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            key={res.id}
                                            className="p-4 bg-white/[0.02] rounded-2xl border border-white/[0.05] hover:bg-white/[0.05] hover:border-white/10 transition-all group cursor-pointer"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-[#111] flex items-center justify-center text-xs font-bold text-[#666] border border-[#222]">
                                                        {res.name[0]}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-white text-sm">{res.name}</h4>
                                                        <div className="flex items-center gap-2 text-[10px] text-[#666]">
                                                            <Clock className="w-3 h-3" />
                                                            {res.time}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button className="text-[#444] hover:text-white transition-colors">
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <div className="flex items-center justify-between mt-3 pl-11">
                                                <span className="text-[10px] font-medium text-[#888] bg-white/[0.05] px-2 py-1 rounded-md">
                                                    {res.type} • {res.guests} ppl
                                                </span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        updateStatus(res.id, res.status === "Arrived" ? "Confirmed" : "Arrived");
                                                    }}
                                                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-all border ${res.status === "Confirmed"
                                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                                                        : res.status === "Arrived"
                                                            ? "bg-[#F44A22]/10 text-[#F44A22] border-[#F44A22]/20 hover:bg-[#F44A22]/20"
                                                            : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                                                        }`}
                                                >
                                                    {res.status}
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            )}
                        </div>
                    </StudioCard>
                </div>
            </div>

            {/* Add Reservation Modal - Premium Glass */}
            <AnimatePresence>
                {isAddModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            onClick={() => setIsAddModalOpen(false)}
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="relative w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden"
                        >
                            {/* Top Highlight */}
                            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h3 className="text-xl font-heading font-bold text-white">New Reservation</h3>
                                    <p className="text-xs text-[#666]">Add a guest to the list.</p>
                                </div>
                                <button
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <form onSubmit={handleAddReservation} className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-[#666] uppercase tracking-wider ml-1">Guest Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={newRes.name}
                                        onChange={e => setNewRes({ ...newRes, name: e.target.value })}
                                        className="w-full bg-[#111] border border-white/[0.05] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#444] focus:border-[#F44A22] focus:bg-[#161616] outline-none transition-all"
                                        placeholder="Enter full name"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-[#666] uppercase tracking-wider ml-1">Guests</label>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            value={newRes.guests}
                                            onChange={e => setNewRes({ ...newRes, guests: e.target.value })}
                                            className="w-full bg-[#111] border border-white/[0.05] rounded-xl px-4 py-3 text-sm text-white focus:border-[#F44A22] focus:bg-[#161616] outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-[#666] uppercase tracking-wider ml-1">Time</label>
                                        <input
                                            type="time"
                                            required
                                            value={newRes.time}
                                            onChange={e => setNewRes({ ...newRes, time: e.target.value })}
                                            className="w-full bg-[#111] border border-white/[0.05] rounded-xl px-4 py-3 text-sm text-white focus:border-[#F44A22] focus:bg-[#161616] outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-[#666] uppercase tracking-wider ml-1">Type</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['Standard Table', 'VIP Table', 'Guestlist', 'Bottle Service'].map((type) => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => setNewRes({ ...newRes, type })}
                                                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${newRes.type === type
                                                    ? "bg-[#F44A22] text-white border-[#F44A22]"
                                                    : "bg-[#111] text-[#666] border-white/[0.05] hover:bg-[#161616] hover:text-white"
                                                    }`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-[#666] uppercase tracking-wider ml-1">Notes</label>
                                    <textarea
                                        value={newRes.notes}
                                        onChange={e => setNewRes({ ...newRes, notes: e.target.value })}
                                        className="w-full bg-[#111] border border-white/[0.05] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#444] focus:border-[#5D5FEF] focus:bg-[#161616] outline-none transition-all h-24 resize-none"
                                        placeholder="Special requests, allergies, etc."
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full bg-white text-black font-bold py-3.5 rounded-xl hover:bg-[#e5e5e5] transition-all flex items-center justify-center gap-2 mt-4 shadow-lg shadow-white/5"
                                >
                                    {submitting ? <Loader2 className="animate-spin w-4 h-4" /> : <Check className="w-4 h-4" />}
                                    Confirm Reservation
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
