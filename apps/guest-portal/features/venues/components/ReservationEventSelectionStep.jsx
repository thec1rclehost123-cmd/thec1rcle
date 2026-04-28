"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ChevronRight, Clock } from "lucide-react";
import { formatCurrency } from "./reservationModalUtils";

export function ReservationEventSelectionStep({ eventsOnDate, handleEventSelect }) {
  return (
    <motion.div
      key="event-select"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-3 p-6"
    >
      {eventsOnDate.map((event) => (
        <button
          key={event.id}
          onClick={() => handleEventSelect(event)}
          className="group flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-left transition-all hover:border-[#F44A22]/40 hover:bg-white/[0.04]"
        >
          <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl">
            <Image
              src={event.image || event.poster || "/events/neon-nights.jpg"}
              fill
              className="object-cover"
              alt={event.title || event.name}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-sm font-black uppercase tracking-tight text-white">{event.title || event.name}</h4>
            <div className="mt-1 flex items-center gap-2 text-white/40">
              <Clock className="h-3 w-3" />
              <span className="text-[10px] font-bold">{event.time || event.startTime || "—"}</span>
              {event.host ? (
                <>
                  <span className="text-white/15">•</span>
                  <span className="truncate text-[10px] font-bold">{event.host}</span>
                </>
              ) : null}
            </div>
            {event.priceRange ? (
              <p className="mt-1 text-[10px] font-bold text-[#F44A22]">
                {event.priceRange.min === 0 ? "Free Entry" : `From ${formatCurrency(event.priceRange.min)}`}
              </p>
            ) : null}
          </div>
          <ChevronRight className="h-4 w-4 text-white/20 transition-colors group-hover:text-[#F44A22]" />
        </button>
      ))}
    </motion.div>
  );
}
