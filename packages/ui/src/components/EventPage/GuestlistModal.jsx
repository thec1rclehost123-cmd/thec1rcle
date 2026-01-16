"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

const palette = ["#FDE047", "#F43F5E", "#A855F7", "#38BDF8", "#34D399", "#F97316"];

const normalizeHandle = (name = "", index) => {
    const safe = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    return `@${safe || `guest${index + 1}`}`;
};

const fallbackStats = (index) => `${18 + index} events · ${Math.max(3, 4 + index)} months on THE C1RCLE`;

const initials = (value = "") =>
    value
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

/**
 * Shared GuestlistModal component.
 */
export default function GuestlistModal({
    guests = [],
    open,
    onClose,
    title = "Guestlist",
    onFollow,
    isPreview = false
}) {
    useEffect(() => {
        if (!open) return undefined;
        const original = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = original;
        };
    }, [open]);

    const hydratedGuests = (guests || []).map((guest, index) => {
        if (typeof guest === "string") {
            return {
                id: `${guest}-${index}`,
                name: guest,
                handle: normalizeHandle(guest, index),
                stats: fallbackStats(index),
                color: palette[index % palette.length],
                initials: initials(guest)
            };
        }
        return {
            ...guest,
            id: guest.id || `${guest.name}-${index}`,
            name: guest.name || "Guest",
            handle: guest.handle || normalizeHandle(guest.name, index),
            stats: guest.stats || fallbackStats(index),
            color: guest.color || palette[index % palette.length],
            initials: guest.initials || initials(guest.name || "Guest")
        };
    });

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 px-4 pb-8 pt-16 backdrop-blur-2xl sm:items-center"
                    onClick={onClose}
                    role="dialog"
                    aria-modal="true"
                >
                    <motion.div
                        initial={{ y: 40, opacity: 0, scale: 0.96 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: 40, opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                        className="relative w-full max-w-xl rounded-[40px] border border-white/15 bg-black/80 p-6 text-white shadow-2xl overflow-hidden backdrop-blur-xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs uppercase tracking-[0.5em] text-white/40">{title}</p>
                                <h3 className="mt-2 text-2xl font-display uppercase tracking-tight">
                                    {title === "Interested List" ? "Who's Interested" : "Community Going"}
                                </h3>
                                <p className="text-sm text-white/60">
                                    {title === "Interested List" ? "Find them in the app to connect." : "Confirmation of verified members."}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-full border border-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-white/60 transition hover:border-white/40 hover:text-white"
                            >
                                Close
                            </button>
                        </div>
                        <div className="mt-8 max-h-[60vh] space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                            {hydratedGuests.map((guest, index) => (
                                <motion.div
                                    key={guest.id}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.02 }}
                                    className="group flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 px-5 py-4 transition-all hover:bg-white/10"
                                >
                                    <div className="flex items-center gap-4">
                                        <span
                                            className="flex h-12 w-12 items-center justify-center rounded-2xl text-[10px] font-black text-black overflow-hidden"
                                            style={{ backgroundColor: guest.color }}
                                        >
                                            {guest.photoURL && guest.photoURL !== "placeholder" ? (
                                                <img src={guest.photoURL} alt={guest.name} className="h-full w-full object-cover" />
                                            ) : (
                                                guest.initials
                                            )}
                                        </span>
                                        <div>
                                            <p className="text-sm font-black text-white tracking-tight">{guest.name}</p>
                                            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/40">{guest.handle}</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={isPreview}
                                        onClick={() => !isPreview && onFollow && onFollow(guest.id)}
                                        className="rounded-full border border-white/20 px-5 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/60 transition hover:border-white hover:text-white disabled:opacity-40 disabled:cursor-not-allowed group/btn relative"
                                    >
                                        {isPreview && (
                                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap">
                                                Preview
                                            </div>
                                        )}
                                        Follow
                                    </button>
                                </motion.div>
                            ))}
                            {hydratedGuests.length === 0 && (
                                <div className="py-20 text-center">
                                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/30">Quiet for now</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
