"use client";

import { useState, useMemo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  X,
  Calendar,
  Clock,
  Users,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Loader2,
  Sparkles,
  Music,
  UtensilsCrossed,
  Crown,
  Wine,
  Armchair,
  MapPin,
  Ticket,
  ArrowLeft,
  PartyPopper,
  Star,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Helpers ──────────────────────────────────────────────────

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const isSameDay = (d1, d2) => {
  if (!d1 || !d2) return false;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

const isToday = (date) => isSameDay(date, new Date());

const isPast = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

const formatCurrency = (amount) => {
  if (!amount || amount === 0) return "Free";
  return `₹${Number(amount).toLocaleString("en-IN")}`;
};

const TABLE_TYPE_CONFIG = {
  standard: { icon: Armchair, color: "#86868b", label: "Standard" },
  premium: { icon: Crown, color: "#F44A22", label: "Premium" },
  vvip: { icon: Star, color: "#FFD700", label: "VVIP" },
  booth: { icon: Wine, color: "#8B5CF6", label: "Booth" },
  cabana: { icon: Sparkles, color: "#06B6D4", label: "Cabana" },
};

// ─── Steps ────────────────────────────────────────────────────

const STEPS = {
  CALENDAR: "calendar",
  CHOOSE_TYPE: "choose_type",
  EVENT_SELECT: "event_select",
  TABLE_SELECT: "table_select",
  RESTAURANT_DETAILS: "restaurant_details",
  SUMMARY: "summary",
  CONFIRMED: "confirmed",
};

// ─── Main Component ───────────────────────────────────────────

export default function ReservationCalendarModal({ venue, upcomingEvents = [], isOpen, onClose }) {
  // State
  const [step, setStep] = useState(STEPS.CALENDAR);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [bookingType, setBookingType] = useState(null); // "event" | "restaurant"
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedTier, setSelectedTier] = useState(null);
  const [guests, setGuests] = useState(2);
  const [selectedTime, setSelectedTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Compute events by date
  const eventsByDate = useMemo(() => {
    const map = {};
    upcomingEvents.forEach((event) => {
      const d = new Date(event.startDate || event.startAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map[key]) map[key] = [];
      map[key].push(event);
    });
    return map;
  }, [upcomingEvents]);

  // Events on selected date
  const eventsOnDate = useMemo(() => {
    if (!selectedDate) return [];
    const key = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`;
    return eventsByDate[key] || [];
  }, [selectedDate, eventsByDate]);

  // Calendar grid generation
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(year, month, d));
    }

    return days;
  }, [currentMonth]);

  const getEventsForDay = useCallback(
    (date) => {
      if (!date) return [];
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      return eventsByDate[key] || [];
    },
    [eventsByDate],
  );

  // Navigation
  const goBack = () => {
    switch (step) {
      case STEPS.CHOOSE_TYPE:
        setStep(STEPS.CALENDAR);
        break;
      case STEPS.EVENT_SELECT:
        setStep(STEPS.CHOOSE_TYPE);
        break;
      case STEPS.TABLE_SELECT:
        setStep(STEPS.EVENT_SELECT);
        break;
      case STEPS.RESTAURANT_DETAILS:
        setStep(STEPS.CHOOSE_TYPE);
        break;
      case STEPS.SUMMARY:
        setStep(bookingType === "event" ? STEPS.TABLE_SELECT : STEPS.RESTAURANT_DETAILS);
        break;
      default:
        onClose();
    }
  };

  const handleDateSelect = (date) => {
    if (isPast(date)) return;
    setSelectedDate(date);
    setStep(STEPS.CHOOSE_TYPE);
  };

  const handleEventSelect = (event) => {
    setSelectedEvent(event);
    if (event.tables?.length > 0) {
      setStep(STEPS.TABLE_SELECT);
    } else {
      setSelectedTier(event.tickets?.[0] || null);
      setStep(STEPS.SUMMARY);
    }
  };

  const handleTableSelect = (table) => {
    setSelectedTable(table);
    setGuests(table.capacity || 4);
    setStep(STEPS.SUMMARY);
  };

  const handleTierSelect = (tier) => {
    setSelectedTier(tier);
    setStep(STEPS.SUMMARY);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setSubmitError(null);
    try {
      // POST to reservation API
      const payload = {
        venueId: venue.id,
        venueName: venue.name,
        date: selectedDate?.toISOString(),
        time: selectedTime || selectedEvent?.startTime || "",
        guests,
        bookingType,
        guestName: name,
        guestPhone: phone,
        specialRequests,
        ...(bookingType === "event" && {
          eventId: selectedEvent?.id,
          eventTitle: selectedEvent?.title || selectedEvent?.name,
          tableId: selectedTable?.id,
          tableName: selectedTable?.name,
          tablePrice: selectedTable?.price,
          tierId: selectedTier?.id,
          tierName: selectedTier?.name,
          tierPrice: selectedTier?.price,
        }),
      };

      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Reservation failed");
      }

      setStep(STEPS.CONFIRMED);
    } catch (err) {
      console.error("Reservation error:", err);
      setSubmitError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetAndClose = () => {
    setStep(STEPS.CALENDAR);
    setSelectedDate(null);
    setBookingType(null);
    setSelectedEvent(null);
    setSelectedTable(null);
    setSelectedTier(null);
    setGuests(2);
    setSelectedTime("");
    setName("");
    setPhone("");
    setSpecialRequests("");
    onClose();
  };

  // Computed price
  const totalPrice = useMemo(() => {
    if (bookingType === "event") {
      const tablePrice = selectedTable?.price || 0;
      const tierPrice = selectedTier?.price || 0;
      const coverPerPerson = tierPrice;
      return tablePrice + (selectedTable ? 0 : coverPerPerson * guests);
    }
    return 0; // Restaurant reservations are free to request
  }, [bookingType, selectedTable, selectedTier, guests]);

  if (!isOpen) return null;

  // Step title
  const stepTitle = {
    [STEPS.CALENDAR]: "Select Date",
    [STEPS.CHOOSE_TYPE]: selectedDate?.toLocaleDateString("en-IN", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
    [STEPS.EVENT_SELECT]: "Choose Event",
    [STEPS.TABLE_SELECT]: selectedEvent?.title || "Select Package",
    [STEPS.RESTAURANT_DETAILS]: "Restaurant Booking",
    [STEPS.SUMMARY]: "Confirm Reservation",
    [STEPS.CONFIRMED]: "Confirmed!",
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={resetAndClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-xl"
      />

      {/* Modal */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 400 }}
        className="relative w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
      >
        {/* Drag Handle (Mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-6 pt-4 pb-4 border-b border-white/5 flex items-center gap-4">
          {step !== STEPS.CALENDAR && step !== STEPS.CONFIRMED && (
            <button
              onClick={goBack}
              className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <ArrowLeft className="h-4 w-4 text-white/60" />
            </button>
          )}
          <div className="flex-1">
            <h2 className="text-lg font-black uppercase tracking-tight text-white">
              {stepTitle[step]}
            </h2>
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mt-0.5">
              {venue.name}
            </p>
          </div>
          <button
            onClick={resetAndClose}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4 text-white/60" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <AnimatePresence mode="wait">
            {/* ─── STEP 1: CALENDAR ──────────────────── */}
            {step === STEPS.CALENDAR && (
              <motion.div
                key="calendar"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-6"
              >
                {/* Month Navigation */}
                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={() =>
                      setCurrentMonth(
                        new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1),
                      )
                    }
                    className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4 text-white/60" />
                  </button>
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">
                    {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                  </h3>
                  <button
                    onClick={() =>
                      setCurrentMonth(
                        new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1),
                      )
                    }
                    className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                  >
                    <ChevronRight className="h-4 w-4 text-white/60" />
                  </button>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {DAYS.map((day) => (
                    <div
                      key={day}
                      className="text-center text-[9px] font-bold text-white/30 uppercase tracking-widest py-2"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((date, idx) => {
                    if (!date) return <div key={`empty-${idx}`} />;

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
                                                    relative aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all text-sm font-bold
                                                    ${past ? "text-white/15 cursor-not-allowed" : "hover:bg-white/10 cursor-pointer"}
                                                    ${today ? "ring-1 ring-[#F44A22]/50" : ""}
                                                    ${selected ? "bg-[#F44A22] text-white ring-0" : ""}
                                                    ${hasEvents && !selected && !past ? "text-white" : ""}
                                                    ${!hasEvents && !selected && !past ? "text-white/50" : ""}
                                                `}
                      >
                        <span>{date.getDate()}</span>

                        {/* Event Indicator Dots */}
                        {hasEvents && (
                          <div className="flex items-center gap-0.5">
                            {dayEvents.slice(0, 3).map((_, i) => (
                              <div
                                key={i}
                                className={`w-1 h-1 rounded-full ${
                                  selected ? "bg-white" : "bg-[#F44A22]"
                                }`}
                              />
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#F44A22]" />
                    <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">
                      Event Night
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-white/20 ring-1 ring-[#F44A22]/50" />
                    <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">
                      Today
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-white/20" />
                    <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">
                      Open
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ─── STEP 2: CHOOSE BOOKING TYPE ────────── */}
            {step === STEPS.CHOOSE_TYPE && (
              <motion.div
                key="choose-type"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-6 space-y-4"
              >
                {/* Events on this date */}
                {eventsOnDate.length > 0 && (
                  <button
                    onClick={() => {
                      setBookingType("event");
                      if (eventsOnDate.length === 1) {
                        handleEventSelect(eventsOnDate[0]);
                      } else {
                        setStep(STEPS.EVENT_SELECT);
                      }
                    }}
                    className="group w-full text-left relative rounded-3xl overflow-hidden border border-white/10 hover:border-[#F44A22]/40 transition-all"
                  >
                    {/* Event poster background */}
                    <div className="relative h-44 w-full">
                      <Image
                        src={
                          eventsOnDate[0]?.image ||
                          eventsOnDate[0]?.poster ||
                          "/events/neon-nights.jpg"
                        }
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                        alt="Event Night"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

                      {/* Badge */}
                      <div className="absolute top-4 left-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F44A22] rounded-full">
                          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                          <span className="text-[9px] font-black uppercase tracking-widest text-white">
                            {eventsOnDate.length} Event{eventsOnDate.length > 1 ? "s" : ""} Tonight
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="absolute bottom-0 left-0 right-0 p-5">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xl flex items-center justify-center">
                            <PartyPopper className="h-6 w-6 text-[#F44A22]" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-base font-black text-white uppercase tracking-tight">
                              Event Night
                            </h3>
                            <p className="text-[10px] text-white/50 font-bold">
                              Tables, Cover & Entry Passes
                            </p>
                          </div>
                          <ChevronRight className="h-5 w-5 text-white/40 group-hover:text-[#F44A22] group-hover:translate-x-1 transition-all" />
                        </div>
                      </div>
                    </div>
                  </button>
                )}

                {/* Restaurant / Regular Table */}
                <button
                  onClick={() => {
                    setBookingType("restaurant");
                    setStep(STEPS.RESTAURANT_DETAILS);
                  }}
                  className="group w-full text-left p-6 rounded-3xl border border-white/10 hover:border-emerald-500/40 bg-gradient-to-br from-emerald-500/5 to-transparent transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                      <UtensilsCrossed className="h-7 w-7 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-black text-white uppercase tracking-tight">
                        Restaurant Table
                      </h3>
                      <p className="text-[10px] text-white/40 font-bold mt-0.5">
                        Dining, Drinks & Regular Hours
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-white/30 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                  </div>
                </button>

                {/* No events indicator */}
                {eventsOnDate.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                      No events scheduled — Restaurant booking available
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ─── STEP 3: EVENT SELECT (multiple events) ─ */}
            {step === STEPS.EVENT_SELECT && (
              <motion.div
                key="event-select"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-6 space-y-3"
              >
                {eventsOnDate.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => handleEventSelect(event)}
                    className="group w-full text-left flex items-center gap-4 p-4 rounded-2xl border border-white/10 hover:border-[#F44A22]/40 bg-white/[0.02] hover:bg-white/[0.04] transition-all"
                  >
                    {/* Event poster thumbnail */}
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                      <Image
                        src={event.image || event.poster || "/events/neon-nights.jpg"}
                        fill
                        className="object-cover"
                        alt={event.title || event.name}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-black text-white uppercase tracking-tight truncate">
                        {event.title || event.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 text-white/40">
                        <Clock className="h-3 w-3" />
                        <span className="text-[10px] font-bold">
                          {event.time || event.startTime || "—"}
                        </span>
                        {event.host && (
                          <>
                            <span className="text-white/15">•</span>
                            <span className="text-[10px] font-bold truncate">{event.host}</span>
                          </>
                        )}
                      </div>
                      {/* Price hint */}
                      {event.priceRange && (
                        <p className="text-[10px] font-bold text-[#F44A22] mt-1">
                          {event.priceRange.min === 0
                            ? "Free Entry"
                            : `From ${formatCurrency(event.priceRange.min)}`}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-[#F44A22] transition-colors" />
                  </button>
                ))}
              </motion.div>
            )}

            {/* ─── STEP 4: TABLE / TIER SELECT (Event) ── */}
            {step === STEPS.TABLE_SELECT && selectedEvent && (
              <motion.div
                key="table-select"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-6 space-y-6"
              >
                {/* Event Summary Mini */}
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
                    <Image
                      src={selectedEvent.image || selectedEvent.poster || "/events/neon-nights.jpg"}
                      fill
                      className="object-cover"
                      alt={selectedEvent.title || selectedEvent.name}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-black text-white uppercase tracking-tight">
                      {selectedEvent.title || selectedEvent.name}
                    </p>
                    <p className="text-[10px] text-white/30 font-bold">
                      {selectedEvent.time || selectedEvent.startTime}
                    </p>
                  </div>
                </div>

                {/* Tables */}
                {selectedEvent.tables?.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">
                      Table Packages
                    </h4>
                    {selectedEvent.tables.map((table) => {
                      const config =
                        TABLE_TYPE_CONFIG[table.tableType] || TABLE_TYPE_CONFIG.standard;
                      const TableIcon = config.icon;
                      return (
                        <button
                          key={table.id}
                          onClick={() => handleTableSelect(table)}
                          className="group w-full text-left p-4 rounded-2xl border border-white/10 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.04] transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className="w-12 h-12 rounded-xl flex items-center justify-center"
                              style={{ backgroundColor: `${config.color}15` }}
                            >
                              <TableIcon className="h-5 w-5" style={{ color: config.color }} />
                            </div>
                            <div className="flex-1">
                              <h5 className="text-sm font-black text-white">{table.name}</h5>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Users className="h-3 w-3 text-white/30" />
                                <span className="text-[10px] text-white/40 font-bold">
                                  Up to {table.capacity} guests
                                </span>
                              </div>
                              {table.includes?.length > 0 && (
                                <p className="text-[9px] text-white/25 font-medium mt-1 line-clamp-1">
                                  Includes: {table.includes.join(", ")}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-black text-white">
                                {formatCurrency(table.price)}
                              </p>
                              {table.minimumSpend > 0 && (
                                <p className="text-[9px] text-white/30 font-bold">
                                  Min spend {formatCurrency(table.minimumSpend)}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Entry / Cover Tiers (tickets as cover) */}
                {selectedEvent.tickets?.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">
                      Entry / Cover
                    </h4>
                    {selectedEvent.tickets.map((tier) => (
                      <button
                        key={tier.id}
                        onClick={() => handleTierSelect(tier)}
                        className="group w-full text-left p-4 rounded-2xl border border-white/10 hover:border-[#F44A22]/30 bg-white/[0.02] hover:bg-white/[0.04] transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-[#F44A22]/10 flex items-center justify-center">
                            <Ticket className="h-5 w-5 text-[#F44A22]" />
                          </div>
                          <div className="flex-1">
                            <h5 className="text-sm font-black text-white">{tier.name}</h5>
                            {tier.description && (
                              <p className="text-[10px] text-white/30 font-medium mt-0.5">
                                {tier.description}
                              </p>
                            )}
                            {tier.genderRequirement && tier.genderRequirement !== "any" && (
                              <span className="inline-block mt-1 text-[9px] font-bold text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded-full uppercase tracking-widest">
                                {tier.genderRequirement === "couple"
                                  ? "Couple Entry"
                                  : `${tier.genderRequirement} Only`}
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-black text-white">
                              {formatCurrency(tier.price)}
                            </p>
                            <p className="text-[9px] text-white/30 font-bold">per person</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* ─── STEP 5: RESTAURANT DETAILS ─────────── */}
            {step === STEPS.RESTAURANT_DETAILS && (
              <motion.div
                key="restaurant"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-6 space-y-6"
              >
                {/* Guest Count */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Users className="h-3 w-3" /> Number of Guests
                  </label>
                  <div className="flex items-center gap-2 p-1.5 bg-white/5 rounded-2xl border border-white/10">
                    {[1, 2, 4, 6, 8, 10].map((n) => (
                      <button
                        key={n}
                        onClick={() => setGuests(n)}
                        className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${
                          guests === n
                            ? "bg-white text-black shadow-lg"
                            : "text-white/40 hover:text-white"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time Picker */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Clock className="h-3 w-3" /> Preferred Time
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {["12:00", "13:00", "14:00", "18:00", "19:00", "20:00", "21:00", "22:00"].map(
                      (t) => (
                        <button
                          key={t}
                          onClick={() => setSelectedTime(t)}
                          className={`py-3 rounded-xl border text-xs font-bold transition-all ${
                            selectedTime === t
                              ? "bg-emerald-500 border-emerald-400 text-white"
                              : "bg-white/5 border-white/10 text-white/50 hover:border-white/20"
                          }`}
                        >
                          {t}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                {/* Name */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">
                    Your Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                </div>

                {/* Special Requests */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">
                    Special Requests (Optional)
                  </label>
                  <textarea
                    placeholder="Birthday, dietary requirements, seating preference..."
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all resize-none"
                  />
                </div>

                {/* Submit */}
                <button
                  onClick={() => setStep(STEPS.SUMMARY)}
                  disabled={!selectedTime || !name || !phone}
                  className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
                >
                  Review Booking <ChevronRight className="h-4 w-4" />
                </button>
              </motion.div>
            )}

            {/* ─── STEP 6: SUMMARY ────────────────────── */}
            {step === STEPS.SUMMARY && (
              <motion.div
                key="summary"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-6 space-y-6"
              >
                {/* Booking Summary Card */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 space-y-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${bookingType === "event" ? "bg-[#F44A22]/10" : "bg-emerald-500/10"}`}
                    >
                      {bookingType === "event" ? (
                        <PartyPopper className="h-5 w-5 text-[#F44A22]" />
                      ) : (
                        <UtensilsCrossed className="h-5 w-5 text-emerald-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest">
                        {bookingType === "event" ? "Event Night" : "Restaurant"} Booking
                      </p>
                      <p className="text-sm font-black text-white">{venue.name}</p>
                    </div>
                  </div>

                  <div className="h-px bg-white/5" />

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">
                        Date
                      </p>
                      <p className="text-sm font-bold text-white mt-0.5">
                        {selectedDate?.toLocaleDateString("en-IN", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">
                        Time
                      </p>
                      <p className="text-sm font-bold text-white mt-0.5">
                        {selectedTime || selectedEvent?.time || selectedEvent?.startTime || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">
                        Guests
                      </p>
                      <p className="text-sm font-bold text-white mt-0.5">{guests}</p>
                    </div>
                    {bookingType === "event" && selectedEvent && (
                      <div>
                        <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">
                          Event
                        </p>
                        <p className="text-sm font-bold text-white mt-0.5 truncate">
                          {selectedEvent.title || selectedEvent.name}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Table/Tier selection summary */}
                  {selectedTable && (
                    <>
                      <div className="h-px bg-white/5" />
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">
                            Table
                          </p>
                          <p className="text-sm font-bold text-white">{selectedTable.name}</p>
                        </div>
                        <p className="text-lg font-black text-white">
                          {formatCurrency(selectedTable.price)}
                        </p>
                      </div>
                    </>
                  )}

                  {selectedTier && !selectedTable && (
                    <>
                      <div className="h-px bg-white/5" />
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">
                            Entry / Cover
                          </p>
                          <p className="text-sm font-bold text-white">
                            {selectedTier.name} × {guests}
                          </p>
                        </div>
                        <p className="text-lg font-black text-white">
                          {formatCurrency(selectedTier.price * guests)}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Guest Details (if not filled yet) */}
                {bookingType === "event" && !name && (
                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#F44A22]/50"
                    />
                    <input
                      type="tel"
                      placeholder="+91 Phone Number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#F44A22]/50"
                    />
                  </div>
                )}

                {/* Guest Count Adjuster (for event cover) */}
                {bookingType === "event" && selectedTier && !selectedTable && (
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] flex items-center gap-2">
                      <Users className="h-3 w-3" /> Guests
                    </label>
                    <div className="flex items-center gap-2 p-1.5 bg-white/5 rounded-2xl border border-white/10">
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <button
                          key={n}
                          onClick={() => setGuests(n)}
                          className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${
                            guests === n
                              ? "bg-[#F44A22] text-white shadow-lg"
                              : "text-white/40 hover:text-white"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Total */}
                {totalPrice > 0 && (
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-[#F44A22]/5 border border-[#F44A22]/10">
                    <p className="text-[10px] font-black text-[#F44A22] uppercase tracking-widest">
                      Total
                    </p>
                    <p className="text-2xl font-black text-white">{formatCurrency(totalPrice)}</p>
                  </div>
                )}

                {/* Error Message */}
                {submitError && (
                  <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
                    <p className="text-xs font-bold text-red-400 text-center">{submitError}</p>
                  </div>
                )}

                {/* Action Button */}
                <button
                  onClick={handleSubmit}
                  disabled={loading || (!name && bookingType === "event")}
                  className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-30 shadow-lg ${
                    bookingType === "event"
                      ? "bg-[#F44A22] text-white shadow-[#F44A22]/30 hover:brightness-110"
                      : "bg-emerald-500 text-white shadow-emerald-500/20 hover:bg-emerald-600"
                  }`}
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : totalPrice > 0 ? (
                    <>Pay {formatCurrency(totalPrice)} & Reserve</>
                  ) : (
                    <>Request Reservation</>
                  )}
                </button>

                <p className="text-[9px] text-white/20 text-center font-medium">
                  {totalPrice > 0
                    ? "Payment processed securely via Razorpay"
                    : "You'll receive confirmation within 30 minutes"}
                </p>
              </motion.div>
            )}

            {/* ─── STEP 7: CONFIRMED ──────────────────── */}
            {step === STEPS.CONFIRMED && (
              <motion.div
                key="confirmed"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-6 py-12 text-center space-y-6"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 15, delay: 0.2 }}
                  className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto"
                >
                  <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                </motion.div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-black uppercase tracking-tight text-white">
                    {totalPrice > 0 ? "Booking Confirmed!" : "Request Sent!"}
                  </h3>
                  <p className="text-white/40 text-sm max-w-[300px] mx-auto leading-relaxed">
                    {totalPrice > 0
                      ? `Your reservation at ${venue.name} is confirmed. Check your email for the QR pass.`
                      : `Your request has been sent to ${venue.name}. You'll receive confirmation via SMS shortly.`}
                  </p>
                </div>

                {/* Summary chip */}
                <div className="inline-flex items-center gap-3 px-5 py-3 bg-white/5 rounded-full border border-white/10">
                  <Calendar className="h-4 w-4 text-white/40" />
                  <span className="text-xs font-bold text-white/60">
                    {selectedDate?.toLocaleDateString("en-IN", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="text-white/15">•</span>
                  <Users className="h-4 w-4 text-white/40" />
                  <span className="text-xs font-bold text-white/60">{guests} guests</span>
                </div>

                <div className="flex flex-col gap-3 pt-4">
                  {selectedEvent && (
                    <Link
                      href={`/event/${selectedEvent.id}`}
                      className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-white/60 uppercase tracking-widest hover:bg-white/10 transition-all"
                    >
                      View Event Details
                    </Link>
                  )}
                  <button
                    onClick={resetAndClose}
                    className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-white/60 uppercase tracking-widest hover:bg-white/10 transition-all"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
