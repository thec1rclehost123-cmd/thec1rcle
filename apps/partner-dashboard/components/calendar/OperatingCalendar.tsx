"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import {
    ChevronLeft,
    ChevronRight,
    X,
    Plus,
    Clock,
    CheckCircle2,
    AlertCircle,
    User,
    Lock,
    Settings,
    Calendar as CalendarIcon,
    Sparkles,
    Eye,
    MapPin,
    Music
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { parseAsIST, toISODateIST } from "@c1rcle/core/time";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cleanJargon } from "@/lib/utils/jargon";
import { EVENT_LIFECYCLE } from "@c1rcle/core/events";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SectionLabel } from "@/components/ui/SectionLabel";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

// Lifecycle states that should never appear on the calendar
const EXCLUDED_LIFECYCLE = [
    EVENT_LIFECYCLE.DRAFT,
    EVENT_LIFECYCLE.DELETED,
    EVENT_LIFECYCLE.CANCELLED,
    EVENT_LIFECYCLE.DENIED
];

function filterVisibleEvents(events: any[]) {
    return (events || []).filter((e: any) => {
        const lc = e.lifecycle || e.status || "draft";
        return !EXCLUDED_LIFECYCLE.includes(lc);
    });
}

export function OperatingCalendar() {
    const { user, profile } = useDashboardAuth();
    const pathname = usePathname();
    const role = (pathname.startsWith('/club') || pathname.startsWith('/venue')) ? 'venue' : 'host';

    const [currentDate, setCurrentDate] = useState(parseAsIST(null));
    const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [calendarData, setCalendarData] = useState<any[]>([]);

    const year = parseInt(currentDate.toLocaleString('en-US', { year: 'numeric', timeZone: 'Asia/Kolkata' }));
    const month = parseInt(currentDate.toLocaleString('en-US', { month: 'numeric', timeZone: 'Asia/Kolkata' })) - 1;

    const fetchCalendar = async () => {
        if (!profile?.activeMembership?.partnerId) return;
        setLoading(true);
        try {
            const partnerId = profile.activeMembership.partnerId;
            const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
            const lastDay = new Date(year, month + 1, 0).getDate();
            const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

            const token = await user?.getIdToken();
            const idParam = role === 'venue' ? `venueId=${partnerId}` : `hostId=${partnerId}`;
            const res = await fetch(`/api/venue/calendar?${idParam}&view=operating&startDate=${startStr}&endDate=${endStr}`, {
                headers: token ? { "Authorization": `Bearer ${token}` } : {}
            });
            const data = await res.json();

            if (res.ok && Array.isArray(data)) {
                // Filter draft events from each day's event list (safety net)
                const cleaned = data.map((day: any) => {
                    const visibleEvents = filterVisibleEvents(day.events);
                    return {
                        ...day,
                        events: visibleEvents,
                        stats: {
                            ...day.stats,
                            eventCount: visibleEvents.length
                        }
                    };
                });
                setCalendarData(cleaned);
            } else {
                setCalendarData([]);
            }
        } catch (err) {
            console.error("Failed to fetch calendar:", err);
            setCalendarData([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCalendar();
    }, [profile, currentDate]);

    const startOfMonth = parseAsIST(`${year}-${String(month + 1).padStart(2, '0')}-01`);
    const formatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Asia/Kolkata' });
    const shortDay = formatter.format(startOfMonth);
    const firstDayIdx = DAYS.indexOf(shortDay);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const calendarGrid = useMemo(() => {
        const grid: any[] = [];
        for (let i = 0; i < firstDayIdx; i++) grid.push(null);
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayData = calendarData.find(d => d.date === dateStr);
            grid.push({ day, dateStr, ...dayData });
        }
        return grid;
    }, [calendarData, year, month, daysInMonth, firstDayIdx]);

    const selectedDay = useMemo(() =>
        calendarGrid.find(d => d?.dateStr === selectedDateStr),
        [calendarGrid, selectedDateStr]);

    const navigateMonth = (delta: number) => {
        const newMonth = month + delta;
        const newYear = newMonth < 0 ? year - 1 : newMonth > 11 ? year + 1 : year;
        const adjustedMonth = ((newMonth % 12) + 12) % 12;
        setCurrentDate(parseAsIST(`${newYear}-${String(adjustedMonth + 1).padStart(2, '0')}-01`));
    };

    const handleSlotAction = async (slotId: string, action: 'approve' | 'reject', notes: string = "") => {
        if (!profile) return;
        try {
            const token = await user?.getIdToken();
            const res = await fetch(`/api/slots/${slotId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { "Authorization": `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    action,
                    notes,
                    actor: {
                        uid: profile.uid,
                        role: role,
                        name: profile.displayName || profile.email
                    }
                })
            });
            if (res.ok) {
                await fetchCalendar();
            } else {
                const error = await res.json();
                alert(`Action failed: ${error.error}`);
            }
        } catch (err) {
            console.error(`Failed to ${action} slot:`, err);
        }
    };

    const handleBlockDate = async (date: string, action: 'block' | 'unblock', reason: string = "Manual Block", startTime: string = "16:00", endTime: string = "04:00") => {
        if (!profile?.activeMembership?.partnerId) {
            console.error("No active partner membership found in profile");
            return;
        }

        try {
            const token = await user?.getIdToken();
            const res = await fetch('/api/venue/calendar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { "Authorization": `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    action,
                    venueId: profile.activeMembership.partnerId,
                    date,
                    reason,
                    startTime,
                    endTime
                })
            });

            if (res.ok) {
                await fetchCalendar();
            } else {
                const errData = await res.json();
                console.error("Failed to update calendar state:", errData.error);
                alert(`Error: ${errData.error || "Failed to edit state"}`);
            }
        } catch (err) {
            console.error("Network error updating block status:", err);
            alert("Network error. Please check your connection.");
        }
    };

    // Stats for header badges
    const stats = useMemo(() => {
        const confirmed = calendarData.filter(d => d.state === 'CONFIRMED').length;
        const pending = calendarData.filter(d => d.state === 'PENDING' || d.stats?.pendingSlots > 0).length;
        const open = calendarData.filter(d => d.state === 'OPEN').length;
        const blocked = calendarData.filter(d => d.state === 'BLOCKED').length;
        return { confirmed, pending, open, blocked };
    }, [calendarData]);

    const todayStr = toISODateIST(parseAsIST(null));

    return (
        <div className="flex flex-col w-full min-h-0 gap-3" style={{ height: 'calc(100vh - 13rem)' }}>
            {/* Toolbar — single row */}
            <div className="flex items-center justify-between gap-4 px-1">
                {/* Left: Month navigation */}
                <div className="flex items-center gap-0.5">
                    <button
                        onClick={() => navigateMonth(-1)}
                        className="p-1.5 hover:bg-[var(--bg-fill)] rounded-[var(--r-sm)] transition-all text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-3 text-[14px] font-[600] text-[var(--text-primary)] min-w-[140px] text-center tracking-[-0.01em]">
                        {MONTHS[month]} {year}
                    </span>
                    <button
                        onClick={() => navigateMonth(1)}
                        className="p-1.5 hover:bg-[var(--bg-fill)] rounded-[var(--r-sm)] transition-all text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>

                {/* Right: legend + view toggle + actions */}
                <div className="flex items-center gap-4">
                    {/* Status legend — inline dots, no chip shapes */}
                    <div className="hidden lg:flex items-center gap-3">
                        {[
                            { color: "var(--color-success)", label: "Confirmed" },
                            { color: "var(--color-warning)", label: "Pending" },
                            { color: "var(--color-error)",   label: "Blocked"   },
                        ].map(({ color, label }) => (
                            <div key={label} className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                                <span className="text-[12px] text-[var(--text-tertiary)]">{label}</span>
                            </div>
                        ))}
                    </div>

                    {/* View toggle */}
                    <SegmentedControl
                        options={[{ value: "month", label: "Month" }, { value: "week", label: "Week" }]}
                        value="month"
                        onChange={() => {}}
                    />

                    {/* Block Date — ghost, venue only */}
                    {role === 'venue' && (
                        <button
                            onClick={() => {
                                if (!selectedDateStr) {
                                    const now = parseAsIST(null);
                                    setCurrentDate(now);
                                    setSelectedDateStr(toISODateIST(now));
                                }
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-sm)] border border-[var(--border-subtle)] text-[12px] font-[500] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-fill)] transition-all"
                        >
                            <Lock className="h-3.5 w-3.5" />
                            Block Date
                        </button>
                    )}

                    {/* Create Event — sm primary */}
                    {role === 'venue' && (
                        <Link
                            href="/venue/create"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-sm)] text-[12px] font-[600] bg-[var(--accent)] text-white hover:opacity-90 transition-opacity active:scale-[0.98]"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Create Event
                        </Link>
                    )}
                </div>
            </div>

            {/* Unified Calendar Block */}
            <div className="flex flex-col lg:flex-row bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--r-xl)] overflow-hidden shadow-[var(--shadow-lg)] flex-1 min-h-0">
                
                {/* Calendar Side */}
                <div className="lg:flex-[2.2] flex flex-col border-b lg:border-b-0 lg:border-r border-[var(--border-subtle)]">
                    <div className="grid grid-cols-7 border-b border-[var(--border-subtle)] bg-[var(--bg-fill)]">
                        {DAYS.map(d => (
                            <div key={d} className="py-4 text-center text-[10px] font-black text-[var(--text-tertiary)] uppercase tracking-[0.2em]">
                                {d}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 flex-1">
                        {calendarGrid.map((cell, idx) => {
                            if (!cell) {
                                return <div key={`empty-${idx}`} className="min-h-[48px] bg-[var(--bg-fill)] border-r border-b border-[var(--border-subtle)] last:border-r-0" />;
                            }

                            const isToday = cell.dateStr === todayStr;
                            const isSelected = cell.dateStr === selectedDateStr;
                            const eventCount = cell.stats?.eventCount || 0;
                            const hasPending = cell.stats?.pendingSlots > 0;
                            const isBlocked = cell.state === 'BLOCKED';
                            const isPast = cell.dateStr < todayStr;

                            return (
                                <button
                                    key={cell.dateStr}
                                    onClick={() => setSelectedDateStr(cell.dateStr)}
                                    className={`
                                        relative min-h-[48px] p-2.5 text-left border-r border-b border-[var(--border-subtle)] transition-all group overflow-hidden last:border-r-0
                                        ${isSelected ? 'bg-[var(--bg-fill)]' : isBlocked ? 'bg-[var(--bg-fill)]' : 'hover:bg-[var(--bg-fill)]'}
                                        ${isPast && !isSelected ? 'opacity-40 grayscale-[0.8]' : ''}
                                    `}
                                >
                                    {isSelected && <div className="absolute inset-x-0 top-0 h-0.5 bg-[var(--accent)] z-20" />}

                                    <div className="flex items-center justify-between relative z-10 mb-1.5">
                                        <span className={`text-[14px] font-[500] tabular-nums transition-colors ${isToday ? 'text-[var(--accent)] flex items-center gap-1.5' : isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}`}>
                                            {cell.day}
                                            {isToday && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] " />}
                                        </span>
                                        {hasPending && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-warning)] animate-pulse" />}
                                    </div>

                                    {(eventCount > 0 || isBlocked) && (
                                        <div className="space-y-1 relative z-10">
                                            {cell.events.slice(0, 3).map((e: any) => (
                                                <div key={e.id} className={`h-1 rounded-full w-full ${[EVENT_LIFECYCLE.SCHEDULED, EVENT_LIFECYCLE.LIVE, EVENT_LIFECYCLE.APPROVED].includes(e.lifecycle || e.status) ? 'bg-[var(--color-success)]/80' : 'bg-[var(--color-warning)]/80'}`} />
                                            ))}
                                            {isBlocked && (
                                                <div className="h-1 rounded-full w-full bg-[var(--color-error)]/60 border border-[var(--color-error)]/20" />
                                            )}
                                            <p className="text-[7px] font-black text-[var(--text-tertiary)] uppercase tracking-widest mt-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                {isBlocked ? 'Date Blocked' : `${eventCount} Active Slot${eventCount !== 1 ? 's' : ''}`}
                                            </p>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                </div>

                {/* Inspection Side (Adjacent) */}
                <div className="lg:flex-[1] bg-[var(--bg-fill)] flex flex-col overflow-hidden">
                    <AnimatePresence mode="wait">
                        {selectedDateStr ? (
                            <motion.div
                                key={selectedDateStr}
                                initial={{ opacity: 0, x: 15 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                className="flex-1 flex flex-col"
                            >
                                <SidePanel
                                    role={role}
                                    dateStr={selectedDateStr}
                                    data={selectedDay}
                                    onClose={() => setSelectedDateStr(null)}
                                    onSlotAction={handleSlotAction}
                                    onBlockDate={handleBlockDate}
                                />
                            </motion.div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                                <CalendarIcon className="w-6 h-6 text-[var(--text-tertiary)] mb-3" />
                                <p className="text-[15px] font-[500] text-[var(--text-secondary)] mb-1.5">Select a date</p>
                                <p className="text-[13px] text-[var(--text-tertiary)] max-w-[200px] leading-relaxed">
                                    Tap any day to view events and manage availability.
                                </p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

/* ---------- Stat Badge ---------- */
function StatBadge({ count, label, color }: { count: number; label: string; color: string }) {
    const colorMap: Record<string, string> = {
        emerald: 'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success)]/20',
        amber:   'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning)]/20',
        gray:    'bg-[var(--bg-fill)] text-[var(--text-tertiary)] border-[var(--border-subtle)]',
        rose:    'bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-error)]/20',
    };
    return (
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--r-sm)] dash-label-sm border ${colorMap[color] || colorMap.gray}`}>
            <span className="tabular-nums font-bold">{count}</span>
            <span>{label}</span>
        </div>
    );
}

/* ---------- Legend Item ---------- */
function LegendItem({ color, label, icon }: { color: string; label: string; icon?: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2">
            {icon || <span className={`w-2 h-2 rounded-full ${color}`} />}
            <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">{label}</span>
        </div>
    );
}

/* ---------- Side Panel ---------- */
function SidePanel({
    role,
    dateStr,
    data,
    onClose,
    onSlotAction,
    onBlockDate
}: {
    role: string,
    dateStr: string,
    data: any,
    onClose: () => void,
    onSlotAction: (id: string, action: 'approve' | 'reject') => Promise<void>,
    onBlockDate: (date: string, action: 'block' | 'unblock', reason?: string, start?: string, end?: string) => Promise<void>
}) {
    const [isPending, setIsPending] = useState(false);
    const [reason, setReason] = useState(data?.block?.reason || "Private Event / Maintenance");
    const [startTime, setStartTime] = useState(data?.block?.startTime || "20:00");
    const [endTime, setEndTime] = useState(data?.block?.endTime || "04:00");
    const [isBlockingMode, setIsBlockingMode] = useState(false);

    useEffect(() => {
        if (!isBlockingMode) {
            setReason(data?.block?.reason || "Private Event / Maintenance");
            setStartTime(data?.block?.startTime || "20:00");
            setEndTime(data?.block?.endTime || "04:00");
        }
    }, [data, isBlockingMode]);
 
    const d = parseAsIST(dateStr);
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' });
    const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' });
 
    // --- Hourly Timeline Logic ---
    const HOURS = [
        "2 PM", "3 PM", "4 PM", "5 PM", "6 PM", "7 PM", "8 PM", "9 PM", "10 PM", "11 PM",
        "12 AM", "1 AM", "2 AM", "3 AM", "4 AM"
    ];
 
    const timeToMinutes = (time: string) => {
        if (!time) return 0;
        const [h, m] = time.split(':').map(Number);
        // Normalize: 2 PM (14:00) is 0 minutes
        let mins = h * 60 + m;
        if (h < 14) mins += 24 * 60; // Rollover for hours after midnight
        return mins - (14 * 60);
    };
 
    const TOTAL_MINUTES = 14 * 60; // 2 PM to 4 AM = 14 hours
 
    const getPosition = (start: string, end: string) => {
        const startMin = timeToMinutes(start);
        const endMin = timeToMinutes(end);
        const top = (startMin / TOTAL_MINUTES) * 100;
        const height = ((endMin - startMin) / TOTAL_MINUTES) * 100;
        return { 
            top: `${Math.max(0, top)}%`, 
            height: `${Math.max(4, height)}%` 
        }; // Min 4% height to ensure visibility
    };

    const handleAction = async () => {
        if (isPending) return;
        setIsPending(true);
        try {
            await onBlockDate(dateStr, 'block', reason, startTime, endTime);
            setIsBlockingMode(false);
        } finally {
            setIsPending(false);
        }
    };

    const handleUnblock = async () => {
        if (isPending) return;
        setIsPending(true);
        try {
            await onBlockDate(dateStr, 'unblock');
            setIsBlockingMode(false);
        } finally {
            setIsPending(false);
        }
    };

    const events = filterVisibleEvents(data?.events) || [];
    const pendingSlots = (data?.slots || []).filter((s: any) => s.status === 'pending');
    const isBlocked = data?.state === 'BLOCKED';
    const eventCount = events.length;
 
    // --- Live "Now" Indicator ---
    const [now, setNow] = useState(parseAsIST(null));
    useEffect(() => {
        const timer = setInterval(() => setNow(parseAsIST(null)), 60000);
        return () => clearInterval(timer);
    }, []);

    const { isActive, timeStr } = useMemo(() => {
        const todayStr = toISODateIST(now);
        const yesterdayStr = toISODateIST(new Date(now.getTime() - 24 * 60 * 60 * 1000));
        const currentH = now.getHours();
        const currentM = now.getMinutes();
        const tStr = `${String(currentH).padStart(2, '0')}:${String(currentM).padStart(2, '0')}`;
        
        let active = false;
        if (currentH >= 14 && dateStr === todayStr) active = true;
        if (currentH < 4 && dateStr === yesterdayStr) active = true;
        
        return { isActive: active, timeStr: tStr };
    }, [now, dateStr]);

    const nowIndicator = useMemo(() => {
        if (!isActive) return null;
        const pos = getPosition(timeStr, timeStr);
        return (
            <div 
                className="absolute left-0 right-0 z-50 flex items-center pointer-events-none" 
                style={{ top: pos.top }}
            >
                <div className="w-2 h-2 rounded-full bg-[var(--accent)]  -ml-1 flex-shrink-0 animate-pulse" />
                <div className="flex-1 h-[2px] bg-[var(--accent)] " />
                <div className="bg-[var(--accent)] text-white text-[8px] font-black px-2 py-0.5 rounded-full ml-3 uppercase tracking-tighter shadow-xl">
                    Now
                </div>
            </div>
        );
    }, [isActive, timeStr]);

    return (
        <div className="h-full flex flex-col">
            {/* Panel Header */}
            <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between sticky top-0 z-40 bg-[var(--bg-fill)]">
                <div>
                    <p className="text-[15px] font-[600] text-[var(--text-primary)] leading-none">{dayName}</p>
                    <p className="text-[13px] text-[var(--text-tertiary)] mt-1">{monthDay}</p>
                </div>
                <div className="flex items-center gap-2">
                    {isBlocked && (
                        <span className="flex items-center gap-1 text-[12px] text-[var(--color-error)]">
                            <Lock className="h-3 w-3" /> Blocked
                        </span>
                    )}
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-[var(--bg-elevated)] rounded-[var(--r-sm)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Content: Hourly Timeline (Google Calendar style) */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-[var(--bg-base)]/30">
                <div className="relative flex h-full min-h-0 px-6 py-4">
                    {/* Time Labels */}
                    <div className="w-14 flex flex-col justify-between text-[10px] font-black text-[var(--text-tertiary)] uppercase border-r border-[var(--border-subtle)]/30 mr-4 py-1">
                        {HOURS.map(h => (
                            <div key={h} className="h-0 flex items-center justify-end pr-3">{h}</div>
                        ))}
                    </div>
 
                    {/* Grid Lines */}
                    <div className="absolute inset-y-6 left-[80px] right-6 pointer-events-none">
                        {HOURS.map((_, i) => (
                            <div key={i} className="h-0 border-t border-[var(--border-subtle)]/20" style={{ top: `${(i / (HOURS.length - 1)) * 100}%` }} />
                        ))}
                    </div>
 
                    {/* Action Layers */}
                    <div className="flex-1 relative mx-2">
                        {/* 0. Now Indicator */}
                        {nowIndicator}

                        {/* 1. Blocked Interval (if any) */}
                        {isBlocked && (
                            <div 
                                className="absolute left-0 right-0 bg-[var(--color-error-bg)] border border-[var(--color-error)]/20 rounded-[1.5rem] flex flex-col items-center justify-center overflow-hidden z-10 shadow-inner"
                                style={getPosition(data.block?.startTime || "20:00", data.block?.endTime || "04:00")}
                            >
                                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, var(--color-error), var(--color-error) 12px, transparent 12px, transparent 24px)' }} />
                                <div className="bg-[var(--color-error-bg)] p-3 rounded-full mb-2">
                                    <Lock className="w-5 h-5 text-[var(--color-error)] opacity-60" />
                                </div>
                                <span className="text-[10px] font-black text-[var(--color-error)] uppercase tracking-widest">{data.block?.reason || 'BLOCKED'}</span>
                            </div>
                        )}
 
                        {/* 2. Events */}
                        {(() => {
                            // 1. Group events into collision groups
                            const sorted = [...events].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime) || a.id.localeCompare(b.id));
                            const groups: any[][] = [];
                            
                            sorted.forEach(event => {
                                const start = timeToMinutes(event.startTime || "21:00");
                                let foundGroup = false;
                                for (const group of groups) {
                                    // If this event starts before the latest end in this group, it collides
                                    const latestEnd = Math.max(...group.map(e => timeToMinutes(e.endTime || "04:00")));
                                    if (start < latestEnd) {
                                        group.push(event);
                                        foundGroup = true;
                                        break;
                                    }
                                }
                                if (!foundGroup) groups.push([event]);
                            });

                            // 2. Assign columns within each group
                            return groups.flatMap(group => {
                                const columns: any[][] = [];
                                group.forEach(event => {
                                    const start = timeToMinutes(event.startTime || "21:00");
                                    let placed = false;
                                    for (const col of columns) {
                                        const lastInCol = col[col.length - 1];
                                        if (start >= timeToMinutes(lastInCol.endTime || "04:00")) {
                                            col.push(event);
                                            placed = true;
                                            break;
                                        }
                                    }
                                    if (!placed) columns.push([event]);
                                });

                                const totalCols = columns.length;
                                return group.map(e => {
                                    const pos = getPosition(e.startTime || "21:00", e.endTime || "04:00");
                                    const colIdx = columns.findIndex(col => col.includes(e));
                                    
                                    // Check currently live state (inline to avoid hook usage inside map)
                                    const startMin = timeToMinutes(e.startTime || "21:00");
                                    const endMin = timeToMinutes(e.endTime || "04:00");
                                    const currentMin = timeToMinutes(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
                                    const isConfirmed = [EVENT_LIFECYCLE.SCHEDULED, EVENT_LIFECYCLE.LIVE, EVENT_LIFECYCLE.APPROVED].includes(e.lifecycle || e.status);
                                    const isCurrentlyLive = isActive && isConfirmed && currentMin >= startMin && currentMin <= endMin;

                                    return (
                                        <Link
                                            key={e.id}
                                            href={role === 'venue' ? `/venue/events/${e.id}` : `/host/events/${e.id}`}
                                            className={`absolute p-2 lg:p-4 rounded-xl lg:rounded-[var(--r-lg)] border transition-all hover:scale-[1.03] hover:shadow-2xl z-20 group overflow-hidden ${
                                                isCurrentlyLive 
                                                    ? 'bg-[var(--color-success-bg)] border-[var(--color-success)]/40 shadow-[var(--shadow-md)]'
                                                    : isConfirmed 
                                                        ? 'bg-[var(--color-success-bg)] border-[var(--color-success)]/20 shadow-[var(--shadow-sm)]' 
                                                        : 'bg-[var(--color-warning-bg)] border-[var(--color-warning)]/20 shadow-[var(--shadow-sm)]'
                                            } ${totalCols > 1 ? 'backdrop-blur-md' : ''}`}
                                            style={{
                                                ...pos,
                                                left: `${(colIdx * 100) / totalCols}%`,
                                                width: `${100 / totalCols - 1}%`, // -1% padding for visibility
                                            }}
                                        >
                                            <div className="flex items-start justify-between gap-1 lg:gap-3 h-full">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-1 lg:gap-2 mb-0.5 lg:mb-1.5">
                                                        <h4 className="text-[11px] lg:text-[13px] font-black text-[var(--text-primary)] tracking-tight leading-tight truncate uppercase">
                                                            {e.title || 'Reserved'}
                                                        </h4>
                                                        {isCurrentlyLive && (
                                                            <span className="flex items-center gap-1 px-1 lg:px-2 py-0.5 rounded-full bg-[var(--color-success)] text-white dash-label-sm animate-pulse flex-shrink-0">
                                                                <span className="w-1 h-1 rounded-full bg-white" />
                                                                Live
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1 lg:gap-2 text-[8px] lg:text-[10px] font-black tabular-nums text-[var(--text-tertiary)] uppercase tracking-tight">
                                                        <Clock className="w-2 h-2 lg:w-3 lg:h-3 text-[var(--accent)]" />
                                                        {e.startTime} <span className="opacity-30">—</span> {e.endTime}
                                                    </div>
                                                </div>
                                                {e.posterUrl && totalCols === 1 && (
                                                    <div className="w-8 h-8 lg:w-12 lg:h-12 rounded-lg lg:rounded-xl overflow-hidden flex-shrink-0 border border-[var(--border-subtle)] group-hover:scale-110 transition-transform shadow-sm">
                                                        <img src={e.posterUrl} alt="" className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                            </div>
                                        </Link>
                                    );
                                });
                            });
                        })()}
                    </div>
                </div>
            </div>

            {/* Pending Slot Requests */}
            {pendingSlots.length > 0 && (
                <div className="flex-shrink-0 p-4 space-y-2 border-t border-[var(--border-subtle)] bg-[var(--bg-base)]">
                    <SectionLabel className="px-1">PENDING APPROVAL ({pendingSlots.length})</SectionLabel>
                    {pendingSlots.map((s: any) => (
                        <div key={s.id} className="p-3 rounded-xl bg-[var(--color-warning-bg)] border border-[var(--color-warning)]/20">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-8 h-8 rounded-lg bg-[var(--color-warning-bg)] flex items-center justify-center">
                                    <CalendarIcon className="h-4 w-4 text-[var(--color-warning)]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-xs font-bold text-[var(--text-primary)]">{s.host} Request</h4>
                                    <p className="text-[10px] text-[var(--text-tertiary)] tabular-nums">{s.startTime} — {s.endTime}</p>
                                </div>
                            </div>
                            {role === 'venue' && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onSlotAction(s.id, 'approve')}
                                        className="flex-1 py-2 bg-[var(--text-primary)] text-white rounded-lg font-bold text-[10px] uppercase tracking-wider hover:opacity-90 transition-all"
                                    >
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => onSlotAction(s.id, 'reject')}
                                        className="px-4 py-2 border border-[var(--border-default)] text-[var(--text-tertiary)] rounded-lg font-bold text-[10px] uppercase tracking-wider hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all"
                                    >
                                        Decline
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Empty State / Blocked Info */}
            {(eventCount === 0 && pendingSlots.length === 0) && (
                <div className="flex-shrink-0 flex flex-col items-center justify-center p-6 text-center bg-[var(--bg-base)] border-t border-[var(--border-subtle)]">
                    {isBlocked
                        ? <Lock className="w-5 h-5 text-[var(--text-tertiary)] mb-2" />
                        : <Sparkles className="w-5 h-5 text-[var(--text-tertiary)] mb-2" />
                    }
                    <p className="text-[15px] font-[500] text-[var(--text-secondary)] mb-1">
                        {isBlocked ? 'Date Blocked' : 'Night is Open'}
                    </p>
                    <p className="text-[13px] text-[var(--text-tertiary)] max-w-[200px]">
                        {isBlocked
                            ? (data.block?.reason || 'Blocked for maintenance or private events.')
                            : 'Available for bookings.'}
                    </p>
                    {isBlocked && data.block?.startTime && (
                        <p className="text-[12px] text-[var(--text-tertiary)] tabular-nums mt-1.5">
                            {data.block.startTime} — {data.block.endTime}
                        </p>
                    )}
                </div>
            )}
            </div>

            {/* Block Settings Panel */}
            {role === 'venue' && isBlockingMode && (
                <div className="px-5 py-5 border-t border-[var(--border-subtle)] bg-[var(--bg-fill)] space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-[var(--text-primary)]">Block Settings</h3>
                        <span className="text-[10px] font-bold text-[var(--text-secondary)] tabular-nums bg-[var(--bg-base)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                            {startTime} — {endTime}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">From</label>
                            <input
                                type="time"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="w-full bg-[var(--bg-base)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Until</label>
                            <input
                                type="time"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                className="w-full bg-[var(--bg-base)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Reason</label>
                        <input
                            type="text"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g. Private event, maintenance..."
                            className="w-full bg-[var(--bg-base)] border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] outline-none transition-all placeholder:text-[var(--text-quaternary)]"
                        />
                    </div>

                    {data?.state === 'BLOCKED' && (
                        <button
                            onClick={handleUnblock}
                            disabled={isPending}
                            className="text-[10px] font-bold text-rose-500 hover:text-rose-400 transition-colors"
                        >
                            Remove Block
                        </button>
                    )}
                </div>
            )}

            {/* Footer Actions */}
            <div className="p-4 border-t border-[var(--border-subtle)] flex flex-col gap-3">
                <SectionLabel>ACTIONS</SectionLabel>
                <div className="flex gap-2">
                {role === 'venue' ? (
                    <>
                        {isBlockingMode ? (
                            <>
                                <button
                                    onClick={() => setIsBlockingMode(false)}
                                    className="flex-1 py-3 border border-[var(--border-default)] text-[var(--text-tertiary)] rounded-xl font-bold text-[10px] uppercase tracking-wider hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAction}
                                    disabled={isPending}
                                    className="flex-[1.5] py-3 bg-[var(--text-primary)] text-white rounded-xl font-bold text-[10px] uppercase tracking-wider hover:opacity-90 transition-all shadow-sm"
                                >
                                    {isPending ? "Saving..." : "Confirm Block"}
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setIsBlockingMode(true)}
                                className="flex-1 py-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] rounded-xl font-bold text-[10px] uppercase tracking-wider hover:bg-[var(--bg-secondary)] transition-all flex items-center justify-center gap-2"
                            >
                                {data?.state === 'BLOCKED' ? <Settings className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                                {data?.state === 'BLOCKED' ? 'Edit Block' : 'Block Date'}
                            </button>
                        )}
                    </>
                ) : (
                    <Link
                        href="/host/events"
                        className="flex-1 py-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] rounded-xl font-bold text-[10px] uppercase tracking-wider hover:bg-[var(--bg-secondary)] transition-all text-center flex items-center justify-center"
                    >
                        Event Management
                    </Link>
                )}
                {!isBlockingMode && (
                    <button
                        onClick={onClose}
                        className="py-3 px-5 border border-[var(--border-subtle)] text-[var(--text-tertiary)] rounded-xl font-bold text-[10px] uppercase tracking-wider hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all"
                    >
                        Close
                    </button>
                )}
                </div>
            </div>
        </div>
    );
}
