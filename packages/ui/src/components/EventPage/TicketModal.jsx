"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Info, Minus, Plus } from "lucide-react";

/**
 * Shared TicketModal component.
 */
export default function TicketModal({
    open,
    onClose,
    tickets = [],
    eventId,
    promoterCode,
    onPurchase,
    isPreview = false,
    minTicketsPerOrder = 1,
    maxTicketsPerOrder = 10
}) {
    const [quantities, setQuantities] = useState({});
    const [showDescription, setShowDescription] = useState({});

    const toggleDescription = (id) => {
        setShowDescription(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handlePurchase = () => {
        if (isPreview) return;

        const selectedTickets = [];
        Object.entries(quantities).forEach(([ticketId, qty]) => {
            if (qty > 0) {
                selectedTickets.push({ id: ticketId, quantity: qty });
            }
        });

        if (selectedTickets.length > 0 && typeof onPurchase === "function") {
            onPurchase({ tickets: selectedTickets, promoterCode });
        }
    };

    const total = useMemo(() => {
        return tickets.reduce((sum, ticket) => {
            const qty = Number(quantities[ticket.id] || 0);
            return sum + qty * Number(ticket.price || 0);
        }, 0);
    }, [tickets, quantities]);

    const totalQuantity = useMemo(() => {
        return Object.values(quantities).reduce((sum, qty) => sum + Number(qty), 0);
    }, [quantities]);

    const isBelowMin = totalQuantity > 0 && totalQuantity < minTicketsPerOrder;
    const isAboveMax = totalQuantity > maxTicketsPerOrder;

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ y: "100%", opacity: 0.5 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "100%", opacity: 0.5 }}
                        transition={{ type: "spring", damping: 30, stiffness: 300 }}
                        onClick={(event) => event.stopPropagation()}
                        className="w-full sm:max-w-md overflow-hidden rounded-t-[40px] sm:rounded-[32px] border-t sm:border border-white/10 bg-black p-6 sm:p-8 shadow-2xl"
                    >
                        <div className="mb-6 flex items-start justify-between">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/50">Tickets</p>
                                <p className="mt-1 text-sm text-white/80">Select quantities and checkout instantly.</p>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="text-xs text-white/40 hover:text-white transition-colors"
                                id="close-ticket-modal"
                            >
                                Close
                            </button>
                        </div>

                        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                            {tickets.map((ticket) => (
                                <div
                                    key={ticket.id}
                                    className="rounded-[24px] border border-white/10 bg-white/5 p-5 transition-colors hover:bg-white/10 overflow-hidden"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-base font-semibold text-white">{ticket.name}</p>
                                                {(ticket.name?.toLowerCase().includes("couple") || ticket.name?.toLowerCase().includes("pair")) && (
                                                    <span className="rounded-full bg-orange/20 border border-orange/40 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-orange">Couple</span>
                                                )}
                                                {ticket.description && (
                                                    <button
                                                        onClick={() => toggleDescription(ticket.id)}
                                                        className="p-1 rounded-full hover:bg-white/10 transition-colors"
                                                        title="Ticket Information"
                                                    >
                                                        <Info className={`w-3.5 h-3.5 ${showDescription[ticket.id] ? "text-white" : "text-white/30"}`} />
                                                    </button>
                                                )}
                                            </div>
                                            <p className="mt-0.5 text-xs text-white/40">{ticket.quantity} available</p>
                                        </div>
                                        <p className="text-lg font-bold text-white">₹{ticket.price}</p>
                                    </div>

                                    <AnimatePresence>
                                        {showDescription[ticket.id] && ticket.description && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="mt-3 text-[11px] text-white/60 leading-relaxed border-t border-white/5 pt-3"
                                            >
                                                {ticket.description}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className="mt-4 flex items-center gap-3">
                                        <div className="flex items-center rounded-full border border-white/10 bg-black/40 p-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (isPreview) return;
                                                    const current = quantities[ticket.id] || 0;
                                                    if (current > 0) {
                                                        setQuantities(prev => ({ ...prev, [ticket.id]: current - 1 }));
                                                    }
                                                }}
                                                className="flex h-8 items-center justify-center px-4 rounded-full text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                                                disabled={isPreview || !quantities[ticket.id]}
                                            >
                                                <Minus className="w-3 h-3" />
                                            </button>
                                            <span className="w-8 text-center text-sm font-medium text-white">{quantities[ticket.id] || 0}</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (isPreview) return;
                                                    const current = quantities[ticket.id] || 0;
                                                    if (current < (ticket.quantity || 999)) {
                                                        setQuantities(prev => ({ ...prev, [ticket.id]: current + 1 }));
                                                    }
                                                }}
                                                className="flex h-8 items-center justify-center px-4 rounded-full text-white/60 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-30"
                                                disabled={isPreview || (quantities[ticket.id] || 0) >= (ticket.quantity || 999) || totalQuantity >= maxTicketsPerOrder}
                                            >
                                                <Plus className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {tickets.length === 0 && (
                                <div className="py-12 text-center text-white/40 text-sm">
                                    No ticket tiers available.
                                </div>
                            )}
                        </div>

                        <div className="mt-6 border-t border-white/10 pt-4">
                            <div className="flex flex-col gap-1 px-2 mb-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-white/60">Total</p>
                                    <p className="text-2xl font-bold text-white">₹{total}</p>
                                </div>
                                {totalQuantity > 0 && (
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] text-white/40 uppercase tracking-widest">Quantity</p>
                                        <p className={`text-[10px] font-bold ${isAboveMax ? "text-red-500" : "text-white/60"}`}>
                                            {totalQuantity} / {maxTicketsPerOrder}
                                        </p>
                                    </div>
                                )}
                                {isAboveMax && (
                                    <p className="text-[10px] text-red-500 font-bold mt-1">Maximum {maxTicketsPerOrder} tickets allowed per account.</p>
                                )}
                                {isBelowMin && (
                                    <p className="text-[10px] text-orange font-bold mt-1">Minimum {minTicketsPerOrder} tickets required.</p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={handlePurchase}
                                disabled={isPreview || (totalQuantity === 0) || isBelowMin || isAboveMax}
                                className="w-full rounded-full bg-white py-4 text-xs font-black uppercase tracking-[0.3em] text-black transition hover:bg-white/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group relative"
                            >
                                {isPreview && (
                                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                        Preview mode
                                    </div>
                                )}
                                {total === 0 ? "Confirm RSVP" : "Purchase Tickets"}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
