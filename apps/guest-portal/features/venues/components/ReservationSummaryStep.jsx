"use client";

import { motion } from "framer-motion";
import { Loader2, PartyPopper, Users, UtensilsCrossed } from "lucide-react";
import { formatCurrency } from "./reservationModalUtils";

const EVENT_GUEST_OPTIONS = [1, 2, 3, 4, 5, 6];

export function ReservationSummaryStep({
  bookingType,
  guests,
  handleSubmit,
  loading,
  name,
  phone,
  selectedDate,
  selectedEvent,
  selectedTable,
  selectedTier,
  selectedTime,
  setGuests,
  setName,
  setPhone,
  submitError,
  venueName,
}) {
  return (
    <motion.div
      key="summary"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6 p-6"
    >
      <div className="space-y-4 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-5">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bookingType === "event" ? "bg-[#F44A22]/10" : "bg-emerald-500/10"}`}>
            {bookingType === "event" ? (
              <PartyPopper className="h-5 w-5 text-[#F44A22]" />
            ) : (
              <UtensilsCrossed className="h-5 w-5 text-emerald-400" />
            )}
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/30">
              {bookingType === "event" ? "Event Night" : "Restaurant"} Booking
            </p>
            <p className="text-sm font-black text-white">{venueName}</p>
          </div>
        </div>

        <div className="h-px bg-white/5" />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/20">Date</p>
            <p className="mt-0.5 text-sm font-bold text-white">
              {selectedDate?.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" })}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/20">Time</p>
            <p className="mt-0.5 text-sm font-bold text-white">{selectedTime || selectedEvent?.time || selectedEvent?.startTime || "—"}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/20">Guests</p>
            <p className="mt-0.5 text-sm font-bold text-white">{guests}</p>
          </div>
          {bookingType === "event" && selectedEvent ? (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/20">Event</p>
              <p className="mt-0.5 truncate text-sm font-bold text-white">{selectedEvent.title || selectedEvent.name}</p>
            </div>
          ) : null}
        </div>

        {selectedTable ? (
          <>
            <div className="h-px bg-white/5" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/20">Table</p>
                <p className="text-sm font-bold text-white">{selectedTable.name}</p>
              </div>
              <p className="text-lg font-black text-white">{formatCurrency(selectedTable.price)}</p>
            </div>
          </>
        ) : null}

        {selectedTier && !selectedTable ? (
          <>
            <div className="h-px bg-white/5" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/20">Entry / Cover</p>
                <p className="text-sm font-bold text-white">
                  {selectedTier.name} × {guests}
                </p>
              </div>
              <p className="text-lg font-black text-white">
                {selectedTier.price > 0 ? `${formatCurrency(selectedTier.price)} / guest` : "Free"}
              </p>
            </div>
          </>
        ) : null}
      </div>

      {bookingType === "event" && !name ? (
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#F44A22]/50"
          />
          <input
            type="tel"
            placeholder="+91 Phone Number"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#F44A22]/50"
          />
        </div>
      ) : null}

      {bookingType === "event" && selectedTier && !selectedTable ? (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
            <Users className="h-3 w-3" /> Guests
          </label>
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-1.5">
            {EVENT_GUEST_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => setGuests(option)}
                className={`flex-1 rounded-xl py-3 text-sm font-black transition-all ${
                  guests === option ? "bg-[#F44A22] text-white shadow-lg" : "text-white/40 hover:text-white"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {submitError ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-center text-xs font-bold text-red-400">{submitError}</p>
        </div>
      ) : null}

      <button
        onClick={handleSubmit}
        disabled={loading || (!name && bookingType === "event")}
        className={`flex w-full items-center justify-center gap-2 rounded-2xl py-5 text-xs font-black uppercase tracking-widest transition-all disabled:opacity-30 ${
          bookingType === "event"
            ? "bg-[#F44A22] text-white shadow-lg shadow-[#F44A22]/30 hover:brightness-110"
            : "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600"
        }`}
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Submit Reservation Request</>}
      </button>

      <p className="text-center text-[9px] font-medium text-white/20">
        You&apos;ll receive confirmation from {venueName} shortly after review.
      </p>
    </motion.div>
  );
}
