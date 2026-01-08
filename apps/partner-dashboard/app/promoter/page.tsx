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
import { collection, query, where, onSnapshot, limit, orderBy } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
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
        const db = getFirebaseDb();

        // Fetch active events for promotion
        const eventsQuery = query(
            collection(db, "events"),
            where("lifecycle", "in", ["scheduled", "live"]),
            where("promoterVisibility", "==", true),
            limit(4)
        );

        const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
            const events = snapshot.docs.map(doc => mapEventForClient(doc.data(), doc.id));
            setActiveEvents(events);
        });

        // Fetch Stats
        fetch(`/api/promoter/stats?promoterId=${partnerId}`)
            .then(res => res.json())
            .then(data => {
                if (data.stats) {
                    const s = data.stats;
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
                setLoading(false);
            })
            .catch(() => setLoading(false));

        // Fetch Recent Commissions
        fetch(`/api/promoter/commissions?promoterId=${partnerId}&limit=5`)
            .then(res => res.json())
            .then(data => {
                if (data.commissions) {
                    setRecentCommissions(data.commissions);
                }
            });

        return () => unsubscribeEvents();
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
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-display-sm text-[var(--text-primary)] tracking-tight">Console</h1>
                    <p className="text-body text-[var(--text-tertiary)] mt-1">Proof of impact and performance overview.</p>
                </div>

                <div className="flex items-center gap-6 px-6 py-4 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] shadow-sm">
                    <div className="text-right">
                        <p className="text-label text-[var(--text-tertiary)] uppercase tracking-[0.05em] mb-1">Available Payout</p>
                        <p className="text-display-xs text-[var(--text-primary)]">₹{stats.pendingCommission.toLocaleString()}</p>
                    </div>
                    <div className="w-[1px] h-10 bg-[var(--border-default)]" />
                    <Link href="/promoter/payouts" className="btn btn-primary btn-sm rounded-xl px-5">
                        Withdraw
                    </Link>
                </div>
            </div>

            {/* Core Attribution Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Active Distribution Links */}
                <div className="lg:col-span-2">
                    <div className="p-8 rounded-[2rem] bg-[var(--surface-elevated)] border border-[var(--border-subtle)] shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-title text-[var(--text-primary)]">Distribution Links</h2>
                            <Link href="/promoter/links" className="text-button text-indigo-600 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-all">
                                All Links
                                <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>

                        {activeEvents.length === 0 ? (
                            <div className="empty-state py-12">
                                <Link2 className="w-8 h-8 text-[var(--text-placeholder)] mb-4" />
                                <h3 className="text-headline-sm text-[var(--text-primary)] mb-2">No active events</h3>
                                <p className="text-body-sm text-[var(--text-tertiary)] max-w-xs mx-auto">
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
                    <div className="p-8 rounded-[2rem] bg-stone-900 text-white shadow-xl shadow-stone-200">
                        <h3 className="text-label text-stone-400 uppercase tracking-widest mb-6">Recent Earnings</h3>
                        {recentCommissions.length === 0 ? (
                            <p className="text-caption text-stone-500 py-6 text-center">No earnings data available.</p>
                        ) : (
                            <div className="space-y-5">
                                {recentCommissions.map((comm, i) => (
                                    <div key={comm.id || i} className="flex items-center justify-between">
                                        <div className="min-w-0 flex-1 pr-4">
                                            <p className="text-[14px] font-bold text-white truncate leading-tight">
                                                {comm.eventTitle || "Event Contribution"}
                                            </p>
                                            <p className="text-[11px] text-stone-500 font-medium uppercase tracking-wider mt-1">
                                                {new Date(comm.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <span className="text-[15px] font-bold text-emerald-400">
                                            +₹{comm.commissionAmount}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <Link href="/promoter/payouts" className="btn btn-secondary w-full mt-8 bg-white/10 border-white/10 hover:bg-white/20 text-white font-bold">
                            Financial Ledger
                        </Link>
                    </div>

                    {/* Quick Tools */}
                    <div className="p-8 rounded-[2rem] bg-[var(--surface-elevated)] border border-[var(--border-subtle)] shadow-sm">
                        <h3 className="text-label text-[var(--text-tertiary)] uppercase tracking-widest mb-6">Tools</h3>
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
        <div className="p-8 rounded-[2rem] bg-[var(--surface-elevated)] border border-[var(--border-subtle)] shadow-sm hover:border-[var(--border-strong)] transition-all group">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110" style={{ backgroundColor: `${accents[accentColor]}10`, color: accents[accentColor] }}>
                <Icon className="w-5 h-5" />
            </div>
            <p className="text-display-sm text-[var(--text-primary)] leading-none mb-2 tracking-tight">{value}</p>
            <p className="text-label text-[var(--text-tertiary)] uppercase tracking-[0.05em] mb-1">{label}</p>
            {subtext && (
                <p className="text-caption text-stone-400 font-medium">{subtext}</p>
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
        <div className="group flex items-center gap-6 p-5 rounded-[1.5rem] bg-[var(--surface-secondary)]/50 border border-[var(--border-subtle)] hover:bg-[var(--surface-elevated)] hover:border-[var(--border-strong)] transition-all">
            {/* Poster Thumbnail */}
            <div className="w-16 h-16 rounded-xl bg-stone-200 overflow-hidden flex-shrink-0 shadow-inner">
                {event.posterUrl && (
                    <img src={event.posterUrl} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                )}
            </div>

            {/* Event Info */}
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                    {new Date(event.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
                <h4 className="text-[16px] font-bold text-[var(--text-primary)] truncate leading-tight">{event.title}</h4>
                <p className="text-[13px] text-stone-500 font-medium truncate mt-0.5">
                    {event.venueName || 'Premium Venue'}
                </p>
            </div>

            {/* Interactive Section */}
            <div className="flex items-center gap-3">
                <button
                    onClick={onCopyLink}
                    className={`h-11 px-6 rounded-xl font-bold text-[13px] transition-all flex items-center gap-2 ${isCopied
                        ? 'bg-[var(--state-confirmed)] text-white shadow-lg'
                        : 'bg-white border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--border-strong)] active:scale-95'
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
                    className="h-11 w-11 flex items-center justify-center rounded-xl bg-white border border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-indigo-600 hover:border-indigo-200 transition-all active:scale-95"
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
            className="flex items-center gap-3 p-4 rounded-xl hover:bg-white/50 border border-transparent hover:border-[var(--border-subtle)] transition-all group"
        >
            <div className="w-9 h-9 rounded-lg bg-white border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-tertiary)] group-hover:text-indigo-600 group-hover:border-indigo-100 transition-all">
                <Icon className="w-4 h-4" />
            </div>
            <span className="text-[14px] font-bold text-[var(--text-secondary)] flex-1">{label}</span>
            <ArrowUpRight className="w-4 h-4 text-stone-300 group-hover:text-indigo-600 transition-all" />
        </Link>
    );
}
