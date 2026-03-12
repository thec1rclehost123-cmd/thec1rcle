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
    Calendar as CalendarIcon
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

// State configuration - Canonical colors only
const STATE_CONFIG = {
    CONFIRMED: {
        dot: "bg-green-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]",
        label: "Confirmed",
        textColor: "text-emerald-600"
    },
    BLOCKED: {
        dot: "bg-gray-200",
        label: "Blocked",
        textColor: "text-gray-400"
    },
    PENDING: {
        dot: "bg-iris shadow-[0_0_5px_rgba(244,74,34,0.5)]",
        label: "Needs Attention",
        textColor: "text-iris"
    },
    DRAFT: {
        dot: "bg-gray-300",
        label: "Internal Draft",
        textColor: "text-gray-500"
    },
    RISK: {
        dot: "bg-rose-500 shadow-[0_0_5px_rgba(244,63,94,0.5)]",
        label: "Operating Risk",
        textColor: "text-rose-600"
    },
    OPEN: {
        dot: "bg-gray-100",
        label: "Open Window",
        textColor: "text-gray-300"
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
        <div className="flex flex-col w-full min-h-[calc(100vh-56px)] pb-4">
            {/* Main Application Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start px-0">

                {/* Left: Calendar Ledger (8 Cols) */}
                <div className="lg:col-span-8 space-y-4">
                    {/* Compact Sub-Header / Ledger Controls */}
                    <div className="flex flex-col md:flex-row items-center justify-between py-1 px-1">
                        <div className="flex items-center gap-6">
                            <div className="hidden sm:block">
                                <p className="text-[10px] font-black text-rose-500 uppercase tracking-[0.3em]">
                                    {MONTHS[month]} {year}
                                </p>
                            </div>

                            {/* Tighter Stats */}
                            <div className="hidden lg:flex items-center gap-6 pl-6 border-l border-[rgba(255,255,255,0.06)]">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_#10B981]" />
                                    <span className="text-xs font-bold text-text-primary tabular-nums">{stats.confirmed}</span>
                                    <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-normal">Confirmed</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_#F44A22]" />
                                    <span className="text-xs font-bold text-text-primary tabular-nums">{stats.pending}</span>
                                    <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-normal">Pending</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                                    <span className="text-xs font-bold text-text-primary tabular-nums">{stats.open}</span>
                                    <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-normal">Available</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Month Navigation */}
                            <div className="flex items-center gap-1 bg-surface-secondary border border-[rgba(255,255,255,0.08)] rounded-lg p-1">
                                <button
                                    onClick={() => navigateMonth(-1)}
                                    className="p-1.5 hover:bg-surface-elevated rounded transition-all text-text-tertiary hover:text-text-primary"
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                </button>
                                <button
                                    onClick={() => setCurrentDate(parseAsIST(null))}
                                    className="px-3 py-1 text-[9px] font-black text-text-tertiary hover:text-text-primary uppercase tracking-widest transition-all"
                                >
                                    SYNC TODAY
                                </button>
                                <button
                                    onClick={() => navigateMonth(1)}
                                    className="p-1.5 hover:bg-surface-elevated rounded transition-all text-text-tertiary hover:text-text-primary"
                                >
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                            </div>

                            {/* Create Event Button (Venue only) */}
                            {role === 'venue' && (
                                <Link
                                    href="/venue/create"
                                    className="bg-surface-elevated text-text-primary px-4 py-1.5 rounded-lg flex items-center justify-center gap-2 hover:bg-surface-elevated/90 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm border border-white/5"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Schedule
                                </Link>
                            )}
                        </div>
                    </div>
                    <div className="glass-panel overflow-hidden border border-border-strong shadow-sm rounded-[32px]">
                        <div className="grid grid-cols-7 border-b border-border-subtle bg-surface-secondary">
                            {DAYS.map(d => (
                                <div key={d} className="py-3 text-center text-[10px] font-black text-text-tertiary uppercase tracking-[0.2em]">
                                    {d}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7 bg-[#FFFFFF]">
                            {calendarGrid.map((cell, idx) => {
                                if (!cell) {
                                    return <div key={`empty-${idx}`} className="aspect-[1.3/1] bg-[#F9F9FB] border-r border-b border-[rgba(0,0,0,0.04)]" />;
                                }

                                const todayStr = toISODateIST(parseAsIST(null));
                                const isToday = cell.dateStr === todayStr;
                                const isSelected = cell.dateStr === selectedDateStr;
                                const eventCount = cell.stats?.eventCount || 0;

                                return (
                                    <button
                                        key={cell.dateStr}
                                        onClick={() => setSelectedDateStr(cell.dateStr)}
                                        className={`relative aspect-[1.4/1] p-2 text-left border-r border-b border-border-subtle transition-all group overflow-hidden ${isSelected ? 'bg-rose-500/10' : 'hover:bg-surface-secondary'}`}
                                    >
                                        <div className="flex items-center justify-between relative z-10">
                                            <span className={`text-[11px] font-bold tabular-nums ${isToday ? 'text-rose-500 animate-pulse' : 'text-text-tertiary group-hover:text-text-primary'}`}>
                                                {cell.day}
                                            </span>
                                            {isToday && <div className="w-1 h-1 rounded-full bg-iris shadow-[0_0_5px_#F44A22]" />}
                                        </div>

                                        {/* Event blocks in grid */}
                                        {eventCount > 0 && (
                                            <div className="mt-2 space-y-1 relative z-10">
                                                {cell.events.slice(0, 2).map((e: any) => {
                                                    const status = e.lifecycle || e.status;
                                                    const isConfirmed = [
                                                        EVENT_LIFECYCLE.SCHEDULED,
                                                        EVENT_LIFECYCLE.LIVE,
                                                        EVENT_LIFECYCLE.APPROVED
                                                    ].includes(status);
                                                    const isPending = status === EVENT_LIFECYCLE.SUBMITTED;

                                                    return (
                                                        <div
                                                            key={e.id}
                                                            className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tight truncate border ${isConfirmed
                                                                ? 'bg-green-500/10 border-emerald-500/20 text-emerald-600'
                                                                : isPending
                                                                    ? 'bg-orange-500/10 border-orange-500/20 text-orange-600'
                                                                    : 'bg-[#F2F2F7] border-[rgba(0,0,0,0.06)] text-[#86868B]'
                                                                }`}
                                                        >
                                                            {e.isAnonymized ? 'BOOKED' : (isPending ? `Pending: ${e.title}` : e.title)}
                                                        </div>
                                                    );
                                                })}
                                                {eventCount > 2 && (
                                                    <div className="text-[7px] font-black text-[#86868B] uppercase tracking-widest pl-1">
                                                        + {eventCount - 2} MORE
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Blocked Indicator */}
                                        {cell.state === 'BLOCKED' && eventCount === 0 && (
                                            <div className="mt-2 space-y-1 relative z-10">
                                                <div className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tight truncate border bg-gray-100 border-gray-200 text-gray-400 flex items-center justify-between">
                                                    <span>BLOCKED</span>
                                                    <Lock className="h-2 w-2 opacity-50" />
                                                </div>
                                            </div>
                                        )}

                                        {/* Status Indicators */}
                                        {(cell.stats?.pendingSlots > 0) && (
                                            <div className="absolute bottom-2 right-2 w-1 h-1 rounded-full bg-iris shadow-[0_0_5px_#F44A22] animate-pulse" />
                                        )}
                                        {cell.state === 'BLOCKED' && eventCount === 0 && (
                                            <div className="absolute inset-0 bg-gray-50/30 pointer-events-none" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-8 px-2">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_5px_#F44A22]" />
                            <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest">Pending Review</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_#10B981]" />
                            <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest">Confirmed Night</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                            <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest">Open Slot</span>
                        </div>
                    </div>
                </div>

                {/* Right: Inspection Panel (4 Cols) */}
                <div className="lg:col-span-4 lg:sticky lg:top-4 z-20 lg:-mt-28">
                    <div className="glass-panel min-h-[450px] flex flex-col overflow-hidden shadow-2xl">
                        {selectedDateStr ? (
                            <SidePanel
                                role={role}
                                dateStr={selectedDateStr}
                                data={selectedDay}
                                onClose={() => setSelectedDateStr(null)}
                                onSlotAction={handleSlotAction}
                                onBlockDate={handleBlockDate}
                            />
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-start p-6 text-center space-y-2 pt-24">
                                <div className="w-10 h-10 rounded-2xl bg-[#F2F2F7] border border-[rgba(0,0,0,0.06)] flex items-center justify-center mb-1">
                                    <CalendarIcon className="w-5 h-5 text-[#86868B]/20" />
                                </div>
                                <div>
                                    <h3 className="text-[10px] font-black text-[#1D1D1F] uppercase tracking-[0.2em]">System Idle</h3>
                                    <p className="text-[9px] font-bold text-[#86868B] uppercase tracking-widest mt-1">
                                        Select a date to view daily activity
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
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

    const timelineRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const d = parseAsIST(dateStr);
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' });
    const formattedDate = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' });

    const handleAction = async () => {
        if (isPending) return;
        setIsPending(true);
        try {
            // If we are in blocking mode, we are ALWAYS performing a 'block' action
            // regardless of the previous state (we might be overwriting or creating new)
            const action = 'block';
            await onBlockDate(dateStr, action, reason, startTime, endTime);
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

    const visualItems = useMemo(() => {
        const events = (data?.events || []).map((e: any) => ({ ...e, vType: 'event' }));
        const slots = (data?.slots || []).map((s: any) => ({ ...s, vType: 'slot' }));
        const combined = [...events, ...slots];

        const getMinutes = (timeStr: string) => {
            if (!timeStr) return 0;
            const [h, m] = timeStr.split(':').map(Number);
            let diff = h - 16;
            if (diff < 0) diff += 24;
            return diff * 60 + m;
        };

        const sorted = combined.map(item => ({
            ...item,
            startMin: getMinutes(item.startTime),
            endMin: getMinutes(item.endTime)
        })).sort((a, b) => a.startMin - b.startMin || (b.endMin - b.startMin) - (a.endMin - a.startMin));

        // Group into overlapping clusters to determine column widths
        const finalItems: any[] = [];
        let currentCluster: any[] = [];
        let clusterEnd = -1;

        const processCluster = (cluster: any[]) => {
            const columns: any[][] = [];
            cluster.forEach(item => {
                let colIdx = 0;
                while (columns[colIdx] && columns[colIdx].some(other => item.startMin < other.endMin && item.endMin > other.startMin)) {
                    colIdx++;
                }
                if (!columns[colIdx]) columns[colIdx] = [];
                columns[colIdx].push(item);
                item.colIdx = colIdx;
            });
            cluster.forEach(item => {
                item.totalCols = columns.length;
                finalItems.push(item);
            });
        };

        sorted.forEach(item => {
            if (item.startMin >= clusterEnd) {
                if (currentCluster.length > 0) processCluster(currentCluster);
                currentCluster = [item];
                clusterEnd = item.endMin;
            } else {
                currentCluster.push(item);
                clusterEnd = Math.max(clusterEnd, item.endMin);
            }
        });
        if (currentCluster.length > 0) processCluster(currentCluster);

        return finalItems;
    }, [data]);

    return (
        <div className="h-full flex flex-col bg-transparent select-none">
            {/* Header */}
            <div className="px-5 py-2.5 border-b border-border-subtle flex items-start justify-between bg-surface-secondary">
                <div>
                    <h2 className="text-base font-black text-text-primary uppercase tracking-tight leading-none">{dayName}</h2>
                    <p className="text-[8px] font-black text-text-tertiary uppercase tracking-widest mt-1 opacity-70">{formattedDate} — SYSTEM_READY</p>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 hover:bg-surface-tertiary rounded-lg text-text-tertiary hover:text-text-primary transition-all"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar scrollbar-hide">
                {/* Timeline Section */}
                <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-[8px] font-black text-text-tertiary uppercase tracking-[0.2em] opacity-50">Operational Timeline</p>
                        {isBlockingMode && (
                            <span className="text-[8px] font-black text-rose-500 animate-pulse uppercase tracking-widest">Awaiting Selection</span>
                        )}
                    </div>

                    <div className="relative min-h-[500px] flex">
                        {/* Time Labels */}
                        <div className="w-14 flex flex-col justify-between pr-3 py-0">
                            {hours.map((h, i) => (
                                <span key={i} className="text-[7px] font-black text-text-tertiary opacity-40 uppercase tracking-widest h-0 flex items-center justify-end tabular-nums">{h.label}</span>
                            ))}
                        </div>

                        {/* Timeline Grid */}
                        <div
                            ref={timelineRef}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            className={`flex-1 relative border-l border-[rgba(0,0,0,0.06)] ${isBlockingMode ? 'cursor-crosshair bg-black/[0.01]' : ''}`}
                        >
                            {/* Hour lines */}
                            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                                {hours.map((_, i) => (
                                    <div key={i} className="border-t border-[rgba(0,0,0,0.03)] w-full h-0" />
                                ))}
                            </div>

                            {/* Stacked Event & Slot Blocks */}
                            <div className="absolute inset-x-0 h-full pl-4 pointer-events-none">
                                {visualItems.map((item: any) => {
                                    const isEvent = item.vType === 'event';
                                    const top = getTop(item.startTime);
                                    const height = getHeight(item.startTime, item.endTime);
                                    const colIdx = item.colIdx || 0;
                                    const totalCols = item.totalCols || 1;

                                    // Improved Side-by-Side column layout
                                    const colWidth = 100 / totalCols;
                                    const colLeft = colIdx * colWidth;
                                    const zIndex = 10 + colIdx;

                                    if (isEvent) {
                                        const status = item.lifecycle || item.status;
                                        const isConfirmed = [
                                            EVENT_LIFECYCLE.SCHEDULED,
                                            EVENT_LIFECYCLE.LIVE,
                                            EVENT_LIFECYCLE.APPROVED
                                        ].includes(status);
                                        const isAnonymized = role === 'host' && item.isAnonymized;

                                        return (
                                            <Link
                                                key={item.id}
                                                href={isAnonymized ? '#' : (role === 'venue' ? `/venue/events/${item.id}` : `/host/events/${item.id}`)}
                                                style={{
                                                    top: `${top}%`,
                                                    height: `${height}%`,
                                                    minHeight: '60px',
                                                    left: `calc(${colLeft}% + 4px)`,
                                                    width: `calc(${colWidth}% - 8px)`,
                                                    zIndex: isAnonymized ? 5 : zIndex,
                                                    ...(item.posterUrl && !item.posterUrl.includes('placeholder.svg') && !isAnonymized ? {
                                                        backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.85)), url(${item.posterUrl})`,
                                                        backgroundSize: 'cover',
                                                        backgroundPosition: 'center'
                                                    } : {
                                                        background: isConfirmed
                                                            ? 'linear-gradient(135deg, #121214 0%, #064e3b 100%)'
                                                            : 'linear-gradient(135deg, #121214 0%, #17171a 100%)'
                                                    })
                                                }}
                                                className={`absolute rounded-xl p-3 flex flex-col border transition-all hover:scale-[1.05] hover:z-[100] active:scale-[0.98] shadow-2xl group overflow-hidden pointer-events-auto ${isAnonymized
                                                    ? 'bg-surface-secondary border-border-subtle text-text-tertiary'
                                                    : isConfirmed
                                                        ? (item.posterUrl && !item.posterUrl.includes('placeholder.svg') ? 'border-white/10 text-white shadow-[#10B981]/20' : 'border-emerald-500/20 text-white shadow-lg')
                                                        : (item.posterUrl && !item.posterUrl.includes('placeholder.svg') ? 'border-white/10 text-white' : 'border-border-subtle text-text-primary')
                                                    }`}
                                            >
                                                {/* Ambient Glow */}
                                                {isConfirmed && !item.posterUrl?.includes('placeholder.svg') && (
                                                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[60px] pointer-events-none" />
                                                )}

                                                <div className="flex flex-col h-full relative z-10 overflow-hidden">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex flex-col min-w-0">
                                                            <span className={`text-[9px] font-black uppercase tracking-[0.1em] tabular-nums truncate ${item.posterUrl && !item.posterUrl.includes('placeholder.svg') && !isAnonymized ? 'text-white/90' : 'text-text-tertiary'}`}>
                                                                {item.startTime}
                                                            </span>
                                                        </div>
                                                        {isConfirmed && !isAnonymized && totalCols < 3 && (
                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_#10B981]" />
                                                            </div>
                                                        )}
                                                    </div>

                                                    <h3 className={`text-[11px] font-black truncate leading-tight mb-1 tracking-tight ${item.posterUrl && !item.posterUrl.includes('placeholder.svg') && !isAnonymized ? 'text-white drop-shadow-lg' : 'text-text-primary'}`}>
                                                        {isAnonymized ? 'RESERVED' : (item.title?.toUpperCase() || 'UNTITLED')}
                                                    </h3>

                                                    {!isAnonymized && totalCols < 3 && (
                                                        <div className="flex items-center gap-2 mt-auto pt-2">
                                                            <div className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${item.posterUrl && !item.posterUrl.includes('placeholder.svg') ? 'bg-black/20 border-white/20' : 'bg-surface-elevated border-border-subtle'}`}>
                                                                <User className={`h-2.5 w-2.5 ${item.posterUrl && !item.posterUrl.includes('placeholder.svg') ? 'text-white/80' : 'text-text-tertiary'}`} />
                                                            </div>
                                                            <span className={`text-[9px] font-bold uppercase tracking-widest truncate ${item.posterUrl && !item.posterUrl.includes('placeholder.svg') ? 'text-white' : 'text-text-primary'}`}>
                                                                {item.host || 'Booking'}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Premium hover overlay */}
                                                {(item.posterUrl && !item.posterUrl.includes('placeholder.svg')) && !isAnonymized && (
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                                )}
                                            </Link>
                                        );
                                    } else {
                                        // Slot rendering
                                        return (
                                            <div
                                                key={item.id}
                                                style={{
                                                    top: `${top}%`,
                                                    height: `${height}%`,
                                                    minHeight: '40px',
                                                    left: `calc(${colLeft}% + 4px)`,
                                                    width: `calc(${colWidth}% - 8px)`,
                                                    zIndex: zIndex
                                                }}
                                                className="absolute rounded-xl p-3 border border-iris/30 bg-iris/5 flex flex-col transition-all hover:z-[100] hover:scale-[1.05] shadow-xl pointer-events-auto cursor-pointer"
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-[8px] font-black uppercase tracking-widest text-rose-500 tabular-nums">{item.startTime}</span>
                                                    {totalCols < 3 && <span className="px-1 py-0.5 rounded bg-rose-500/10 text-[7px] font-black text-rose-500 uppercase tracking-widest border border-rose-500/20">REQUEST</span>}
                                                </div>
                                                <h3 className="text-[10px] font-bold text-text-primary uppercase tracking-tight truncate">{item.host}</h3>
                                            </div>
                                        );
                                    }
                                })}

                                {/* Blocked Overlay */}
                                {(data?.block || isDragging || (isBlockingMode && startTime && endTime)) && (
                                    <div
                                        style={{
                                            top: `${getTop(isBlockingMode ? startTime : data?.block?.startTime || "16:00")}%`,
                                            height: `${getHeight(isBlockingMode ? startTime : data?.block?.startTime || "16:00", isBlockingMode ? endTime : data?.block?.endTime || "04:00")}%`,
                                        }}
                                        className={`absolute inset-x-0 mr-4 rounded-xl border border-border-subtle flex items-center justify-center backdrop-blur-sm z-10 transition-all ${isBlockingMode ? 'bg-surface-elevated/5 border-dashed' : 'bg-black/40'}`}
                                    >
                                        <div className="text-center p-6 bg-surface-elevated/5 backdrop-blur-md rounded-2xl border border-border-subtle shadow-2xl">
                                            <Lock className={`h-6 w-6 mx-auto mb-3 ${isBlockingMode ? 'text-text-primary' : 'text-text-primary/30'}`} />
                                            <h4 className="text-[10px] font-black text-text-primary uppercase tracking-[0.2em] mb-1">
                                                {isBlockingMode ? 'BLOCK_PENDING' : 'MANUAL_BLOCK_ACTIVE'}
                                            </h4>
                                            {isBlockingMode && (
                                                <span className="text-[11px] font-black text-iris uppercase tracking-widest tabular-nums">{startTime} — {endTime}</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Actions Section (Pitches) */}
                    {!isBlockingMode && needsAttention && (
                        <div className="mt-12 space-y-4">
                            <p className="text-[10px] font-black text-[#86868B] uppercase tracking-[0.2em]">High Priority Requests</p>
                            {data?.slots?.filter((s: any) => s.status === 'pending').map((s: any) => (
                                <div key={s.id} className="glass-panel p-6 border-iris/20 bg-iris/5 rounded-2xl">
                                    <div className="flex items-start gap-4 mb-6">
                                        <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                                            <CalendarIcon className="h-6 w-6 text-rose-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-base font-bold text-text-primary uppercase tracking-tight">{s.host} Submission</h4>
                                            <p className="text-[10px] font-black text-text-tertiary uppercase tracking-widest mt-1 tabular-nums">{s.startTime} — {s.endTime}</p>
                                        </div>
                                    </div>
                                    {role === 'venue' && (
                                        <div className="flex gap-4">
                                            <button
                                                onClick={() => onSlotAction(s.id, 'approve')}
                                                className="flex-1 bg-text-primary text-text-inverse py-3 rounded-xl font-black text-[11px] uppercase tracking-widest hover:opacity-90 transition-all shadow-lg"
                                            >
                                                Confirm slot
                                            </button>
                                            <button
                                                onClick={() => onSlotAction(s.id, 'reject')}
                                                className="px-6 py-3 border border-border-default text-text-tertiary rounded-xl font-black text-[11px] uppercase tracking-widest hover:text-text-primary hover:bg-surface-tertiary transition-all"
                                            >
                                                Abort
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Block Details Panel (Venue only) */}
            {role === 'venue' && isBlockingMode && (
                <div className="px-8 py-8 border-t border-border-subtle bg-surface-secondary space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-black text-text-primary uppercase tracking-[0.2em]">Manual Block Settings</h3>
                        <span className="text-[11px] font-black text-text-primary px-3 py-1 bg-surface-base border border-border-default rounded-lg tabular-nums shadow-sm">
                            {startTime} — {endTime}
                        </span>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-1.5 text-left">
                            <label className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest ml-1">Reason</label>
                            <input
                                type="text"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="E.G. PRIVATE_PRODUCTION_UNIT_MAINT"
                                className="w-full bg-surface-base border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary focus:border-rose-500 outline-none transition-all shadow-inner"
                            />
                        </div>

                        {data?.state === 'BLOCKED' && (
                            <button
                                onClick={handleUnblock}
                                disabled={isPending}
                                className="text-[10px] font-black text-rose-500 hover:text-rose-400 transition-colors uppercase tracking-widest"
                            >
                                — REMOVE MANUAL BLOCK
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Footer Actions */}
            <div className="p-8 border-t border-border-subtle bg-surface-secondary flex gap-4">
                {role === 'venue' ? (
                    <>
                        {isBlockingMode ? (
                            <>
                                <button
                                    onClick={() => setIsBlockingMode(false)}
                                    className="flex-1 py-4 border border-border-default text-text-tertiary rounded-xl font-black text-[11px] uppercase tracking-widest hover:text-text-primary hover:bg-surface-tertiary transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAction}
                                    disabled={isPending}
                                    className="flex-[1.5] py-4 bg-text-primary text-text-inverse rounded-xl font-black text-[11px] uppercase tracking-widest hover:opacity-90 transition-all shadow-lg"
                                >
                                    {isPending ? "SAVING..." : "Confirm Block"}
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setIsBlockingMode(true)}
                                className="flex-1 py-4 bg-surface-base border border-border-default text-text-primary rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-surface-secondary transition-all flex items-center justify-center gap-3 shadow-sm"
                            >
                                {data?.state === 'BLOCKED' ? <Settings className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                                {data?.state === 'BLOCKED' ? 'Edit Manual Block' : 'Add Manual Block'}
                            </button>
                        )}
                    </>
                ) : (
                    <Link
                        href="/host/events"
                        className="flex-1 py-4 bg-surface-base border border-border-default text-text-primary rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-surface-secondary transition-all text-center flex items-center justify-center shadow-sm"
                    >
                        Management view
                    </Link>
                )}
                {!isBlockingMode && (
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 border border-border-default text-text-tertiary rounded-xl font-black text-[11px] uppercase tracking-widest hover:text-text-primary hover:bg-surface-tertiary transition-all"
                    >
                        Close
                    </button>
                )}
            </div>
        </div>
    );
}
