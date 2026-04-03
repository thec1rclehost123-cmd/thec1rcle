"use client";

import Link from "next/link";
import { useMemo, useState, useRef, useEffect, memo } from "react";
import ShimmerImage from "../ShimmerImage.jsx";
import { formatEventDate, formatEventTime } from "@c1rcle/core/time";
import { resolvePoster } from "@c1rcle/core/events";

/* ─── helpers ─── */
const getMonogram = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
};

const getDateParts = (dateValue) => {
    if (!dateValue) return { day: "--", month: "---", weekday: "" };
    let d;
    if (dateValue instanceof Date) {
        d = dateValue;
    } else if (typeof dateValue === "string") {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
            d = new Date(`${dateValue}T00:00:00+05:30`);
        } else {
            d = new Date(dateValue);
        }
    } else if (typeof dateValue?.toDate === "function") {
        d = dateValue.toDate();
    } else {
        d = new Date(dateValue);
    }
    if (isNaN(d.getTime())) return { day: "--", month: "---", weekday: "" };
    return {
        day: d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit" }),
        month: d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", month: "short" }).toUpperCase(),
        weekday: d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short" }).toUpperCase(),
    };
};

/**
 * DashboardEventCard v2 — Premium dark-mode event card
 * for THE C1RCLE partner dashboard.
 */
const DashboardEventCard = ({
    event,
    index = 0,
    height = "h-[260px] sm:h-[300px] md:h-[360px]",
    role = "venue",
    primaryAction,
    secondaryActions = [],
    status: statusOverride = null,
    showStats = false,
}) => {
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setShowMenu(false);
            }
        };
        if (showMenu) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showMenu]);

    /* ─── Price ─── */
    const priceDisplay = useMemo(() => {
        if (!event || !event.tickets || event.tickets.length === 0) {
            if (event?.isRSVP) return "Free";
            return event?.price ? `₹${event.price}` : "";
        }
        const paidTiers = event.tickets.filter((t) => Number(t.price) > 0);
        if (paidTiers.length === 0) return "Free";
        const lowestPaid = Math.min(...paidTiers.map((t) => Number(t.price)));
        return `From ₹${lowestPaid}`;
    }, [event]);

    const isFree = priceDisplay === "Free";

    /* ─── Status ─── */
    const status = useMemo(() => {
        if (!event) return { label: "DRAFT", dot: "bg-zinc-400", class: "text-zinc-300" };
        const lifecycle = statusOverride || event.lifecycle || event.status || "draft";
        const configs = {
            live: { label: "LIVE", dot: "bg-emerald-400", class: "text-emerald-300", pulse: true },
            scheduled: { label: "SCHEDULED", dot: "bg-blue-400", class: "text-blue-300" },
            approved: { label: "APPROVED", dot: "bg-blue-400", class: "text-blue-300" },
            submitted: { label: "PENDING", dot: "bg-amber-400", class: "text-amber-300" },
            pending: { label: "PENDING", dot: "bg-amber-400", class: "text-amber-300" },
            needs_changes: { label: "CHANGES", dot: "bg-rose-400", class: "text-rose-300" },
            denied: { label: "DENIED", dot: "bg-rose-400", class: "text-rose-300" },
            draft: { label: "DRAFT", dot: "bg-zinc-400", class: "text-zinc-300" },
            cancelled: { label: "CANCELLED", dot: "bg-zinc-500", class: "text-zinc-400" },
            completed: { label: "PAST", dot: "bg-zinc-500", class: "text-zinc-400" },
        };
        return configs[lifecycle] || configs.draft;
    }, [event, statusOverride]);

    if (!event) return null;

    const displayTime = formatEventTime(event.startTime || event.time, event.startDate || event.date, "");
    const displayVenue = event.venueName || event.venue || "Venue";
    const poster = resolvePoster(event);
    const dateParts = getDateParts(event.startDate || event.date);
    const hostName = event.hostName || event.host || "Host";

    return (
        <div className="group relative flex h-full w-full flex-col overflow-hidden rounded-[28px] bg-[#0d0d0f] transition-all duration-500 hover:-translate-y-1"
            style={{
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 2px 20px rgba(0,0,0,0.4), 0 20px 60px -20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
        >
            {/* ── Poster Section ── */}
            <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16 / 10" }}>
                {/* Image */}
                <ShimmerImage
                    src={poster}
                    alt={event.title}
                    fill
                    className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.06]"
                />

                {/* Vignette overlay — radial for cinematic feel */}
                <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background: `
                            radial-gradient(ellipse 82% 62% at 50% 38%, transparent 26%, rgba(13,13,15,0.52) 68%, rgba(13,13,15,0.95) 100%),
                            linear-gradient(to top, rgba(8,8,10,1) 0%, rgba(8,8,10,0.92) 18%, rgba(8,8,10,0.58) 38%, rgba(8,8,10,0.18) 62%, transparent 80%)
                        `,
                    }}
                />

                {/* — Status Pill (frosted, dark-native) — */}
                <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-black/50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] backdrop-blur-xl ${status.class}`}>
                        <span className={`inline-block h-[5px] w-[5px] rounded-full ${status.dot} ${status.pulse ? "animate-pulse" : ""}`} />
                        {status.label}
                    </span>
                    {priceDisplay && (
                        <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] backdrop-blur-xl ${isFree
                            ? "border-emerald-400/20 bg-emerald-400/8 text-emerald-400"
                            : "border-white/10 bg-black/50 text-white/80"
                            }`}>
                            {priceDisplay}
                        </span>
                    )}
                </div>

                {/* — Secondary Actions (top-right) — */}
                {secondaryActions.length > 0 && (
                    <div className="absolute right-4 top-4 z-30" ref={menuRef}>
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/8 bg-black/40 text-white/60 backdrop-blur-xl transition-all hover:bg-white/10 hover:text-white"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
                            </svg>
                        </button>
                        {showMenu && (
                            <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl border border-white/8 bg-[#111114]/95 p-1 backdrop-blur-2xl shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
                            >
                                {secondaryActions.map((action, i) =>
                                    action.href ? (
                                        <Link
                                            key={i}
                                            href={action.href}
                                            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/60 transition-all hover:bg-white/5 hover:text-white"
                                            onClick={() => setShowMenu(false)}
                                        >
                                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5">{action.icon}</span>
                                            {action.label}
                                        </Link>
                                    ) : (
                                        <button
                                            key={i}
                                            onClick={(e) => { e.stopPropagation(); action.onClick?.(); setShowMenu(false); }}
                                            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] transition-all hover:bg-white/5 ${action.color === "red" ? "text-rose-400 hover:text-rose-300" : "text-white/60 hover:text-white"}`}
                                        >
                                            <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${action.color === "red" ? "bg-rose-500/10" : "bg-white/5"}`}>{action.icon}</span>
                                            {action.label}
                                        </button>
                                    )
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* — Floating Title (over vignette, no box) — */}
                <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-4">
                    <div
                        className="max-w-[78%] rounded-[22px] px-4 py-3"
                        style={{
                            background: "linear-gradient(180deg, rgba(7,7,9,0.84) 0%, rgba(7,7,9,0.66) 100%)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            backdropFilter: "blur(14px)",
                            boxShadow: "0 18px 44px rgba(0,0,0,0.34)",
                        }}
                    >
                        <h3
                            className="line-clamp-2 text-[19px] font-black uppercase leading-[0.95] tracking-[-0.03em] text-white"
                            style={{ textShadow: "0 3px 18px rgba(0,0,0,0.72)" }}
                        >
                            {event.title}
                        </h3>
                        <p
                            className="mt-2 text-[11px] font-black uppercase tracking-[0.24em] text-[#F7D27A]"
                            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.55)" }}
                        >
                            {displayVenue}
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Metadata Section ── */}
            <div className="relative flex flex-1 flex-col px-5 pb-4 pt-3">

                {/* — Date + Time row — */}
                <div className="flex items-center gap-4">
                    {/* Date block */}
                    <div
                        className="flex min-w-[68px] flex-col items-center rounded-[24px] px-4 py-3"
                        style={{
                            background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.025) 100%)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                        }}
                    >
                        <span className="text-[34px] font-black leading-none tracking-[-0.04em] text-white">{dateParts.day}</span>
                        <span className="mt-1 text-[11px] font-black tracking-[0.26em] text-[#F97316]">{dateParts.month}</span>
                    </div>

                    {/* Divider */}
                    <div className="h-11 w-px bg-white/[0.1]" />

                    {/* Time + Host */}
                    <div className="flex-1 min-w-0">
                        {displayTime && (
                            <p className="text-[20px] font-black leading-none tracking-[-0.03em] text-white">
                                {displayTime}
                            </p>
                        )}
                        <div className="mt-2 flex items-center gap-2.5">
                            {/* Host monogram */}
                            <div className="relative flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
                                style={{
                                    background: "conic-gradient(from 180deg, #a78bfa, #ec4899, #f97316, #a78bfa)",
                                    padding: "1px",
                                }}
                            >
                                <div className="flex h-full w-full items-center justify-center rounded-full bg-[#0d0d0f]">
                                    <span className="text-[8px] font-black text-white/85">{getMonogram(hostName)}</span>
                                </div>
                            </div>
                            <span className="truncate text-[13px] font-bold tracking-[0.02em] text-white">{hostName}</span>
                        </div>
                    </div>

                    {/* Stats (if available) */}
                    {showStats && event.stats && (
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <div className="flex items-center gap-1 text-[10px] font-black tabular-nums text-white/82">
                                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500/50"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></svg>
                                {event.stats.ticketsSold || event.stats.rsvps || 0}
                            </div>
                            {event.stats.views > 0 && (
                                <div className="flex items-center gap-1 text-[10px] font-black tabular-nums text-white/70">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                                    {event.stats.views}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* — Spacer — */}
                <div className="flex-1" />

                {/* — Primary Action — */}
                {primaryAction && (
                    <div className="mt-3">
                        {primaryAction.href ? (
                            <Link
                                href={primaryAction.href}
                                className="group/btn relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] transition-all duration-300"
                                style={{
                                    background: "rgba(255,255,255,0.96)",
                                    border: "1px solid rgba(255,255,255,1)",
                                    color: "rgba(0,0,0,0.9)",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "rgba(255,255,255,1)";
                                    e.currentTarget.style.borderColor = "rgba(255,255,255,1)";
                                    e.currentTarget.style.color = "rgba(0,0,0,1)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "rgba(255,255,255,0.96)";
                                    e.currentTarget.style.borderColor = "rgba(255,255,255,1)";
                                    e.currentTarget.style.color = "rgba(0,0,0,0.9)";
                                }}
                            >
                                {primaryAction.label}
                                {primaryAction.icon || (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m9 18 6-6-6-6" />
                                    </svg>
                                )}
                            </Link>
                        ) : (
                            <button
                                onClick={(e) => { e.stopPropagation(); primaryAction.onClick?.(); }}
                                className="group/btn relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] transition-all duration-300"
                                style={{
                                    background: "rgba(255,255,255,0.96)",
                                    border: "1px solid rgba(255,255,255,1)",
                                    color: "rgba(0,0,0,0.9)",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "rgba(255,255,255,1)";
                                    e.currentTarget.style.borderColor = "rgba(255,255,255,1)";
                                    e.currentTarget.style.color = "rgba(0,0,0,1)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "rgba(255,255,255,0.96)";
                                    e.currentTarget.style.borderColor = "rgba(255,255,255,1)";
                                    e.currentTarget.style.color = "rgba(0,0,0,0.9)";
                                }}
                            >
                                {primaryAction.label}
                                {primaryAction.icon || (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m9 18 6-6-6-6" />
                                    </svg>
                                )}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default memo(DashboardEventCard);
