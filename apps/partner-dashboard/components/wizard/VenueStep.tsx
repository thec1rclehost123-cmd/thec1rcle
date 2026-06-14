"use client";

import { useState, useEffect, useCallback } from "react";
import { Building2, Check, MapPin, Calendar, Clock, AlertCircle, ChevronDown } from "lucide-react";
import { toISODateIST, parseAsIST } from "@c1rcle/core/time";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

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
  validationErrors,
}: VenueStepProps) {
  const { user } = useDashboardAuth();
  const [calendar, setCalendar] = useState<any[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);

  // Helper for authenticated API calls
  const authedFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      if (!user) {
        console.error("[VenueStep] authedFetch called without user");
        throw new Error("Not authenticated");
      }
      // Force refresh token to ensure it's valid
      const token = await user.getIdToken(true);
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        },
      });
    },
    [user],
  );

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
      const res = await authedFetch(
        `/api/venues/${venueId}/calendar?startDate=${startDate}&endDate=${endDate}&hostId=${hostId}`,
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
    const calendarDay = calendar.find((d) => d.date === date);
    if (calendarDay?.myRequest) {
      const status = calendarDay.myRequest.status;
      if (status === "pending") return "tentative";
      if (status === "approved") return "approved_hold";
    }
    return calendarDay?.status || "available";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-[var(--state-success-bg)] text-[var(--state-success)] border-[var(--state-success)]/20";
      case "blocked":
        return "bg-[var(--state-error-bg)] text-[var(--state-error)] border-[var(--state-error)]/20";
      case "booked":
        return "bg-[var(--surface-tertiary)] text-[var(--text-tertiary)] border-[var(--border-subtle)]";
      case "partial":
        return "bg-[var(--state-warning-bg)] text-[var(--state-warning)] border-[var(--state-warning)]/20";
      case "tentative":
        return "bg-[var(--state-warning-bg)] text-[var(--state-warning)] border-[var(--state-warning)]/40 ring-2 ring-[var(--state-warning)]/10";
      case "approved_hold":
        return "bg-indigo-500/10 text-indigo-500 border-indigo-500/30 font-bold shadow-sm";
      default:
        return "bg-[var(--surface-secondary)] text-[var(--text-primary)]";
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
          venue: venueName,
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
          <p className="text-label mt-1.5">
            Your primary managed facility is pre-selected for this instance.
          </p>
        </div>

        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 rounded-[2.5rem] blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
          <div className="card-elevated p-10 flex items-center gap-6 relative">
            <div className="w-16 h-16 rounded-[1.25rem] surface-secondary flex items-center justify-center text-primary border border-default shadow-sm group-hover:scale-105 transition-transform duration-500">
              <Building2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
                Active Identity
              </p>
              <p className="text-display-xs text-[var(--text-primary)]">
                {profile?.activeMembership?.partnerName || "Your Venue"}
              </p>
              <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
                <MapPin className="w-3.5 h-3.5" />
                <span className="text-body-sm">
                  {profile?.activeMembership?.city || "Primary Facility"}
                </span>
              </div>
            </div>
            <div className="ml-auto">
              <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center shadow-2xl shadow-emerald-500/20 ring-8 ring-emerald-500/5">
                <Check className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-[2rem] bg-[var(--state-success-bg)] border border-[var(--state-success)]/20 flex items-center gap-4">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-body-sm text-[var(--text-primary)] leading-relaxed">
            <span className="font-bold text-emerald-500">Direct Authority:</span> As a venue
            operator, you are authorized for immediate publication. No external synchronization
            required.
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
        <p className="text-label mt-1.5">
          Establish the spatial and temporal parameters for your event.
        </p>
      </div>

      {/* Error States */}
      {validationErrors.venueId && (
        <div className="p-5 rounded-2xl bg-[var(--state-error-bg)] border border-[var(--state-error)]/20 flex items-center gap-3 shadow-sm border-l-4 border-l-rose-500">
          <AlertCircle className="w-5 h-5 text-[var(--state-error)]" />
          <p className="text-body-sm text-[var(--state-error)] font-bold">
            {validationErrors.venueId}
          </p>
        </div>
      )}

      {/* Venue Selection Matrix */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <p className="text-label font-black uppercase tracking-widest text-[var(--text-secondary)]">
            Select Partner Facility
          </p>
          {partnerships.length > 0 && (
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">
              {partnerships.length} Active Node{partnerships.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {partnerships.length === 0 ? (
          <div className="p-12 rounded-[3rem] bg-[var(--surface-secondary)] border border-dashed border-[var(--border-strong)] text-center space-y-6">
            <div className="w-20 h-20 rounded-[2.5rem] bg-[var(--surface-base)] flex items-center justify-center border border-[var(--border-subtle)] mx-auto shadow-xl">
              <Building2 className="w-10 h-10 text-[var(--text-tertiary)]/30" />
            </div>
            <div className="space-y-2">
              <h3 className="text-headline-sm text-[var(--text-primary)]">
                No Active Partnerships
              </h3>
              <p className="text-body-sm text-[var(--text-tertiary)] max-w-sm mx-auto uppercase tracking-wide">
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
            <div
              className={`absolute inset-0 bg-indigo-500/5 rounded-[2rem] blur-xl transition-opacity duration-500 ${formData.venueId ? "opacity-100" : "opacity-0"}`}
            />
            <div className="relative">
              <select
                value={formData.venueId || ""}
                onChange={(e) => {
                  const venue = partnerships.find((p) => p.venueId === e.target.value);
                  if (venue) handleVenueSelect(venue);
                }}
                className="input h-16 pl-14 pr-12 text-[15px] font-bold appearance-none cursor-pointer bg-[var(--surface-base)] border-[var(--border-subtle)] shadow-sm focus:shadow-indigo-500/20 rounded-[1.5rem]"
              >
                <option value="" disabled>
                  Search network or select facility...
                </option>
                {partnerships.map((p) => (
                  <option key={p.venueId} value={p.venueId}>
                    {p.venueName} — {p.city || "Primary Node"}
                  </option>
                ))}
              </select>
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none transition-colors group-focus-within:text-indigo-500">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-tertiary)]">
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
              <p className="text-label font-black uppercase tracking-widest text-[var(--text-secondary)]">
                Temporal Availability
              </p>
              <div className="flex flex-wrap items-center gap-4 bg-[var(--surface-secondary)] px-5 py-2 rounded-xl border border-[var(--border-subtle)]">
                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />{" "}
                  Open
                </div>
                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.5)]" />{" "}
                  Pending
                </div>
                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_5px_rgba(99,102,241,0.5)]" />{" "}
                  Reserved
                </div>
                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--border-strong)]" /> Blocked
                </div>
              </div>
            </div>

            {loadingCalendar ? (
              <div className="p-16 rounded-[2.5rem] bg-[var(--surface-secondary)] border border-[var(--border-subtle)] text-center">
                <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4 animate-spin" />
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                  Syncing Facility Data...
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
                {calendar.slice(0, 28).map((day) => {
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
                                                ${
                                                  isSelected
                                                    ? "bg-[#4f46e5] text-white shadow-xl shadow-indigo-200 scale-105 z-10"
                                                    : `${statusClass} border hover:scale-105 active:scale-95`
                                                }
                                                ${isDisabled ? "cursor-not-allowed opacity-40 grayscale-[0.5]" : ""}
                                            `}
                    >
                      <span
                        className={`text-[9px] font-black uppercase tracking-widest ${isSelected ? "text-white/70" : "text-[var(--text-tertiary)]"}`}
                      >
                        {date.toLocaleDateString("en-US", { weekday: "short" })}
                      </span>
                      <span
                        className={`text-lg font-black ${isSelected ? "text-white" : "text-[var(--text-primary)]"}`}
                      >
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
                className="relative overflow-hidden group rounded-[2.5rem]"
              >
                <div className="absolute inset-0 bg-indigo-600 shadow-2xl shadow-indigo-500/20" />
                <div className="relative p-8 flex flex-col md:flex-row md:items-center gap-8">
                  <div className="w-16 h-16 rounded-3xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white ring-1 ring-white/20">
                    <Calendar className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-200">
                      Selected Temporal Window
                    </p>
                    <p className="text-headline-sm text-white">
                      {new Date(formData.startDate).toLocaleDateString("en-IN", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
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
            <div className="p-5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 flex-shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-body-sm text-[var(--text-primary)] font-bold uppercase tracking-wider">
                  Intersystem Synchronization Required
                </p>
                <p className="text-[11px] text-[var(--text-tertiary)] leading-relaxed font-medium">
                  Your request will trigger an external hold logic at {formData.venueName}.
                  Visibility and final confirmation are contingent on manual administrative
                  approval.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
