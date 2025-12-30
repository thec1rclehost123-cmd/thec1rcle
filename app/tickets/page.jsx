"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../components/providers/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { getUserTickets } from "./actions";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";

// --- Hooks ---

const useDominantColor = (imageUrl) => {
    const [color, setColor] = useState('rgba(255, 255, 255, 0.1)');
    const [rgb, setRgb] = useState('128, 128, 128');

    useEffect(() => {
        if (!imageUrl) return;
        const img = new window.Image();
        img.crossOrigin = "Anonymous";
        img.src = imageUrl;
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = 1;
                canvas.height = 1;
                ctx.drawImage(img, 0, 0, 1, 1);
                const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
                setColor(`rgb(${r}, ${g}, ${b})`);
                setRgb(`${r}, ${g}, ${b}`);
            } catch (e) {
                console.error("Color extraction failed", e);
            }
        };
    }, [imageUrl]);

    return { color, rgb };
};

// --- Components ---

const AuroraBackground = () => (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[var(--bg-color)]">
        <div className="absolute -top-[30%] left-0 h-[80vh] w-full bg-gradient-to-b from-orange/10 dark:from-iris/10 via-transparent to-transparent blur-[120px] opacity-60 transition-colors duration-500" />
        <div className="absolute top-[20%] right-[-20%] h-[600px] w-[600px] rounded-full bg-orange/5 dark:bg-gold/5 blur-[100px] opacity-40 mix-blend-multiply dark:mix-blend-screen animate-pulse" />
        {/* Subtle noise texture */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
    </div>
);

const TicketSkeleton = () => (
    <div className="animate-pulse rounded-[24px] border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] p-4 flex gap-4">
        <div className="h-24 w-20 rounded-xl bg-black/[0.05] dark:bg-white/5" />
        <div className="flex-1 space-y-3 py-2">
            <div className="h-4 w-3/4 rounded bg-black/[0.05] dark:bg-white/10" />
            <div className="h-3 w-1/2 rounded bg-black/[0.03] dark:bg-white/5" />
            <div className="h-3 w-1/3 rounded bg-black/[0.03] dark:bg-white/5" />
        </div>
    </div>
);

const TicketCard = ({ ticket, onClick }) => {
    const isPast = ticket.status === "used" || ticket.status === "cancelled";
    const date = new Date(ticket.eventStartAt);
    const dateString = date.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
    const timeString = date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    const { color, rgb } = useDominantColor(ticket.posterUrl);

    return (
        <div className="relative group">
            {/* Ambient Dynamic Glow */}
            {!isPast && (
                <div
                    className="absolute inset-0 z-0 scale-90 opacity-0 blur-[80px] transition-all duration-700 group-hover:scale-110 group-hover:opacity-50 dark:group-hover:opacity-30 mix-blend-multiply dark:mix-blend-normal"
                    style={{ backgroundColor: color }}
                />
            )}

            <motion.div
                whileHover={{ y: -8, scale: 1.01 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                onClick={() => onClick(ticket)}
                className={`relative z-10 flex cursor-pointer overflow-hidden rounded-[28px] border transition-all duration-500 ${isPast
                    ? "border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] opacity-60"
                    : "border-black/[0.12] dark:border-white/[0.08] bg-white/80 dark:bg-white/5 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:hover:shadow-none"
                    }`}
            >
                <div className="flex w-full p-5 gap-6">
                    {/* Poster container */}
                    <div className="relative aspect-[3/4] h-36 flex-shrink-0 overflow-hidden rounded-2xl border border-black/5 dark:border-white/10 shadow-lg">
                        {ticket.posterUrl ? (
                            <Image src={ticket.posterUrl} alt={ticket.eventTitle} fill className="object-cover transition-transform duration-700 group-hover:scale-110" />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center bg-black/5 dark:bg-white/5 text-[10px] font-bold uppercase text-black/20 dark:text-white/20">
                                {ticket.eventTitle.slice(0, 2)}
                            </div>
                        )}
                        {isPast && <div className="absolute inset-0 bg-black/20 dark:bg-black/40 backdrop-grayscale" />}

                        {/* Shimmer effect on hover */}
                        {!isPast && (
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 bg-gradient-to-tr from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transform transition-transform ease-in-out" />
                        )}
                    </div>

                    {/* Details */}
                    <div className="flex flex-1 flex-col justify-between py-1">
                        <div>
                            <h3 className="font-heading text-xl font-black uppercase tracking-tight text-black dark:text-white line-clamp-2 leading-[1.1]">
                                {ticket.eventTitle}
                            </h3>
                            <div className="mt-4 space-y-1.5">
                                <p className="text-[11px] font-bold uppercase tracking-widest text-black/50 dark:text-white/50 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-orange animate-pulse" />
                                    {dateString} • {timeString}
                                </p>
                                <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-black/30 dark:text-white/30 truncate">
                                    {ticket.venueName}, {ticket.city}
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 flex items-center justify-between">
                            <span
                                className="rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] border backdrop-blur-md transition-colors duration-500"
                                style={{
                                    backgroundColor: `rgba(${rgb}, ${color === 'rgba(255, 255, 255, 0.1)' ? '0.05' : '0.12'})`,
                                    borderColor: `rgba(${rgb}, 0.25)`,
                                    color: color === 'rgba(255, 255, 255, 0.1)' ? (isPast ? 'gray' : 'orange') : color,
                                    textShadow: color !== 'rgba(255, 255, 255, 0.1)' ? `0 0 10px rgba(${rgb}, 0.2)` : 'none'
                                }}
                            >
                                {ticket.ticketType}
                            </span>

                            <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full border shadow-sm transition-all duration-300 ${ticket.status === "active"
                                    ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10"
                                    : ticket.status === "used"
                                        ? "text-black/40 dark:text-white/40 border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5"
                                        : "text-red-600 dark:text-red-400 border-red-500/20 bg-red-500/5 dark:bg-red-500/10"
                                    }`}>
                                    {ticket.status}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Aesthetic ticket notch effects */}
                <div className="absolute left-[-8px] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-[var(--bg-color)] border border-black/5 dark:border-white/5 shadow-inner" />
                <div className="absolute right-[-8px] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-[var(--bg-color)] border border-black/5 dark:border-white/5 shadow-inner" />

                {/* Dotted separator line */}
                <div className="absolute left-[138px] top-6 bottom-6 w-[1px] border-l border-dashed border-black/10 dark:border-white/10" />
            </motion.div>
        </div>
    );
};

const QRModal = ({ ticket, onClose }) => {
    if (!ticket) return null;

    const isUsed = ticket.status === "used";
    const isCancelled = ticket.status === "cancelled";
    const { color, rgb } = useDominantColor(ticket.posterUrl);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8"
            onClick={onClose}
        >
            {/* Softened Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/40 dark:bg-black/90 backdrop-blur-2xl"
            />

            {/* Breathing Background Glow */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                <motion.div
                    animate={{
                        scale: [1, 1.25, 1],
                        opacity: [0.35, 0.65, 0.35]
                    }}
                    transition={{
                        duration: 8,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="h-[700px] w-[700px] rounded-full blur-[140px]"
                    style={{
                        backgroundColor: color,
                        boxShadow: `0 0 250px 120px rgba(${rgb}, 0.45)`
                    }}
                />
            </div>

            <motion.div
                initial={{ scale: 0.9, y: 40, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.9, y: 40, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative w-full max-w-[380px] overflow-hidden rounded-[48px] p-[1px] shadow-[0_32px_120px_-20px_rgba(0,0,0,0.5)]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Border Glow Gradient */}
                <div
                    className="absolute inset-0 opacity-40 blur-sm"
                    style={{ background: `linear-gradient(135deg, ${color}, transparent, ${color})` }}
                />
                {/* Inner Container with Glassmorphism */}
                <div
                    className="rounded-[44px] h-full w-full p-8 flex flex-col items-center bg-white/40 dark:bg-black/40 backdrop-blur-3xl border border-white/60 dark:border-white/20 shadow-2xl"
                >
                    {/* Header without Thumbnail */}
                    <div className="mb-8 w-full text-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-black/60 dark:text-white/40">Entry Pass</p>
                        <h2 className="mt-2 font-heading text-3xl font-black uppercase text-black dark:text-white max-w-[300px] leading-tight mx-auto">
                            {ticket.eventTitle}
                        </h2>

                        {/* Dynamic Accent Line */}
                        <div className="mt-4 flex flex-col items-center gap-1.5">
                            <div
                                className="h-[4px] w-24 rounded-full opacity-90 blur-[0.5px] transition-all duration-700"
                                style={{
                                    backgroundColor: color,
                                    boxShadow: `0 0 20px 4px rgba(${rgb}, 0.45)`
                                }}
                            />
                            <div className="h-[1px] w-40 bg-gradient-to-r from-transparent via-black/20 dark:via-white/10 to-transparent" />
                        </div>
                    </div>

                    {/* QR Section */}
                    <div className="relative w-full aspect-square max-w-[260px] flex justify-center items-center bg-white rounded-[40px] p-6 shadow-2xl border border-white/40">
                        <div className={`relative ${isUsed || isCancelled ? "opacity-10 grayscale" : ""}`}>
                            <QRCodeSVG
                                value={ticket.qrPayload}
                                size={200}
                                level="H"
                                includeMargin={false}
                            />
                        </div>

                        {isUsed && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="rotate-[-12deg] border-[3px] border-black px-6 py-3 text-3xl font-black uppercase tracking-[0.2em] text-black bg-white shadow-xl">
                                    USED
                                </span>
                            </div>
                        )}

                        {isCancelled && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="rotate-[-12deg] border-[3px] border-red-600 px-6 py-3 text-3xl font-black uppercase tracking-[0.2em] text-red-600 bg-white shadow-xl">
                                    VOID
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Meta Info */}
                    <div className="mt-8 w-full flex justify-around items-center border-y border-black/5 dark:border-white/5 py-4">
                        <div className="text-center px-4">
                            <p className="text-[9px] font-black uppercase tracking-widest text-black/40 dark:text-white/40">Tier</p>
                            <p className="text-xs font-bold uppercase text-black dark:text-white">{ticket.ticketType}</p>
                        </div>
                        <div className="h-8 w-[1px] bg-black/5 dark:bg-white/5" />
                        <div className="text-center px-4">
                            <p className="text-[9px] font-black uppercase tracking-widest text-black/40 dark:text-white/40">Status</p>
                            <p className={`text-xs font-black uppercase ${ticket.status === 'active' ? 'text-emerald-500' : 'text-red-500'}`}>
                                {ticket.status}
                            </p>
                        </div>
                    </div>

                    {/* Final Hint */}
                    <div className="mt-8 text-center text-black dark:text-white">
                        {!isUsed && !isCancelled ? (
                            <div className="space-y-4">
                                <div className="inline-flex flex-col items-center">
                                    <p
                                        className="text-[11px] font-black uppercase tracking-widest transition-colors duration-700"
                                        style={{ color: color }}
                                    >
                                        Present this QR at entry
                                    </p>
                                    <div
                                        className="h-[2.5px] w-full blur-[3px] mt-1.5 transition-colors duration-700"
                                        style={{ backgroundColor: color }}
                                    />
                                </div>
                                <p className="text-[9px] font-bold text-black/40 dark:text-white/30 uppercase tracking-[0.2em]">
                                    Full brightness recommended
                                </p>
                            </div>
                        ) : (
                            <p className="text-xs font-bold text-black/40 dark:text-white/40 uppercase tracking-widest">
                                This pass is no longer valid
                            </p>
                        )}
                    </div>

                    <button
                        onClick={onClose}
                        className="absolute top-8 right-8 p-2 text-black/20 dark:text-white/20 hover:text-black dark:hover:text-white transition-colors"
                    >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default function TicketsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [tickets, setTickets] = useState({ upcomingTickets: [], pastTickets: [] });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("upcoming");
    const [selectedTicket, setSelectedTicket] = useState(null);
    const searchParams = useSearchParams();

    useEffect(() => {
        if (!authLoading && !user) {
            router.push(`/login?returnUrl=/tickets`);
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (!user?.uid) return;

        const loadTickets = async () => {
            setLoading(true);
            try {
                const data = await getUserTickets(user.uid);
                setTickets(data);

                // Handle Deep Linking
                const targetEventId = searchParams.get("eventId");
                if (targetEventId) {
                    // Try to find in upcoming first, then past
                    const ticketToOpen = data.upcomingTickets.find(t => t.eventId === targetEventId) ||
                        data.pastTickets.find(t => t.eventId === targetEventId);

                    if (ticketToOpen) {
                        setSelectedTicket(ticketToOpen);
                        if (data.pastTickets.includes(ticketToOpen)) {
                            setActiveTab("past");
                        }
                    }
                }
            } catch (error) {
                console.error("Failed to load tickets", error);
            } finally {
                setLoading(false);
            }
        };

        loadTickets();
    }, [user?.uid, searchParams]);

    if (authLoading || (!user && !authLoading)) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--bg-color)]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-black/10 dark:border-white/20 border-t-orange dark:border-t-white" />
            </div>
        );
    }

    const currentTickets = activeTab === "upcoming" ? tickets.upcomingTickets : tickets.pastTickets;

    return (
        <div className="bg-[var(--bg-color)] text-[var(--text-primary)] transition-colors duration-500 selection:bg-orange/30 flex-1 flex flex-col">
            <AuroraBackground />

            <div className="relative z-10 mx-auto max-w-5xl px-4 pb-20 pt-32 sm:px-6 lg:px-8">

                <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-5xl md:text-8xl font-heading font-black uppercase tracking-tighter text-black dark:text-white">
                            Tickets
                        </h1>
                        <div className="mt-8 flex gap-8">
                            <button
                                onClick={() => setActiveTab("upcoming")}
                                className={`text-[10px] font-bold uppercase tracking-[0.3em] transition-colors ${activeTab === "upcoming" ? "text-orange dark:text-white" : "text-black/30 dark:text-white/30 hover:text-black/60 dark:hover:text-white/60"}`}
                            >
                                Upcoming
                                {activeTab === "upcoming" && <motion.div layoutId="ticketTab" className="h-0.5 bg-orange dark:bg-white mt-2" />}
                            </button>
                            <button
                                onClick={() => setActiveTab("past")}
                                className={`text-[10px] font-bold uppercase tracking-[0.3em] transition-colors ${activeTab === "past" ? "text-orange dark:text-white" : "text-black/30 dark:text-white/30 hover:text-black/60 dark:hover:text-white/60"}`}
                            >
                                Past
                                {activeTab === "past" && <motion.div layoutId="ticketTab" className="h-0.5 bg-orange dark:bg-white mt-2" />}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="min-h-[400px]">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                        >
                            {loading ? (
                                <div className="grid gap-10 sm:grid-cols-2">
                                    <TicketSkeleton />
                                    <TicketSkeleton />
                                    <TicketSkeleton />
                                    <TicketSkeleton />
                                </div>
                            ) : currentTickets.length > 0 ? (
                                <div className="grid gap-10 sm:grid-cols-2">
                                    {currentTickets.map((ticket) => (
                                        <TicketCard
                                            key={ticket.ticketId}
                                            ticket={ticket}
                                            onClick={setSelectedTicket}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="py-32 text-center rounded-[40px] border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
                                    <p className="text-black/30 dark:text-white/40 text-sm font-bold uppercase tracking-widest">
                                        {activeTab === "upcoming" ? "No upcoming tickets" : "No past tickets yet"}
                                    </p>
                                    {activeTab === "upcoming" && (
                                        <Link href="/explore" className="mt-8 inline-block rounded-full bg-black dark:bg-white px-8 py-4 text-xs font-bold uppercase tracking-widest text-white dark:text-black hover:scale-105 transition-transform shadow-md">
                                            Explore events
                                        </Link>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            <AnimatePresence>
                {selectedTicket && (
                    <QRModal
                        ticket={selectedTicket}
                        onClose={() => setSelectedTicket(null)}
                    />
                )}
            </AnimatePresence>

            <style jsx global>{`
                /* Hide scrollbar for Chrome, Safari and Opera */
                .no-scrollbar::-webkit-scrollbar {
                  display: none;
                }

                /* Hide scrollbar for IE, Edge and Firefox */
                .no-scrollbar {
                  -ms-overflow-style: none;  /* IE and Edge */
                  scrollbar-width: none;  /* Firefox */
                }
            `}</style>
        </div>
    );
}
