"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import {
    ChevronLeft, ChevronRight, ChevronDown, X, Plus, Clock,
    AlertCircle, Lock, Settings, Music, Zap,
    CalendarDays, ArrowRight, Sparkles,
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { parseAsIST, toISODateIST } from "@c1rcle/core/time";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { EVENT_LIFECYCLE } from "@c1rcle/core/events";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const EXCLUDED_LIFECYCLE = [EVENT_LIFECYCLE.DRAFT, EVENT_LIFECYCLE.DELETED, EVENT_LIFECYCLE.CANCELLED, EVENT_LIFECYCLE.DENIED];

// Timeline: 2 PM → 4 AM (14 h)
const TIMELINE_HOURS = [
    { label: "2 PM", mins: 0 },
    { label: "4 PM", mins: 120 },
    { label: "6 PM", mins: 240 },
    { label: "8 PM", mins: 360 },
    { label: "10 PM", mins: 480 },
    { label: "12 AM", mins: 600 },
    { label: "2 AM", mins: 720 },
    { label: "4 AM", mins: 840 },
];
const TOTAL_MINS = 840;

function filterVisibleEvents(events: any[]) {
    return (events || []).filter((e: any) => !EXCLUDED_LIFECYCLE.includes(e.lifecycle || e.status || "draft"));
}
function timeToMins(t: string): number {
    if (!t) return 0;
    const [h, m] = t.split(":").map(Number);
    let mins = h * 60 + m;
    if (h < 14) mins += 1440;
    return mins - 840;
}
function pct(mins: number) {
    return `${Math.max(0, Math.min(100, (mins / TOTAL_MINS) * 100))}%`;
}

// ─── Solid surface colours — no more rgba transparency fog ─────────────────────
const C = {
    base: "#111114",
    surface: "#1c1c22",
    surfaceWeekend: "#1f1f28",
    surfacePast: "#141417",
    surfaceEvent: "#0d2119",
    surfaceBlocked: "#1e0d0d",
    surfacePending: "#1e1a0b",
    surfaceToday: "#281510",
    surfaceSelected: "#2e1008",
    borderDefault: "rgba(255,255,255,0.08)",
    borderEvent: "rgba(52,211,153,0.4)",
    borderBlocked: "rgba(248,113,113,0.35)",
    borderPending: "rgba(251,191,36,0.3)",
    borderToday: "rgba(244,74,34,0.55)",
    borderSelected: "#F44A22",
    teal: "#34D399",
    amber: "#FBBF24",
    red: "#F87171",
    orange: "#F44A22",
};

export function OperatingCalendar() {
    const { user, profile } = useDashboardAuth();
    const pathname = usePathname();
    const rm = useReducedMotion();
    const role = pathname.startsWith("/club") || pathname.startsWith("/venue") ? "venue" : "host";

    const [currentDate, setCurrentDate] = useState(parseAsIST(null));
    const [selectedDateStr, setSelected] = useState<string | null>(null);
    const [calendarData, setCalendarData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const year = parseInt(currentDate.toLocaleString("en-US", { year: "numeric", timeZone: "Asia/Kolkata" }));
    const month = parseInt(currentDate.toLocaleString("en-US", { month: "numeric", timeZone: "Asia/Kolkata" })) - 1;

    const fetchCalendar = async (silent = false) => {
        if (!profile?.activeMembership?.partnerId) return;
        if (!silent) setLoading(true);
        try {
            const pid = profile.activeMembership.partnerId;
            const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
            const last = new Date(year, month + 1, 0).getDate();
            const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
            const tok = await user?.getIdToken();
            const param = role === "venue" ? `venueId=${pid}` : `hostId=${pid}`;
            const res = await fetch(
                `/api/venue/calendar?${param}&view=operating&startDate=${start}&endDate=${end}`,
                { headers: tok ? { Authorization: `Bearer ${tok}` } : {} }
            );
            const data = await res.json();
            if (res.ok && Array.isArray(data)) {
                setCalendarData(data.map((d: any) => {
                    const ev = filterVisibleEvents(d.events);
                    return { ...d, events: ev, stats: { ...d.stats, eventCount: ev.length } };
                }));
            } else if (!silent) {
                setCalendarData([]);
            }
        } catch { if (!silent) setCalendarData([]); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchCalendar(); }, [profile, currentDate]);

    const firstDayIdx = useMemo(() => {
        const d = parseAsIST(`${year}-${String(month + 1).padStart(2, "0")}-01`);
        const sh = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Kolkata" }).format(d);
        return DAYS.indexOf(sh);
    }, [year, month]);

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const grid = useMemo(() => {
        const g: any[] = [];
        for (let i = 0; i < firstDayIdx; i++) g.push(null);
        for (let d = 1; d <= daysInMonth; d++) {
            const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            g.push({ day: d, dateStr: ds, ...(calendarData.find(x => x.date === ds) || {}) });
        }
        return g;
    }, [calendarData, year, month, daysInMonth, firstDayIdx]);

    const selectedDay = useMemo(() => grid.find(d => d?.dateStr === selectedDateStr), [grid, selectedDateStr]);

    const navMonth = (delta: number) => {
        const nm = month + delta;
        const ny = nm < 0 ? year - 1 : nm > 11 ? year + 1 : year;
        setCurrentDate(parseAsIST(`${ny}-${String(((nm % 12) + 12) % 12 + 1).padStart(2, "0")}-01`));
    };

    const handleSlotAction = async (slotId: string, action: "approve" | "reject") => {
        if (!profile) return;
        const tok = await user?.getIdToken();
        const pid = profile.activeMembership?.partnerId;
        const res = await fetch(`/api/slots/${slotId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
            body: JSON.stringify({
                action,
                venueId: pid,
                actor: { uid: profile.uid, role, name: profile.displayName || profile.email, partnerId: pid },
            }),
        });
        if (res.ok) fetchCalendar();
    };

    const handleBlockDate = async (date: string, action: "block" | "unblock", reason = "Manual Block", startTime = "16:00", endTime = "04:00") => {
        if (!profile?.activeMembership?.partnerId) return;
        const tok = await user?.getIdToken();
        const pid = profile.activeMembership.partnerId;
        const res = await fetch(`/api/venue/calendar?venueId=${pid}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
            body: JSON.stringify({ action, venueId: pid, date, reason, startTime, endTime }),
        });
        if (!res.ok) {
            console.error("[Calendar] Block/unblock failed:", res.status, await res.text().catch(() => ""));
            return;
        }

        // Optimistic update — immediately reflect in local state while fetchCalendar runs
        setCalendarData(prev => {
            const exists = prev.some(d => d.date === date);
            const updated = prev.map(d => {
                if (d.date !== date) return d;
                if (action === "unblock") return { ...d, state: "OPEN", block: null };
                return { ...d, state: "BLOCKED", block: { startTime, endTime, reason } };
            });
            // If date wasn't in calendarData yet (empty initial load), inject it
            if (!exists && action === "block") {
                updated.push({ date, state: "BLOCKED", block: { startTime, endTime, reason }, events: [], slots: [], stats: { eventCount: 0, pendingSlots: 0 } });
            }
            return updated;
        });
        await fetchCalendar(true); // silent — optimistic update already applied
    };

    const stats = useMemo(() => ({
        confirmed: calendarData.filter(d => d.state === "CONFIRMED").length,
        pending: calendarData.filter(d => d.stats?.pendingSlots > 0).length,
        blocked: calendarData.filter(d => d.state === "BLOCKED").length,
    }), [calendarData]);

    const todayStr = toISODateIST(parseAsIST(null));
    const weeks = Math.ceil((firstDayIdx + daysInMonth) / 7);

    return (
        <div className="flex flex-col w-full gap-4" style={{ height: "calc(100vh - 13rem)" }}>

            {/* ── Toolbar ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-3 flex-shrink-0">
                <div className="flex items-center gap-3">
                    {/* Month picker */}
                    <div className="flex items-center rounded-2xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.borderDefault}` }}>
                        <button onClick={() => navMonth(-1)} className="w-10 h-10 flex items-center justify-center transition-colors hover:bg-white/5" style={{ color: "rgba(255,255,255,0.4)" }}>
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="px-4 text-[13px] font-black tracking-tight uppercase text-white min-w-[150px] text-center" style={{ borderLeft: `1px solid ${C.borderDefault}`, borderRight: `1px solid ${C.borderDefault}` }}>
                            {MONTHS[month]} {year}
                        </span>
                        <button onClick={() => navMonth(1)} className="w-10 h-10 flex items-center justify-center transition-colors hover:bg-white/5" style={{ color: "rgba(255,255,255,0.4)" }}>
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Stats */}
                    <div className="hidden lg:flex items-center gap-2">
                        {[
                            { n: stats.confirmed, label: "Booked", color: C.teal, bg: "rgba(52,211,153,.12)", bd: "rgba(52,211,153,.25)" },
                            { n: stats.pending, label: "Pending", color: C.amber, bg: "rgba(251,191,36,.12)", bd: "rgba(251,191,36,.25)" },
                            { n: stats.blocked, label: "Blocked", color: C.red, bg: "rgba(248,113,113,.12)", bd: "rgba(248,113,113,.25)" },
                        ].map(s => (
                            <div key={s.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black border" style={{ background: s.bg, color: s.color, borderColor: s.bd }}>
                                <span className="tabular-nums text-[11px]">{s.n}</span>
                                <span className="uppercase tracking-widest opacity-70">{s.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { const n = parseAsIST(null); setCurrentDate(n); setSelected(toISODateIST(n)); }}
                        className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-white/5 border"
                        style={{ background: C.surface, borderColor: C.borderDefault, color: "rgba(255,255,255,0.5)" }}
                    >
                        Today
                    </button>
                    {role === "venue" && (
                        <Link href="/venue/create" className="h-10 px-5 rounded-xl text-[11px] font-black uppercase tracking-widest text-white flex items-center gap-2 transition-opacity hover:opacity-85" style={{ background: C.orange, boxShadow: "0 4px 20px rgba(244,74,34,0.4)" }}>
                            <Plus className="w-4 h-4" /> Launch Event
                        </Link>
                    )}
                </div>
            </div>

            {/* ── Main two-panel card ──────────────────────────────────────── */}
            <div className="flex-1 min-h-0 overflow-hidden">
                <div
                    className="flex flex-col lg:flex-row h-full rounded-[28px] overflow-hidden"
                    style={{ background: "#16161b", border: `1px solid rgba(255,255,255,0.07)`, boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}
                >

                    {/* ══ CALENDAR PANEL ═══════════════════════════════════ */}
                    <div className="lg:flex-[2.4] flex flex-col min-h-0" style={{ borderRight: `1px solid rgba(255,255,255,0.07)` }}>

                        {/* Day-of-week row */}
                        <div className="grid grid-cols-7 px-4 pt-5 pb-3 flex-shrink-0">
                            {DAYS.map((d, i) => (
                                <div
                                    key={d}
                                    className="text-center text-[9px] font-black uppercase tracking-[0.15em] py-1"
                                    style={{ color: (i === 0 || i === 6) ? "rgba(244,74,34,0.6)" : "rgba(255,255,255,0.28)" }}
                                >
                                    {d}
                                </div>
                            ))}
                        </div>

                        {/* Date cells */}
                        <div
                            className="flex-1 min-h-0 px-4 pb-4 grid grid-cols-7 gap-2"
                            style={{ gridTemplateRows: `repeat(${weeks}, 1fr)` }}
                        >
                            {loading
                                ? Array.from({ length: 35 }).map((_, i) => (
                                    <div key={i} className="rounded-2xl animate-pulse" style={{ background: C.surface }} />
                                ))
                                : grid.map((cell, idx) => {
                                    if (!cell) return <div key={`e-${idx}`} />;

                                    const isToday = cell.dateStr === todayStr;
                                    const isSel = cell.dateStr === selectedDateStr;
                                    const evCount = cell.stats?.eventCount || 0;
                                    const hasPending = (cell.stats?.pendingSlots || 0) > 0;
                                    const isBlocked = cell.state === "BLOCKED";
                                    const isPast = cell.dateStr < todayStr;
                                    const hasEvents = evCount > 0;
                                    const isWeekend = idx % 7 === 0 || idx % 7 === 6;

                                    // Solid surface colours — hierarchy matters
                                    let bg = isPast ? C.surfacePast : isWeekend ? C.surfaceWeekend : C.surface;
                                    let border = `1px solid ${isPast ? "rgba(255,255,255,0.05)" : C.borderDefault}`;
                                    let shadow = "none";

                                    if (isSel) {
                                        bg = C.surfaceSelected;
                                        border = `2px solid ${C.borderSelected}`;
                                        shadow = `0 0 32px rgba(244,74,34,0.3), 0 8px 24px rgba(244,74,34,0.15)`;
                                    } else if (isToday && !isSel) {
                                        bg = C.surfaceToday;
                                        border = `2px solid ${C.borderToday}`;
                                        shadow = "0 0 20px rgba(244,74,34,0.12)";
                                    } else if (isBlocked) {
                                        bg = C.surfaceBlocked;
                                        border = `1px solid ${C.borderBlocked}`;
                                    } else if (hasEvents && !isPast) {
                                        bg = C.surfaceEvent;
                                        border = `1px solid ${C.borderEvent}`;
                                        shadow = "0 4px 20px rgba(52,211,153,0.1)";
                                    } else if (hasPending) {
                                        bg = C.surfacePending;
                                        border = `1px solid ${C.borderPending}`;
                                    }

                                    const numColor = isToday ? "white"
                                        : isSel ? C.orange
                                            : isBlocked ? C.red
                                                : hasEvents && !isPast ? C.teal
                                                    : isPast ? "rgba(255,255,255,0.28)"
                                                        : "rgba(255,255,255,0.82)";

                                    return (
                                        <button
                                            key={cell.dateStr}
                                            onClick={() => { if (!isPast) setSelected(cell.dateStr); }}
                                            disabled={isPast}
                                            className="relative rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-100"
                                            style={{
                                                background: bg, border, boxShadow: shadow,
                                                cursor: isPast ? "not-allowed" : "pointer",
                                                opacity: isPast ? 0.42 : 1,
                                            }}
                                            onMouseEnter={e => { if (!isPast && !isSel && !isToday) (e.currentTarget as HTMLElement).style.filter = "brightness(1.15)"; }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = ""; }}
                                        >
                                            {/* Top stripe for event cells */}
                                            {hasEvents && !isSel && !isPast && (
                                                <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${C.teal}, rgba(52,211,153,0.3))` }} />
                                            )}

                                            {/* Diagonal stripe overlay for past dates */}
                                            {isPast && (
                                                <div
                                                    className="absolute inset-0 rounded-2xl pointer-events-none"
                                                    style={{
                                                        backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 8px)",
                                                    }}
                                                />
                                            )}

                                            {/* Day number */}
                                            {isToday ? (
                                                <span
                                                    className="inline-flex items-center justify-center w-[26px] h-[26px] rounded-full text-[11px] font-black text-white tabular-nums"
                                                    style={{ background: C.orange, boxShadow: `0 0 16px rgba(244,74,34,0.8)` }}
                                                >
                                                    {cell.day}
                                                </span>
                                            ) : (
                                                <span className="text-[15px] font-black tabular-nums" style={{ color: numColor }}>
                                                    {cell.day}
                                                </span>
                                            )}

                                            {/* Status dots */}
                                            {(hasEvents || hasPending || isBlocked) && !isPast && (
                                                <div className="flex items-center gap-[3px]">
                                                    {hasEvents && Array.from({ length: Math.min(evCount, 3) }).map((_, i) => (
                                                        <span key={i} className="w-1 h-1 rounded-full" style={{ background: C.teal }} />
                                                    ))}
                                                    {hasPending && <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: C.amber }} />}
                                                    {isBlocked && <span className="w-1 h-1 rounded-full" style={{ background: C.red }} />}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })
                            }
                        </div>

                        {/* Legend */}
                        <div
                            className="flex-shrink-0 flex items-center gap-6 px-6 py-3"
                            style={{ borderTop: `1px solid rgba(255,255,255,0.06)`, background: "rgba(0,0,0,0.2)" }}
                        >
                            {[
                                { color: C.teal, label: "Confirmed", bg: C.surfaceEvent },
                                { color: C.amber, label: "Pending", bg: C.surfacePending },
                                { color: C.red, label: "Blocked", bg: C.surfaceBlocked },
                            ].map(({ color, label, bg }) => (
                                <div key={label} className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-md" style={{ background: bg, border: `1px solid ${color}40` }} />
                                    <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ══ INSPECTOR PANEL ══════════════════════════════════ */}
                    <div className="lg:flex-[1] flex flex-col overflow-hidden" style={{ background: "#0f0f13" }}>
                        <AnimatePresence mode="wait">
                            {selectedDateStr ? (
                                <motion.div
                                    key={selectedDateStr}
                                    initial={rm ? {} : { opacity: 0, x: 16 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={rm ? {} : { opacity: 0, x: -8 }}
                                    transition={{ duration: 0.15 }}
                                    className="flex-1 flex flex-col h-full overflow-hidden"
                                >
                                    <SidePanel
                                        role={role}
                                        dateStr={selectedDateStr}
                                        data={selectedDay}
                                        onClose={() => setSelected(null)}
                                        onSlotAction={handleSlotAction}
                                        onBlockDate={handleBlockDate}
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
                                                    width: size * 2, height: size * 2,
                                                    top: "50%", left: "50%",
                                                    transform: "translate(-50%, -50%)",
                                                    border: `1px solid rgba(255,255,255,${0.03 + i * 0.015})`,
                                                }}
                                            />
                                        ))}
                                        <div
                                            className="relative w-14 h-14 rounded-2xl flex items-center justify-center"
                                            style={{ background: C.surface, border: `1px solid rgba(255,255,255,0.1)` }}
                                        >
                                            <CalendarDays className="w-6 h-6" style={{ color: "rgba(244,74,34,0.6)" }} />
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[11px] font-black uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>Night Ops Deck</p>
                                        <p className="text-[11px] leading-relaxed max-w-[140px] mx-auto" style={{ color: "rgba(255,255,255,0.18)" }}>
                                            Tap a date to see your night schedule
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                </div>
            </div>
        </div>
    );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Convert 24-hour "HH:MM" to "h:MM AM/PM" */
function fmt12(t: string): string {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    const h12 = h % 12 || 12;
    const period = h >= 12 ? "PM" : "AM";
    return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

// Times selectable in block picker: 2 PM through 4 AM in 30-min steps
const BLOCK_TIMES: string[] = (() => {
    const out: string[] = [];
    for (let h = 14; h < 24; h++) ["00", "30"].forEach(m => out.push(`${String(h).padStart(2, "0")}:${m}`));
    for (let h = 0; h <= 4; h++) ["00", "30"].forEach(m => out.push(`${String(h).padStart(2, "0")}:${m}`));
    return out;
})();

function TimePicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // Scroll selected item into view when opening
    useEffect(() => {
        if (!open || !listRef.current) return;
        const sel = listRef.current.querySelector("[data-selected='true']") as HTMLElement | null;
        if (sel) sel.scrollIntoView({ block: "center" });
    }, [open]);

    return (
        <div ref={ref} className="relative">
            <label className="block text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                {label}
            </label>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-[13px] font-black text-white border transition-colors"
                style={{
                    background: "#0f0f14",
                    borderColor: open ? "rgba(244,74,34,0.5)" : "rgba(255,255,255,0.08)",
                    boxShadow: open ? "0 0 0 3px rgba(244,74,34,0.08)" : "none",
                }}
            >
                <span className="tabular-nums">{fmt12(value)}</span>
                <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 transition-transform" style={{ color: "rgba(255,255,255,0.4)", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
            </button>

            {open && (
                <div
                    className="absolute left-0 right-0 z-50 rounded-2xl border overflow-hidden"
                    style={{
                        bottom: "calc(100% + 6px)",
                        background: "#1a1a22",
                        borderColor: "rgba(255,255,255,0.1)",
                        boxShadow: "0 -16px 40px rgba(0,0,0,0.6)",
                    }}
                >
                    <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: 200, scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
                        {BLOCK_TIMES.map(t => {
                            const isSel = t === value;
                            return (
                                <button
                                    key={t}
                                    data-selected={isSel}
                                    type="button"
                                    onClick={() => { onChange(t); setOpen(false); }}
                                    className="w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors"
                                    style={{
                                        background: isSel ? "rgba(244,74,34,0.15)" : "transparent",
                                        color: isSel ? "#F44A22" : "rgba(255,255,255,0.7)",
                                    }}
                                    onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
                                    onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                                >
                                    <span className="text-[13px] font-black tabular-nums">{fmt12(t)}</span>
                                    <span className="text-[9px] font-black opacity-40 tabular-nums">{t}</span>
                                    {isSel && <div className="w-1.5 h-1.5 rounded-full ml-auto" style={{ background: "#F44A22", boxShadow: "0 0 6px rgba(244,74,34,0.8)" }} />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Side Panel ────────────────────────────────────────────────────────────────

function SidePanel({ role, dateStr, data, onClose, onSlotAction, onBlockDate }: {
    role: string; dateStr: string; data: any;
    onClose: () => void;
    onSlotAction: (id: string, a: "approve" | "reject") => Promise<void>;
    onBlockDate: (date: string, a: "block" | "unblock", reason?: string, s?: string, e?: string) => Promise<void>;
}) {
    const [isPending, setIsPending] = useState(false);
    const [reason, setReason] = useState(data?.block?.reason || "Private Event / Maintenance");
    const [startTime, setStartTime] = useState(data?.block?.startTime || "20:00");
    const [endTime, setEndTime] = useState(data?.block?.endTime || "04:00");
    const [isBlockingMode, setBlockingMode] = useState(false);

    useEffect(() => {
        if (!isBlockingMode) {
            setReason(data?.block?.reason || "Private Event / Maintenance");
            setStartTime(data?.block?.startTime || "20:00");
            setEndTime(data?.block?.endTime || "04:00");
        }
    }, [data, isBlockingMode]);

    const d = parseAsIST(dateStr);
    const dayName = d.toLocaleDateString("en-US", { weekday: "long", timeZone: "Asia/Kolkata" });
    const dayNum = d.toLocaleDateString("en-US", { day: "numeric", timeZone: "Asia/Kolkata" });
    const monthStr = d.toLocaleDateString("en-US", { month: "long", timeZone: "Asia/Kolkata" });
    const yearStr = d.toLocaleDateString("en-US", { year: "numeric", timeZone: "Asia/Kolkata" });

    const events = filterVisibleEvents(data?.events) || [];
    // Deduplicate by eventId — host may have submitted the same slot request multiple times
    const pendingSlots = useMemo(() => {
        const seen = new Set<string>();
        return (data?.slots || []).filter((s: any) => {
            if (s.status !== "pending") return false;
            const key = s.eventId || s.id;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [data?.slots]);
    const isBlocked = data?.state === "BLOCKED";
    const evCount = events.length;

    const stateColor = isBlocked ? C.red : evCount > 0 ? C.teal : "rgba(255,255,255,0.3)";
    const stateBg = isBlocked ? C.surfaceBlocked : evCount > 0 ? C.surfaceEvent : "rgba(255,255,255,0.04)";
    const stateBorder = isBlocked ? C.borderBlocked : evCount > 0 ? C.borderEvent : "rgba(255,255,255,0.08)";
    const stateLabel = isBlocked ? "Blocked" : evCount > 0 ? `${evCount} Event${evCount > 1 ? "s" : ""}` : "Open Night";

    // NOW indicator
    const [now, setNow] = useState(parseAsIST(null));
    useEffect(() => {
        const t = setInterval(() => setNow(parseAsIST(null)), 60_000);
        return () => clearInterval(t);
    }, []);

    const { nowPct, isActive, nowTimeStr } = useMemo(() => {
        const todayStr = toISODateIST(now);
        const yest = toISODateIST(new Date(now.getTime() - 86_400_000));
        const h = now.getHours(), m = now.getMinutes();
        const active = (h >= 14 && dateStr === todayStr) || (h < 4 && dateStr === yest);
        const mins = timeToMins(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
        const h12 = h % 12 || 12;
        const period = h >= 12 ? "PM" : "AM";
        return { nowPct: pct(mins), isActive: active, nowTimeStr: `${h12}:${String(m).padStart(2, "0")} ${period}` };
    }, [now, dateStr]);

    const nowMinsCurrent = useMemo(() => {
        const h = now.getHours(), m = now.getMinutes();
        return timeToMins(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }, [now]);

    const handleBlock = async () => {
        if (isPending) return;
        setIsPending(true);
        try { await onBlockDate(dateStr, "block", reason, startTime, endTime); setBlockingMode(false); }
        finally { setIsPending(false); }
    };
    const handleUnblock = async () => {
        if (isPending) return;
        setIsPending(true);
        try { await onBlockDate(dateStr, "unblock"); setBlockingMode(false); }
        finally { setIsPending(false); }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">

            {/* ── Date Hero Header ──────────────────────────────────────── */}
            <div
                className="flex-shrink-0 relative overflow-hidden px-6 pt-6 pb-5"
                style={{
                    background: isBlocked
                        ? "linear-gradient(160deg, #1e0d0d 0%, #0f0f13 70%)"
                        : evCount > 0
                            ? "linear-gradient(160deg, #0d2119 0%, #0f0f13 70%)"
                            : "linear-gradient(160deg, #1a100a 0%, #0f0f13 70%)",
                }}
            >
                {/* Corner glow */}
                <div className="absolute top-0 right-0 w-40 h-40 pointer-events-none" style={{
                    background: isBlocked
                        ? "radial-gradient(circle at top right, rgba(248,113,113,0.18), transparent 65%)"
                        : evCount > 0
                            ? "radial-gradient(circle at top right, rgba(52,211,153,0.15), transparent 65%)"
                            : "radial-gradient(circle at top right, rgba(244,74,34,0.12), transparent 65%)",
                }} />

                <div className="flex items-start justify-between relative z-10">
                    <div>
                        {/* Status pill */}
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-4 border text-[9px] font-black uppercase tracking-widest" style={{ background: stateBg, borderColor: stateBorder, color: stateColor }}>
                            <span className="w-[5px] h-[5px] rounded-full" style={{ background: stateColor, boxShadow: `0 0 6px ${stateColor}` }} />
                            {stateLabel}
                        </div>

                        {/* Big date */}
                        <div className="flex items-end gap-3">
                            <span className="text-[52px] font-black leading-none tabular-nums" style={{ color: "rgba(255,255,255,0.95)", letterSpacing: "-0.04em" }}>
                                {dayNum}
                            </span>
                            <div className="pb-1">
                                <p className="text-[16px] font-black leading-tight text-white">{dayName}</p>
                                <p className="text-[12px] font-medium leading-tight" style={{ color: "rgba(255,255,255,0.35)" }}>
                                    {monthStr} {yearStr}
                                </p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/8 border border-transparent hover:border-white/10"
                        style={{ color: "rgba(255,255,255,0.3)" }}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Bottom fade line */}
                <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0.08) 70%, transparent)" }} />
            </div>

            {/* ── Timeline scroll area ─────────────────────────────────── */}
            <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.06) transparent" }}>
                <div className="px-5 pt-5 pb-4">

                    {/* Label */}
                    <div className="flex items-center gap-2 mb-4">
                        <Clock className="w-3 h-3 flex-shrink-0" style={{ color: "rgba(255,255,255,0.25)" }} />
                        <span className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.25)" }}>Night Schedule</span>
                        <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                        <span className="text-[9px] font-black" style={{ color: "rgba(255,255,255,0.2)" }}>2 PM — 4 AM</span>
                    </div>

                    {/* Timeline — proper structure with left gutter */}
                    <div className="flex gap-3">

                        {/* Left: hour labels */}
                        <div className="flex-shrink-0 w-10 relative" style={{ height: 440 }}>
                            {TIMELINE_HOURS.map(({ label, mins }) => (
                                <div
                                    key={label}
                                    className="absolute right-0 flex items-center justify-end"
                                    style={{ top: `${(mins / TOTAL_MINS) * 100}%`, transform: "translateY(-50%)" }}
                                >
                                    <span
                                        className="text-[8px] font-black uppercase leading-none"
                                        style={{
                                            color: mins % 240 === 0 ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.22)",
                                            letterSpacing: "0.04em",
                                        }}
                                    >
                                        {label}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Right: timeline grid */}
                        <div
                            className="flex-1 relative rounded-2xl overflow-hidden"
                            style={{
                                height: 440,
                                background: "#141418",
                                border: "1px solid rgba(255,255,255,0.08)",
                            }}
                        >
                            {/* Alternating bands */}
                            {TIMELINE_HOURS.slice(0, -1).map(({ mins }, i) => {
                                const nextMins = TIMELINE_HOURS[i + 1].mins;
                                return (
                                    <div
                                        key={`b-${i}`}
                                        className="absolute left-0 right-0 pointer-events-none"
                                        style={{
                                            top: `${(mins / TOTAL_MINS) * 100}%`,
                                            height: `${((nextMins - mins) / TOTAL_MINS) * 100}%`,
                                            background: i % 2 === 0 ? "rgba(255,255,255,0.025)" : "transparent",
                                        }}
                                    />
                                );
                            })}

                            {/* Hour lines */}
                            {TIMELINE_HOURS.map(({ mins }) => (
                                <div
                                    key={`l-${mins}`}
                                    className="absolute left-0 right-0 h-px pointer-events-none"
                                    style={{
                                        top: `${(mins / TOTAL_MINS) * 100}%`,
                                        background: mins % 240 === 0 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)",
                                    }}
                                />
                            ))}

                            {/* NOW indicator */}
                            {isActive && (
                                <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top: nowPct }}>
                                    <div className="absolute left-0 right-0 h-[1.5px]" style={{ background: `linear-gradient(90deg, ${C.orange} 40%, transparent)` }} />
                                    <div className="absolute -left-1 w-[10px] h-[10px] rounded-full -translate-y-1/2" style={{ background: C.orange, boxShadow: `0 0 0 3px rgba(244,74,34,0.25), 0 0 14px rgba(244,74,34,0.6)` }} />
                                    <div className="absolute right-2 -translate-y-1/2 flex items-center gap-1 px-2 py-[3px] rounded-full" style={{ background: C.orange, boxShadow: "0 2px 12px rgba(244,74,34,0.4)" }}>
                                        <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                                        <span className="text-[8px] font-black text-white tracking-wide">{nowTimeStr}</span>
                                    </div>
                                </div>
                            )}

                            {/* Blocked fill */}
                            {isBlocked && (() => {
                                const blockStart = data?.block?.startTime || "20:00";
                                const blockEnd = data?.block?.endTime || "04:00";
                                const sMin = timeToMins(blockStart);
                                const eMin = timeToMins(blockEnd);
                                const blockH = Math.max(8, ((eMin - sMin) / TOTAL_MINS) * 100);
                                return (
                                    <div
                                        className="absolute left-0 right-0 z-10 flex flex-col items-center justify-center gap-2"
                                        style={{
                                            top: pct(sMin),
                                            height: `${blockH}%`,
                                            background: "rgba(220,38,38,0.28)",
                                            borderTop: "2px solid rgba(248,113,113,0.8)",
                                            borderBottom: "2px solid rgba(248,113,113,0.8)",
                                            backgroundImage: "repeating-linear-gradient(135deg, rgba(248,113,113,0.12) 0px, rgba(248,113,113,0.12) 2px, transparent 2px, transparent 12px)",
                                            boxShadow: "0 0 0 1px rgba(248,113,113,0.15) inset",
                                        }}
                                    >
                                        <div className="flex flex-col items-center gap-2 px-3 text-center">
                                            <div className="w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(220,38,38,0.4)", border: "1.5px solid rgba(248,113,113,0.7)" }}>
                                                <Lock className="w-4 h-4" style={{ color: "#FCA5A5" }} />
                                            </div>
                                            <div className="flex flex-col items-center gap-0.5">
                                                <span className="text-[10px] font-black uppercase tracking-widest leading-tight" style={{ color: "#FCA5A5" }}>
                                                    {data?.block?.reason || "Blocked"}
                                                </span>
                                                <span className="text-[9px] font-black tabular-nums" style={{ color: "rgba(248,113,113,0.65)" }}>
                                                    {fmt12(blockStart)} — {fmt12(blockEnd)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Empty state — centered in grid */}
                            {evCount === 0 && !isBlocked && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: "rgba(244,74,34,0.08)", border: "1px solid rgba(244,74,34,0.18)" }}>
                                        <Music className="w-5 h-5" style={{ color: "rgba(244,74,34,0.55)" }} />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>No events</p>
                                        <p className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.12)" }}>Night is open</p>
                                    </div>
                                </div>
                            )}

                            {/* Event blocks */}
                            {events.map((e: any) => {
                                const status = e.lifecycle || e.status;
                                const isConfirmed = [EVENT_LIFECYCLE.SCHEDULED, EVENT_LIFECYCLE.LIVE, EVENT_LIFECYCLE.APPROVED].includes(status);
                                const sMin = timeToMins(e.startTime || "21:00");
                                const eMin = timeToMins(e.endTime || "04:00");
                                const h = Math.max(5, ((eMin - sMin) / TOTAL_MINS) * 100);
                                const isNow = isActive && isConfirmed && nowMinsCurrent >= sMin && nowMinsCurrent <= eMin;
                                const accent = isNow || isConfirmed ? C.teal : C.amber;

                                return (
                                    <Link
                                        key={e.id}
                                        href={role === "venue" ? `/venue/events/${e.id}` : `/host/events/${e.id}`}
                                        className="absolute left-1 right-1 rounded-xl overflow-hidden z-20 group transition-all duration-150 hover:brightness-110 hover:scale-[1.01]"
                                        style={{
                                            top: pct(sMin), height: `${h}%`,
                                            background: isNow
                                                ? "linear-gradient(135deg, rgba(52,211,153,0.22), rgba(52,211,153,0.1))"
                                                : isConfirmed
                                                    ? "linear-gradient(135deg, rgba(52,211,153,0.16), rgba(52,211,153,0.06))"
                                                    : "linear-gradient(135deg, rgba(251,191,36,0.16), rgba(251,191,36,0.06))",
                                            border: `1px solid ${isNow ? "rgba(52,211,153,0.5)" : isConfirmed ? "rgba(52,211,153,0.25)" : "rgba(251,191,36,0.25)"}`,
                                            boxShadow: isNow ? "0 4px 20px rgba(52,211,153,0.2)" : "none",
                                        }}
                                    >
                                        <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: accent }} />
                                        <div className="h-full pl-3.5 pr-3 py-2 flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    <p className="text-[11px] font-black text-white tracking-tight truncate uppercase">{e.title || "Reserved"}</p>
                                                    {isNow && (
                                                        <span className="flex-shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-white text-[7px] font-black uppercase" style={{ background: C.teal }}>
                                                            <span className="w-1 h-1 rounded-full bg-white animate-pulse" />Live
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[9px] font-black tabular-nums uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>
                                                    {e.startTime} — {e.endTime}
                                                </p>
                                            </div>
                                            {e.posterUrl && (
                                                <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border border-white/10">
                                                    <img src={e.posterUrl} alt="" className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Pending slot requests */}
                {pendingSlots.length > 0 && (
                    <div className="mx-5 mb-4 rounded-2xl overflow-hidden border" style={{ background: "rgba(251,191,36,0.05)", borderColor: "rgba(251,191,36,0.18)" }}>
                        <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "rgba(251,191,36,0.12)" }}>
                            <AlertCircle className="w-3.5 h-3.5" style={{ color: C.amber }} />
                            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: C.amber }}>Needs Approval · {pendingSlots.length}</span>
                        </div>
                        <div className="p-3 space-y-2">
                            {pendingSlots.map((s: any) => (
                                <div key={s.id} className="flex items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-black text-white truncate">{s.host} Request</p>
                                        <p className="text-[9px] tabular-nums" style={{ color: "rgba(255,255,255,0.3)" }}>{s.startTime} — {s.endTime}</p>
                                    </div>
                                    {role === "venue" && (
                                        <div className="flex gap-1.5">
                                            <button onClick={() => onSlotAction(s.id, "approve")} className="px-3 py-1.5 rounded-lg text-white text-[9px] font-black uppercase tracking-wide hover:opacity-80 transition-opacity" style={{ background: C.teal }}>
                                                Approve
                                            </button>
                                            <button onClick={() => onSlotAction(s.id, "reject")} className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide border hover:bg-white/5 transition-colors" style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.1)" }}>
                                                Decline
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty day card */}
                {evCount === 0 && pendingSlots.length === 0 && (
                    <div className="mx-5 mb-4 rounded-2xl p-5 text-center border" style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)" }}>
                        {isBlocked ? (
                            <>
                                <Lock className="w-5 h-5 mx-auto mb-2" style={{ color: C.red, opacity: 0.6 }} />
                                <p className="text-[11px] font-black text-white mb-1">Date Blocked</p>
                                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{data?.block?.reason || "Blocked for maintenance or private events."}</p>
                                {data?.block?.startTime && (
                                    <p className="text-[9px] tabular-nums font-black mt-1.5" style={{ color: "rgba(255,255,255,0.2)" }}>{data.block.startTime} — {data.block.endTime}</p>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="w-8 h-8 rounded-xl mx-auto mb-2.5 flex items-center justify-center" style={{ background: "rgba(244,74,34,0.1)", border: "1px solid rgba(244,74,34,0.18)" }}>
                                    <Zap className="w-4 h-4" style={{ color: C.orange, opacity: 0.8 }} />
                                </div>
                                <p className="text-[11px] font-black text-white mb-1">Night is Open</p>
                                <p className="text-[10px] leading-relaxed" style={{ color: "rgba(255,255,255,0.3)" }}>Available for bookings.</p>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* ── Block settings ───────────────────────────────────────── */}
            {role === "venue" && isBlockingMode && (
                <div className="flex-shrink-0 border-t" style={{ background: "#13131a", borderColor: "rgba(255,255,255,0.07)" }}>
                    {/* Header */}
                    <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(248,113,113,0.15)" }}>
                            <Lock className="w-3 h-3" style={{ color: C.red }} />
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-widest text-white flex-1">Block Date</span>
                        {/* Preview pill */}
                        <span className="text-[9px] font-black tabular-nums px-2.5 py-1 rounded-full border" style={{ background: "rgba(248,113,113,0.08)", borderColor: "rgba(248,113,113,0.2)", color: C.red }}>
                            {fmt12(startTime)} → {fmt12(endTime)}
                        </span>
                    </div>

                    <div className="px-5 pt-3 pb-4 space-y-3">
                        {/* Time pickers */}
                        <div className="grid grid-cols-2 gap-3">
                            <TimePicker label="From" value={startTime} onChange={setStartTime} />
                            <TimePicker label="Until" value={endTime} onChange={setEndTime} />
                        </div>

                        {/* Reason */}
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>Reason</label>
                            <input
                                type="text"
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                placeholder="e.g. Private event, maintenance…"
                                className="w-full rounded-xl px-3.5 py-2.5 text-[12px] font-semibold text-white outline-none border transition-colors placeholder:opacity-20"
                                style={{ background: "#0f0f14", borderColor: "rgba(255,255,255,0.08)" }}
                                onFocus={e => (e.target.style.borderColor = "rgba(244,74,34,0.5)")}
                                onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
                            />
                        </div>

                        {/* Remove block link */}
                        {data?.state === "BLOCKED" && (
                            <button onClick={handleUnblock} disabled={isPending} className="text-[9px] font-black uppercase tracking-widest transition-opacity hover:opacity-60" style={{ color: C.red }}>
                                ✕ Remove existing block
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ── Footer ───────────────────────────────────────────────── */}
            <div className="flex-shrink-0 p-4 flex gap-2 border-t" style={{ background: "rgba(0,0,0,0.35)", borderColor: "rgba(255,255,255,0.06)" }}>
                {role === "venue" ? (
                    <>
                        {isBlockingMode ? (
                            <>
                                <button onClick={() => setBlockingMode(false)} className="flex-1 h-10 rounded-xl text-[10px] font-black uppercase tracking-wide border transition-colors hover:bg-white/5" style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.08)" }}>
                                    Cancel
                                </button>
                                <button onClick={handleBlock} disabled={isPending} className="flex-[1.4] h-10 rounded-xl text-[10px] font-black uppercase tracking-wide text-white transition-opacity hover:opacity-85" style={{ background: C.orange }}>
                                    {isPending ? "Saving…" : "Confirm Block"}
                                </button>
                            </>
                        ) : (
                            <button onClick={() => setBlockingMode(true)} className="flex-1 h-10 rounded-xl text-[10px] font-black uppercase tracking-wide border flex items-center justify-center gap-1.5 transition-colors hover:bg-white/5" style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.08)" }}>
                                {data?.state === "BLOCKED" ? <Settings className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                                {data?.state === "BLOCKED" ? "Edit Block" : "Block Date"}
                            </button>
                        )}
                    </>
                ) : (
                    <Link href="/host/events" className="flex-1 h-10 rounded-xl text-[10px] font-black uppercase tracking-wide border flex items-center justify-center gap-2 transition-colors hover:bg-white/5" style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.08)" }}>
                        Event Management <ArrowRight className="w-3 h-3" />
                    </Link>
                )}
                {!isBlockingMode && (
                    <button onClick={onClose} className="h-10 px-5 rounded-xl text-[10px] font-black uppercase tracking-wide border transition-colors hover:bg-white/5" style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.08)" }}>
                        Close
                    </button>
                )}
            </div>
        </div>
    );
}
