"use client";

import { useEffect, useState } from "react";
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    Calendar as CalendarIcon,
    Filter,
    MoreVertical,
    Clock,
    User,
    Check,
    X,
    AlertCircle,
    Info,
    CalendarDays
} from "lucide-react";
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

interface CalendarEvent {
    id: string;
    name: string;
    date: any; // Firestore Timestamp
    type: "club-hosted" | "host-hosted" | "private" | "blocked";
    host_name?: string;
    host_id?: string;
    status: "confirmed" | "pending_approval" | "cancelled" | "blocked";
    internal_notes?: string;
    manager_assigned?: string;
}

const EVENT_TYPE_STYLES: Record<string, string> = {
    "club-hosted": "bg-emerald-50 text-emerald-700 border-emerald-100",
    "host-hosted": "bg-indigo-50 text-indigo-700 border-indigo-100",
    "private": "bg-purple-50 text-purple-700 border-purple-100",
    "blocked": "bg-slate-100 text-slate-600 border-slate-200",
};

export default function CalendarPage() {
    const { profile } = useDashboardAuth();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    useEffect(() => {
        if (!profile?.activeMembership?.partnerId) return;

        const db = getFirebaseDb();
        const venueId = profile.activeMembership.partnerId;

        const q = query(
            collection(db, "events"),
            where("venue_id", "==", venueId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedEvents = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as CalendarEvent));
            setEvents(fetchedEvents);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [profile]);

    const selectedDateEvents = events.filter(e => {
        const d = e.date?.toDate ? e.date.toDate() : new Date(e.date);
        return d.getDate() === selectedDate?.getDate() &&
            d.getMonth() === selectedDate?.getMonth() &&
            d.getFullYear() === selectedDate?.getFullYear();
    });

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const calendarDays: (number | null)[] = [];
    for (let i = 0; i < firstDayOfMonth; i++) calendarDays.push(null);
    for (let day = 1; day <= daysInMonth; day++) calendarDays.push(day);

    const getEventsForDay = (day: number) => {
        return events.filter(e => {
            const d = e.date?.toDate ? e.date.toDate() : new Date(e.date);
            return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
        });
    };

    return (
        <div className="space-y-10 pb-20 animate-in fade-in duration-500">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-10">
                <div>
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-4">
                        Master Calendar
                    </h1>
                    <p className="text-slate-500 text-lg font-medium mt-3">Plan your schedule, block dates, and manage slot requests.</p>
                </div>
                <div className="flex items-center gap-4">
                    <button className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl text-sm font-bold shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95">
                        <Plus className="h-5 w-5" />
                        Quick Block Date
                    </button>
                </div>
            </div>

            {/* Main Calendar Section */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-10">

                {/* Left: Monthly View */}
                <div className="xl:col-span-3">
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">

                        {/* Control Bar */}
                        <div className="p-8 border-b border-slate-50 bg-slate-50/20 flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                                    {MONTHS[month]} <span className="text-slate-300">{year}</span>
                                </h2>
                                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                                    <button
                                        onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                                        className="p-2 hover:bg-slate-50 rounded-xl transition-colors"
                                    >
                                        <ChevronLeft className="h-5 w-5 text-slate-600" />
                                    </button>
                                    <button
                                        onClick={() => setCurrentDate(new Date())}
                                        className="px-4 py-2 text-xs font-bold uppercase text-slate-500 hover:text-slate-900"
                                    >
                                        Today
                                    </button>
                                    <button
                                        onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                                        className="p-2 hover:bg-slate-50 rounded-xl transition-colors"
                                    >
                                        <ChevronRight className="h-5 w-5 text-slate-600" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                <LegendItem dot="bg-emerald-500" label="Club Event" />
                                <LegendItem dot="bg-indigo-500" label="Host Slot" />
                                <LegendItem dot="bg-slate-300" label="Blocked" />
                            </div>
                        </div>

                        {/* Calendar Grid */}
                        <div className="p-6">
                            <div className="grid grid-cols-7 mb-4">
                                {DAYS.map(d => (
                                    <div key={d} className="text-center py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                        {d}
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-7 gap-3">
                                {calendarDays.map((day, i) => {
                                    if (day === null) return <div key={`empty-${i}`} className="aspect-square bg-slate-50/30 rounded-3xl" />;

                                    const dayEvents = getEventsForDay(day);
                                    const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
                                    const isSelected = day === selectedDate?.getDate() && month === selectedDate?.getMonth() && year === selectedDate?.getFullYear();

                                    return (
                                        <button
                                            key={day}
                                            onClick={() => setSelectedDate(new Date(year, month, day))}
                                            className={`aspect-square p-4 rounded-[2rem] border transition-all relative flex flex-col group ${isSelected
                                                ? "border-emerald-500 bg-emerald-50/10 shadow-lg shadow-emerald-100 ring-4 ring-emerald-50"
                                                : "border-slate-100 hover:border-slate-300 hover:bg-slate-50"
                                                }`}
                                        >
                                            <span className={`text-base font-black mb-auto ${isToday ? "text-emerald-600" : "text-slate-400"}`}>
                                                {day}
                                            </span>

                                            <div className="w-full flex flex-col gap-1.5 mt-2">
                                                {dayEvents.slice(0, 2).map(e => (
                                                    <div
                                                        key={e.id}
                                                        className={`w-full h-2 rounded-full ${e.type === 'blocked' ? 'bg-slate-200' : e.type === 'host-hosted' ? 'bg-indigo-500/40' : 'bg-emerald-500/40'}`}
                                                    />
                                                ))}
                                                {dayEvents.length > 2 && (
                                                    <div className="text-[9px] font-black text-slate-300 uppercase">+{dayEvents.length - 2} More</div>
                                                )}
                                            </div>

                                            {dayEvents.some(e => e.status === 'pending_approval') && (
                                                <div className="absolute top-3 right-3 h-2.5 w-2.5 rounded-full bg-amber-500 border-2 border-white shadow-sm" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Selected Day Intel */}
                <div className="xl:col-span-1">
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8 h-full min-h-[600px]">
                        <div className="mb-10 text-center pb-8 border-b border-slate-50">
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Day View</p>
                            <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                                {selectedDate ? `${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]}` : "Select Date"}
                            </h3>
                        </div>

                        {selectedDateEvents.length === 0 ? (
                            <div className="py-24 flex flex-col items-center text-center">
                                <div className="h-20 w-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-8 border border-slate-100">
                                    <Clock className="h-10 w-10 text-slate-200" />
                                </div>
                                <h4 className="text-xl font-bold text-slate-900 mb-2">Open Date</h4>
                                <p className="text-slate-500 text-sm font-medium mb-10 leading-relaxed px-4">No events scheduled for this day. You can block this date or create an internal event.</p>
                                <button className="w-full py-5 bg-slate-900 text-white rounded-3xl font-bold text-sm shadow-xl active:scale-95 transition-all">
                                    Create Event Here
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {selectedDateEvents.map(event => (
                                    <DetailsCard key={event.id} event={event} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function LegendItem({ dot, label }: { dot: string, label: string }) {
    return (
        <div className="flex items-center gap-2.5">
            <div className={`h-2.5 w-2.5 rounded-full ${dot} shadow-sm`} />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
        </div>
    );
}

function DetailsCard({ event }: { event: CalendarEvent }) {
    const isPending = event.status === 'pending_approval';

    return (
        <div className={`p-8 rounded-[2rem] border transition-all ${isPending ? "bg-amber-50/50 border-amber-100" : "bg-white border-slate-100 hover:border-slate-300"}`}>
            <div className="flex items-center justify-between mb-6">
                <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${EVENT_TYPE_STYLES[event.type]}`}>
                    {event.type.replace('-', ' ')}
                </span>
                <button className="text-slate-300 hover:text-slate-900"><MoreVertical className="h-5 w-5" /></button>
            </div>

            <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-4 line-clamp-2 leading-tight">{event.name}</h4>

            <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 text-sm font-bold text-slate-500">
                    <Clock className="h-4 w-4 text-emerald-600" />
                    9:00 PM onwards
                </div>
                {event.host_name && (
                    <div className="flex items-center gap-3 text-sm font-bold text-indigo-700">
                        <User className="h-4 w-4" />
                        Partner: {event.host_name}
                    </div>
                )}
            </div>

            {isPending ? (
                <div className="space-y-4 pt-4 border-t border-amber-100">
                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" /> Review Needed
                    </p>
                    <div className="flex gap-3">
                        <button className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-100 h-14">
                            Approve
                        </button>
                        <button className="flex-1 py-4 bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl text-[10px] font-black uppercase tracking-widest h-14">
                            Reject
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                    <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                        <Check className="h-4 w-4" /> Confirmed
                    </div>
                    <button className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">
                        Ops Center <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            )}
        </div>
    );
}
