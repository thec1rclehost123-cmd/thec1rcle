"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { DAYS, MONTHS, isPast, isSameDay, isToday } from "./reservationModalUtils";

export function ReservationCalendarStep({
  calendarDays,
  currentMonth,
  getEventsForDay,
  handleDateSelect,
  selectedDate,
  setCurrentMonth,
}) {
  return (
    <motion.div
      key="calendar"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="p-6"
    >
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 transition-colors hover:bg-white/10"
        >
          <ChevronLeft className="h-4 w-4 text-white/60" />
        </button>
        <h3 className="text-sm font-black uppercase tracking-widest text-white">
          {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        <button
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 transition-colors hover:bg-white/10"
        >
          <ChevronRight className="h-4 w-4 text-white/60" />
        </button>
      </div>

      <div className="overflow-x-auto scrollbar-hide">
        <div style={{ minWidth: 280 }}>
          <div className="mb-2 grid grid-cols-7 gap-1">
            {DAYS.map((day) => (
              <div key={day} className="py-2 text-center text-[9px] font-bold uppercase tracking-widest text-white/30">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((date, index) => {
              if (!date) return <div key={`empty-${index}`} />;

              const dayEvents = getEventsForDay(date);
              const hasEvents = dayEvents.length > 0;
              const past = isPast(date);
              const today = isToday(date);
              const selected = isSameDay(date, selectedDate);

              return (
                <button
                  key={date.toISOString()}
                  onClick={() => !past && handleDateSelect(date)}
                  disabled={past}
                  className={`
                    relative aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 text-sm font-bold transition-all
                    ${past ? "cursor-not-allowed text-white/15" : "cursor-pointer hover:bg-white/10"}
                    ${today ? "ring-1 ring-[#F44A22]/50" : ""}
                    ${selected ? "bg-[#F44A22] text-white ring-0" : ""}
                    ${hasEvents && !selected && !past ? "text-white" : ""}
                    ${!hasEvents && !selected && !past ? "text-white/50" : ""}
                  `}
                >
                  <span>{date.getDate()}</span>

                  {hasEvents ? (
                    <div className="flex items-center gap-0.5">
                      {dayEvents.slice(0, 3).map((_, eventIndex) => (
                        <div
                          key={eventIndex}
                          className={`h-1 w-1 rounded-full ${selected ? "bg-white" : "bg-[#F44A22]"}`}
                        />
                      ))}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-center gap-6 border-t border-white/5 pt-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[#F44A22]" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">Event Night</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-white/20 ring-1 ring-[#F44A22]/50" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">Today</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-white/20" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">Open</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
