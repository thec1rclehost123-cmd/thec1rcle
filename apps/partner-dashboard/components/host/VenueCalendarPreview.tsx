"use client";

import { useState, useEffect, useMemo } from "react";
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
    Building2
} from "lucide-react";

interface VenueCalendarPreviewProps {
    venueId: string;
    venueName: string;
    hostId: string;
    onSelectSlot: (date: string, startTime: string, endTime: string) => void;
    onClose: () => void;
}

interface CalendarDay {
    date: string;
    status: "available" | "blocked" | "booked" | "partial" | "my_request";
    reason?: string;
    myRequest?: {
        id: string;
        status: string;
        startTime: string;
        endTime: string;
    };
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
    { label: "Evening (17:00 - 21:00)", startTime: "17:00", endTime: "21:00" },
    { label: "Night (21:00 - 01:00)", startTime: "21:00", endTime: "01:00" },
    { label: "Late Night (23:00 - 04:00)", startTime: "23:00", endTime: "04:00" },
    { label: "Full Night (21:00 - 04:00)", startTime: "21:00", endTime: "04:00" },
];

export function VenueCalendarPreview({
    venueId,
    venueName,
    hostId,
    onSelectSlot,
    onClose
}: VenueCalendarPreviewProps) {
    const [currentMonth, setCurrentMonth] = useState(() => new Date());
    const [calendar, setCalendar] = useState<CalendarDay[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ startTime: string; endTime: string } | null>(null);
    const [dateAvailability, setDateAvailability] = useState<any>(null);
    const [loadingAvailability, setLoadingAvailability] = useState(false);

    // Fetch calendar data
    useEffect(() => {
        async function fetchCalendar() {
            setLoading(true);
            try {
                const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
                    .toISOString().split("T")[0];
                const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
                    .toISOString().split("T")[0];

                const res = await fetch(
                    `/api/host/venue-calendar?venueId=${venueId}&hostId=${hostId}&startDate=${startDate}&endDate=${endDate}`
                );
                const data = await res.json();
                setCalendar(data.calendar || []);
            } catch (err) {
                console.error("Failed to fetch venue calendar:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchCalendar();
    }, [venueId, hostId, currentMonth]);

    // Fetch specific date availability when selected
    useEffect(() => {
        if (!selectedDate) {
            setDateAvailability(null);
            return;
        }

        // Optimization: Use cached slots if available
        const cachedDay = calendar.find(d => d.date === selectedDate);
        if (cachedDay?.slots && cachedDay.slots.length > 0) {
            setDateAvailability({ slots: cachedDay.slots });
            return;
        }

        async function fetchAvailability() {
            setLoadingAvailability(true);
            try {
                const res = await fetch(
                    `/api/host/venue-calendar?venueId=${venueId}&date=${selectedDate}`
                );
                const data = await res.json();
                setDateAvailability(data.availability);
            } catch (err) {
                console.error("Failed to fetch date availability:", err);
            } finally {
                setLoadingAvailability(false);
            }
        }

        fetchAvailability();
    }, [venueId, selectedDate, calendar]);

    // Calendar grid
    const calendarGrid = useMemo(() => {
        const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
        const startOffset = firstDay.getDay();
        const totalDays = lastDay.getDate();

        const calendarMap = new Map(calendar.map(d => [d.date, d]));
        const today = new Date().toISOString().split("T")[0];

        const days = [];
        for (let i = 0; i < startOffset; i++) {
            days.push({ empty: true });
        }

        for (let day = 1; day <= totalDays; day++) {
            const dateStr = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
                .toISOString().split("T")[0];
            const dayData = calendarMap.get(dateStr);
            const isPast = dateStr < today;

            days.push({
                day,
                date: dateStr,
                isPast,
                status: isPast ? "past" : (dayData?.status || "available"),
                myRequest: dayData?.myRequest,
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
            onSelectSlot(selectedDate, selectedTimeSlot.startTime, selectedTimeSlot.endTime);
        }
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case "available":
                return "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 cursor-pointer";
            case "blocked":
                return "bg-gray-100 text-gray-400 cursor-not-allowed";
            case "booked":
                return "bg-rose-50 text-rose-400 cursor-not-allowed";
            case "partial":
                return "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200 cursor-pointer";
            case "my_request":
                return "bg-indigo-50 text-indigo-700 border-indigo-300 cursor-pointer";
            case "past":
                return "bg-gray-50 text-gray-300 cursor-not-allowed";
            default:
                return "bg-white text-gray-700 hover:bg-gray-50 cursor-pointer";
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "blocked":
                return <Lock className="w-3 h-3" />;
            case "booked":
                return <X className="w-3 h-3" />;
            case "my_request":
                return <Clock className="w-3 h-3" />;
            case "partial":
                return <AlertTriangle className="w-3 h-3" />;
            default:
                return null;
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="bg-white rounded-[2rem] w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center">
                                <Building2 className="w-6 h-6 text-indigo-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">{venueName}</h2>
                                <p className="text-sm text-gray-500">Select an available date for your event</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto min-h-0 divide-x divide-gray-100">
                    {/* Calendar Section */}
                    <div className="flex-[1.5] p-8">
                        {/* Month Navigation */}
                        <div className="flex items-center justify-between mb-6">
                            <button
                                onClick={() => navigateMonth(-1)}
                                className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <h3 className="text-lg font-bold text-gray-900">
                                {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                            </h3>
                            <button
                                onClick={() => navigateMonth(1)}
                                className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
                            >
                                <ChevronRight className="w-5 h-5 text-gray-600" />
                            </button>
                        </div>

                        {/* Weekday Headers */}
                        <div className="grid grid-cols-7 gap-1 mb-2">
                            {WEEKDAYS.map(day => (
                                <div key={day} className="text-center text-xs font-semibold text-gray-400 py-2">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Grid */}
                        {loading ? (
                            <div className="flex items-center justify-center h-64">
                                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-7 gap-1">
                                {calendarGrid.map((day, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => !day.empty && handleDateClick(day)}
                                        className={`
                                            aspect-square rounded-xl flex flex-col items-center justify-center relative
                                            text-sm font-medium transition-all border
                                            ${day.empty ? "bg-transparent border-transparent" : getStatusStyle(day.status)}
                                            ${selectedDate === day.date ? "ring-2 ring-indigo-500 ring-offset-2" : ""}
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
                                                {day.myRequest && (
                                                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-indigo-500" />
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
                                <span className="text-gray-600">Available</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-amber-500" />
                                <span className="text-gray-600">Partial</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-rose-400" />
                                <span className="text-gray-600">Unavailable</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-gray-300" />
                                <span className="text-gray-600">Blocked</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-indigo-500" />
                                <span className="text-gray-600">Your Request</span>
                            </div>
                        </div>
                    </div>

                    {/* Time Slot Selection Panel */}
                    <div className="w-full lg:w-96 p-8 bg-gray-50/50 backdrop-blur-sm lg:sticky lg:top-0 h-full">
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
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Selected Date</p>
                                        <p className="text-lg font-bold text-gray-900">
                                            {new Date(selectedDate).toLocaleDateString("en-IN", {
                                                weekday: "long",
                                                day: "numeric",
                                                month: "long",
                                                year: "numeric"
                                            })}
                                        </p>
                                    </div>

                                    {loadingAvailability ? (
                                        <div className="flex items-center justify-center py-8">
                                            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Select Time Slot</p>
                                            {TIME_SLOTS.map(slot => {
                                                const isSelected = selectedTimeSlot?.startTime === slot.startTime &&
                                                    selectedTimeSlot?.endTime === slot.endTime;

                                                // Check if this slot overlaps with any unavailable times
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
                                                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                                                : isSelected
                                                                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                                                                    : "bg-white text-gray-700 hover:bg-indigo-50 border border-gray-200"
                                                            }
                                                        `}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <p className="font-semibold text-sm">{slot.label}</p>
                                                                <p className={`text-xs ${isSelected ? "text-indigo-200" : "text-gray-400"}`}>
                                                                    {slot.startTime} - {slot.endTime}
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
                                            w-full py-4 rounded-xl font-bold text-sm transition-all
                                            ${selectedTimeSlot
                                                ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200"
                                                : "bg-gray-200 text-gray-400 cursor-not-allowed"
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
                                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                                        <Calendar className="w-8 h-8 text-gray-400" />
                                    </div>
                                    <p className="text-gray-500 font-medium">Select a date</p>
                                    <p className="text-gray-400 text-sm mt-1">
                                        Choose an available date on the calendar to see time slots
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
