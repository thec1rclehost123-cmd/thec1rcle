"use client";

import { useState, useEffect } from "react";
import { Building2, Check, MapPin, Calendar, Clock, AlertCircle, ChevronDown } from "lucide-react";
import { toISODateIST, parseAsIST } from "@c1rcle/core/time";
import { motion, AnimatePresence } from "framer-motion";

interface VenueStepProps {
    role: "venue" | "host";
    formData: any;
    updateFormData: (updates: any) => void;
    partnerships: any[];
    profile: any;
    validationErrors: Record<string, string>;
}

export function VenueStep({
    role,
    formData,
    updateFormData,
    partnerships,
    profile,
    validationErrors
}: VenueStepProps) {
    const [calendar, setCalendar] = useState<any[]>([]);
    const [loadingCalendar, setLoadingCalendar] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [showCalendar, setShowCalendar] = useState(false);

    // Fetch calendar when venue is selected (host only)
    useEffect(() => {
        if (role === "host" && formData.venueId) {
            fetchVenueCalendar(formData.venueId);
        }
    }, [formData.venueId, role]);

    const fetchVenueCalendar = async (venueId: string) => {
        setLoadingCalendar(true);
        try {
            const today = parseAsIST(null);
            const startDate = toISODateIST(today);
            const endDate = toISODateIST(new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000));

            const hostId = profile?.activeMembership?.partnerId;
            const res = await fetch(
                `/api/venues/${venueId}/calendar?startDate=${startDate}&endDate=${endDate}&hostId=${hostId}`
            );
            const data = await res.json();
            setCalendar(data.calendar || []);
            setShowCalendar(true);
        } catch (err) {
            console.error("Failed to fetch calendar:", err);
        } finally {
            setLoadingCalendar(false);
        }
    };

    const handleVenueSelect = (venue: any) => {
        updateFormData({
            venueId: venue.venueId,
            venueName: venue.venueName,
            venue: venue.venueName,
        });
    };

    const handleDateSelect = (date: string, status: string) => {
        if (status === "blocked" || status === "booked") return;
        setSelectedDate(date);
        updateFormData({ startDate: date });
    };

    const getDateStatus = (date: string) => {
        const calendarDay = calendar.find(d => d.date === date);
        if (calendarDay?.myRequest) {
            const status = calendarDay.myRequest.status;
            if (status === 'pending') return 'tentative';
            if (status === 'approved') return 'approved_hold';
        }
        return calendarDay?.status || "available";
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "available": return "bg-emerald-50 text-emerald-600 border-emerald-100";
            case "blocked": return "bg-red-50 text-red-600 border-red-100";
            case "booked": return "bg-stone-100 text-stone-500 border-stone-200";
            case "partial": return "bg-amber-50 text-amber-600 border-amber-100";
            case "tentative": return "bg-amber-100 text-amber-700 border-amber-200 ring-2 ring-amber-500/10";
            case "approved_hold": return "bg-indigo-50 text-indigo-600 border-indigo-200 font-bold shadow-sm";
            default: return "bg-stone-50 text-stone-900";
        }
    };

    // For venues, automatically set venue info from profile
    useEffect(() => {
        if (role === "venue" && profile?.activeMembership?.partnerId) {
            const venueId = profile.activeMembership.partnerId;
            const venueName = profile.activeMembership.partnerName || "Your Venue";

            if (formData.venueId !== venueId) {
                updateFormData({
                    venueId: venueId,
                    venueName: venueName,
                    venue: venueName
                });
            }
        }
    }, [role, profile, updateFormData, formData.venueId, formData.venueId]);

    if (role === "venue") {
        // Venue: Simply show their own venue
        return (
            <div className="space-y-8 animate-fade-in">
                <div>
                    <h2 className="text-headline">Location Routing</h2>
                    <p className="text-label mt-1.5">Your primary managed facility is pre-selected for this instance.</p>
                </div>

                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 rounded-[2.5rem] blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                    <div className="card-elevated p-10 flex items-center gap-6 relative">
                        <div className="w-16 h-16 rounded-[1.25rem] surface-secondary flex items-center justify-center text-primary border border-default shadow-sm group-hover:scale-105 transition-transform duration-500">
                            <Building2 className="w-8 h-8" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Active Identity</p>
                            <p className="text-display-xs">
                                {profile?.activeMembership?.partnerName || "Your Venue"}
                            </p>
                            <div className="flex items-center gap-2 text-stone-400">
                                <MapPin className="w-3.5 h-3.5" />
                                <span className="text-body-sm">{profile?.activeMembership?.city || "Primary Facility"}</span>
                            </div>
                        </div>
                        <div className="ml-auto">
                            <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center shadow-2xl shadow-emerald-100 ring-8 ring-emerald-50">
                                <Check className="w-6 h-6 text-white" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 rounded-[2rem] bg-emerald-50 border border-emerald-100/50 flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-body-sm text-emerald-900 leading-relaxed">
                        <span className="font-bold">Direct Authority:</span> As a venue operator, you are authorized for immediate publication. No external synchronization required.
                    </p>
                </div>
            </div>
        );
    }

    // Host: Show partnerships and calendar
    return (
        <div className="space-y-10 animate-fade-in">
            {/* Header */}
            <div>
                <h2 className="text-headline">Operational Logistics</h2>
                <p className="text-label mt-1.5">Establish the spatial and temporal parameters for your event.</p>
            </div>

            {/* Error States */}
            {validationErrors.venueId && (
                <div className="p-5 rounded-2xl bg-rose-50 border border-rose-100 flex items-center gap-3 shadow-sm border-l-4 border-l-rose-500">
                    <AlertCircle className="w-5 h-5 text-rose-600" />
                    <p className="text-body-sm text-rose-800 font-bold">{validationErrors.venueId}</p>
                </div>
            )}

            {/* Venue Selection Matrix */}
            <div className="space-y-6">
                <div className="flex items-center justify-between px-1">
                    <p className="text-label font-black uppercase tracking-widest">Select Partner Facility</p>
                    {partnerships.length > 0 && (
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#4f46e5]">
                            {partnerships.length} Active Node{partnerships.length > 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                {partnerships.length === 0 ? (
                    <div className="p-12 rounded-[3rem] bg-stone-50 border border-dashed border-stone-200 text-center space-y-6">
                        <div className="w-20 h-20 rounded-[2.5rem] bg-white flex items-center justify-center border border-stone-100 mx-auto shadow-xl">
                            <Building2 className="w-10 h-10 text-stone-200" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-headline-sm">No Active Partnerships</h3>
                            <p className="text-body-sm text-stone-500 max-w-sm mx-auto">
                                You require an established node in the network to initiate event logs.
                            </p>
                        </div>
                        <a
                            href="/host/partnerships"
                            className="btn btn-primary px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em]"
                        >
                            Establish Connection
                        </a>
                    </div>
                ) : (
                    <div className="relative group">
                        <div className={`absolute inset-0 bg-indigo-500/5 rounded-[2rem] blur-xl transition-opacity duration-500 ${formData.venueId ? 'opacity-100' : 'opacity-0'}`} />
                        <div className="relative">
                            <select
                                value={formData.venueId || ""}
                                onChange={(e) => {
                                    const venue = partnerships.find(p => p.venueId === e.target.value);
                                    if (venue) handleVenueSelect(venue);
                                }}
                                className="input h-16 pl-14 pr-12 text-[15px] font-bold appearance-none cursor-pointer bg-white border-stone-100 shadow-sm focus:shadow-indigo-100/50 rounded-[1.5rem]"
                            >
                                <option value="" disabled>Search network or select facility...</option>
                                {partnerships.map(p => (
                                    <option key={p.venueId} value={p.venueId}>
                                        {p.venueName} — {p.city || "Primary Node"}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-300 pointer-events-none transition-colors group-focus-within:text-[#4f46e5]">
                                <Building2 className="w-5 h-5" />
                            </div>
                            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-stone-300">
                                <ChevronDown className="w-4 h-4" />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Availability Matrix */}
            <AnimatePresence>
                {formData.venueId && showCalendar && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="space-y-8"
                    >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <p className="text-label font-black uppercase tracking-widest">Temporal Availability</p>
                            <div className="flex flex-wrap items-center gap-4 bg-stone-50 px-5 py-2 rounded-full border border-stone-100 shadow-inner">
                                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-stone-500">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Open
                                </div>
                                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-stone-500">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Pending
                                </div>
                                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-stone-500">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Reserved
                                </div>
                                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-stone-500">
                                    <div className="w-1.5 h-1.5 rounded-full bg-stone-300" /> Blocked
                                </div>
                            </div>
                        </div>

                        {loadingCalendar ? (
                            <div className="p-16 rounded-[2.5rem] bg-stone-50 border border-stone-100 text-center">
                                <div className="w-10 h-10 border-2 border-[#4f46e5] border-t-transparent rounded-full mx-auto mb-4 animate-spin" />
                                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-stone-400">Syncing Facility Data...</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
                                {calendar.slice(0, 28).map(day => {
                                    const date = new Date(day.date);
                                    const isSelected = formData.startDate === day.date;
                                    const isDisabled = day.status === "blocked" || day.status === "booked";
                                    const statusClass = getStatusColor(day.status);

                                    return (
                                        <button
                                            key={day.date}
                                            onClick={() => handleDateSelect(day.date, day.status)}
                                            disabled={isDisabled}
                                            className={`
                                                group aspect-square rounded-[1.5rem] flex flex-col items-center justify-center gap-1 transition-all duration-300 relative overflow-hidden
                                                ${isSelected
                                                    ? "bg-[#4f46e5] text-white shadow-xl shadow-indigo-200 scale-105 z-10"
                                                    : `${statusClass} border hover:scale-105 active:scale-95`
                                                }
                                                ${isDisabled ? "cursor-not-allowed opacity-40 grayscale-[0.5]" : ""}
                                            `}
                                        >
                                            <span className={`text-[9px] font-black uppercase tracking-widest ${isSelected ? "text-indigo-100" : "opacity-60"}`}>
                                                {date.toLocaleDateString("en-US", { weekday: "short" })}
                                            </span>
                                            <span className={`text-lg font-bold ${isSelected ? "text-white" : "text-stone-900"}`}>
                                                {date.getDate()}
                                            </span>

                                            {/* Subtle status dot if not selected */}
                                            {!isSelected && !isDisabled && (
                                                <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-current opacity-40" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Selected Sequence Dashboard */}
                        {formData.startDate && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="relative overflow-hidden group"
                            >
                                <div className="absolute inset-0 bg-indigo-600 rounded-[2.5rem] shadow-2xl shadow-indigo-100" />
                                <div className="relative p-8 flex flex-col md:flex-row md:items-center gap-8">
                                    <div className="w-16 h-16 rounded-3xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white ring-1 ring-white/20">
                                        <Calendar className="w-8 h-8" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-200">Selected Temporal Window</p>
                                        <p className="text-headline-sm text-white">
                                            {new Date(formData.startDate).toLocaleDateString("en-IN", {
                                                weekday: "long",
                                                day: "numeric",
                                                month: "long",
                                                year: "numeric"
                                            })}
                                        </p>
                                        <div className="flex items-center gap-2 text-indigo-100/70 text-body-sm">
                                            <MapPin className="w-3.5 h-3.5" />
                                            <span>Target Host: {formData.venueName}</span>
                                        </div>
                                    </div>
                                    <div className="md:ml-auto">
                                        <div className="px-6 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[11px] font-black uppercase tracking-widest text-white">
                                            Hold Interface Ready
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Operational Warnings */}
                        <div className="p-5 rounded-2xl bg-amber-50/50 border border-amber-100/50 flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
                                <AlertCircle className="w-5 h-5" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-body-sm text-amber-900 font-bold">Intersystem Synchronization Required</p>
                                <p className="text-[11px] text-amber-800 leading-relaxed">
                                    Your request will trigger an external hold logic at {formData.venueName}. Visibility and final confirmation are contingent on manual administrative approval.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
