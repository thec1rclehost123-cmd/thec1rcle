"use client";

import { useEffect, useState } from "react";
import {
    TrendingUp,
    Activity,
    Zap,
    Users,
    CheckCircle2,
    MousePointer2,
    BarChart3,
    ChevronRight,
    AlertCircle,
    Star,
    ShieldCheck,
    Loader2,
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import TierProgressBar from "@/components/promoter-layout/TierProgressBar";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { VenuePageShell } from "@/components/venue-layout/VenuePageShell";
import {
    StatTrendCard,
    AreaChartPlaceholder,
    BarChartPlaceholder,
    DonutChartPlaceholder,
    FunnelPlaceholder,
    LeaderboardPlaceholder,
} from "@/components/promoter/PlaceholderCharts";

const mp = (delay: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as any, delay },
});

export default function PromoterAnalyticsPage() {
    const { profile } = useDashboardAuth();
    const params = useParams();
    const category = (params?.category as string) || "overview";

    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [range, setRange] = useState("30d");

    const categoryLabels: Record<string, string> = {
        overview: "Promoter Overview",
        performance: "Event-Wise Performance",
        audience: "Audience Mix",
        funnel: "Conversion Funnel",
        trust: "Trust & Quality Score",
        strategy: "Distribution Strategy",
    };

    const categoryDescriptions: Record<string, string> = {
        overview: "Snapshot of your total distribution impact and earnings.",
        performance: "Breakdown of ticket sales and entries per production.",
        audience: "Detailed demographics of the crowd you bring.",
        funnel: "Intelligence on click-to-entry attrition rates.",
        trust: "Professional reliability score and quality indicators.",
        strategy: "Actionable playbooks to maximize your commission ROI.",
    };

    useEffect(() => {
        const fetchAnalytics = async () => {
            const promoterId = profile?.activeMembership?.partnerId || profile?.uid;
            if (!promoterId) return;
            setIsLoading(true);
            try {
                const res = await fetch(
                    `/api/promoter/analytics/${category}?promoterId=${promoterId}&range=${range}`
                );
                if (res.ok) {
                    const data = await res.json();
                    setStats(data);
                }
            } catch (err) {
                console.error("Promoter analytics fetch error:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAnalytics();
    }, [profile, range, category]);

    if (isLoading) {
        return (
            <VenuePageShell title={categoryLabels[category] || "Analytics"}>
                <div className="py-24 flex flex-col items-center justify-center">
                    <Loader2 className="h-10 w-10 animate-spin mb-4" style={{ color: "#7c3aed" }} />
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">
                        Loading Intelligence...
                    </p>
                </div>
            </VenuePageShell>
        );
    }

    if (!stats || !stats.dataReady) {
        return (
            <VenuePageShell title={categoryLabels[category] || "Analytics"}>
                <div className="py-24 flex flex-col items-center text-center">
                    <div
                        className="h-20 w-20 rounded-[2rem] flex items-center justify-center mb-8"
                        style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)" }}
                    >
                        <Zap className="h-10 w-10" style={{ color: "#7c3aed" }} />
                    </div>
                    <h3 className="text-2xl font-black text-text-primary mb-2 uppercase tracking-tight">
                        Zero Distribution
                    </h3>
                    <p className="text-text-tertiary text-sm font-medium mb-10 max-w-xs mx-auto">
                        Generate your first link and drive a conversion to see deep metrics.
                    </p>
                    <Link
                        href="/promoter/events"
                        className="px-10 py-4 rounded-2xl font-bold text-sm"
                        style={{
                            background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
                            color: "#fff",
                        }}
                    >
                        Find Events
                    </Link>
                </div>
            </VenuePageShell>
        );
    }

    return (
        <VenuePageShell
            title={categoryLabels[category] || "Analytics"}
            subtitle={categoryDescriptions[category]}
            actions={
                <select
                    value={range}
                    onChange={(e) => setRange(e.target.value)}
                    className="rounded-xl px-4 py-2 text-[13px] font-semibold appearance-none cursor-pointer focus:outline-none"
                    style={{
                        background: "var(--v-elevated)",
                        color: "var(--v-text-primary)",
                        border: "1px solid var(--v-border)",
                    }}
                >
                    <option value="all">Lifetime</option>
                    <option value="30d">Last 30 Days</option>
                </select>
            }
        >
            {/* ── Hero header ── */}
            <motion.div {...mp(0)}>
                <div
                    className="relative rounded-[32px] overflow-hidden px-6 py-7 flex items-center gap-4"
                    style={{
                        background: "linear-gradient(135deg, #150d2e 0%, #0d0920 60%, #080810 100%)",
                        border: "1px solid rgba(124,58,237,0.2)",
                    }}
                >
                    <div
                        className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none"
                        style={{ background: "rgba(124,58,237,0.1)" }}
                    />
                    <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 relative z-10"
                        style={{ background: "rgba(124,58,237,0.2)", color: "#a78bfa" }}
                    >
                        <BarChart3 className="w-6 h-6" />
                    </div>
                    <div className="relative z-10">
                        <h2
                            className="text-xl font-black tracking-tight"
                            style={{ color: "#fff" }}
                        >
                            {categoryLabels[category]}
                        </h2>
                        <p className="text-[13px] font-medium text-text-tertiary mt-0.5">
                            {categoryDescriptions[category]}
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* ── KPI Strip ── */}
            <motion.div {...mp(0.06)}>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatTrendCard
                        label="Total Earnings"
                        value={`₹${Math.round(stats.totalCommission || 0).toLocaleString("en-IN")}`}
                        trend="+15%"
                        trendUp
                        sparkData={[30, 50, 40, 70, 60, 85, 75]}
                        color="#34d399"
                        icon={<TrendingUp className="w-4 h-4" />}
                    />
                    <StatTrendCard
                        label="Check-ins"
                        value={(stats.totalCheckIns || 0).toLocaleString("en-IN")}
                        trend="Actual Intent"
                        sparkData={[20, 40, 35, 55, 45, 65, 60]}
                        color="#818cf8"
                        icon={<CheckCircle2 className="w-4 h-4" />}
                    />
                    <StatTrendCard
                        label="Yield %"
                        value={`${Math.round(stats.conversionRate || 0)}%`}
                        trend="Claim → Entry"
                        trendUp={(stats.conversionRate || 0) > 50}
                        sparkData={[45, 50, 42, 60, 55, 70, 65]}
                        color="#f59e0b"
                        icon={<Activity className="w-4 h-4" />}
                    />
                    <StatTrendCard
                        label="Partners"
                        value={stats.activePartnerships || 0}
                        sparkData={[5, 7, 6, 8, 10, 9, 12]}
                        color="#7c3aed"
                        icon={<Users className="w-4 h-4" />}
                    />
                </div>
            </motion.div>

            {/* ── 2x2 Chart Grid ── */}
            <motion.div {...mp(0.1)}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <AreaChartPlaceholder
                        title="Link Clicks Over Time"
                        subtitle="Aggregate click volume across all your links"
                        color="#7c3aed"
                        height={180}
                    />
                    <BarChartPlaceholder
                        title="Conversions by Event"
                        subtitle="Ticket sales attributed per campaign"
                        color="#34d399"
                        bars={
                            stats.eventPerformance?.slice(0, 6).map((ev: any) => ({
                                label: ev.title?.slice(0, 8) || "Event",
                                value: ev.tickets || ev.conversions || Math.round(20 + Math.random() * 80),
                            })) || undefined
                        }
                    />
                    <DonutChartPlaceholder
                        title="Traffic by Channel"
                        segments={
                            stats.channelBreakdown
                                ? Object.entries(stats.channelBreakdown).map(
                                      ([ch, count]: any) => ({
                                          label: ch,
                                          value: count,
                                          color:
                                              ch === "wa"
                                                  ? "#22c55e"
                                                  : ch === "ig"
                                                  ? "#ec4899"
                                                  : ch === "tw"
                                                  ? "#94a3b8"
                                                  : ch === "fb"
                                                  ? "#3b82f6"
                                                  : "#818cf8",
                                      })
                                  )
                                : undefined
                        }
                    />
                    <FunnelPlaceholder
                        title="Conversion Funnel"
                        steps={
                            stats.funnel?.map((step: any, i: number) => ({
                                label: step.stage,
                                value: step.count,
                                color: ["#818cf8", "#7c3aed", "#22c55e", "#34d399"][i] || "#818cf8",
                            })) || undefined
                        }
                    />
                </div>
            </motion.div>

            {/* ── Tier + Leaderboard ── */}
            <motion.div {...mp(0.14)}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {(stats.totalConversions > 0 || stats.totalSales > 0) && (
                        <div className="rounded-[32px] bg-surface-elevated border border-border-default p-6">
                            <p className="text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-4">
                                Commission Tier
                            </p>
                            <TierProgressBar
                                currentSales={stats.totalConversions || stats.totalSales || 0}
                                tiers={stats.commissionTiers || undefined}
                                variant="compact"
                            />
                        </div>
                    )}
                    <LeaderboardPlaceholder
                        title="Top Campaigns"
                        items={
                            stats.eventPerformance?.slice(0, 5).map((ev: any, i: number) => ({
                                rank: i + 1,
                                label: ev.title || "Event",
                                value: `₹${Math.round(ev.commission || 0).toLocaleString("en-IN")}`,
                                badge: i === 0 ? "Top Earner" : undefined,
                            })) || undefined
                        }
                    />
                </div>
            </motion.div>
        </VenuePageShell>
    );
}
