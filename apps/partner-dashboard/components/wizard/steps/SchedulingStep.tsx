"use client";

import { useState, useEffect } from "react";
import { Calendar, Clock, AlertCircle, Check, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatEventDate, toISODateIST, parseAsIST } from "@c1rcle/core/time";

interface SchedulingStepProps {
    formData: any;
    updateFormData: (updates: any) => void;
    validationErrors: Record<string, string>;
    role: 'venue' | 'host';
    profile: any;
}

function AppleInput({
    label,
    error,
    className = "",
    icon: Icon,
    hint,
    ...props
}: {
    label?: string;
    error?: string;
    className?: string;
    icon?: any;
    hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <div className="space-y-1.5">
            {label && (
                <div className="flex items-center justify-between">
                    <label className="text-label ml-1">{label}</label>
                    {hint && <span className="text-[10px] text-[#86868b] font-medium">{hint}</span>}
                </div>
            )}
            <div className="relative group">
                {Icon && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted transition-colors group-focus-within:text-[#4f46e5]">
                        <Icon className="w-4 h-4" />
                    </div>
                )}
                <input
                    className={`input ${error ? 'input-error' : ''} ${Icon ? 'pl-11' : 'pl-4'} pr-4 ${className}`}
                    {...props}
                />
            </div>
            {error && (
                <p className="text-[12px] text-red-600 font-medium ml-1 animate-slide-up">{error}</p>
            )}
        </div>
    );
}

export function SchedulingStep({
    formData,
    updateFormData,
    validationErrors,
    role,
    profile
}: SchedulingStepProps) {
    const [venueCalendar, setVenueCalendar] = useState<any[]>([]);
    const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
    const [showCalendar, setShowCalendar] = useState(false);

    // Fetch venue calendar when venue is selected
    useEffect(() => {
        if (formData.venueId && role === 'host') {
            fetchVenueCalendar(formData.venueId);
        }
    }, [formData.venueId, role]);

    const fetchVenueCalendar = async (venueId: string) => {
        setIsLoadingCalendar(true);
        try {
            const res = await fetch(`/api/venue/calendar?venueId=${venueId}`);
            if (res.ok) {
                const data = await res.json();
                setVenueCalendar(data.dates || []);
            }
        } catch (err) {
            console.error("Failed to fetch calendar", err);
        } finally {
            setIsLoadingCalendar(false);
        }
    };

    const getDateStatus = (date: string) => {
        const entry = venueCalendar.find(d => d.date === date);
        return entry?.status || 'available';
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'blocked': return 'bg-red-100 text-red-600 border-red-200';
            case 'tentative': return 'bg-amber-100 text-amber-600 border-amber-200';
            case 'booked': return 'bg-blue-100 text-blue-600 border-blue-200';
            default: return 'bg-emerald-100 text-emerald-600 border-emerald-200';
        }
    };

    const hasDateConflict = formData.startDate && getDateStatus(formData.startDate) === 'blocked';

    return (
        <div className="space-y-8">
            {/* Date Selection */}
            <div className="card-elevated p-8 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Calendar className="w-3.5 h-3.5" />
                    </div>
                    <div>
                        <h3 className="text-headline-sm">Event Date</h3>
                        <p className="text-caption">When is this event happening</p>
                    </div>
                </div>

                <AppleInput
                    label="Event Date"
                    type="date"
                    icon={Calendar}
                    value={formData.startDate}
                    onChange={(e) => updateFormData({ startDate: e.target.value })}
                    error={validationErrors.startDate}
                    hint="Required"
                />

                {/* Calendar Conflict Warning */}
                <AnimatePresence>
                    {hasDateConflict && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3"
                        >
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-body font-semibold text-red-800">Date Conflict Detected</p>
                                <p className="text-caption text-red-700 mt-1">
                                    This date is blocked on the venue calendar. Please select a different date or contact the venue.
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Venue Calendar Preview (for hosts) */}
                {role === 'host' && formData.venueId && (
                    <div className="mt-4">
                        <button
                            type="button"
                            onClick={() => setShowCalendar(!showCalendar)}
                            className="flex items-center gap-2 text-body-sm text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                            <ChevronDown className={`w-4 h-4 transition-transform ${showCalendar ? 'rotate-180' : ''}`} />
                            {showCalendar ? 'Hide' : 'View'} Venue Availability
                        </button>

                        <AnimatePresence>
                            {showCalendar && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-4 p-4 rounded-xl bg-[#f5f5f7] border border-[#e5e5e7]"
                                >
                                    {isLoadingCalendar ? (
                                        <p className="text-caption text-center py-4">Loading calendar...</p>
                                    ) : venueCalendar.length === 0 ? (
                                        <p className="text-caption text-center py-4">No calendar restrictions found. All dates available.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            <p className="text-label mb-3">Venue Calendar Status (Next 30 Days)</p>
                                            <div className="flex flex-wrap gap-2">
                                                {venueCalendar.slice(0, 14).map((entry: any) => (
                                                    <div
                                                        key={entry.date}
                                                        className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border ${getStatusColor(entry.status)}`}
                                                    >
                                                        {new Date(entry.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[#e5e5e7]">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                    <span className="text-[10px] text-[#86868b]">Available</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                                                    <span className="text-[10px] text-[#86868b]">Tentative</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full bg-red-500" />
                                                    <span className="text-[10px] text-[#86868b]">Blocked</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Time Selection */}
            <div className="card-elevated p-8 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                        <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div>
                        <h3 className="text-headline-sm">Event Timing</h3>
                        <p className="text-caption">Start and end times for the event</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <AppleInput
                        label="Start Time"
                        type="time"
                        icon={Clock}
                        value={formData.startTime}
                        onChange={(e) => updateFormData({ startTime: e.target.value })}
                        hint="When event begins"
                    />
                    <AppleInput
                        label="End Time"
                        type="time"
                        icon={Clock}
                        value={formData.endTime}
                        onChange={(e) => updateFormData({ endTime: e.target.value })}
                        hint="When event ends"
                    />
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <AppleInput
                        label="Doors Open"
                        type="time"
                        icon={Clock}
                        value={formData.doorsOpen || ""}
                        onChange={(e) => updateFormData({ doorsOpen: e.target.value })}
                        hint="Optional"
                    />
                    <AppleInput
                        label="Last Entry"
                        type="time"
                        icon={Clock}
                        value={formData.lastEntry || ""}
                        onChange={(e) => updateFormData({ lastEntry: e.target.value })}
                        hint="Optional"
                    />
                </div>

                {/* Schedule Summary */}
                <AnimatePresence>
                    {(formData.startDate || (formData.startTime && formData.endTime)) && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center gap-3"
                        >
                            <Check className="w-5 h-5 text-emerald-600" />
                            <div>
                                <p className="text-body font-medium text-emerald-800">
                                    {formData.startDate ? formatEventDate(formData.startDate) : 'Date TBD'}
                                </p>
                                <p className="text-caption text-emerald-700">
                                    {formData.doorsOpen && `Doors: ${formData.doorsOpen} • `}
                                    {formData.startTime && `Start: ${formData.startTime}`}
                                    {formData.endTime && ` • End: ${formData.endTime}`}
                                    {formData.lastEntry && ` • Last Entry: ${formData.lastEntry}`}
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
