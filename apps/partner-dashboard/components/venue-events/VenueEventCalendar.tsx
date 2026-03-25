"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronLeft,
    ChevronRight,
    Calendar,
    Clock,
    Lock,
    CheckCircle2,
    AlertTriangle,
    X,
    Loader2,
    Building2,
    ArrowLeft
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

interface CalendarDay {
    date: string;
    status: "available" | "blocked" | "booked" | "partial" | "my_request";
    reason?: string;
    slots?: {
        startTime: string;
        endTime: string;
        status: string;
    }[];
}

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const timeOverlaps = (start1: string, end1: string, start2: string, end2: string) => {
    const toMinutes = (time: string) => {
        const [h, m] = time.split(":").map(Number);
        return h * 60 + m;
    };
    let s1 = toMinutes(start1);
    let e1 = toMinutes(end1);
    let s2 = toMinutes(start2);
    let e2 = toMinutes(end2);
    if (e1 < s1) e1 += 24 * 60;
    if (e2 < s2) e2 += 24 * 60;
    return !(e1 <= s2 || s1 >= e2);
};

const TIME_SLOTS = [
    { label: "Evening (17:00 – 21:00)", startTime: "17:00", endTime: "21:00" },
    { label: "Night (21:00 – 01:00)", startTime: "21:00", endTime: "01:00" },
    { label: "Late Night (23:00 – 04:00)", startTime: "23:00", endTime: "04:00" },
    { label: "Full Night (21:00 – 04:00)", startTime: "21:00", endTime: "04:00" },
];

const formatDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
};

export function VenueEventCalendar() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useDashboardAuth();

    const venueId = searchParams.get("venueId") || "";
    const venueName = searchParams.get("venueName") || "Your Venue";

    const [currentMonth, setCurrentMonth] = useState(() => new Date());
    const [calendar, setCalendar] = useState<CalendarDay[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ startTime: string; endTime: string } | null>(null);
    const [dateAvailability, setDateAvailability] = useState<any>(null);
    const [loadingAvailability, setLoadingAvailability] = useState(false);

    // Authenticated fetch helper
    const authedFetch = useCallback(async (url: string, options: RequestInit = {}) => {
        if (!user) throw new Error("Not authenticated");
        const token = await user.getIdToken(true);
        return fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                "Authorization": `Bearer ${token}`,
            },
        });
    }, [user]);

    // Fetch calendar data using the venue's own calendar API
    useEffect(() => {
        if (!venueId) return;
        async function fetchCalendar() {
            setLoading(true);
            try {
                const startDate = formatDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1));
                const endDate = formatDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0));

                const res = await authedFetch(
                    `/api/venue/calendar?venueId=${venueId}&view=operating&startDate=${startDate}&endDate=${endDate}`
                );
                const data = await res.json();
                setCalendar(data.calendar || data.days || []);
            } catch (err) {
                console.error("Failed to fetch venue calendar:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchCalendar();
    }, [venueId, currentMonth, authedFetch]);

    // Fetch specific date availability when selected
    useEffect(() => {
        if (!selectedDate || !venueId) {
            setDateAvailability(null);
            return;
        }

        const cachedDay = calendar.find(d => d.date === selectedDate);
        if (cachedDay?.slots && cachedDay.slots.length > 0) {
            setDateAvailability({ slots: cachedDay.slots });
            return;
        }

        async function fetchAvailability() {
            setLoadingAvailability(true);
            try {
                const res = await authedFetch(
                    `/api/venue/calendar?venueId=${venueId}&startDate=${selectedDate}&endDate=${selectedDate}`
                );
                const data = await res.json();
                setDateAvailability(data.availability || data);
            } catch (err) {
                console.error("Failed to fetch date availability:", err);
            } finally {
                setLoadingAvailability(false);
            }
        }
        fetchAvailability();
    }, [venueId, selectedDate, calendar, authedFetch]);

    // Calendar grid
    const calendarGrid = useMemo(() => {
        const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
        const startOffset = firstDay.getDay();
        const totalDays = lastDay.getDate();

        const calendarMap = new Map(calendar.map(d => [d.date, d]));
        const today = formatDate(new Date());

        const days: any[] = [];
        for (let i = 0; i < startOffset; i++) {
            days.push({ empty: true });
        }

        for (let day = 1; day <= totalDays; day++) {
            const dateStr = formatDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
            const dayData = calendarMap.get(dateStr);
            const isPast = dateStr < today;

            days.push({
                day,
                date: dateStr,
                isPast,
                status: isPast ? "past" : (dayData?.status || "available"),
                reason: dayData?.reason
            });
        }

        return days;
    }, [currentMonth, calendar]);

    const navigateMonth = (delta: number) => {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
        setSelectedDate(null);
    };

    const handleDateClick = (day: any) => {
        if (day.empty || day.isPast || day.status === "blocked" || day.status === "booked") {
            return;
        }
        setSelectedDate(day.date);
        setSelectedTimeSlot(null);
    };

    const handleConfirm = () => {
        if (selectedDate && selectedTimeSlot) {
            const params = new URLSearchParams({
                venue: venueId,
                venueName: venueName,
                date: selectedDate,
                startTime: selectedTimeSlot.startTime,
                endTime: selectedTimeSlot.endTime,
            });
            router.push(`/venue/create?${params.toString()}`);
        }
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case "available":
                return "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20 cursor-pointer";
            case "blocked":
                return "bg-white/[0.03] text-white/20 cursor-not-allowed";
            case "booked":
                return "bg-rose-500/10 text-rose-400/60 cursor-not-allowed";
            case "partial":
                return "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-amber-500/20 cursor-pointer";
            case "past":
                return "bg-white/[0.02] text-white/15 cursor-not-allowed";
            default:
                return "bg-white/[0.04] text-white/70 hover:bg-white/[0.08] cursor-pointer";
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "blocked":
                return <Lock className="w-3 h-3" />;
            case "booked":
                return <X className="w-3 h-3" />;
            case "partial":
                return <AlertTriangle className="w-3 h-3" />;
            default:
                return null;
        }
    };

    if (!venueId) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="text-center">
                    <p className="text-text-tertiary">No venue selected.</p>
                    <button
                        onClick={() => router.push("/venue/create/select-venue")}
                        className="mt-4 btn btn-primary"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <button
                    onClick={() => router.push("/venue/create/select-venue")}
                    className="flex items-center gap-2 text-text-tertiary hover:text-text-primary transition-colors mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-[11px] font-bold uppercase tracking-widest">Back to Venues</span>
                </button>
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 to-rose-600/20 flex items-center justify-center border border-white/10">
                        <Building2 className="w-7 h-7 text-orange-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-text-primary uppercase tracking-tight">{venueName}</h1>
                        <p className="text-sm text-text-tertiary mt-0.5">Select an available date and time for your event</p>
                    </div>
                </div>
            </div>

            {/* Main Layout */}
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Calendar Section */}
                <div className="flex-[1.5] bg-white/[0.02] rounded-[2rem] border border-white/[0.06] p-8">
                    {/* Month Navigation */}
                    <div className="flex items-center justify-between mb-6">
                        <button
                            onClick={() => navigateMonth(-1)}
                            className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5 text-text-secondary" />
                        </button>
                        <h3 className="text-lg font-bold text-text-primary">
                            {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                        </h3>
                        <button
                            onClick={() => navigateMonth(1)}
                            className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors"
                        >
                            <ChevronRight className="w-5 h-5 text-text-secondary" />
                        </button>
                    </div>

                    {/* Weekday Headers */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {WEEKDAYS.map(day => (
                            <div key={day} className="text-center text-xs font-semibold text-text-tertiary py-2">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar Grid */}
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-7 gap-1">
                            {calendarGrid.map((day, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => !day.empty && handleDateClick(day)}
                                    className={`
                                        aspect-square rounded-xl flex flex-col items-center justify-center relative
                                        text-sm font-medium transition-all border border-transparent
                                        ${day.empty ? "bg-transparent" : getStatusStyle(day.status)}
                                        ${selectedDate === day.date ? "ring-2 ring-orange-500 ring-offset-2 ring-offset-[var(--v-canvas)]" : ""}
                                    `}
                                >
                                    {!day.empty && (
                                        <>
                                            <span>{day.day}</span>
                                            {getStatusIcon(day.status) && (
                                                <span className="absolute bottom-1">
                                                    {getStatusIcon(day.status)}
                                                </span>
                                            )}
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Legend */}
                    <div className="mt-6 flex flex-wrap gap-4 text-xs">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500" />
                            <span className="text-text-tertiary">Available</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-amber-500" />
                            <span className="text-text-tertiary">Partial</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-rose-400" />
                            <span className="text-text-tertiary">Booked</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-white/20" />
                            <span className="text-text-tertiary">Blocked</span>
                        </div>
                    </div>
                </div>

                {/* Time Slot Selection Panel */}
                <div className="w-full lg:w-96 bg-white/[0.02] rounded-[2rem] border border-white/[0.06] p-8 lg:sticky lg:top-4 self-start">
                    <AnimatePresence mode="wait">
                        {selectedDate ? (
                            <motion.div
                                key="time-selection"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div>
                                    <p className="text-[10px] font-black text-text-tertiary uppercase tracking-widest mb-2">Selected Date</p>
                                    <p className="text-lg font-bold text-text-primary">
                                        {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-IN", {
                                            weekday: "long",
                                            day: "numeric",
                                            month: "long",
                                            year: "numeric"
                                        })}
                                    </p>
                                </div>

                                {loadingAvailability ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-black text-text-tertiary uppercase tracking-widest">Select Time Slot</p>
                                        {TIME_SLOTS.map(slot => {
                                            const isSelected = selectedTimeSlot?.startTime === slot.startTime &&
                                                selectedTimeSlot?.endTime === slot.endTime;

                                            const isUnavailable = dateAvailability?.slots?.some((s: any) =>
                                                s.status !== "available" &&
                                                timeOverlaps(s.startTime, s.endTime, slot.startTime, slot.endTime)
                                            );

                                            return (
                                                <button
                                                    key={slot.label}
                                                    onClick={() => !isUnavailable && setSelectedTimeSlot(slot)}
                                                    disabled={isUnavailable}
                                                    className={`
                                                        w-full p-4 rounded-xl text-left transition-all
                                                        ${isUnavailable
                                                            ? "bg-white/[0.03] text-white/20 cursor-not-allowed"
                                                            : isSelected
                                                                ? "bg-gradient-to-r from-orange-500 to-rose-600 text-white shadow-lg shadow-orange-500/20"
                                                                : "bg-white/[0.04] text-text-secondary hover:bg-white/[0.08] border border-white/[0.06]"
                                                        }
                                                    `}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="font-semibold text-sm">{slot.label}</p>
                                                            <p className={`text-xs mt-0.5 ${isSelected ? "text-white/70" : "text-text-tertiary"}`}>
                                                                {slot.startTime} – {slot.endTime}
                                                            </p>
                                                        </div>
                                                        {isSelected && <CheckCircle2 className="w-5 h-5" />}
                                                        {isUnavailable && <Lock className="w-4 h-4" />}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Confirm Button */}
                                <button
                                    onClick={handleConfirm}
                                    disabled={!selectedTimeSlot}
                                    className={`
                                        w-full py-4 rounded-xl font-bold text-sm transition-all uppercase tracking-wider
                                        ${selectedTimeSlot
                                            ? "bg-gradient-to-r from-orange-500 to-rose-600 text-white hover:shadow-lg hover:shadow-orange-500/20 hover:scale-[1.02] active:scale-95"
                                            : "bg-white/[0.06] text-white/20 cursor-not-allowed"
                                        }
                                    `}
                                >
                                    Continue to Create Event
                                </button>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="empty-state"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col items-center justify-center h-full text-center py-12"
                            >
                                <div className="w-16 h-16 rounded-full bg-white/[0.04] flex items-center justify-center mb-4">
                                    <Calendar className="w-8 h-8 text-text-tertiary" />
                                </div>
                                <p className="text-text-secondary font-medium">Select a date</p>
                                <p className="text-text-tertiary text-sm mt-1">
                                    Choose an available date on the calendar to see time slots
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
