"use client";

import Image from "next/image";
import ShimmerImage from "../ShimmerImage";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TicketModal from "./TicketModal";
import GuestlistModal from "./GuestlistModal";
import LikeButton from "./LikeButton";
import { formatEventDate, formatEventTime } from "@c1rcle/core/time";

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

// Redundant local formatting functions removed - using @c1rcle/core/time

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
        if (event?.posterUrl && typeof event.posterUrl === 'string') return event.posterUrl;
        if (event?.flyer && typeof event.flyer === 'string') return event.flyer;
        if (event?.flyerUrl && typeof event.flyerUrl === 'string') return event.flyerUrl;
        if (Array.isArray(event?.images) && event.images.length > 0) return event.images[0];
        if (Array.isArray(event?.gallery) && event.gallery.length > 0) return event.gallery[0];
        return null;
    }, [event?.image, event?.poster, event?.posterUrl, event?.flyer, event?.flyerUrl, event?.images, event?.gallery]);

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

    const isTonight = useMemo(() => {
        if (!event?.startDate) return false;
        return new Date(event.startDate).toDateString() === new Date().toDateString();
    }, [event?.startDate]);

    const isLive = event?.lifecycle === "live" || event?.status === "live";

    useEffect(() => {
        handleAction("TRACK", { event: "event_view", eventId: event?.id });
    }, [event?.id]);

    return (
        <div className={`relative isolate overflow-hidden pb-32 pt-2 text-white bg-black transition-colors duration-500 ${isPreview ? "preview-mode pointer-events-auto" : ""}`} style={{ "--bg-color": "#000", "--text-primary": "#fff", "--text-secondary": "rgba(255,255,255,0.7)", "--text-muted": "rgba(255,255,255,0.4)" }}>
            {/* Cinematic Noise & Glow Overlay */}
            <div className="pointer-events-none fixed inset-0 z-50 opacity-[0.03] mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />

            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,_rgba(255,100,0,0.1),transparent_60%)]" aria-hidden="true" />
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_0%_30%,_rgba(255,50,0,0.05),transparent_40%)]" aria-hidden="true" />

            {/* Poster Background Aura */}
            <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[120vh] overflow-hidden" style={{ maskImage: 'linear-gradient(to bottom, black 0%, black 20%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 20%, transparent 100%)' }}>
                {eventImage && (
                    <div className="relative h-full w-full">
                        <ShimmerImage src={eventImage} alt="" fill sizes="100vw" className="object-cover opacity-60 blur-[100px] saturate-[1.5] scale-125" priority />
                        <div className="absolute inset-0 bg-black/40" />
                    </div>
                )}
            </div>

            {/* Nav Pill */}
            <motion.header
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="sticky top-0 z-[60] px-4 py-4 md:px-8"
            >
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 rounded-full border border-white/10 bg-black/60 px-6 py-3 shadow-2xl backdrop-blur-3xl">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="flex items-center gap-3">
                            <div className="h-8 w-8 flex items-center justify-center rounded-full bg-white text-black font-black text-sm">C</div>
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] hidden sm:block">THE C1RCLE</span>
                        </Link>
                        <div className="h-4 w-[1px] bg-white/10 mx-1 hidden sm:block" />
                        <div className="hidden sm:flex items-center gap-3">
                            <Image src={host?.avatar || "/events/holi-edit.svg"} alt={host?.name} width={24} height={24} className="h-6 w-6 rounded-full object-cover" />
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/60">{host?.name}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <LikeButton eventId={event?.id} isLiked={isLiked} isPreview={isPreview} onLike={(val) => { setIsLiked(val); handleAction("LIKE", { val }); }} />
                        <button type="button" disabled={isPreview} onClick={() => handleAction("SHARE", { id: "copy" })} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white hover:text-black">
                            <CopyIcon />
                        </button>
                    </div>
                </div>
            </motion.header>

            <main className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8 space-y-12">
                {/* Hero */}
                <motion.section variants={sectionVariants} initial="hidden" animate="visible" transition={{ duration: 0.8 }} className="relative overflow-hidden rounded-[48px] border border-white/10 bg-black/40 p-8 md:p-14 shadow-2xl backdrop-blur-3xl">
                    <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-12 lg:gap-20 items-end">
                        <div className="hidden lg:block relative group">
                            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1, delay: 0.2 }} className="relative aspect-[3/4] w-full overflow-hidden rounded-[32px] border border-white/15 shadow-[0_40px_100px_rgba(0,0,0,0.6)]">
                                {eventImage && <ShimmerImage src={eventImage} alt={event?.title} fill className="object-cover transition-transform duration-700 group-hover:scale-105" />}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                            </motion.div>
                        </div>

                        <div className="space-y-10">
                            <div>
                                <h1 className="text-6xl sm:text-7xl lg:text-8xl font-display uppercase tracking-tighter text-white leading-[0.85] mb-8">
                                    {event?.title || "Event Title"}
                                </h1>
                                <div className="flex flex-wrap items-center gap-5">
                                    <div className="flex items-center gap-2 rounded-full border border-orange/20 bg-orange/5 px-4 py-2">
                                        <span className="h-1.5 w-1.5 rounded-full bg-orange animate-pulse" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange">{isLive ? "LIVE NOW" : (isTonight ? "TONIGHT" : (event?.category || "Upcoming"))}</span>
                                    </div>
                                    {event?.isHighDemand && (
                                        <div className="flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/5 px-4 py-2">
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500">SELLING FAST</span>
                                        </div>
                                    )}
                                    <div className="text-xs font-bold uppercase tracking-[0.15em] text-white/40">
                                        {formatEventDate(event?.startDate)} • {event?.venue || "The Secret Circle"}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-10 pt-10 border-t border-white/5">
                                <div className="flex items-center gap-5">
                                    <div className="flex -space-x-4">
                                        {previewInterested.map((guest, i) => (
                                            <div key={i} className="h-14 w-14 overflow-hidden rounded-full border-[3.5px] border-black bg-zinc-900">
                                                {guest.photoURL && guest.photoURL !== "placeholder" ? (
                                                    <Image src={guest.photoURL} alt={guest.name} width={56} height={56} className="object-cover" />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center text-[9px] font-black" style={{ backgroundColor: guest.color }}>{guest.initials}</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-2xl font-display text-white tracking-tighter">{(interestedCount + 80).toLocaleString()}+</p>
                                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">Going</p>
                                    </div>
                                </div>
                                <button onClick={() => setTicketModalOpen(true)} className="w-full sm:w-auto rounded-full bg-white px-12 py-5 text-[11px] font-black uppercase tracking-[0.4em] text-black transition-all hover:scale-105 active:scale-95 shadow-2xl">Book Access</button>
                            </div>
                        </div>
                    </div>
                </motion.section>

                {/* Content */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-10">
                    <div className="space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr] gap-8">
                            <motion.section className="rounded-[40px] border border-white/10 bg-white/[0.02] p-10">
                                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-orange mb-4">About</p>
                                <div className="text-lg leading-relaxed text-white/60 font-medium whitespace-pre-wrap">{event?.description}</div>
                            </motion.section>

                            <div className="space-y-8">
                                <motion.section className="rounded-[40px] border border-white/10 bg-orange p-8 text-black">
                                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-black/40 mb-6">Vibe</p>
                                    <div className="flex flex-wrap gap-2">
                                        {["Intimate", "Minimal", "Techno", "Underground", "High-Energy"].map(tag => (
                                            <span key={tag} className="px-4 py-2 rounded-xl bg-black/5 border border-black/10 text-[10px] font-black uppercase tracking-widest">{tag}</span>
                                        ))}
                                    </div>
                                </motion.section>

                                <motion.section className="rounded-[40px] border border-white/10 bg-white/[0.02] p-8">
                                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mb-4">Location & Entry</p>
                                    <p className="text-3xl font-display uppercase tracking-tighter text-white leading-tight mb-2">{event?.location || "TBA"}</p>
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-bold text-orange uppercase tracking-[0.2em]">{event?.venue}</p>
                                        <div className="flex gap-3">
                                            {event?.ageLimit && <span className="text-[9px] font-black border border-white/10 px-2 py-1 rounded bg-white/5">{event.ageLimit}</span>}
                                            {event?.dressCode && <span className="text-[9px] font-black border border-white/10 px-2 py-1 rounded bg-white/5">DRESS: {event.dressCode.toUpperCase()}</span>}
                                        </div>
                                    </div>
                                </motion.section>
                            </div>
                        </div>

                        {interestedUsers.length > 0 && (
                            <motion.section className="rounded-[40px] border border-white/10 bg-black/40 p-10">
                                <div className="flex items-center justify-between mb-8">
                                    <h3 className="text-2xl font-display uppercase text-white">Guestlist Preview</h3>
                                    <button onClick={() => setGuestModalOpen(true)} className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors">View All</button>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                                    {interestedUsers.slice(0, 6).map((guest) => (
                                        <div key={guest.id} className="flex items-center gap-4 p-4 rounded-3xl border border-white/[0.05] bg-white/[0.02]">
                                            <Image src={guest.photoURL || "/events/holi-edit.svg"} alt={guest.name} width={40} height={40} className="h-10 w-10 rounded-full object-cover grayscale opacity-50" />
                                            <div className="min-w-0">
                                                <p className="text-[11px] font-bold text-white/60 truncate">{guest.name}</p>
                                                <p className="text-[8px] uppercase tracking-widest text-white/20">Verified</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.section>
                        )}
                    </div>

                    <aside>
                        <div className="rounded-[48px] border border-white/10 bg-black/60 p-8 shadow-2xl backdrop-blur-3xl sticky top-28">
                            <h3 className="text-2xl font-display uppercase text-white mb-8">Tickets</h3>
                            <div className="space-y-4">
                                {tickets.map((ticket, i) => {
                                    const state = ticketState(ticket.quantity || 150, ticket.name);
                                    return (
                                        <button key={i} onClick={() => setTicketModalOpen(true)} className="w-full text-left group relative rounded-[32px] border border-white/[0.08] bg-white/[0.02] p-6 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.05]">
                                            <div className="flex justify-between items-start">
                                                <div className="space-y-1">
                                                    <p className="text-sm font-black uppercase tracking-widest text-white/50 group-hover:text-white">{ticket.name}</p>
                                                    <p className={`text-[8px] font-black uppercase tracking-[0.2em] ${state.tone.includes('red') ? "text-red-500" : "text-emerald-500"}`}>{state.label}</p>
                                                </div>
                                                <p className="text-2xl font-display text-white tracking-tighter group-hover:text-orange">₹{ticket.price.toLocaleString()}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                            <button onClick={() => setTicketModalOpen(true)} className="mt-8 w-full rounded-full bg-white py-5 text-[11px] font-black uppercase tracking-[0.5em] text-black hover:scale-[1.03] transition-all">Confirm Access</button>
                        </div>
                    </aside>
                </div>
            </main>

            <GuestlistModal open={guestModalOpen} guests={interestedUsers} onClose={() => setGuestModalOpen(false)} title="Guestlist" isPreview={isPreview} />
            <TicketModal open={ticketModalOpen} onClose={() => setTicketModalOpen(false)} tickets={tickets} eventId={event?.id} isPreview={isPreview} minTicketsPerOrder={event?.minTicketsPerOrder || 1} maxTicketsPerOrder={event?.maxTicketsPerOrder || 10} onPurchase={(data) => handleAction("BOOK", data)} />

            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-8">
                <div className="flex w-full max-w-2xl items-center justify-between gap-4 rounded-full border border-white/10 bg-black/80 px-8 py-5 shadow-2xl backdrop-blur-3xl">
                    <div className="hidden sm:block">
                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/40 mb-1">Passes From</p>
                        <p className="text-2xl font-display text-white">₹{(startingPrice || 0).toLocaleString('en-IN')}</p>
                    </div>
                    <button type="button" disabled={isPreview} onClick={() => isFree ? handleAction("RSVP") : setTicketModalOpen(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-3 rounded-full bg-white px-12 py-4 text-[11px] font-black uppercase tracking-[0.5em] text-black hover:scale-105 transition-all">
                        <span>{isFree ? "Secure Spot" : "Book Tickets"}</span>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
