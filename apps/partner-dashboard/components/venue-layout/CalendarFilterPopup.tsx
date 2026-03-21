"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { useTheme } from "next-themes";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

interface EventItem {
    id: string;
    date?: string;
    startDate?: string;
    name?: string;
    title?: string;
    coverImage?: string;
    poster?: string;
    bannerImage?: string;
}

// Build a map of "YYYY-MM-DD" → EventItem[]
function buildDateMap(events: EventItem[]): Record<string, EventItem[]> {
    const map: Record<string, EventItem[]> = {};
    for (const ev of events) {
        const raw = ev.date || ev.startDate || "";
        if (!raw) continue;
        const key = raw.split("T")[0];
        if (!map[key]) map[key] = [];
        map[key].push(ev);
    }
    return map;
}

function toKey(year: number, month: number, day: number): string {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}

interface CalendarFilterPopupProps {
    selectedDate: Date | null;
    onDateSelect: (date: Date | null) => void;
    onClose: () => void;
    /** Pixel offset for positioning the popup below the trigger */
    triggerRect?: DOMRect | null;
}

export function CalendarFilterPopup({
    selectedDate,
    onDateSelect,
    onClose,
    triggerRect,
}: CalendarFilterPopupProps) {
    const { profile } = useDashboardAuth();
    const { resolvedTheme } = useTheme();
    const venueId = profile?.activeMembership?.partnerId ?? null;
    const today = new Date();

    const [viewYear, setViewYear] = useState(
        selectedDate ? selectedDate.getFullYear() : today.getFullYear()
    );
    const [viewMonth, setViewMonth] = useState(
        selectedDate ? selectedDate.getMonth() : today.getMonth()
    );
    const [events, setEvents] = useState<EventItem[]>([]);
    const [loading, setLoading] = useState(false);
    const popupRef = useRef<HTMLDivElement>(null);

    // Fetch events for the venue (get enough to fill the calendar)
    useEffect(() => {
        if (!venueId) return;
        let cancelled = false;
        setLoading(true);
        fetch(`/api/venue/events?venueId=${venueId}&limit=200`)
            .then((r) => r.json())
            .then((data) => {
                if (cancelled) return;
                const list = data.events || data || [];
                setEvents(Array.isArray(list) ? list : []);
            })
            .catch(() => {
                if (!cancelled) setEvents([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [venueId]);

    // Close on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
                onClose();
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [onClose]);

    const dateMap = buildDateMap(events);

    // Build the calendar grid for viewYear/viewMonth
    const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: Array<{ day: number | null }> = [];
    for (let i = 0; i < firstDay; i++) cells.push({ day: null });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });
    // Pad to full rows
    while (cells.length % 7 !== 0) cells.push({ day: null });

    function prevMonth() {
        if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
        else setViewMonth(m => m - 1);
    }
    function nextMonth() {
        if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
        else setViewMonth(m => m + 1);
    }

    function handleDayClick(day: number) {
        const clicked = new Date(viewYear, viewMonth, day);
        if (selectedDate && isSameDay(clicked, selectedDate)) {
            onDateSelect(null); // toggle off
        } else {
            onDateSelect(clicked);
        }
        onClose();
    }

    // Compute dropdown position — clamped so it never clips off the right edge
    const popupLeft = triggerRect
        ? Math.min(triggerRect.left, window.innerWidth - 348)
        : window.innerWidth / 2 - 170;
    const popupTop = triggerRect ? triggerRect.bottom + 6 : window.innerHeight / 2 - 240;

    const popup = (
        <motion.div
            ref={popupRef}
            initial={{ opacity: 0, scale: 0.97, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -6 }}
            transition={{ type: "spring", damping: 30, stiffness: 400 }}
            className="w-[340px] rounded-2xl overflow-hidden"
            style={{
                position: "fixed",
                top: popupTop,
                left: popupLeft,
                zIndex: 9999,
                background: "var(--v-card)",
                border: "1px solid var(--v-border)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)",
            }}
        >
            {/* Header */}
            <div
                className="flex items-center justify-between px-5 pt-4 pb-3"
                style={{ borderBottom: "1px solid var(--v-border)" }}
            >
                <button
                    onClick={prevMonth}
                    className="w-8 h-8 flex items-center justify-center rounded-full transition-all"
                    style={{ background: "var(--v-neutral-bg)" }}
                >
                    <ChevronLeft className="w-4 h-4" style={{ color: "var(--v-text-secondary)" }} />
                </button>

                <div className="text-center">
                    <p className="text-[13px] font-black tracking-wide" style={{ color: "var(--v-text-primary)" }}>
                        {MONTHS[viewMonth]}
                    </p>
                    <p className="text-[11px] font-semibold" style={{ color: "var(--v-text-muted)" }}>
                        {viewYear}
                    </p>
                </div>

                <button
                    onClick={nextMonth}
                    className="w-8 h-8 flex items-center justify-center rounded-full transition-all"
                    style={{ background: "var(--v-neutral-bg)" }}
                >
                    <ChevronRight className="w-4 h-4" style={{ color: "var(--v-text-secondary)" }} />
                </button>
            </div>

            {/* Day labels */}
            <div className="grid grid-cols-7 px-4 pt-3 pb-1">
                {DAY_LABELS.map((d) => (
                    <div key={d} className="text-center text-[9px] font-black uppercase tracking-widest"
                        style={{ color: "var(--v-text-muted)" }}>
                        {d}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-y-1 px-3 pb-3">
                {cells.map((cell, idx) => {
                    if (cell.day === null) {
                        return <div key={`empty-${idx}`} />;
                    }

                    const key = toKey(viewYear, viewMonth, cell.day);
                    const dayEvents = dateMap[key] || [];
                    const isToday = isSameDay(new Date(viewYear, viewMonth, cell.day), today);
                    const isSelected = selectedDate
                        ? isSameDay(new Date(viewYear, viewMonth, cell.day), selectedDate)
                        : false;
                    const hasEvents = dayEvents.length > 0;

                    // Get up to 2 poster images
                    const posters = dayEvents
                        .slice(0, 2)
                        .map(ev => ev.coverImage || ev.poster || ev.bannerImage || "")
                        .filter(Boolean);

                    return (
                        <button
                            key={key}
                            onClick={() => handleDayClick(cell.day!)}
                            className="relative flex flex-col items-center justify-start py-1 rounded-xl transition-all group"
                            style={{
                                background: isSelected
                                    ? "var(--v-orange)"
                                    : isToday
                                        ? "var(--v-neutral-bg)"
                                        : "transparent",
                                minHeight: 52,
                            }}
                        >
                            {/* Day number */}
                            <span
                                className="text-[12px] font-bold leading-none mb-1 mt-1"
                                style={{
                                    color: isSelected
                                        ? "#fff"
                                        : isToday
                                            ? "var(--v-orange)"
                                            : "var(--v-text-primary)",
                                }}
                            >
                                {cell.day}
                            </span>

                            {/* Event posters / indicators */}
                            {hasEvents && (
                                <div className="flex items-center justify-center gap-0.5">
                                    {posters.length > 0 ? (
                                        <div className="flex -space-x-1.5">
                                            {posters.map((src, i) => (
                                                <img
                                                    key={i}
                                                    src={src}
                                                    alt=""
                                                    className="w-5 h-5 rounded-full object-cover ring-1"
                                                    style={{
                                                        boxSizing: "border-box",
                                                        border: `1.5px solid ${isSelected ? "rgba(255,255,255,0.4)" : "var(--v-card)"}`,
                                                    }}
                                                />
                                            ))}
                                            {dayEvents.length > 2 && (
                                                <div
                                                    className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black"
                                                    style={{
                                                        background: isSelected ? "rgba(255,255,255,0.25)" : "var(--v-elevated)",
                                                        color: isSelected ? "#fff" : "var(--v-text-secondary)",
                                                        border: `1.5px solid ${isSelected ? "rgba(255,255,255,0.4)" : "var(--v-card)"}`,
                                                    }}
                                                >
                                                    +{dayEvents.length - 2}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        // No poster image — show dot indicators
                                        <div className="flex gap-0.5">
                                            {dayEvents.slice(0, 3).map((_, i) => (
                                                <div
                                                    key={i}
                                                    className="w-1 h-1 rounded-full"
                                                    style={{
                                                        background: isSelected
                                                            ? "rgba(255,255,255,0.8)"
                                                            : "var(--v-orange)",
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Footer */}
            <div
                className="flex items-center justify-between px-5 py-3"
                style={{ borderTop: "1px solid var(--v-border)" }}
            >
                <button
                    onClick={() => {
                        const now = new Date();
                        setViewYear(now.getFullYear());
                        setViewMonth(now.getMonth());
                    }}
                    className="text-[11px] font-bold transition-colors"
                    style={{ color: "var(--v-orange)" }}
                >
                    Today
                </button>

                <div className="flex items-center gap-2">
                    {loading && (
                        <span className="text-[10px]" style={{ color: "var(--v-text-muted)" }}>
                            Loading events…
                        </span>
                    )}
                    {selectedDate && (
                        <button
                            onClick={() => { onDateSelect(null); onClose(); }}
                            className="flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold transition-all"
                            style={{
                                background: "var(--v-neutral-bg)",
                                border: "1px solid var(--v-border)",
                                color: "var(--v-text-secondary)",
                            }}
                        >
                            <X className="w-3 h-3" />
                            Clear
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );

    // Portal to document.body so position:fixed is relative to the viewport,
    // not the sticky header's backdrop-filter stacking context.
    // We wrap with .venue-shell (+ dark class) so CSS variables resolve correctly.
    return createPortal(
        <div className={cn("venue-shell", resolvedTheme === "dark" && "dark")}>
            {popup}
        </div>,
        document.body
    );
}
