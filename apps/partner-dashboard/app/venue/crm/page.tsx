'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  Filter,
  MessageSquare,
  Search,
  Tag,
  X,
  ChevronDown,
  Plus,
  Phone,
  Check,
  Type,
  Link as LinkIcon,
  ArrowRight,
  Info,
  Calendar as CalendarIcon,
  Zap,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { VenuePageShell, VenueActionButton } from '@/components/venue-layout/VenuePageShell';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { useToast } from '@/components/ui/Toast';
// Local component definition for CalendarFilterPopup used below
import { useRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type CustomerRecord = {
  id: string;
  name: string;
  email: string;
  phone: string;
  age: number | null;
  gender?: string;
  eventName: string;
  entryTime: string | null;
  status: string;
};

type OrderRecord = {
  id: string;
  customerName: string;
  email: string;
  phone: string;
  amount: number;
  ticketsCount: number;
  createdAt: string;
};

type DoorEntryRecord = {
  id: string;
  guestName: string;
  contact: string;
  gender: string | null;
  age: number | null;
  eventId: string;
  eventTitle: string | null;
  source: 'walkins' | 'dinein';
  addedAt: string;
  partySize: number;
};

type AttendeeRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  eventName: string;
  eventId?: string;
  tickets: number;
  totalSpend: number;
  lastPurchase: string | null;
  tags: string[];
  gender?: string;
  age?: number | null;
  source: 'online' | 'walkins' | 'dinein';
};

// ─────────────────────────────────────────────────────────────────────────────
// Business Logic Helpers
// ─────────────────────────────────────────────────────────────────────────────

function deriveAttendees(customers: CustomerRecord[], orders: OrderRecord[]): AttendeeRow[] {
  const metrics = new Map<
    string,
    { tickets: number; totalSpend: number; lastPurchase: string | null }
  >();

  orders.forEach((order) => {
    const key = `${order.email || ''}-${order.customerName || ''}`.toLowerCase();
    const current = metrics.get(key) || { tickets: 0, totalSpend: 0, lastPurchase: null };
    current.tickets += order.ticketsCount || 0;
    current.totalSpend += order.amount || 0;
    current.lastPurchase =
      !current.lastPurchase ||
      new Date(order.createdAt).getTime() > new Date(current.lastPurchase).getTime()
        ? order.createdAt
        : current.lastPurchase;
    metrics.set(key, current);
  });

  return customers.map((customer) => {
    const key = `${customer.email || ''}-${customer.name || ''}`.toLowerCase();
    const metric = metrics.get(key);
    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      eventName: customer.eventName,
      tickets: metric?.tickets || 0,
      totalSpend: metric?.totalSpend || 0,
      lastPurchase: metric?.lastPurchase || customer.entryTime,
      tags: [],
      gender: customer.gender,
      source: 'online' as const,
    } satisfies AttendeeRow;
  });
}

function deriveDoorAttendees(entries: DoorEntryRecord[]): AttendeeRow[] {
  return entries.map((e) => ({
    id: `door-${e.id}`,
    name: e.guestName,
    email: '',
    phone: e.contact,
    eventName: e.eventTitle ?? '',
    eventId: e.eventId,
    tickets: 0,
    totalSpend: 0,
    lastPurchase: e.addedAt,
    tags: [],
    gender: e.gender ?? undefined,
    age: e.age ?? undefined,
    source: e.source,
  }));
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function EventFilterPopup({
  events,
  selectedEventId,
  onSelect,
  onClose,
  triggerRect,
}: {
  events: any[];
  selectedEventId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
  triggerRect: DOMRect | null;
}) {
  const [search, setSearch] = useState('');
  const filteredEvents = events.filter((e) =>
    (e.title || e.name || '').toLowerCase().includes(search.toLowerCase()),
  );

  const popupLeft = triggerRect
    ? Math.min(triggerRect.left, window.innerWidth - 340)
    : window.innerWidth / 2 - 170;
  const popupTop = triggerRect ? triggerRect.bottom + 8 : window.innerHeight / 2 - 200;

  return (
    <div className="fixed inset-0 z-[200]">
      <div className="absolute inset-0" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        style={{ left: popupLeft, top: popupTop }}
        className="absolute w-[320px] max-h-[480px] bg-[#0D0D0E] border border-white/10 rounded-[28px] shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="p-4 border-b border-white/5 bg-white/[0.02]">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 group-focus-within:text-white/60 transition-colors" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find an event..."
              className="w-full h-10 bg-white/5 border border-white/5 rounded-xl pl-9 pr-4 text-[13px] text-white outline-none focus:bg-white/[0.08] focus:border-white/10 transition-all placeholder:text-white/20"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 scrollbar-none">
          <button
            onClick={() => {
              onSelect(null);
              onClose();
            }}
            className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all mb-1 ${
              !selectedEventId
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:bg-white/5 hover:text-white'
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
              <Zap className="h-4 w-4" />
            </div>
            <span className="text-[13px] font-bold">All Events</span>
            {!selectedEventId && <Check className="h-4 w-4 ml-auto" />}
          </button>

          {filteredEvents.map((event) => {
            const isSelected = selectedEventId === event.id;
            const poster =
              event.poster ||
              event.coverImage ||
              event.bannerImage ||
              'https://firebasestorage.googleapis.com/v0/b/thec1rcle-app.appspot.com/o/events%2Fcover%2Fdefault.jpg?alt=media';
            return (
              <button
                key={event.id}
                onClick={() => {
                  onSelect(event.id);
                  onClose();
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all mb-1 ${
                  isSelected
                    ? 'bg-white/10 text-white'
                    : 'text-white/40 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-white/10">
                  <img src={poster} className="w-full h-full object-cover" alt="" />
                </div>
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-[13px] font-bold truncate w-full">
                    {event.title || event.name}
                  </span>
                  <span className="text-[10px] font-medium text-white/20 uppercase tracking-wider">
                    {event.startDate
                      ? new Date(event.startDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'Past Event'}
                  </span>
                </div>
                {isSelected && <Check className="h-4 w-4 ml-auto" />}
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

function FiltersModal({ isOpen, onClose }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-[480px] rounded-[28px] border border-white/10 bg-[#0A0A0B] p-8 shadow-2xl pointer-events-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-[15px] font-bold tracking-tight text-white">Filters</h3>
                <button
                  onClick={onClose}
                  className="p-1 rounded-full hover:bg-white/5 transition-colors"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>

              <div className="space-y-8">
                <section>
                  <h4 className="text-[13px] font-bold text-white mb-4">Sort By</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <select className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-[13px] text-white appearance-none outline-none focus:border-white/20">
                        <option>Attendees</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70 pointer-events-none" />
                    </div>
                    <div className="relative">
                      <select className="width-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-[13px] text-white appearance-none outline-none focus:border-white/20">
                        <option>Newest to Oldest</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70 pointer-events-none" />
                    </div>
                  </div>
                </section>

                <section>
                  <h4 className="text-[13px] font-bold text-white mb-4">
                    Filter By Detected Gender
                  </h4>
                  <div className="relative">
                    <select className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-[13px] text-white appearance-none outline-none focus:border-white/20">
                      <option value="">Select a gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70 pointer-events-none" />
                  </div>
                </section>

                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[13px] font-bold text-white">Filter By Events</h4>
                    <div className="flex items-center gap-2 text-[12px] text-white">
                      Match All <div className="w-4 h-4 rounded-full border border-white/40" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <p className="text-[12px] text-white/60">
                      Create tags for your attendees to start filtering by them!
                    </p>
                  </div>
                </section>
              </div>

              <div className="mt-12 flex gap-4">
                <button
                  onClick={onClose}
                  className="flex-1 h-14 rounded-2xl bg-white text-black font-bold hover:bg-white/90 transition-all"
                >
                  Apply Filters
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 h-14 rounded-2xl bg-white/5 border border-white/10 font-bold text-white/40 hover:text-white transition-all"
                >
                  Reset
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

function CalendarFilterPopup({
  selectedDate,
  onDateSelect,
  onClose,
  triggerRect,
}: {
  selectedDate: Date | null;
  onDateSelect: (date: Date | null) => void;
  onClose: () => void;
  triggerRect: DOMRect | null;
}) {
  const [viewDate, setViewDate] = useState(selectedDate || new Date());

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();

  const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

  const popupLeft = triggerRect
    ? Math.min(triggerRect.left, window.innerWidth - 340)
    : window.innerWidth / 2 - 170;
  const popupTop = triggerRect ? triggerRect.bottom + 8 : window.innerHeight / 2 - 200;

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  return (
    <div className="fixed inset-0 z-[200]">
      <div className="absolute inset-0" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        style={{ left: popupLeft, top: popupTop }}
        className="absolute w-[320px] bg-[#0D0D0E] border border-white/10 rounded-[28px] shadow-2xl p-6 select-none"
      >
        <div className="flex items-center justify-between mb-6 px-1">
          <h3 className="text-[14px] font-bold text-white">
            {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h3>
          <div className="flex gap-1">
            <button
              onClick={prevMonth}
              className="p-2 rounded-xl hover:bg-white/5 transition-colors text-white/40 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={nextMonth}
              className="p-2 rounded-xl hover:bg-white/5 transition-colors text-white/40 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div
              key={i}
              className="text-center text-[10px] font-black text-white/20 uppercase tracking-widest py-2"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {blanks.map((b) => (
            <div key={`b-${b}`} />
          ))}
          {days.map((d) => {
            const isSelected =
              selectedDate &&
              selectedDate.getDate() === d &&
              selectedDate.getMonth() === viewDate.getMonth() &&
              selectedDate.getFullYear() === viewDate.getFullYear();

            return (
              <button
                key={d}
                onClick={() => {
                  onDateSelect(new Date(viewDate.getFullYear(), viewDate.getMonth(), d));
                  onClose();
                }}
                className={`aspect-square rounded-xl flex items-center justify-center text-[13px] font-bold transition-all ${
                  isSelected
                    ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => {
            onDateSelect(null);
            onClose();
          }}
          className="w-full mt-6 py-3 rounded-xl bg-white/5 border border-white/5 text-[12px] font-bold text-white/40 hover:text-white hover:bg-white/10 transition-all uppercase tracking-widest"
        >
          Clear Filter
        </button>
      </motion.div>
    </div>
  );
}

function WhatsAppCampaignModal({
  isOpen,
  onClose,
  selectedCount,
}: ModalProps & { selectedCount: number }) {
  const [message, setMessage] = useState(
    'Hi there! Looking forward to seeing you at our next event!\n\nBest,\nThe C1rcle Team',
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-2xl"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 30 }}
            className="fixed inset-0 z-[210] flex items-center justify-center p-6 lg:p-12"
          >
            <div className="w-full max-w-[1100px] h-full max-h-[820px] bg-[#0A0A0B] border border-white/10 rounded-[48px] shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="h-20 border-b border-white/5 px-10 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-white" />
                  </div>
                  <h2 className="text-[20px] font-bold tracking-tight text-white">
                    Broadcast Campaign
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="w-10 h-10 rounded-full hover:bg-white/5 transition-colors flex items-center justify-center"
                >
                  <X className="h-6 w-6 text-white/40" />
                </button>
              </div>

              <div className="flex-1 flex overflow-hidden">
                {/* Left: Composer Settings */}
                <div className="w-[580px] p-10 overflow-y-auto scrollbar-none border-r border-white/5">
                  <div className="space-y-10">
                    <section>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[12px] font-black text-white/40 uppercase tracking-[0.2em]">
                          Target Audience
                        </h3>
                        <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-white uppercase">
                          {selectedCount} Recipients
                        </span>
                      </div>
                      <p className="text-[14px] text-white/60 leading-relaxed">
                        Your message will be sent as an individual chat to each selected attendee.
                      </p>
                    </section>

                    <section>
                      <h3 className="text-[12px] font-black text-white/40 uppercase tracking-[0.2em] mb-4">
                        Compose Message
                      </h3>
                      <div className="flex items-center gap-2 mb-4">
                        <button className="h-10 px-5 rounded-xl bg-white/5 border border-white/5 font-bold text-[12px] text-white/80 hover:bg-white/10 transition-all flex items-center gap-2">
                          <Type className="h-3.5 w-3.5" />
                          Insert Field
                        </button>
                        <button className="h-10 px-5 rounded-xl bg-white/5 border border-white/5 font-bold text-[12px] text-white/80 hover:bg-white/10 transition-all flex items-center gap-2">
                          <LinkIcon className="h-3.5 w-3.5" />
                          Add Event Link
                        </button>
                      </div>
                      <div className="relative group">
                        <textarea
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          className="w-full h-48 bg-white/[0.04] border border-white/10 rounded-3xl p-6 text-[15px] text-white outline-none focus:border-white/20 transition-all resize-none shadow-inner"
                          placeholder="Type your broadcast message..."
                        />
                        <div className="absolute right-6 bottom-6 flex items-center gap-3">
                          <span
                            className={`text-[12px] font-bold ${message.length > 160 ? 'text-red-400' : 'text-white/40'}`}
                          >
                            {message.length} / 160
                          </span>
                          <div className="h-5 w-[1px] bg-white/10" />
                          <div className="w-5 h-5 rounded-full border border-white/20 flex items-center justify-center text-[10px] text-white/40">
                            ?
                          </div>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h3 className="text-[12px] font-black text-white/40 uppercase tracking-[0.2em] mb-4">
                        Power-Ups
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all cursor-pointer group">
                          <Phone className="h-5 w-5 text-white/40 mb-3 group-hover:text-white transition-colors" />
                          <p className="text-[14px] font-bold text-white mb-1">Custom Sender</p>
                          <p className="text-[11px] text-white/40 font-medium">
                            Verify your own number
                          </p>
                        </div>
                        <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all cursor-pointer group">
                          <ArrowRight className="h-5 w-5 text-white/40 mb-3 group-hover:text-white transition-colors rotate-[-45deg]" />
                          <p className="text-[14px] font-bold text-white mb-1">Schedule Blast</p>
                          <p className="text-[11px] text-white/40 font-medium">
                            Send at a specific time
                          </p>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>

                {/* Right: Phone Preview */}
                <div className="flex-1 bg-[#050505] p-10 flex flex-col items-center justify-center relative overflow-hidden">
                  {/* Abstract background light */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/[0.03] rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2" />

                  {/* iPhone Frame */}
                  <div className="relative w-[320px] aspect-[9/19] bg-[#111] rounded-[50px] border-[6px] border-[#1a1a1a] p-2 shadow-2xl flex flex-col overflow-hidden ring-1 ring-white/10">
                    {/* Dynamic Island */}
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-20" />

                    {/* WhatsApp App UI */}
                    <div className="flex-1 bg-[#0b141a] relative flex flex-col rounded-[38px] overflow-hidden">
                      {/* Status Bar */}
                      <div className="h-9 px-8 flex items-center justify-between text-[10px] font-bold text-white/90">
                        <span>9:41</span>
                        <div className="flex items-center gap-1">
                          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
                            <path d="M12 20c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z" />
                          </svg>
                          <div className="h-2.5 w-4.5 border border-white/20 rounded-sm" />
                        </div>
                      </div>

                      {/* WA Header */}
                      <div className="h-14 bg-[#202c33] px-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                          <img
                            src="https://firebasestorage.googleapis.com/v0/b/thec1rcle-app.appspot.com/o/events%2Fcover%2Fdefault.jpg?alt=media"
                            alt=""
                            className="w-full h-full object-cover opacity-50"
                          />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[12px] font-bold text-white">
                            {selectedCount > 1 ? 'Broadcast List' : 'Attendee'}
                          </span>
                          <span className="text-[9px] text-[#8696a0]">Online</span>
                        </div>
                        <div className="ml-auto flex gap-3 text-[#aebac1]">
                          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                            <path d="M19 11h-2V9h2v2zm-2 2h2v2h-2v-2zm-2-4h-2V7h2v2zm-2 2h2v2h-2v-2zm-2-4H7V7h2v2zm-2 2h2v2H7v-2z" />
                          </svg>
                          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                          </svg>
                        </div>
                      </div>

                      {/* Chat Area */}
                      <div
                        className="flex-1 p-3 flex flex-col relative overflow-hidden"
                        style={{
                          backgroundImage:
                            'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
                          backgroundSize: '400px',
                          backgroundRepeat: 'repeat',
                          backgroundColor: '#0b141a',
                          backgroundBlendMode: 'overlay',
                        }}
                      >
                        <div className="flex justify-center mb-4">
                          <span className="px-3 py-1 bg-[#182229] border border-white/5 rounded-lg text-[9px] font-bold text-[#8696a0] uppercase tracking-wider">
                            Today
                          </span>
                        </div>

                        <div className="flex flex-col items-end">
                          <div className="relative max-w-[85%] bg-[#005c4b] rounded-xl rounded-tr-none p-3 shadow-lg">
                            <p className="text-[12px] text-[#e9edef] leading-[1.4] whitespace-pre-wrap">
                              {message || 'Type your message...'}
                            </p>
                            <div className="flex items-center justify-end gap-1 mt-1">
                              <span className="text-[9px] text-[#e9edef]/40 font-medium">
                                9:41 AM
                              </span>
                              <svg
                                viewBox="0 0 16 11"
                                fill="currentColor"
                                className="h-2.5 w-3.5 text-[#53bdeb]"
                              >
                                <path d="M15.01 3.316l-.478-.372a.365.365 0 00-.51.063L8.666 9.88a.32.32 0 01-.484.032l-.358-.325a.32.32 0 00-.484.032l-.378.48a.418.418 0 00.036.54l1.32 1.267a.32.32 0 00.484-.032l6.273-7.854a.365.365 0 00-.063-.51zM.86 3.316l-.478-.372a.365.365 0 00-.51.063L.654 4.1a.365.365 0 00.51-.063L0.86 3.316zm5.82 5.344l-.326-.296a.32.32 0 00-.484.032l-.378.48a.418.418 0 00.036.54l1.32 1.267a.32.32 0 00.484-.032l6.273-7.854a.365.365 0 00-.063-.51l-.478-.372a.365.365 0 00-.51.063L6.68 8.66z" />
                              </svg>
                            </div>
                            {/* Bubble spike */}
                            <div className="absolute top-0 -right-2 w-3 h-3 bg-[#005c4b] [clip-path:polygon(0_0,0_100%,100%_0)]" />
                          </div>
                        </div>
                      </div>

                      {/* Text Input Row */}
                      <div className="h-12 bg-[#202c33] px-2 flex items-center gap-2">
                        <div className="w-6 h-6 flex items-center justify-center text-[#8696a0]">
                          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                            <path d="M11.5 15.5H10V14h1.5v1.5zm3 0h-1.5V14h1.5v1.5zm3 0h-1.5V14H19l-1.5 1.5zm-9-3H7v-1.5h1.5v1.5zm3 0h-1.5v-1.5h1.5v1.5zm3 0h-1.5v-1.5h1.5v1.5zm3 0h-1.5v-1.5h1.5v1.5z" />
                          </svg>
                        </div>
                        <div className="flex-1 h-8 bg-[#2a3942] rounded-full px-3 flex items-center text-[11px] text-[#8696a0]">
                          Type a message
                        </div>
                        <div className="w-6 h-6 flex items-center justify-center text-[#8696a0]">
                          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-8 flex flex-col items-center gap-2">
                    <p className="text-[12px] font-bold text-white/20 uppercase tracking-[0.2em]">
                      Preview Frame
                    </p>
                    <p className="text-[10px] text-white/10 font-medium">
                      Simulated WhatsApp for Web/Mobile
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="h-24 bg-[#0F0F11] border-t border-white/5 px-10 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <button className="h-12 px-6 rounded-2xl bg-white/5 border border-white/5 font-bold text-[13px] text-white/40 hover:text-white hover:bg-white/10 transition-all">
                    Send Test Blast
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={onClose}
                    className="h-14 px-8 rounded-2xl font-bold text-white/30 hover:text-white transition-all"
                  >
                    Exit Without Saving
                  </button>
                  <button className="h-14 px-12 rounded-2xl bg-white text-black font-black text-[14px] hover:bg-white/90 transition-all shadow-[0_0_30px_rgba(255,255,255,0.1)] flex items-center gap-3">
                    Launch Campaign
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Client
// ─────────────────────────────────────────────────────────────────────────────

export default function MarketingPage() {
  const { profile, user } = useDashboardAuth();
  const { success, error } = useToast();
  const venueId = profile?.activeMembership?.partnerId;

  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [campaignComposerOpen, setCampaignComposerOpen] = useState(false);

  // Dropdown filters state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const timeFilterRef = useRef<HTMLButtonElement>(null);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventOpen, setEventOpen] = useState(false);
  const [eventTriggerRect, setEventTriggerRect] = useState<DOMRect | null>(null);

  // Channel filter
  const [channelFilter, setChannelFilter] = useState<'all' | 'walkins' | 'dinein' | 'online'>(
    'all',
  );
  const eventFilterRef = useRef<HTMLButtonElement>(null);

  // ── Queries ──────────────────────────────────────────────────────────────

  const eventsQuery = useQuery({
    queryKey: ['venue', venueId, 'events'],
    enabled: Boolean(venueId && user),
    queryFn: async () => {
      const token = await user?.getIdToken();
      const response = await fetch(`/api/partners/venues/events?venueId=${venueId}&limit=100`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Failed to fetch events');
      const data = await response.json();
      if (Array.isArray(data?.events)) return data.events as any[];
      if (Array.isArray(data)) return data as any[];
      throw new Error('Malformed events response');
    },
  });

  const customersQuery = useQuery({
    queryKey: ['venue', venueId, 'marketing', 'customers'],
    enabled: Boolean(venueId && user),
    queryFn: async () => {
      const token = await user!.getIdToken();
      const response = await fetch(`/api/partners/venues/crm/online?venueId=${venueId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch attendees');
      const payload = await response.json();
      if (!Array.isArray(payload?.customers)) throw new Error('Malformed attendees response');
      return payload.customers as CustomerRecord[];
    },
    staleTime: 60_000,
  });

  const ordersQuery = useQuery({
    queryKey: ['venue', venueId, 'marketing', 'orders'],
    enabled: Boolean(venueId && user),
    queryFn: async () => {
      const token = await user!.getIdToken();
      const response = await fetch(
        `/api/partners/venues/orders?venueId=${venueId}&page=1&limit=100`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) throw new Error('Failed to fetch order history');
      const payload = await response.json();
      if (!Array.isArray(payload?.orders)) throw new Error('Malformed order response');
      return payload.orders as OrderRecord[];
    },
    staleTime: 60_000,
  });

  // ── Door entries — self-contained fetch using Promise.all ────────────────────
  const [doorEntries, setDoorEntries] = useState<DoorEntryRecord[]>([]);
  const [doorLoading, setDoorLoading] = useState(false);
  const [doorError, setDoorError] = useState<string | null>(null);

  useEffect(() => {
    if (!venueId || !user) {
      return;
    }

    let cancelled = false;

    (async () => {
      setDoorLoading(true);
      try {
        setDoorError(null);
        const token = await user.getIdToken();
        const headers: Record<string, string> = { Authorization: `Bearer ${token}` };

        // ── Step 1: Fetch ALL events for this venue ───────────────────
        const eventsRes = await fetch(`/api/partners/venues/events?venueId=${venueId}&limit=50`, {
          headers,
        });
        if (cancelled) return;

        if (!eventsRes.ok) {
          throw new Error(`Failed to load CRM events (${eventsRes.status})`);
        }

        const eventsPayload = await eventsRes.json();
        const allEvents: any[] = eventsPayload.events ?? [];

        if (allEvents.length === 0) {
          setDoorEntries([]);
          return;
        }

        const targetEvents = selectedEventId
          ? allEvents.filter((e: any) => e.id === selectedEventId)
          : allEvents;

        // ── Step 2: Walk-ins + dine-ins per event + venue-scoped ──────
        const [walkInResults, dineinResults, venueDineinsPayload] = await Promise.all([
          Promise.all(
            targetEvents.map((ev: any) =>
              fetch(`/api/partners/venues/walk-ins?eventId=${ev.id}&venueId=${venueId}&limit=50`, {
                headers,
              }).then(async (r) => {
                const d = await r.json();
                if (!r.ok) {
                  throw new Error(d.error || `Walk-ins failed for ${ev.id}`);
                }
                return { ev, entries: d.entries ?? [] };
              }),
            ),
          ),
          Promise.all(
            targetEvents.map((ev: any) =>
              fetch(
                `/api/partners/venues/door/dinein?eventId=${ev.id}&venueId=${venueId}&limit=50`,
                { headers },
              ).then(async (r) => {
                const d = await r.json();
                if (!r.ok) {
                  throw new Error(d.error || `Dine-ins failed for ${ev.id}`);
                }
                return { ev, entries: d.entries ?? [] };
              }),
            ),
          ),
          selectedEventId
            ? Promise.resolve({ entries: [] as any[] })
            : fetch(
                `/api/partners/venues/door/dinein?eventId=venue_${venueId}&venueId=${venueId}&limit=50`,
                { headers },
              ).then(async (r) => {
                const d = await r.json();
                if (!r.ok) {
                  throw new Error(d.error || 'Venue dine-ins failed');
                }
                return d;
              }),
        ]);

        if (cancelled) return;

        // ── Step 3: Flatten + map ─────────────────────────────────────
        const mapped: DoorEntryRecord[] = [
          ...walkInResults.flatMap(({ ev, entries }) =>
            entries.map((e: any) => ({
              id: e.id,
              guestName: e.guestName ?? '',
              contact: e.phoneFull ?? e.phoneHash ?? '',
              gender: e.gender ?? null,
              age: e.guestAge != null ? Number(e.guestAge) : null,
              eventId: e.eventId ?? ev.id,
              eventTitle: ev.title ?? ev.name ?? null,
              source: 'walkins' as const,
              addedAt: e.addedAt ?? '',
              partySize: e.partySize ?? 1,
            })),
          ),
          ...dineinResults.flatMap(({ ev, entries }) =>
            entries.map((e: any) => ({
              id: e.id,
              guestName: e.guestName ?? '',
              contact: '',
              gender: e.gender ?? null,
              age: e.age != null ? Number(e.age) : null,
              eventId: e.eventId ?? ev.id,
              eventTitle: ev.title ?? ev.name ?? null,
              source: 'dinein' as const,
              addedAt: e.addedAt ?? '',
              partySize: e.partySize ?? 1,
            })),
          ),
          ...(venueDineinsPayload.entries ?? []).map((e: any) => ({
            id: e.id,
            guestName: e.guestName ?? '',
            contact: '',
            gender: e.gender ?? null,
            age: e.age != null ? Number(e.age) : null,
            eventId: `venue_${venueId}`,
            eventTitle: null,
            source: 'dinein' as const,
            addedAt: e.addedAt ?? '',
            partySize: e.partySize ?? 1,
          })),
        ].sort((a, b) => b.addedAt.localeCompare(a.addedAt));

        setDoorEntries(mapped);
      } catch (err: any) {
        console.error('[Marketing] useEffect fetch error:', err);
        setDoorEntries([]);
        setDoorError(err?.message || 'Failed to load door entries');
      } finally {
        if (!cancelled) setDoorLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [venueId, user, selectedEventId]);

  // ── Derivative State ─────────────────────────────────────────────────────

  const attendees = useMemo(
    () => [
      ...deriveAttendees(customersQuery.data ?? [], ordersQuery.data ?? []),
      ...deriveDoorAttendees(doorEntries),
    ],
    [customersQuery.data, ordersQuery.data, doorEntries],
  );

  const loadError =
    (eventsQuery.error instanceof Error && eventsQuery.error.message) ||
    (customersQuery.error instanceof Error && customersQuery.error.message) ||
    (ordersQuery.error instanceof Error && ordersQuery.error.message) ||
    doorError;

  const filteredAttendees = useMemo(
    () =>
      attendees.filter((a) => {
        const matchesQuery = [a.name, a.email, a.phone, a.eventName]
          .join(' ')
          .toLowerCase()
          .includes(query.toLowerCase());

        // Event filter — match by eventId for door entries, by name for online
        const selectedEvent = eventsQuery.data?.find((e) => e.id === selectedEventId);
        const eventName = selectedEvent?.title || selectedEvent?.name;
        const matchesEvent =
          !selectedEventId ||
          (a.eventId && a.eventId === selectedEventId) ||
          a.eventName === eventName;

        // Time filter
        let matchesTime = true;
        if (selectedDate) {
          if (!a.lastPurchase) {
            matchesTime = false;
          } else {
            const d1 = new Date(a.lastPurchase);
            const d2 = selectedDate;
            matchesTime =
              d1.getFullYear() === d2.getFullYear() &&
              d1.getMonth() === d2.getMonth() &&
              d1.getDate() === d2.getDate();
          }
        }

        const matchesChannel = channelFilter === 'all' || a.source === channelFilter;

        return matchesQuery && matchesEvent && matchesTime && matchesChannel;
      }),
    [attendees, query, selectedDate, selectedEventId, eventsQuery.data, channelFilter],
  );

  // ── Handlers ─────────────────────────────────────────────────────────────

  const toggleAttendee = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((v) => v !== id) : [...current, id],
    );
  };

  const toggleAll = () => {
    const visibleIds = filteredAttendees.map((a) => a.id);
    const allSelected = visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds((current) =>
      allSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : [...new Set([...current, ...visibleIds])],
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <VenuePageShell
      title="Marketing"
      actions={
        <VenueActionButton variant="secondary" onClick={() => setCampaignComposerOpen(true)}>
          View WhatsApp Campaigns
        </VenueActionButton>
      }
    >
      <div className="space-y-5 mb-6">
        <div className="flex flex-col xl:flex-row xl:items-center gap-3">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 group-focus-within:text-white/70 transition-colors" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search attendee, email or phone..."
              className="w-full h-12 rounded-full border border-white/[0.06] bg-[#090A0C] pl-11 pr-5 text-[15px] text-white outline-none focus:border-white/12 transition-all placeholder:text-white/25"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <button
                ref={eventFilterRef}
                onClick={() => {
                  setEventTriggerRect(eventFilterRef.current?.getBoundingClientRect() || null);
                  setEventOpen(!eventOpen);
                }}
                className={`h-12 px-5 rounded-2xl bg-[#1E1F22] border flex items-center gap-3 text-[13px] font-semibold text-white hover:bg-[#242529] transition-all ${
                  eventOpen ? 'border-white/18 bg-[#242529]' : 'border-white/[0.06]'
                }`}
              >
                <Zap className="h-4 w-4 text-white/40" />
                {selectedEventId
                  ? eventsQuery.data?.find((e) => e.id === selectedEventId)?.title ||
                    eventsQuery.data?.find((e) => e.id === selectedEventId)?.name ||
                    'Selected Event'
                  : 'All Events'}
                <ChevronDown
                  className={`h-4 w-4 text-white/40 transition-transform ${eventOpen ? 'rotate-180' : ''}`}
                />
              </button>
            </div>
            <div className="relative group">
              <button
                ref={timeFilterRef}
                onClick={() => {
                  setTriggerRect(timeFilterRef.current?.getBoundingClientRect() || null);
                  setCalendarOpen(!calendarOpen);
                }}
                className={`h-12 px-5 rounded-2xl bg-[#1E1F22] border flex items-center gap-3 text-[13px] font-semibold text-white hover:bg-[#242529] transition-all ${
                  calendarOpen ? 'border-white/18 bg-[#242529]' : 'border-white/[0.06]'
                }`}
              >
                <CalendarIcon className="h-4 w-4 text-white/40" />
                {selectedDate
                  ? selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : 'All Time'}
                <ChevronDown
                  className={`h-4 w-4 text-white/40 transition-transform ${calendarOpen ? 'rotate-180' : ''}`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Channel filter tabs */}
      {(() => {
        const counts = {
          all: attendees.length,
          walkins: attendees.filter((a) => a.source === 'walkins').length,
          dinein: attendees.filter((a) => a.source === 'dinein').length,
          online: attendees.filter((a) => a.source === 'online').length,
        };
        const tabs: {
          key: 'all' | 'walkins' | 'dinein' | 'online';
          label: string;
          color: string;
          activeColor: string;
        }[] = [
          { key: 'all', label: 'All', color: 'text-white/40', activeColor: 'text-white' },
          {
            key: 'walkins',
            label: 'Walk-ins',
            color: 'text-white/40',
            activeColor: 'text-emerald-400',
          },
          {
            key: 'dinein',
            label: 'Dine-ins',
            color: 'text-white/40',
            activeColor: 'text-blue-400',
          },
          {
            key: 'online',
            label: 'Online',
            color: 'text-white/40',
            activeColor: 'text-violet-400',
          },
        ];
        return (
          <div
            className="flex items-center gap-1 p-1 rounded-2xl w-fit"
            style={{ background: '#1A1B1E', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            {tabs.map((tab) => {
              const isActive = channelFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setChannelFilter(tab.key)}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all ${
                    isActive
                      ? `${tab.activeColor} bg-[#2A2B2F]`
                      : `${tab.color} hover:text-white/60`
                  }`}
                >
                  {tab.label}
                  <span
                    className={`text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-white/10 text-white/70' : 'bg-white/5 text-white/25'
                    }`}
                  >
                    {counts[tab.key]}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })()}

      <AnimatePresence>
        {eventOpen && (
          <EventFilterPopup
            events={eventsQuery.data ?? []}
            selectedEventId={selectedEventId}
            onSelect={setSelectedEventId}
            onClose={() => setEventOpen(false)}
            triggerRect={eventTriggerRect}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {calendarOpen && (
          <CalendarFilterPopup
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            onClose={() => setCalendarOpen(false)}
            triggerRect={triggerRect}
          />
        )}
      </AnimatePresence>

      <div className="overflow-hidden rounded-[28px] border border-white/[0.05] bg-[#161719] overflow-x-auto">
        <div className="grid grid-cols-[minmax(180px,1fr)_130px_170px_56px_44px_110px_90px] gap-4 px-6 py-4 border-b border-white/[0.04] bg-[#1D1E21] min-w-[820px]">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleAll}
              className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${
                filteredAttendees.length > 0 &&
                filteredAttendees.every((a) => selectedIds.includes(a.id))
                  ? 'bg-white border-white text-black'
                  : 'border-white/20 hover:border-white/40 bg-white/5'
              }`}
            >
              {filteredAttendees.length > 0 &&
                filteredAttendees.every((a) => selectedIds.includes(a.id)) && (
                  <Check className="h-3 w-3 stroke-[4]" />
                )}
            </button>
            <div className="text-[11px] font-black text-white uppercase tracking-[0.22em]">
              Attendee
            </div>
          </div>
          <div className="text-[11px] font-black text-white uppercase tracking-[0.22em]">
            Contact
          </div>
          <div className="text-[11px] font-black text-white uppercase tracking-[0.22em]">Email</div>
          <div className="text-[11px] font-black text-white uppercase tracking-[0.22em] text-center">
            Gender
          </div>
          <div className="text-[11px] font-black text-white uppercase tracking-[0.22em] text-center">
            Age
          </div>
          <div className="text-[11px] font-black text-white uppercase tracking-[0.22em]">
            Date &amp; Time
          </div>
          <div className="text-[11px] font-black text-white uppercase tracking-[0.22em] text-right">
            Channel
          </div>
        </div>

        <div className="pb-40 min-w-[820px]">
          {loadError ? (
            <div className="py-20 text-center">
              <div className="text-red-400 text-[16px] font-medium tracking-tight">{loadError}</div>
            </div>
          ) : customersQuery.isLoading ||
            ordersQuery.isLoading ||
            eventsQuery.isLoading ||
            doorLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-[72px] w-full border-t border-white/[0.035] bg-[#232326] animate-pulse"
              />
            ))
          ) : filteredAttendees.length === 0 ? (
            <div className="py-40 text-center">
              <div className="text-white/20 text-[16px] font-medium tracking-tight">
                No attendees found. Try a different search!
              </div>
            </div>
          ) : (
            filteredAttendees.map((a) => {
              const isSelected = selectedIds.includes(a.id);
              const isWalkin = a.source === 'walkins';
              const isDinein = a.source === 'dinein';
              return (
                <motion.div
                  layout
                  key={a.id}
                  onClick={() => toggleAttendee(a.id)}
                  className={`group relative grid grid-cols-[minmax(180px,1fr)_130px_170px_56px_44px_110px_90px] items-center gap-4 px-6 py-4 border-t border-white/[0.035] transition-all cursor-pointer ${
                    isSelected ? 'bg-[#2A2A2D]' : 'bg-[#232326] hover:bg-[#29292D]'
                  }`}
                >
                  {/* Column 1: Identity */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative flex-shrink-0">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-white text-black'
                            : 'bg-white/10 text-white/60 group-hover:bg-white/15'
                        }`}
                      >
                        {isSelected ? (
                          <Check className="h-4 w-4 stroke-[3]" />
                        ) : (
                          <span className="text-[14px] font-bold">{a.name.charAt(0)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <h3 className="text-[14px] font-semibold tracking-tight text-white truncate">
                        {a.name}
                      </h3>
                      {a.eventName && (
                        <div className="text-[11px] font-medium text-white/35 uppercase tracking-[0.1em] mt-0.5 truncate">
                          {a.eventName}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Column 2: Contact */}
                  <p className="text-[12px] tabular-nums text-white/60 truncate">
                    {a.phone || '—'}
                  </p>

                  {/* Column 3: Email */}
                  <p className="text-[12px] text-white/60 truncate">{a.email || '—'}</p>

                  {/* Column 4: Gender */}
                  <div className="flex justify-center">
                    {a.gender ? (
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                        style={{
                          background:
                            a.gender === 'male' ? 'rgba(59,130,246,0.15)' : 'rgba(236,72,153,0.15)',
                          color: a.gender === 'male' ? '#60A5FA' : '#F472B6',
                        }}
                      >
                        {a.gender === 'male' ? 'M' : 'F'}
                      </span>
                    ) : (
                      <span className="text-[12px] text-white/25">—</span>
                    )}
                  </div>

                  {/* Column 5: Age */}
                  <p className="text-[12px] tabular-nums text-center text-white/60">
                    {a.age != null ? a.age : '—'}
                  </p>

                  {/* Column 6: Date & Time */}
                  <div className="flex flex-col">
                    {a.lastPurchase ? (
                      <>
                        <span className="text-[12px] font-semibold text-white/70 tabular-nums">
                          {new Date(a.lastPurchase)
                            .toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                            .toUpperCase()}
                        </span>
                        <span className="text-[11px] text-white/35 tabular-nums">
                          {new Date(a.lastPurchase).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </>
                    ) : (
                      <span className="text-[12px] text-white/25">—</span>
                    )}
                  </div>

                  {/* Column 7: Channel badge */}
                  <div className="flex justify-end">
                    {isWalkin && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400">
                        Walk-in
                      </span>
                    )}
                    {isDinein && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-400">
                        Dine-in
                      </span>
                    )}
                    {a.source === 'online' && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-violet-500/15 text-violet-400">
                        Online
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* Floating Action Bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] w-full max-w-2xl px-6"
          >
            <div className="bg-[#1A1A1B] border border-white/10 rounded-[32px] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-between backdrop-blur-xl">
              <div className="flex items-center gap-4 ml-4">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-black font-black text-[14px]">
                  {selectedIds.length}
                </div>
                <div className="flex flex-col">
                  <span className="text-white font-bold text-[14px]">Attendees Selected</span>
                  <button
                    onClick={() => setSelectedIds([])}
                    className="text-white/40 text-[12px] font-bold hover:text-white transition-colors text-left"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>

              <button
                onClick={() => setCampaignComposerOpen(true)}
                className="h-14 px-10 rounded-2xl bg-white text-black font-black text-[14px] flex items-center gap-3 hover:bg-white/90 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]"
              >
                <MessageSquare className="h-4.5 w-4.5" />
                Start WhatsApp Campaign
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <FiltersModal isOpen={filterModalOpen} onClose={() => setFilterModalOpen(false)} />
      <WhatsAppCampaignModal
        isOpen={campaignComposerOpen}
        onClose={() => setCampaignComposerOpen(false)}
        selectedCount={selectedIds.length === 0 ? 1 : selectedIds.length}
      />

      {}
      <style jsx global>{`
        .venue-page-content {
          background-color: #0d0d0e !important;
        }
        body {
          background-color: #0d0d0e !important;
        }
        @layer utilities {
          .bg-gradient-to-r {
            background-image: linear-gradient(to right, var(--tw-gradient-stops));
          }
        }
      `}</style>
    </VenuePageShell>
  );
}
