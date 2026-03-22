"use client";

import { useEffect, useState } from "react";
import { useDashboardAuth } from "../../components/providers/DashboardAuthProvider";
import {
    Wallet,
    TrendingUp,
    Link2,
    Users,
    CheckCircle2,
    Clock,
    Copy,
    Check,
    ExternalLink,
    Zap,
    ArrowRight,
    Star,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { mapEventForClient } from "@c1rcle/core/events";
import TierProgressBar from "@/components/promoter-layout/TierProgressBar";
import {
    StatTrendCard,
    AreaChartPlaceholder,
    BarChartPlaceholder,
    DonutChartPlaceholder,
    MiniSparkline,
} from "@/components/promoter/PlaceholderCharts";

const mp = (delay: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as any, delay },
});

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
        checkInRate: 0,
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
                fetch(`/api/promoter/events?promoterId=${partnerId}&limit=4`)
                    .then((res) => (res.ok ? res.json() : { events: [] })),
                fetch(`/api/promoter/stats?promoterId=${partnerId}`).then((res) => res.json()),
                fetch(`/api/promoter/commissions?promoterId=${partnerId}&limit=5`).then((res) =>
                    res.json()
                ),
            ]);

            if (eventsResult.status === "fulfilled") {
                const events = (eventsResult.value.events || []).map((doc: any) =>
                    mapEventForClient(doc, doc.id)
                );
                setActiveEvents(events);
            }

            if (statsResult.status === "fulfilled" && statsResult.value.stats) {
                const s = statsResult.value.stats;
                const convRate =
                    s.totalClicks > 0 ? (s.totalConversions / s.totalClicks) * 100 : 0;
                const checkRate =
                    s.totalConversions > 0 ? (s.totalCheckIns / s.totalConversions) * 100 : 0;
                setStats({
                    totalCommission: s.totalCommission || 0,
                    pendingCommission: s.pendingCommission || 0,
                    totalClicks: s.totalClicks || 0,
                    totalConversions: s.totalConversions || 0,
                    totalCheckIns: s.totalCheckIns || 0,
                    conversionRate: convRate,
                    checkInRate: checkRate,
                });
            }

            if (
                commissionsResult.status === "fulfilled" &&
                commissionsResult.value.commissions
            ) {
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

    const firstName = profile?.displayName?.split(" ")[0] || "there";
    const tierLabel =
        stats.totalConversions >= 200
            ? "Gold"
            : stats.totalConversions >= 100
            ? "Silver"
            : stats.totalConversions >= 30
            ? "Bronze"
            : "Starter";

    return (
        <VenuePageShell
            title="Overview"
            subtitle="Your performance at a glance"
            actions={
                <Link href="/promoter/payouts">
                    <VenueActionButton variant="primary">
                        <Wallet className="w-4 h-4" />
                        Withdraw ₹{stats.pendingCommission.toLocaleString("en-IN")}
                    </VenueActionButton>
                </Link>
            }
        >
            {/* ── Hero Band ── */}
            <motion.div {...mp(0)}>
                <div
                    className="relative rounded-[32px] overflow-hidden px-6 py-8 md:px-10 md:py-10 flex flex-col md:flex-row md:items-center justify-between gap-6"
                    style={{
                        background:
                            "linear-gradient(135deg, #150d2e 0%, #0d0920 50%, #080810 100%)",
                        border: "1px solid rgba(124,58,237,0.25)",
                    }}
                >
                    {/* Ambient glow blob */}
                    <div
                        className="absolute top-0 left-0 w-72 h-72 rounded-full blur-3xl pointer-events-none"
                        style={{ background: "rgba(124,58,237,0.12)" }}
                    />
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <div
                                className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black"
                                style={{ background: "rgba(124,58,237,0.2)", color: "#a78bfa" }}
                            >
                                {firstName[0]?.toUpperCase()}
                            </div>
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-widest text-text-tertiary">
                                    Welcome back
                                </p>
                                <h1
                                    className="text-2xl md:text-3xl font-black tracking-tight"
                                    style={{ color: "#fff" }}
                                >
                                    {firstName}
                                </h1>
                            </div>
                            <span
                                className="ml-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
                                style={{
                                    background: "rgba(124,58,237,0.25)",
                                    color: "#a78bfa",
                                    border: "1px solid rgba(124,58,237,0.4)",
                                }}
                            >
                                <Star className="w-3 h-3 inline mr-1" />
                                {tierLabel}
                            </span>
                        </div>
                    </div>

                    {/* Right strip — tonight snapshot */}
                    <div className="relative z-10 flex items-center gap-6 shrink-0">
                        <div className="text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-1">
                                Active Events
                            </p>
                            <p
                                className="text-3xl font-black tabular-nums tracking-tighter"
                                style={{ color: "#fff" }}
                            >
                                {loading ? "—" : activeEvents.length}
                            </p>
                        </div>
                        <div
                            className="w-px h-12"
                            style={{ background: "rgba(255,255,255,0.08)" }}
                        />
                        <div className="text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-1">
                                Guests Confirmed
                            </p>
                            <p
                                className="text-3xl font-black tabular-nums tracking-tighter"
                                style={{ color: "#fff" }}
                            >
                                {loading ? "—" : stats.totalCheckIns.toLocaleString("en-IN")}
                            </p>
                        </div>
                        <div
                            className="w-px h-12"
                            style={{ background: "rgba(255,255,255,0.08)" }}
                        />
                        <div className="text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-1">
                                This Week
                            </p>
                            <p
                                className="text-3xl font-black tabular-nums tracking-tighter"
                                style={{ color: "#a78bfa" }}
                            >
                                ₹{loading ? "—" : stats.pendingCommission.toLocaleString("en-IN")}
                            </p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* ── KPI Row ── */}
            <motion.div {...mp(0.06)}>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatTrendCard
                        label="Lifetime Earnings"
                        value={`₹${stats.totalCommission.toLocaleString("en-IN")}`}
                        trend="+12%"
                        trendUp
                        sparkData={[30, 45, 55, 40, 70, 60, 80]}
                        color="#818cf8"
                        icon={<TrendingUp className="w-4 h-4" />}
                    />
                    <StatTrendCard
                        label="Verified Entries"
                        value={stats.totalCheckIns.toLocaleString("en-IN")}
                        trend="+8%"
                        trendUp
                        sparkData={[20, 35, 40, 55, 50, 70, 65]}
                        color="#34d399"
                        icon={<CheckCircle2 className="w-4 h-4" />}
                    />
                    <StatTrendCard
                        label="Conversions"
                        value={stats.totalConversions.toLocaleString("en-IN")}
                        trend={`${stats.conversionRate.toFixed(1)}% rate`}
                        trendUp={stats.conversionRate >= 5}
                        sparkData={[45, 40, 60, 50, 75, 65, 80]}
                        color="#f59e0b"
                        icon={<Users className="w-4 h-4" />}
                    />
                    <StatTrendCard
                        label="Link Clicks"
                        value={stats.totalClicks.toLocaleString("en-IN")}
                        sparkData={[60, 55, 80, 70, 90, 85, 100]}
                        color="#7c3aed"
                        icon={<Link2 className="w-4 h-4" />}
                    />
                </div>
            </motion.div>

            {/* ── Main 2-col grid ── */}
            <motion.div {...mp(0.1)}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Left: Active campaign cards */}
                    <div className="lg:col-span-2 rounded-[32px] bg-surface-elevated border border-border-default p-6 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">
                                Active Campaigns
                            </p>
                            <Link
                                href="/promoter/events"
                                className="text-[11px] font-bold uppercase tracking-widest hover:underline flex items-center gap-1"
                                style={{ color: "#818cf8" }}
                            >
                                All Events <ArrowRight className="w-3 h-3" />
                            </Link>
                        </div>

                        {loading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map((i) => (
                                    <div
                                        key={i}
                                        className="h-20 rounded-2xl animate-pulse"
                                        style={{ background: "var(--v-skeleton)" }}
                                    />
                                ))}
                            </div>
                        ) : activeEvents.length === 0 ? (
                            <div className="py-14 flex flex-col items-center text-center gap-3">
                                <div
                                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                                    style={{ background: "rgba(124,58,237,0.1)" }}
                                >
                                    <Link2 className="w-8 h-8" style={{ color: "#7c3aed" }} />
                                </div>
                                <p
                                    className="text-[13px] font-medium"
                                    style={{ color: "var(--v-text-tertiary)" }}
                                >
                                    Connect with a host to start promoting
                                </p>
                                <Link href="/promoter/partnerships">
                                    <VenueActionButton variant="secondary">
                                        Find Partners
                                    </VenueActionButton>
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {activeEvents.map((event: any) => (
                                    <CampaignCard
                                        key={event.id}
                                        event={event}
                                        isCopied={copiedLink === event.id}
                                        onCopyLink={() => copyLink(event.id, event.slug)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right: Tonight + Commission donut */}
                    <div className="flex flex-col gap-4">
                        {/* Commission donut */}
                        <DonutChartPlaceholder
                            title="Commission Breakdown"
                            segments={[
                                {
                                    label: "Paid Out",
                                    value: Math.max(
                                        stats.totalCommission - stats.pendingCommission,
                                        0
                                    ),
                                    color: "#34d399",
                                },
                                {
                                    label: "Pending",
                                    value: stats.pendingCommission,
                                    color: "#f59e0b",
                                },
                                {
                                    label: "Processing",
                                    value: Math.round(stats.totalCommission * 0.05),
                                    color: "#818cf8",
                                },
                            ]}
                        />

                        {/* Tier progress */}
                        {stats.totalConversions > 0 && (
                            <div className="rounded-[32px] bg-surface-elevated border border-border-default p-5">
                                <TierProgressBar
                                    currentSales={stats.totalConversions}
                                    variant="compact"
                                />
                            </div>
                        )}

                        {/* Recent earnings */}
                        <div className="rounded-[32px] bg-surface-elevated border border-border-default p-5 flex flex-col gap-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">
                                Recent Earnings
                            </p>
                            {recentCommissions.length === 0 ? (
                                <p className="text-[13px] text-text-tertiary py-3 text-center">
                                    No earnings data yet.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {recentCommissions.map((comm: any, i: number) => (
                                        <div
                                            key={comm.id || i}
                                            className="flex items-center justify-between"
                                        >
                                            <div className="min-w-0 flex-1 pr-3">
                                                <p className="text-[13px] font-bold text-text-primary truncate">
                                                    {comm.eventTitle || "Event Contribution"}
                                                </p>
                                                <p className="text-[10px] text-text-tertiary font-medium uppercase tracking-wider mt-0.5">
                                                    {new Date(comm.createdAt).toLocaleDateString(
                                                        "en-IN"
                                                    )}
                                                </p>
                                            </div>
                                            <span
                                                className="text-[14px] font-black tabular-nums"
                                                style={{ color: "#34d399" }}
                                            >
                                                +₹{comm.commissionAmount}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <Link
                                href="/promoter/payouts"
                                className="text-[11px] font-bold uppercase tracking-widest text-text-tertiary hover:text-text-secondary transition-colors pt-1 flex items-center gap-1"
                            >
                                Full Ledger <ArrowRight className="w-3 h-3" />
                            </Link>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* ── Bottom analytics row ── */}
            <motion.div {...mp(0.14)}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <AreaChartPlaceholder
                        title="Earnings Trend"
                        subtitle="Commission accumulated over time"
                        color="#818cf8"
                        height={180}
                    />
                    <BarChartPlaceholder
                        title="Per-Event Performance"
                        subtitle="Commission earned per campaign"
                        color="#34d399"
                        bars={
                            activeEvents.length > 0
                                ? activeEvents.map((e: any, i: number) => ({
                                      label: e.title?.slice(0, 8) || `Event ${i + 1}`,
                                      value: Math.round(40 + Math.random() * 60),
                                  }))
                                : undefined
                        }
                    />
                </div>
            </motion.div>
        </VenuePageShell>
    );
}

// ── Campaign Card ──
function CampaignCard({
    event,
    isCopied,
    onCopyLink,
}: {
    event: any;
    isCopied: boolean;
    onCopyLink: () => void;
}) {
    return (
        <div
            className="group flex items-center gap-4 p-4 rounded-2xl transition-all hover:brightness-105"
            style={{
                background: "var(--v-neutral-bg)",
                border: "1px solid var(--v-border)",
            }}
        >
            {/* Poster */}
            <div
                className="w-14 h-14 rounded-xl overflow-hidden shrink-0"
                style={{ background: "var(--v-border)" }}
            >
                {event.posterUrl && (
                    <img
                        src={event.posterUrl}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest mb-0.5">
                    {event.date
                        ? new Date(event.date).toLocaleDateString("en-IN", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                          })
                        : "—"}
                </p>
                <h4 className="text-[14px] font-bold text-text-primary truncate">{event.title ?? "Untitled Event"}</h4>
                <p className="text-[12px] text-text-tertiary truncate">
                    {event.venueName || "Premium Venue"}
                </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
                <button
                    onClick={onCopyLink}
                    className="h-9 px-4 rounded-xl text-[12px] font-bold flex items-center gap-1.5 transition-all"
                    style={
                        isCopied
                            ? { background: "#22c55e", color: "#fff" }
                            : {
                                  background: "var(--v-neutral-bg)",
                                  border: "1px solid var(--v-border)",
                                  color: "var(--v-text-primary)",
                              }
                    }
                >
                    {isCopied ? (
                        <Check className="w-3.5 h-3.5" />
                    ) : (
                        <Copy className="w-3.5 h-3.5 opacity-60" />
                    )}
                    {isCopied ? "Copied" : "Get Link"}
                </button>
                <Link
                    href={`/e/${event.slug || event.id}`}
                    target="_blank"
                    className="h-9 w-9 flex items-center justify-center rounded-xl transition-all"
                    style={{
                        background: "var(--v-neutral-bg)",
                        border: "1px solid var(--v-border)",
                        color: "var(--v-text-tertiary)",
                    }}
                >
                    <ExternalLink className="w-3.5 h-3.5" />
                </Link>
            </div>
        </div>
    );
}
