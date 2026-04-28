"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../components/providers/AuthProvider";
import { useSearchParams } from "next/navigation";
import { acceptTransfer, cancelTransfer } from "../../features/tickets/ticketApi";
import { invalidateGuestNotifications } from "../../features/notifications/notificationsQueries";
import {
    EMPTY_TICKETS,
    invalidateTicketsQueries,
    useTicketsWalletQuery,
} from "../../features/tickets/ticketsQueries";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

import { Crown, Heart, User, Users, Ticket, ChevronLeft, ChevronRight, Share2, ArrowLeftRight, ExternalLink, Sparkles, XCircle, RefreshCw } from "lucide-react";
import {
    CancelOrderModal,
    CoverTicketCard,
    PartnerModal,
    QRModal,
    ShareModal,
    TicketCard,
    TicketSkeleton,
    TransferAction,
    TransferModal,
    useDominantColor,
} from "../../features/tickets/ticketPageComponents";
import { useCancelOrderBridge } from "../../features/tickets/hooks/useCancelOrderBridge";
import { usePendingReservationRecovery } from "../../features/tickets/hooks/usePendingReservationRecovery";
import { guestApi } from "../../lib/api/client";

function TicketsContent() {
    const { user, bootstrap, loading: authLoading } = useAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState("upcoming");
    const [selectedTicket, setSelectedTicket] = useState(null);
    const searchParams = useSearchParams();
    const [sharingTicket, setSharingTicket] = useState(null);
    const [partnerTicket, setPartnerTicket] = useState(null);
    const [transferTicket, setTransferTicket] = useState(null);
    const { cancellingOrder, closeCancellingOrder } = useCancelOrderBridge();
    const canLoadTickets = !authLoading && Boolean(bootstrap?.routeAccess?.isAuthenticated && user?.uid);
    const ticketsQuery = useTicketsWalletQuery(user?.uid, { enabled: canLoadTickets });
    const tickets = ticketsQuery.data || EMPTY_TICKETS;
    const ticketStatus = ticketsQuery.isSuccess ? "ready" : ticketsQuery.isError ? "error" : ticketsQuery.isLoading ? "loading" : "idle";
    const loading = Boolean(user) && (ticketsQuery.isLoading || (ticketsQuery.isFetching && !ticketsQuery.data));

    const refreshGuestServerState = useCallback(async () => {
        if (!user?.uid) return;
        await Promise.all([
            invalidateTicketsQueries(queryClient, user.uid),
            invalidateGuestNotifications(queryClient, user.uid),
        ]);
    }, [queryClient, user?.uid]);

    const [reissuingOrderId, setReissuingOrderId] = useState(null);
    const handleReissue = useCallback(async (orderId) => {
        if (reissuingOrderId) return;
        setReissuingOrderId(orderId);
        try {
            const { response, data } = await guestApi.orders.reissue(orderId);
            if (!response.ok) throw new Error(data?.error || 'Failed to re-send tickets');
            await refreshGuestServerState();
        } catch (err) {
            console.error('[Tickets] Reissue failed:', err.message);
        } finally {
            setReissuingOrderId(null);
        }
    }, [reissuingOrderId, refreshGuestServerState]);

    // Dynamic Atmosphere: Extract color from the most prominent ticket
    const activePoster = tickets.upcomingTickets?.[0]?.posterUrl || tickets.actionNeeded?.[0]?.posterUrl;
    const { rgb: atmosphereRgb } = useDominantColor(activePoster);

    const { pendingReservation, clearPendingReservation } = usePendingReservationRecovery();

    const coverWallets = tickets.coverWalletsByOrder || {};

    // Handle deep link: open specific ticket from URL ?eventId=
    useEffect(() => {
        if (ticketStatus !== "ready" || !searchParams) return;
        const targetEventId = searchParams.get("eventId");
        if (!targetEventId) return;

        const allGrouped = [...tickets.upcomingTickets, ...tickets.pastTickets];
        const ticketToOpen = allGrouped.find(t => t.eventId === targetEventId);
        if (ticketToOpen) {
            setSelectedTicket(ticketToOpen);
            if (tickets.pastTickets.some(t => t.eventId === targetEventId)) {
                setActiveTab("past");
            }
        }
    }, [ticketStatus, searchParams]);

    if (authLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--bg-color)]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-black/10 dark:border-white/20 border-t-orange dark:border-t-white" />
            </div>
        );
    }

    const TICKETS_DATA = [
        {
            id: 1,
            title: "ACCESS",
            price: "Free",
            icon: Ticket,
            color: "bg-zinc-900",
            type: "Standard"
        },
        {
            id: 2,
            title: "MEMBER",
            price: "Claim",
            icon: User,
            color: "bg-zinc-900",
            type: "Member"
        },
        {
            id: 3,
            title: "VIP",
            price: "$45.00",
            icon: Crown,
            color: "from-orange/20 to-orange/5 border-orange/20",
            type: "VIP"
        },
        {
            id: 4,
            title: "COUPLE",
            price: "$60.00",
            icon: Heart,
            color: "bg-zinc-900",
            type: "Standard"
        },
        {
            id: 5,
            title: "SQUAD",
            price: "$120.00",
            icon: Users,
            color: "bg-zinc-900",
            type: "Standard"
        }
    ];

    const AuroraBackground = () => (
        <div className="fixed inset-0 -z-10 overflow-hidden bg-[var(--bg-color)]">
            {/* Top sweep */}
            <div className="absolute -top-[20%] left-0 h-[90vh] w-full bg-gradient-to-b from-orange/40 dark:from-iris/40 via-transparent to-transparent blur-[100px] opacity-[1.0] transition-colors duration-500" />
            {/* Right orb */}
            <div className="absolute top-[10%] right-[-10%] h-[1400px] w-[1400px] rounded-full bg-orange/20 dark:bg-gold/20 blur-[120px] opacity-[1.0] mix-blend-multiply dark:mix-blend-screen" />
            {/* Bottom-left accent orb */}
            <div className="absolute bottom-[5%] left-[-15%] h-[1000px] w-[1000px] rounded-full bg-iris/20 dark:bg-iris/30 blur-[100px] opacity-[1.0] mix-blend-multiply dark:mix-blend-screen" />
            {/* Centre mid-page warm bloom */}
            <div className="absolute top-[45%] left-[30%] h-[800px] w-[1200px] rounded-full bg-orange/16 dark:bg-orange/20 blur-[140px] opacity-[1.0] mix-blend-multiply dark:mix-blend-screen" />
        </div>
    );

    const TicketCarousel = () => {
        const [activeIndex, setActiveIndex] = useState(2);

        const handleNext = () => {
            setActiveIndex((prev) => (prev + 1 < TICKETS_DATA.length ? prev + 1 : 0));
        };

        const handlePrev = () => {
            setActiveIndex((prev) => (prev - 1 >= 0 ? prev - 1 : TICKETS_DATA.length - 1));
        };

        return (
            <div className="relative w-full h-[500px] flex flex-col items-center justify-center" style={{ perspective: '1000px' }}>
                {/* Glow behind */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange/10 rounded-full blur-[120px] pointer-events-none" />

                <div className="relative h-[450px] w-full flex justify-center items-center">
                    {/* Dynamic Background Glow */}
                    <motion.div
                        className="absolute w-[600px] h-[600px] rounded-full blur-[120px] pointer-events-none"
                        animate={{
                            backgroundColor: TICKETS_DATA[activeIndex].type === "VIP" ? "rgba(255, 165, 0, 0.5)" : "rgba(255, 255, 255, 0.2)",
                            scale: [1, 1.3],
                            opacity: [0.15, 0.45]
                        }}
                        transition={{
                            scale: { duration: 8, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" },
                            opacity: { duration: 8, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" },
                            backgroundColor: { duration: 1 }
                        }}
                    />
                    <AnimatePresence>
                        {TICKETS_DATA.map((ticket, index) => {
                            const offset = index - activeIndex;
                            const isActive = index === activeIndex;

                            return (
                                <motion.div
                                    key={ticket.id}
                                    layout
                                    onClick={() => setActiveIndex(index)}
                                    className={clsx(
                                        "absolute w-[260px] h-[420px] rounded-[32px] cursor-pointer flex flex-col justify-between p-6 overflow-hidden",
                                        "bg-gradient-to-br border shadow-2xl backdrop-blur-md",
                                        isActive ? "border-white/20 z-50" : "border-white/5",
                                        ticket.color.includes("from-") ? ticket.color : "bg-zinc-900"
                                    )}
                                    style={{
                                        boxShadow: isActive
                                            ? "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
                                            : "0 10px 30px -10px rgba(0, 0, 0, 0.8)",
                                    }}
                                    initial={false}
                                    animate={{
                                        x: offset * 140, // Horizontal spread
                                        y: Math.abs(offset) * 40 + (isActive ? 0 : 20), // Arc curve (dropping sides)
                                        scale: 1 - Math.abs(offset) * 0.1, // Scale down sides
                                        rotateZ: offset * 12, // More aggressive fan
                                        rotateY: offset * -15, // 3D Tilt perspective
                                        zIndex: 100 - Math.abs(offset),
                                        opacity: Math.abs(offset) > 2.5 ? 0 : 1,
                                    }}
                                    whileHover={{
                                        scale: isActive ? 1.05 : 1 - Math.abs(offset) * 0.1 + 0.05,
                                        rotateY: offset * -5,
                                        y: isActive ? -15 : Math.abs(offset) * 40
                                    }}
                                >
                                    {/* Animated Glint Effect */}
                                    <motion.div
                                        className="absolute inset-x-0 top-0 h-[200%] w-[100%] bg-gradient-to-b from-transparent via-white/5 to-transparent -skew-y-12 pointer-events-none"
                                        animate={{
                                            y: ["-100%", "100%"]
                                        }}
                                        transition={{
                                            duration: 3,
                                            repeat: Infinity,
                                            ease: "linear",
                                            delay: index * 0.4
                                        }}
                                    />

                                    {/* Active Border Glow */}
                                    {isActive && (
                                        <motion.div
                                            className="absolute inset-0 rounded-[32px] border-2 border-orange/40 pointer-events-none"
                                            animate={{
                                                opacity: [0.2, 0.5, 0.2],
                                                scale: [1, 1.015, 1],
                                            }}
                                            transition={{
                                                duration: 4,
                                                repeat: Infinity,
                                                ease: [0.4, 0, 0.2, 1]
                                            }}
                                        />
                                    )}
                                    {/* Ticket Texture/Pattern */}
                                    <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

                                    {/* Floating Sparkles */}
                                    {[...Array(3)].map((_, i) => (
                                        <motion.div
                                            key={i}
                                            className="absolute w-1 h-1 bg-white/20 rounded-full"
                                            animate={{
                                                y: [0, -40, 0],
                                                x: [0, (i - 1) * 20, 0],
                                                opacity: [0, 0.5, 0],
                                                scale: [0, 1.5, 0]
                                            }}
                                            transition={{
                                                duration: 3 + i,
                                                repeat: Infinity,
                                                delay: i * 1,
                                                ease: "easeInOut"
                                            }}
                                            style={{
                                                left: `${20 + i * 30}%`,
                                                top: `${40 + i * 20}%`
                                            }}
                                        />
                                    ))}

                                    {/* Header */}
                                    <div className="relative flex justify-between items-start">
                                        <div className={clsx(
                                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500",
                                            isActive ? "bg-white/10 border border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.1)]" : "bg-white/5 border border-white/5"
                                        )}>
                                            <ticket.icon className={clsx(
                                                "w-6 h-6 transition-all duration-500",
                                                isActive ? (ticket.type === "VIP" ? "text-orange animate-pulse" : "text-white") : "text-white/20"
                                            )} />
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-[9px] font-bold tracking-[0.2em] text-white/40">THE C1RCLE</span>
                                            <div className="h-0.5 w-8 bg-white/20 mt-1" />
                                        </div>
                                    </div>

                                    {/* Main Content */}
                                    <div className="relative text-center my-auto transform rotate-[-90deg] translate-y-4">
                                        <h2 className={clsx(
                                            ticket.title.length > 6 ? "text-4xl md:text-6xl" : "text-5xl md:text-7xl",
                                            "font-heading font-black uppercase tracking-tighter whitespace-nowrap transition-all duration-500",
                                            isActive ? "text-white" : "text-white/20"
                                        )}>
                                            {ticket.title}
                                        </h2>
                                        {isActive && ticket.type === "VIP" && (
                                            <motion.div
                                                className="absolute -inset-2 bg-orange/20 blur-xl rounded-full -z-10"
                                                animate={{ opacity: [0.4, 0.7, 0.4] }}
                                                transition={{
                                                    duration: 4,
                                                    repeat: Infinity,
                                                    ease: "easeInOut"
                                                }}
                                            />
                                        )}
                                    </div>

                                    {/* Footer */}
                                    <div className="relative w-full">
                                        <div className="flex justify-between items-end mb-4">
                                            <div>
                                                <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1">Price</p>
                                                <p className="text-lg font-bold text-white">{ticket.price}</p>
                                            </div>
                                            <div className="h-8 w-12 rounded bg-white/10 flex items-center justify-center">
                                                <div className="w-1 h-4 bg-white/20 mx-[1px]" />
                                                <div className="w-0.5 h-3 bg-white/20 mx-[1px]" />
                                                <div className="w-1.5 h-4 bg-white/20 mx-[1px]" />
                                                <div className="w-0.5 h-2 bg-white/20 mx-[1px]" />
                                            </div>
                                        </div>

                                        {/* Use Button */}
                                        <div className={clsx(
                                            "w-full py-3 rounded-xl flex items-center justify-center gap-2 transition-colors",
                                            isActive ? "bg-white text-black" : "bg-white/10 text-white/60"
                                        )}>
                                            <span className="text-[10px] font-bold uppercase tracking-widest">
                                                {isActive ? "Select Ticket" : "View"}
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>

                {/* Navigation Controls */}
                <div className="flex gap-6 mt-8 z-50">
                    <button
                        onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                        className="w-12 h-12 rounded-full border border-white/10 bg-white/5 text-white flex items-center justify-center hover:bg-white hover:text-black transition-all active:scale-95"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleNext(); }}
                        className="w-12 h-12 rounded-full border border-white/10 bg-white/5 text-white flex items-center justify-center hover:bg-white hover:text-black transition-all active:scale-95"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>
        );
    };

    const GuestView = () => (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 w-full relative">
            <div className="relative w-full max-w-7xl grid lg:grid-cols-2 gap-16 items-center">

                {/* Visual Side - Interactive Carousel */}
                <div className="relative w-full flex items-center justify-center lg:order-2">
                    <TicketCarousel />
                </div>

                {/* Content Side */}
                <div className="text-center lg:text-left flex flex-col items-center lg:items-start relative z-10 lg:order-1">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <h2 className="text-5xl md:text-7xl font-heading font-black uppercase tracking-tighter text-black dark:text-white mb-6 leading-[0.85]">
                            Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange to-gold">Pass</span> <br />
                            To The Circle
                        </h2>

                        <p className="text-sm font-medium text-black/60 dark:text-white/60 leading-relaxed max-w-md mb-10 mx-auto lg:mx-0">
                            Secure your spot at exclusive events. Your digital wallet for instant access, live updates, and effortless entry.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md mx-auto lg:mx-0">
                            <Link href="/login" className="flex-1 group relative overflow-hidden px-8 py-4 rounded-full bg-black dark:bg-white text-white dark:text-black font-bold uppercase tracking-widest shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] transition-all hover:scale-[1.02] hover:shadow-[0_0_60px_-10px_rgba(255,255,255,0.5)]">
                                <span className="relative text-xs flex items-center justify-center gap-2">
                                    Login to Access
                                </span>
                            </Link>
                            <Link href="/login?mode=register" className="flex-1 px-8 py-4 rounded-full border border-black/10 dark:border-white/10 text-black dark:text-white font-bold uppercase tracking-widest hover:bg-black/5 dark:hover:bg-white/5 transition-colors active:scale-95 flex items-center justify-center">
                                <span className="text-xs">Sign Up</span>
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="bg-[var(--bg-color)] text-[var(--text-primary)] transition-colors duration-500 selection:bg-orange/30 flex-1 flex flex-col">
            <AuroraBackground />

            {!user ? (
                <div className="relative z-10 mx-auto max-w-5xl px-4 pt-32 pb-20 sm:px-6 lg:px-8 flex-1 flex flex-col">
                    <h1 className="text-5xl md:text-8xl font-heading font-black uppercase tracking-tighter text-black dark:text-white mb-12">
                        Tickets
                    </h1>
                    <GuestView />
                </div>
            ) : (
                <div className="relative z-10 mx-auto max-w-5xl px-4 pb-20 pt-32 sm:px-6 lg:px-8">

                    <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <div 
                                    className="h-0.5 w-6 transition-colors duration-1000" 
                                    style={{ backgroundColor: `rgb(${atmosphereRgb})` }}
                                />
                                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-black/30 dark:text-white/30">Your Collection</span>
                            </div>
                            <h1 
                                className="text-6xl md:text-9xl font-heading font-black uppercase tracking-tighter text-black dark:text-white leading-[0.8] transition-all duration-1000"
                                style={{
                                    textShadow: `0 0 80px rgba(${atmosphereRgb}, 0.3)`
                                }}
                            >
                                Tickets
                            </h1>
                        </div>

                        <div className="flex gap-4 p-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-2xl">
                            <button
                                onClick={() => setActiveTab("upcoming")}
                                className={`px-8 py-3 rounded-full text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${activeTab === "upcoming" ? "bg-white text-black shadow-[0_0_40px_rgba(255,255,255,0.3)]" : "text-white/40 hover:text-white"}`}
                            >
                                Current Passes
                            </button>
                            <button
                                onClick={() => setActiveTab("past")}
                                className={`px-8 py-3 rounded-full text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${activeTab === "past" ? "bg-white text-black shadow-[0_0_40px_rgba(255,255,255,0.3)]" : "text-white/40 hover:text-white"}`}
                            >
                                History
                            </button>
                        </div>
                    </div>

                    {pendingReservation ? (
                        <motion.div
                            key="pending-reservation"
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="mb-8 flex items-center justify-between gap-4 rounded-[24px] border border-orange/20 bg-orange/5 px-6 py-5"
                        >
                            <div className="flex items-center gap-4 min-w-0">
                                <div className="h-2 w-2 rounded-full bg-orange animate-pulse shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange">Incomplete Payment</p>
                                    <p className="text-sm font-bold text-black dark:text-white truncate mt-0.5">
                                        {pendingReservation.eventTitle || "Your reserved tickets are waiting"}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <button
                                    onClick={() => clearPendingReservation()}
                                    className="text-[10px] font-bold uppercase tracking-widest text-black/30 dark:text-white/30 hover:text-black/60 dark:hover:text-white/60 transition-colors"
                                >
                                    Dismiss
                                </button>
                                <Link
                                    href={`/checkout/${pendingReservation.eventId}`}
                                    className="px-5 py-2.5 rounded-full bg-orange text-white text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform shadow-[0_4px_20px_rgba(255,120,0,0.3)]"
                                >
                                    Resume Payment →
                                </Link>
                            </div>
                        </motion.div>
                    ) : null}

                    <div className="min-h-[400px]">
                        <AnimatePresence mode="wait" key="state-presence">
                            <motion.div
                                key={activeTab + (tickets.upcomingTickets.length === 0 && tickets.actionNeeded.length === 0 && Object.keys(tickets.coverWalletsByOrder || {}).length === 0 ? "empty" : "content")}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                            >
                                {loading ? (
                                    <div className="grid gap-10 sm:grid-cols-2">
                                        <TicketSkeleton />
                                        <TicketSkeleton />
                                    </div>
                                ) : (activeTab === "upcoming" ? (tickets.upcomingTickets.length > 0 || tickets.actionNeeded.length > 0) : (tickets.pastTickets.length > 0)) ? (
                                    <div className="flex flex-col gap-1 w-full">
                                        {activeTab === "upcoming" && tickets.actionNeeded.length > 0 && (
                                            <div className="mb-8">
                                                <div className="flex items-center gap-3 mb-6">
                                                    <div className="h-[1px] flex-1 bg-black/5 dark:bg-white/5" />
                                                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-black/20 dark:text-white/20">Pending Actions</span>
                                                    <div className="h-[1px] flex-1 bg-black/5 dark:bg-white/5" />
                                                </div>
                                                {tickets.actionNeeded.map((action, idx) => (
                                                    <TransferAction
                                                        key={action.id || `action-${idx}`}
                                                        action={action}
                                                        onAccept={async (id) => {
                                                            await acceptTransfer(id);
                                                            await refreshGuestServerState();
                                                        }}
                                                        onDecline={async (id) => {
                                                            await cancelTransfer(id);
                                                            await refreshGuestServerState();
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        )}

                                        <div className="flex flex-col gap-10 max-w-2xl mx-auto w-full">
                                            {(activeTab === "upcoming" ? tickets.upcomingTickets : tickets.pastTickets).map((ticket, idx) => {
                                                const orderId = ticket.orderId || ticket.tickets?.[0]?.orderId;
                                                const wallets = orderId ? (coverWallets[orderId] || []) : [];
                                                return (
                                                    <div key={ticket.ticketId || ticket.orderId || `ticket-${idx}`} className="w-full">
                                                        <TicketCard
                                                            ticket={ticket}
                                                            onClick={setSelectedTicket}
                                                            onShare={() => setSharingTicket(ticket)}
                                                            onPartner={setPartnerTicket}
                                                            onTransfer={setTransferTicket}
                                                        />
                                                        {activeTab === "upcoming" &&
                                                         (ticket.status === 'active' || ticket.status === 'confirmed') &&
                                                         ticket.tickets?.every(t => !t.qrPayload && !t.entitlementId) && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleReissue(ticket.orderId); }}
                                                                disabled={reissuingOrderId === ticket.orderId}
                                                                className="mt-3 flex items-center gap-2 px-4 py-2 rounded-full border border-orange-500/20 bg-orange-500/5 text-orange-500 text-[10px] font-black uppercase tracking-widest hover:bg-orange-500/10 transition-colors disabled:opacity-50 w-full justify-center"
                                                            >
                                                                <RefreshCw className={`h-3 w-3 ${reissuingOrderId === ticket.orderId ? 'animate-spin' : ''}`} />
                                                                {reissuingOrderId === ticket.orderId ? 'Sending...' : 'Re-send Tickets'}
                                                            </button>
                                                        )}
                                                        {wallets.map((wallet, wIdx) => (
                                                            <CoverTicketCard
                                                                key={wallet.id || `wallet-${wIdx}`}
                                                                walletId={wallet.id}
                                                                initialWallet={wallet}
                                                            />
                                                        ))}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-32 text-center rounded-[40px] border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
                                        <p className="text-black/30 dark:text-white/40 text-sm font-bold uppercase tracking-widest">
                                            {activeTab === "upcoming" ? "No upcoming tickets" : "No past tickets found"}
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
            )}

            <AnimatePresence key="modal-presence">
                {!!selectedTicket && typeof selectedTicket === 'object' ? (
                    <QRModal
                        key={`modal-qr-${selectedTicket.ticketId || selectedTicket.id || 'current'}`}
                        ticket={selectedTicket}
                        onClose={() => setSelectedTicket(null)}
                        onPartner={(ticket) => {
                            setSelectedTicket(null);
                            setPartnerTicket(ticket);
                        }}
                        onTransfer={(ticket) => {
                            setSelectedTicket(null);
                            setTransferTicket(ticket);
                        }}
                        onShare={(ticket) => {
                            setSelectedTicket(null);
                            setSharingTicket(ticket);
                        }}
                    />
                ) : null}

                {!!partnerTicket && typeof partnerTicket === 'object' ? (
                    <PartnerModal
                        key={`modal-partner-${partnerTicket.ticketId || partnerTicket.id || 'current'}`}
                        ticket={partnerTicket}
                        onClose={() => setPartnerTicket(null)}
                        onSuccess={() => {
                            setPartnerTicket(null);
                            refreshGuestServerState();
                        }}
                        onChanged={() => {
                            refreshGuestServerState();
                        }}
                    />
                ) : null}

                {!!sharingTicket && typeof sharingTicket === 'object' ? (
                    <ShareModal
                        key={`modal-share-${sharingTicket.ticketId || sharingTicket.id || 'current'}`}
                        ticket={sharingTicket}
                        onClose={() => setSharingTicket(null)}
                        onSuccess={() => {
                            setSharingTicket(null);
                            refreshGuestServerState();
                        }}
                        onChanged={() => {
                            refreshGuestServerState();
                        }}
                    />
                ) : null}

                {!!transferTicket && typeof transferTicket === 'object' ? (
                    <TransferModal
                        key={`modal-transfer-${transferTicket.ticketId || transferTicket.id || 'current'}`}
                        ticket={transferTicket}
                        onClose={() => setTransferTicket(null)}
                        onSuccess={() => {
                            setTransferTicket(null);
                            refreshGuestServerState();
                        }}
                    />
                ) : null}
            </AnimatePresence>

            {!!cancellingOrder ? (
                <CancelOrderModal
                    key="modal-cancel-order"
                    isOpen={!!cancellingOrder}
                    onClose={closeCancellingOrder}
                    order={cancellingOrder}
                    onSuccess={() => {
                        closeCancellingOrder();
                        invalidateTicketsQueries(queryClient);
                    }}
                />
            ) : null}

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

export default function TicketsPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center bg-[var(--bg-color)]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-black/10 dark:border-white/20 border-t-orange dark:border-t-white" />
            </div>
        }>
            <TicketsContent />
        </Suspense>
    );
}
