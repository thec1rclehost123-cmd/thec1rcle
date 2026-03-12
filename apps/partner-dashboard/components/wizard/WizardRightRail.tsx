"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
    Calendar, Clock, MapPin, Tag, Users, Ticket, Wine,
    TrendingUp, Image as ImageIcon, CheckCircle2, AlertTriangle,
    Music, IndianRupee, Repeat, Lock, Globe, Link2
} from "lucide-react";
import { WizardStepV3 } from "./WizardStepNav";

const formatINR = (v: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

const formatCompact = (v: number) => {
    if (v >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)}L`;
    if (v >= 1_000) return `₹${(v / 1_000).toFixed(0)}K`;
    return formatINR(v);
};

interface RailProps {
    formData: any;
    currentStep: WizardStepV3;
    revenue: {
        gross: number;
        promoterPool: number;
        discounts: number;
        net: number;
        ticketRevenue: number;
        tableRevenue: number;
        coverRevenue: number;
    };
    capacity: {
        total: number;
        ticketAlloc: number;
        guestListAlloc: number;
        walkInAlloc: number;
        tableAlloc: number;
        staffHold: number;
        unallocated: number;
    };
}

// ─── Foundation Rail: Live event card preview ─────────────────────────────────
function FoundationRail({ formData }: { formData: any }) {
    const privacyIcon: Record<string, any> = {
        public: Globe,
        unlisted: Link2,
        invite_only: Lock,
        link_only: Link2,
    };
    const PrivacyIcon = privacyIcon[formData.privacyMode] || Globe;

    const eventTypeLabel: Record<string, string> = {
        club_night: 'Club Night',
        concert: 'Concert',
        festival: 'Festival',
        private: 'Private',
        ticketed_party: 'Ticketed Party',
        guest_list: 'Guest List',
        vip_table: 'VIP Tables',
        hybrid: 'Hybrid',
    };

    return (
        <div className="space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Guest Preview</p>

            {/* Event card preview */}
            <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-white/[0.03]">
                {/* Hero */}
                <div className="relative aspect-[16/7] bg-gradient-to-br from-white/[0.04] to-white/[0.01] flex items-center justify-center">
                    {formData.poster ? (
                        <img src={formData.poster} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <div className="flex flex-col items-center gap-2 text-white/20">
                            <ImageIcon className="w-6 h-6" />
                            <span className="text-[10px] font-medium">No image yet</span>
                        </div>
                    )}
                    {/* Event type badge */}
                    {formData.eventType && (
                        <div className="absolute top-3 left-3">
                            <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-[9px] font-bold uppercase tracking-widest text-white/70">
                                {eventTypeLabel[formData.eventType] || formData.eventType}
                            </span>
                        </div>
                    )}
                    {/* Privacy badge */}
                    <div className="absolute top-3 right-3">
                        <div className="w-6 h-6 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                            <PrivacyIcon className="w-3 h-3 text-white/60" />
                        </div>
                    </div>
                </div>

                <div className="p-4 space-y-3">
                    <div>
                        <h3 className={`font-bold leading-tight ${formData.title ? 'text-white text-[15px]' : 'text-white/20 text-sm italic'}`}>
                            {formData.title || 'Your event name'}
                        </h3>
                        {formData.subtitle && (
                            <p className="text-[11px] text-white/40 mt-0.5">{formData.subtitle}</p>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                        {formData.tickets?.length > 0 && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F44A22]/10 border border-[#F44A22]/20 text-[9px] font-bold text-[#F44A22] uppercase tracking-wider">
                                <Ticket className="w-2.5 h-2.5" />
                                Tickets from {formData.tickets[0]?.price ? formatINR(formData.tickets[0].price) : '–'}
                            </span>
                        )}
                        {formData.guestListEnabled && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                                <Users className="w-2.5 h-2.5" />
                                Guest List
                            </span>
                        )}
                        {formData.tablesEnabled && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-[9px] font-bold text-purple-400 uppercase tracking-wider">
                                <Wine className="w-2.5 h-2.5" />
                                Tables
                            </span>
                        )}
                    </div>

                    {(formData.venueName || formData.startDate) && (
                        <div className="space-y-1.5 pt-1 border-t border-white/[0.05]">
                            {formData.venueName && (
                                <div className="flex items-center gap-1.5 text-[10px] text-white/40">
                                    <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                                    {formData.venueName}
                                </div>
                            )}
                            {formData.startDate && (
                                <div className="flex items-center gap-1.5 text-[10px] text-white/40">
                                    <Calendar className="w-2.5 h-2.5 flex-shrink-0" />
                                    {new Date(formData.startDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                                    {formData.startTime && ` · ${formData.startTime}`}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tags */}
                    {formData.genres?.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                            {formData.genres.slice(0, 4).map((g: string) => (
                                <span key={g} className="px-1.5 py-0.5 rounded-md bg-white/[0.04] text-[9px] text-white/35">
                                    {g}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Schedule Rail: Timeline strip ────────────────────────────────────────────
function ScheduleRail({ formData }: { formData: any }) {
    const milestones = [
        { label: 'Doors open', time: formData.doorsOpen, color: 'bg-blue-400' },
        { label: 'Event starts', time: formData.startTime, color: 'bg-[#F44A22]' },
        { label: 'GL closes', time: formData.guestListClose, color: 'bg-emerald-400' },
        { label: 'Last entry', time: formData.lastEntry, color: 'bg-amber-400' },
        { label: 'Tickets end', time: formData.ticketSalesEnd, color: 'bg-purple-400' },
        { label: 'Event ends', time: formData.endTime, color: 'bg-white/30' },
    ].filter(m => m.time);

    const recurrenceLabels: Record<string, string> = {
        none: 'Does not repeat',
        weekly: 'Every week',
        biweekly: 'Every 2 weeks',
        monthly: 'Every month',
        custom: 'Custom pattern',
    };

    return (
        <div className="space-y-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Event Timeline</p>

            {formData.startDate ? (
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-white/50 text-[10px] font-semibold uppercase tracking-wider">Date</span>
                        <span className="text-white text-[13px] font-bold">
                            {new Date(formData.startDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </span>
                    </div>

                    {formData.isOvernight && (
                        <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <Clock className="w-3 h-3 text-amber-400" />
                            <span className="text-amber-400 text-[10px] font-semibold">Overnight event</span>
                        </div>
                    )}

                    {milestones.length > 0 && (
                        <div className="space-y-2 pt-1">
                            {milestones.map((m, i) => (
                                <div key={i} className="flex items-center gap-2.5">
                                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.color}`} />
                                    <span className="text-white/40 text-[10px] flex-1">{m.label}</span>
                                    <span className="text-white/70 text-[11px] font-mono font-semibold">{m.time}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-4 flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-white/20" />
                    <span className="text-white/25 text-[11px]">Set a date to see the timeline</span>
                </div>
            )}

            {formData.recurrence && formData.recurrence !== 'none' && (
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 flex items-center gap-2.5">
                    <Repeat className="w-3.5 h-3.5 text-[#F44A22]" />
                    <span className="text-white/60 text-[11px] font-medium">
                        {recurrenceLabels[formData.recurrence] || formData.recurrence}
                    </span>
                </div>
            )}
        </div>
    );
}

// ─── Capacity Rail: Allocation bar ────────────────────────────────────────────
function CapacityRail({ formData, capacity }: { formData: any; capacity: RailProps['capacity'] }) {
    const { total, ticketAlloc, guestListAlloc, walkInAlloc, tableAlloc, staffHold, unallocated } = capacity;
    const segments = [
        { label: 'Tickets', value: ticketAlloc, color: '#F44A22', enabled: formData.tickets?.length > 0 },
        { label: 'Guest List', value: guestListAlloc, color: '#10B981', enabled: formData.guestListEnabled },
        { label: 'Walk-in', value: walkInAlloc, color: '#3B82F6', enabled: formData.walkInEnabled },
        { label: 'Tables', value: tableAlloc, color: '#A855F7', enabled: formData.tablesEnabled },
        { label: 'Staff hold', value: staffHold, color: '#6B7280', enabled: staffHold > 0 },
    ].filter(s => s.enabled && s.value > 0);

    const overAllocated = total > 0 && (total - unallocated) > total;

    return (
        <div className="space-y-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Capacity</p>

            {total > 0 ? (
                <>
                    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-white/40 text-[10px] uppercase tracking-wider font-semibold">Total</span>
                            <span className="text-white text-[18px] font-bold tabular-nums">{total.toLocaleString('en-IN')}</span>
                        </div>

                        {/* Segmented allocation bar */}
                        <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden flex">
                            {segments.map((seg, i) => (
                                <motion.div
                                    key={i}
                                    className="h-full first:rounded-l-full last:rounded-r-full"
                                    style={{ backgroundColor: seg.color }}
                                    animate={{ width: total > 0 ? `${(seg.value / total) * 100}%` : '0%' }}
                                    transition={{ duration: 0.4, ease: 'easeOut', delay: i * 0.05 }}
                                />
                            ))}
                            {unallocated > 0 && (
                                <motion.div
                                    className="h-full rounded-r-full bg-white/[0.08]"
                                    animate={{ width: `${(unallocated / total) * 100}%` }}
                                    transition={{ duration: 0.4, ease: 'easeOut' }}
                                />
                            )}
                        </div>

                        {/* Channel breakdown */}
                        <div className="space-y-2">
                            {segments.map((seg, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
                                    <span className="text-white/40 text-[10px] flex-1">{seg.label}</span>
                                    <span className="text-white/70 text-[10px] font-semibold tabular-nums">{seg.value}</span>
                                    <span className="text-white/25 text-[9px] tabular-nums w-8 text-right">
                                        {total > 0 ? `${Math.round((seg.value / total) * 100)}%` : '–'}
                                    </span>
                                </div>
                            ))}
                            {unallocated > 0 && (
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-white/[0.08] flex-shrink-0" />
                                    <span className="text-white/25 text-[10px] flex-1 italic">Unallocated</span>
                                    <span className="text-white/30 text-[10px] tabular-nums">{unallocated}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {overAllocated && (
                        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 flex items-start gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                            <p className="text-red-400 text-[10px] font-medium leading-relaxed">
                                Allocation exceeds total capacity
                            </p>
                        </div>
                    )}
                </>
            ) : (
                <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-4 flex items-center gap-3">
                    <Users className="w-4 h-4 text-white/20" />
                    <span className="text-white/25 text-[11px]">Set capacity to see allocation</span>
                </div>
            )}
        </div>
    );
}

// ─── Revenue Rail: Financial projection ───────────────────────────────────────
function RevenueRail({ formData, revenue }: { formData: any; revenue: RailProps['revenue'] }) {
    const { gross, promoterPool, discounts, net, ticketRevenue, tableRevenue, coverRevenue } = revenue;
    const hasRevenue = gross > 0;
    const sources = [
        { label: 'Tickets', value: ticketRevenue, color: '#F44A22' },
        { label: 'Tables', value: tableRevenue, color: '#A855F7' },
        { label: 'Cover', value: coverRevenue, color: '#3B82F6' },
    ].filter(s => s.value > 0);

    return (
        <div className="space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Projected Revenue</p>

            {hasRevenue ? (
                <>
                    {/* Hero net figure */}
                    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3">
                        <div className="text-center pb-3 border-b border-white/[0.05]">
                            <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-1">Projected Gross</p>
                            <p className="text-[22px] font-bold text-white tabular-nums">{formatCompact(gross)}</p>
                        </div>

                        {/* Source bars */}
                        {sources.length > 0 && (
                            <div className="space-y-2">
                                {sources.map((src, i) => (
                                    <div key={i} className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-white/40 text-[10px]">{src.label}</span>
                                            <span className="text-white/60 text-[10px] font-semibold tabular-nums">{formatCompact(src.value)}</span>
                                        </div>
                                        <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden">
                                            <motion.div
                                                className="h-full rounded-full"
                                                style={{ backgroundColor: src.color }}
                                                animate={{ width: gross > 0 ? `${(src.value / gross) * 100}%` : '0%' }}
                                                transition={{ duration: 0.4, ease: 'easeOut' }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Deductions */}
                    {(promoterPool > 0 || discounts > 0) && (
                        <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-3 space-y-2">
                            {promoterPool > 0 && (
                                <div className="flex items-center justify-between">
                                    <span className="text-white/35 text-[10px]">Promoter payouts</span>
                                    <span className="text-amber-400/80 text-[10px] font-semibold tabular-nums">−{formatCompact(promoterPool)}</span>
                                </div>
                            )}
                            {discounts > 0 && (
                                <div className="flex items-center justify-between">
                                    <span className="text-white/35 text-[10px]">Buyer discounts</span>
                                    <span className="text-emerald-400/70 text-[10px] font-semibold tabular-nums">−{formatCompact(discounts)}</span>
                                </div>
                            )}
                            <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between">
                                <span className="text-white/60 text-[10px] font-semibold">Venue net</span>
                                <span className="text-white text-[12px] font-bold tabular-nums">{formatCompact(net)}</span>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-4 flex items-center gap-3">
                    <TrendingUp className="w-4 h-4 text-white/20" />
                    <span className="text-white/25 text-[11px]">Add tickets or tables to see projections</span>
                </div>
            )}
        </div>
    );
}

// ─── Media Rail: Preview stack ────────────────────────────────────────────────
function MediaRail({ formData }: { formData: any }) {
    return (
        <div className="space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Media Preview</p>

            {/* Hero image */}
            <div className="rounded-xl overflow-hidden border border-white/[0.08] aspect-[16/9] bg-white/[0.03] flex items-center justify-center">
                {formData.poster ? (
                    <img src={formData.poster} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="flex flex-col items-center gap-2 text-white/20">
                        <ImageIcon className="w-7 h-7" />
                        <span className="text-[10px] font-medium">Hero image</span>
                    </div>
                )}
            </div>

            {/* Lineup preview */}
            {formData.artists?.length > 0 && (
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-2">
                    <div className="flex items-center gap-2">
                        <Music className="w-3 h-3 text-white/40" />
                        <span className="text-white/40 text-[10px] uppercase font-semibold tracking-wider">Lineup</span>
                    </div>
                    <div className="space-y-1">
                        {formData.artists.slice(0, 4).map((a: any, i: number) => (
                            <div key={i} className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#F44A22]/60 flex-shrink-0" />
                                <span className="text-white/60 text-[11px] font-medium">{a.name}</span>
                                {a.role && <span className="text-white/25 text-[9px]">{a.role}</span>}
                            </div>
                        ))}
                        {formData.artists.length > 4 && (
                            <span className="text-white/25 text-[9px] pl-3.5">+{formData.artists.length - 4} more</span>
                        )}
                    </div>
                </div>
            )}

            {/* Highlights */}
            {formData.highlights?.filter(Boolean).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {formData.highlights.filter(Boolean).slice(0, 6).map((h: string, i: number) => (
                        <span key={i} className="px-2 py-1 rounded-lg bg-white/[0.05] text-white/50 text-[9px] font-medium">
                            {h}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Review Rail: Launch control ──────────────────────────────────────────────
function ReviewRail({ formData, revenue, capacity }: { formData: any; revenue: RailProps['revenue']; capacity: RailProps['capacity'] }) {
    const checks = [
        { label: 'Event name set', ok: !!formData.title },
        { label: 'Date confirmed', ok: !!formData.startDate },
        { label: 'Capacity set', ok: formData.capacity > 0 },
        { label: 'Revenue path active', ok: (formData.tickets?.length > 0 || formData.tablesEnabled || formData.walkInEnabled || formData.guestListEnabled) },
        { label: 'Media uploaded', ok: !!(formData.poster || formData.images?.length > 0) },
    ];
    const score = checks.filter(c => c.ok).length;
    const allGood = score === checks.length;

    return (
        <div className="space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Readiness</p>

            {/* Score badge */}
            <div className={`rounded-xl border p-4 text-center ${allGood ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/[0.03] border-white/[0.06]'}`}>
                <p className={`text-[28px] font-bold tabular-nums ${allGood ? 'text-emerald-400' : 'text-white'}`}>
                    {score}<span className="text-[14px] text-white/30">/{checks.length}</span>
                </p>
                <p className={`text-[10px] font-semibold uppercase tracking-wider mt-1 ${allGood ? 'text-emerald-400' : 'text-white/40'}`}>
                    {allGood ? 'Launch Ready' : 'Items to review'}
                </p>
            </div>

            {/* Checklist */}
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-3 space-y-2">
                {checks.map((c, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${c.ok ? 'bg-emerald-500/15' : 'bg-white/[0.05]'}`}>
                            {c.ok ? (
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                            ) : (
                                <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                            )}
                        </div>
                        <span className={`text-[10px] font-medium ${c.ok ? 'text-white/50' : 'text-white/35'}`}>
                            {c.label}
                        </span>
                    </div>
                ))}
            </div>

            {/* Revenue summary */}
            {revenue.gross > 0 && (
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-1.5">
                    <div className="flex justify-between items-center">
                        <span className="text-white/35 text-[10px]">Gross</span>
                        <span className="text-white/60 text-[10px] font-semibold tabular-nums">{formatCompact(revenue.gross)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-white/35 text-[10px]">Venue net</span>
                        <span className="text-white text-[11px] font-bold tabular-nums">{formatCompact(revenue.net)}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Right Rail ──────────────────────────────────────────────────────────
export function WizardRightRail({ formData, currentStep, revenue, capacity }: RailProps) {
    return (
        <div className="h-full">
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                    {currentStep === 'foundation' && <FoundationRail formData={formData} />}
                    {currentStep === 'schedule' && <ScheduleRail formData={formData} />}
                    {currentStep === 'capacity' && <CapacityRail formData={formData} capacity={capacity} />}
                    {currentStep === 'revenue' && <RevenueRail formData={formData} revenue={revenue} />}
                    {currentStep === 'media' && <MediaRail formData={formData} />}
                    {currentStep === 'review' && <ReviewRail formData={formData} revenue={revenue} capacity={capacity} />}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
