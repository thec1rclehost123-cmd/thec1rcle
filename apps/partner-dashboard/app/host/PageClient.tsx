"use client";


import {
    CalendarDays,
    TrendingUp,
    Zap,
    Users,
    Network,
    CheckCircle2,
    Clock,
    ArrowRight,
    Star,
    Banknote,
    MapPin,
    ChevronRight,
    Sparkles,
    UserCircle,
    Building2,
    Handshake,
    Radio,
    Bell,
    Plus,
    BarChart3,
} from "lucide-react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { useHostOverviewSummary } from "@/lib/hooks/useHostQueries";
import { formatINRCompact } from "@/lib/finance/definitions";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { KPIBento } from "@/components/ui/BentoCard";
import { cn } from "@/lib/utils";

// ─── Types and Formatters ────────────────────────────────────────────────────────

interface OverviewSummary {
    pendingEventApprovals: number;
    pendingSlotRequests: number;
    activeVenuePartnerships: number;
    activePromoterPartnerships: number;
    upcomingEvents: UpcomingEvent[];
    recentEarnings: number;
    totalTicketsSold: number;
    hostScore: number;
    verificationStatus: "verified" | "pending" | "unverified";
    profileCompletionPct: number;
}

interface UpcomingEvent {
    id: string;
    title: string;
    venueName: string;
    startDate: string;
    lifecycle: string;
    coverImage?: string;
    ticketsSold?: number;
    revenue?: number;
}

function formatDate(dateStr: string): string {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

const LIFECYCLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    published: { label: "Live", color: "var(--v-success)", bg: "var(--v-success-bg)" },
    live: { label: "Live", color: "var(--v-success)", bg: "var(--v-success-bg)" },
    pending: { label: "Pending", color: "var(--v-warning)", bg: "var(--v-warning-bg)" },
    draft: { label: "Draft", color: "var(--v-text-tertiary)", bg: "var(--v-neutral-bg)" },
    completed: { label: "Done", color: "var(--v-text-secondary)", bg: "var(--v-neutral-bg)" },
    cancelled: { label: "Cancelled", color: "var(--v-error)", bg: "var(--v-error-bg)" },
    scheduled: { label: "Scheduled", color: "var(--v-info)", bg: "var(--v-info-bg)" },
    approved:  { label: "Approved", color: "var(--v-info)", bg: "var(--v-info-bg)" },
};

// ─── Main Component ────────────────────────────────────────────────────────────

export default function HostOverviewPage() {
    const { profile } = useDashboardAuth() as any;
    const hostId = profile?.activeMembership?.partnerId;
    const displayName = profile?.displayName || "Host";
    const shouldReduceMotion = useReducedMotion();

    const { data: rawData, isLoading: loading } = useHostOverviewSummary(hostId);
    const summary: OverviewSummary | null = rawData ? (rawData.summary || rawData) : null;

    const mp = (delay: number) =>
        shouldReduceMotion
            ? {}
            : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1], delay } };

    return (
        <VenuePageShell
            title="Overview"
            subtitle={`Welcome back to production, ${displayName.split(' ')[0]}`}
            actions={
                <div className="flex items-center gap-3">
                    <VenueActionButton variant="secondary">
                        <Bell className="w-5 h-5" />
                        <span className="hidden sm:inline ml-2">Inbox</span>
                    </VenueActionButton>
                    <Link href="/host/calendar">
                        <VenueActionButton variant="primary">
                            <Plus className="w-5 h-5 mr-2" />
                            Secure Slot
                        </VenueActionButton>
                    </Link>
                </div>
            }
        >
            <div className="flex flex-col gap-6">
                {/* Row 1: Identity & Earnings */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Identity Card */}
                    <div className="rounded-[40px] bg-[var(--v-card)] border border-[var(--v-border)] p-10 sm:p-12 flex flex-col justify-between min-h-[220px] relative overflow-hidden lg:col-span-2">
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-6">
                                <span className="text-[13px] font-black uppercase tracking-[0.2em] text-[var(--v-text-tertiary)]">Host Identity</span>
                                <div className="h-px flex-1 bg-[var(--v-border)] opacity-30" />
                            </div>
                            <div className="flex items-center gap-8">
                                <div className="w-20 h-20 rounded-[24px] bg-gradient-to-br from-[var(--v-orange)] to-red-600 flex items-center justify-center text-white text-3xl font-black shadow-2xl shrink-0 border-4 border-white/10">
                                    {profile?.photoURL ? (
                                        <img src={profile.photoURL} alt="" className="w-full h-full rounded-[20px] object-cover" />
                                    ) : (
                                        displayName[0]
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-4xl font-black tracking-tighter text-text-primary">
                                        {displayName}
                                    </h2>
                                    <p className="text-[16px] font-bold mt-2 text-[var(--v-text-tertiary)]">
                                        {summary?.verificationStatus === "verified" ? "Verified C1RCLE Production Partner" : "Verification Processing"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between relative z-10 mt-10">
                            <Link href="/host/profile">
                                <VenueActionButton variant="secondary" className="h-11 px-6 text-[13px]">
                                    Audit Identity
                                </VenueActionButton>
                            </Link>
                            
                            {summary?.hostScore !== undefined && summary.hostScore > 0 && (
                                <div className="flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-surface-tertiary border border-border-default backdrop-blur-md">
                                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                                    <span className="text-[16px] font-black tabular-nums">{summary.hostScore.toFixed(1)}</span>
                                    <span className="text-[12px] font-black text-text-tertiary ml-1 uppercase">Rating</span>
                                </div>
                            )}
                        </div>
                        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-[var(--v-orange)]/5 rounded-full blur-[100px] pointer-events-none" />
                    </div>

                    {/* Earnings Target KPI */}
                    <div className="rounded-[40px] bg-[var(--v-card)] border border-[var(--v-border)] p-10 sm:p-12 flex flex-col justify-between min-h-[220px] border-l-8 border-l-[var(--v-orange)]">
                        <div>
                            <span className="text-[13px] font-black uppercase tracking-[0.2em] text-[var(--v-text-tertiary)]">Operating Revenue (30D)</span>
                            <div className="mt-4">
                                <span className="text-5xl font-black tracking-tighter text-text-primary tabular-nums">
                                    {loading ? "—" : formatINRCompact(summary?.recentEarnings ?? 0)}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 mt-6">
                            <span className="px-3 py-1.5 rounded-xl bg-[var(--v-success)]/10 text-[var(--v-success)] text-[14px] font-black uppercase tracking-tight">
                                ↑ 12% Verified
                            </span>
                            <span className="text-[12px] font-black text-[var(--v-text-muted)] uppercase tracking-widest">Growth Vector</span>
                        </div>
                    </div>
                </div>

                {/* Row 2: Stats strip */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    <KPIBento
                        label="UPCOMING"
                        value={loading ? "—" : summary?.upcomingEvents?.length || 0}
                        subtext="30-Day Window"
                        icon={<CalendarDays className="w-6 h-6" />}
                        className="!p-8 !min-h-[140px] !rounded-[32px]"
                        loading={loading}
                    />
                    <KPIBento
                        label="VENUES"
                        value={loading ? "—" : summary?.activeVenuePartnerships || 0}
                        subtext="Infrastructure"
                        icon={<Building2 className="w-6 h-6" />}
                        className="!p-8 !min-h-[140px] !rounded-[32px]"
                        loading={loading}
                    />
                    <KPIBento
                        label="PROMOTERS"
                        value={loading ? "—" : summary?.activePromoterPartnerships || 0}
                        subtext="Distribution"
                        icon={<Users className="w-6 h-6" />}
                        className="!p-8 !min-h-[140px] !rounded-[32px]"
                        loading={loading}
                    />
                    <div className="rounded-[32px] bg-[var(--v-card)] border border-[var(--v-border)] p-8 flex flex-col justify-center min-h-[140px]">
                        <span className="text-[12px] font-black uppercase tracking-widest text-[var(--v-text-tertiary)]">PARTNER STATUS</span>
                        <div className="flex items-center gap-3 mt-3">
                            <div className={cn("w-3 h-3 rounded-full animate-pulse", summary?.verificationStatus === "verified" ? "bg-[var(--v-success)]" : "bg-amber-500")} />
                            <span className={cn("text-[15px] font-black uppercase tracking-widest", summary?.verificationStatus === "verified" ? "text-[var(--v-success)]" : "text-amber-500")}>
                                {summary?.verificationStatus === "verified" ? "Elite Tier" : "Validation"}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Row 3: Main content + sidebar */}
            <motion.div {...mp(0.12)} className="grid grid-cols-1 xl:grid-cols-3 gap-10 mt-10">
                {/* Upcoming schedule */}
                <div className="xl:col-span-2 rounded-[40px] bg-[var(--v-card)] border border-[var(--v-border)] p-10 sm:p-12">
                    <div className="flex items-center justify-between mb-10">
                        <h2 className="text-[24px] font-black text-text-primary tracking-tight">
                            Production Schedule
                        </h2>
                        <Link href="/host/events">
                            <VenueActionButton variant="secondary" className="h-10 px-5 text-[12px]">
                                Full Roster <ArrowRight className="ml-2 w-4 h-4" />
                            </VenueActionButton>
                        </Link>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[...Array(4)].map((_, i) => <div key={i} className="v-skeleton rounded-3xl h-36" />)}
                        </div>
                    ) : !summary?.upcomingEvents?.length ? (
                        <div className="py-24 flex flex-col items-center text-center gap-6">
                            <div className="w-20 h-20 rounded-full bg-surface-tertiary flex items-center justify-center">
                                <CalendarDays className="w-10 h-10 text-[var(--v-text-muted)]" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-text-primary">No active schedule</h3>
                                <p className="text-[15px] text-[var(--v-text-tertiary)] mt-2">Initialize your production window by claiming a slot.</p>
                            </div>
                            <Link href="/host/calendar" className="mt-4">
                                <VenueActionButton variant="primary" className="h-12 px-8">
                                    Secure Production Slot
                                </VenueActionButton>
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {summary.upcomingEvents.slice(0, 4).map((event) => (
                                <EventMiniCard key={event.id} event={event} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-8">
                    {/* Insights / Quick Actions */}
                    <div className="rounded-[40px] bg-[var(--v-card)] border border-[var(--v-border)] p-10">
                        <h3 className="text-[18px] font-black text-text-primary mb-8">
                            Network Audit
                        </h3>
                        <div className="space-y-8">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-5">
                                    <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                                        <Handshake className="w-6 h-6 text-orange-400" />
                                    </div>
                                    <span className="text-[15px] font-bold text-[var(--v-text-secondary)]">Pending Access</span>
                                </div>
                                <span className="text-[20px] font-black text-text-primary tabular-nums">{summary?.pendingEventApprovals || 0}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-5">
                                    <div className="w-12 h-12 rounded-2xl bg-sky-500/10 flex items-center justify-center border border-sky-500/20">
                                        <Building2 className="w-6 h-6 text-sky-400" />
                                    </div>
                                    <span className="text-[15px] font-bold text-[var(--v-text-secondary)]">Infrastructure</span>
                                </div>
                                <span className="text-[20px] font-black text-text-primary tabular-nums">{summary?.activeVenuePartnerships || 0}</span>
                            </div>
                        </div>
                        <Link href="/host/network" className="block mt-10">
                            <VenueActionButton variant="secondary" className="w-full h-12">
                                Audit Partnerships
                            </VenueActionButton>
                        </Link>
                    </div>

                    {/* Quick Access */}
                    <div className="grid grid-cols-2 gap-5">
                        <QuickLink icon={BarChart3} label="ROI Audit" href="/host/analytics/partners" />
                        <QuickLink icon={Network} label="Network" href="/host/network" />
                    </div>

                    {/* Brand Boost upsell */}
                    <div className="relative overflow-hidden rounded-[40px] p-10 bg-surface-secondary dark:bg-gradient-to-br dark:from-[#1A1A24] dark:to-[#0A0A10] border border-border-subtle shadow-2xl">
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-6">
                                <Sparkles className="w-6 h-6 text-[var(--v-orange)]" />
                                <span className="text-[15px] font-black uppercase tracking-[0.2em] text-text-primary">Elite Access</span>
                            </div>
                            <p className="text-[14px] leading-relaxed mb-8 text-[var(--v-text-tertiary)] font-medium">
                                Unlock priority slot acquisition and verification badges across the network.
                            </p>
                            <VenueActionButton variant="primary" className="w-full h-12 uppercase text-[12px] tracking-widest font-black">
                                Upgrade Profile
                            </VenueActionButton>
                        </div>
                        <div className="absolute -right-20 -bottom-20 w-48 h-48 rounded-full bg-[var(--v-orange)] opacity-10 blur-3xl pointer-events-none" />
                    </div>
                </div>
            </motion.div>
        </VenuePageShell>
    );
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function EventMiniCard({ event }: { event: UpcomingEvent }) {
    const lifecycle = event.lifecycle || "draft";
    const cfg = LIFECYCLE_CONFIG[lifecycle] || LIFECYCLE_CONFIG.draft;
    return (
        <Link
            href={`/host/events/${event.id}`}
            className="group p-6 rounded-[24px] flex items-center gap-6 transition-all hover:bg-[var(--v-elevated)] bg-[var(--v-canvas)] border border-[var(--v-border)]"
        >
            <div className="w-16 h-16 rounded-[18px] bg-[var(--v-card)] border border-border-subtle flex items-center justify-center shrink-0 overflow-hidden relative shadow-lg">
                {event.coverImage ? (
                    <img src={event.coverImage} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                ) : (
                    <CalendarDays className="w-6 h-6 text-text-tertiary" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-[var(--v-text-tertiary)] uppercase tracking-tight">
                    {formatDate(event.startDate)} · {event.venueName ?? "—"}
                </p>
                <p className="text-[16px] font-black text-text-primary line-clamp-1 leading-tight uppercase mt-1 tracking-tight">
                    {event.title ?? "Untitled Event"}
                </p>
                <div className="mt-3 flex">
                    <span className="text-[12px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border" style={{ color: cfg.color, borderColor: `${cfg.color}30`, background: `${cfg.color}10` }}>
                        {cfg.label}
                    </span>
                </div>
            </div>
            <ChevronRight className="w-6 h-6 text-text-tertiary group-hover:text-text-primary group-hover:translate-x-1 transition-all" />
        </Link>
    );
}

function QuickLink({ icon: Icon, label, href }: { icon: any; label: string; href: string }) {
    return (
        <Link
            href={href}
            className="group flex flex-col items-center justify-center p-8 rounded-[32px] transition-all hover:bg-[var(--v-elevated)] bg-[var(--v-card)] border border-[var(--v-border)] gap-4"
        >
            <div className="w-12 h-12 rounded-2xl bg-surface-tertiary flex items-center justify-center group-hover:scale-110 transition-transform">
                <Icon className="w-6 h-6 text-[var(--v-text-tertiary)] group-hover:text-[var(--v-orange)] transition-colors" />
            </div>
            <span className="text-[13px] font-black text-center uppercase tracking-widest text-[var(--v-text-tertiary)] group-hover:text-text-primary transition-colors">{label}</span>
        </Link>
    );
}
