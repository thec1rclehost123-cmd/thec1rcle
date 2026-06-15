'use client';

import { useEffect, useState, useMemo, useCallback, useRef, type ComponentType } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Building2,
  Lock,
  Clock,
  Plus,
  Music,
  X,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  MapPin,
  Zap,
  Info,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { parseAsIST, toISODateIST } from '@c1rcle/core/time';
import { VenuePageShell } from '@/components/venue-layout/VenuePageShell';

// ── Color system ──
const C = {
  surface: '#1c1c22',
  surfaceWeekend: '#1f1f28',
  surfacePast: '#141417',
  surfaceEvent: '#0d2119',
  surfaceBlocked: '#1e0d0d',
  surfacePending: '#1e1a0b',
  surfaceToday: '#281510',
  surfaceSelected: '#2e1008',
  borderDefault: 'rgba(255,255,255,0.08)',
  borderEvent: 'rgba(52,211,153,0.4)',
  borderBlocked: 'rgba(248,113,113,0.35)',
  borderPending: 'rgba(251,191,36,0.3)',
  borderToday: 'rgba(244,74,34,0.55)',
  borderSelected: '#F44A22',
  teal: '#34D399',
  amber: '#FBBF24',
  red: '#F87171',
  orange: '#F44A22',
  slate: 'rgba(255,255,255,0.45)',
};

const EXCLUDED_LIFECYCLE = ['draft', 'deleted', 'cancelled', 'denied'];
const HOST_SCOPE_ID = '__host_calendar__';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

type SlotState =
  | 'open'
  | 'pending_mine'
  | 'approved_mine'
  | 'occupied_other'
  | 'blocked'
  | 'unavailable';

interface CalendarSlot {
  date: string;
  startTime?: string;
  endTime?: string;
  state: SlotState;
  eventTitle?: string;
  eventId?: string;
  eventLifecycle?: string;
  venueName?: string;
  slotId?: string;
}

interface VenueOption {
  id: string;
  name: string;
  city: string;
  partnershipStatus: 'active' | 'pending' | 'none';
}

const TIMELINE_HOURS = [
  { label: '2 PM', mins: 0 },
  { label: '4 PM', mins: 120 },
  { label: '6 PM', mins: 240 },
  { label: '8 PM', mins: 360 },
  { label: '10 PM', mins: 480 },
  { label: '12 AM', mins: 600 },
  { label: '2 AM', mins: 720 },
  { label: '4 AM', mins: 840 },
];
const TOTAL_MINS = 840;

function filterVisible(events: any[]) {
  return (events || []).filter(
    (e: any) => !EXCLUDED_LIFECYCLE.includes((e.lifecycle || e.status || 'draft').toLowerCase()),
  );
}

function timeToMins(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  let mins = h * 60 + m;
  if (h < 14) mins += 1440;
  return mins - 840;
}

function pct(mins: number) {
  return `${Math.max(0, Math.min(100, (mins / TOTAL_MINS) * 100))}%`;
}

function fmt12(t: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

// ── Main Page Component ───────────────────────────────────────────────────────

export default function HostCalendarPage() {
  const { profile, getIdToken } = useDashboardAuth();
  const rm = useReducedMotion();
  const hostId = profile?.activeMembership?.partnerId;

  const [currentMonth, setCurrentMonth] = useState(() => parseAsIST(null));
  const [selectedVenueId, setSelectedVenueId] = useState<string>(HOST_SCOPE_ID);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [slotsMap, setSlotsMap] = useState<Record<string, CalendarSlot[]>>({});
  const [loading, setLoading] = useState(true);

  const year = parseInt(
    currentMonth.toLocaleString('en-US', { year: 'numeric', timeZone: 'Asia/Kolkata' }),
  );
  const month =
    parseInt(currentMonth.toLocaleString('en-US', { month: 'numeric', timeZone: 'Asia/Kolkata' })) -
    1;

  // ── Fetching logic ──
  const fetchVenues = useCallback(async () => {
    if (!hostId) return;
    try {
      const token = typeof getIdToken === 'function' ? await getIdToken() : null;
      if (!token) return;
      const res = await fetch(`/api/partners/hosts/partnerships?hostId=${hostId}&status=active`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const data = await res.json();
      const all = data.partnerships || data.partners || [];
      const active = all
        .filter((p: any) => (p.status || p.partnershipStatus) === 'active')
        .map((p: any) => ({
          id: p.venueId || p.id,
          name: p.name || p.venueName || 'Venue',
          city: p.city || '',
          partnershipStatus: 'active' as const,
        }));
      setVenues(active);
    } catch {
      /* silent */
    }
  }, [hostId, getIdToken]);

  const fetchCalendar = useCallback(async () => {
    if (!hostId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const token = typeof getIdToken === 'function' ? await getIdToken() : null;
      if (!token) {
        setLoading(false);
        return;
      }

      const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const last = new Date(year, month + 1, 0).getDate();
      const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;

      if (selectedVenueId === HOST_SCOPE_ID) {
        const res = await fetch(`/api/partners/hosts/events?limit=100`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        const events: any[] = data.events || [];
        const map: Record<string, CalendarSlot[]> = {};
        events
          .filter((e) => {
            const d = String(e.startDate || '').slice(0, 10);
            const lc = String(e.lifecycle || e.status || '').toLowerCase();
            return d >= start && d <= end && !EXCLUDED_LIFECYCLE.includes(lc);
          })
          .forEach((e) => {
            const dk = String(e.startDate || '').slice(0, 10);
            if (!map[dk]) map[dk] = [];
            map[dk].push({
              date: dk,
              startTime: e.startTime,
              endTime: e.endTime,
              state: ['submitted', 'pending', 'needs_changes'].includes(
                (e.lifecycle || e.status || '').toLowerCase(),
              )
                ? 'pending_mine'
                : 'approved_mine',
              eventTitle: e.name || e.title || 'Host Event',
              eventId: e.id,
              venueName: e.venueName,
            });
          });
        setSlotsMap(map);
      } else {
        const res = await fetch(
          `/api/venues/${selectedVenueId}/calendar?hostId=${hostId}&view=operating&startDate=${start}&endDate=${end}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        );
        const data = await res.json();
        const map: Record<string, CalendarSlot[]> = {};
        if (Array.isArray(data)) {
          data.forEach((d: any) => {
            const visible = filterVisible(d.events);
            map[d.date] = visible.map((e: any) => ({
              date: d.date,
              startTime: e.startTime,
              endTime: e.endTime,
              state:
                e.hostId === hostId
                  ? ['submitted', 'pending'].includes((e.lifecycle || e.status).toLowerCase())
                    ? 'pending_mine'
                    : 'approved_mine'
                  : 'occupied_other',
              eventTitle: e.title || 'Occupied',
              eventId: e.id,
            }));
            if (d.state === 'BLOCKED') {
              map[d.date].push({
                date: d.date,
                state: 'blocked',
                startTime: d.block?.startTime,
                endTime: d.block?.endTime,
              });
            }
          });
        }
        setSlotsMap(map);
      }
    } catch {
      setSlotsMap({});
    } finally {
      setLoading(false);
    }
  }, [hostId, selectedVenueId, getIdToken, year, month]);

  useEffect(() => {
    fetchVenues();
  }, [fetchVenues]);
  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const firstDayIdx = useMemo(() => {
    const d = parseAsIST(`${year}-${String(month + 1).padStart(2, '0')}-01`);
    const sh = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone: 'Asia/Kolkata',
    }).format(d);
    return DAYS.indexOf(sh);
  }, [year, month]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((firstDayIdx + daysInMonth) / 7);

  const grid = useMemo(() => {
    const g: any[] = [];
    for (let i = 0; i < firstDayIdx; i++) g.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const slots = slotsMap[ds] || [];
      g.push({
        day: d,
        dateStr: ds,
        slots,
        isPast: ds < toISODateIST(parseAsIST(null)),
        isWeekend: (firstDayIdx + d - 1) % 7 === 0 || (firstDayIdx + d - 1) % 7 === 6,
      });
    }
    return g;
  }, [slotsMap, year, month, daysInMonth, firstDayIdx]);

  const selectedDayData = useMemo(
    () => grid.find((d) => d?.dateStr === selectedDate),
    [grid, selectedDate],
  );

  const navMonth = (delta: number) => {
    const nm = month + delta;
    const ny = nm < 0 ? year - 1 : nm > 11 ? year + 1 : year;
    setCurrentMonth(parseAsIST(`${ny}-${String((((nm % 12) + 12) % 12) + 1).padStart(2, '0')}-01`));
    setSelectedDate(null);
  };

  return (
    <VenuePageShell
      title="Slot Calendar"
      subtitle="Coordinate production slots and venue availability."
    >
      <div className="flex flex-col gap-6 h-[calc(100vh-13rem)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => {
                setSelectedVenueId(HOST_SCOPE_ID);
                setSelectedDate(null);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all border flex-shrink-0"
              style={{
                background:
                  selectedVenueId === HOST_SCOPE_ID ? C.surface : 'rgba(255,255,255,0.03)',
                border:
                  selectedVenueId === HOST_SCOPE_ID
                    ? `1px solid ${C.orange}`
                    : `1px solid ${C.borderDefault}`,
                color: selectedVenueId === HOST_SCOPE_ID ? 'white' : 'rgba(255,255,255,0.35)',
              }}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              My Events
            </button>
            {venues.map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  setSelectedVenueId(v.id);
                  setSelectedDate(null);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all border flex-shrink-0"
                style={{
                  background: selectedVenueId === v.id ? C.surface : 'rgba(255,255,255,0.03)',
                  border:
                    selectedVenueId === v.id
                      ? `1px solid ${C.orange}`
                      : `1px solid ${C.borderDefault}`,
                  color: selectedVenueId === v.id ? 'white' : 'rgba(255,255,255,0.35)',
                }}
              >
                <Building2 className="w-3.5 h-3.5" />
                {v.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-2xl overflow-hidden bg-[#1c1c22] border border-white/5">
              <button
                onClick={() => navMonth(-1)}
                className="w-10 h-10 flex items-center justify-center hover:bg-white/5 text-white/40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-4 text-[13px] font-black uppercase text-white min-w-[150px] text-center border-x border-white/5">
                {MONTHS[month]} {year}
              </span>
              <button
                onClick={() => navMonth(1)}
                className="w-10 h-10 flex items-center justify-center hover:bg-white/5 text-white/40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row gap-5 min-h-0">
          <div className="lg:flex-[2.5] bg-[#16161b] rounded-[28px] border border-white/5 flex flex-col overflow-hidden shadow-2xl">
            <div className="grid grid-cols-7 px-4 pt-5 pb-3">
              {DAYS.map((d) => (
                <div
                  key={d}
                  className="text-center text-[9px] font-black uppercase tracking-[0.2em] text-white/20"
                >
                  {d}
                </div>
              ))}
            </div>
            <div
              className="flex-1 grid grid-cols-7 gap-2 p-4 pt-0"
              style={{ gridTemplateRows: `repeat(${weeks}, 1fr)` }}
            >
              {loading
                ? Array.from({ length: 35 }).map((_, i) => (
                    <div key={i} className="rounded-2xl bg-white/5 animate-pulse" />
                  ))
                : grid.map((cell, i) => {
                    if (!cell) return <div key={i} />;
                    const isSel = cell.dateStr === selectedDate;
                    const isToday = cell.dateStr === toISODateIST(parseAsIST(null));
                    const hasEvents = cell.slots.some((s: any) =>
                      ['approved_mine', 'pending_mine', 'occupied_other'].includes(s.state),
                    );
                    const isBlocked = cell.slots.some((s: any) => s.state === 'blocked');

                    let bg = cell.isPast
                      ? C.surfacePast
                      : cell.isWeekend
                        ? C.surfaceWeekend
                        : C.surface;
                    let border = `1px solid ${C.borderDefault}`;
                    if (isSel) {
                      bg = C.surfaceSelected;
                      border = `2px solid ${C.borderSelected}`;
                    }
                    if (isBlocked) {
                      bg = C.surfaceBlocked;
                      border = `1px solid ${C.borderBlocked}`;
                    }

                    return (
                      <button
                        key={cell.dateStr}
                        onClick={() => setSelectedDate(cell.dateStr)}
                        className="relative rounded-2xl flex flex-col items-center justify-center gap-1 transition-all"
                        style={{ background: bg, border, opacity: cell.isPast ? 0.4 : 1 }}
                      >
                        <span
                          className={`text-[15px] font-black tabular-nums ${isToday ? 'text-orange-500' : 'text-white/80'}`}
                        >
                          {cell.day}
                        </span>
                        <div className="flex gap-1">
                          {hasEvents && <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />}
                          {isBlocked && <div className="w-1.5 h-1.5 rounded-full bg-red-400" />}
                        </div>
                      </button>
                    );
                  })}
            </div>
          </div>

          <div className="lg:flex-1 bg-[#101014] rounded-[28px] border border-white/5 overflow-hidden flex flex-col shadow-2xl">
            <AnimatePresence mode="wait">
              {selectedDate && selectedDayData ? (
                <motion.div
                  key={selectedDate}
                  initial={rm ? {} : { opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={rm ? {} : { opacity: 0, x: -20 }}
                  className="h-full flex flex-col"
                >
                  <Inspector
                    date={selectedDate}
                    slots={selectedDayData.slots}
                    venueId={selectedVenueId}
                    onClear={() => setSelectedDate(null)}
                  />
                </motion.div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-10 text-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/20">
                    <CalendarDays className="w-6 h-6" />
                  </div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-white/30 uppercase">
                    Select a date to view details
                  </p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </VenuePageShell>
  );
}

function Inspector({
  date,
  slots,
  venueId,
  onClear,
}: {
  date: string;
  slots: CalendarSlot[];
  venueId: string;
  onClear: () => void;
}) {
  const isBlocked = slots.some((s) => s.state === 'blocked');
  const events = slots.filter((s) => s.state !== 'blocked');

  return (
    <div className="flex flex-col h-full">
      <div
        className={`p-6 pb-5 relative overflow-hidden ${isBlocked ? 'bg-red-950/20' : 'bg-teal-950/20'}`}
      >
        <div className="absolute top-0 right-0 p-4">
          <button
            onClick={onClear}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/30 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-end gap-3 mt-4">
          <span className="text-[52px] font-black leading-none tracking-tighter text-white/90">
            {date.split('-')[2]}
          </span>
          <div className="pb-1">
            <p className="text-[15px] font-black text-white">
              {new Date(date).toLocaleDateString('en-US', { weekday: 'long' })}
            </p>
            <p className="text-[11px] font-medium text-white/30">
              {new Date(date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-5 overflow-y-auto space-y-5 no-scrollbar">
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3 text-white/20" />
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">
            Night Schedule
          </span>
          <div className="flex-1 h-px bg-white/5" />
          <span className="text-[9px] font-black text-white/10">2 PM - 4 AM</span>
        </div>

        <div
          className="relative rounded-2xl bg-white/5 border border-white/5 overflow-hidden"
          style={{ height: 320 }}
        >
          {TIMELINE_HOURS.map(({ label, mins }) => (
            <div
              key={label}
              className="absolute inset-x-0 h-px bg-white/5"
              style={{ top: pct(mins) }}
            />
          ))}
          {slots.map((s, i) => {
            const start = timeToMins(s.startTime || '21:00');
            const end = timeToMins(s.endTime || '04:00');
            const isConfirmed = s.state === 'approved_mine';
            const isPending = s.state === 'pending_mine';
            const isOccupied = s.state === 'occupied_other';
            const isB = s.state === 'blocked';

            return (
              <div
                key={i}
                className="absolute left-2 right-2 rounded-xl border px-3 py-2 flex flex-col justify-center"
                style={{
                  top: pct(start),
                  height: `${((end - start) / TOTAL_MINS) * 100}%`,
                  background: isB
                    ? 'rgba(239,68,68,0.15)'
                    : isOccupied
                      ? 'rgba(255,255,255,0.05)'
                      : isPending
                        ? 'rgba(251,191,36,0.15)'
                        : 'rgba(52,211,153,0.15)',
                  borderColor: isB
                    ? 'rgba(239,68,68,0.3)'
                    : isOccupied
                      ? 'rgba(255,255,255,0.1)'
                      : isPending
                        ? 'rgba(251,191,36,0.3)'
                        : 'rgba(52,211,153,0.3)',
                }}
              >
                <div
                  className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
                  style={{
                    background: isB ? C.red : isOccupied ? C.slate : isPending ? C.amber : C.teal,
                  }}
                />
                <p className="text-[10px] font-black text-white uppercase truncate">
                  {s.eventTitle || (isB ? 'Blocked' : 'Occupied')}
                </p>
                <p className="text-[8px] font-bold text-white/40 tabular-nums">
                  {fmt12(s.startTime || '21:00')} - {fmt12(s.endTime || '04:00')}
                </p>
              </div>
            );
          })}
        </div>

        {!isBlocked && venueId !== HOST_SCOPE_ID && (
          <Link
            href={`/host/create?venueId=${venueId}&date=${date}`}
            className="w-full h-12 rounded-xl flex items-center justify-center gap-2 bg-orange-600 text-white text-[11px] font-black uppercase tracking-widest shadow-xl shadow-orange-950/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4" />
            Request Slot
          </Link>
        )}
      </div>
    </div>
  );
}
