"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

export default function TicketModal({ open, onClose, tickets = [], eventId }) {
  const router = useRouter();
  const [quantities, setQuantities] = useState({});

  const handlePurchase = () => {
    const queryParams = new URLSearchParams();
    Object.entries(quantities).forEach(([ticketId, qty]) => {
      if (qty > 0) {
        queryParams.append(`t_${ticketId}`, qty);
      }
    });

    if (queryParams.toString()) {
      router.push(`/checkout/${eventId}?${queryParams.toString()}`);
    }
  };

  const total = useMemo(() => {
    return tickets.reduce((sum, ticket) => {
      const qty = Number(quantities[ticket.id] || 0);
      return sum + qty * Number(ticket.price || 0);
    }, 0);
  }, [tickets, quantities]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="modal-backdrop items-start pt-20 sm:pt-24"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-[32px] border border-white/10 bg-black p-6 shadow-2xl shadow-glow"
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
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="rounded-[24px] border border-white/10 bg-white/5 p-5 transition-colors hover:bg-white/10"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-base font-semibold text-white">{ticket.name}</p>
                      <p className="mt-0.5 text-xs text-white/40">{ticket.quantity} available</p>
                    </div>
                    <p className="text-lg font-bold text-white">₹{ticket.price}</p>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex items-center rounded-full border border-white/10 bg-black/40 p-1">
                      <button
                        type="button"
                        onClick={() => {
                          const current = quantities[ticket.id] || 0;
                          if (current > 0) {
                            setQuantities(prev => ({ ...prev, [ticket.id]: current - 1 }));
                          }
                        }}
                        className="flex h-8 w-10 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                        disabled={!quantities[ticket.id]}
                      >
                        -
                      </button>
                      <span className="w-8 text-center text-sm font-medium text-white">{quantities[ticket.id] || 0}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const current = quantities[ticket.id] || 0;
                          if (current < ticket.quantity) {
                            setQuantities(prev => ({ ...prev, [ticket.id]: current + 1 }));
                          }
                        }}
                        className="flex h-8 w-10 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                        disabled={(quantities[ticket.id] || 0) >= ticket.quantity}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 border-t border-white/10 pt-4">
              <div className="flex items-center justify-between px-2 mb-4">
                <p className="text-sm text-white/60">Total</p>
                <p className="text-2xl font-bold text-white">₹{total}</p>
              </div>
              <button
                type="button"
                onClick={handlePurchase}
                className="w-full rounded-full bg-white py-4 text-xs font-bold uppercase tracking-[0.3em] text-black transition hover:bg-white/90 active:scale-[0.98]"
              >
                Purchase Tickets
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
