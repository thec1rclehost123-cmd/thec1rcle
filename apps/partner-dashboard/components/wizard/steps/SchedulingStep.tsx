"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar, Clock, AlertCircle, Check, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatEventDate } from "@c1rcle/core/time";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

interface SchedulingStepProps {
    formData: any;
    updateFormData: (updates: any) => void;
    validationErrors: Record<string, string>;
    role: 'venue' | 'host';
    profile: any;
}

export function SchedulingStep({ formData, updateFormData, validationErrors, role, profile }: SchedulingStepProps) {
    const { user } = useDashboardAuth();
    const [venueCalendar, setVenueCalendar] = useState<any[]>([]);
    const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
    const [showCalendar, setShowCalendar] = useState(false);

    const authedFetch = useCallback(async (url: string, options: RequestInit = {}) => {
        if (!user) throw new Error("Not authenticated");
        const token = await user.getIdToken(true);
        return fetch(url, { ...options, headers: { ...options.headers, "Authorization": `Bearer ${token}` } });
    }, [user]);

    useEffect(() => {
        if (formData.venueId && role === 'host') {
            fetchVenueCalendar(formData.venueId);
        }
    }, [formData.venueId, role]);

    const fetchVenueCalendar = async (venueId: string) => {
        setIsLoadingCalendar(true);
        try {
            const res = await authedFetch(`/api/venue/calendar?venueId=${venueId}`);
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

    const getDateStatus = (date: string) => venueCalendar.find(d => d.date === date)?.status || 'available';
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'blocked': return 'bg-red-500/10 text-red-500 border-red-500/20';
            case 'tentative': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
            case 'booked': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            default: return 'bg-green-500/10 text-emerald-600 border-emerald-500/20';
        }
    };

    const hasDateConflict = formData.startDate && getDateStatus(formData.startDate) === 'blocked';

    const TIME_FIELDS = [
        { label: "Start Time", key: "startTime", hint: "Required" },
        { label: "End Time", key: "endTime", hint: "Required" },
        { label: "Doors Open", key: "doorsOpen", hint: "Optional" },
        { label: "Last Entry", key: "lastEntry", hint: "Optional" },
    ];

    return (
        <div className="space-y-4">
            {/* Row 1: Date + Times side by side */}
            <div className="grid grid-cols-2 gap-5">
                {/* ─── Left: Date ─── */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${validationErrors.startDate ? 'bg-red-500' : 'bg-indigo-500'}`} />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${validationErrors.startDate ? 'text-red-500' : 'text-indigo-500'}`}>Event Date</span>
                    </div>

                    <div className="relative">
                        <Calendar className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${validationErrors.startDate ? 'text-red-500' : 'text-[var(--text-tertiary)]'}`} />
                        <input
                            type="date"
                            value={formData.startDate || ""}
                            onChange={(e) => updateFormData({ startDate: e.target.value })}
                            className={`w-full pl-10 pr-3 py-3 rounded-xl bg-[var(--bg-fill)] border text-[14px] text-[var(--text-primary)] focus:outline-none transition-all ${validationErrors.startDate
                                ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.1)] focus:border-red-600'
                                : 'border-[var(--border-subtle)] focus:border-indigo-400'
                                }`}
                        />
                    </div>
                    <AnimatePresence>
                        {validationErrors.startDate && (
                            <motion.p
                                initial={{ opacity: 0, x: -4 }}
                                animate={{ opacity: 1, x: [0, -4, 4, -4, 4, 0] }}
                                className="text-[10px] font-black uppercase tracking-widest text-red-500 mt-1"
                            >
                                Selection Required
                            </motion.p>
                        )}
                    </AnimatePresence>

                    {/* Conflict warning */}
                    <AnimatePresence>
                        {hasDateConflict && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2"
                            >
                                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                <p className="text-[11px] font-medium text-red-500">
                                    Date blocked on venue calendar. Please select a different date.
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Venue calendar for hosts */}
                    {role === 'host' && formData.venueId && (
                        <div>
                            <button
                                type="button"
                                onClick={() => setShowCalendar(!showCalendar)}
                                className="flex items-center gap-1.5 text-[11px] text-indigo-500 font-bold hover:text-indigo-600 transition-colors"
                            >
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showCalendar ? 'rotate-180' : ''}`} />
                                {showCalendar ? 'Hide' : 'View'} Venue Availability
                            </button>
                            <AnimatePresence>
                                {showCalendar && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="mt-2 p-3 rounded-xl bg-[var(--bg-fill)] border border-[var(--border-subtle)]"
                                    >
                                        {isLoadingCalendar ? (
                                            <p className="text-[11px] text-[var(--text-tertiary)] text-center py-2">Loading calendar...</p>
                                        ) : venueCalendar.length === 0 ? (
                                            <p className="text-[11px] text-[var(--text-tertiary)] text-center py-2">All dates available</p>
                                        ) : (
                                            <div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {venueCalendar.slice(0, 14).map((entry: any) => (
                                                        <div key={entry.date} className={`px-2 py-1 rounded-lg text-[10px] font-medium border ${getStatusColor(entry.status)}`}>
                                                            {new Date(entry.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-[var(--border-subtle)]">
                                                    {[
                                                        { c: 'bg-green-500', l: 'Available' },
                                                        { c: 'bg-yellow-500', l: 'Tentative' },
                                                        { c: 'bg-red-500', l: 'Blocked' }
                                                    ].map(({ c, l }) => (
                                                        <div key={l} className="flex items-center gap-1">
                                                            <div className={`w-1.5 h-1.5 rounded-full ${c}`} />
                                                            <span className="text-[9px] text-[var(--text-tertiary)] uppercase tracking-wider font-bold">{l}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </div>

                {/* ─── Right: Times ─── */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Timing</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        {TIME_FIELDS.map(({ label, key, hint }) => (
                            <div key={key}>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">{label}</label>
                                    <span className={`text-[9px] uppercase tracking-widest font-bold ${hint === 'Required' ? 'text-red-400' : 'text-[var(--text-tertiary)]/50'}`}>{hint}</span>
                                </div>
                                <div className="relative">
                                    <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)] pointer-events-none" />
                                    <input
                                        type="time"
                                        value={(formData as any)[key] || ""}
                                        onChange={(e) => updateFormData({ [key]: e.target.value })}
                                        className="w-full pl-8 pr-2 py-2.5 rounded-xl bg-[var(--bg-fill)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-amber-400 transition-all"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Schedule summary */}
            <AnimatePresence>
                {(formData.startDate || (formData.startTime && formData.endTime)) && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-3 rounded-xl bg-green-500/10 border border-emerald-500/20 flex items-center gap-2.5"
                    >
                        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <div>
                            <p className="text-[13px] font-semibold text-emerald-700">
                                {formData.startDate ? formatEventDate(formData.startDate) : 'Date TBD'}
                            </p>
                            <p className="text-[11px] text-emerald-600/70">
                                {formData.doorsOpen && `Doors: ${formData.doorsOpen} · `}
                                {formData.startTime && `Start: ${formData.startTime}`}
                                {formData.endTime && ` · End: ${formData.endTime}`}
                                {formData.lastEntry && ` · Last Entry: ${formData.lastEntry}`}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
