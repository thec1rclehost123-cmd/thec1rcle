"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
    ChevronLeft,
    ChevronRight,
    CalendarDays,
    Building2,
    Lock,
    Clock,
    CheckCircle2,
    CircleDot,
    Plus,
    MapPin,
    Zap,
    Info,
    ArrowRight,
    X,
    CalendarCheck,
    AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { parseAsIST, toISODateIST } from "@c1rcle/core/time";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { ErrorState } from "@/components/ui/ErrorState";

// ─── Slot state types ─────────────────────────────────────────────────────────

type SlotState = "open" | "pending_mine" | "approved_mine" | "occupied_other" | "blocked" | "unavailable";

interface CalendarSlot {
    date: string;       // ISO YYYY-MM-DD
    startTime?: string; // HH:MM
    endTime?: string;
    state: SlotState;
    eventTitle?: string;
    eventId?: string;
    eventLifecycle?: string;
    venueName?: string;
    slotId?: string;
}

interface VenueOption {
    id: string;
    name: string;
    city: string;
    partnershipStatus: "active" | "pending" | "none";
}

// ─── Legend config ────────────────────────────────────────────────────────────

const SLOT_CONFIG: Record<SlotState, { label: string; color: string; bgClass: string; borderClass: string; textClass: string; icon: React.ComponentType<{ className?: string }> }> = {
    open: { label: "Available", color: "var(--v-orange)", bgClass: "bg-[var(--v-orange)]/10", borderClass: "border-[var(--v-orange)]/30", textClass: "text-[var(--v-orange)]", icon: Plus },
    pending_mine: { label: "Requested", color: "#F59E0B", bgClass: "bg-amber-500/10", borderClass: "border-amber-500/30", textClass: "text-amber-400", icon: Clock },
    approved_mine: { label: "Confirmed", color: "var(--v-success)", bgClass: "bg-[var(--v-success)]/10", borderClass: "border-[var(--v-success)]/30", textClass: "text-[var(--v-success)]", icon: CheckCircle2 },
    occupied_other: { label: "Occupied", color: "var(--v-text-muted)", bgClass: "bg-surface-secondary", borderClass: "border-border-default", textClass: "text-text-tertiary", icon: CircleDot },
    blocked: { label: "Venue Blocked", color: "var(--v-error)", bgClass: "bg-[var(--v-error)]/10", borderClass: "border-[var(--v-error)]/20", textClass: "text-[var(--v-error)]", icon: Lock },
    unavailable: { label: "Off-Grid", color: "#1E293B", bgClass: "bg-surface-secondary", borderClass: "border-border-subtle", textClass: "text-text-tertiary", icon: X },
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ─── Slot detail panel ────────────────────────────────────────────────────────

function SlotDetailPanel({
    slot,
    venueName,
    onClose,
    onCreateEvent,
}: {
    slot: CalendarSlot;
    venueName: string;
    onClose: () => void;
    onCreateEvent: (slot: CalendarSlot) => void;
}) {
    const cfg = SLOT_CONFIG[slot.state];
    const Icon = cfg.icon;
    const dateLabel = new Date(slot.date + "T12:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full lg:w-96 rounded-[32px] bg-[var(--v-card)] border border-[var(--v-border)] overflow-hidden flex flex-col shadow-2xl"
        >
            <div className="p-8 border-b border-[var(--v-border)]">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-[12px] font-black uppercase tracking-widest border mb-4 ${cfg.bgClass} ${cfg.borderClass} ${cfg.textClass}`}>
                            <Icon className="w-3.5 h-3.5" />
                            {cfg.label}
                        </div>
                        <h3 className="text-[20px] font-black text-text-primary leading-tight">{dateLabel}</h3>
                        {slot.startTime && (
                            <p className="text-[14px] text-[var(--v-text-tertiary)] font-bold mt-1 uppercase tracking-tight">
                                Slot: {slot.startTime}{slot.endTime ? ` – ${slot.endTime}` : ""}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2.5 rounded-xl bg-[var(--v-elevated)] hover:bg-[var(--v-canvas)] transition-all text-[var(--v-text-muted)] hover:text-text-primary">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="p-8 flex-1 space-y-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--v-elevated)] flex items-center justify-center shrink-0 border border-[var(--v-border)]">
                        <Building2 className="w-6 h-6 text-[var(--v-orange)]" />
                    </div>
                    <div>
                        <p className="text-[12px] font-bold text-[var(--v-text-tertiary)] uppercase tracking-widest mb-0.5">Production Venue</p>
                        <p className="text-[16px] font-black text-text-primary">{venueName}</p>
                    </div>
                </div>

                {(slot.state === "approved_mine" || slot.state === "pending_mine") && slot.eventTitle && (
                    <div className="p-6 rounded-2xl bg-[var(--v-elevated)] border border-[var(--v-border)]">
                        <p className="text-[12px] font-bold uppercase tracking-widest text-[var(--v-text-tertiary)] mb-3">Linked Production</p>
                        <p className="text-[18px] font-bold text-text-primary leading-tight">{slot.eventTitle}</p>
                        {slot.eventLifecycle && (
                            <p className="text-[13px] mt-2 font-black uppercase tracking-widest" style={{ color: cfg.color }}>{slot.eventLifecycle.replace("_", " ")}</p>
                        )}
                    </div>
                )}

                {slot.state === "occupied_other" && (
                    <div className="p-6 rounded-2xl bg-[var(--v-elevated)] border border-[var(--v-border)]">
                        <div className="flex items-center gap-3 text-[var(--v-text-muted)]">
                            <Info className="w-5 h-5" />
                            <p className="text-[14px] font-medium leading-relaxed">This production slot is already secured by another host. Details are restricted.</p>
                        </div>
                    </div>
                )}

                {slot.state === "blocked" && (
                    <div className="p-6 rounded-2xl bg-[var(--v-error)]/5 border border-[var(--v-error)]/20">
                        <div className="flex items-center gap-3 text-[var(--v-error)]">
                            <Lock className="w-5 h-5" />
                            <p className="text-[14px] font-bold">Venue Restricted</p>
                        </div>
                        <p className="text-[13px] text-[var(--v-text-tertiary)] mt-2">The venue has manually locked this date for internal logistics or private bookings.</p>
                    </div>
                )}

                {slot.state === "open" && (
                    <div className="p-6 rounded-2xl bg-[var(--v-orange)]/5 border border-[var(--v-orange)]/10">
                        <div className="flex items-center gap-3 text-[var(--v-orange)] mb-3">
                            <Zap className="w-5 h-5" />
                            <p className="text-[14px] font-black uppercase tracking-widest">Growth Opportunity</p>
                        </div>
                        <p className="text-[14px] text-[var(--v-text-tertiary)] font-medium leading-relaxed">
                            Initialize a production request for this slot. Approval history and impact score will be verified by the venue.
                        </p>
                    </div>
                )}
            </div>

            <div className="p-8 border-t border-[var(--v-border)]">
                {slot.state === "open" && (
                    <VenueActionButton 
                        variant="primary" 
                        onClick={() => onCreateEvent(slot)}
                        className="w-full h-14 text-[14px]"
                    >
                        Initialize Production Request
                    </VenueActionButton>
                )}
                {(slot.state === "approved_mine" || slot.state === "pending_mine") && slot.eventId && (
                    <Link href={`/host/events/${slot.eventId}`} className="block">
                        <VenueActionButton variant="secondary" className="w-full h-14 text-[14px]">
                            Manage Production <ArrowRight className="ml-2 w-4 h-4" />
                        </VenueActionButton>
                    </Link>
                )}
            </div>
        </motion.div>
    );
}

// ─── Calendar day cell ─────────────────────────────────────────────────────────

function DayCell({
    day,
    slots,
    isToday,
    isPast,
    isSelected,
    onClick,
}: {
    day: number;
    slots: CalendarSlot[];
    isToday: boolean;
    isPast: boolean;
    isSelected: boolean;
    onClick: () => void;
}) {
    const hasOpen = slots.some(s => s.state === "open");
    const hasApproved = slots.some(s => s.state === "approved_mine");
    const hasPending = slots.some(s => s.state === "pending_mine");
    const hasOccupied = slots.some(s => s.state === "occupied_other");
    const hasBlocked = slots.some(s => s.state === "blocked");

    return (
        <button
            onClick={onClick}
            disabled={isPast && !slots.length}
            className={`relative min-h-[100px] p-4 rounded-2xl border text-left transition-all group ${isSelected
                ? "bg-[var(--v-elevated)] border-[var(--v-orange)] ring-1 ring-[var(--v-orange)]/20"
                : isPast
                    ? "bg-transparent border-border-subtle opacity-30 cursor-default"
                    : hasOpen
                        ? "bg-[var(--v-card)] border-[var(--v-orange)]/20 hover:border-[var(--v-orange)]/40 cursor-pointer"
                        : "bg-[var(--v-card)] border-[var(--v-border)] hover:bg-[var(--v-elevated)] cursor-pointer"
            }`}
        >
            <div className={`text-[16px] font-black mb-3 ${isToday ? "inline-flex w-8 h-8 rounded-full bg-[var(--v-orange)] text-white items-center justify-center -ml-1 -mt-1" : isPast ? "text-text-tertiary" : "text-text-primary"}`}>
                {day}
            </div>

            <div className="flex flex-wrap gap-1.5">
                {hasApproved && <div className="w-2.5 h-2.5 rounded-full bg-[var(--v-success)]" title="Confirmed Production" />}
                {hasPending && <div className="w-2.5 h-2.5 rounded-full bg-amber-400" title="Request Pending" />}
                {hasOpen && <div className="w-2.5 h-2.5 rounded-full bg-[var(--v-orange)] ring-1 ring-[var(--v-orange)]/40" title="Open Slot" />}
                {hasOccupied && <div className="w-2.5 h-2.5 rounded-full bg-surface-elevated" />}
                {hasBlocked && <div className="w-2.5 h-2.5 rounded-full bg-[var(--v-error)]/40" title="Blocked" />}
            </div>

            {hasOpen && !isPast && (
                <div className="absolute bottom-4 right-4 text-[var(--v-orange)] opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">
                    <Plus className="w-5 h-5" />
                </div>
            )}
        </button>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function HostCalendarPage() {
    const { user, profile, getIdToken } = useDashboardAuth() as any;
    const hostId = profile?.activeMembership?.partnerId;

    const [currentDate, setCurrentDate] = useState(parseAsIST(null));
    const [selectedSlot, setSelectedSlot] = useState<CalendarSlot | null>(null);
    const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
    const [venues, setVenues] = useState<VenueOption[]>([]);
    const [slotsMap, setSlotsMap] = useState<Record<string, CalendarSlot[]>>({});
    const [loading, setLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [showLegend, setShowLegend] = useState(true);

    const year = parseInt(currentDate.toLocaleString("en-US", { year: "numeric", timeZone: "Asia/Kolkata" }));
    const month = parseInt(currentDate.toLocaleString("en-US", { month: "numeric", timeZone: "Asia/Kolkata" })) - 1;

    const fetchVenues = useCallback(async () => {
        if (!hostId) return;
        try {
            const token = typeof getIdToken === "function" ? await getIdToken() : "";
            const res = await fetch(`/api/venue/partnerships?hostId=${hostId}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (res.ok) {
                const d = await res.json();
                const allPartners = d.partnerships || d.partners || [];
                const activeVenues: VenueOption[] = allPartners
                    .filter((p: any) => p.status === "active" || p.partnershipStatus === "active")
                    .map((p: any) => ({
                        id: p.venueId || p.id,
                        name: p.name || p.venueName || "Venue",
                        city: p.city || "",
                        partnershipStatus: "active" as const,
                    }));
                setVenues(activeVenues);
                if (activeVenues.length > 0 && !selectedVenueId) {
                    setSelectedVenueId(activeVenues[0].id);
                }
            }
        } catch { /* */ }
    }, [hostId, getIdToken, selectedVenueId]);

    const fetchCalendar = useCallback(async () => {
        if (!hostId || !selectedVenueId) { setLoading(false); return; }
        setLoading(true);
        setIsError(false);
        try {
            const token = typeof getIdToken === "function" ? await getIdToken() : "";
            const startStr = `${year}-${String(month + 1).padStart(2, "0")}-01`;
            const lastDay = new Date(year, month + 1, 0).getDate();
            const endStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

            const res = await fetch(
                `/api/host/venue-calendar?hostId=${hostId}&venueId=${selectedVenueId}&startDate=${startStr}&endDate=${endStr}`,
                { headers: token ? { Authorization: `Bearer ${token}` } : {} }
            );

            if (res.ok) {
                const d = await res.json();
                const raw: any[] = d.slots || d.calendar || [];
                const map: Record<string, CalendarSlot[]> = {};

                raw.forEach((item: any) => {
                    const dateKey: string = item.date || item.slotDate || "";
                    if (!dateKey) return;
                    if (!map[dateKey]) map[dateKey] = [];

                    let state: SlotState = "open";
                    if (item.state) {
                        state = item.state as SlotState;
                    } else if (item.isBlocked || item.blocked) {
                        state = "blocked";
                    } else if (!item.isAvailable && item.hostId && item.hostId === hostId) {
                        state = item.status === "approved" || item.lifecycle === "approved" ? "approved_mine" : "pending_mine";
                    } else if (!item.isAvailable) {
                        state = "occupied_other";
                    } else {
                        state = "open";
                    }

                    map[dateKey].push({
                        date: dateKey,
                        startTime: item.startTime,
                        endTime: item.endTime,
                        state,
                        eventTitle: item.eventTitle || item.title,
                        eventId: item.eventId || item.id,
                        eventLifecycle: item.lifecycle || item.status,
                        venueName: item.venueName,
                        slotId: item.slotId || item.id,
                    });
                });
                setSlotsMap(map);
            }
        } catch { setIsError(true); }
        finally { setLoading(false); }
    }, [hostId, selectedVenueId, year, month, getIdToken]);

    useEffect(() => { fetchVenues(); }, [fetchVenues]);
    useEffect(() => { fetchCalendar(); }, [fetchCalendar]);

    const handleCreateEvent = (slot: CalendarSlot) => {
        const params = new URLSearchParams({
            venueId: selectedVenueId || "",
            slotId: slot.slotId || "",
            date: slot.date,
            ...(slot.startTime ? { startTime: slot.startTime } : {}),
            ...(slot.endTime ? { endTime: slot.endTime } : {}),
        });
        window.location.href = `/host/create?${params.toString()}`;
    };

    const navigate = (dir: -1 | 1) => {
        setCurrentDate(prev => {
            const d = new Date(prev);
            d.setMonth(d.getMonth() + dir);
            return d;
        });
        setSelectedSlot(null);
    };

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayIST = toISODateIST(new Date());

    const selectedVenue = venues.find(v => v.id === selectedVenueId);

    const monthStats = useMemo(() => {
        let open = 0, mine = 0;
        Object.values(slotsMap).flat().forEach(s => {
            if (s.state === "open") open++;
            if (s.state === "approved_mine" || s.state === "pending_mine") mine++;
        });
        return { open, mine };
    }, [slotsMap]);

    return (
        <VenuePageShell
            title="Slot Engine"
            subtitle="Claim verified production windows across the C1RCLE network."
            actions={
                <div className="flex items-center gap-3">
                    <VenueActionButton variant="secondary" onClick={() => setShowLegend(!showLegend)}>
                        <Info className="w-4 h-4" /> Legend
                    </VenueActionButton>
                    <Link href="/host/network">
                        <VenueActionButton variant="primary">
                            <Building2 className="w-4 h-4 mr-2" /> Partner Network
                        </VenueActionButton>
                    </Link>
                </div>
            }
        >
            <div className="space-y-8 animate-in fade-in duration-500">
                {isError && (
                    <ErrorState
                        title="Failed to load calendar"
                        message="We couldn't fetch your venue slots. Check your connection and try again."
                        onRetry={fetchCalendar}
                    />
                )}
                {/* Legend panel */}
                <AnimatePresence>
                    {showLegend && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                            <div className="flex flex-wrap gap-6 p-6 rounded-3xl bg-[var(--v-card)] border border-[var(--v-border)]">
                                {Object.entries(SLOT_CONFIG).map(([state, cfg]) => {
                                    const Icon = cfg.icon;
                                    return (
                                        <div key={state} className="flex items-center gap-2.5">
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${cfg.bgClass} border ${cfg.borderClass}`}>
                                                <Icon className={`w-4 h-4 ${cfg.textClass}`} />
                                            </div>
                                            <span className="text-[13px] font-bold text-[var(--v-text-tertiary)] uppercase tracking-widest">{cfg.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {venues.length === 0 ? (
                    <div className="py-24 rounded-[40px] bg-[var(--v-card)] border border-dashed border-[var(--v-border)] flex flex-col items-center text-center px-10">
                        <Building2 className="w-16 h-16 text-[var(--v-text-muted)] mb-8" />
                        <h3 className="text-3xl font-black text-text-primary mb-4">Zero Active Partnerships</h3>
                        <p className="text-[16px] text-[var(--v-text-tertiary)] mb-10 max-w-sm leading-relaxed">
                            You need verified venue partnerships to access their production windows. Request access via the network portal.
                        </p>
                        <Link href="/host/events">
                            <VenueActionButton variant="primary" className="h-14 px-10">
                                Expand Network Portfolio
                            </VenueActionButton>
                        </Link>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
                            {venues.map(v => (
                                <button
                                    key={v.id}
                                    onClick={() => { setSelectedVenueId(v.id); setSelectedSlot(null); }}
                                    className={`flex items-center gap-3 px-6 py-3.5 rounded-2xl text-[13px] font-black tracking-widest uppercase transition-all border ${selectedVenueId === v.id
                                        ? "bg-[var(--v-elevated)] border-[var(--v-orange)] text-text-primary shadow-lg"
                                        : "bg-[var(--v-card)] border-[var(--v-border)] text-[var(--v-text-tertiary)] hover:border-border-default"
                                    }`}
                                >
                                    <Building2 className="w-4 h-4" />
                                    {v.name}
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-6">
                                        <h2 className="text-[28px] font-black text-text-primary tracking-tighter">{MONTHS[month]} {year}</h2>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => navigate(-1)} className="w-12 h-12 rounded-2xl bg-[var(--v-card)] border border-[var(--v-border)] flex items-center justify-center hover:bg-[var(--v-elevated)] transition-all">
                                                <ChevronLeft className="w-6 h-6" />
                                            </button>
                                            <button onClick={() => navigate(1)} className="w-12 h-12 rounded-2xl bg-[var(--v-card)] border border-[var(--v-border)] flex items-center justify-center hover:bg-[var(--v-elevated)] transition-all">
                                                <ChevronRight className="w-6 h-6" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="px-5 py-2 rounded-2xl bg-[var(--v-orange)]/10 border border-[var(--v-orange)]/20 text-[var(--v-orange)] font-black text-[13px] uppercase tracking-widest">
                                            {monthStats.open} Open Spots
                                        </div>
                                    </div>
                                </div>

                                <div className="p-8 rounded-[40px] bg-[var(--v-card)] border border-[var(--v-border)]">
                                    <div className="grid grid-cols-7 gap-3 mb-6">
                                        {DAYS.map(d => (
                                            <div key={d} className="text-center text-[13px] font-black uppercase tracking-widest text-[var(--v-text-muted)]">{d}</div>
                                        ))}
                                    </div>

                                    {loading ? (
                                        <div className="grid grid-cols-7 gap-3">
                                            {Array.from({ length: 31 }).map((_, i) => (
                                                <div key={i} className="h-24 rounded-2xl animate-pulse bg-[var(--v-elevated)]" />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-7 gap-3">
                                            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                                                <div key={`empty-${i}`} className="h-24" />
                                            ))}
                                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                                const day = i + 1;
                                                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                                                const daySlots = slotsMap[dateStr] || [];
                                                const isToday = dateStr === todayIST;
                                                const isPast = dateStr < todayIST;
                                                const isSelected = selectedSlot?.date === dateStr;

                                                return (
                                                    <DayCell
                                                        key={day}
                                                        day={day}
                                                        slots={daySlots}
                                                        isToday={isToday}
                                                        isPast={isPast}
                                                        isSelected={isSelected}
                                                        onClick={() => {
                                                            if (daySlots.length > 0) {
                                                                const prioritized = [...daySlots].sort((a, b) => {
                                                                    const order: SlotState[] = ["open", "approved_mine", "pending_mine", "occupied_other", "blocked", "unavailable"];
                                                                    return order.indexOf(a.state) - order.indexOf(b.state);
                                                                });
                                                                setSelectedSlot(prioritized[0]);
                                                            } else if (!isPast) {
                                                                setSelectedSlot({ date: dateStr, state: "open" });
                                                            }
                                                        }}
                                                    />
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="relative">
                                <AnimatePresence mode="wait">
                                    {selectedSlot ? (
                                        <div className="sticky top-8">
                                            <SlotDetailPanel
                                                slot={selectedSlot}
                                                venueName={selectedVenue?.name || "Venue"}
                                                onClose={() => setSelectedSlot(null)}
                                                onCreateEvent={handleCreateEvent}
                                            />
                                        </div>
                                    ) : (
                                        <div className="h-full min-h-[400px] border-2 border-dashed border-[var(--v-border)] rounded-[40px] flex flex-col items-center justify-center p-10 text-center text-[var(--v-text-muted)]">
                                            <CalendarDays className="w-12 h-12 mb-4 opacity-20" />
                                            <p className="text-[16px] font-bold">Select a date to audit production availability</p>
                                        </div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </VenuePageShell>
    );
}
