"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Info, Minus, Plus } from "lucide-react";

export default function TicketModal({ open, onClose, tickets = [], eventId, promoterCode, minTicketsPerOrder = 1, maxTicketsPerOrder = 10 }) {
  const router = useRouter();
  const [quantities, setQuantities] = useState({});
  const [showDescription, setShowDescription] = useState({});

  const toggleDescription = (id) => {
    setShowDescription(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePurchase = () => {
    const queryParams = new URLSearchParams();
    Object.entries(quantities).forEach(([ticketId, qty]) => {
      if (qty > 0) {
        queryParams.append(`t_${ticketId}`, qty);
      }
    });

    if (queryParams.toString()) {
      if (promoterCode) {
        queryParams.append("ref", promoterCode);
      }
      router.push(`/checkout/${eventId}?${queryParams.toString()}`);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="modal-backdrop items-end sm:items-center p-0 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%", opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0.5 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(event) => event.stopPropagation()}
            className="w-full sm:max-w-md overflow-hidden rounded-t-[40px] sm:rounded-[32px] border-t sm:border border-black/[0.06] dark:border-white/10 bg-white dark:bg-[#0A0A0A] text-black dark:text-white p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.15)] dark:shadow-glow"
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-black/50 dark:text-white/50">Tickets</p>
                <p className="mt-1 text-sm text-black/80 dark:text-white/80">Select quantities and checkout instantly.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex items-center justify-center p-2 -mr-2 text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors"
                id="close-ticket-modal"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 dark:bg-white/5 border border-black/[0.06] dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10">
                  <span className="sr-only">Close</span>
                  <Minus className="w-4 h-4 rotate-45" />
                </div>
              </button>
            </div>

            <div className="space-y-4">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="rounded-[24px] border border-black/[0.06] dark:border-white/10 bg-black/[0.02] dark:bg-white/5 p-5 transition-colors hover:bg-black/[0.04] dark:hover:bg-white/10 overflow-hidden"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-semibold text-black dark:text-white">{ticket.name}</p>
                        {(ticket.name.toLowerCase().includes("couple") || ticket.name.toLowerCase().includes("pair")) && (
                          <span className="rounded-full bg-orange/20 border border-orange/40 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-orange">Couple</span>
                        )}
                        {ticket.description && (
                          <button
                            onClick={() => toggleDescription(ticket.id)}
                            className="p-1 rounded-full hover:bg-white/10 transition-colors"
                            title="Ticket Information"
                          >
                            <Info className={`w-3.5 h-3.5 ${showDescription[ticket.id] ? "text-black dark:text-white" : "text-black/30 dark:text-white/30"}`} />
                          </button>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-black/40 dark:text-white/40">{ticket.quantity} available</p>
                    </div>
                    <p className="text-lg font-bold text-black dark:text-white">₹{ticket.price}</p>
                  </div>

                  <AnimatePresence>
                    {showDescription[ticket.id] && ticket.description && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-3 text-[11px] text-black/60 dark:text-white/60 leading-relaxed border-t border-black/[0.04] dark:border-white/5 pt-3"
                      >
                        {ticket.description}
                      </motion.div>
                    )}
                  </AnimatePresence>

                    <div className="flex items-center rounded-full border border-black/[0.06] dark:border-white/10 bg-black/[0.04] dark:bg-black/40 p-1.5 h-12">
                      <button
                        type="button"
                        onClick={() => {
                          const current = quantities[ticket.id] || 0;
                          if (current > 0) {
                            setQuantities(prev => ({ ...prev, [ticket.id]: current - 1 }));
                          }
                        }}
                        className="flex h-9 w-12 items-center justify-center rounded-full text-black/60 dark:text-white/60 hover:bg-black/10 dark:hover:bg-white/10 hover:text-black dark:hover:text-white transition-colors active:scale-90"
                        disabled={!quantities[ticket.id]}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center text-base font-bold text-black dark:text-white tabular-nums">{quantities[ticket.id] || 0}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const current = quantities[ticket.id] || 0;
                          setQuantities(prev => ({ ...prev, [ticket.id]: current + 1 }));
                        }}
                        className="flex h-9 w-12 items-center justify-center rounded-full text-black/60 dark:text-white/60 hover:bg-black/10 dark:hover:bg-white/10 hover:text-black dark:hover:text-white transition-colors active:scale-90 disabled:opacity-30"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                </div>
              ))}
            </div>

            <div className="mt-6 border-t border-black/[0.06] dark:border-white/10 pt-4 px-2 space-y-2">
            </div>
            <button
              type="button"
              onClick={handlePurchase}
              className="w-full rounded-full bg-white py-4 text-xs font-bold uppercase tracking-[0.3em] text-black transition hover:bg-white/90 active:scale-[0.98] mt-4"
            >
              Purchase Tickets
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
