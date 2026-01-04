"use client";

import Image from "next/image";
import ShimmerImage from "../ShimmerImage";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TicketModal from "./TicketModal";
import GuestlistModal from "./GuestlistModal";
import LikeButton from "./LikeButton";

const avatarPalette = ["#FDE047", "#F43F5E", "#A855F7", "#38BDF8", "#34D399", "#F97316"];
const fallbackGuests = ["Ari", "Dev", "Ira", "Nia", "Vik", "Reva", "Luna", "Taj", "Mira", "Noah", "Kian", "Sara"];
const fallbackTickets = [
    { id: "ga", name: "General Admission", price: 899, quantity: 200 },
    { id: "vip", name: "VIP Booth", price: 3200, quantity: 12 },
    { id: "crew", name: "Creator Tables", price: 0, quantity: 0 }
];

const CopyIcon = () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
    </svg>
);

const WhatsappIcon = () => (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05.003C5.427.003.041 5.39.038 12.013c0 2.116.554 4.18 1.606 6.006L.002 24l6.142-1.611a11.78 11.78 0 005.904 1.57h.005c6.622 0 12.008-5.387 12.011-12.01.003-3.21-1.246-6.223-3.513-8.491z" />
    </svg>
);

const InstagramIcon = () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" strokeWidth={2} />
        <path strokeWidth={2} d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" strokeWidth={2} />
    </svg>
);

const shareActions = [
    { id: "copy", label: "Copy link", Icon: CopyIcon },
    { id: "whatsapp", label: "Share on WhatsApp", Icon: WhatsappIcon },
    { id: "instagram", label: "Share on Instagram", Icon: InstagramIcon }
];

const initials = (name = "") =>
    name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

const buildHandle = (name, index) => {
    const safe = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    return `@${safe || `guest${index}`}`;
};

const guestStats = (index) => `${20 + index} events · ${Math.max(3, 4 + index)} months on THE C1RCLE`;

const createGuestDirectory = (guests = []) => {
    const source = guests?.length ? guests : fallbackGuests;
    return source.map((name, index) => ({
        id: `${name}-${index}`,
        name,
        handle: buildHandle(name, index),
        stats: guestStats(index),
        color: avatarPalette[index % avatarPalette.length],
        initials: initials(name)
    }));
};

const ticketState = (quantity = 0, name = "") => {
    const isCouple = name?.toLowerCase().includes("couple") || name?.toLowerCase().includes("pair");
    if (quantity <= 0) {
        return { label: "Sold Out", tone: "border-red-500/20 text-red-200 bg-red-500/10", isCouple };
    }
    if (quantity < 35) {
        return { label: "Few Left", tone: "border-amber-400/40 text-amber-200 bg-amber-500/10", isCouple };
    }
    return { label: "Available", tone: "border-emerald-400/30 text-emerald-200 bg-emerald-500/10", isCouple };
};

// Date formatting helpers
const formatEventDate = (dateValue, fallback = "Date TBA") => {
    if (!dateValue) return fallback;

    // If it's already a nicely formatted string (like "Fri, Jan 16"), return as-is
    if (typeof dateValue === 'string' && !dateValue.includes('T') && !dateValue.includes('-')) {
        return dateValue;
    }

    try {
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) return fallback;

        return date.toLocaleDateString('en-IN', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return fallback;
    }
};

const formatEventTime = (timeValue, startDate, fallback = "Time TBA") => {
    // If a specific time string is provided (like "7:00 PM")
    if (typeof timeValue === 'string' && timeValue.includes(':') && !timeValue.includes('T')) {
        return timeValue;
    }

    // Try to get time from ISO startDate
    if (startDate) {
        try {
            const date = new Date(startDate);
            if (!isNaN(date.getTime())) {
                return date.toLocaleTimeString('en-IN', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });
            }
        } catch {
            // Fall through to fallback
        }
    }

    return fallback;
};

export default function EventDetailPage({
    event,
    host,
    interestedData = { count: 0, users: [] },
    guestlist = [],
    isPreview = false,
    onAction = () => { },
    user = null,
    profile = null,
    toast = () => { }
}) {
    const [guestModalOpen, setGuestModalOpen] = useState(false);
    const [ticketModalOpen, setTicketModalOpen] = useState(false);
    const [isLiked, setIsLiked] = useState(false);
    const [activeSocialTab, setActiveSocialTab] = useState("interested");

    const interestedUsers = useMemo(() => {
        if (interestedData.users?.length > 0) {
            return interestedData.users.map((u, i) => ({
                ...u,
                id: u.id || `int-${i}`,
                color: avatarPalette[i % avatarPalette.length],
                initials: u.initials || (u.name ? initials(u.name) : "??")
            }));
        }
        const interestedCount = interestedData.count || event?.stats?.saves || 0;
        if (interestedCount === 0 && !isPreview) return [];

        // In preview mode or if we have count but no users, show placeholders
        return createGuestDirectory(isPreview ? [] : fallbackGuests).slice(0, 8).map((u, i) => ({
            ...u,
            photoURL: isPreview ? "placeholder" : null
        }));
    }, [interestedData.users, interestedData.count, event?.stats?.saves, isPreview]);

    const previewInterested = interestedUsers.slice(0, 6);
    const tickets = event?.tickets?.length ? event.tickets : (isPreview ? fallbackTickets : []);

    // Resolve image from multiple possible field names
    const eventImage = useMemo(() => {
        if (event?.image && typeof event.image === 'string') return event.image;
        if (event?.poster && typeof event.poster === 'string') return event.poster;
        if (event?.flyer && typeof event.flyer === 'string') return event.flyer;
        if (Array.isArray(event?.images) && event.images.length > 0) return event.images[0];
        if (Array.isArray(event?.gallery) && event.gallery.length > 0) return event.gallery[0];
        return null;
    }, [event?.image, event?.poster, event?.flyer, event?.images, event?.gallery]);

    const startingPrice = useMemo(() => {
        const paidTiers = tickets.filter(t => Number(t.price) > 0);
        if (paidTiers.length === 0) return 0;
        return Math.min(...paidTiers.map(t => Number(t.price)));
    }, [tickets]);

    const isFree = tickets.length > 0 && tickets.every(t => Number(t.price) === 0);

    const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(event?.location || event?.venue || "Pune, IN")}&z=14&ie=UTF8&iwloc=&output=embed`;
    const gradientStart = event?.gradientStart || "#18181b";
    const gradientEnd = event?.gradientEnd || "#0b0b0f";
    const interestedCount = interestedData.count || (isPreview ? 0 : (event?.stats?.saves || 0));

    const hasRSVPd = Boolean(event?.id && profile?.attendedEvents?.includes(event.id));

    const handleAction = (type, data = {}) => {
        if (isPreview) return;
        if (onAction) onAction(type, data);
    };

    const sectionVariants = {
        hidden: { opacity: 0, y: 24 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <div className={`relative isolate overflow-hidden pb-28 pt-2 text-[var(--text-primary)] bg-[var(--bg-color)] transition-colors duration-500 ${isPreview ? "preview-mode pointer-events-auto" : ""}`} style={{ "--bg-color": "#000", "--text-primary": "#fff", "--text-secondary": "rgba(255,255,255,0.7)", "--text-muted": "rgba(255,255,255,0.4)" }}>
            <div
                className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_var(--glass-bg),transparent_45%)]"
                aria-hidden="true"
            />

            {/* Dynamic Background */}
            <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[800px] overflow-hidden">
                {eventImage && eventImage !== "/events/holi-edit.svg" ? (
                    <motion.div className="relative h-full w-full">
                        <ShimmerImage
                            src={eventImage}
                            alt={event.title || "Event Image"}
                            fill
                            sizes="100vw"
                            className="object-cover opacity-40 dark:opacity-80 blur-[80px] saturate-[1.8]"
                            priority
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--bg-color)]/40 to-[var(--bg-color)]" />
                    </motion.div>
                ) : (

                    <div
                        className="absolute inset-0"
                        style={{
                            backgroundImage: `linear-gradient(180deg, ${gradientStart}, rgba(244,74,34,0.1) 60%, var(--bg-color))`,
                            filter: "blur(50px)",
                            opacity: 0.3
                        }}
                    />
                )}
            </div>

            {/* Sticky Header */}
            <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                className="sticky top-0 z-30 border-b border-white/[0.05] px-4 py-3 backdrop-blur-3xl sm:px-6 bg-[var(--bg-color)]/40"
            >
                <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.35em] text-[var(--text-secondary)]">
                    <div>
                        <p className="font-bold">{event?.host || host?.name || "Host Name"}</p>
                        <p className="text-[11px] opacity-70">
                            {formatEventDate(event?.startDate || event?.date)} · {formatEventTime(event?.time || event?.startTime, event?.startDate)}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <LikeButton
                            eventId={event?.id}
                            isLiked={isLiked}
                            isPreview={isPreview}
                            onLike={(val) => {
                                setIsLiked(val);
                                handleAction("LIKE", { val });
                            }}
                        />
                        {shareActions.map(({ id, label, Icon }) => (
                            <button
                                key={id}
                                type="button"
                                disabled={isPreview}
                                onClick={() => handleAction("SHARE", { id })}
                                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[var(--text-primary)] transition hover:border-white hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed group relative"
                                aria-label={label}
                            >
                                <Icon />
                                {isPreview && (
                                    <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-black text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Preview</div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </motion.div>

            <div className="mx-auto max-w-6xl space-y-10 px-4 pb-32 pt-10 sm:px-6 lg:space-y-12">
                {/* Hero Section */}
                <motion.section
                    variants={sectionVariants}
                    initial="hidden"
                    animate="visible"
                    transition={{ duration: 0.5 }}
                    className="rounded-[48px] border border-white/[0.08] bg-black/40 p-10 shadow-sm backdrop-blur-3xl"
                >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-10 md:gap-16">
                        <div className="flex-1 space-y-8">
                            <div className="flex flex-col gap-4">
                                <h1 className="text-5xl sm:text-7xl lg:text-8xl font-display uppercase tracking-[-0.04em] text-white leading-[0.8]">
                                    {event?.title || "Event Title"}
                                </h1>
                            </div>

                            <div className="flex flex-wrap items-center gap-5">
                                <p className="text-[13px] font-medium text-white/70">
                                    Hosted by <span className="text-white font-black underline underline-offset-4 decoration-orange/30 cursor-pointer">{host?.name || event?.host || "Host Name"}</span>
                                </p>

                                <div className="h-4 w-[1px] bg-white/[0.1] hidden sm:block" />

                                <div className="flex items-center gap-3">
                                    <div className="group relative flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1.5 px-4 backdrop-blur-xl">
                                        <span className="h-1.5 w-1.5 rounded-full bg-orange animate-pulse" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">
                                            {event?.category || "Trending"}
                                        </span>
                                    </div>
                                    <div className="group relative flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1.5 px-4 backdrop-blur-xl">
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">
                                            {formatEventDate(event?.startDate || event?.date)}
                                        </span>
                                    </div>

                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 pt-10 border-t border-white/[0.05] flex flex-col lg:flex-row lg:items-center justify-between gap-8 lg:gap-12">
                        <div className="flex items-center gap-6">
                            <div className="flex -space-x-3.5">
                                {previewInterested.map((guest, i) => (
                                    <span
                                        key={guest.id || i}
                                        className="flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-black text-[10px] font-black text-black overflow-hidden bg-white/10 shadow-sm"
                                        style={{ backgroundColor: !guest.photoURL || guest.photoURL === "placeholder" ? guest.color : undefined }}
                                    >
                                        {guest.photoURL && guest.photoURL !== "placeholder" ? (
                                            <ShimmerImage src={guest.photoURL} alt={guest.name} width={56} height={56} className="object-cover" />
                                        ) : (
                                            guest.initials
                                        )}
                                    </span>
                                ))}
                                {interestedCount > 6 && (
                                    <span className="flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-black bg-zinc-900 text-[10px] font-black text-white shadow-sm">
                                        +{interestedCount - 6}
                                    </span>
                                )}
                            </div>
                            <div className="space-y-1">
                                <p className="text-2xl font-display uppercase tracking-tight text-white leading-none">
                                    {interestedCount.toLocaleString()} <span className="text-[var(--text-muted)] text-sm font-medium tracking-normal lowercase">interested</span>
                                </p>
                                <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">
                                    Join them
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 w-full lg:w-auto mt-4 sm:mt-0">
                            <button
                                type="button"
                                disabled={isPreview}
                                onClick={() => setGuestModalOpen(true)}
                                className="group relative flex-1 min-w-[120px] rounded-full border border-white/20 bg-white/[0.02] px-8 py-4 text-[10px] font-black uppercase tracking-[0.4em] text-white/60 transition-all hover:bg-white/5 hover:text-white backdrop-blur-xl active:scale-95 disabled:opacity-50"
                            >
                                Interested
                            </button>
                            <button
                                type="button"
                                disabled={isPreview}
                                onClick={() => isFree ? handleAction("RSVP") : setTicketModalOpen(true)}
                                className="flex-[1.5] min-w-[160px] rounded-full bg-white px-10 py-4 text-[10px] font-black uppercase tracking-[0.45em] text-black transition-all hover:scale-[1.02] active:scale-95 shadow-xl group relative"
                            >
                                {isPreview && (
                                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Preview mode</div>
                                )}
                                {isFree ? "RSVP Now" : "Book Tickets"}
                            </button>
                        </div>
                    </div>
                </motion.section>

                <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:gap-10">
                    <div className="order-2 lg:order-1 space-y-6 lg:space-y-7">
                        {/* About Section */}
                        <motion.section
                            variants={sectionVariants}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, margin: "-120px" }}
                            transition={{ duration: 0.55 }}
                            className="rounded-[40px] border border-white/10 bg-black/40 p-8 shadow-sm backdrop-blur-md"
                        >
                            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-orange">Details</p>
                            <h3 className="mt-4 text-2xl font-display uppercase tracking-tight text-white">About Event</h3>
                            <p className="mt-6 text-base leading-relaxed text-white/60 font-medium whitespace-pre-wrap">{event?.description || "No description provided yet."}</p>

                            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
                                    <p className="text-[9px] font-black uppercase tracking-[0.4em] text-[var(--text-muted)]">When</p>
                                    <p className="mt-2 text-white font-black uppercase tracking-tight">
                                        {formatEventDate(event?.startDate || event?.date)}
                                    </p>
                                    <p className="text-[var(--text-muted)] text-[11px] font-bold mt-1">{formatEventTime(event?.time || event?.startTime, event?.startDate)}</p>
                                </div>

                                <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
                                    <p className="text-[9px] font-black uppercase tracking-[0.4em] text-[var(--text-muted)]">Entry</p>
                                    <p className="mt-2 text-white font-black uppercase tracking-tight italic">
                                        {isFree ? "Free Entry" : "Tickets Required"}
                                    </p>
                                    <p className="text-[var(--text-muted)] text-[11px] font-bold mt-1">Verified Gate Access</p>
                                </div>
                            </div>
                        </motion.section>

                        {/* Combined Social Section (Interested + Guestlist) */}
                        <motion.section
                            variants={sectionVariants}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, margin: "-120px" }}
                            transition={{ duration: 0.55, delay: 0.1 }}
                            className="rounded-[40px] border border-white/10 bg-black/40 p-8 shadow-sm backdrop-blur-md"
                        >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[var(--text-muted)]">Community</p>
                                    <div className="mt-4 flex items-center gap-6">
                                        <button
                                            onClick={() => setActiveSocialTab("interested")}
                                            className={`text-2xl font-display uppercase tracking-tight transition-all ${activeSocialTab === "interested" ? "text-white" : "text-white/20 hover:text-white/40"}`}
                                        >
                                            Interested
                                        </button>
                                        {event?.settings?.showGuestlist && (
                                            <button
                                                onClick={() => setActiveSocialTab("guestlist")}
                                                className={`text-2xl font-display uppercase tracking-tight transition-all ${activeSocialTab === "guestlist" ? "text-white" : "text-white/20 hover:text-white/40"}`}
                                            >
                                                Guestlist
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 max-h-[460px] overflow-y-auto pr-2 custom-scrollbar">
                                {activeSocialTab === "interested" ? (
                                    <>
                                        {interestedUsers.map((guest) => (
                                            <div key={guest.id} className="flex items-center justify-between gap-4 rounded-[28px] border border-white/[0.06] bg-white/[0.03] px-5 py-4 transition-all hover:bg-white/[0.08] hover:scale-[1.01]">
                                                <div className="flex items-center gap-4">
                                                    <span
                                                        className="flex h-12 w-12 items-center justify-center rounded-2xl text-[10px] font-black text-black overflow-hidden bg-white/10 shadow-sm"
                                                        style={{ backgroundColor: !guest.photoURL || guest.photoURL === "placeholder" ? guest.color : undefined }}
                                                    >
                                                        {guest.photoURL && guest.photoURL !== "placeholder" ? (
                                                            <ShimmerImage src={guest.photoURL} alt={guest.name} width={48} height={48} className="object-cover" />
                                                        ) : (
                                                            guest.initials
                                                        )}
                                                    </span>
                                                    <div>
                                                        <p className="text-sm font-black text-white tracking-tight">{guest.name}</p>
                                                        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--text-muted)] mt-0.5">{guest.handle}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    disabled={isPreview}
                                                    className="rounded-full border border-white/20 px-5 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] transition hover:border-white hover:text-white disabled:opacity-40"
                                                >
                                                    Follow
                                                </button>
                                            </div>
                                        ))}
                                        {interestedUsers.length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                                <p className="text-[10px] font-black text-[var(--text-muted)] tracking-[0.4em] uppercase">No noise yet</p>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {guestlist.length > 0 ? (
                                            guestlist.map((guest) => (
                                                <div key={guest.id} className="flex items-center justify-between gap-4 rounded-[28px] border border-orange/20 bg-orange/5 px-5 py-4 backdrop-blur shadow-glow-sm">
                                                    <div className="flex items-center gap-4">
                                                        <span
                                                            className="flex h-12 w-12 items-center justify-center rounded-2xl text-[10px] font-black text-black overflow-hidden bg-white/10 shadow-sm"
                                                            style={{ backgroundColor: guest.color }}
                                                        >
                                                            {guest.photoURL && guest.photoURL !== "placeholder" ? (
                                                                <ShimmerImage src={guest.photoURL} alt={guest.name} width={48} height={48} className="object-cover" />
                                                            ) : (
                                                                guest.initials || initials(guest.name)
                                                            )}
                                                        </span>
                                                        <div>
                                                            <p className="text-sm font-black text-white tracking-tight">{guest.name}</p>
                                                            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-orange mt-0.5">Verified Attendee</p>
                                                        </div>
                                                    </div>
                                                    <div className="h-2 w-2 rounded-full bg-orange animate-pulse" />
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                                                <span className="text-3xl">🎟️</span>
                                                <p className="text-[10px] font-black text-orange/60 tracking-[0.4em] uppercase">0 on Guestlist</p>
                                                <p className="text-[11px] text-white/40 max-w-[200px]">Guestlist populates automatically as people book or RSVP.</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {activeSocialTab === "interested" && interestedUsers.length > 0 && (
                                <button
                                    type="button"
                                    disabled={isPreview}
                                    onClick={() => setGuestModalOpen(true)}
                                    className="mt-8 w-full text-center text-[10px] font-black uppercase tracking-[0.4em] text-[var(--text-muted)] hover:text-orange transition-colors disabled:opacity-50"
                                >
                                    View full list
                                </button>
                            )}
                        </motion.section>

                        {/* Location Section */}
                        <motion.section
                            variants={sectionVariants}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, margin: "-120px" }}
                            transition={{ duration: 0.55, delay: 0.1 }}
                            className="rounded-[40px] border border-white/10 bg-black/40 p-8 shadow-sm backdrop-blur-md"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[var(--text-muted)]">Location</p>
                                    <h3 className="mt-4 text-2xl font-display uppercase tracking-tight text-white">{event?.location || "Location TBA"}</h3>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mt-1.5 opacity-60">{event?.venue || "Venue Details"}</p>
                                </div>
                            </div>
                            <div className="overflow-hidden rounded-[32px] border border-white/10 shadow-2xl relative">
                                <div className="absolute top-4 left-4 z-10 rounded-full bg-black/80 px-4 py-2 border border-white/10 shadow-xl backdrop-blur-md">
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-orange animate-pulse" />
                                        Event Location
                                    </p>
                                </div>
                                <iframe
                                    title={`Map for ${event?.location}`}
                                    src={mapSrc}
                                    className="h-80 w-full invert dark:invert-0 opacity-80 contrast-[1.2] hover:opacity-100 transition-all duration-700"
                                    loading="lazy"
                                    allowFullScreen
                                    referrerPolicy="no-referrer-when-downgrade"
                                />
                            </div>
                        </motion.section>

                        {/* Host Section */}
                        <motion.section
                            variants={sectionVariants}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, margin: "-120px" }}
                            transition={{ duration: 0.55, delay: 0.15 }}
                            className="rounded-[36px] border border-white/10 bg-black/70 p-6 shadow-sm backdrop-blur-md space-y-6"
                        >
                            <div className="flex flex-wrap items-center gap-4 group">
                                <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white/15 transition-all">
                                    <Image src={host?.avatar || "/events/holi-edit.svg"} alt={host?.name || "Host"} fill className="object-cover" />
                                </div>
                                <div>
                                    <p className="text-lg font-bold uppercase tracking-tight text-white">{host?.name || event?.host || "Host Name"}</p>
                                    <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-widest">
                                        {host?.followers || 0} followers · {host?.location || "Global"}
                                    </p>
                                </div>
                            </div>
                            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{host?.bio || "No bio available for this host."}</p>
                            <div className="flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    disabled={isPreview}
                                    className="flex-1 rounded-full border border-white/20 bg-white/5 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.35em] text-[var(--text-secondary)] transition hover:bg-white/10 sm:flex-none sm:px-8 disabled:opacity-50"
                                >
                                    Message
                                </button>
                                <button
                                    type="button"
                                    disabled={isPreview}
                                    className="flex-1 rounded-full bg-white px-4 py-3 text-[10px] font-black uppercase tracking-[0.35em] text-black transition hover:scale-105 shadow-lg sm:flex-none sm:px-8 disabled:opacity-50"
                                >
                                    Follow
                                </button>
                            </div>
                        </motion.section>
                    </div>

                    <motion.aside
                        variants={sectionVariants}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: "-120px" }}
                        transition={{ duration: 0.55, delay: 0.2 }}
                        className="order-1 lg:order-2 space-y-6 mb-8 lg:mb-0"
                    >
                        <div className="rounded-[40px] border border-white/10 bg-black/70 p-5 shadow-xl backdrop-blur-md">
                            <div className="group relative">
                                <div className="relative w-full overflow-hidden rounded-[32px] border border-white/10 bg-black shadow-2xl" style={{ aspectRatio: '3/4', minHeight: '400px' }}>
                                    {eventImage && (
                                        <ShimmerImage
                                            src={eventImage}
                                            alt={event.title || "Event Image"}
                                            fill
                                            sizes="(max-width: 768px) 100vw, 400px"
                                            className="object-cover transition duration-500 group-hover:scale-[1.01] group-hover:rotate-[1deg]"
                                        />
                                    )}
                                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/60 mix-blend-screen opacity-80" />
                                </div>
                            </div>


                            <div className="mt-10 space-y-6">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[var(--text-muted)] mb-4">Tiers</p>
                                    <div className="space-y-3">
                                        {tickets.map((ticket, i) => {
                                            const state = ticketState(ticket.quantity || 150, ticket.name);
                                            return (
                                                <div
                                                    key={ticket.id || i}
                                                    className="group relative rounded-[32px] border border-white/[0.08] bg-white/[0.02] p-5 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.05] backdrop-blur-sm"
                                                >
                                                    {state.isCouple && (
                                                        <div className="absolute -top-3 -right-3 rounded-xl bg-white px-3 py-1.5 shadow-lg rotate-3 z-10">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-black">Couple</p>
                                                        </div>
                                                    )}
                                                    <div className="flex items-start justify-between">
                                                        <div className="space-y-1.5">
                                                            <p className="text-base font-black uppercase tracking-tight text-white leading-none">{ticket.name || "Tier Name"}</p>
                                                            <p className="text-[9px] font-bold uppercase text-white/40 tracking-[0.2em]">Limited Access</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-2xl font-display text-white tracking-tighter">₹{ticket.price || 0}</p>
                                                        </div>
                                                    </div>
                                                    <div className="mt-5 flex items-center justify-between">
                                                        <span className={`inline-flex rounded-full border px-4 py-1.5 text-[8px] font-black uppercase tracking-[0.25em] ${state.tone}`}>
                                                            {state.label}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {tickets.length === 0 && (
                                            <div className="py-8 text-center border border-dashed border-white/10 rounded-3xl">
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-white/20">No Tiers Defined</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-3 pt-4 border-t border-white/[0.05]">
                                    <button
                                        type="button"
                                        disabled={isPreview}
                                        onClick={() => setTicketModalOpen(true)}
                                        className="w-full rounded-full bg-white px-5 py-4 text-[10px] font-black uppercase tracking-[0.4em] text-black transition hover:scale-[1.02] active:scale-95 shadow-xl disabled:opacity-50"
                                    >
                                        {isFree ? "Secure Spot" : "Buy Tickets"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.aside>
                </div>
            </div>

            {/* Modals */}
            <GuestlistModal
                open={guestModalOpen}
                guests={interestedUsers}
                onClose={() => setGuestModalOpen(false)}
                title="Interested List"
                isPreview={isPreview}
            />
            <TicketModal
                open={ticketModalOpen}
                onClose={() => setTicketModalOpen(false)}
                tickets={tickets}
                eventId={event?.id}
                isPreview={isPreview}
                onPurchase={(data) => handleAction("BOOK", data)}
            />

            {/* Bottom Action Bar */}
            <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-0 sm:px-4 pb-8 sm:pb-8"
            >
                <div className="flex w-full max-w-2xl flex-wrap items-center justify-between gap-3 rounded-none sm:rounded-full border-t sm:border border-white/15 bg-black/80 px-6 py-4 sm:py-4 text-sm shadow-2xl backdrop-blur-2xl transition-all duration-500">
                    {hasRSVPd && !isPreview ? (
                        <>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-white">You are going to this event.</p>
                            <button
                                type="button"
                                onClick={() => handleAction("CANCEL_RSVP")}
                                className="rounded-full border border-white/20 px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-white/60 transition hover:border-red-500 hover:text-red-500"
                            >
                                Cancel
                            </button>
                        </>
                    ) : (
                        <>
                            <div>
                                <p className="text-white font-black uppercase tracking-[0.3em] text-xs">
                                    {isFree ? "Secure Spot" : "Tickets Available"}
                                </p>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mt-1">
                                    {isFree ? "Free Entry" : `From ₹${startingPrice}`}
                                </p>
                            </div>
                            <button
                                type="button"
                                disabled={isPreview}
                                onClick={() => isFree ? handleAction("RSVP") : setTicketModalOpen(true)}
                                className="rounded-full bg-white px-8 py-3 text-[10px] font-black uppercase tracking-[0.4em] text-black transition hover:scale-105 shadow-lg group relative"
                            >
                                {isPreview && (
                                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Preview mode</div>
                                )}
                                {isFree ? "RSVP Now" : "Buy Tickets"}
                            </button>
                        </>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
