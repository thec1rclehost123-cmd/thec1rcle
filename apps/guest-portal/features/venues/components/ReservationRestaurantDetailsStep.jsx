"use client";

import { motion } from "framer-motion";
import { ChevronRight, Clock, Users } from "lucide-react";

const RESTAURANT_GUEST_OPTIONS = [1, 2, 4, 6, 8, 10];
const RESTAURANT_TIME_OPTIONS = ["12:00", "13:00", "14:00", "18:00", "19:00", "20:00", "21:00", "22:00"];

export function ReservationRestaurantDetailsStep({
  guests,
  name,
  phone,
  selectedTime,
  setGuests,
  setName,
  setPhone,
  setSelectedTime,
  setSpecialRequests,
  setStep,
  specialRequests,
  summaryStep,
}) {
  return (
    <motion.div
      key="restaurant"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6 p-6"
    >
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
          <Users className="h-3 w-3" /> Number of Guests
        </label>
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-1.5">
          {RESTAURANT_GUEST_OPTIONS.map((option) => (
            <button
              key={option}
              onClick={() => setGuests(option)}
              className={`flex-1 rounded-xl py-3 text-sm font-black transition-all ${
                guests === option ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
          <Clock className="h-3 w-3" /> Preferred Time
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RESTAURANT_TIME_OPTIONS.map((option) => (
            <button
              key={option}
              onClick={() => setSelectedTime(option)}
              className={`rounded-xl border py-3 text-xs font-bold transition-all ${
                selectedTime === option
                  ? "border-emerald-400 bg-emerald-500 text-white"
                  : "border-white/10 bg-white/5 text-white/50 hover:border-white/20"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Your Name</label>
        <input
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white placeholder:text-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        />
      </div>

      <div className="space-y-3">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Phone Number</label>
        <input
          type="tel"
          placeholder="+91 98765 43210"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white placeholder:text-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        />
      </div>

      <div className="space-y-3">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Special Requests (Optional)</label>
        <textarea
          placeholder="Birthday, dietary requirements, seating preference..."
          value={specialRequests}
          onChange={(event) => setSpecialRequests(event.target.value)}
          rows={3}
          className="w-full resize-none rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white placeholder:text-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        />
      </div>

      <button
        onClick={() => setStep(summaryStep)}
        disabled={!selectedTime || !name || !phone}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-30"
      >
        Review Booking <ChevronRight className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
