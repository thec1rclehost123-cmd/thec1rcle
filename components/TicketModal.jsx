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

  const handleQuantityChange = (ticketId) => (event) => {
    setQuantities((prev) => ({ ...prev, [ticketId]: Number(event.target.value) }));
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="modal-backdrop z-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
            className="ticket-grid card-hover mx-auto mt-32 w-full max-w-lg rounded-[36px] border border-white/15 bg-black/90 p-6 text-white shadow-glow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-white/40">Tickets</p>
                <p className="text-white/80">Select quantities and checkout instantly.</p>
              </div>
              <button type="button" onClick={onClose} className="text-sm text-white/60 hover:text-white">
                Close
              </button>
            </div>
            <div className="mt-6 space-y-4">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="rounded-[24px] border border-white/10 bg-black/60 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-semibold">{ticket.name}</p>
                      <p className="text-xs text-white/50">{ticket.quantity} available</p>
                    </div>
                    <p className="text-xl font-semibold">₹{ticket.price}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 bg-black/40 rounded-2xl border border-white/10 p-1">
                      <button
                        type="button"
                        onClick={() => {
                          const current = quantities[ticket.id] || 0;
                          if (current > 0) {
                            setQuantities(prev => ({ ...prev, [ticket.id]: current - 1 }));
                          }
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                        disabled={!quantities[ticket.id]}
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-medium text-white">{quantities[ticket.id] || 0}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const current = quantities[ticket.id] || 0;
                          if (current < ticket.quantity) {
                            setQuantities(prev => ({ ...prev, [ticket.id]: current + 1 }));
                          }
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                        disabled={(quantities[ticket.id] || 0) >= ticket.quantity}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-black/60 px-4 py-3">
              <p className="text-sm text-white/60">Total</p>
              <p className="text-2xl font-semibold text-white">₹{total}</p>
            </div>
            <button
              type="button"
              onClick={handlePurchase}
              className="mt-6 w-full rounded-full bg-white px-4 py-3 text-xs uppercase tracking-[0.35em] text-black transition hover:bg-white/90"
            >
              Purchase Tickets
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
