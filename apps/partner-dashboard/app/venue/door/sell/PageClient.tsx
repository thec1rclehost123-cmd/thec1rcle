'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, CheckCircle2, AlertTriangle, Loader2, CalendarDays } from 'lucide-react';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { useDoorHub } from '@/lib/context/DoorHubContext';
import { cn } from '@/lib/utils';
import type { EventCapacity, DoorGender, DoorPurpose } from '@/lib/types/doorSell';
import { parseAsIST, toISODateIST } from '@c1rcle/core/time';

// ── Helpers ───────────────────────────────────────────────────────────────────

function idempotencyKey(uid: string) {
  return `door-${uid}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Convert any Firestore date shape to milliseconds.
 * Handles:
 *   - ISO / YYYY-MM-DD strings
 *   - Live Firestore Timestamps  (have .toDate())
 *   - Serialised Timestamps with underscores  { _seconds, _nanoseconds }
 *   - Serialised Timestamps without underscores { seconds, nanoseconds }
 *     (Firebase Admin SDK ≥ v12 uses this form after JSON.stringify)
 */
function toMs(raw: any): number {
  if (!raw) return NaN;
  if (typeof raw.toDate === 'function') return raw.toDate().getTime();
  if (typeof raw === 'object' && raw !== null) {
    const secs = raw._seconds ?? raw.seconds;
    const ns = raw._nanoseconds ?? raw.nanoseconds ?? 0;
    if (typeof secs === 'number') return secs * 1000 + Math.floor(ns / 1e6);
  }
  return parseAsIST(raw).getTime();
}

/** YYYY-MM-DD in IST for any event object */
function eventDateIST(e: any): string | null {
  const raw = e.startDate || e.date || e.eventDate;
  if (!raw) return null;
  try {
    const ms = toMs(raw);
    return isNaN(ms) ? null : toISODateIST(new Date(ms));
  } catch {
    return null;
  }
}

/** "10:30 PM" in IST for any event object — never returns "Invalid Date" */
function eventTimeDisplay(e: any): string {
  // 1. startTime stored as "HH:mm" from the event-creation wizard
  const st = e.startTime;
  if (typeof st === 'string' && /^\d{1,2}:\d{2}$/.test(st.trim())) {
    const [h, m] = st.trim().split(':').map(Number);
    return new Date(2024, 0, 1, h, m).toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
  // 2. Derive time from startDate / date
  const raw = e.startDate || e.date;
  if (!raw) return 'Time TBA';
  try {
    const ms = toMs(raw);
    if (isNaN(ms)) return 'Time TBA';
    return new Date(ms).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return 'Time TBA';
  }
}

// ── Capacity Bar ──────────────────────────────────────────────────────────────

function CapacityBar({ cap }: { cap: EventCapacity | null }) {
  if (!cap) return null;

  if (cap.total === 0) {
    return (
      <div
        className="rounded-2xl border px-5 py-4 flex items-center gap-3"
        style={{ background: 'var(--v-card)', borderColor: 'var(--v-border)' }}
      >
        <Users size={16} className="text-[var(--v-text-muted)] shrink-0" />
        <span className="text-[13px]" style={{ color: 'var(--v-text-secondary)' }}>
          No capacity limit configured for this event
        </span>
      </div>
    );
  }

  const pct = cap.capacityPercentage ?? 0;
  const isNear = cap.isNearCapacity ?? false;
  const barColor = cap.isSoldOut ? '#F87171' : isNear ? '#FBBF24' : '#34D399';

  return (
    <div
      className="rounded-2xl border px-5 py-4 space-y-3"
      style={{ background: 'var(--v-card)', borderColor: 'var(--v-border)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-[var(--v-text-muted)]" />
          <span
            className="text-[12px] font-bold uppercase tracking-widest"
            style={{ color: 'var(--v-text-tertiary)' }}
          >
            Capacity
          </span>
        </div>
        <div className="flex items-center gap-3 tabular-nums">
          <span className="text-[13px] font-semibold" style={{ color: 'var(--v-text-primary)' }}>
            {cap.currentCount ?? cap.soldCount + cap.doorWalkInCount}
            <span className="text-[var(--v-text-muted)] font-normal"> / {cap.total}</span>
          </span>
          {cap.isSoldOut ? (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-widest bg-red-500/10 text-red-400">
              Sold Out
            </span>
          ) : (
            <span
              className="px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums"
              style={{
                background: isNear ? 'rgba(251,191,36,0.1)' : 'rgba(52,211,153,0.1)',
                color: isNear ? '#FBBF24' : '#34D399',
              }}
            >
              {cap.available} left
            </span>
          )}
        </div>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--v-elevated)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: barColor }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
      {isNear && (
        <p className="text-[12px] font-medium text-amber-400 flex items-center gap-1.5">
          <AlertTriangle size={12} />
          {cap.availabilityMessage || `Near capacity — ${cap.available} spots remaining`}
        </p>
      )}
    </div>
  );
}

// ── Flash feedback ─────────────────────────────────────────────────────────────

type FlashState = { type: 'success' | 'error'; message: string } | null;

type EntryType = 'walkins' | 'dinein' | null;

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[12px] font-semibold" style={{ color: 'var(--v-text-secondary)' }}>
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  background: 'var(--v-elevated)',
  border: '1px solid var(--v-border)',
  color: 'var(--v-text-primary)',
} as React.CSSProperties;

// ── Main Component ─────────────────────────────────────────────────────────────

export function DoorSellClient() {
  const { profile, getIdToken } = useDashboardAuth();
  const hub = useDoorHub();
  const venueId = hub?.venueId ?? '';

  const nameRef = useRef<HTMLInputElement>(null);

  // ── Form state ────────────────────────────────────────────────────────────
  const [guestName, setGuestName] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<DoorGender | null>(null);
  const [age, setAge] = useState('');
  const [entryType, setEntryType] = useState<EntryType>(null);
  const [totalGuests, setTotalGuests] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState<FlashState>(null);

  // ── Capacity (walk-ins only, after event selected) ────────────────────────
  const [capacity, setCapacity] = useState<EventCapacity | null>(null);
  const [capLoading, setCapLoading] = useState(false);

  const authHeaders = useCallback(
    async () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await getIdToken()}`,
    }),
    [getIdToken],
  );

  // ── Today's events ────────────────────────────────────────────────────────
  // toISODateIST gives today's date as "YYYY-MM-DD" in IST — evergreen, no hardcoding
  const todayIST = toISODateIST(new Date());
  const todayEvents = (hub?.events ?? []).filter((e) => eventDateIST(e) === todayIST);

  // ── Fetch capacity when walk-in event is picked ───────────────────────────
  const fetchCapacity = useCallback(async () => {
    if (!selectedEventId || !venueId) return;
    setCapLoading(true);
    try {
      const res = await fetch(
        `/api/partners/venues/door/capacity?eventId=${selectedEventId}&venueId=${venueId}`,
        { headers: await authHeaders() },
      );
      if (res.ok) {
        const d = await res.json();
        setCapacity(d.capacity ?? null);
      }
    } finally {
      setCapLoading(false);
    }
  }, [selectedEventId, venueId, authHeaders]);

  useEffect(() => {
    setCapacity(null);
    if (selectedEventId) fetchCapacity();
  }, [selectedEventId]);

  // Reset event selection and dine-in guest count when type changes
  useEffect(() => {
    setSelectedEventId('');
    setCapacity(null);
    setTotalGuests('');
  }, [entryType]);

  // Autofocus name on mount
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const showFlash = (type: 'success' | 'error', message: string) => {
    setFlash({ type, message });
    setTimeout(() => setFlash(null), 2500);
  };

  const resetForm = () => {
    setGuestName('');
    setContact('');
    setEmail('');
    setGender(null);
    setAge('');
    setEntryType(null);
    setTotalGuests('');
    setSelectedEventId('');
    setCapacity(null);
    setTimeout(() => nameRef.current?.focus(), 50);
  };

  const soldOut = entryType === 'walkins' && capacity?.isSoldOut;

  const canSubmit =
    guestName.trim().length > 0 &&
    contact.length === 10 &&
    gender !== null &&
    age !== '' &&
    entryType !== null &&
    (entryType === 'dinein' || selectedEventId !== '') &&
    !submitting &&
    !soldOut;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (!venueId) {
      showFlash('error', 'Venue not loaded yet — please wait a moment and try again');
      return;
    }
    setSubmitting(true);
    const purpose: DoorPurpose = entryType === 'dinein' ? 'dinein' : 'party';
    try {
      const res = await fetch(`/api/partners/venues/door/sell?venueId=${venueId}`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          eventId: selectedEventId,
          venueId,
          guestName: guestName.trim(),
          contact: contact.trim(),
          email: email.trim() || undefined,
          age: parseInt(age, 10) || 0,
          partySize: entryType === 'dinein' ? parseInt(totalGuests, 10) || 1 : 1,
          totalGuests: entryType === 'dinein' ? parseInt(totalGuests, 10) || 1 : undefined,
          gender,
          purpose,
          idempotencyKey: idempotencyKey((profile as any)?.uid ?? 'staff'),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showFlash('error', data.error ?? 'Failed to create entry');
        return;
      }
      showFlash('success', purpose === 'party' ? 'Walk-in entry added' : 'Dine-in entry added');
      const eventTitle = hub?.events.find((e) => e.id === selectedEventId)?.title;
      hub?.addEntry({
        id: data.entryId ?? crypto.randomUUID(),
        guestName: guestName.trim(),
        contact: contact.trim(),
        email: email.trim() || undefined,
        gender: gender!,
        age: parseInt(age, 10) || 0,
        type: entryType as 'walkins' | 'dinein',
        totalGuests: entryType === 'dinein' ? parseInt(totalGuests, 10) || 1 : undefined,
        eventId: selectedEventId || undefined,
        eventTitle: eventTitle || undefined,
        submittedAt: new Date().toISOString(),
      });
      resetForm();
      if (data.remainingCapacity !== null && selectedEventId) {
        setCapacity((prev) =>
          prev
            ? {
                ...prev,
                available: data.remainingCapacity,
                isSoldOut: data.remainingCapacity === 0,
              }
            : prev,
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-xl">
      {/* Flash feedback */}
      <AnimatePresence>
        {flash && (
          <motion.div
            key="flash"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'rounded-2xl px-5 py-3 flex items-center gap-3 text-[13px] font-semibold',
              flash.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20',
            )}
          >
            {flash.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {flash.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Capacity bar — only visible after a walk-in event is selected */}
      {entryType === 'walkins' &&
        selectedEventId &&
        (capLoading ? (
          <div
            className="rounded-2xl border px-5 py-4 flex items-center gap-2"
            style={{ background: 'var(--v-card)', borderColor: 'var(--v-border)' }}
          >
            <Loader2 size={14} className="animate-spin text-[var(--v-text-muted)]" />
            <span className="text-[13px] text-[var(--v-text-muted)]">Checking capacity…</span>
          </div>
        ) : (
          <CapacityBar cap={capacity} />
        ))}

      {/* Sold-out banner */}
      {soldOut && (
        <div
          className="rounded-2xl border px-5 py-4 flex items-center gap-3"
          style={{ background: 'rgba(248,113,113,0.08)', borderColor: 'rgba(248,113,113,0.3)' }}
        >
          <AlertTriangle size={16} className="text-red-400 shrink-0" />
          <div>
            <p className="text-[13px] font-bold text-red-400">Event Sold Out</p>
            <p className="text-[12px] text-red-400/70">
              Walk-in entries are disabled. Dine-in is still available.
            </p>
          </div>
        </div>
      )}

      {/* Entry form card */}
      <div
        className="rounded-2xl border px-5 py-5 space-y-5"
        style={{ background: 'var(--v-card)', borderColor: 'var(--v-border)' }}
      >
        <p
          className="text-[11px] font-bold uppercase tracking-widest"
          style={{ color: 'var(--v-text-tertiary)' }}
        >
          Entry Form
        </p>

        {/* Person Name */}
        <Field label="Person Name" required>
          <input
            ref={nameRef}
            type="text"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && canSubmit && handleSubmit()}
            placeholder="Enter full name…"
            className="w-full rounded-xl px-4 py-3 text-[14px] outline-none transition-all"
            style={inputStyle}
            autoComplete="off"
          />
        </Field>

        {/* Contact No */}
        <Field label="Contact No" required>
          <input
            type="tel"
            value={contact}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
              setContact(digits);
            }}
            placeholder="10-digit mobile number"
            className="w-full rounded-xl px-4 py-3 text-[14px] outline-none transition-all"
            style={{
              ...inputStyle,
              ...(contact.length > 0 && contact.length < 10
                ? { border: '1px solid rgba(248,113,113,0.5)' }
                : {}),
            }}
            autoComplete="off"
            inputMode="numeric"
            maxLength={10}
          />
          {contact.length > 0 && contact.length < 10 && (
            <p className="text-[11px] font-medium text-red-400 mt-1 pl-1">
              Enter exactly 10 digits ({10 - contact.length} remaining)
            </p>
          )}
        </Field>

        {/* Email (optional) */}
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter email (optional)…"
            className="w-full rounded-xl px-4 py-3 text-[14px] outline-none transition-all"
            style={inputStyle}
            autoComplete="off"
            inputMode="email"
          />
        </Field>

        {/* Gender + Age — side by side */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Gender" required>
            <div className="flex gap-2 h-[46px]">
              {(['male', 'female'] as DoorGender[]).map((g) => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  className={cn(
                    'flex-1 rounded-xl text-[13px] font-bold capitalize transition-all active:scale-95',
                    gender === g
                      ? g === 'male'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                      : 'border hover:bg-[var(--v-card-hover)]',
                  )}
                  style={
                    gender !== g
                      ? {
                          background: 'var(--v-elevated)',
                          borderColor: 'var(--v-border)',
                          color: 'var(--v-text-muted)',
                        }
                      : {}
                  }
                >
                  {g === 'male' ? 'Male' : 'Female'}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Age" required>
            <input
              type="number"
              min={1}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Age"
              className="w-full rounded-xl px-4 py-3 text-[14px] outline-none transition-all"
              style={inputStyle}
              inputMode="numeric"
            />
          </Field>
        </div>

        {/* Type dropdown */}
        <Field label="Type" required>
          <select
            value={entryType ?? ''}
            onChange={(e) => setEntryType((e.target.value as EntryType) || null)}
            className="w-full rounded-xl px-4 py-3 text-[14px] outline-none transition-all appearance-none cursor-pointer"
            style={{
              ...inputStyle,
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 14px center',
              paddingRight: '36px',
            }}
          >
            <option value="" disabled style={{ background: 'var(--v-elevated)' }}>
              Select type…
            </option>
            <option value="walkins" style={{ background: 'var(--v-elevated)' }}>
              Walk-ins
            </option>
            <option value="dinein" style={{ background: 'var(--v-elevated)' }}>
              Dine-ins
            </option>
          </select>
        </Field>

        {/* Dine-ins: total guests field */}
        <AnimatePresence>
          {entryType === 'dinein' && (
            <motion.div
              key="total-guests"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <Field label="Guests with you" required>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={totalGuests}
                  onChange={(e) => setTotalGuests(e.target.value)}
                  placeholder="Total no. of guests…"
                  className="w-full rounded-xl px-4 py-3 text-[14px] outline-none transition-all"
                  style={inputStyle}
                  inputMode="numeric"
                />
              </Field>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Walk-ins: today's events list */}
        <AnimatePresence>
          {entryType === 'walkins' && (
            <motion.div
              key="today-events"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className="rounded-xl border overflow-hidden"
                style={{ borderColor: 'var(--v-border)' }}
              >
                <div
                  className="flex items-center gap-2 px-4 py-2.5 border-b"
                  style={{ background: 'var(--v-elevated)', borderColor: 'var(--v-border)' }}
                >
                  <CalendarDays size={13} className="text-[var(--v-text-muted)]" />
                  <span
                    className="text-[11px] font-bold uppercase tracking-widest"
                    style={{ color: 'var(--v-text-tertiary)' }}
                  >
                    Today's Events
                  </span>
                </div>

                {todayEvents.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-[13px]" style={{ color: 'var(--v-text-muted)' }}>
                      No event scheduled for today.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 flex flex-col gap-2">
                    {todayEvents.map((event) => {
                      const isSelected = selectedEventId === event.id;
                      const initial = (event.title ?? 'E').trim()[0].toUpperCase();
                      const isLive = (event as any).lifecycle === 'live' || event.status === 'live';
                      const timeStr = eventTimeDisplay(event);
                      return (
                        <button
                          key={event.id}
                          onClick={() => setSelectedEventId(event.id)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all active:scale-[0.98]',
                            isSelected
                              ? 'border border-[#F44A22]/40'
                              : 'border hover:bg-[var(--v-card-hover)]',
                          )}
                          style={{
                            background: isSelected ? 'rgba(244,74,34,0.08)' : 'var(--v-elevated)',
                            borderColor: isSelected ? 'rgba(244,74,34,0.4)' : 'var(--v-border)',
                          }}
                        >
                          {/* Avatar */}
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-[13px] font-black"
                            style={{
                              background: isSelected ? 'rgba(244,74,34,0.18)' : 'var(--v-card)',
                              color: isSelected ? '#F44A22' : 'var(--v-text-secondary)',
                            }}
                          >
                            {initial}
                          </div>

                          {/* Name + time */}
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-[13px] font-semibold truncate leading-tight"
                              style={{ color: isSelected ? '#F44A22' : 'var(--v-text-primary)' }}
                            >
                              {event.title}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {/* Live dot */}
                              {isLive && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                              )}
                              <p className="text-[11px]" style={{ color: 'var(--v-text-muted)' }}>
                                {timeStr || 'Time TBA'}
                              </p>
                            </div>
                          </div>

                          {/* Selection indicator */}
                          <div
                            className={cn(
                              'w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all',
                              isSelected ? 'border-[#F44A22]' : 'border-[var(--v-border)]',
                            )}
                          >
                            {isSelected && <div className="w-2 h-2 rounded-full bg-[#F44A22]" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={cn(
            'w-full py-3.5 rounded-xl text-[14px] font-black uppercase tracking-widest transition-all',
            canSubmit
              ? 'text-white hover:opacity-90 active:scale-[0.98]'
              : 'opacity-40 cursor-not-allowed text-white',
          )}
          style={{ background: soldOut ? '#F87171' : '#F44A22' }}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Adding…
            </span>
          ) : soldOut ? (
            'Event Sold Out'
          ) : (
            'Submit Entry'
          )}
        </button>
      </div>
    </div>
  );
}
