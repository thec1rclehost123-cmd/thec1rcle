"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AMBIENT_DOTS } from "./eventDetailUtils";

export function MiniAvatar({ person, size }) {
  const image = person?.photoURL || person?.avatar;
  const initials = String(person?.initials || person?.name || person?.displayName || "C")
    .slice(0, 2)
    .toUpperCase();
  const sizeClass = size === "xl" ? "h-full w-full" : size === "lg" ? "h-20 w-20 text-[20px]" : size === "sm" ? "h-8 w-8 text-[9px]" : "h-10 w-10 text-[10px]";

  return (
    <div className={`relative ${sizeClass} shrink-0 overflow-hidden rounded-full border border-white/20 bg-white/10 shadow-lg`}>
      {image ? (
        <Image
          src={image}
          alt={person?.name || person?.displayName || ""}
          width={48}
          height={48}
          className="h-full w-full object-cover"
          unoptimized
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-white/15 to-white/5 font-bold text-white/80">
          {initials}
        </div>
      )}
    </div>
  );
}

export function SectionLabel({ children, className = "" }) {
  return (
    <div className={`text-[10px] font-black uppercase tracking-[0.28em] text-white/40 ${className}`}>
      {children}
    </div>
  );
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const LIVE_WINDOW_MS = 6 * HOUR;

function getCountdownState(targetDate) {
  if (!targetDate) return { status: "hidden", diff: 0 };
  const diff = targetDate.getTime() - Date.now();
  if (diff > 0) return { status: "upcoming", diff };
  if (Math.abs(diff) <= LIVE_WINDOW_MS) return { status: "live", diff };
  return { status: "ended", diff };
}

function toCountdownParts(diff) {
  const remaining = Math.max(diff, 0);
  return {
    days: Math.floor(remaining / DAY),
    hours: Math.floor((remaining % DAY) / HOUR),
    minutes: Math.floor((remaining % HOUR) / MINUTE),
    seconds: Math.floor((remaining % MINUTE) / SECOND),
  };
}

function padCountdown(value) {
  return String(value).padStart(2, "0");
}

export function EventCountdown({ event, dominantColor }) {
  const targetDate = useMemo(() => {
    if (!event?.startDate) return null;
    const value = event?.startTime ? `${event.startDate}T${event.startTime}` : event.startDate;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [event?.startDate, event?.startTime]);

  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState(() => getCountdownState(targetDate));

  useEffect(() => {
    setMounted(true);
    setState(getCountdownState(targetDate));
    if (!targetDate) return undefined;
    const interval = window.setInterval(() => {
      setState(getCountdownState(targetDate));
    }, SECOND);
    return () => window.clearInterval(interval);
  }, [targetDate]);

  if (!mounted || !targetDate || state.status === "hidden") return null;

  const parts = toCountdownParts(state.diff);
  const countdownValue = `${padCountdown(parts.days)}:${padCountdown(parts.hours)}:${padCountdown(parts.minutes)}:${padCountdown(parts.seconds)}`;

  return (
    <GlassCard className="px-4 py-4 sm:px-5 sm:py-4" glowColor={dominantColor}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/42">
            {state.status === "upcoming" ? "Party starts in" : state.status === "live" ? "Party is live" : "Party closed"}
          </div>
          <div
            className="mt-1 font-black leading-none tracking-[-0.08em] text-white"
            style={{
              fontSize: "clamp(1.55rem, 4vw, 2.5rem)",
              textShadow: `0 0 22px rgba(${dominantColor}, 0.16), 0 0 42px rgba(${dominantColor}, 0.08)`,
            }}
          >
            {state.status === "upcoming" ? countdownValue : "00:00:00:00"}
          </div>
        </div>
        <span
          className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${state.status === "live" ? "bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.8)]" : "bg-white/70 shadow-[0_0_16px_rgba(255,255,255,0.28)]"}`}
        />
      </div>
    </GlassCard>
  );
}

export function AmbientDots({ dominantColor }) {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {AMBIENT_DOTS.map((dot, index) => (
          <span
            key={index}
            className="event-detail-dot absolute rounded-full"
            style={{
              left: dot.left,
              bottom: "-6%",
              width: `${dot.size}px`,
              height: `${dot.size}px`,
              animationDuration: `${dot.duration}s`,
              animationDelay: `${dot.delay}s`,
              "--dot-drift": `${dot.drift}px`,
              background: index % 3 === 0 ? "rgba(255,255,255,0.82)" : `rgba(${dominantColor}, ${index % 2 === 0 ? 0.88 : 0.62})`,
              boxShadow: index % 3 === 0
                ? "0 0 18px rgba(255,255,255,0.32)"
                : `0 0 20px rgba(${dominantColor}, 0.34)`,
            }}
          />
        ))}
      </div>
      <style jsx>{`
        .event-detail-dot {
          animation-name: event-detail-float;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          opacity: 0;
          will-change: transform, opacity;
        }

        @keyframes event-detail-float {
          0% {
            transform: translate3d(0, 0, 0);
            opacity: 0;
          }
          12% {
            opacity: 0.92;
          }
          82% {
            opacity: 0.85;
          }
          100% {
            transform: translate3d(var(--dot-drift), -110vh, 0);
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
}

export function GlassCard({ children, className = "", glowColor, onClick, as = "div", style }) {
  const Tag = as;
  const extraProps = {};

  if (as === "button") {
    extraProps.type = "button";
  }

  return (
    <Tag
      {...extraProps}
      onClick={onClick}
      className={`group relative overflow-hidden rounded-[24px] border border-solid bg-black/60 backdrop-blur-xl transition-all duration-300 ${onClick ? "cursor-pointer hover:-translate-y-0.5" : ""} ${className}`}
      style={{
        borderColor: glowColor ? `rgba(${glowColor}, 0.3)` : "rgba(255,255,255,0.08)",
        boxShadow: glowColor
          ? `0 24px 60px rgba(0,0,0,0.4), inset 0 0 40px rgba(${glowColor}, 0.1), inset 0 0 2px 1px rgba(${glowColor}, 0.2)`
          : "0 24px 60px rgba(0,0,0,0.4)",
        ...style,
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px] opacity-70"
        style={{
          background: glowColor ? `linear-gradient(90deg, transparent, rgba(${glowColor}, 0.8), transparent)` : "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)",
        }}
      />
      <div className="relative z-10 h-full">
        {children}
      </div>
    </Tag>
  );
}
