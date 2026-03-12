"use client";

import { useState, useEffect, useCallback } from "react";
import {
    TrendingUp, Clock, Wallet, CheckCircle2, RefreshCw,
    ArrowRight, Banknote, Building2, CreditCard, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { CashflowChart } from "@/components/finance/CashflowChart";
import { AnalyticsBridgeSection } from "@/components/finance/AnalyticsBridgeSection";
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
    const [metrics, setMetrics] = useState<FinanceOverviewMetrics | null>(null);
    const [cashflow, setCashflow] = useState<CashflowDataPoint[]>([]);

    const fetchData = useCallback(async () => {
        if (!hostId) return;
        setLoading(true);
        try {
            const token = typeof getIdToken === "function" ? await getIdToken() : "";
            const res = await fetch(
                `/api/host/finance/overview?hostId=${hostId}&period=${period}`,
                { headers: token ? { Authorization: `Bearer ${token}` } : {} }
            );
            if (res.ok) {
                const d = await res.json();
                setMetrics(d.metrics || null);
                setCashflow(d.cashflow || []);
            }
        } catch {
            // keep defaults
        } finally {
            setLoading(false);
        }
    }, [hostId, period, getIdToken]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const payoutStatus = metrics?.payoutFailures ? "failed" : metrics?.pendingPayouts ? "pending" : "paid";
    const payoutStatusCfg = SETTLEMENT_STATUS_CONFIG[payoutStatus];

    return (
        <div className="space-y-8 pb-12 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-white/[0.04] pb-8">
                <div>
                    <div className="flex items-center gap-3 mb-3 text-orange-500">
                        <div className="p-2 bg-orange-500/10 rounded-xl">
                            <Wallet className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest">Finance</span>
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-white">Financial Hub</h1>
                    <p className="text-sm mt-2 text-white/40 font-medium max-w-xl">
                        Personal earnings, payouts, and financial overview across your network.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchData}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.04] text-white transition-all active:scale-95"
                    >
                        <RefreshCw className="w-3.5 h-3.5 opacity-60" />
                        Refresh
                    </button>
                    <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-400 hover:to-rose-500 text-white shadow-lg shadow-orange-500/20 transition-all active:scale-95">
                        Withdraw <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Hero — Personal Earnings */}
            <div className="relative overflow-hidden bg-[#121216] border border-white/[0.04] rounded-[2.5rem] p-8 group">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-orange-500/10 rounded-full blur-[100px] pointer-events-none" />
                
                <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-500">
                                <Banknote className="w-4 h-4" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">
                                PERSONAL EARNINGS
                            </span>
                        </div>
                        {loading ? (
                            <div className="h-12 w-64 rounded-xl animate-pulse bg-white/5" />
                        ) : (
                            <p className="text-[3rem] font-black leading-none tabular-nums tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-br from-white to-white/60">
                                {formatINR(metrics?.grossRevenue || 0)}
                            </p>
                        )}
                        <p className="text-xs mt-4 text-text-tertiary font-bold uppercase tracking-widest">
                            {period === "7d" ? "LAST 7 DAYS" : period === "30d" ? "LAST 30 DAYS" : period === "90d" ? "LAST 90 DAYS" : "YEAR TO DATE"}
                        </p>
                    </div>
                    <div className="flex flex-col sm:items-end gap-3">
                        <div
                            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl shadow-lg border border-white/5"
                            style={{ background: payoutStatusCfg.bg, color: payoutStatusCfg.text, boxShadow: `0 4px 20px -5px ${payoutStatusCfg.bg}80` }}
                        >
                            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: payoutStatusCfg.dot }} />
                            Payout {payoutStatusCfg.label}
                        </div>
                        {metrics?.nextPayoutDate && (
                            <p className="text-[10px] font-black text-text-tertiary uppercase tracking-widest mt-1">
                                NEXT PAYOUT: <span className="text-white/80">{new Date(metrics.nextPayoutDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* KPI grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {[
                    { label: "Net Revenue",      value: metrics?.netRevenue,      icon: TrendingUp,    color: "#818CF8" },
                    { label: "Available",         value: metrics?.availableBalance, icon: Wallet,        color: "#F44A22", highlight: true },
                    { label: "Pending Payout",   value: metrics?.pendingPayouts,  icon: Clock,         color: "#F59E0B" },
                    { label: "Total Settled",    value: metrics?.settledPayouts,  icon: CheckCircle2,  color: "#94A3B8" },
                    { label: "Processing Fees",  value: metrics?.processingFees,  icon: CreditCard,    color: "#F87171" },
                    { label: "Platform Fees",    value: metrics?.platformFees,    icon: Building2,     color: "#FB923C" },
                    { label: "Refunds",          value: metrics?.refunds,         icon: ArrowRight,    color: "#94A3B8" },
                    { label: "Commissions",      value: metrics?.commissions,     icon: TrendingUp,    color: "#38BDF8" },
                ].map((kpi) => {
                    const Icon = kpi.icon;
                    return (
                        <div
                            key={kpi.label}
                            className={`relative flex flex-col p-6 rounded-[2rem] border transition-all duration-300 hover:scale-[1.02] ${kpi.highlight ? 'bg-orange-500/5 border-orange-500/20' : 'bg-[#121216] border-white/[0.04]'}`}
                        >
                            {kpi.highlight && <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent rounded-[2rem] pointer-events-none" />}
                            <div className="flex items-center gap-3 mb-5 relative">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg" style={{ background: `${kpi.color}15`, boxShadow: `0 4px 12px ${kpi.color}10` }}>
                                    <Icon className="w-4 h-4" style={{ color: kpi.color }} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-text-tertiary">
                                    {kpi.label}
                                </span>
                            </div>
                            {loading ? (
                                <div className="h-8 rounded-lg animate-pulse bg-white/5 w-3/4 relative" />
                            ) : (
                                <p className="text-2xl font-black tabular-nums tracking-tight relative" style={{ color: kpi.highlight ? "#F44A22" : "white" }}>
                                    {formatINRCompact(kpi.value || 0)}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Cashflow chart */}
            <div className="bg-[#121216] rounded-[2.5rem] border border-white/[0.04] p-8 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                    <span className="text-[11px] font-black uppercase tracking-widest text-text-tertiary flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-orange-500" /> EARNINGS TREND
                    </span>
                </div>
                <CashflowChart
                    data={cashflow}
                    loading={loading}
                    showSeriesToggle={false}
                    showTimeRangePicker
                    activeRange={period}
                    onTimeRangeChange={(r) => setPeriod(r as Period)}
                    height={280}
                />
            </div>

            {/* Payout quick action & Analytics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="relative overflow-hidden bg-gradient-to-br from-[#121216] to-[#0D0D0F] border border-white/[0.04] rounded-[2.5rem] p-8 group">
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                    <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-6 relative">
                        <Wallet className="w-4 h-4 text-orange-500" /> PAYOUTS
                    </p>
                    <div className="space-y-4 relative">
                        <div>
                            <p className="text-[12px] font-bold text-text-tertiary mb-1">Available to withdraw</p>
                            <p className="text-4xl font-black tracking-tight tabular-nums text-white mt-1">
                                {loading ? "—" : formatINR(metrics?.availableBalance || 0)}
                            </p>
                        </div>
                        <Link href="/host/settings" className="block mt-6">
                            <button
                                className="w-full py-4 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] text-white flex items-center justify-center gap-2 group/btn"
                            >
                                Payout Settings <ChevronRight className="w-4 h-4 opacity-40 group-hover/btn:opacity-100 group-hover/btn:translate-x-1 transition-all" />
                            </button>
                        </Link>
                    </div>
                </div>

                <div className="bg-[#121216] rounded-[2.5rem] border border-white/[0.04] p-8 flex flex-col justify-center shadow-xl">
                    <AnalyticsBridgeSection
                        profileType="host"
                        partnerId={hostId}
                        timeRange={period}
                    />
                </div>
            </div>
        </div>
    );
}
