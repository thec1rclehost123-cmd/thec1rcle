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
    Calendar as CalendarIcon
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { parseAsIST, toISODateIST } from "@c1rcle/core/time";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import Link from "next/link";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

// State configuration - Canonical colors only
const STATE_CONFIG = {
    CONFIRMED: {
        cellBg: "var(--state-confirmed-bg)",
        dot: "var(--state-confirmed)",
        label: "Confirmed",
        textColor: "var(--state-confirmed)"
    },
    BLOCKED: {
        cellBg: "var(--surface-secondary)",
        dot: "var(--text-tertiary)",
        label: "Blocked",
        textColor: "var(--text-secondary)"
    },
    PENDING: {
        cellBg: "var(--state-pending-bg)",
        dot: "var(--state-pending)",
        label: "Pending",
        textColor: "var(--state-pending)"
    },
    DRAFT: {
        cellBg: "var(--state-draft-bg)",
        dot: "var(--state-draft)",
        label: "Draft",
        textColor: "var(--state-draft)"
    },
    RISK: {
        cellBg: "var(--state-risk-bg)",
        dot: "var(--state-risk)",
        label: "At Risk",
        textColor: "var(--state-risk)"
    },
    OPEN: {
        cellBg: "var(--surface-elevated)",
        dot: "var(--border-strong)",
        label: "Open",
        textColor: "var(--text-tertiary)"
    }
};

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
                setCalendarData(data);
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
        const grid = [];
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
                // Success: refresh data
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

    // Calculate stats for header
    const stats = useMemo(() => {
        const confirmed = calendarData.filter(d => d.state === 'CONFIRMED').length;
        const pending = calendarData.filter(d => d.state === 'PENDING' || d.stats?.pendingSlots > 0).length;
        const open = calendarData.filter(d => d.state === 'OPEN').length;
        return { confirmed, pending, open };
    }, [calendarData]);

    return (
        <div className="flex flex-col w-full h-full min-h-[calc(100vh-56px)]">
            {/* Header */}
            <header className="px-8 py-6 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-elevated)]">
                <div className="flex items-center gap-8">
                    <div>
                        <h1 className="text-display-sm text-[var(--text-primary)]">
                            {role === 'venue' ? 'Venue Calendar' : 'Operating Calendar'}
                        </h1>
                        <p className="text-body-sm text-[var(--text-tertiary)] mt-0.5">
                            {MONTHS[month]} {year}
                        </p>
                    </div>

                    {/* Quick Stats */}
                    <div className="hidden md:flex items-center gap-6 pl-8 border-l border-[var(--border-default)]">
                        <div className="flex items-center gap-2">
                            <div className="status-dot status-dot-confirmed" />
                            <span className="text-caption text-[var(--text-secondary)]"><span className="font-semibold text-[var(--text-primary)]">{stats.confirmed}</span> confirmed</span>
                        </div>
                        {stats.pending > 0 && (
                            <div className="flex items-center gap-2">
                                <div className="status-dot status-dot-pending" />
                                <span className="text-caption text-[var(--text-secondary)]"><span className="font-semibold text-[var(--state-pending)]">{stats.pending}</span> pending</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <div className="status-dot" style={{ backgroundColor: 'var(--text-placeholder)' }} />
                            <span className="text-caption text-[var(--text-secondary)]"><span className="font-semibold text-[var(--text-primary)]">{stats.open}</span> open nights</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Month Navigation */}
                    <div className="flex items-center gap-1 bg-[var(--surface-secondary)] rounded-xl p-1">
                        <button
                            onClick={() => navigateMonth(-1)}
                            className="p-2 hover:bg-white rounded-lg transition-all"
                        >
                            <ChevronLeft className="h-4 w-4 text-[var(--text-secondary)]" />
                        </button>
                        <button
                            onClick={() => setCurrentDate(parseAsIST(null))}
                            className="px-4 py-1.5 text-[12px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white rounded-lg transition-all"
                        >
                            Today
                        </button>
                        <button
                            onClick={() => navigateMonth(1)}
                            className="p-2 hover:bg-white rounded-lg transition-all"
                        >
                            <ChevronRight className="h-4 w-4 text-[var(--text-secondary)]" />
                        </button>
                    </div>

                    {/* Create Event Button (Venue only) */}
                    {role === 'venue' && (
                        <Link
                            href="/venue/create"
                            className="btn btn-primary btn-sm"
                        >
                            <Plus className="h-4 w-4" />
                            Schedule Event
                        </Link>
                    )}
                </div>
            </header>

            {/* Calendar Grid */}
            <main className="flex-1 p-6 overflow-auto">
                <div className="calendar-grid bg-stone-100">
                    {/* Day Headers */}
                    {DAYS.map(d => (
                        <div key={d} className="calendar-day-label">
                            {d}
                        </div>
                    ))}

                    {/* Day Cells */}
                    {calendarGrid.map((cell, idx) => {
                        if (!cell) {
                            return <div key={`empty-${idx}`} className="bg-stone-50 aspect-[1.15/1]" />;
                        }

                        const config = STATE_CONFIG[cell.state as keyof typeof STATE_CONFIG] || STATE_CONFIG.OPEN;
                        const todayStr = toISODateIST(parseAsIST(null));
                        const isToday = cell.dateStr === todayStr;
                        const isSelected = cell.dateStr === selectedDateStr;
                        const isPast = cell.dateStr < todayStr;
                        const eventCount = cell.stats?.eventCount || 0;

                        return (
                            <button
                                key={cell.dateStr}
                                onClick={() => setSelectedDateStr(cell.dateStr)}
                                style={{ backgroundColor: config.cellBg }}
                                className={`calendar-cell ${isSelected ? 'calendar-cell-selected' : ''} ${isToday ? 'calendar-cell-today' : ''} border-[var(--border-subtle)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200`}
                            >
                                <span className={`text-[15px] font-semibold mb-2 ${isToday ? 'text-[var(--state-draft)]' : 'text-[var(--text-primary)]'}`}>
                                    {cell.day}
                                </span>

                                {/* Event indicators */}
                                {eventCount > 0 && (
                                    <div className="flex items-center gap-1.5 mt-1">
                                        {Array.from({ length: Math.min(eventCount, 3) }).map((_, i) => (
                                            <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.dot }} />
                                        ))}
                                        {eventCount > 3 && (
                                            <span className="text-[10px] font-bold" style={{ color: config.textColor }}>+{eventCount - 3}</span>
                                        )}
                                    </div>
                                )}

                                {/* Blocked indicator */}
                                {cell.state === 'BLOCKED' && (
                                    <Lock className="w-3.5 h-3.5 text-[var(--text-tertiary)] mt-1.5" />
                                )}

                                {/* Pending attention indicator */}
                                {(cell.stats?.pendingSlots > 0) && (
                                    <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[var(--state-pending)] animate-pulse" />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-6 mt-4 px-2">
                    {Object.entries(STATE_CONFIG).slice(0, 4).map(([key, config]) => (
                        <div key={key} className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${config.dot}`} />
                            <span className="text-[11px] text-stone-500">{config.label}</span>
                        </div>
                    ))}
                </div>
            </main>

            {/* Side Panel */}
            <AnimatePresence>
                {selectedDateStr && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            onClick={() => setSelectedDateStr(null)}
                            className="fixed inset-0 bg-stone-900/10 z-50"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'tween', duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                            className="fixed top-0 right-0 bottom-0 w-full md:w-[440px] panel z-[60] flex flex-col"
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
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

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

    // Sync with data changes (e.g. after a refresh)
    useEffect(() => {
        if (!isBlockingMode) {
            setReason(data?.block?.reason || "Private Event / Maintenance");
            setStartTime(data?.block?.startTime || "20:00");
            setEndTime(data?.block?.endTime || "04:00");
        }
    }, [data, isBlockingMode]);

    // Dragging state
    const timelineRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const d = parseAsIST(dateStr);
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' });
    const formattedDate = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' });

    const handleAction = async () => {
        if (isPending) return;
        setIsPending(true);
        try {
            const action = data?.state === 'BLOCKED' ? 'unblock' : 'block';
            await onBlockDate(dateStr, action, reason, startTime, endTime);
            setIsBlockingMode(false);
        } finally {
            setIsPending(false);
        }
    };

    const getTimeFromY = (y: number) => {
        if (!timelineRef.current) return "16:00";
        const rect = timelineRef.current.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (y - rect.top) / rect.height));
        const totalMinutes = percent * 12 * 60; // 12 hours from 4 PM
        const startMinutes = 16 * 60;
        let finalMinutes = (startMinutes + totalMinutes) % (24 * 60);

        const h = Math.floor(finalMinutes / 60);
        const m = Math.floor((finalMinutes % 60) / 15) * 15; // Snap to 15 mins
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isBlockingMode || role !== 'venue') return;
        setIsDragging(true);
        const time = getTimeFromY(e.clientY);
        setStartTime(time);
        setEndTime(time);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        const time = getTimeFromY(e.clientY);
        setEndTime(time);
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Timeline logic: 4 PM to 4 AM (12 hours)
    const hours = Array.from({ length: 13 }, (_, i) => {
        const h = (16 + i) % 24;
        const label = h === 0 ? "12 AM" : (h > 12 ? `${h - 12} PM` : (h === 12 ? "12 PM" : `${h} AM`));
        return { h, label };
    });

    const getTop = (startTime: string) => {
        if (!startTime) return 0;
        const [h, m] = startTime.split(':').map(Number);
        let diff = h - 16;
        if (diff < 0) diff += 24;
        return (diff + m / 60) / 12 * 100;
    };

    const getHeight = (startTime: string, endTime: string) => {
        if (!startTime || !endTime) return 10;
        const [sh, sm] = startTime.split(':').map(Number);
        const [eh, em] = endTime.split(':').map(Number);

        let sTotal = sh * 60 + sm;
        let eTotal = eh * 60 + em;

        if (eTotal < sTotal) eTotal += 24 * 60;

        const durationMin = Math.max(0, eTotal - sTotal);
        return (durationMin / 60) / 12 * 100;
    };

    const needsAttention = data?.state === 'PENDING' || data?.stats?.pendingSlots > 0;

    return (
        <div className="h-full flex flex-col bg-[var(--surface-elevated)] select-none">
            {/* Header */}
            <div className="px-8 py-6 border-b border-[var(--border-subtle)] flex items-start justify-between">
                <div>
                    <h2 className="text-headline-sm text-[var(--text-primary)]">{dayName}</h2>
                    <p className="text-body-sm text-[var(--text-tertiary)] mt-0.5">{formattedDate}</p>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-[var(--surface-secondary)] rounded-xl transition-all"
                >
                    <X className="h-5 w-5 text-[var(--text-tertiary)]" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar scrollbar-hide">
                {/* Timeline Section */}
                <div className="p-8">
                    <div className="flex items-center justify-between mb-6">
                        <p className="text-label">Timeline — 4 PM to 4 AM</p>
                        {isBlockingMode && (
                            <span className="text-[11px] font-bold text-[var(--text-primary)] animate-pulse">DRAG TO SELECT RANGE</span>
                        )}
                    </div>
                    <div className="relative min-h-[600px] flex">
                        {/* Time Labels */}
                        <div className="w-16 flex flex-col justify-between pr-4 py-0">
                            {hours.map((h, i) => (
                                <span key={i} className="text-[10px] font-bold text-[var(--text-placeholder)] uppercase tracking-wider h-0 flex items-center justify-end">{h.label}</span>
                            ))}
                        </div>

                        {/* Timeline Grid */}
                        <div
                            ref={timelineRef}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            className={`flex-1 relative border-l border-[var(--border-default)] ${isBlockingMode ? 'cursor-crosshair bg-[var(--text-primary)]/[0.02]' : ''}`}
                        >
                            {/* Hour lines */}
                            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                                {hours.map((_, i) => (
                                    <div key={i} className="border-t border-[var(--border-subtle)] w-full h-0" />
                                ))}
                            </div>

                            {/* Event Blocks */}
                            <div className="absolute inset-x-0 h-full pl-4 pointer-events-none">
                                {data?.events?.map((e: any) => {
                                    const isConfirmed = ['published', 'scheduled', 'live', 'confirmed', 'approved'].includes(e.lifecycle || e.status);
                                    const isAnonymized = role === 'host' && e.isAnonymized;

                                    return (
                                        <Link
                                            key={e.id}
                                            href={isAnonymized ? '#' : (role === 'venue' ? `/venue/events/${e.id}` : `/host/events/${e.id}`)}
                                            style={{
                                                top: `${getTop(e.startTime)}%`,
                                                height: `${getHeight(e.startTime, e.endTime)}%`,
                                                minHeight: '48px'
                                            }}
                                            className={`absolute inset-x-0 mr-4 rounded-xl p-4 flex flex-col shadow-sm border transition-all hover:scale-[1.01] ${isAnonymized
                                                ? 'bg-[var(--surface-secondary)] border-[var(--border-strong)] text-[var(--text-tertiary)] cursor-default'
                                                : isConfirmed
                                                    ? 'bg-[var(--state-confirmed)] text-white border-[var(--state-confirmed)]'
                                                    : 'bg-[var(--surface-elevated)] border-[var(--border-strong)] text-[var(--text-primary)]'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{e.startTime} – {e.endTime}</span>
                                                {isConfirmed && !isAnonymized && <CheckCircle2 className="h-3.5 w-3.5 opacity-90" />}
                                                {isAnonymized && <Lock className="h-3.5 w-3.5 opacity-60" />}
                                            </div>
                                            <h3 className="text-[14px] font-bold truncate leading-tight">
                                                {isAnonymized ? 'Unavailable' : e.title}
                                            </h3>
                                            {!isAnonymized && (
                                                <div className="flex items-center gap-1.5 mt-auto opacity-80">
                                                    <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                                                        <User className="h-2.5 w-2.5" />
                                                    </div>
                                                    <span className="text-[11px] font-medium truncate">{e.host || 'Direct Production'}</span>
                                                </div>
                                            )}
                                        </Link>
                                    );
                                })}

                                {/* Pending Slots */}
                                {data?.slots?.map((s: any) => (
                                    <div
                                        key={s.id}
                                        style={{
                                            top: `${getTop(s.startTime)}%`,
                                            height: `${getHeight(s.startTime, s.endTime)}%`,
                                            minHeight: '48px'
                                        }}
                                        className="absolute inset-x-0 mr-4 rounded-xl p-4 border-2 border-dashed border-[var(--state-pending)] bg-[var(--state-pending-bg)] flex flex-col transition-all hover:scale-[1.01]"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--state-pending)]">{s.startTime} – {s.endTime}</span>
                                            <span className="badge badge-pending">Pitch</span>
                                        </div>
                                        <h3 className="text-[14px] font-bold text-[var(--text-primary)] truncate">{s.host}</h3>
                                        <p className="text-[11px] text-[var(--state-pending)] font-medium mt-auto">Action required</p>
                                    </div>
                                ))}

                                {/* Blocked Overlay */}
                                {(data?.block || isDragging || (isBlockingMode && startTime && endTime)) && (
                                    <div
                                        style={{
                                            top: `${getTop(isBlockingMode ? startTime : data?.block?.startTime || "16:00")}%`,
                                            height: `${getHeight(isBlockingMode ? startTime : data?.block?.startTime || "16:00", isBlockingMode ? endTime : data?.block?.endTime || "04:00")}%`,
                                        }}
                                        className={`absolute inset-x-0 mr-4 rounded-xl border-2 border-dashed flex items-center justify-center backdrop-blur-[2px] z-10 transition-all ${isBlockingMode ? 'bg-[var(--text-primary)]/10 border-[var(--text-primary)]' : 'bg-[var(--surface-secondary)]/50 border-[var(--border-strong)]'}`}
                                    >
                                        <div className="text-center p-6 bg-[var(--surface-elevated)] rounded-2xl shadow-sm border border-[var(--border-subtle)]">
                                            <Lock className={`h-6 w-6 mx-auto mb-3 ${isBlockingMode ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`} />
                                            <h4 className="text-[13px] font-bold text-[var(--text-primary)] mb-1">
                                                {isBlockingMode ? 'New Block' : (role === 'venue' ? 'Manual Block' : 'Venue Blocked')}
                                            </h4>
                                            {role === 'venue' && !isBlockingMode && (
                                                <span className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">{data.block?.reason || 'Manual Lock'}</span>
                                            )}
                                            {isBlockingMode && (
                                                <span className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider">{startTime} – {endTime}</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Actions Section (Pitches) */}
                    {!isBlockingMode && needsAttention && (
                        <div className="px-8 pb-8 space-y-4">
                            <p className="text-label">Review Pitches</p>
                            {data?.slots?.filter((s: any) => s.status === 'pending').map((s: any) => (
                                <div key={s.id} className="card-elevated p-5 border-[var(--state-pending)] bg-[var(--state-pending-bg)]/30">
                                    <div className="flex items-start gap-4 mb-5">
                                        <div className="w-10 h-10 rounded-xl bg-[var(--state-pending-bg)] flex items-center justify-center border border-[var(--state-pending)]/20">
                                            <CalendarIcon className="h-5 w-5 text-[var(--state-pending)]" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-[15px] font-bold text-[var(--text-primary)] leading-tight">{s.host} pitch</h4>
                                            <p className="text-body-sm text-[var(--text-secondary)] mt-1">{s.startTime} – {s.endTime}</p>
                                        </div>
                                    </div>
                                    {role === 'venue' && (
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => onSlotAction(s.id, 'approve')}
                                                className="btn btn-confirm btn-sm flex-1 font-bold"
                                            >
                                                Confirm
                                            </button>
                                            <button
                                                onClick={() => onSlotAction(s.id, 'reject')}
                                                className="btn btn-secondary btn-sm flex-1 font-bold"
                                            >
                                                Decline
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {data?.stats?.hasRisk && (
                                <div className="card-elevated p-5 border-[var(--state-risk)] bg-[var(--state-risk-bg)]">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                                            <AlertCircle className="h-5 w-5 text-[var(--state-risk)]" />
                                        </div>
                                        <div>
                                            <h4 className="text-[15px] font-bold text-[var(--text-primary)] leading-tight">Operating Risk</h4>
                                            <p className="text-body-sm text-[var(--text-secondary)] mt-1">Confirmed event has zero issued tickets. Performance at risk.</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Block Details Panel (Venue only) - Fixed above footer */}
            {role === 'venue' && isBlockingMode && (
                <div className="px-8 py-6 border-t border-[var(--border-subtle)] bg-[var(--surface-secondary)]/30 space-y-4 animate-in slide-in-from-bottom-4 duration-300">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[12px] uppercase tracking-widest text-[var(--text-primary)] font-bold">Block Details</h3>
                        <span className="text-[11px] font-bold text-[var(--text-primary)] px-2 py-1 bg-[var(--text-primary)]/10 rounded-lg">
                            {startTime} – {endTime}
                        </span>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-12 gap-4">
                            <div className="col-span-8">
                                <label className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase block mb-1.5 ml-1">Reason</label>
                                <input
                                    type="text"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="e.g. Private Event..."
                                    className="w-full bg-[var(--surface-elevated)] border border-[var(--border-default)] rounded-xl px-4 py-2 text-sm focus:border-[var(--text-primary)] outline-none transition-all"
                                />
                            </div>
                            <div className="col-span-4">
                                <label className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase block mb-1.5 ml-1">Timeline</label>
                                <div className="flex items-center gap-1">
                                    <input
                                        type="text"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="w-full bg-[var(--surface-elevated)] border border-[var(--border-default)] rounded-lg px-2 py-2 text-[12px] text-center outline-none"
                                    />
                                    <span className="text-[var(--text-tertiary)] text-[10px]">to</span>
                                    <input
                                        type="text"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        className="w-full bg-[var(--surface-elevated)] border border-[var(--border-default)] rounded-lg px-2 py-2 text-[12px] text-center outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {data?.state === 'BLOCKED' && (
                            <button
                                onClick={() => onBlockDate(dateStr, 'unblock')}
                                disabled={isPending}
                                className="text-[11px] font-bold text-red-500 hover:text-red-600 transition-colors"
                            >
                                — Remove existing block
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Footer Actions */}
            <div className="p-6 border-t border-[var(--border-subtle)] bg-[var(--surface-elevated)] flex gap-4">
                {role === 'venue' ? (
                    <>
                        {isBlockingMode ? (
                            <>
                                <button
                                    onClick={() => setIsBlockingMode(false)}
                                    className="btn btn-secondary flex-1 font-bold"
                                >
                                    Exit Blocking
                                </button>
                                <button
                                    onClick={handleAction}
                                    disabled={isPending}
                                    className="btn btn-primary flex-[1.5] font-bold bg-stone-900 text-white"
                                >
                                    {isPending ? "Processing..." : "Confirm Block"}
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setIsBlockingMode(true)}
                                className="btn btn-confirm flex-1 font-bold bg-emerald-50 text-emerald-700 border-emerald-200"
                            >
                                <Lock className="h-4 w-4 mr-2" />
                                Block Time
                            </button>
                        )}
                    </>
                ) : (
                    <Link
                        href="/host/events"
                        className="btn btn-secondary flex-1 text-center font-bold"
                    >
                        Management view
                    </Link>
                )}
                {!isBlockingMode && (
                    <button
                        onClick={onClose}
                        className="btn btn-primary flex-1 font-bold"
                    >
                        Close
                    </button>
                )}
            </div>
        </div>
    );
}
