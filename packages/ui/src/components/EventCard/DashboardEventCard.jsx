"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
    MoreVertical,
    ArrowRight,
    Eye,
    Edit3,
    CheckCircle,
    XCircle,
    Share2,
    BarChart3,
    Clock,
    MoreHorizontal
} from "lucide-react";
import { useMemo, useState, useRef, useEffect } from "react";
import ShimmerImage from "../ShimmerImage.jsx";
import { formatEventDate, formatEventTime } from "@c1rcle/core/time";
import { resolvePoster } from "@c1rcle/core/events";

/**
 * Unified Dashboard EventCard for THE C1RCLE.
 * Matches guest-facing design but with role-based actions and status indicators.
 */
export default function DashboardEventCard({
    event,
    index = 0,
    height = "h-[280px] sm:h-[340px] md:h-[420px]",
    role = "venue", // club, host, promoter, admin
    primaryAction, // { label, onClick, icon, href }
    secondaryActions = [], // Array of { label, onClick, icon, color, href }
    status: statusOverride = null,
    showStats = false
}) {
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setShowMenu(false);
            }
        };
        if (showMenu) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showMenu]);

    // Price Display Logic
    const priceDisplay = useMemo(() => {
        if (!event || !event.tickets || event.tickets.length === 0) {
            if (event?.isRSVP) return "Free";
            return event?.price ? `₹${event.price}` : "";
        }

        const paidTiers = event.tickets.filter(t => Number(t.price) > 0);
        if (paidTiers.length === 0) return "Free";

        const lowestPaid = Math.min(...paidTiers.map(t => Number(t.price)));
        return `From ₹${lowestPaid}`;
    }, [event]);

    const isFree = priceDisplay === "Free";

    // Status Configuration
    const status = useMemo(() => {
        if (!event) return { label: "DRAFT", class: "border-white/20 bg-black/40 text-white" };
        const lifecycle = statusOverride || event.lifecycle || event.status || "draft";
        const configs = {
            live: { label: "LIVE", class: "border-emerald-400/40 bg-emerald-400/20 text-emerald-300" },
            scheduled: { label: "SCHEDULED", class: "border-blue-400/40 bg-blue-400/20 text-blue-300" },
            approved: { label: "APPROVED", class: "border-blue-400/40 bg-blue-400/20 text-blue-300" },
            submitted: { label: "PENDING", class: "border-orange-400/40 bg-orange-400/20 text-orange-400" },
            pending: { label: "PENDING", class: "border-orange-400/40 bg-orange-400/20 text-orange-400" },
            needs_changes: { label: "CHANGES", class: "border-red-400/40 bg-red-400/20 text-red-300" },
            denied: { label: "DENIED", class: "border-red-400/40 bg-red-400/20 text-red-300" },
            draft: { label: "DRAFT", class: "border-white/20 bg-black/40 text-white" },
            cancelled: { label: "CANCELLED", class: "border-zinc-500/40 bg-zinc-800/60 text-zinc-400" },
            completed: { label: "PAST", class: "border-zinc-500/40 bg-zinc-800/60 text-zinc-400" }
        };
        return configs[lifecycle] || configs.draft;
    }, [event, statusOverride]);

    if (!event) return null;

    const displayDate = formatEventDate(event.startDate || event.date);
    const displayTime = formatEventTime(event.startTime || event.time, event.startDate || event.date, "");
    const displayVenue = event.venueName || event.venue || "Venue";
    const displayCity = event.city || "City";
    const poster = resolvePoster(event);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.05 }}
            className="group relative w-full h-full overflow-hidden rounded-[2rem] bg-zinc-900 shadow-2xl"
        >
            {/* Background Image */}
            <div className={`absolute inset-0 z-0 ${height}`}>
                <ShimmerImage
                    src={poster}
                    alt={event.title}
                    fill
                    className="object-cover opacity-60 transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            </div>

            {/* Top Badges */}
            <div className="absolute left-6 top-6 z-10 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest backdrop-blur-md ${status.class}`}>
                        {status.label}
                    </span>
                    {priceDisplay && (
                        <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest backdrop-blur-md ${isFree ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" : "border-white/20 bg-white/10 text-white"
                            }`}>
                            {priceDisplay}
                        </span>
                    )}
                </div>
            </div>

            {/* Bottom Content */}
            <div className="absolute bottom-0 left-0 right-0 z-20 p-8 space-y-4">
                <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">
                        {displayDate} {displayTime && `• ${displayTime}`}
                    </p>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tight line-clamp-2">
                        {event.title}
                    </h3>
                    <p className="text-sm font-medium text-white/40 truncate">
                        {displayVenue}, {displayCity}
                    </p>
                </div>

                {/* Event Stats / Interests */}
                <div className="flex items-center justify-between pt-2">
                    <div className="flex -space-x-3">
                        {[1, 2, 3].map((_, i) => (
                            <div key={i} className="h-7 w-7 rounded-full border-2 border-zinc-900 bg-zinc-800 overflow-hidden">
                                <img
                                    src={`https://api.dicebear.com/9.x/notionists/svg?seed=user${i + index}&backgroundColor=c0aede,b6e3f4`}
                                    alt="User"
                                    className="h-full w-full object-cover"
                                />
                            </div>
                        ))}
                    </div>

                    {showStats && event.stats && (
                        <div className="flex items-center gap-4 text-white/40 text-[10px] font-black uppercase tracking-widest">
                            <div className="flex items-center gap-1.5">
                                <Eye size={14} className="text-white/20" />
                                {event.stats.views || 0}
                            </div>
                            <div className="flex items-center gap-1.5">
                                <CheckCircle size={14} className="text-emerald-500/50" />
                                {event.stats.ticketsSold || event.stats.rsvps || 0}
                            </div>
                        </div>
                    )}
                </div>

                {/* Primary Action Button */}
                {primaryAction && (
                    <div className="pt-4 opacity-0 translate-y-4 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
                        {primaryAction.href ? (
                            <Link
                                href={primaryAction.href}
                                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-xs font-black uppercase tracking-widest text-black hover:bg-zinc-200 transition-all shadow-xl"
                            >
                                {primaryAction.label}
                                {primaryAction.icon || <ArrowRight size={16} />}
                            </Link>
                        ) : (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    primaryAction.onClick?.();
                                }}
                                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-xs font-black uppercase tracking-widest text-black hover:bg-zinc-200 transition-all shadow-xl"
                            >
                                {primaryAction.label}
                                {primaryAction.icon || <ArrowRight size={16} />}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Secondary Actions Button */}
            {secondaryActions.length > 0 && (
                <div className="absolute right-6 top-6 z-30" ref={menuRef}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(!showMenu);
                        }}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white backdrop-blur-xl transition-all hover:bg-white/10"
                    >
                        <MoreHorizontal size={20} />
                    </button>

                    <AnimatePresence>
                        {showMenu && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                className="absolute right-0 mt-3 w-56 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/90 p-1.5 backdrop-blur-2xl shadow-2xl"
                            >
                                {secondaryActions.map((action, i) => (
                                    action.href ? (
                                        <Link
                                            key={i}
                                            href={action.href}
                                            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold uppercase tracking-widest text-white/70 hover:bg-white/5 hover:text-white transition-all"
                                            onClick={() => setShowMenu(false)}
                                        >
                                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5">
                                                {action.icon}
                                            </span>
                                            {action.label}
                                        </Link>
                                    ) : (
                                        <button
                                            key={i}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                action.onClick?.();
                                                setShowMenu(false);
                                            }}
                                            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold uppercase tracking-widest transition-all hover:bg-white/5 ${action.color === 'red' ? 'text-red-400 hover:text-red-300' : 'text-white/70 hover:text-white'
                                                }`}
                                        >
                                            <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${action.color === 'red' ? 'bg-red-500/10' : 'bg-white/5'}`}>
                                                {action.icon}
                                            </span>
                                            {action.label}
                                        </button>
                                    )
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </motion.div>
    );
}
