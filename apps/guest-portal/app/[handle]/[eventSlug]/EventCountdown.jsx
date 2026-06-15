'use client';

import { useEffect, useMemo, useState } from 'react';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const LIVE_WINDOW_MS = 6 * HOUR;

function getCountdownState(startDate) {
  if (!startDate) {
    return { status: 'hidden', target: null, diff: 0 };
  }

  const target = new Date(startDate);
  if (Number.isNaN(target.getTime())) {
    return { status: 'hidden', target: null, diff: 0 };
  }

  const diff = target.getTime() - Date.now();

  if (diff > 0) {
    return { status: 'upcoming', target, diff };
  }

  if (Math.abs(diff) <= LIVE_WINDOW_MS) {
    return { status: 'live', target, diff };
  }

  return { status: 'ended', target, diff };
}

function toParts(diff) {
  const remaining = Math.max(diff, 0);

  return {
    days: Math.floor(remaining / DAY),
    hours: Math.floor((remaining % DAY) / HOUR),
    minutes: Math.floor((remaining % HOUR) / MINUTE),
    seconds: Math.floor((remaining % MINUTE) / SECOND),
  };
}

function formatShortDate(date) {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    })
      .format(date)
      .toUpperCase();
  } catch {
    return '';
  }
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function CountdownCell({ value, label, accent = false }) {
  return (
    <div
      className={`relative overflow-hidden rounded-[1.6rem] border px-4 py-4 sm:px-5 sm:py-5 ${accent ? 'border-white/18 bg-white/[0.09]' : 'border-white/10 bg-black/20'}`}
    >
      <div className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      <div
        className={`text-[2rem] sm:text-[2.8rem] font-black tracking-[-0.08em] leading-none ${accent ? 'text-white' : 'text-white/88'}`}
      >
        {pad(value)}
      </div>
      <div className="mt-2 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.35em] text-white/38">
        {label}
      </div>
    </div>
  );
}

export default function EventCountdown({ startDate, title }) {
  const [state, setState] = useState(() => getCountdownState(startDate));

  useEffect(() => {
    setState(getCountdownState(startDate));

    if (!startDate) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setState(getCountdownState(startDate));
    }, SECOND);

    return () => window.clearInterval(interval);
  }, [startDate]);

  const parts = useMemo(() => toParts(state.diff), [state.diff]);

  if (state.status === 'hidden') {
    return null;
  }

  const eyebrow =
    state.status === 'live'
      ? 'In Motion'
      : state.status === 'ended'
        ? 'Night Archived'
        : 'Countdown';
  const headline =
    state.status === 'live'
      ? 'Doors are open.'
      : state.status === 'ended'
        ? 'This one already landed.'
        : parts.days > 0
          ? 'The room opens in'
          : 'Tonight starts in';

  const detail = state.target ? formatShortDate(state.target) : '';

  return (
    <section
      className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-white/[0.04] px-5 py-5 sm:px-6 sm:py-6"
      style={{
        boxShadow:
          '0 20px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 80px rgba(139,92,246,0.12)',
        backdropFilter: 'blur(18px)',
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_32%),radial-gradient(circle_at_85%_20%,rgba(139,92,246,0.18),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.03),transparent_55%)]" />
      <div className="absolute -right-10 top-8 h-28 w-28 rounded-full bg-violet-500/15 blur-3xl" />
      <div className="absolute left-8 bottom-0 h-24 w-24 rounded-full bg-fuchsia-400/10 blur-3xl" />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.38em] text-white/35">
              {eyebrow}
            </div>
            <h2 className="mt-3 max-w-[16rem] text-[1.65rem] sm:text-[2rem] font-black tracking-[-0.05em] leading-none text-white">
              {headline}
            </h2>
          </div>

          <div
            className={`mt-1 flex h-3 w-3 flex-shrink-0 rounded-full ${state.status === 'live' ? 'bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.8)]' : 'bg-violet-400 shadow-[0_0_20px_rgba(167,139,250,0.7)]'}`}
          />
        </div>

        <div className="mt-3 text-[11px] uppercase tracking-[0.26em] text-white/45">{detail}</div>

        {state.status === 'upcoming' ? (
          <>
            <div className="mt-6 grid grid-cols-4 gap-2 sm:gap-3">
              <CountdownCell value={parts.days} label="Days" />
              <CountdownCell value={parts.hours} label="Hours" accent />
              <CountdownCell value={parts.minutes} label="Minutes" />
              <CountdownCell value={parts.seconds} label="Seconds" />
            </div>

            <div className="mt-5 flex items-center justify-between gap-4">
              <p className="text-[12px] text-white/46 leading-relaxed">
                {title ? `${title} is on approach.` : 'Your night is on approach.'}
              </p>
              <div className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
            </div>
          </>
        ) : (
          <div className="mt-6 rounded-[1.4rem] border border-white/10 bg-black/20 px-4 py-5">
            <div className="text-[0.9rem] font-semibold text-white/88">
              {state.status === 'live'
                ? 'The event is likely happening right now.'
                : 'The countdown has closed for this event.'}
            </div>
            <div className="mt-2 text-[12px] leading-relaxed text-white/42">
              {state.status === 'live'
                ? 'Keep the ticket CTA hot and let the poster carry the energy.'
                : 'Guests can still use this page to revisit the lineup, venue, and promoter details.'}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
