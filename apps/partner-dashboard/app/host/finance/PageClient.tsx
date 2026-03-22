"use client";

import { useState, useEffect, useCallback } from "react";
import {
    TrendingUp, Clock, Wallet, CheckCircle2, RefreshCw,
    ArrowRight, Banknote, Building2, CreditCard, ChevronRight,
    ArrowUpRight, Download
} from "lucide-react";
import Link from "next/link";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { CashflowChart } from "@/components/finance/CashflowChart";
import { AnalyticsBridgeSection } from "@/components/finance/AnalyticsBridgeSection";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import {
    formatINR,
    formatINRCompact,
    SETTLEMENT_STATUS_CONFIG,
    type FinanceOverviewMetrics,
    type CashflowDataPoint,
} from "@/lib/finance/definitions";

type Period = "7d" | "30d" | "90d" | "ytd";

export default function HostFinancePageClient() {
    const { profile, getIdToken } = useDashboardAuth() as any;
    const hostId = profile?.activeMembership?.partnerId;

    const [period, setPeriod]   = useState<Period>("30d");
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState(false);
    const [metrics, setMetrics] = useState<FinanceOverviewMetrics | null>(null);
    const [cashflow, setCashflow] = useState<CashflowDataPoint[]>([]);

    const fetchData = useCallback(async () => {
        if (!hostId) return;
        setLoading(true);
        setError(false);
        try {
            const token = typeof getIdToken === "function" ? await getIdToken() : "";
            const res = await fetch(
                `/api/host/finance/overview?hostId=${hostId}&period=${period}`,
                { headers: token ? { Authorization: `Bearer ${token}` } : {} }
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const d = await res.json();
            setMetrics(d.metrics || null);
            setCashflow(d.cashflow || []);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [hostId, period, getIdToken]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const payoutStatus = metrics?.payoutFailures ? "failed" : metrics?.pendingPayouts ? "pending" : "paid";
    const payoutStatusCfg = SETTLEMENT_STATUS_CONFIG[payoutStatus];

    const dynamicSubtitle = loading
        ? "Revenue, payouts, and cashflow across your productions"
        : metrics
            ? `${formatINRCompact(metrics.grossRevenue)} total · ${payoutStatusCfg.label.toLowerCase()}`
            : "Revenue, payouts, and cashflow across your productions";

    return (
        <VenuePageShell
            title="Financial Overview"
            subtitle={dynamicSubtitle}
            pageAccent="#34D399"
            actions={
                <div className="flex items-center gap-4">
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value as Period)}
                        className="bg-[var(--v-card)] border border-[var(--v-border)] rounded-[16px] px-6 py-3 text-[13px] font-black uppercase tracking-[0.1em] appearance-none cursor-pointer focus:outline-none focus:border-[var(--v-orange)] shadow-sm transition-all"
                    >
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                        <option value="90d">Last 90 Days</option>
                        <option value="ytd">Year to Date</option>
                    </select>
                    <VenueActionButton variant="secondary" className="h-[46px] px-6 text-[13px]">
                        <Download className="w-4 h-4 mr-2" /> Export
                    </VenueActionButton>
                    <VenueActionButton variant="primary" className="h-[46px] px-6 text-[13px]">
                        Withdraw <ArrowRight className="w-4 h-4 ml-2" />
                    </VenueActionButton>
                </div>
            }
        >
            {error ? (
                <div className="flex flex-col items-center justify-center py-24 rounded-[40px] border border-red-500/20 bg-red-500/5 gap-4 text-center">
                    <TrendingUp className="w-10 h-10 text-red-400" />
                    <div>
                        <p className="text-[16px] font-black text-text-primary">Failed to load financial data</p>
                        <p className="text-[13px] text-[var(--v-text-tertiary)] mt-2">Could not fetch your earnings. Check your connection and retry.</p>
                    </div>
                    <button
                        onClick={fetchData}
                        className="h-11 px-8 rounded-2xl bg-surface-tertiary border border-border-subtle text-text-primary text-[13px] font-black uppercase tracking-widest hover:bg-surface-elevated transition-all"
                    >
                        Retry
                    </button>
                </div>
            ) : (
            <div className="space-y-10 animate-in fade-in duration-500">
                {/* Hero — Personal Earnings */}
                <div className="relative overflow-hidden bg-[var(--v-card)] border border-[var(--v-border)] rounded-[56px] p-12 group bg-gradient-to-br from-[var(--v-card)] to-[var(--v-canvas)]">
                    <div className="absolute inset-0 bg-gradient-to-br from-[var(--v-orange)]/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                    
                    <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-10">
                        <div>
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-3 rounded-2xl bg-[var(--v-elevated)] text-[var(--v-orange)] shadow-xl border border-[var(--v-border)]">
                                    <Banknote className="w-6 h-6" />
                                </div>
                                <span className="text-[14px] font-black uppercase tracking-[0.2em] text-[var(--v-text-tertiary)]">
                                    CONSOLIDATED REVENUE
                                </span>
                            </div>
                            {loading ? (
                                <div className="h-20 w-80 rounded-[32px] animate-pulse bg-[var(--v-elevated)]" />
                            ) : (
                                <p className="text-[72px] font-black leading-none tabular-nums tracking-tighter text-text-primary">
                                    {formatINR(metrics?.grossRevenue || 0)}
                                </p>
                            )}
                            <p className="text-[13px] mt-8 text-[var(--v-text-tertiary)] font-black uppercase tracking-[0.2em] bg-[var(--v-elevated)] inline-flex px-4 py-2 rounded-xl border border-[var(--v-border)]">
                                {period === "7d" ? "Past 7 Days" : period === "30d" ? "Past 30 Days" : period === "90d" ? "Past 90 Days" : "Year to Date Impact"}
                            </p>
                        </div>
                        <div className="flex flex-col md:items-end gap-6">
                            <div
                                className="inline-flex items-center gap-4 text-[14px] font-black uppercase tracking-[0.1em] px-8 py-4 rounded-[24px] shadow-2xl border border-[var(--v-border)]"
                                style={{ background: payoutStatusCfg.bg, color: payoutStatusCfg.text }}
                            >
                                <span className="w-3 h-3 rounded-full animate-pulse" style={{ background: payoutStatusCfg.dot }} />
                                Payout Status: {payoutStatusCfg.label}
                            </div>
                            {metrics?.nextPayoutDate && (
                                <p className="text-[13px] font-black text-[var(--v-text-tertiary)] uppercase tracking-[0.15em] mt-2">
                                    Estimated Settlement: <span className="text-text-primary">{new Date(metrics.nextPayoutDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* KPI grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { label: "Net Earnings",      value: metrics?.netRevenue,      icon: TrendingUp,    color: "#818CF8" },
                        { label: "Hold Balance",      value: metrics?.availableBalance, icon: Wallet,        color: "var(--v-orange)", highlight: true },
                        { label: "Pending Payout",   value: metrics?.pendingPayouts,  icon: Clock,         color: "#F59E0B" },
                        { label: "Lifetime Settled",  value: metrics?.settledPayouts,  icon: CheckCircle2,  color: "var(--v-success)" },
                    ].map((kpi) => {
                        const Icon = kpi.icon;
                        return (
                            <div
                                key={kpi.label}
                                className={`relative flex flex-col p-10 rounded-[40px] border transition-all duration-300 hover:scale-[1.03] ${kpi.highlight ? 'bg-[var(--v-card)] border-[var(--v-orange)] shadow-[0_0_40px_rgba(244,74,34,0.15)]' : 'bg-[var(--v-card)] border-[var(--v-border)]'}`}
                            >
                                <div className="flex items-center gap-5 mb-8">
                                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl border border-[var(--v-border)]" style={{ background: kpi.highlight ? 'var(--v-elevated)' : 'var(--v-canvas)' }}>
                                        <Icon className="w-6 h-6" style={{ color: kpi.color }} />
                                    </div>
                                    <span className="text-[13px] font-black uppercase tracking-[0.2em] text-[var(--v-text-tertiary)]">
                                        {kpi.label}
                                    </span>
                                </div>
                                {loading ? (
                                    <div className="h-12 rounded-2xl animate-pulse bg-[var(--v-elevated)] w-3/4" />
                                ) : (
                                    <p className="text-[32px] font-black tabular-nums tracking-tighter" style={{ color: kpi.highlight ? "var(--v-orange)" : "var(--text-primary)" }}>
                                        {formatINRCompact(kpi.value || 0)}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Cashflow chart */}
                <div className="bg-[var(--v-card)] rounded-[56px] border border-[var(--v-border)] p-12 shadow-2xl">
                    <div className="flex items-center justify-between mb-10">
                        <h3 className="text-[20px] font-black tracking-tight text-text-primary flex items-center gap-4">
                            <TrendingUp className="w-6 h-6 text-[var(--v-orange)]" /> Earnings Velocity
                        </h3>
                        <div className="px-5 py-2 rounded-full bg-[var(--v-elevated)] border border-[var(--v-border)] text-[11px] font-black text-[var(--v-text-tertiary)] uppercase tracking-[0.2em]">
                            {period.toUpperCase()} PERFORMANCE
                        </div>
                    </div>
                    <CashflowChart
                        data={cashflow}
                        loading={loading}
                        showSeriesToggle={false}
                        showTimeRangePicker={false}
                        height={360}
                    />
                </div>

                {/* Payout quick action & Analytics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="relative overflow-hidden bg-[var(--v-card)] border border-[var(--v-border)] rounded-[56px] p-12 group">
                        <div className="absolute inset-0 bg-gradient-to-r from-[var(--v-orange)]/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                        <div className="flex items-center justify-between mb-10">
                            <h3 className="text-[20px] font-black tracking-tight text-text-primary flex items-center gap-4">
                                <Wallet className="w-6 h-6 text-[var(--v-orange)]" /> Payout Control
                            </h3>
                            <ChevronRight className="w-6 h-6 text-[var(--v-text-muted)] group-hover:translate-x-2 transition-transform" />
                        </div>
                        <div className="space-y-8 relative">
                            <div>
                                <p className="text-[14px] font-black text-[var(--v-text-tertiary)] uppercase tracking-[0.2em] mb-4">Withdrawable Amount</p>
                                <p className="text-[56px] font-black tracking-tighter tabular-nums text-text-primary">
                                    {loading ? "—" : formatINR(metrics?.availableBalance || 0)}
                                </p>
                            </div>
                            <div className="pt-6 flex gap-6">
                                <Link href="/host/settings" className="flex-1">
                                    <VenueActionButton variant="secondary" className="w-full h-16 text-[13px] font-black tracking-[0.1em] uppercase">
                                        Settlement Config
                                    </VenueActionButton>
                                </Link>
                                <VenueActionButton variant="primary" className="flex-1 h-16 text-[13px] font-black tracking-[0.1em] uppercase">
                                    Request Payout
                                </VenueActionButton>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[var(--v-card)] border border-[var(--v-border)] rounded-[56px] p-12 flex flex-col justify-center shadow-2xl">
                        <AnalyticsBridgeSection
                            profileType="host"
                            partnerId={hostId}
                            timeRange={period}
                        />
                    </div>
                </div>
            </div>
            )}
        </VenuePageShell>
    );
}
