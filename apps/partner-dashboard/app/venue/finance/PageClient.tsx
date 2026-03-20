"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, RefreshCw } from "lucide-react";
import Link from "next/link";
import { VenuePageShell } from "@/components/venue-layout/VenuePageShell";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { PageToolbar } from "@/components/ui/PageToolbar";
import { TabBar } from "@/components/ui/TabBar";
import { AlertStrip } from "@/components/ui/AlertStrip";
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

const PERIOD_OPTIONS = [
    { value: "7d",  label: "7D"  },
    { value: "30d", label: "30D" },
    { value: "90d", label: "90D" },
    { value: "ytd", label: "YTD" },
] as const;

const NAV_TABS = [
    { key: "overview",  label: "Overview"  },
    { key: "payments",  label: "Payments"  },
    { key: "payouts",   label: "Payouts"   },
    { key: "reports",   label: "Reports"   },
];

export default function VenueFinancePageClient({
    period: externalPeriod,
    onPeriodChange,
}: {
    period?: Period;
    onPeriodChange?: (p: Period) => void;
}) {
    const { profile, getIdToken } = useDashboardAuth() as any;
    const venueId = profile?.activeMembership?.partnerId;

    const [internalPeriod, setInternalPeriod] = useState<Period>("30d");
    const period = externalPeriod || internalPeriod;
    const setPeriod = onPeriodChange || setInternalPeriod;

    const [activeNavTab, setActiveNavTab] = useState("overview");
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

    useEffect(() => { fetchOverview(period); }, [fetchOverview, period]);

    const grossTrend = metrics?.comparedTo ? pctChange(metrics.grossRevenue, metrics.comparedTo.grossRevenue) : undefined;
    const netTrend   = metrics?.comparedTo ? pctChange(metrics.netRevenue,   metrics.comparedTo.netRevenue)   : undefined;
    const payoutStatus = metrics?.payoutFailures ? "failed" : metrics?.pendingPayouts ? "pending" : "paid";
    const payoutStatusCfg = SETTLEMENT_STATUS_CONFIG[payoutStatus];
    const showPayoutAlert = !loading && !error && metrics && metrics.payoutFailures > 0;

    return (
        <VenuePageShell
            title="Finance"
            actions={
                <div className="flex items-center gap-2">
                    <SegmentedControl
                        options={PERIOD_OPTIONS}
                        value={period}
                        onChange={(v) => setPeriod(v as Period)}
                    />
                    {!loading && (
                        <button
                            onClick={() => fetchOverview(period)}
                            className="p-1.5 rounded-[var(--r-sm)] hover:bg-[var(--bg-fill)] transition-all active:scale-90 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                            title="Refresh"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            }
            toolbar={
                <PageToolbar
                    left={
                        <TabBar
                            mode="underline"
                            tabs={NAV_TABS}
                            active={activeNavTab}
                            onChange={setActiveNavTab}
                        />
                    }
                />
            }
        >
            <div className="flex flex-col gap-5">

                {/* Payout failure alert — thin strip, not a full card */}
                {showPayoutAlert && (
                    <AlertStrip
                        tone="error"
                        message={
                            <>
                                <span className="font-[600]">{metrics!.payoutFailures} payout{metrics!.payoutFailures > 1 ? "s" : ""} failed.</span>
                                {" "}Review your bank details to resolve.
                            </>
                        }
                        action={
                            <Link href="/venue/finance/payouts" className="text-[13px] font-[600] text-[var(--color-error)] whitespace-nowrap">
                                Fix Now →
                            </Link>
                        }
                    />
                )}

                {/* ── Hero KPI Strip: 3 primary metrics ── */}
                <SurfaceCard padding="none">
                    <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-subtle)]">
                        {[
                            {
                                label: "GROSS REVENUE",
                                value: loading ? "—" : formatINR(metrics?.grossRevenue || 0),
                                sub: `${period.toUpperCase()} total`,
                                trend: grossTrend,
                                size: "primary" as const,
                            },
                            {
                                label: "NET REVENUE",
                                value: loading ? "—" : formatINR(metrics?.netRevenue || 0),
                                sub: "after all fees",
                                trend: netTrend,
                                size: "primary" as const,
                            },
                            {
                                label: "WITHDRAWABLE",
                                value: loading ? "—" : formatINR(metrics?.availableBalance || 0),
                                sub: "ready to payout",
                                trend: undefined,
                                size: "primary" as const,
                                accent: true,
                            },
                        ].map((stat, i) => (
                            <div key={i} className="px-6 py-5 flex flex-col gap-1.5">
                                <p className="text-[12px] font-[600] uppercase tracking-[0.05em] text-[var(--text-tertiary)]">
                                    {stat.label}
                                </p>
                                <p className={cn(
                                    "text-[36px] font-[600] tracking-[-0.02em] leading-none",
                                    "tabular-nums",
                                    stat.accent ? "text-[var(--color-success)]" : "text-[var(--text-primary)]"
                                )}
                                    style={{ fontVariantNumeric: "tabular-nums" }}
                                >
                                    {stat.value}
                                </p>
                                <div className="flex items-center gap-2">
                                    {stat.trend && (
                                        <span className={cn(
                                            "text-[13px] font-[500]",
                                            stat.trend.direction === "up"   ? "text-[var(--color-success)]" : "text-[var(--color-error)]"
                                        )}>
                                            {stat.trend.direction === "up" ? "↑" : "↓"} {stat.trend.value}
                                        </span>
                                    )}
                                    <span className="text-[13px] text-[var(--text-tertiary)]">{stat.sub}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Secondary compact strip: Fees, Partner, Reserve, Status */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]"
                        style={{ background: "var(--bg-fill)" }}>
                        {[
                            { label: "FEES",    value: loading ? "—" : formatINRCompact(metrics?.processingFees || 0)  },
                            { label: "PARTNER", value: loading ? "—" : formatINRCompact(metrics?.partnerObligations || 0) },
                            { label: "RESERVE", value: loading ? "—" : formatINRCompact(metrics?.reserveBalance || 0)  },
                            { label: "STATUS",  value: payoutStatusCfg.label, color: payoutStatusCfg.text             },
                        ].map((stat, i) => (
                            <div key={i} className="px-5 py-3">
                                <p className="text-[12px] font-[600] uppercase tracking-[0.05em] text-[var(--text-tertiary)] mb-0.5">{stat.label}</p>
                                <p
                                    className="text-[14px] font-[600] tabular-nums"
                                    style={{ color: stat.color || "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}
                                >
                                    {stat.value}
                                </p>
                            </div>
                        ))}
                    </div>
                </SurfaceCard>

                {/* ── Charts Row ── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                    <SurfaceCard padding="standard" className="lg:col-span-8 flex flex-col">
                        <SurfaceCard.Header
                            title="Cashflow"
                            action={
                                !loading && metrics ? (
                                    <span className={cn(
                                        "text-[11px] font-[600] px-2 py-0.5 rounded-[var(--r-badge)]",
                                        metrics.netRevenue >= 0
                                            ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                                            : "bg-[var(--color-error-bg)] text-[var(--color-error)]"
                                    )}>
                                        Net {formatINRCompact(metrics.netRevenue || 0)}
                                    </span>
                                ) : null
                            }
                        />
                        <CashflowChart
                            data={cashflow}
                            loading={loading}
                            showSeriesToggle
                            showTimeRangePicker
                            activeRange={period}
                            onTimeRangeChange={(r) => setPeriod(r as Period)}
                            height={210}
                        />
                    </SurfaceCard>

                    <SurfaceCard padding="standard" className="lg:col-span-4">
                        <SurfaceCard.Header
                            title="Allocation"
                            action={
                                <Link href="/venue/finance/ledger" className="text-[12px] text-[var(--accent)] hover:underline">
                                    Full Ledger
                                </Link>
                            }
                        />
                        <RevenueBreakdown
                            items={breakdown.length > 0 ? breakdown : defaultBreakdown(metrics)}
                            grossRevenue={metrics?.grossRevenue || 0}
                            loading={loading}
                            layout="list"
                        />
                    </SurfaceCard>
                </div>

                {/* ── Insights Bridge ── */}
                <SurfaceCard padding="standard" className="overflow-hidden">
                    <SurfaceCard.Header
                        title="Insights"
                        subtitle={null}
                        action={<TrendingUp className="w-4 h-4 text-[var(--text-tertiary)]" strokeWidth={1.5} />}
                    />
                    <AnalyticsBridgeSection
                        profileType="venue"
                        partnerId={venueId}
                        timeRange={period}
                    />
                </SurfaceCard>

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
