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
            {/* Operational Header */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-5">
                    <div className="flex items-center gap-1.5 bg-surface-secondary border border-border-subtle rounded-2xl p-1.5 shadow-sm">
                        <button
                            onClick={() => navigateMonth(-1)}
                            className="p-2 hover:bg-surface-elevated rounded-xl transition-all text-text-tertiary hover:text-text-primary"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <div className="px-5 text-center min-w-[150px]">
                            <h2 className="text-sm font-black text-text-primary tracking-tight uppercase">
                                {MONTHS[month]} {year}
                            </h2>
                        </div>
                        <button
                            onClick={() => navigateMonth(1)}
                            className="p-2 hover:bg-surface-elevated rounded-xl transition-all text-text-tertiary hover:text-text-primary"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="hidden lg:flex items-center gap-3 border-l border-border-subtle pl-6 ml-1">
                        <StatBadge count={stats.confirmed} label="Booked" color="emerald" />
                        <StatBadge count={stats.pending} label="Requests" color="amber" />
                        <StatBadge count={stats.open} label="Open" color="gray" />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            const now = parseAsIST(null);
                            setCurrentDate(now);
                            setSelectedDateStr(toISODateIST(now));
                        }}
                        className="px-4 py-2.5 text-[10px] font-black text-text-tertiary hover:text-text-primary uppercase tracking-widest transition-all rounded-xl border border-border-subtle hover:bg-surface-secondary"
                    >
                        Sync Today
                    </button>

                    {role === 'venue' && (
                        <Link
                            href="/venue/create"
                            className="bg-text-primary text-text-inverse px-6 py-2.5 rounded-2xl flex items-center gap-2 hover:opacity-90 transition-all font-black text-[11px] uppercase tracking-widest shadow-lg"
                        >
                            <Plus className="h-4 w-4" />
                            Launch Event
                        </Link>
                    )}
                </div>
            </div>

            {/* Unified Calendar Block */}
            <div className="overflow-x-auto scrollbar-hide -mx-1">
            <div className="flex flex-col lg:flex-row bg-surface-base border border-border-strong rounded-[2.5rem] overflow-hidden shadow-2xl flex-1 min-h-0 min-w-[360px]">
                
                {/* Calendar Side */}
                <div className="lg:flex-[2.2] flex flex-col border-b lg:border-b-0 lg:border-r border-border-subtle">
                    <div className="grid grid-cols-7 border-b border-border-subtle bg-surface-secondary/40">
                        {DAYS.map(d => (
                            <div key={d} className="py-4 text-center text-[10px] font-black text-text-tertiary uppercase tracking-[0.2em]">
                                {d}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 flex-1">
                        {calendarGrid.map((cell, idx) => {
                            if (!cell) {
                                return <div key={`empty-${idx}`} className="aspect-[1.2/1] bg-surface-secondary/10 border-r border-b border-border-subtle last:border-r-0" />;
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
                                        relative aspect-[1.15/1] p-3 text-left border-r border-b border-border-subtle transition-all group overflow-hidden last:border-r-0
                                        ${isSelected ? 'bg-iris/5' : isBlocked ? 'bg-surface-secondary/20' : 'hover:bg-surface-secondary/40'}
                                        ${isPast && !isSelected ? 'opacity-40 grayscale-[0.8]' : ''}
                                    `}
                                >
                                    {isSelected && <div className="absolute inset-x-0 top-0 h-1 bg-iris shadow-[0_4px_12px_rgba(var(--iris-rgb),0.4)] z-20" />}
                                    
                                    <div className="flex items-center justify-between relative z-10 mb-2">
                                        <span className={`text-[13px] font-black tabular-nums transition-colors ${isToday ? 'text-iris flex items-center gap-1.5' : isSelected ? 'text-text-primary' : 'text-text-secondary group-hover:text-text-primary'}`}>
                                            {cell.day}
                                            {isToday && <span className="w-1.5 h-1.5 rounded-full bg-iris shadow-[0_0_8px_rgba(var(--iris-rgb),0.8)]" />}
                                        </span>
                                        {hasPending && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.6)] animate-pulse" />}
                                    </div>

                                    {(eventCount > 0 || isBlocked) && (
                                        <div className="space-y-1 relative z-10">
                                            {cell.events.slice(0, 3).map((e: any) => (
                                                <div key={e.id} className={`h-1 rounded-full w-full ${[EVENT_LIFECYCLE.SCHEDULED, EVENT_LIFECYCLE.LIVE, EVENT_LIFECYCLE.APPROVED].includes(e.lifecycle || e.status) ? 'bg-emerald-500/80' : 'bg-amber-500/80'}`} />
                                            ))}
                                            {isBlocked && (
                                                <div className="h-1 rounded-full w-full bg-red-500/60 border border-red-500/20" />
                                            )}
                                            <p className="text-[7px] font-black text-text-tertiary uppercase tracking-widest mt-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                {isBlocked ? 'Date Blocked' : `${eventCount} Active Slot${eventCount !== 1 ? 's' : ''}`}
                                            </p>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="p-5 flex items-center gap-8 border-t border-border-subtle bg-surface-secondary/20">
                        <LegendItem color="bg-emerald-500" label="Confirmed" />
                        <LegendItem color="bg-amber-500" label="Request" />
                        <LegendItem color="bg-surface-elevated" label="Blocked" icon={<Lock className="h-2.5 w-2.5 text-text-quaternary" />} />
                    </div>
                </div>

                {/* Inspection Side (Adjacent) */}
                <div className="lg:flex-[1] bg-surface-secondary/15 flex flex-col overflow-hidden">
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
                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                                <div className="w-16 h-16 rounded-[2rem] bg-surface-base border border-border-subtle flex items-center justify-center mb-6 shadow-xl text-text-tertiary hover:scale-110 transition-transform">
                                    <CalendarIcon className="w-6 h-6" />
                                </div>
                                <h3 className="text-sm font-black text-text-primary tracking-tighter uppercase mb-2">Operational Deck</h3>
                                <p className="text-[10px] text-text-tertiary font-medium max-w-[200px] leading-relaxed">
                                    Select any date on the grid to manage night availability and review incoming host requests.
                                </p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
            </div>
        </div>
    );
}

/* ---------- Stat Badge ---------- */
function StatBadge({ count, label, color }: { count: number; label: string; color: string }) {
    const colorMap: Record<string, string> = {
        emerald: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/15',
        amber: 'bg-amber-500/10 text-amber-600 border-amber-500/15',
        gray: 'bg-surface-elevated text-text-tertiary border-border-subtle',
        rose: 'bg-rose-500/10 text-rose-600 border-rose-500/15',
    };
    return (
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${colorMap[color] || colorMap.gray}`}>
            <span className="tabular-nums">{count}</span>
            <span className="uppercase tracking-wider opacity-80">{label}</span>
        </div>
    );
}

/* ---------- Legend Item ---------- */
function LegendItem({ color, label, icon }: { color: string; label: string; icon?: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2">
            {icon || <span className={`w-2 h-2 rounded-full ${color}`} />}
            <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider">{label}</span>
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
                <div className="w-2 h-2 rounded-full bg-iris shadow-[0_0_8px_rgba(var(--iris-rgb),0.8)] -ml-1 flex-shrink-0 animate-pulse" />
                <div className="flex-1 h-[2px] bg-iris shadow-[0_0_8px_rgba(var(--iris-rgb),0.4)]" />
                <div className="bg-iris text-white text-[8px] font-black px-2 py-0.5 rounded-full ml-3 uppercase tracking-tighter shadow-xl">
                    Now
                </div>
            </div>
        );
    }, [isActive, timeStr]);

    return (
        <div className="h-full flex flex-col">
            {/* Panel Header */}
            <div className="px-6 py-5 border-b border-border-subtle flex items-center justify-between bg-surface-base/50 backdrop-blur-sm sticky top-0 z-40">
                <div>
                    <h2 className="text-base font-black text-text-primary tracking-tight leading-none">{dayName}</h2>
                    <p className="text-[11px] font-medium text-text-tertiary mt-1">{monthDay}</p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Status chip */}
                    {isBlocked ? (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 text-red-600 text-[9px] font-black uppercase tracking-wider border border-red-500/10">
                            <Lock className="h-3 w-3" /> Blocked
                        </span>
                    ) : eventCount > 0 ? (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 text-[9px] font-black uppercase tracking-wider border border-emerald-500/10">
                            <Music className="h-3 w-3" /> {eventCount} Event{eventCount > 1 ? 's' : ''}
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-elevated text-text-tertiary text-[9px] font-black uppercase tracking-wider border border-border-subtle">
                            Open Night
                        </span>
                    )}
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-surface-elevated rounded-xl text-text-tertiary hover:text-text-primary transition-all"
                    >
                        <X className="h-4.5 w-4.5" />
                    </button>
                </div>
            </div>

            {/* Content: Hourly Timeline (Google Calendar style) */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-surface-base/30">
                <div className="relative flex h-full min-h-0 px-6 py-4">
                    {/* Time Labels */}
                    <div className="w-14 flex flex-col justify-between text-[10px] font-black text-text-tertiary uppercase border-r border-border-subtle/30 mr-4 py-1">
                        {HOURS.map(h => (
                            <div key={h} className="h-0 flex items-center justify-end pr-3">{h}</div>
                        ))}
                    </div>
 
                    {/* Grid Lines */}
                    <div className="absolute inset-y-6 left-[80px] right-6 pointer-events-none">
                        {HOURS.map((_, i) => (
                            <div key={i} className="h-0 border-t border-border-subtle/20" style={{ top: `${(i / (HOURS.length - 1)) * 100}%` }} />
                        ))}
                    </div>
 
                    {/* Action Layers */}
                    <div className="flex-1 relative mx-2">
                        {/* 0. Now Indicator */}
                        {nowIndicator}

                        {/* 1. Blocked Interval (if any) */}
                        {isBlocked && (
                            <div 
                                className="absolute left-0 right-0 bg-red-500/5 border border-red-500/20 rounded-[1.5rem] flex flex-col items-center justify-center overflow-hidden z-10 shadow-inner"
                                style={getPosition(data.block?.startTime || "20:00", data.block?.endTime || "04:00")}
                            >
                                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #ef4444, #ef4444 12px, transparent 12px, transparent 24px)' }} />
                                <div className="bg-red-500/10 p-3 rounded-full mb-2">
                                    <Lock className="w-5 h-5 text-red-500 opacity-60" />
                                </div>
                                <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">{data.block?.reason || 'BLOCKED'}</span>
                            </div>
                        )}
 
                        {/* 2. Events */}
                        {events.map((e: any) => {
                            const status = e.lifecycle || e.status;
                            const isConfirmed = [EVENT_LIFECYCLE.SCHEDULED, EVENT_LIFECYCLE.LIVE, EVENT_LIFECYCLE.APPROVED].includes(status);
                            const pos = getPosition(e.startTime || "21:00", e.endTime || "04:00");
                            
                            // Check if event is live
                            const isCurrentlyLive = useMemo(() => {
                                if (!isActive || !isConfirmed) return false;
                                const startMin = timeToMinutes(e.startTime || "21:00");
                                const endMin = timeToMinutes(e.endTime || "04:00");
                                const currentMin = timeToMinutes(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
                                return currentMin >= startMin && currentMin <= endMin;
                            }, [now, e.startTime, e.endTime, isActive, isConfirmed]);

                            return (
                                <Link
                                    key={e.id}
                                    href={role === 'venue' ? `/venue/events/${e.id}` : `/host/events/${e.id}`}
                                    className={`absolute left-0 right-0 p-4 rounded-2xl border transition-all hover:scale-[1.03] hover:shadow-2xl z-20 group overflow-hidden ${
                                        isCurrentlyLive 
                                            ? 'bg-emerald-500/15 border-emerald-500/40 shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-500/20'
                                            : isConfirmed 
                                                ? 'bg-emerald-500/5 border-emerald-500/20 shadow-md' 
                                                : 'bg-amber-500/5 border-amber-500/20 shadow-md'
                                    }`}
                                    style={pos}
                                >
                                    <div className="flex items-start justify-between gap-3 h-full">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <h4 className="text-[13px] font-black text-text-primary tracking-tight leading-tight truncate uppercase">
                                                    {e.title || 'Reserved'}
                                                </h4>
                                                {isCurrentlyLive && (
                                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[8px] font-black uppercase tracking-tighter animate-pulse flex-shrink-0 shadow-lg">
                                                        <span className="w-1 h-1 rounded-full bg-white" />
                                                        Live
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] font-black tabular-nums text-text-tertiary uppercase tracking-tight">
                                                <Clock className="w-3 h-3 text-iris" />
                                                {e.startTime} <span className="opacity-30">—</span> {e.endTime}
                                            </div>
                                        </div>
                                        {e.posterUrl && (
                                            <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-border-subtle group-hover:scale-110 transition-transform shadow-sm">
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

            {/* Pending Slot Requests */}
            {pendingSlots.length > 0 && (
                <div className="flex-shrink-0 p-4 space-y-2 border-t border-border-subtle bg-surface-base">
                    <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest mb-2 px-1 flex items-center gap-1.5">
                        <AlertCircle className="h-3 w-3" />
                        Needs Your Approval ({pendingSlots.length})
                    </p>
                    {pendingSlots.map((s: any) => (
                        <div key={s.id} className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                    <CalendarIcon className="h-4 w-4 text-amber-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-xs font-bold text-text-primary">{s.host} Request</h4>
                                    <p className="text-[10px] text-text-tertiary tabular-nums">{s.startTime} — {s.endTime}</p>
                                </div>
                            </div>
                            {role === 'venue' && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onSlotAction(s.id, 'approve')}
                                        className="flex-1 py-2 bg-text-primary text-text-inverse rounded-lg font-bold text-[10px] uppercase tracking-wider hover:opacity-90 transition-all"
                                    >
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => onSlotAction(s.id, 'reject')}
                                        className="px-4 py-2 border border-border-default text-text-tertiary rounded-lg font-bold text-[10px] uppercase tracking-wider hover:text-text-primary hover:bg-surface-elevated transition-all"
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
                <div className="flex-shrink-0 flex flex-col items-center justify-center p-6 text-center bg-surface-base border-t border-border-subtle">
                    <div className="w-10 h-10 rounded-xl bg-surface-elevated border border-border-subtle flex items-center justify-center mb-3">
                        {isBlocked ? <Lock className="w-4 h-4 text-text-quaternary" /> : <Sparkles className="w-4 h-4 text-text-quaternary" />}
                    </div>
                    <p className="text-xs font-bold text-text-secondary mb-0.5">
                        {isBlocked ? 'Date Blocked' : 'Night is Open'}
                    </p>
                    <p className="text-[10px] text-text-tertiary max-w-[180px]">
                        {isBlocked
                            ? (data.block?.reason || 'This date is blocked for maintenance or private events.')
                            : 'This date is available for bookings. Create an event or block it off.'}
                    </p>
                    {isBlocked && data.block?.startTime && (
                        <p className="text-[10px] text-text-tertiary tabular-nums mt-2 font-bold opacity-60">
                            {data.block?.startTime} — {data.block?.endTime}
                        </p>
                    )}
                </div>
            )}
            </div>

            {/* Block Settings Panel */}
            {role === 'venue' && isBlockingMode && (
                <div className="px-5 py-5 border-t border-border-subtle bg-surface-secondary space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-text-primary">Block Settings</h3>
                        <span className="text-[10px] font-bold text-text-secondary tabular-nums bg-surface-base px-2 py-0.5 rounded border border-border-subtle">
                            {startTime} — {endTime}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider">From</label>
                            <input
                                type="time"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="w-full bg-surface-base border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:border-iris outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider">Until</label>
                            <input
                                type="time"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                className="w-full bg-surface-base border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:border-iris outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider">Reason</label>
                        <input
                            type="text"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g. Private event, maintenance..."
                            className="w-full bg-surface-base border border-border-default rounded-lg px-3 py-2.5 text-xs text-text-primary focus:border-iris outline-none transition-all placeholder:text-text-quaternary"
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
            <div className="p-4 border-t border-border-subtle flex gap-3">
                {role === 'venue' ? (
                    <>
                        {isBlockingMode ? (
                            <>
                                <button
                                    onClick={() => setIsBlockingMode(false)}
                                    className="flex-1 py-3 border border-border-default text-text-tertiary rounded-xl font-bold text-[10px] uppercase tracking-wider hover:text-text-primary hover:bg-surface-elevated transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAction}
                                    disabled={isPending}
                                    className="flex-[1.5] py-3 bg-text-primary text-text-inverse rounded-xl font-bold text-[10px] uppercase tracking-wider hover:opacity-90 transition-all shadow-sm"
                                >
                                    {isPending ? "Saving..." : "Confirm Block"}
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setIsBlockingMode(true)}
                                className="flex-1 py-3 bg-surface-elevated border border-border-subtle text-text-secondary rounded-xl font-bold text-[10px] uppercase tracking-wider hover:bg-surface-tertiary transition-all flex items-center justify-center gap-2"
                            >
                                {data?.state === 'BLOCKED' ? <Settings className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                                {data?.state === 'BLOCKED' ? 'Edit Block' : 'Block Date'}
                            </button>
                        )}
                    </>
                ) : (
                    <Link
                        href="/host/events"
                        className="flex-1 py-3 bg-surface-elevated border border-border-subtle text-text-secondary rounded-xl font-bold text-[10px] uppercase tracking-wider hover:bg-surface-tertiary transition-all text-center flex items-center justify-center"
                    >
                        Event Management
                    </Link>
                )}
                {!isBlockingMode && (
                    <button
                        onClick={onClose}
                        className="py-3 px-5 border border-border-subtle text-text-tertiary rounded-xl font-bold text-[10px] uppercase tracking-wider hover:text-text-primary hover:bg-surface-elevated transition-all"
                    >
                        Close
                    </button>
                )}
            </div>
        </div>
    );
}
