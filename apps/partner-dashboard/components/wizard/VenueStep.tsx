"use client";

import { useState, useEffect } from "react";
import { Building2, Check, MapPin, Calendar, Clock, AlertCircle } from "lucide-react";
import { toISODateIST, parseAsIST } from "@c1rcle/core/time";
import { motion, AnimatePresence } from "framer-motion";

interface VenueStepProps {
    role: "club" | "host";
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
                `/api/clubs/${venueId}/calendar?startDate=${startDate}&endDate=${endDate}&hostId=${hostId}`
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
            venueId: venue.clubId,
            venueName: venue.clubName,
            clubId: venue.clubId
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
            case "available": return "bg-[#34c759]/10 text-[#34c759] border-[#34c759]/30";
            case "blocked": return "bg-[#ff3b30]/10 text-[#ff3b30] border-[#ff3b30]/30";
            case "booked": return "bg-[#86868b]/10 text-[#86868b] border-[#86868b]/30";
            case "partial": return "bg-[#ff9500]/10 text-[#ff9500] border-[#ff9500]/30";
            case "tentative": return "bg-[#ff9500]/20 text-[#ff9500] border-[#ff9500]/40 ring-2 ring-[#ff9500]/20";
            case "approved_hold": return "bg-[#007aff]/10 text-[#007aff] border-[#007aff]/30 font-bold shadow-sm";
            default: return "bg-[#f5f5f7] text-[#1d1d1f]";
        }
    };

    // For clubs, automatically set venue info from profile
    useEffect(() => {
        if (role === "club" && profile?.activeMembership?.partnerId) {
            const clubId = profile.activeMembership.partnerId;
            const clubName = profile.activeMembership.partnerName || "Your Venue";

            if (formData.venueId !== clubId || formData.clubId !== clubId) {
                updateFormData({
                    venueId: clubId,
                    venueName: clubName,
                    clubId: clubId
                });
            }
        }
    }, [role, profile, updateFormData, formData.venueId, formData.clubId]);

    if (role === "club") {
        // Club: Simply show their own venue
        return (
            <div className="space-y-6">
                <div className="p-6 rounded-2xl bg-[#f5f5f7] flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-[#1d1d1f]">
                        <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[13px] text-[#86868b] mb-1">Your Venue</p>
                        <p className="text-[17px] font-semibold text-[#1d1d1f]">
                            {profile?.activeMembership?.partnerName || "Your Venue"}
                        </p>
                    </div>
                    <div className="ml-auto">
                        <div className="w-8 h-8 rounded-full bg-[#34c759] flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                        </div>
                    </div>
                </div>

                <div className="p-4 rounded-xl bg-[#34c759]/10 border border-[#34c759]/20">
                    <p className="text-[13px] text-[#34c759] font-medium">
                        ✓ As a venue, you can create events directly without approval.
                    </p>
                </div>
            </div>
        );
    }

    // Host: Show partnerships and calendar
    return (
        <div className="space-y-6">
            {/* Venue Selection */}
            {validationErrors.venueId && (
                <div className="p-4 rounded-2xl bg-[#ff3b30]/10 border border-[#ff3b30]/20 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-[#ff3b30]" />
                    <p className="text-[13px] text-[#ff3b30] font-medium">{validationErrors.venueId}</p>
                </div>
            )}

            <div>
                <p className="text-[13px] font-medium text-[#86868b] mb-3">Select a Partner Venue</p>

                {partnerships.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-[#f5f5f7] text-center">
                        <Building2 className="w-12 h-12 text-[#86868b] mx-auto mb-4" />
                        <h3 className="text-[17px] font-semibold text-[#1d1d1f] mb-2">No Partner Venues</h3>
                        <p className="text-[13px] text-[#86868b] mb-4">
                            You need an active partnership with a venue to create events.
                        </p>
                        <a
                            href="/host/partnerships"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#007aff] text-white text-[13px] font-medium"
                        >
                            Browse Venues
                        </a>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {partnerships.map(p => (
                            <button
                                key={p.clubId}
                                onClick={() => handleVenueSelect(p)}
                                className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${formData.venueId === p.clubId
                                    ? "border-[#007aff] bg-[#007aff]/5"
                                    : "border-[rgba(0,0,0,0.06)] hover:border-[rgba(0,0,0,0.12)] bg-white"
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${formData.venueId === p.clubId
                                        ? "bg-[#007aff] text-white"
                                        : "bg-[#f5f5f7] text-[#86868b]"
                                        }`}>
                                        <Building2 className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <span className="font-medium text-[#1d1d1f] block">{p.clubName}</span>
                                        <span className="text-[13px] text-[#86868b]">
                                            {p.city || "Partner Venue"}
                                        </span>
                                    </div>
                                </div>
                                {formData.venueId === p.clubId && (
                                    <Check className="w-5 h-5 text-[#007aff]" />
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Calendar View (shown after venue selection) */}
            <AnimatePresence>
                {formData.venueId && showCalendar && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-4"
                    >
                        <div className="flex items-center justify-between">
                            <p className="text-[13px] font-medium text-[#86868b]">
                                Select a Date
                            </p>
                            <div className="flex items-center gap-4 text-[11px]">
                                <span className="flex items-center gap-1">
                                    <span className="w-3 h-3 rounded-full bg-[#34c759]" /> Available
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-3 h-3 rounded-full bg-[#ff9500]" /> Pending
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-3 h-3 rounded-full bg-[#007aff]" /> My Hold
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-3 h-3 rounded-full bg-[#86868b]" /> Booked
                                </span>
                            </div>
                        </div>

                        {loadingCalendar ? (
                            <div className="p-8 rounded-2xl bg-[#f5f5f7] text-center">
                                <div className="animate-spin w-8 h-8 border-2 border-[#007aff] border-t-transparent rounded-full mx-auto mb-3" />
                                <p className="text-[13px] text-[#86868b]">Loading availability...</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-7 gap-2">
                                {calendar.slice(0, 28).map(day => {
                                    const date = new Date(day.date);
                                    const isSelected = formData.startDate === day.date;
                                    const isDisabled = day.status === "blocked" || day.status === "booked";

                                    return (
                                        <button
                                            key={day.date}
                                            onClick={() => handleDateSelect(day.date, day.status)}
                                            disabled={isDisabled}
                                            className={`
                                                aspect-square rounded-xl text-center p-2 transition-all
                                                ${isSelected
                                                    ? "bg-[#007aff] text-white ring-2 ring-[#007aff] ring-offset-2"
                                                    : getStatusColor(day.status)
                                                }
                                                ${isDisabled ? "cursor-not-allowed opacity-50" : "hover:scale-105"}
                                            `}
                                        >
                                            <span className="text-[11px] block opacity-70">
                                                {date.toLocaleDateString("en-US", { weekday: "short" })}
                                            </span>
                                            <span className={`text-[15px] font-semibold ${isSelected ? "text-white" : ""}`}>
                                                {date.getDate()}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Selected Date Summary */}
                        {formData.startDate && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 rounded-2xl bg-[#007aff]/5 border border-[#007aff]/20"
                            >
                                <div className="flex items-center gap-3">
                                    <Calendar className="w-5 h-5 text-[#007aff]" />
                                    <div>
                                        <p className="text-[15px] font-semibold text-[#1d1d1f]">
                                            {new Date(formData.startDate).toLocaleDateString("en-IN", {
                                                weekday: "long",
                                                day: "numeric",
                                                month: "long",
                                                year: "numeric"
                                            })}
                                        </p>
                                        <p className="text-[13px] text-[#86868b]">
                                            This will be submitted as a slot request to {formData.venueName}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Note about slot requests */}
                        <div className="p-4 rounded-xl bg-[#ff9500]/10 border border-[#ff9500]/20">
                            <p className="text-[13px] text-[#ff9500] font-medium">
                                ⚠️ Your date selection will be sent as a request. The venue must approve before your event is confirmed.
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
