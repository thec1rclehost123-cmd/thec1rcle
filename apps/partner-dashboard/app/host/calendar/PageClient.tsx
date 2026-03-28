"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
    ChevronLeft, ChevronRight, CalendarDays, Building2, Lock,
    Clock, Plus, Music, X, ArrowRight, CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { parseAsIST, toISODateIST } from "@c1rcle/core/time";
import { VenuePageShell } from "@/components/venue-layout/VenuePageShell";

// ── Color system — identical to OperatingCalendar ────────────────────────────
const C = {
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

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const EXCLUDED_LIFECYCLE = ["draft", "deleted", "cancelled", "denied"];

const TIMELINE_HOURS = [
    { label: "2 PM", mins: 0 }, { label: "4 PM", mins: 120 },
    { label: "6 PM", mins: 240 }, { label: "8 PM", mins: 360 },
    { label: "10 PM", mins: 480 }, { label: "12 AM", mins: 600 },
    { label: "2 AM", mins: 720 }, { label: "4 AM", mins: 840 },
];
const TOTAL_MINS = 840;

function filterVisible(events: any[]) {
    return (events || []).filter(
        (e: any) => !EXCLUDED_LIFECYCLE.includes((e.lifecycle || e.status || "draft").toLowerCase())
    );
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
function fmt12(t: string): string {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HostCalendarPage() {
    const { user, profile } = useDashboardAuth() as any;
    const rm = useReducedMotion();
    const hostId: string = profile?.activeMembership?.partnerId || "";

    const [currentDate, setCurrentDate] = useState(parseAsIST(null));
    const [selectedDateStr, setSelected] = useState<string | null>(null);
    const [calendarData, setCalendarData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [venues, setVenues] = useState<{ id: string; name: string; city: string }[]>([]);
    const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);

    const year = parseInt(currentDate.toLocaleString("en-US", { year: "numeric", timeZone: "Asia/Kolkata" }));
    const month = parseInt(currentDate.toLocaleString("en-US", { month: "numeric", timeZone: "Asia/Kolkata" })) - 1;

    // ── Fetch partner venues ─────────────────────────────────────────────────
    const fetchVenues = useCallback(async () => {
        if (!hostId || !user) return;
        try {
            const tok = await user.getIdToken();
            const res = await fetch(`/api/venue/partnerships?hostId=${hostId}`, {
                headers: { Authorization: `Bearer ${tok}` },
            });
            if (res.ok) {
                const d = await res.json();
                const all = d.partnerships || d.partners || [];
                const active = all
                    .filter((p: any) => p.status === "active" || p.partnershipStatus === "active")
                    .map((p: any) => ({
                        id: p.venueId || p.id,
                        name: p.name || p.venueName || "Venue",
                        city: p.city || "",
                    }));
                setVenues(active);
                if (active.length > 0 && !selectedVenueId) {
                    setSelectedVenueId(active[0].id);
                }
            }
        } catch { /* silent */ }
    }, [hostId, user, selectedVenueId]);

    // ── Fetch operating calendar for selected venue ──────────────────────────
    const fetchCalendar = useCallback(async (silent = false) => {
        if (!hostId || !selectedVenueId || !user) { setLoading(false); return; }
        if (!silent) setLoading(true);
        try {
            const tok = await user.getIdToken();
            const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
            const last = new Date(year, month + 1, 0).getDate();
            const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
            const res = await fetch(
                `/api/venues/${selectedVenueId}/calendar?hostId=${hostId}&view=operating&startDate=${start}&endDate=${end}`,
                { headers: { Authorization: `Bearer ${tok}` } }
            );
            const data = await res.json();
            if (res.ok && Array.isArray(data)) {
                setCalendarData(data.map((d: any) => {
                    const ev = filterVisible(d.events);
                    return { ...d, events: ev, stats: { ...d.stats, eventCount: ev.length } };
                }));
            } else if (!silent) {
                setCalendarData([]);
            }
        } catch { if (!silent) setCalendarData([]); }
        finally { if (!silent) setLoading(false); }
    }, [hostId, selectedVenueId, user, year, month]);

    useEffect(() => { fetchVenues(); }, [hostId, user]);
    useEffect(() => { fetchCalendar(); }, [selectedVenueId, year, month, hostId, user]);

    const firstDayIdx = useMemo(() => {
        const d = parseAsIST(`${year}-${String(month + 1).padStart(2, "0")}-01`);
        const sh = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Kolkata" }).format(d);
        return DAYS.indexOf(sh);
    }, [year, month]);

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weeks = Math.ceil((firstDayIdx + daysInMonth) / 7);

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

    const stats = useMemo(() => ({
        confirmed: calendarData.filter(d => (d.stats?.eventCount || 0) > 0).length,
        pending: calendarData.filter(d => (d.stats?.pendingSlots || 0) > 0).length,
        blocked: calendarData.filter(d => d.state === "BLOCKED").length,
    }), [calendarData]);

    const todayStr = toISODateIST(parseAsIST(null));

    const navMonth = (delta: number) => {
        const nm = month + delta;
        const ny = nm < 0 ? year - 1 : nm > 11 ? year + 1 : year;
        setCurrentDate(parseAsIST(`${ny}-${String(((nm % 12) + 12) % 12 + 1).padStart(2, "0")}-01`));
        setSelected(null);
    };

    const selectedVenue = venues.find(v => v.id === selectedVenueId);

    return (
        <VenuePageShell
            title="Slot Calendar"
            subtitle="View venue availability and request production slots."
        >
            <div className="flex flex-col gap-4" style={{ height: "calc(100vh - 13rem)" }}>

                {/* ── Venue selector ─────────────────────────────────────── */}
                {venues.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-shrink-0">
                        {venues.map(v => (
                            <button
                                key={v.id}
                                onClick={() => { setSelectedVenueId(v.id); setSelected(null); }}
                                className="flex items-center gap-2 px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all border flex-shrink-0"
                                style={{
                                    background: selectedVenueId === v.id ? C.surface : "rgba(255,255,255,0.03)",
                                    border: selectedVenueId === v.id ? `1px solid ${C.orange}` : `1px solid ${C.borderDefault}`,
                                    color: selectedVenueId === v.id ? "white" : "rgba(255,255,255,0.35)",
                                    boxShadow: selectedVenueId === v.id ? "0 0 12px rgba(244,74,34,0.2)" : "none",
                                }}
                            >
                                <Building2 className="w-3 h-3" />
                                {v.name}
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Toolbar ────────────────────────────────────────────── */}
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

                        {/* Stats pills */}
                        <div className="hidden lg:flex items-center gap-2">
                            {[
                                { n: stats.confirmed, label: "Events", color: C.teal, bg: "rgba(52,211,153,.12)", bd: "rgba(52,211,153,.25)" },
                                { n: stats.pending, label: "Pending", color: C.amber, bg: "rgba(251,191,36,.12)", bd: "rgba(251,191,36,.25)" },
                                { n: stats.blocked, label: "Blocked", color: C.red, bg: "rgba(248,113,113,.12)", bd: "rgba(248,113,113,.25)" },
                            ].map(s => s.n > 0 ? (
                                <div key={s.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black border" style={{ background: s.bg, color: s.color, borderColor: s.bd }}>
                                    <span className="tabular-nums text-[11px]">{s.n}</span>
                                    <span className="uppercase tracking-widest opacity-70">{s.label}</span>
                                </div>
                            ) : null)}
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
                        {selectedVenueId && (
                            <Link
                                href={`/host/create/select-venue/calendar?venueId=${selectedVenueId}&venueName=${encodeURIComponent(selectedVenue?.name || "")}`}
                                className="h-10 px-5 rounded-xl text-[11px] font-black uppercase tracking-widest text-white flex items-center gap-2 transition-opacity hover:opacity-85"
                                style={{ background: C.orange, boxShadow: "0 4px 20px rgba(244,74,34,0.4)" }}
                            >
                                <Plus className="w-4 h-4" /> Request Slot
                            </Link>
                        )}
                    </div>
                </div>

                {/* ── No venues state ─────────────────────────────────────── */}
                {!loading && venues.length === 0 && (
                    <div
                        className="flex-1 flex flex-col items-center justify-center gap-4 rounded-[28px] border-2 border-dashed text-center p-10"
                        style={{ borderColor: C.borderDefault }}
                    >
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: C.surface, border: `1px solid ${C.borderDefault}` }}>
                            <Building2 className="w-6 h-6" style={{ color: "rgba(255,255,255,0.3)" }} />
                        </div>
                        <div>
                            <p className="text-[14px] font-black text-white mb-1">No partner venues yet</p>
                            <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.3)" }}>Partner with a venue to access their calendar</p>
                        </div>
                        <Link href="/host/network" className="h-10 px-5 rounded-xl text-[11px] font-black uppercase tracking-widest text-white flex items-center gap-2" style={{ background: C.orange }}>
                            Browse Venues
                        </Link>
                    </div>
                )}

                {/* ── Main two-panel card ──────────────────────────────────── */}
                {(loading || venues.length > 0) && (
                    <div className="flex-1 min-h-0 overflow-hidden">
                        <div
                            className="flex flex-col lg:flex-row h-full rounded-[28px] overflow-hidden"
                            style={{ background: "#16161b", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}
                        >
                            {/* ══ CALENDAR PANEL ══ */}
                            <div className="lg:flex-[2.4] flex flex-col min-h-0" style={{ borderRight: "1px solid rgba(255,255,255,0.07)" }}>
                                {/* Day-of-week row */}
                                <div className="grid grid-cols-7 px-4 pt-5 pb-3 flex-shrink-0">
                                    {DAYS.map((d, i) => (
                                        <div key={d} className="text-center text-[9px] font-black uppercase tracking-[0.15em] py-1"
                                            style={{ color: (i === 0 || i === 6) ? "rgba(244,74,34,0.6)" : "rgba(255,255,255,0.28)" }}>
                                            {d}
                                        </div>
                                    ))}
                                </div>

                                {/* Date cells */}
                                <div className="flex-1 min-h-0 px-4 pb-4 grid grid-cols-7 gap-2" style={{ gridTemplateRows: `repeat(${weeks}, 1fr)` }}>
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

                                            let bg = isPast ? C.surfacePast : isWeekend ? C.surfaceWeekend : C.surface;
                                            let border = `1px solid ${isPast ? "rgba(255,255,255,0.05)" : C.borderDefault}`;
                                            let shadow = "none";

                                            if (isSel) {
                                                bg = C.surfaceSelected;
                                                border = `2px solid ${C.borderSelected}`;
                                                shadow = "0 0 32px rgba(244,74,34,0.3), 0 8px 24px rgba(244,74,34,0.15)";
                                            } else if (isToday) {
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
                                                    style={{ background: bg, border, boxShadow: shadow, cursor: isPast ? "not-allowed" : "pointer", opacity: isPast ? 0.42 : 1 }}
                                                    onMouseEnter={e => { if (!isPast && !isSel && !isToday) (e.currentTarget as HTMLElement).style.filter = "brightness(1.15)"; }}
                                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = ""; }}
                                                >
                                                    {hasEvents && !isSel && !isPast && (
                                                        <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${C.teal}, rgba(52,211,153,0.3))` }} />
                                                    )}
                                                    {isPast && (
                                                        <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 8px)" }} />
                                                    )}
                                                    {isToday ? (
                                                        <span className="inline-flex items-center justify-center w-[26px] h-[26px] rounded-full text-[11px] font-black text-white tabular-nums" style={{ background: C.orange, boxShadow: "0 0 16px rgba(244,74,34,0.8)" }}>
                                                            {cell.day}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[15px] font-black tabular-nums" style={{ color: numColor }}>
                                                            {cell.day}
                                                        </span>
                                                    )}
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
                                <div className="flex-shrink-0 flex items-center gap-6 px-6 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)" }}>
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

                            {/* ══ INSPECTOR PANEL ══ */}
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
                                                dateStr={selectedDateStr}
                                                data={selectedDay}
                                                hostId={hostId}
                                                venueId={selectedVenueId || ""}
                                                venueName={selectedVenue?.name || "Venue"}
                                                onClose={() => setSelected(null)}
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
                                                    <div key={size} className="absolute rounded-full" style={{ width: size * 2, height: size * 2, top: "50%", left: "50%", transform: "translate(-50%, -50%)", border: `1px solid rgba(255,255,255,${0.03 + i * 0.015})` }} />
                                                ))}
                                                <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: C.surface, border: "1px solid rgba(255,255,255,0.1)" }}>
                                                    <CalendarDays className="w-6 h-6" style={{ color: "rgba(244,74,34,0.6)" }} />
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[11px] font-black uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>Night Ops</p>
                                                <p className="text-[11px] leading-relaxed max-w-[140px] mx-auto" style={{ color: "rgba(255,255,255,0.18)" }}>Tap a date to see venue availability</p>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </VenuePageShell>
    );
}

// ── Side Panel ────────────────────────────────────────────────────────────────

function SidePanel({ dateStr, data, hostId, venueId, venueName, onClose }: {
    dateStr: string;
    data: any;
    hostId: string;
    venueId: string;
    venueName: string;
    onClose: () => void;
}) {
    const events = filterVisible(data?.events);
    const isBlocked = data?.state === "BLOCKED";
    const evCount = events.length;

    // Split events into mine vs others'
    const myEvents = events.filter((e: any) => e.hostId === hostId);
    const otherEvents = events.filter((e: any) => e.hostId !== hostId);

    const stateColor = isBlocked ? C.red : evCount > 0 ? C.teal : "rgba(255,255,255,0.3)";
    const stateBg = isBlocked ? C.surfaceBlocked : evCount > 0 ? C.surfaceEvent : "rgba(255,255,255,0.04)";
    const stateBorder = isBlocked ? C.borderBlocked : evCount > 0 ? C.borderEvent : "rgba(255,255,255,0.08)";
    const stateLabel = isBlocked ? "Blocked" : evCount > 0 ? `${evCount} Event${evCount > 1 ? "s" : ""}` : "Open Night";

    const d = parseAsIST(dateStr);
    const dayNum = d.toLocaleDateString("en-US", { day: "numeric", timeZone: "Asia/Kolkata" });
    const dayName = d.toLocaleDateString("en-US", { weekday: "long", timeZone: "Asia/Kolkata" });
    const monthStr = d.toLocaleDateString("en-US", { month: "long", timeZone: "Asia/Kolkata" });
    const yearStr = d.toLocaleDateString("en-US", { year: "numeric", timeZone: "Asia/Kolkata" });

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
        return {
            nowPct: pct(mins),
            isActive: active && mins >= 0 && mins <= TOTAL_MINS,
            nowTimeStr: `${h12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`,
        };
    }, [now, dateStr]);

    const requestSlotUrl = `/host/create/select-venue/calendar?venueId=${venueId}&venueName=${encodeURIComponent(venueName)}&date=${dateStr}`;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* ── Date hero header ── */}
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
                <div className="absolute top-0 right-0 w-40 h-40 pointer-events-none" style={{
                    background: isBlocked
                        ? "radial-gradient(circle at top right, rgba(248,113,113,0.18), transparent 65%)"
                        : evCount > 0
                            ? "radial-gradient(circle at top right, rgba(52,211,153,0.15), transparent 65%)"
                            : "radial-gradient(circle at top right, rgba(244,74,34,0.12), transparent 65%)",
                }} />
                <div className="flex items-start justify-between relative z-10">
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-4 border text-[9px] font-black uppercase tracking-widest" style={{ background: stateBg, borderColor: stateBorder, color: stateColor }}>
                            <span className="w-[5px] h-[5px] rounded-full" style={{ background: stateColor, boxShadow: `0 0 6px ${stateColor}` }} />
                            {stateLabel}
                        </div>
                        <div className="flex items-end gap-3">
                            <span className="text-[52px] font-black leading-none tabular-nums" style={{ color: "rgba(255,255,255,0.95)", letterSpacing: "-0.04em" }}>
                                {dayNum}
                            </span>
                            <div className="pb-1">
                                <p className="text-[16px] font-black leading-tight text-white">{dayName}</p>
                                <p className="text-[12px] font-medium leading-tight" style={{ color: "rgba(255,255,255,0.35)" }}>{monthStr} {yearStr}</p>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/10 border border-transparent hover:border-white/10" style={{ color: "rgba(255,255,255,0.3)" }}>
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0.08) 70%, transparent)" }} />
            </div>

            {/* ── Scrollable content ── */}
            <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.06) transparent" }}>
                <div className="px-5 pt-5 pb-4 space-y-5">

                    {/* Block info */}
                    {isBlocked && (
                        <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(220,38,38,0.12)", border: "1px solid rgba(248,113,113,0.25)" }}>
                            <div className="px-4 py-4 flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(220,38,38,0.3)", border: "1px solid rgba(248,113,113,0.5)" }}>
                                    <Lock className="w-4 h-4" style={{ color: "#FCA5A5" }} />
                                </div>
                                <div>
                                    <p className="text-[12px] font-black text-white">{data?.block?.reason || "Venue Blocked"}</p>
                                    <p className="text-[10px] font-black tabular-nums mt-0.5" style={{ color: "rgba(248,113,113,0.7)" }}>
                                        {data?.block?.startTime ? `${fmt12(data.block.startTime)} — ${fmt12(data.block.endTime)}` : "All Day"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* My events */}
                    {myEvents.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: C.teal }}>Your Events</p>
                            {myEvents.map((e: any) => (
                                <div key={e.id} className="rounded-2xl overflow-hidden" style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)" }}>
                                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.4)" }}>
                                                <CheckCircle2 className="w-4 h-4" style={{ color: C.teal }} />
                                            </div>
                                            <div>
                                                <p className="text-[12px] font-black text-white truncate max-w-[140px]">{e.name || e.title || "Your Event"}</p>
                                                {(e.startTime || e.endTime) && (
                                                    <p className="text-[10px] font-black tabular-nums mt-0.5" style={{ color: "rgba(52,211,153,0.7)" }}>
                                                        {fmt12(e.startTime || "")} — {fmt12(e.endTime || "")}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        {e.id && (
                                            <Link href={`/host/events/${e.id}`}>
                                                <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(52,211,153,0.5)" }} />
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Other events */}
                    {otherEvents.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.28)" }}>Occupied Slots</p>
                            {otherEvents.map((e: any) => (
                                <div key={e.id} className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${C.borderDefault}` }}>
                                    <div className="px-4 py-3 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.borderDefault}` }}>
                                            <Music className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />
                                        </div>
                                        <div>
                                            <p className="text-[12px] font-black" style={{ color: "rgba(255,255,255,0.55)" }}>{e.name || e.title || "Booked Event"}</p>
                                            {(e.startTime || e.endTime) && (
                                                <p className="text-[10px] font-black tabular-nums mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                                                    {fmt12(e.startTime || "")} — {fmt12(e.endTime || "")}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Night schedule timeline */}
                    <NightScheduleTimeline
                        events={events}
                        blockData={data?.block}
                        isActive={isActive}
                        nowPct={nowPct}
                        nowTimeStr={nowTimeStr}
                        hostId={hostId}
                    />
                </div>
            </div>

            {/* ── Bottom action bar ── */}
            {!isBlocked && (
                <div className="flex-shrink-0 px-5 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.2)" }}>
                    <Link href={requestSlotUrl} className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-[11px] font-black uppercase tracking-widest text-white transition-opacity hover:opacity-85" style={{ background: C.orange, boxShadow: "0 4px 20px rgba(244,74,34,0.35)" }}>
                        <Plus className="w-4 h-4" />
                        Request a Slot
                    </Link>
                </div>
            )}
        </div>
    );
}

// ── Night Schedule Timeline ───────────────────────────────────────────────────

function NightScheduleTimeline({ events, blockData, isActive, nowPct, nowTimeStr, hostId }: {
    events: any[];
    blockData: any;
    isActive: boolean;
    nowPct: string;
    nowTimeStr: string;
    hostId: string;
}) {
    const isBlocked = !!blockData;

    const EVENT_COLORS = [
        { bg: "rgba(52,211,153,0.22)", border: "rgba(52,211,153,0.7)", text: "#34D399" },
        { bg: "rgba(129,140,248,0.22)", border: "rgba(129,140,248,0.7)", text: "#818CF8" },
        { bg: "rgba(251,191,36,0.22)", border: "rgba(251,191,36,0.7)", text: "#FBBF24" },
        { bg: "rgba(244,74,34,0.22)", border: "rgba(244,74,34,0.7)", text: "#F44A22" },
        { bg: "rgba(248,113,113,0.22)", border: "rgba(248,113,113,0.7)", text: "#F87171" },
        { bg: "rgba(94,234,212,0.22)", border: "rgba(94,234,212,0.7)", text: "#5EEAD4" },
    ];

    return (
        <div>
            <div className="flex items-center gap-2 mb-4">
                <Clock className="w-3 h-3 flex-shrink-0" style={{ color: "rgba(255,255,255,0.25)" }} />
                <span className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.25)" }}>Night Schedule</span>
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                <span className="text-[9px] font-black" style={{ color: "rgba(255,255,255,0.2)" }}>2 PM — 4 AM</span>
            </div>

            <div className="flex gap-3">
                {/* Hour labels */}
                <div className="flex-shrink-0 w-10 relative" style={{ height: 300 }}>
                    {TIMELINE_HOURS.map(({ label, mins }) => (
                        <div key={label} className="absolute right-0 flex items-center justify-end" style={{ top: `${(mins / TOTAL_MINS) * 100}%`, transform: "translateY(-50%)" }}>
                            <span className="text-[8px] font-black uppercase leading-none" style={{ color: mins % 240 === 0 ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.22)", letterSpacing: "0.04em" }}>
                                {label}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Timeline grid */}
                <div className="flex-1 relative rounded-2xl overflow-hidden" style={{ height: 300, background: "#141418", border: "1px solid rgba(255,255,255,0.08)" }}>
                    {/* Alternating bands */}
                    {TIMELINE_HOURS.slice(0, -1).map(({ mins }, i) => {
                        const nextMins = TIMELINE_HOURS[i + 1].mins;
                        return (
                            <div key={`b-${i}`} className="absolute left-0 right-0 pointer-events-none"
                                style={{ top: `${(mins / TOTAL_MINS) * 100}%`, height: `${((nextMins - mins) / TOTAL_MINS) * 100}%`, background: i % 2 === 0 ? "rgba(255,255,255,0.025)" : "transparent" }} />
                        );
                    })}
                    {/* Hour lines */}
                    {TIMELINE_HOURS.map(({ mins }) => (
                        <div key={`l-${mins}`} className="absolute left-0 right-0 h-px pointer-events-none"
                            style={{ top: `${(mins / TOTAL_MINS) * 100}%`, background: mins % 240 === 0 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)" }} />
                    ))}

                    {/* NOW indicator */}
                    {isActive && (
                        <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top: nowPct }}>
                            <div className="absolute left-0 right-0 h-[1.5px]" style={{ background: "linear-gradient(90deg, #F44A22 40%, transparent)" }} />
                            <div className="absolute -left-1 w-[10px] h-[10px] rounded-full -translate-y-1/2" style={{ background: "#F44A22", boxShadow: "0 0 0 3px rgba(244,74,34,0.25), 0 0 14px rgba(244,74,34,0.6)" }} />
                            <div className="absolute right-2 -translate-y-1/2 flex items-center gap-1 px-2 py-[3px] rounded-full" style={{ background: "#F44A22" }}>
                                <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                                <span className="text-[8px] font-black text-white tracking-wide">{nowTimeStr}</span>
                            </div>
                        </div>
                    )}

                    {/* Blocked fill */}
                    {isBlocked && (() => {
                        const bStart = blockData?.startTime || "20:00";
                        const bEnd = blockData?.endTime || "04:00";
                        const sMin = timeToMins(bStart);
                        const eMin = timeToMins(bEnd);
                        const blockH = Math.max(8, ((eMin - sMin) / TOTAL_MINS) * 100);
                        return (
                            <div className="absolute left-0 right-0 z-10 flex flex-col items-center justify-center gap-2"
                                style={{ top: pct(sMin), height: `${blockH}%`, background: "rgba(220,38,38,0.28)", borderTop: "2px solid rgba(248,113,113,0.8)", borderBottom: "2px solid rgba(248,113,113,0.8)", backgroundImage: "repeating-linear-gradient(135deg, rgba(248,113,113,0.12) 0px, rgba(248,113,113,0.12) 2px, transparent 2px, transparent 12px)" }}>
                                <Lock className="w-4 h-4" style={{ color: "#FCA5A5" }} />
                                <span className="text-[9px] font-black" style={{ color: "#FCA5A5" }}>{blockData?.reason || "Blocked"}</span>
                            </div>
                        );
                    })()}

                    {/* Event blocks */}
                    {events.map((event: any, i: number) => {
                        const eStart = event.startTime || event.startDate?.substring(11, 16) || "21:00";
                        const eEnd = event.endTime || "04:00";
                        const sMin = timeToMins(eStart);
                        const eMin = timeToMins(eEnd);
                        const blockH = Math.max(5, ((eMin - sMin) / TOTAL_MINS) * 100);
                        const isMine = event.hostId === hostId;
                        const col = isMine ? EVENT_COLORS[0] : EVENT_COLORS[1];
                        return (
                            <div key={event.id || i} className="absolute left-1 right-1 z-20 rounded-lg overflow-hidden flex flex-col justify-center px-2"
                                style={{ top: pct(sMin), height: `${blockH}%`, background: col.bg, borderLeft: `3px solid ${col.border}`, borderTop: `1px solid ${col.border}40` }}>
                                <p className="text-[9px] font-black truncate leading-tight" style={{ color: col.text }}>
                                    {isMine ? "★ " : ""}{event.name || event.title || "Event"}
                                </p>
                                <p className="text-[8px] font-black tabular-nums" style={{ color: `${col.text}99` }}>
                                    {fmt12(eStart)} — {fmt12(eEnd)}
                                </p>
                            </div>
                        );
                    })}

                    {/* Empty state */}
                    {!isBlocked && events.length === 0 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
                            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "rgba(244,74,34,0.08)", border: "1px solid rgba(244,74,34,0.18)" }}>
                                <Music className="w-4 h-4" style={{ color: "rgba(244,74,34,0.55)" }} />
                            </div>
                            <div className="text-center">
                                <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>Night is open</p>
                                <p className="text-[8px] mt-0.5" style={{ color: "rgba(255,255,255,0.12)" }}>Request a slot below</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
