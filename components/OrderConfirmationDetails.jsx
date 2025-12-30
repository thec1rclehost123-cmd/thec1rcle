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
    ArrowRight
} from "lucide-react";
import Link from "next/link";

export default function OrderConfirmationDetails({ order, event }) {
    const [expandedTicket, setExpandedTicket] = useState(null);

    const toggleTicket = (idx) => {
        setExpandedTicket(expandedTicket === idx ? null : idx);
    };

    return (
        <div className="space-y-12">
            {/* Hero Success */}
            <div className="text-center space-y-4">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", damping: 12 }}
                    className="mx-auto h-20 w-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-8 relative"
                >
                    <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                    <motion.div
                        className="absolute inset-x-0 bottom-0 h-10 w-10 bg-orange/20 rounded-full blur-2xl -z-10"
                        animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 3, repeat: Infinity }}
                    />
                </motion.div>

                <h1 className="text-5xl font-black uppercase tracking-[-0.04em] text-black dark:text-white leading-[0.8]">
                    You&apos;re <span className="text-orange">In.</span>
                </h1>
                <p className="text-sm font-medium text-black/40 dark:text-white/40 uppercase tracking-widest max-w-sm mx-auto">
                    Your reservation is confirmed. Your digital passes are ready below.
                </p>
            </div>

            {/* Tickets Section */}
            <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-black/40 dark:text-white/40 ml-4">Your Digital Passes</h3>

                <div className="grid gap-4">
                    {order.tickets.map((ticket, idx) => (
                        <motion.div
                            key={idx}
                            layout
                            className={`overflow-hidden rounded-[32px] border transition-all duration-300 ${expandedTicket === idx
                                    ? "border-orange/20 bg-white dark:bg-zinc-900 shadow-2xl"
                                    : "border-black/[0.05] dark:border-white/10 bg-white/50 dark:bg-white/[0.02]"
                                }`}
                        >
                            <div
                                onClick={() => toggleTicket(idx)}
                                className="p-6 cursor-pointer flex items-center justify-between"
                            >
                                <div className="flex items-center gap-6">
                                    <div className="h-14 w-14 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center shrink-0 border border-black/5 dark:border-white/5">
                                        <Ticket className="h-6 w-6 text-black/20 dark:text-white/20" />
                                    </div>
                                    <div>
                                        <h4 className="font-black uppercase text-black dark:text-white leading-tight">{ticket.name}</h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-500">Active</span>
                                            <span className="h-1 w-1 rounded-full bg-black/10 dark:bg-white/10" />
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-black/30 dark:text-white/30">Entry for 1</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="h-10 w-10 flex items-center justify-center rounded-full bg-black/[0.03] dark:bg-white/5">
                                    {expandedTicket === idx ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                </div>
                            </div>

                            <AnimatePresence>
                                {expandedTicket === idx && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="px-6 pb-6"
                                    >
                                        <div className="pt-6 border-t border-black/[0.03] dark:border-white/[0.05] flex flex-col items-center">
                                            <div className="p-4 bg-white rounded-3xl shadow-xl mb-6">
                                                <QRCodeSVG
                                                    value={`TOKEN-${order.id}-${idx}`}
                                                    size={200}
                                                    level="H"
                                                    includeMargin={false}
                                                />
                                            </div>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-black/60 dark:text-white/60 text-center max-w-[200px]">
                                                Present this QR at the entry gate. One-time use only.
                                            </p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Order Info Panel */}
            <div className="glass-panel p-8 rounded-[40px] border border-black/[0.05] dark:border-white/10 bg-white/50 dark:bg-white/[0.02] grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-6">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-black/40 dark:text-white/40">Order Intelligence</h3>
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <Clock className="h-4 w-4 text-black/20 dark:text-white/20" />
                            <div>
                                <p className="text-[10px] uppercase font-bold text-black/40 dark:text-white/40 tracking-widest leading-none">Purchased At</p>
                                <p className="text-xs font-black text-black dark:text-white uppercase tracking-tight mt-1">{new Date(order.createdAt).toLocaleString()}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <Calendar className="h-4 w-4 text-black/20 dark:text-white/20" />
                            <div>
                                <p className="text-[10px] uppercase font-bold text-black/40 dark:text-white/40 tracking-widest leading-none">Event Date</p>
                                <p className="text-xs font-black text-black dark:text-white uppercase tracking-tight mt-1">{event.date} • {event.time}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <MapPin className="h-4 w-4 text-black/20 dark:text-white/20" />
                            <div>
                                <p className="text-[10px] uppercase font-bold text-black/40 dark:text-white/40 tracking-widest leading-none">Location</p>
                                <p className="text-xs font-black text-black dark:text-white uppercase tracking-tight mt-1">{event.location}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-center justify-center p-6 border-l border-black/[0.05] dark:border-white/10 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40 mb-2">Order ID</p>
                    <p className="font-mono text-xs font-black text-black/60 dark:text-white/60 mb-8 break-all">{order.id}</p>

                    <Link
                        href={`/event/${event.id}`}
                        className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-black dark:text-white hover:text-orange transition-colors"
                    >
                        View Event Page
                        <ExternalLink className="h-3 w-3 transition-transform group-hover:scale-110" />
                    </Link>
                </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 pt-8">
                <Link
                    href="/tickets"
                    className="flex-1 h-16 rounded-full bg-black dark:bg-white text-white dark:text-black font-black uppercase tracking-[0.3em] transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center shadow-xl"
                >
                    Go to My Tickets
                </Link>
                <Link
                    href="/explore"
                    className="flex-1 h-16 rounded-full border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/5 text-[10px] font-black uppercase tracking-[0.3em] text-black dark:text-white transition-all hover:bg-black/[0.04] dark:hover:bg-white/10 flex items-center justify-center gap-2"
                >
                    Explore More
                    <ArrowRight className="h-4 w-4" />
                </Link>
            </div>

            {/* Confetti / Particle effect container (Pure CSS/Styled) */}
            <div className="pointer-events-none fixed inset-0 -z-5 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 h-2 w-2 rounded-full bg-orange/40 blur-sm animate-pulse" />
                <div className="absolute top-1/3 right-1/4 h-1 w-1 rounded-full bg-orange/30 blur-sm animate-pulse delay-1000" />
                <div className="absolute bottom-1/4 left-1/2 h-3 w-3 rounded-full bg-orange/20 blur-md animate-pulse delay-700" />
            </div>
        </div>
    );
}
