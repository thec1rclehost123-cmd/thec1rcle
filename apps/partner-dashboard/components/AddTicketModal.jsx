"use client";

import { useEffect, useState } from "react";
import Input from "./ui/Input";

const initialTicket = { name: "", price: "", quantity: 50 };

export default function AddTicketModal({ open, onClose, onSave }) {
  const [ticket, setTicket] = useState(initialTicket);

  useEffect(() => {
    if (open) {
      setTicket(initialTicket);
    }
  }, [open]);

  if (!open) return null;

  const handleChange = (field) => (event) => {
    setTicket((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!ticket.name || !ticket.price) return;
    onSave({
      name: ticket.name,
      price: Number(ticket.price),
      quantity: Number(ticket.quantity) || 0
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        className="card-hover glass-panel fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-[32px] border border-white/20 bg-black/80 p-6 shadow-glow sm:inset-x-auto"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm uppercase tracking-[0.4em] text-white/50">New Ticket Tier</p>
          <button type="button" onClick={onClose} className="text-sm text-white/60 hover:text-white">
            Close
          </button>
        </div>
        <div className="mt-6 space-y-4">
          <Input label="Ticket Name" placeholder="Sunset VIP" value={ticket.name} onChange={handleChange("name")} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              type="number"
              label="Price (₹)"
              placeholder="2200"
              value={ticket.price}
              onChange={handleChange("price")}
              min="0"
            />
            <Input
              type="number"
              label="Quantity"
              placeholder="50"
              value={ticket.quantity}
              onChange={handleChange("quantity")}
              min="0"
            />
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/70 sm:w-auto"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="w-full rounded-full bg-white px-4 py-2 text-xs uppercase tracking-[0.3em] text-black sm:w-auto"
          >
            Save Ticket
          </button>
        </div>
      </form>
    </div>
  );
}
