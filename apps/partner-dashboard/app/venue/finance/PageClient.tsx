"use client";

import { useState, useEffect, useCallback } from "react";
import clsx from "clsx";
import {
    Banknote, TrendingUp, TrendingDown, AlertCircle, CheckCircle2,
    Clock, RefreshCw, ArrowRight, Wallet, ShieldAlert, Building2,
    ReceiptText, ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { AppleHeroStat } from "@/components/ui/AppleHeroStat";
import { VenueStatStrip } from "@/components/ui/VenueStatStrip";
import { BentoCard } from "@/components/ui/BentoCard";
import { CashflowChart } from "@/components/finance/CashflowChart";
import { RevenueBreakdown } from "@/components/finance/RevenueBreakdown";
import { AnalyticsBridgeSection } from "@/components/finance/AnalyticsBridgeSection";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import {
    formatINR,
    formatINRCompact,
    pctChange,
    SETTLEMENT_STATUS_CONFIG,
    type FinanceOverviewMetrics,
    type CashflowDataPoint,
    type RevenueBreakdownItem,
} from "@/lib/finance/definitions";

type Period = "7d" | "30d" | "90d" | "ytd";

// ── Finance Overview Page ─────────────────────────────────────────────────────

export default function VenueFinancePageClient() {
    const { profile, getIdToken } = useDashboardAuth() as any;
    const venueId = profile?.activeMembership?.partnerId;

    const [period, setPeriod] = useState<Period>("30d");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [metrics, setMetrics] = useState<FinanceOverviewMetrics | null>(null);
    const [cashflow, setCashflow] = useState<CashflowDataPoint[]>([]);
    const [breakdown, setBreakdown] = useState<RevenueBreakdownItem[]>([]);

    const fetchOverview = useCallback(async (p: Period) => {
        if (!venueId) return;
        setLoading(true);
        setError(false);
        try {
            const token = typeof getIdToken === "function" ? await getIdToken() : "";
            const res = await fetch(
                `/api/venue/finance/overview?venueId=${venueId}&period=${p}`,
                { headers: token ? { Authorization: `Bearer ${token}` } : {} }
            );
            if (!res.ok) throw new Error("API error");
            const data = await res.json();
            setMetrics(data.metrics || null);
            setCashflow(data.cashflow || []);
            setBreakdown(data.breakdown || []);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [venueId, getIdToken]);

    useEffect(() => {
        fetchOverview(period);
    }, [fetchOverview, period]);

    // ── Derived trends ────────────────────────────────────────────────────────

    const grossTrend = metrics?.comparedTo
        ? pctChange(metrics.grossRevenue, metrics.comparedTo.grossRevenue)
        : undefined;
    const netTrend = metrics?.comparedTo
        ? pctChange(metrics.netRevenue, metrics.comparedTo.netRevenue)
        : undefined;

    const payoutStatus = metrics?.payoutFailures
        ? "failed"
        : metrics?.pendingPayouts
            ? "pending"
            : "paid";
    const payoutStatusCfg = SETTLEMENT_STATUS_CONFIG[payoutStatus];

    // ── Payout alert banner ───────────────────────────────────────────────────
    const showPayoutAlert = !loading && !error && metrics && metrics.payoutFailures > 0;

    return (
        <VenuePageShell
            title="Finance"
            subtitle="Revenue, cashflow, and payout status for your venue"
            actions={
                <>
                    <VenueActionButton variant="ghost" onClick={() => fetchOverview(period)}>
                        <RefreshCw className="w-3.5 h-3.5" />
                        Refresh
                    </VenueActionButton>
                    <Link href="/venue/finance/reports">
                        <VenueActionButton variant="secondary">
                            <ReceiptText className="w-3.5 h-3.5" />
                            Reports
                        </VenueActionButton>
                    </Link>
                </>
            }
        >
            {/* Payout failure alert */}
            {showPayoutAlert && (
                <div
                    className="flex items-start gap-3 px-5 py-4 rounded-[var(--v-r-xl)]"
                    style={{
                        background: "rgba(239,68,68,0.08)",
                        border: "1px solid rgba(239,68,68,0.2)",
                    }}
                >
                    <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#F87171" }} />
                    <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold" style={{ color: "#F87171" }}>
                            {metrics!.payoutFailures} payout{metrics!.payoutFailures > 1 ? "s" : ""} failed
                        </p>
                        <p className="text-[12px] mt-0.5" style={{ color: "rgba(248,113,113,0.7)" }}>
                            Review your payout settings and bank details to resolve.
                        </p>
                    </div>
                    <Link href="/venue/finance/payouts">
                        <span className="text-[12px] font-bold whitespace-nowrap" style={{ color: "#F87171" }}>
                            Fix Now →
                        </span>
                    </Link>
                </div>
            )}

            {/* Compact Financial Dashboard */}
            <div className="flex flex-col gap-3">
                {/* Section 1: The "Money" Row (Primary Metrics) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="v-hero-card p-5 flex flex-col justify-between min-h-[120px] shadow-sm">
                        <div className="flex justify-between items-start">
                            <span className="v-label">GROSS REVENUE</span>
                            {grossTrend && (
                                <span className={clsx("v-trend-chip text-[9px]", grossTrend.direction === "up" ? "v-trend-up" : "v-trend-down")}>
                                    {grossTrend.direction === "up" ? "↑ " : "↓ "}{grossTrend.value}
                                </span>
                            )}
                        </div>
                        <div className="mt-1">
                            <span className="text-2xl font-black tracking-tighter" style={{ color: "var(--v-text-primary)" }}>
                                {loading ? "—" : formatINR(metrics?.grossRevenue || 0)}
                            </span>
                            <p className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest mt-0.5">{period.toUpperCase()} TOTAL</p>
                        </div>
                    </div>

                    <div className="v-hero-card p-5 flex flex-col justify-between min-h-[120px] shadow-sm">
                        <div className="flex justify-between items-start">
                            <span className="v-label">NET REVENUE</span>
                            {netTrend && (
                                <span className={clsx("v-trend-chip text-[9px]", netTrend.direction === "up" ? "v-trend-up" : "v-trend-down")}>
                                    {netTrend.direction === "up" ? "↑ " : "↓ "}{netTrend.value}
                                </span>
                            )}
                        </div>
                        <div className="mt-1">
                            <span className="text-2xl font-black tracking-tighter" style={{ color: "var(--v-text-primary)" }}>
                                {loading ? "—" : formatINR(metrics?.netRevenue || 0)}
                            </span>
                            <p className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest mt-0.5">NET AFTER FEES</p>
                        </div>
                    </div>

                    <div className="v-hero-card p-5 flex flex-col justify-between min-h-[120px] border-l-[3px] border-l-[var(--v-orange)] shadow-lg ring-1 ring-[var(--v-orange)]/10">
                        <div className="flex justify-between items-start">
                            <span className="v-label text-[var(--v-orange)]">WITHDRAWABLE</span>
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                <span className="text-[8px] font-black uppercase tracking-widest">Live</span>
                            </div>
                        </div>
                        <div className="mt-1">
                            <span className="text-2xl font-black tracking-tighter text-[var(--v-orange)]">
                                {loading ? "—" : formatINR(metrics?.availableBalance || 0)}
                            </span>
                            <div className="flex items-center justify-between mt-0.5">
                                <p className="text-[9px] font-black text-text-tertiary uppercase tracking-widest">READY TO PAYOUT</p>
                                <Link href="/venue/finance/payouts" className="text-[9px] font-black text-text-primary hover:underline transition-all uppercase tracking-widest">
                                    Manage →
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 2: Secondary Metrics + Payout Info (Ultra Compact Strip) */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <VenueStatStrip
                        columns={4}
                        className="md:col-span-3 !bg-transparent !border-none !divide-x-0 gap-3"
                        stats={[
                            { label: "PENDING", value: loading ? "—" : formatINRCompact(metrics?.pendingPayouts || 0), icon: <Clock className="w-3 h-3" />, loading },
                            { label: "FEES", value: loading ? "—" : formatINRCompact(metrics?.processingFees || 0), loading },
                            { label: "PARTNER", value: loading ? "—" : formatINRCompact(metrics?.partnerObligations || 0), loading },
                            { label: "RESERVE", value: loading ? "—" : formatINRCompact(metrics?.reserveBalance || 0), loading },
                        ]}
                    />
                    <div className="v-hero-card !bg-surface-secondary/50 px-4 py-2 flex items-center justify-between border-dashed border-border-default h-[65px] self-center">
                        <div className="min-w-0">
                            <p className="text-[8px] font-black text-text-tertiary uppercase tracking-[0.15em] leading-none mb-1">STATUS</p>
                            <span className="text-[10px] font-black uppercase tracking-widest truncate" style={{ color: payoutStatusCfg.text }}>
                                {payoutStatusCfg.label}
                            </span>
                        </div>
                        <ArrowUpRight className="w-3 w-3 text-text-tertiary" />
                    </div>
                </div>

                {/* Section 3: Visual Analytics (Chart + Breakdown) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
                    <BentoCard
                        header={
                            <div className="flex items-center justify-between w-full">
                                <span className="v-label">CASHFLOW</span>
                                <div className="flex items-center gap-4">
                                    {!loading && metrics && (
                                        <span className="text-[10px] font-black uppercase tracking-[0.1em]" style={{ color: metrics.netRevenue >= 0 ? "#10B981" : "#EF4444" }}>
                                            NET: {formatINRCompact(metrics.netRevenue || 0)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        }
                        className="lg:col-span-8 flex flex-col"
                    >
                        <CashflowChart
                            data={cashflow}
                            loading={loading}
                            showSeriesToggle
                            showTimeRangePicker
                            activeRange={period}
                            onTimeRangeChange={(r) => setPeriod(r as Period)}
                            height={210}
                        />
                    </BentoCard>

                    <BentoCard
                        header={
                            <div className="flex items-center justify-between w-full">
                                <span className="v-label">ALLOCATION</span>
                                <Link href="/venue/finance/ledger" className="text-[9px] font-black uppercase text-[var(--v-orange)] hover:underline">
                                    Full Ledger
                                </Link>
                            </div>
                        }
                        className="lg:col-span-4"
                    >
                        <div className="h-full flex flex-col justify-center">
                            <RevenueBreakdown
                                items={breakdown.length > 0 ? breakdown : defaultBreakdown(metrics)}
                                grossRevenue={metrics?.grossRevenue || 0}
                                loading={loading}
                                layout="list"
                            />
                        </div>
                    </BentoCard>
                </div>

                {/* Section 4: Deep Insights (Bridge) */}
                <BentoCard
                    header={
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-3.5 h-3.5 text-text-tertiary" />
                            <span className="v-label">INSIGHTS BRIDGE</span>
                        </div>
                    }
                    className="overflow-hidden"
                >
                    <AnalyticsBridgeSection
                        profileType="venue"
                        partnerId={venueId}
                        timeRange={period}
                    />
                </BentoCard>
            </div>
        </VenuePageShell>
    );
}

// ── Fallback breakdown from metrics ──────────────────────────────────────────

function defaultBreakdown(metrics: FinanceOverviewMetrics | null): RevenueBreakdownItem[] {
    if (!metrics || !metrics.grossRevenue) return [];
    const gross = metrics.grossRevenue;
    const result: RevenueBreakdownItem[] = [];

    if (metrics.processingFees) result.push({
        category: "processor_fee",
        label: "Processing Fees",
        amount: metrics.processingFees,
        percentOfGross: (metrics.processingFees / gross) * 100,
        trend: { value: "—", direction: "neutral" },
        ledgerHref: "/venue/finance/ledger?category=processor_fee",
    });
    if (metrics.refunds) result.push({
        category: "refund",
        label: "Refunds",
        amount: metrics.refunds,
        percentOfGross: (metrics.refunds / gross) * 100,
        trend: { value: "—", direction: "neutral" },
        ledgerHref: "/venue/finance/ledger?category=refund",
    });
    if (metrics.partnerObligations) result.push({
        category: "partner_obligation",
        label: "Partner Obligations",
        amount: metrics.partnerObligations,
        percentOfGross: (metrics.partnerObligations / gross) * 100,
        trend: { value: "—", direction: "neutral" },
        ledgerHref: "/venue/finance/ledger?category=partner_obligation",
    });

    return result;
}
