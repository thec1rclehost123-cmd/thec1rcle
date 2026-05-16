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
import { TicketsAuroraBackground, TicketsGuestView } from "../../features/tickets/TicketsGuestExperience";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

import { RefreshCw } from "lucide-react";
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

    return (
        <div className="bg-[var(--bg-color)] text-[var(--text-primary)] transition-colors duration-500 selection:bg-orange/30 flex-1 flex flex-col">
            <TicketsAuroraBackground />

            {!user ? (
                <div className="relative z-10 mx-auto max-w-5xl px-4 pt-32 pb-20 sm:px-6 lg:px-8 flex-1 flex flex-col">
                    <h1 className="text-3xl sm:text-5xl md:text-8xl font-heading font-black uppercase tracking-tighter text-black dark:text-white mb-12">
                        Tickets
                    </h1>
                    <TicketsGuestView />
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
                                className="text-4xl sm:text-6xl md:text-9xl font-heading font-black uppercase tracking-tighter text-black dark:text-white leading-[0.8] transition-all duration-1000"
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
                                className={`px-4 sm:px-8 py-3 rounded-full text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${activeTab === "upcoming" ? "bg-white text-black shadow-[0_0_40px_rgba(255,255,255,0.3)]" : "text-white/40 hover:text-white"}`}
                            >
                                Current Passes
                            </button>
                            <button
                                onClick={() => setActiveTab("past")}
                                className={`px-4 sm:px-8 py-3 rounded-full text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${activeTab === "past" ? "bg-white text-black shadow-[0_0_40px_rgba(255,255,255,0.3)]" : "text-white/40 hover:text-white"}`}
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
                                    <div className="grid gap-4 sm:gap-10 sm:grid-cols-2">
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
