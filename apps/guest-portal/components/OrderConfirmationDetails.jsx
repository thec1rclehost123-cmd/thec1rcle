"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import {
    Calendar,
    MapPin,
    ChevronDown,
    ChevronUp,
    CheckCircle2,
    ExternalLink,
    Ticket,
    Clock,
    ArrowRight,
    Share2,
    Check
} from "lucide-react";
import Link from "next/link";

export default function OrderConfirmationDetails({ order, event }) {
    const [viewLink, setViewLink] = useState(false);

    const shareOrder = () => {
        if (navigator.share) {
            navigator.share({
                title: `My Tickets to ${event.title}`,
                text: `I'm going to ${event.title}! Get your tickets on THE C1RCLE.`,
                url: window.location.href
            });
        }
    };

    return (
        <div className="h-[calc(100vh-120px)] min-h-[500px] flex flex-col items-center justify-center relative overflow-hidden -mt-10">
            {/* Background Aesthetic */}
            <div className="absolute inset-0 pointer-events-none -z-10">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange/10 rounded-full blur-[160px] animate-pulse-slow" />
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>

            {/* Main Content Container */}
            <div className="w-full max-w-[800px] flex flex-col items-center gap-10">

                {/* Payoff Header */}
                <div className="text-center space-y-6">
                    <motion.div
                        initial={{ scale: 0, rotate: -20 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", damping: 10, stiffness: 100, delay: 0.2 }}
                        className="mx-auto h-24 w-24 rounded-full border-2 border-orange/30 bg-orange/5 flex items-center justify-center relative shadow-[0_0_60px_rgba(255,165,0,0.15)]"
                    >
                        <Check className="h-10 w-10 text-orange" strokeWidth={3} />
                        <motion.div
                            className="absolute inset-[-4px] rounded-full border border-orange/20"
                            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />
                    </motion.div>

                    <div className="space-y-4">
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
                            className="text-6xl md:text-8xl font-black uppercase tracking-tighter text-white leading-[0.75]"
                        >
                            You&apos;re <span className="text-orange shadow-orange/30 shadow-2xl">In.</span>
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.8 }}
                            className="text-[10px] md:text-xs font-black uppercase tracking-[0.5em] text-white/40 max-w-md mx-auto"
                        >
                            Your tickets have been confirmed.
                        </motion.p>
                    </div>
                </div>

                {/* Info Card - Minimalist Glass */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1, duration: 1 }}
                    className="relative group w-full max-w-[500px]"
                >
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-orange/20 to-gold/20 rounded-[40px] blur-xl opacity-0 group-hover:opacity-100 transition duration-1000" />
                    <div className="relative glass-panel bg-white/[0.03] border border-white/10 backdrop-blur-2xl rounded-[40px] p-8 md:p-10 shadow-3xl overflow-hidden text-center">
                        <div className="space-y-8">
                            <div className="space-y-2">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-orange">Event Details</h3>
                                <h2 className="text-2xl font-black uppercase tracking-tight text-white leading-tight">{event.title}</h2>
                            </div>

                            <div className="flex justify-center gap-12">
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black uppercase tracking-widest text-white/30">Event Date</p>
                                    <p className="text-xs font-black text-white uppercase">{event.date.split(',')[0]}</p>
                                </div>
                                <div className="w-px h-8 bg-white/10" />
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black uppercase tracking-widest text-white/30">Time</p>
                                    <p className="text-xs font-black text-white uppercase">{event.time}</p>
                                </div>
                                <div className="w-px h-8 bg-white/10" />
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black uppercase tracking-widest text-white/30">Location</p>
                                    <p className="text-xs font-black text-white uppercase">{(event.city || 'Private')}</p>
                                </div>
                            </div>

                            <div className="pt-8 border-t border-white/5 grid grid-cols-2 gap-4">
                                <div className="text-left">
                                    <p className="text-[8px] font-black uppercase tracking-widest text-white/30">Order Number</p>
                                    <p className="text-[10px] font-mono font-black text-white/40 truncate mt-1">#ORD-{order.id.slice(-8).toUpperCase()}</p>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                    <p className="text-[8px] font-black uppercase tracking-widest text-white/30">Status</p>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                                        <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Active</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Final Actions */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.2 }}
                    className="flex flex-col sm:flex-row gap-4 w-full max-w-[500px]"
                >
                    <Link
                        href="/tickets"
                        className="flex-1 h-16 rounded-full bg-white text-black font-black uppercase tracking-[0.4em] text-[10px] transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center shadow-2xl"
                    >
                        View Tickets
                    </Link>
                    <button
                        onClick={shareOrder}
                        className="h-16 px-10 rounded-full border border-white/10 bg-white/5 text-white/40 font-black uppercase tracking-[0.4em] text-[10px] transition-all hover:bg-white hover:text-black flex items-center justify-center gap-3"
                    >
                        <Share2 className="h-4 w-4" />
                        Share
                    </button>
                    <Link
                        href="/explore"
                        className="h-16 w-16 rounded-full border border-white/10 bg-white/5 text-white/40 flex items-center justify-center transition-all hover:border-orange hover:text-orange"
                    >
                        <ArrowRight className="h-5 w-5" />
                    </Link>
                </motion.div>

            </div>

            {/* Footer Tag */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
                className="absolute bottom-10 text-[8px] font-black uppercase tracking-[1em] text-white/10 pointer-events-none"
            >
                THE C1RCLE
            </motion.div>
        </div>
    );
}
