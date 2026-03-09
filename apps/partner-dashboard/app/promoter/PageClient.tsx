"use client";

import { useEffect, useState } from "react";
import { useDashboardAuth } from "../../components/providers/DashboardAuthProvider";
import {
    Wallet,
    TrendingUp,
    ArrowUpRight,
    ArrowDownRight,
    Link2,
    Users,
    CheckCircle2,
    Clock,
    ChevronRight,
    ExternalLink,
    Copy,
    Check
} from "lucide-react";
import Link from "next/link";

import { DashboardEventCard } from "@c1rcle/ui";
import { mapEventForClient } from "@c1rcle/core/events";

/**
 * Promoter Dashboard Home — Attribution & Proof Lens
 * 
 * A Sales Command Center for distributed marketing.
 * 
 * Core question this screen answers:
 * "How am I performing and what's my payout pipeline?"
 * 
 * Key metrics:
 * - Verified entries (check-ins, not just clicks)
 * - Conversion funnels
 * - Commission clarity
 * - No vanity metrics
 */
export default function PromoterDashboardHome() {
    const { profile } = useDashboardAuth();
    const [copiedLink, setCopiedLink] = useState<string | null>(null);
    const [stats, setStats] = useState({
        totalCommission: 0,
        pendingCommission: 0,
        totalClicks: 0,
        totalConversions: 0,
        totalCheckIns: 0,
        conversionRate: 0,
        checkInRate: 0
    });
    const [recentCommissions, setRecentCommissions] = useState<any[]>([]);
    const [activeEvents, setActiveEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!profile?.activeMembership?.partnerId) return;

        const partnerId = profile.activeMembership.partnerId;

        const fetchAll = async () => {
            setLoading(true);

            const [eventsResult, statsResult, commissionsResult] = await Promise.allSettled([
                // Fetch active events
                fetch(`/api/promoter/events?promoterId=${partnerId}&limit=4`)
                    .then(res => res.ok ? res.json() : { events: [] }),
                // Fetch stats
                fetch(`/api/promoter/stats?promoterId=${partnerId}`)
                    .then(res => res.json()),
                // Fetch recent commissions
                fetch(`/api/promoter/commissions?promoterId=${partnerId}&limit=5`)
                    .then(res => res.json())
            ]);

            // Process events
            if (eventsResult.status === 'fulfilled') {
                const events = (eventsResult.value.events || []).map((doc: any) => mapEventForClient(doc, doc.id));
                setActiveEvents(events);
            }

            // Process stats
            if (statsResult.status === 'fulfilled' && statsResult.value.stats) {
                const s = statsResult.value.stats;
                const convRate = s.totalClicks > 0 ? (s.totalConversions / s.totalClicks * 100) : 0;
                const checkRate = s.totalConversions > 0 ? (s.totalCheckIns / s.totalConversions * 100) : 0;
                setStats({
                    totalCommission: s.totalCommission || 0,
                    pendingCommission: s.pendingCommission || 0,
                    totalClicks: s.totalClicks || 0,
                    totalConversions: s.totalConversions || 0,
                    totalCheckIns: s.totalCheckIns || 0,
                    conversionRate: convRate,
                    checkInRate: checkRate
                });
            }

            // Process commissions
            if (commissionsResult.status === 'fulfilled' && commissionsResult.value.commissions) {
                setRecentCommissions(commissionsResult.value.commissions);
            }

            setLoading(false);
        };

        fetchAll().catch(() => setLoading(false));
    }, [profile]);

    const copyLink = (eventId: string, slug?: string) => {
        const partnerId = profile?.activeMembership?.partnerId;
        const url = `${window.location.origin}/e/${slug || eventId}?p=${partnerId}`;
        navigator.clipboard.writeText(url);
        setCopiedLink(eventId);
        setTimeout(() => setCopiedLink(null), 2000);
    };

    const firstName = profile?.displayName?.split(' ')[0] || 'there';

    return (
        <div className="space-y-6 md:space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start justify-between gap-6">
                <div>
                    <h1 className="text-3xl md:text-4xl font-extrabold text-text-primary tracking-tight">Console</h1>
                    <p className="text-sm md:text-base text-text-tertiary mt-1">Proof of impact and performance overview.</p>
                </div>

                <div className="flex items-center gap-6 px-6 py-4 rounded-2xl bg-surface-elevated border border-border-subtle shadow-sm w-full md:w-auto justify-between md:justify-start">
                    <div className="text-right">
                        <p className="text-[10px] md:text-xs font-bold text-text-tertiary uppercase tracking-[0.05em] mb-1">Available Payout</p>
                        <p className="text-2xl md:text-3xl font-black text-text-primary">₹{stats.pendingCommission.toLocaleString()}</p>
                    </div>
                    <div className="w-[1px] h-10 bg-[var(--border-default)]" />
                    <Link href="/promoter/payouts" className="btn btn-primary btn-sm rounded-xl px-5 py-3 h-auto">
                        Withdraw
                    </Link>
                </div>
            </div>

            {/* Core Attribution Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <MetricCard
                    label="Lifetime Earnings"
                    value={`₹${stats.totalCommission.toLocaleString()}`}
                    icon={TrendingUp}
                    accentColor="indigo"
                />
                <MetricCard
                    label="Verified Entries"
                    value={stats.totalCheckIns.toString()}
                    icon={CheckCircle2}
                    subtext="Actual venue footfall"
                    accentColor="emerald"
                />
                <MetricCard
                    label="Conversions"
                    value={stats.totalConversions.toString()}
                    icon={Users}
                    subtext={`${stats.conversionRate.toFixed(1)}% click-to-buy`}
                    accentColor="amber"
                />
                <MetricCard
                    label="Loyalty Index"
                    value={`${stats.checkInRate.toFixed(0)}%`}
                    icon={Clock}
                    subtext="Buyers who attended"
                    accentColor={stats.checkInRate >= 70 ? "emerald" : stats.checkInRate >= 50 ? "amber" : "red"}
                />
            </div>

            {/* Work Surface */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                {/* Active Distribution Links */}
                <div className="lg:col-span-2">
                    <div className="p-6 md:p-8 rounded-[2rem] bg-surface-elevated border border-border-subtle shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-lg md:text-xl font-bold text-text-primary">Distribution Links</h2>
                            <Link href="/promoter/links" className="text-sm font-medium text-accent-primary flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-surface-tertiary transition-all">
                                All Links
                                <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>

                        {activeEvents.length === 0 ? (
                            <div className="empty-state py-12 text-center">
                                <Link2 className="w-8 h-8 text-text-placeholder mb-4 mx-auto" />
                                <h3 className="text-lg font-bold text-text-primary mb-2">No active events</h3>
                                <p className="text-sm text-text-tertiary max-w-xs mx-auto">
                                    Connect with a host to start promoting live events and earning commission.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {activeEvents.map((event) => (
                                    <EventRow
                                        key={event.id}
                                        event={event}
                                        onCopyLink={() => copyLink(event.id, event.slug)}
                                        isCopied={copiedLink === event.id}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Performance Context */}
                <div className="space-y-6">
                    {/* Insights Card */}
                    <div className="p-6 md:p-8 rounded-[2rem] bg-surface-secondary border border-border-subtle shadow-sm">
                        <h3 className="text-xs font-bold text-text-tertiary uppercase tracking-widest mb-6">Recent Earnings</h3>
                        {recentCommissions.length === 0 ? (
                            <p className="text-sm text-text-tertiary py-6 text-center">No earnings data available.</p>
                        ) : (
                            <div className="space-y-5">
                                {recentCommissions.map((comm, i) => (
                                    <div key={comm.id || i} className="flex items-center justify-between">
                                        <div className="min-w-0 flex-1 pr-4">
                                            <p className="text-[14px] font-bold text-text-primary truncate leading-tight">
                                                {comm.eventTitle || "Event Contribution"}
                                            </p>
                                            <p className="text-[11px] text-text-tertiary font-medium uppercase tracking-wider mt-1">
                                                {new Date(comm.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <span className="text-[15px] font-bold text-accent-primary">
                                            +₹{comm.commissionAmount}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <Link href="/promoter/payouts" className="btn btn-secondary w-full mt-8 font-bold">
                            Financial Ledger
                        </Link>
                    </div>

                    {/* Quick Tools */}
                    <div className="p-6 md:p-8 rounded-[2rem] bg-surface-elevated border border-border-subtle shadow-sm">
                        <h3 className="text-xs font-bold text-text-tertiary uppercase tracking-widest mb-6">Tools</h3>
                        <div className="space-y-2">
                            <QuickAction label="Promoter Assets" href="/promoter/assets" icon={ExternalLink} />
                            <QuickAction label="Verified Buyers" href="/promoter/guests" icon={Users} />
                            <QuickAction label="Network Status" href="/promoter/connections" icon={Link2} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Sub-components
function MetricCard({
    label,
    value,
    icon: Icon,
    subtext,
    accentColor = "indigo"
}: {
    label: string;
    value: string;
    icon: any;
    subtext?: string;
    accentColor?: 'emerald' | 'amber' | 'red' | 'indigo' | 'stone';
}) {
    const accents: any = {
        emerald: 'var(--state-confirmed)',
        amber: 'var(--state-pending)',
        red: 'var(--state-risk)',
        indigo: 'var(--state-draft)',
        stone: 'var(--text-tertiary)'
    };

    return (
        <div className="p-6 md:p-8 rounded-[2rem] bg-surface-elevated border border-border-subtle shadow-sm hover:border-border-strong transition-all group">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110" style={{ backgroundColor: `${accents[accentColor]}10`, color: accents[accentColor] }}>
                <Icon className="w-5 h-5" />
            </div>
            <p className="text-3xl md:text-4xl font-black text-text-primary leading-none mb-2 tracking-tight">{value}</p>
            <p className="text-[10px] md:text-xs font-bold text-text-tertiary uppercase tracking-[0.05em] mb-1">{label}</p>
            {subtext && (
                <p className="text-xs md:text-sm text-text-tertiary font-medium">{subtext}</p>
            )}
        </div>
    );
}

function EventRow({
    event,
    onCopyLink,
    isCopied
}: {
    event: any;
    onCopyLink: () => void;
    isCopied: boolean;
}) {
    return (
        <div className="group flex flex-col sm:flex-row items-center gap-4 sm:gap-6 p-4 sm:p-5 rounded-[1.5rem] bg-surface-secondary/50 border border-border-subtle hover:bg-surface-elevated hover:border-border-strong transition-all">
            {/* Poster Thumbnail */}
            <div className="w-full sm:w-16 h-32 sm:h-16 rounded-xl bg-surface-tertiary overflow-hidden flex-shrink-0 shadow-inner">
                {event.posterUrl && (
                    <img src={event.posterUrl} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                )}
            </div>

            {/* Event Info */}
            <div className="flex-1 min-w-0 text-center sm:text-left w-full">
                <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider mb-1">
                    {new Date(event.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
                <h4 className="text-[16px] font-bold text-text-primary truncate leading-tight">{event.title}</h4>
                <p className="text-[13px] text-text-tertiary font-medium truncate mt-0.5">
                    {event.venueName || 'Premium Venue'}
                </p>
            </div>

            {/* Interactive Section */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                    onClick={onCopyLink}
                    className={`h-11 px-6 rounded-xl font-bold text-[13px] transition-all flex flex-1 sm:flex-none items-center justify-center gap-2 ${isCopied
                        ? 'bg-green-500 text-text-inverse shadow-lg'
                        : 'bg-surface-elevated border border-border-subtle text-text-primary hover:border-border-strong active:scale-95'
                        }`}
                >
                    {isCopied ? (
                        <Check className="w-4 h-4" />
                    ) : (
                        <Copy className="w-4 h-4 opacity-50" />
                    )}
                    {isCopied ? 'Copied' : 'Get Link'}
                </button>
                <Link
                    href={`/e/${event.slug || event.id}`}
                    target="_blank"
                    className="h-11 w-11 flex items-center justify-center rounded-xl bg-surface-elevated border border-border-subtle text-text-tertiary hover:text-accent-primary hover:border-border-strong transition-all active:scale-95"
                >
                    <ExternalLink className="w-4 h-4" />
                </Link>
            </div>
        </div>
    );
}

function QuickAction({
    label,
    href,
    icon: Icon
}: {
    label: string;
    href: string;
    icon: any;
}) {
    return (
        <Link
            href={href}
            className="flex items-center gap-3 p-4 rounded-xl hover:bg-surface-tertiary border border-transparent hover:border-border-subtle transition-all group"
        >
            <div className="w-9 h-9 rounded-lg bg-surface-elevated border border-border-subtle flex items-center justify-center text-text-tertiary group-hover:text-accent-primary group-hover:border-border-strong transition-all">
                <Icon className="w-4 h-4" />
            </div>
            <span className="text-[14px] font-bold text-text-secondary flex-1">{label}</span>
            <ArrowUpRight className="w-4 h-4 text-text-placeholder group-hover:text-accent-primary transition-all" />
        </Link>
    );
}
