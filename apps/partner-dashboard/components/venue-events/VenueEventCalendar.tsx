'use client';

import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  Clock,
  Lock,
  X,
  Building2,
  ArrowLeft,
  Music,
  Check,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';

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
};

const EXCLUDED_LIFECYCLE = ['draft', 'deleted', 'cancelled', 'denied'];
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

function formatDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fmt12(t: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function toMins(t: string) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function timeOverlaps(s1: string, e1: string, s2: string, e2: string) {
  if (!s1 || !e1 || !s2 || !e2) return true;
  let a = toMins(s1),
    b = toMins(e1),
    c = toMins(s2),
    d = toMins(e2);
  if (b < a) b += 1440;
  if (d < c) d += 1440;
  return !(b <= c || a >= d);
}

function filterVisible(events: any[]) {
  return (events || []).filter(
    (e: any) => !EXCLUDED_LIFECYCLE.includes(e.lifecycle || e.status || 'draft'),
  );
}

// ── Timeline helpers ──
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

const BLOCK_TIMES: string[] = (() => {
  const out: string[] = [];
  for (let h = 14; h < 24; h++)
    ['00', '30'].forEach((m) => out.push(`${String(h).padStart(2, '0')}:${m}`));
  for (let h = 0; h <= 4; h++)
    ['00', '30'].forEach((m) => out.push(`${String(h).padStart(2, '0')}:${m}`));
  return out;
})();

const SELECT_TIMES: string[] = (() => {
  const times = [];
  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, '0');
    times.push(`${hh}:00`);
    times.push(`${hh}:30`);
  }
  return times;
})();

// ── Main component ──────────────────────────────────────────────────────────

export function VenueEventCalendar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useDashboardAuth();
  const rm = useReducedMotion();

  const venueId = searchParams.get('venueId') || '';
  const venueName = searchParams.get('venueName') || 'Your Venue';

  const initialDate = searchParams.get('date');
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (initialDate) {
      const parsed = new Date(initialDate);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  });
  const [calendarData, setCalendarData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate || null);
  const [confirmChecking, setConfirmChecking] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  const authedFetch = useCallback(
    async (url: string) => {
      if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken(true);
      return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    },
    [user],
  );

  useEffect(() => {
    if (!venueId) return;
    const load = async () => {
      setLoading(true);
      try {
        const startDate = formatDate(
          new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1),
        );
        const endDate = formatDate(
          new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0),
        );
        const res = await authedFetch(
          `/api/partners/venues/calendar?venueId=${venueId}&view=operating&startDate=${startDate}&endDate=${endDate}`,
        );
        const data = await res.json();
        // Operating view returns a raw array or wrapped in calendar/days
        const rawDays = Array.isArray(data) ? data : data.calendar || data.days || [];
        setCalendarData(rawDays);
      } catch (err) {
        console.error('Failed to fetch venue calendar:', err);
        setCalendarData([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [venueId, currentMonth, authedFetch]);

  const today = formatDate(new Date());
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDayIdx = useMemo(() => new Date(year, month, 1).getDay(), [year, month]);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((firstDayIdx + daysInMonth) / 7);
  const dataMap = useMemo(() => new Map(calendarData.map((d) => [d.date, d])), [calendarData]);

  const grid = useMemo(() => {
    const g: any[] = [];
    for (let i = 0; i < firstDayIdx; i++) g.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = formatDate(new Date(year, month, d));
      const raw = dataMap.get(dateStr);
      const col = firstDayIdx + d - 1;
      g.push({
        day: d,
        dateStr,
        isPast: dateStr < today,
        isWeekend: col % 7 === 0 || col % 7 === 6,
        state: raw?.state || 'OPEN',
        events: filterVisible(raw?.events),
        slots: raw?.slots || [],
        stats: raw?.stats || { eventCount: 0, pendingSlots: 0 },
        block: raw?.block || null,
      });
    }
    return g;
  }, [calendarData, year, month, daysInMonth, firstDayIdx, today, dataMap]);

  const selectedDayData = useMemo(
    () => grid.find((d) => d?.dateStr === selectedDate),
    [grid, selectedDate],
  );

  const stats = useMemo(
    () => ({
      events: calendarData.filter((d) => filterVisible(d.events).length > 0).length,
      blocked: calendarData.filter((d) => d.state === 'BLOCKED').length,
    }),
    [calendarData],
  );

  const navigateMonth = (delta: number) => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    setSelectedDate(null);
  };

  const handleConfirm = async (
    startTime: string,
    endTime: string,
    doorsOpen: string,
    lastEntry: string,
  ) => {
    if (!selectedDate) return;

    setConfirmChecking(true);
    setConfirmError('');
    try {
      // Verify availability one last time before navigating
      const res = await authedFetch(
        `/api/partners/venues/calendar?venueId=${venueId}&view=operating&startDate=${selectedDate}&endDate=${selectedDate}`,
      );
      const data = await res.json();
      const day = Array.isArray(data) ? data[0] : (data.calendar || data.days || [])[0];

      const visibleEvents = filterVisible(day?.events);
      const hasConflict = visibleEvents.some((e: any) =>
        timeOverlaps(e.startTime || '21:00', e.endTime || '04:00', startTime, endTime),
      );

      if (day?.state === 'BLOCKED' || hasConflict) {
        setConfirmError('This slot was just taken or blocked. Please choose another time.');
        return;
      }

      const params = new URLSearchParams({
        venue: venueId,
        venueName,
        date: selectedDate,
        startTime,
        endTime,
        doorsOpen,
        lastEntry,
      });
      router.push(`/venue/create?${params.toString()}`);
    } catch (err) {
      console.error('Verification failed:', err);
      setConfirmError('Failed to verify availability. Please try again.');
    } finally {
      setConfirmChecking(false);
    }
  };

  if (!venueId) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <p style={{ color: 'rgba(255,255,255,0.35)' }}>No venue selected.</p>
          <button
            onClick={() => router.push('/venue/create/select-venue')}
            className="mt-4 px-6 py-3 rounded-xl text-sm font-black text-white uppercase tracking-wider"
            style={{ background: C.orange }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <button
          onClick={() => router.push('/venue/create/select-venue')}
          className="flex items-center gap-2 self-start transition-all"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-[11px] font-black uppercase tracking-widest">Back to Venues</span>
        </button>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'rgba(244,74,34,0.15)',
                border: '1px solid rgba(244,74,34,0.25)',
              }}
            >
              <Building2 className="w-7 h-7" style={{ color: C.orange }} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white uppercase tracking-tight">
                {venueName}
              </h1>
              <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Select an available date and time for your event
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {stats.events > 0 && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black border"
                style={{
                  background: 'rgba(52,211,153,.12)',
                  color: C.teal,
                  borderColor: 'rgba(52,211,153,.25)',
                }}
              >
                <span className="tabular-nums text-[11px]">{stats.events}</span>
                <span className="uppercase tracking-widest opacity-70">Events</span>
              </div>
            )}
            {stats.blocked > 0 && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black border"
                style={{
                  background: 'rgba(248,113,113,.12)',
                  color: C.red,
                  borderColor: 'rgba(248,113,113,.25)',
                }}
              >
                <span className="tabular-nums text-[11px]">{stats.blocked}</span>
                <span className="uppercase tracking-widest opacity-70">Blocked</span>
              </div>
            )}

            <div
              className="flex items-center rounded-2xl overflow-hidden"
              style={{ background: C.surface, border: `1px solid ${C.borderDefault}` }}
            >
              <button
                onClick={() => navigateMonth(-1)}
                className="w-10 h-10 flex items-center justify-center transition-colors hover:bg-white/5"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span
                className="px-4 text-[13px] font-black tracking-tight uppercase text-white min-w-[150px] text-center"
                style={{
                  borderLeft: `1px solid ${C.borderDefault}`,
                  borderRight: `1px solid ${C.borderDefault}`,
                }}
              >
                {MONTHS[month]} {year}
              </span>
              <button
                onClick={() => navigateMonth(1)}
                className="w-10 h-10 flex items-center justify-center transition-colors hover:bg-white/5"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        className="flex flex-col lg:flex-row rounded-[28px] overflow-hidden"
        style={{
          background: '#16161b',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
          minHeight: 640,
        }}
      >
        <div
          className="lg:flex-[2.4] flex flex-col"
          style={{ borderRight: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="grid grid-cols-7 px-4 pt-5 pb-3 flex-shrink-0">
            {DAYS.map((d, i) => (
              <div
                key={d}
                className="text-center text-[9px] font-black uppercase tracking-[0.15em] py-1"
                style={{
                  color: i === 0 || i === 6 ? 'rgba(244,74,34,0.6)' : 'rgba(255,255,255,0.28)',
                }}
              >
                {d}
              </div>
            ))}
          </div>

          <div
            className="flex-1 min-h-0 px-4 pb-4 grid grid-cols-7 gap-2"
            style={{ gridTemplateRows: `repeat(${weeks}, 1fr)` }}
          >
            {loading
              ? Array.from({ length: 35 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl animate-pulse"
                    style={{ background: C.surface, minHeight: 56 }}
                  />
                ))
              : grid.map((cell, idx) => {
                  if (!cell) return <div key={`e-${idx}`} />;

                  const isToday = cell.dateStr === today;
                  const isSel = cell.dateStr === selectedDate;
                  const evCount = cell.events.length;
                  const hasPending = (cell.stats?.pendingSlots || 0) > 0;
                  const isBlocked = cell.state === 'BLOCKED';
                  const isPast = cell.isPast;
                  const hasEvents = evCount > 0;

                  let bg = isPast ? C.surfacePast : cell.isWeekend ? C.surfaceWeekend : C.surface;
                  let border = `1px solid ${isPast ? 'rgba(255,255,255,0.05)' : C.borderDefault}`;
                  let shadow = 'none';

                  if (isSel) {
                    bg = C.surfaceSelected;
                    border = `2px solid ${C.borderSelected}`;
                    shadow = '0 0 32px rgba(244,74,34,0.3), 0 8px 24px rgba(244,74,34,0.15)';
                  } else if (isToday) {
                    bg = C.surfaceToday;
                    border = `2px solid ${C.borderToday}`;
                    shadow = '0 0 20px rgba(244,74,34,0.12)';
                  } else if (isBlocked) {
                    bg = C.surfaceBlocked;
                    border = `1px solid ${C.borderBlocked}`;
                  } else if (hasEvents && !isPast) {
                    bg = C.surfaceEvent;
                    border = `1px solid ${C.borderEvent}`;
                    shadow = '0 4px 20px rgba(52,211,153,0.1)';
                  } else if (hasPending) {
                    bg = C.surfacePending;
                    border = `1px solid ${C.borderPending}`;
                  }

                  const numColor = isToday
                    ? 'white'
                    : isSel
                      ? C.orange
                      : isBlocked
                        ? C.red
                        : hasEvents && !isPast
                          ? C.teal
                          : isPast
                            ? 'rgba(255,255,255,0.28)'
                            : 'rgba(255,255,255,0.82)';

                  return (
                    <button
                      key={cell.dateStr}
                      onClick={() => !isPast && setSelectedDate(cell.dateStr)}
                      disabled={isPast}
                      className="relative rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-100"
                      style={{
                        background: bg,
                        border,
                        boxShadow: shadow,
                        cursor: isPast ? 'not-allowed' : 'pointer',
                        opacity: isPast ? 0.42 : 1,
                        minHeight: 56,
                      }}
                    >
                      {hasEvents && !isSel && !isPast && (
                        <div
                          className="absolute inset-x-0 top-0 h-[3px] rounded-t-2xl"
                          style={{
                            background: `linear-gradient(90deg, ${C.teal}, rgba(52,211,153,0.3))`,
                          }}
                        />
                      )}
                      {isPast && (
                        <div
                          className="absolute inset-0 rounded-2xl pointer-events-none"
                          style={{
                            backgroundImage:
                              'repeating-linear-gradient(135deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 8px)',
                          }}
                        />
                      )}
                      {isToday ? (
                        <span
                          className="inline-flex items-center justify-center w-[26px] h-[26px] rounded-full text-[11px] font-black text-white tabular-nums"
                          style={{
                            background: C.orange,
                            boxShadow: '0 0 16px rgba(244,74,34,0.8)',
                          }}
                        >
                          {cell.day}
                        </span>
                      ) : (
                        <span
                          className="text-[15px] font-black tabular-nums"
                          style={{ color: numColor }}
                        >
                          {cell.day}
                        </span>
                      )}
                      {(hasEvents || hasPending || isBlocked) && !isPast && (
                        <div className="flex items-center gap-[3px]">
                          {hasEvents &&
                            Array.from({ length: Math.min(evCount, 3) }).map((_, i) => (
                              <span
                                key={i}
                                className="w-1 h-1 rounded-full"
                                style={{ background: C.teal }}
                              />
                            ))}
                          {hasPending && (
                            <span
                              className="w-1 h-1 rounded-full animate-pulse"
                              style={{ background: C.amber }}
                            />
                          )}
                          {isBlocked && (
                            <span className="w-1 h-1 rounded-full" style={{ background: C.red }} />
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
          </div>

          <div
            className="flex-shrink-0 flex items-center gap-6 px-6 py-3"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}
          >
            {[
              { color: C.teal, label: 'Confirmed', bg: C.surfaceEvent },
              { color: C.amber, label: 'Pending', bg: C.surfacePending },
              { color: C.red, label: 'Blocked', bg: C.surfaceBlocked },
            ].map(({ color, label, bg }) => (
              <div key={label} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-md"
                  style={{ background: bg, border: `1px solid ${color}40` }}
                />
                <span
                  className="text-[9px] font-black uppercase tracking-widest"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          className="lg:flex-[1] flex flex-col overflow-hidden"
          style={{ background: '#0f0f13' }}
        >
          <AnimatePresence mode="wait">
            {selectedDate && selectedDayData ? (
              <motion.div
                key={selectedDate}
                initial={rm ? {} : { opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={rm ? {} : { opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col h-full"
              >
                <RightPanel
                  dateStr={selectedDate}
                  data={selectedDayData}
                  confirmChecking={confirmChecking}
                  confirmError={confirmError}
                  onClose={() => setSelectedDate(null)}
                  onConfirm={handleConfirm}
                />
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={rm ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 flex flex-col items-center justify-center gap-6 p-10"
              >
                <div className="relative">
                  {[40, 32, 24].map((size, i) => (
                    <div
                      key={size}
                      className="absolute rounded-full"
                      style={{
                        width: size * 2,
                        height: size * 2,
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        border: `1px solid rgba(255,255,255,${0.03 + i * 0.015})`,
                      }}
                    />
                  ))}
                  <div
                    className="relative w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: C.surface, border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <Calendar className="w-6 h-6" style={{ color: 'rgba(244,74,34,0.6)' }} />
                  </div>
                </div>
                <div className="text-center">
                  <p
                    className="text-[11px] font-black uppercase tracking-widest mb-2"
                    style={{ color: 'rgba(255,255,255,0.4)' }}
                  >
                    Select a Date
                  </p>
                  <p
                    className="text-[11px] leading-relaxed max-w-[160px] mx-auto"
                    style={{ color: 'rgba(255,255,255,0.18)' }}
                  >
                    Choose a date on the calendar to see time slots
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ── Right Panel ─────────────────────────────────────────────────────────────

function RightPanel({
  dateStr,
  data,
  confirmChecking,
  confirmError,
  onClose,
  onConfirm,
}: {
  dateStr: string;
  data: any;
  confirmChecking: boolean;
  confirmError: string;
  onClose: () => void;
  onConfirm: (startTime: string, endTime: string, doorsOpen: string, lastEntry: string) => void;
}) {
  const isBlocked = data?.state === 'BLOCKED';
  const events = filterVisible(data?.events);
  const evCount = events.length;

  const [startTime, setStartTime] = useState('21:00');
  const [endTime, setEndTime] = useState('04:00');
  const [doorsOpen, setDoorsOpen] = useState('21:00');
  const [lastEntry, setLastEntry] = useState('04:00');
  const [timeModalOpen, setTimeModalOpen] = useState(false);
  const [timeConfirmed, setTimeConfirmed] = useState(false);

  const isTimeInvalid = useMemo(() => {
    return timeToMins(endTime) <= timeToMins(startTime);
  }, [startTime, endTime]);

  const fromDisabled = useMemo<Set<string>>(() => {
    const disabled = new Set<string>();
    BLOCK_TIMES.forEach((t) => {
      const tMins = timeToMins(t);
      if (
        events.some((e: any) => {
          const sMins = timeToMins(e.startTime || '21:00');
          const eMins = timeToMins(e.endTime || '04:00');
          return tMins >= sMins && tMins < eMins;
        })
      )
        disabled.add(t);
    });
    return disabled;
  }, [events]);

  const untilDisabled = useMemo<Set<string>>(() => {
    const disabled = new Set<string>();
    BLOCK_TIMES.forEach((t) => {
      if (
        events.some((e: any) =>
          timeOverlaps(startTime, t, e.startTime || '21:00', e.endTime || '04:00'),
        )
      )
        disabled.add(t);
    });
    return disabled;
  }, [events, startTime]);

  const handleStartChange = (t: string) => {
    setStartTime(t);
    setDoorsOpen(t);
    const newUntilDisabled = new Set<string>();
    BLOCK_TIMES.forEach((u) => {
      if (events.some((e: any) => timeOverlaps(t, u, e.startTime || '21:00', e.endTime || '04:00')))
        newUntilDisabled.add(u);
    });
    if (newUntilDisabled.has(endTime)) {
      const next = BLOCK_TIMES.find(
        (u) => !newUntilDisabled.has(u) && timeToMins(u) > timeToMins(t),
      );
      if (next) {
        setEndTime(next);
        setLastEntry(next);
      }
    }
  };

  const handleEndChange = (t: string) => {
    setEndTime(t);
    setLastEntry(t);
  };

  const hasOverlap = events.some((e: any) =>
    timeOverlaps(e.startTime || '21:00', e.endTime || '04:00', startTime, endTime),
  );

  const stateColor = isBlocked ? C.red : evCount > 0 ? C.teal : 'rgba(255,255,255,0.3)';
  const stateBg = isBlocked
    ? C.surfaceBlocked
    : evCount > 0
      ? C.surfaceEvent
      : 'rgba(255,255,255,0.04)';
  const stateBorder = isBlocked
    ? C.borderBlocked
    : evCount > 0
      ? C.borderEvent
      : 'rgba(255,255,255,0.08)';
  const stateLabel = isBlocked
    ? 'Blocked'
    : evCount > 0
      ? `${evCount} Event${evCount > 1 ? 's' : ''}`
      : 'Available';

  const d = new Date(`${dateStr}T00:00:00`);
  const dayNum = d.getDate();
  const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
  const monthStr = d.toLocaleDateString('en-US', { month: 'long' });
  const yearStr = d.getFullYear();

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const { nowPct, isActive, nowTimeStr } = useMemo(() => {
    const todayStr = formatDate(now);
    const yest = formatDate(new Date(now.getTime() - 86_400_000));
    const h = now.getHours(),
      m = now.getMinutes();
    const active = (h >= 14 && dateStr === todayStr) || (h < 4 && dateStr === yest);
    const mins = timeToMins(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    const h12 = h % 12 || 12;
    return {
      nowPct: pct(mins),
      isActive: active && mins >= 0 && mins <= TOTAL_MINS,
      nowTimeStr: `${h12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`,
    };
  }, [now, dateStr]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="flex-shrink-0 relative overflow-hidden px-6 pt-6 pb-5"
        style={{
          background: isBlocked
            ? 'linear-gradient(160deg, #1e0d0d 0%, #0f0f13 70%)'
            : evCount > 0
              ? 'linear-gradient(160deg, #0d2119 0%, #0f0f13 70%)'
              : 'linear-gradient(160deg, #1a100a 0%, #0f0f13 70%)',
        }}
      >
        <div
          className="absolute top-0 right-0 w-40 h-40 pointer-events-none"
          style={{
            background: isBlocked
              ? 'radial-gradient(circle at top right, rgba(248,113,113,0.18), transparent 65%)'
              : evCount > 0
                ? 'radial-gradient(circle at top right, rgba(52,211,153,0.15), transparent 65%)'
                : 'radial-gradient(circle at top right, rgba(244,74,34,0.12), transparent 65%)',
          }}
        />
        <div className="flex items-start justify-between relative z-10">
          <div>
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-4 border text-[9px] font-black uppercase tracking-widest"
              style={{ background: stateBg, borderColor: stateBorder, color: stateColor }}
            >
              <span
                className="w-[5px] h-[5px] rounded-full"
                style={{ background: stateColor, boxShadow: `0 0 6px ${stateColor}` }}
              />
              {stateLabel}
            </div>
            <div className="flex items-end gap-3">
              <span
                className="text-[52px] font-black leading-none tabular-nums"
                style={{ color: 'rgba(255,255,255,0.95)', letterSpacing: '-0.04em' }}
              >
                {dayNum}
              </span>
              <div className="pb-1">
                <p className="text-[16px] font-black leading-tight text-white">{dayName}</p>
                <p
                  className="text-[12px] font-medium leading-tight"
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                >
                  {monthStr} {yearStr}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/10 border border-transparent hover:border-white/10"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0.08) 70%, transparent)',
          }}
        />
      </div>

      <div
        className="flex-1 min-h-0 overflow-y-auto"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}
      >
        {isBlocked ? (
          <div className="px-5 pt-5 pb-4 space-y-4">
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(220,38,38,0.12)',
                border: '1px solid rgba(248,113,113,0.25)',
              }}
            >
              <div className="px-4 py-4 flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'rgba(220,38,38,0.3)',
                    border: '1px solid rgba(248,113,113,0.5)',
                  }}
                >
                  <Lock className="w-4 h-4" style={{ color: '#FCA5A5' }} />
                </div>
                <div>
                  <p className="text-[12px] font-black text-white">
                    {data?.block?.reason || 'Venue Blocked'}
                  </p>
                  <p
                    className="text-[10px] font-black tabular-nums mt-0.5"
                    style={{ color: 'rgba(248,113,113,0.7)' }}
                  >
                    {data?.block?.startTime
                      ? `${fmt12(data.block.startTime)} — ${fmt12(data.block.endTime)}`
                      : 'All Day'}
                  </p>
                </div>
              </div>
            </div>
            <NightScheduleTimeline
              events={[]}
              blockData={data?.block}
              isActive={isActive}
              nowPct={nowPct}
              nowTimeStr={nowTimeStr}
            />
            <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.25)' }}>
              This date is blocked. Manage blocks from the Calendar tab.
            </p>
          </div>
        ) : (
          <div className="px-5 pt-5 pb-4 space-y-5">
            <NightScheduleTimeline
              events={events}
              blockData={null}
              isActive={isActive}
              nowPct={nowPct}
              nowTimeStr={nowTimeStr}
            />

            <button
              onClick={() => setTimeModalOpen(true)}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-150 active:scale-[0.99] hover:brightness-110"
              style={{
                background: timeConfirmed ? 'rgba(52,211,153,0.07)' : 'rgba(244,74,34,0.07)',
                border: timeConfirmed
                  ? '1px solid rgba(52,211,153,0.25)'
                  : '1px solid rgba(244,74,34,0.2)',
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{
                    background: timeConfirmed ? 'rgba(52,211,153,0.15)' : 'rgba(244,74,34,0.15)',
                    border: timeConfirmed
                      ? '1px solid rgba(52,211,153,0.35)'
                      : '1px solid rgba(244,74,34,0.3)',
                  }}
                >
                  {timeConfirmed ? (
                    <Check className="w-3.5 h-3.5" style={{ color: '#34D399' }} />
                  ) : (
                    <Clock className="w-3.5 h-3.5" style={{ color: '#F44A22' }} />
                  )}
                </div>
                <div className="text-left">
                  <p className="text-[11px] font-black uppercase tracking-widest text-white">
                    {timeConfirmed ? 'Time Set' : 'Select Time'}
                  </p>
                  <p
                    className="text-[9px] font-medium mt-0.5"
                    style={{
                      color: timeConfirmed ? 'rgba(52,211,153,0.6)' : 'rgba(255,255,255,0.3)',
                    }}
                  >
                    {timeConfirmed
                      ? `Doors: ${fmt12(doorsOpen)} · Last Entry: ${fmt12(lastEntry)}`
                      : 'Tap to choose slot'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="text-[12px] font-black tabular-nums px-3 py-1 rounded-full"
                  style={{
                    background: timeConfirmed ? 'rgba(52,211,153,0.12)' : 'rgba(244,74,34,0.15)',
                    color: timeConfirmed ? '#34D399' : '#F44A22',
                    border: timeConfirmed
                      ? '1px solid rgba(52,211,153,0.25)'
                      : '1px solid rgba(244,74,34,0.25)',
                  }}
                >
                  {fmt12(startTime)} — {fmt12(endTime)}
                </span>
                <ChevronRight
                  className="w-4 h-4"
                  style={{ color: timeConfirmed ? 'rgba(52,211,153,0.5)' : 'rgba(244,74,34,0.5)' }}
                />
              </div>
            </button>
          </div>
        )}
      </div>

      <div
        className="flex-shrink-0 flex items-center gap-3 px-5 py-4"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.2)' }}
      >
        {!isBlocked && (
          <button
            onClick={() =>
              timeConfirmed &&
              !hasOverlap &&
              !isTimeInvalid &&
              onConfirm(startTime, endTime, doorsOpen, lastEntry)
            }
            disabled={!timeConfirmed || hasOverlap || isTimeInvalid || confirmChecking}
            className="flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2"
            style={{
              background:
                !timeConfirmed || hasOverlap || isTimeInvalid || confirmChecking
                  ? 'rgba(255,255,255,0.06)'
                  : 'linear-gradient(135deg, #F44A22 0%, #FF6B4A 100%)',
              color:
                !timeConfirmed || hasOverlap || isTimeInvalid || confirmChecking
                  ? 'rgba(255,255,255,0.2)'
                  : 'white',
              cursor:
                !timeConfirmed || hasOverlap || isTimeInvalid || confirmChecking
                  ? 'not-allowed'
                  : 'pointer',
              boxShadow:
                !timeConfirmed || hasOverlap || isTimeInvalid || confirmChecking
                  ? 'none'
                  : '0 4px 24px rgba(244,74,34,0.45), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          >
            {confirmChecking ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              (!timeConfirmed || isTimeInvalid) && <Lock className="w-3 h-3" />
            )}
            {confirmChecking
              ? 'Verifying...'
              : !timeConfirmed || isTimeInvalid
                ? 'Invalid Time Slot'
                : 'Continue to Create Event'}
          </button>
        )}
        {confirmError && (
          <p className="text-[11px] font-medium text-red-400 absolute bottom-16 left-5 right-5">
            {confirmError}
          </p>
        )}
        {isTimeInvalid && (
          <p className="text-[11px] font-medium text-red-400 absolute bottom-16 left-5 right-5 text-center">
            End time of event must be after the start time
          </p>
        )}
        <button
          onClick={onClose}
          className="px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors hover:bg-white/5"
          style={{
            color: 'rgba(255,255,255,0.4)',
            border: '1px solid rgba(255,255,255,0.08)',
            flex: isBlocked ? 1 : 'none',
          }}
        >
          Close
        </button>
      </div>

      {timeModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={() => setTimeModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-3xl overflow-hidden"
            style={{
              background: '#141418',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-6 pt-6 pb-5"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center"
                  style={{
                    background: 'rgba(244,74,34,0.15)',
                    border: '1px solid rgba(244,74,34,0.3)',
                  }}
                >
                  <Clock className="w-5 h-5" style={{ color: '#F44A22' }} />
                </div>
                <div>
                  <p className="text-[16px] font-black text-white">Select Time Slot</p>
                  <p
                    className="text-[12px] font-medium mt-0.5"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                  >
                    {dayName}, {monthStr} {dayNum}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTimeModalOpen(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                <X className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.5)' }} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <TimePicker
                label="FROM"
                value={startTime}
                onChange={handleStartChange}
                disabledTimes={fromDisabled}
              />

              {(() => {
                const si = BLOCK_TIMES.indexOf(startTime);
                const ei = BLOCK_TIMES.indexOf(endTime);
                const total = BLOCK_TIMES.length;
                const left = (si / total) * 100;
                const rawWidth =
                  si <= ei ? ((ei - si) / total) * 100 : ((total - si + ei) / total) * 100;
                return (
                  <div
                    className="relative h-1.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.06)' }}
                  >
                    <div
                      className="absolute top-0 h-full rounded-full transition-all duration-200"
                      style={{
                        left: `${left}%`,
                        width: `${Math.min(rawWidth, 100 - left)}%`,
                        background: hasOverlap
                          ? 'rgba(248,113,113,0.7)'
                          : 'linear-gradient(90deg, #F44A22, #FF6B4A)',
                        boxShadow: hasOverlap
                          ? '0 0 6px rgba(248,113,113,0.4)'
                          : '0 0 10px rgba(244,74,34,0.55)',
                      }}
                    />
                  </div>
                );
              })()}

              <TimePicker
                label="UNTIL"
                value={endTime}
                onChange={handleEndChange}
                disabledTimes={untilDisabled}
              />

              <div className="grid grid-cols-2 gap-5 pt-3 border-t border-white/5">
                <div>
                  <label
                    className="block text-[9px] font-black uppercase tracking-widest mb-1.5"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                  >
                    Doors Open
                  </label>
                  <select
                    value={doorsOpen}
                    onChange={(e) => setDoorsOpen(e.target.value)}
                    className="w-full rounded-xl px-3.5 py-2.5 text-[13px] font-black text-white border transition-colors focus:outline-none focus:border-orange-500 appearance-none cursor-pointer"
                    style={{
                      background: '#0f0f14',
                      borderColor: 'rgba(255,255,255,0.08)',
                    }}
                  >
                    {(() => {
                      const options = [...SELECT_TIMES];
                      if (doorsOpen && !options.includes(doorsOpen)) {
                        options.push(doorsOpen);
                        options.sort();
                      }
                      return options.map((t) => (
                        <option key={t} value={t} className="bg-[#0f0f14] text-white">
                          {fmt12(t)}
                        </option>
                      ));
                    })()}
                  </select>
                </div>
                <div>
                  <label
                    className="block text-[9px] font-black uppercase tracking-widest mb-1.5"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                  >
                    Last Entry
                  </label>
                  <select
                    value={lastEntry}
                    onChange={(e) => setLastEntry(e.target.value)}
                    className="w-full rounded-xl px-3.5 py-2.5 text-[13px] font-black text-white border transition-colors focus:outline-none focus:border-orange-500 appearance-none cursor-pointer"
                    style={{
                      background: '#0f0f14',
                      borderColor: 'rgba(255,255,255,0.08)',
                    }}
                  >
                    {(() => {
                      const options = [...SELECT_TIMES];
                      if (lastEntry && !options.includes(lastEntry)) {
                        options.push(lastEntry);
                        options.sort();
                      }
                      return options.map((t) => (
                        <option key={t} value={t} className="bg-[#0f0f14] text-white">
                          {fmt12(t)}
                        </option>
                      ));
                    })()}
                  </select>
                </div>
              </div>

              {hasOverlap && (
                <div
                  className="flex items-center gap-2.5 px-4 py-3 rounded-xl"
                  style={{
                    background: 'rgba(248,113,113,0.08)',
                    border: '1px solid rgba(248,113,113,0.2)',
                  }}
                >
                  <Lock className="w-4 h-4 flex-shrink-0" style={{ color: C.red }} />
                  <p className="text-[12px] font-black" style={{ color: 'rgba(248,113,113,0.8)' }}>
                    Overlaps with an existing event — adjust your times
                  </p>
                </div>
              )}

              {isTimeInvalid && (
                <div
                  className="flex items-center gap-2.5 px-4 py-3 rounded-xl"
                  style={{
                    background: 'rgba(248,113,113,0.08)',
                    border: '1px solid rgba(248,113,113,0.2)',
                  }}
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#F87171' }} />
                  <p className="text-[12px] font-black" style={{ color: 'rgba(248,113,113,0.8)' }}>
                    End time of event must be after the start time
                  </p>
                </div>
              )}

              <button
                onClick={() => {
                  if (!hasOverlap && !isTimeInvalid) {
                    setTimeConfirmed(true);
                    setTimeModalOpen(false);
                  }
                }}
                disabled={hasOverlap || isTimeInvalid}
                className="w-full py-4 rounded-2xl text-[14px] font-black uppercase tracking-widest transition-all duration-200 active:scale-[0.98]"
                style={{
                  background:
                    hasOverlap || isTimeInvalid
                      ? 'rgba(255,255,255,0.06)'
                      : 'linear-gradient(135deg, #F44A22 0%, #FF6B4A 100%)',
                  color: hasOverlap || isTimeInvalid ? 'rgba(255,255,255,0.2)' : 'white',
                  cursor: hasOverlap || isTimeInvalid ? 'not-allowed' : 'pointer',
                  boxShadow:
                    hasOverlap || isTimeInvalid
                      ? 'none'
                      : '0 4px 24px rgba(244,74,34,0.45), inset 0 1px 0 rgba(255,255,255,0.15)',
                }}
              >
                Confirm Time
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TimePicker({
  label,
  value,
  onChange,
  disabledTimes = new Set(),
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabledTimes?: Set<string>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const getPeriod = (t: string): 'AM' | 'PM' => (parseInt(t.split(':')[0]) >= 12 ? 'PM' : 'AM');
  const [period, setPeriod] = useState<'AM' | 'PM'>(() => getPeriod(value));

  useEffect(() => {
    setPeriod(getPeriod(value));
  }, [value]);
  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current.querySelector("[data-selected='true']") as HTMLElement | null;
    if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [value, period]);

  const handlePeriodChange = (p: 'AM' | 'PM') => {
    setPeriod(p);
    const inPeriod = BLOCK_TIMES.filter((t) => getPeriod(t) === p);
    if (!inPeriod.includes(value)) {
      const first = inPeriod.find((t) => !disabledTimes.has(t));
      if (first) onChange(first);
    }
  };

  const visibleTimes = BLOCK_TIMES.filter((t) => getPeriod(t) === period);
  const visibleIdx = visibleTimes.indexOf(value);
  const canPrev = visibleIdx > 0 && !disabledTimes.has(visibleTimes[visibleIdx - 1]);
  const canNext =
    visibleIdx < visibleTimes.length - 1 && !disabledTimes.has(visibleTimes[visibleIdx + 1]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[13px] font-black uppercase tracking-widest shrink-0"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          {label}
        </span>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-0.5 p-1 rounded-lg"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {(['PM', 'AM'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePeriodChange(p)}
                className="px-3 py-1.5 rounded-md text-[11px] font-black uppercase tracking-widest transition-all duration-150"
                style={{
                  background: period === p ? '#F44A22' : 'transparent',
                  color: period === p ? '#fff' : 'rgba(255,255,255,0.3)',
                }}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canPrev}
              onClick={() => canPrev && onChange(visibleTimes[visibleIdx - 1])}
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-white/5 bg-white/5 disabled:opacity-20"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span
              className="text-[17px] font-black tabular-nums min-w-[90px] text-center"
              style={{ color: '#F44A22' }}
            >
              {fmt12(value)}
            </span>
            <button
              type="button"
              disabled={!canNext}
              onClick={() => canNext && onChange(visibleTimes[visibleIdx + 1])}
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-white/5 bg-white/5 disabled:opacity-20"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      <div ref={scrollRef} className="flex gap-2.5 overflow-x-auto py-1 no-scrollbar">
        {visibleTimes.map((t) => {
          const isSel = t === value;
          const isDisabled = disabledTimes.has(t);
          return (
            <button
              key={t}
              data-selected={isSel}
              type="button"
              disabled={isDisabled}
              onClick={() => {
                if (!isDisabled) onChange(t);
              }}
              className={`flex-shrink-0 px-4 py-2.5 rounded-full text-[13px] font-black tabular-nums transition-all ${isSel ? 'bg-[#F44A22] text-white' : 'bg-white/5 text-white/50'} disabled:opacity-20`}
            >
              {fmt12(t)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const NightScheduleTimeline = memo(function NightScheduleTimeline({
  events,
  blockData,
  isActive,
  nowPct,
  nowTimeStr,
}: {
  events: any[];
  blockData: any;
  isActive: boolean;
  nowPct: string;
  nowTimeStr: string;
}) {
  const isBlocked = !!blockData;
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-3 h-3 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }} />
        <span
          className="text-[9px] font-black uppercase tracking-[0.18em]"
          style={{ color: 'rgba(255,255,255,0.25)' }}
        >
          Night Schedule
        </span>
        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <span className="text-[9px] font-black" style={{ color: 'rgba(255,255,255,0.2)' }}>
          2 PM — 4 AM
        </span>
      </div>
      <div className="flex gap-3">
        <div className="flex-shrink-0 w-10 relative" style={{ height: 340 }}>
          {TIMELINE_HOURS.map(({ label, mins }) => (
            <div
              key={label}
              className="absolute right-0 flex items-center justify-end"
              style={{ top: `${(mins / TOTAL_MINS) * 100}%`, transform: 'translateY(-50%)' }}
            >
              <span
                className="text-[8px] font-black uppercase leading-none"
                style={{
                  color: mins % 240 === 0 ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.22)',
                }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
        <div
          className="flex-1 relative rounded-2xl overflow-hidden"
          style={{ height: 340, background: '#141418', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {TIMELINE_HOURS.slice(0, -1).map(({ mins }, i) => (
            <div
              key={`b-${i}`}
              className="absolute left-0 right-0"
              style={{
                top: `${(mins / TOTAL_MINS) * 100}%`,
                height: `${((TIMELINE_HOURS[i + 1].mins - mins) / TOTAL_MINS) * 100}%`,
                background: i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'transparent',
              }}
            />
          ))}
          {TIMELINE_HOURS.map(({ mins }) => (
            <div
              key={`l-${mins}`}
              className="absolute left-0 right-0 h-px"
              style={{
                top: `${(mins / TOTAL_MINS) * 100}%`,
                background: mins % 240 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
              }}
            />
          ))}
          {isActive && (
            <div
              className="absolute left-0 right-0 z-30 pointer-events-none"
              style={{ top: nowPct }}
            >
              <div
                className="absolute left-0 right-0 h-[1.5px]"
                style={{ background: `linear-gradient(90deg, ${C.orange} 40%, transparent)` }}
              />
              <div
                className="absolute -left-1 w-[10px] h-[10px] rounded-full -translate-y-1/2"
                style={{
                  background: C.orange,
                  boxShadow: `0 0 0 3px rgba(244,74,34,0.25), 0 0 14px rgba(244,74,34,0.6)`,
                }}
              />
              <div
                className="absolute right-2 -translate-y-1/2 flex items-center gap-1 px-2 py-[3px] rounded-full"
                style={{ background: C.orange }}
              >
                <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                <span className="text-[8px] font-black text-white tracking-wide">{nowTimeStr}</span>
              </div>
            </div>
          )}
          {isBlocked &&
            (() => {
              const sMin = timeToMins(blockData?.startTime || '20:00'),
                eMin = timeToMins(blockData?.endTime || '04:00');
              return (
                <div
                  className="absolute left-0 right-0 z-10 flex flex-col items-center justify-center"
                  style={{
                    top: pct(sMin),
                    height: `${((eMin - sMin) / TOTAL_MINS) * 100}%`,
                    background: 'rgba(220,38,38,0.28)',
                    borderTop: '2px solid rgba(248,113,113,0.8)',
                    borderBottom: '2px solid rgba(248,113,113,0.8)',
                  }}
                >
                  <Lock className="w-4 h-4 text-red-300" />
                  <span className="text-[9px] font-black uppercase text-red-300">
                    {blockData?.reason || 'Blocked'}
                  </span>
                </div>
              );
            })()}
          {events.map((e: any, i: number) => {
            const sMin = timeToMins(e.startTime || '21:00'),
              eMin = timeToMins(e.endTime || '04:00');
            return (
              <div
                key={e.id || i}
                className="absolute left-1 right-1 rounded-xl z-20 overflow-hidden"
                style={{
                  top: pct(sMin),
                  height: `${Math.max(5, ((eMin - sMin) / TOTAL_MINS) * 100)}%`,
                  background: 'rgba(52,211,153,0.16)',
                  border: '1px solid rgba(52,211,153,0.25)',
                }}
              >
                <div
                  className="absolute left-0 top-0 bottom-0 w-[3px]"
                  style={{ background: C.teal }}
                />
                <div className="h-full pl-3 my-2">
                  <p className="text-[10px] font-black text-white uppercase truncate">
                    {e.title || 'Reserved'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
