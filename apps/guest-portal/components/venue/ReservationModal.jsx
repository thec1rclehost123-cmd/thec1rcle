"use client";

import { useState } from "react";
import { X, Calendar, Clock, Users, ChevronRight, CheckCircle2, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ReservationModal({ venue, isOpen, onClose }) {
    const [step, setStep] = useState(1); // 1: Date/Time, 2: Guests/Details, 3: Success
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const [guests, setGuests] = useState(2);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        setLoading(true);
        // Simulate API call to backend
        await new Promise(r => setTimeout(r, 2000));
        setLoading(false);
        setStep(3);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />

            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="relative w-full max-w-lg bg-[#0F0F0F] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-indigo-500/10"
            >
                {/* Header */}
                <div className="p-8 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-indigo-500/10 to-transparent">
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight">Book a Table</h2>
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-1">at {venue.name}</p>
                    </div>
                    <button onClick={onClose} className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
                        <X className="h-5 w-5 text-white/60" />
                    </button>
                </div>

                <div className="p-8">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8"
                            >
                                <div className="space-y-4">
                                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Calendar className="h-3 w-3" /> Select Date
                                    </label>
                                    <input
                                        type="date"
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Clock className="h-3 w-3" /> Select Time
                                    </label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {["20:00", "21:00", "22:00", "23:00", "00:00", "01:00"].map(t => (
                                            <button
                                                key={t}
                                                onClick={() => setTime(t)}
                                                className={`p-3 rounded-xl border text-sm font-bold transition-all ${time === t ? "bg-indigo-600 border-indigo-500 text-white" : "bg-white/5 border-white/10 text-white/60 hover:border-white/20"}`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    disabled={!date || !time}
                                    onClick={() => setStep(2)}
                                    className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-500 hover:text-white transition-all disabled:opacity-30"
                                >
                                    Next Details <ChevronRight className="h-4 w-4" />
                                </button>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8"
                            >
                                <div className="space-y-4">
                                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Users className="h-3 w-3" /> Number of Guests
                                    </label>
                                    <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-2">
                                        {[2, 4, 6, 8, 10].map(n => (
                                            <button
                                                key={n}
                                                onClick={() => setGuests(n)}
                                                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${guests === n ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white"}`}
                                            >
                                                {n}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-6 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl space-y-2">
                                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Reservation Summary</p>
                                    <p className="text-sm font-bold text-white/80">{date} at {time} for {guests} Guests</p>
                                </div>

                                <button
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all"
                                >
                                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Request Reservation"}
                                </button>
                                <button onClick={() => setStep(1)} className="w-full text-center text-white/30 text-[10px] font-bold uppercase tracking-widest hover:text-white transition-colors">Go Back</button>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="py-12 text-center space-y-6"
                            >
                                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-8">
                                    <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-black uppercase tracking-tight">Request Sent!</h3>
                                    <p className="text-white/40 text-sm max-w-[280px] mx-auto leading-relaxed">
                                        Your request has been sent to the partner. You'll receive an email once it's approved.
                                    </p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="px-8 py-4 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
                                >
                                    Close Window
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}
