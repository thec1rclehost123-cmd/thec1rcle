'use client';

import { ReactNode, useState, useEffect, useRef, useCallback } from 'react';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { Search, ChevronDown, Check, CalendarRange, BarChart3, X, Layers } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

/* ── Types ──────────────────────────────────────────────────────────────── */

export interface SectionDef {
  id: string;
  label: string;
}

interface StudioShellProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  role: 'venue' | 'host' | 'promoter';
  sections: SectionDef[];
  onEventChange?: (eventId: string | null) => void;
  heroBackground?: 'tinted' | 'plain';
}

/* ── EventPickerModal ───────────────────────────────────────────────────── */

interface EventPickerModalProps {
  events: { id: string; title: string }[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}

function EventPickerModal({ events, selectedId, onSelect, onClose }: EventPickerModalProps) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount, close on Escape
  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const allEvents = [{ id: null as string | null, title: 'All Events' }, ...events];
  const filtered = q.trim()
    ? allEvents.filter((e) => e.title.toLowerCase().includes(q.toLowerCase()))
    : allEvents;

  const nonAllEvents = events.filter(
    (e) => !q.trim() || e.title.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Panel */}
      <div
        className="w-full max-w-[520px] rounded-3xl overflow-hidden"
        style={{
          background: '#18181b',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 pt-5 pb-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(244,74,34,0.15)' }}
            >
              <CalendarRange className="w-4 h-4" style={{ color: '#F44A22' }} />
            </div>
            <div>
              <div className="text-[15px] font-bold" style={{ color: 'var(--v-text-primary)' }}>
                Select Event
              </div>
              <div className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {events.length} event{events.length !== 1 ? 's' : ''} available
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="relative">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: 'rgba(255,255,255,0.3)' }}
            />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search events..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl text-[14px] font-medium focus:outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'var(--v-text-primary)',
              }}
              onFocus={(e) => {
                (e.target as HTMLInputElement).style.border = '1px solid rgba(244,74,34,0.4)';
                (e.target as HTMLInputElement).style.background = 'rgba(244,74,34,0.04)';
              }}
              onBlur={(e) => {
                (e.target as HTMLInputElement).style.border = '1px solid rgba(255,255,255,0.08)';
                (e.target as HTMLInputElement).style.background = 'rgba(255,255,255,0.05)';
              }}
            />
            {q && (
              <button
                onClick={() => setQ('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
          {/* All Events option */}
          {!q.trim() && (
            <div className="px-4 pt-3 pb-1">
              <button
                onClick={() => onSelect(null)}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all text-left focus:outline-none"
                style={{
                  background:
                    selectedId === null ? 'rgba(244,74,34,0.1)' : 'rgba(255,255,255,0.03)',
                  border:
                    selectedId === null
                      ? '1px solid rgba(244,74,34,0.25)'
                      : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background:
                      selectedId === null ? 'rgba(244,74,34,0.15)' : 'rgba(255,255,255,0.06)',
                  }}
                >
                  <Layers
                    className="w-4.5 h-4.5"
                    style={{ color: selectedId === null ? '#F44A22' : 'rgba(255,255,255,0.4)' }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[14px] font-bold"
                    style={{ color: selectedId === null ? '#F44A22' : 'var(--v-text-primary)' }}
                  >
                    All Events
                  </div>
                  <div
                    className="text-[11px] font-medium mt-0.5"
                    style={{ color: 'rgba(255,255,255,0.35)' }}
                  >
                    Aggregated view across all events
                  </div>
                </div>
                {selectedId === null && (
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: '#F44A22' }}
                  >
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            </div>
          )}

          {/* Event list */}
          {(q.trim() ? filtered : nonAllEvents).length > 0 && (
            <div className="px-4 pt-2 pb-3">
              {!q.trim() && (
                <div
                  className="text-[10px] font-bold uppercase tracking-[0.14em] px-1 pb-2 pt-1"
                  style={{ color: 'rgba(255,255,255,0.25)' }}
                >
                  Events
                </div>
              )}
              <div className="space-y-1">
                {(q.trim() ? filtered.filter((e) => e.id !== null) : nonAllEvents).map(
                  (event, i) => {
                    const sel = selectedId === event.id;
                    // Cycle through accent dots
                    const dots = ['#F44A22', '#818CF8', '#34D399', '#FBBF24', '#22D3EE', '#EC4899'];
                    const dot = dots[i % dots.length];
                    return (
                      <button
                        key={event.id}
                        onClick={() => onSelect(event.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left focus:outline-none"
                        style={{
                          background: sel ? 'rgba(244,74,34,0.08)' : 'transparent',
                          border: sel ? '1px solid rgba(244,74,34,0.18)' : '1px solid transparent',
                        }}
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5"
                          style={{ background: dot, boxShadow: `0 0 6px ${dot}80` }}
                        />
                        <span
                          className="flex-1 text-[14px] font-semibold truncate"
                          style={{
                            color: sel ? 'var(--v-text-primary)' : 'rgba(255,255,255,0.65)',
                          }}
                        >
                          {event.title}
                        </span>
                        {sel && (
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                            style={{ background: '#F44A22' }}
                          >
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          )}

          {/* Empty state */}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                <Search className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.2)' }} />
              </div>
              <p
                className="text-[14px] font-semibold mb-1"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              >
                No events found
              </p>
              <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Try a different search term
              </p>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div
          className="flex items-center justify-center gap-1 px-5 py-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <kbd
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
            style={{
              background: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.3)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            ESC
          </kbd>
          <span
            className="text-[11px] font-medium ml-1"
            style={{ color: 'rgba(255,255,255,0.25)' }}
          >
            to close
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── StudioShell ────────────────────────────────────────────────────────── */

export default function StudioShell({
  children,
  title,
  subtitle,
  sections,
  onEventChange,
  heroBackground = 'tinted',
}: StudioShellProps) {
  const searchParams = useSearchParams();
  const urlEventId = searchParams.get('eventId');

  const { user, profile } = useDashboardAuth();
  const [activeSection, setActiveSection] = useState(sections[0]?.id ?? '');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(urlEventId);
  const [isOpen, setIsOpen] = useState(false);
  const [venueEvents, setVenueEvents] = useState<{ id: string; title: string }[]>([]);
  const userScrolling = useRef(true);

  /* ── Fetch events ──────────────────────────────────────────────────── */
  useEffect(() => {
    const pid = profile?.activeMembership?.partnerId;
    if (!pid || !user) return;
    user
      .getIdToken()
      .then((t: any) =>
        fetch(`/api/partners/venues/events?venueId=${pid}&limit=50`, {
          headers: { Authorization: `Bearer ${t}` },
        }),
      )
      .then((r: any) => (r.ok ? r.json() : { events: [] }))
      .then(({ events }: { events: any[] }) =>
        setVenueEvents(
          events
            .filter((e: any) => e.lifecycle !== 'draft' && e.status !== 'draft')
            .map((e: any) => ({ id: e.id, title: e.title || e.name || e.id })),
        ),
      )
      .catch(() => {});
  }, [profile, user]);

  /* ── URL sync ──────────────────────────────────────────────────────── */
  useEffect(() => {
    if (urlEventId && urlEventId !== selectedEventId) {
      setSelectedEventId(urlEventId);
      onEventChange?.(urlEventId);
    }
  }, [urlEventId]);

  /* ── IntersectionObserver for section tracking ─────────────────────── */
  useEffect(() => {
    const obs: IntersectionObserver[] = [];
    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const o = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && userScrolling.current) setActiveSection(id);
        },
        { rootMargin: '-30% 0px -50% 0px', threshold: 0 },
      );
      o.observe(el);
      obs.push(o);
    });
    return () => obs.forEach((o) => o.disconnect());
  }, [sections, children]);

  /* ── Helpers ────────────────────────────────────────────────────────── */
  const current = selectedEventId
    ? (venueEvents.find((e) => e.id === selectedEventId) ?? { title: 'All Events' })
    : { title: 'All Events' };

  const pickEvent = (id: string | null) => {
    setSelectedEventId(id);
    setIsOpen(false);
    onEventChange?.(id);
  };

  const scrollTo = useCallback((id: string) => {
    userScrolling.current = false;
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => {
      userScrolling.current = true;
    }, 800);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--v-canvas, #111113)' }}>
      {/* ── Hero header ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        {heroBackground === 'tinted' && (
          <>
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'linear-gradient(135deg, rgba(244,74,34,0.08) 0%, rgba(129,140,248,0.05) 50%, rgba(52,211,153,0.04) 100%)',
              }}
            />
            <div
              className="absolute top-0 right-0 w-[500px] h-[300px] pointer-events-none"
              style={{
                background:
                  'radial-gradient(ellipse at top right, rgba(244,74,34,0.12) 0%, transparent 60%)',
              }}
            />
          </>
        )}

        <div className="relative px-6 sm:px-8 lg:px-10 pt-8 pb-6">
          <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-6 flex-wrap">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: 'rgba(244,74,34,0.15)',
                  boxShadow: '0 0 24px rgba(244,74,34,0.15)',
                }}
              >
                <BarChart3 className="w-6 h-6" style={{ color: '#F44A22' }} />
              </div>
              <div>
                <h1
                  className="text-[32px] sm:text-[38px] font-black tracking-tight leading-none"
                  style={{ color: 'var(--v-text-primary)' }}
                >
                  {title}
                </h1>
                {subtitle ? (
                  <p
                    className="text-[14px] font-medium mt-1.5"
                    style={{ color: 'rgba(255,255,255,0.4)' }}
                  >
                    {subtitle}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Event picker trigger */}
            <button
              onClick={() => setIsOpen(true)}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all focus:outline-none shrink-0"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                minWidth: 220,
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(244,74,34,0.15)' }}
              >
                <CalendarRange className="w-4 h-4" style={{ color: '#F44A22' }} />
              </div>
              <div className="flex-1 text-left min-w-0">
                <div
                  className="text-[10px] font-bold uppercase tracking-[0.14em] mb-0.5"
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                >
                  Viewing
                </div>
                <div
                  className="text-[14px] font-bold truncate"
                  style={{ color: 'var(--v-text-primary)' }}
                >
                  {current.title}
                </div>
              </div>
              <ChevronDown
                className="w-4 h-4 shrink-0"
                style={{ color: 'rgba(255,255,255,0.3)' }}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ── Sticky section nav ─────────────────────────────────────── */}
      {sections.length > 0 && (
        <div
          className="sticky top-0 z-30"
          style={{
            background: 'rgba(17,17,19,0.85)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="max-w-[1440px] mx-auto px-6 sm:px-8 lg:px-10 py-3">
            <div
              className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide p-1 rounded-2xl"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {sections.map(({ id, label }) => {
                const active = activeSection === id;
                return (
                  <button
                    key={id}
                    onClick={() => scrollTo(id)}
                    className="px-5 py-2.5 rounded-xl text-[12px] font-bold uppercase tracking-[0.10em] shrink-0 transition-all focus:outline-none"
                    style={
                      active
                        ? {
                            background: '#F44A22',
                            color: '#fff',
                            boxShadow:
                              '0 2px 16px rgba(244,74,34,0.4), 0 0 0 1px rgba(244,74,34,0.5)',
                          }
                        : {
                            background: 'transparent',
                            color: 'rgba(255,255,255,0.45)',
                          }
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Content ────────────────────────────────────────────────── */}
      <main className="px-6 sm:px-8 lg:px-10 pt-8 pb-24">
        <div className="max-w-[1440px] mx-auto">{children}</div>
      </main>

      {/* ── Event picker modal ─────────────────────────────────────── */}
      {isOpen && (
        <EventPickerModal
          events={venueEvents}
          selectedId={selectedEventId}
          onSelect={pickEvent}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
