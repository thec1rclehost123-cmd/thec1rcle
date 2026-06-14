"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Calendar, CheckCircle2, Users } from "lucide-react";

export function ReservationConfirmedStep({
  guests,
  resetAndClose,
  selectedDate,
  selectedEvent,
  venueName,
}) {
  return (
    <motion.div
      key="confirmed"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6 p-6 py-12 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", damping: 15, delay: 0.2 }}
        className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/20"
      >
        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
      </motion.div>

      <div className="space-y-2">
        <h3 className="text-2xl font-black uppercase tracking-tight text-white">Request Sent!</h3>
        <p className="mx-auto max-w-[300px] text-sm leading-relaxed text-white/40">
          {`Your request has been sent to ${venueName}. You'll receive confirmation via SMS shortly.`}
        </p>
      </div>

      <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3">
        <Calendar className="h-4 w-4 text-white/40" />
        <span className="text-xs font-bold text-white/60">
          {selectedDate?.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" })}
        </span>
        <span className="text-white/15">•</span>
        <Users className="h-4 w-4 text-white/40" />
        <span className="text-xs font-bold text-white/60">{guests} guests</span>
      </div>

      <div className="flex flex-col gap-3 pt-4">
        {selectedEvent ? (
          <Link
            href={`/event/${selectedEvent.id}`}
            className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 text-[10px] font-black uppercase tracking-widest text-white/60 transition-all hover:bg-white/10"
          >
            View Event Details
          </Link>
        ) : null}
        <button
          onClick={resetAndClose}
          className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 text-[10px] font-black uppercase tracking-widest text-white/60 transition-all hover:bg-white/10"
        >
          Done
        </button>
      </div>
    </motion.div>
  );
}
