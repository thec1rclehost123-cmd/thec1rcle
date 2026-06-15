'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { ChevronRight, PartyPopper, UtensilsCrossed } from 'lucide-react';
import { VENUE_RESERVATION_STEPS } from '../hooks/useVenueReservationFlow';

export function ReservationBookingTypeStep({
  eventsOnDate,
  handleEventSelect,
  setBookingType,
  setStep,
}) {
  return (
    <motion.div
      key="choose-type"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4 p-6"
    >
      {eventsOnDate.length > 0 ? (
        <button
          onClick={() => {
            setBookingType('event');
            if (eventsOnDate.length === 1) {
              handleEventSelect(eventsOnDate[0]);
            } else {
              setStep(VENUE_RESERVATION_STEPS.EVENT_SELECT);
            }
          }}
          className="group relative w-full overflow-hidden rounded-3xl border border-white/10 text-left transition-all hover:border-[#F44A22]/40"
        >
          <div className="relative h-44 w-full">
            <Image
              src={eventsOnDate[0]?.image || eventsOnDate[0]?.poster || '/events/neon-nights.jpg'}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-110"
              alt="Event Night"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

            <div className="absolute left-4 top-4">
              <div className="flex items-center gap-2 rounded-full bg-[#F44A22] px-3 py-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest text-white">
                  {eventsOnDate.length} Event{eventsOnDate.length > 1 ? 's' : ''} Tonight
                </span>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-xl">
                  <PartyPopper className="h-6 w-6 text-[#F44A22]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-black uppercase tracking-tight text-white">
                    Event Night
                  </h3>
                  <p className="text-[10px] font-bold text-white/50">
                    Tables, Cover & Entry Passes
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-white/40 transition-all group-hover:translate-x-1 group-hover:text-[#F44A22]" />
              </div>
            </div>
          </div>
        </button>
      ) : null}

      <button
        onClick={() => {
          setBookingType('restaurant');
          setStep(VENUE_RESERVATION_STEPS.RESTAURANT_DETAILS);
        }}
        className="group w-full rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/5 to-transparent p-6 text-left transition-all hover:border-emerald-500/40"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10">
            <UtensilsCrossed className="h-7 w-7 text-emerald-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-black uppercase tracking-tight text-white">
              Restaurant Table
            </h3>
            <p className="mt-0.5 text-[10px] font-bold text-white/40">
              Dining, Drinks & Regular Hours
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-white/30 transition-all group-hover:translate-x-1 group-hover:text-emerald-400" />
        </div>
      </button>

      {eventsOnDate.length === 0 ? (
        <div className="py-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/20">
            No events scheduled — Restaurant booking available
          </p>
        </div>
      ) : null}
    </motion.div>
  );
}
