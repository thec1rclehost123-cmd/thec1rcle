"use client";

import { useState, useEffect, useCallback } from "react";
import {
    TrendingUp,
    Clock,
    CheckCircle2,
    Wallet,
    ArrowRight,
    RefreshCw,
    Award,
    IndianRupee,
} from "lucide-react";
import Link from "next/link";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { CashflowChart } from "@/components/finance/CashflowChart";
import { AnalyticsBridgeSection } from "@/components/finance/AnalyticsBridgeSection";
import {
    formatINR,
    formatINRCompact,
    pctChange,
    SETTLEMENT_STATUS_CONFIG,
    type CashflowDataPoint,
} from "@/lib/finance/definitions";
import { motion } from "framer-motion";
import {
    StatTrendCard,
    BarChartPlaceholder,
    DonutChartPlaceholder,
} from "@/components/promoter/PlaceholderCharts";

interface PromoterBalance {
    totalEarned: number;
    available: number;
    pending: number;
    totalPaid: number;
}

interface CommissionTier {
    label: string;
    threshold: number;
    rate: number;
    isActive: boolean;
}

type Period = "7d" | "30d" | "90d" | "ytd";

const mp = (delay: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as any, delay },
});

export default function PromoterFinancePageClient() {
    const { profile, getIdToken } = useDashboardAuth() as any;
    const promoterId = profile?.activeMembership?.partnerId;

    const [period, setPeriod] = useState<Period>("30d");
    const [loading, setLoading] = useState(true);
    const [balance, setBalance] = useState<PromoterBalance | null>(null);
    const [cashflow, setCashflow] = useState<CashflowDataPoint[]>([]);
    const [tiers, setTiers] = useState<CommissionTier[]>([]);

    const fetchData = useCallback(async () => {
        if (!promoterId) return;
        setLoading(true);
        try {
            const token = typeof getIdToken === "function" ? await getIdToken() : "";
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            // Fetch balance
            const balRes = await fetch(`/api/promoter/payouts?promoterId=${promoterId}`, {
                headers,
            });
            if (balRes.ok) {
                const d = await balRes.json();
                setBalance(d.balance || null);
            }

            // Fetch commissions (for cashflow approximation)
            const commRes = await fetch(
                `/api/promoter/commissions?promoterId=${promoterId}&period=${period}`,
                { headers }
            );
            if (commRes.ok) {
                const d = await commRes.json();
                setCashflow(d.cashflow || []);
                setTiers(d.tiers || []);
            }
        } catch {
            // keep defaults
        } finally {
            setLoading(false);
        }
    }, [promoterId, period, getIdToken]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return (
        <VenuePageShell
            title="Finance"
            subtitle="Your earnings, commissions, and payout status"
            actions={
                <div className="flex items-center gap-3">
                    <VenueActionButton variant="secondary" onClick={fetchData}>
                        <RefreshCw className="w-4 h-4" /> Refresh
                    </VenueActionButton>
                    <Link href="/promoter/payouts">
                        <VenueActionButton variant="primary">
                            <Wallet className="w-4 h-4" /> Request Payout
                        </VenueActionButton>
                    </Link>
                </div>
            }
        >
            {/* ── Hero: Total Earnings ── */}
            <motion.div {...mp(0)}>
                <div
                    className="relative rounded-[32px] overflow-hidden px-8 py-10 flex flex-col sm:flex-row sm:items-end justify-between gap-6"
                    style={{
                        background:
                            "linear-gradient(135deg, #150d2e 0%, #0d0920 50%, #080810 100%)",
                        border: "1px solid rgba(124,58,237,0.25)",
                    }}
                >
                    <div
                        className="absolute top-0 left-0 w-64 h-64 rounded-full blur-3xl pointer-events-none"
                        style={{ background: "rgba(124,58,237,0.12)" }}
                    />
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-3">
                            <Award className="w-4 h-4" style={{ color: "#f59e0b" }} />
                            <span className="text-[11px] font-black uppercase tracking-widest text-text-tertiary">
                                Total Settled Commissions
                            </span>
                        </div>
                        {loading ? (
                            <div
                                className="h-16 w-52 rounded-xl animate-pulse"
                                style={{ background: "rgba(255,255,255,0.06)" }}
                            />
                        ) : (
                            <p
                                className="text-[52px] font-black leading-none tabular-nums tracking-tighter"
                                style={{ color: "#fff" }}
                            >
                                {formatINR(balance?.totalPaid || 0)}
                            </p>
                        )}
                    </div>
                    <div className="flex flex-col gap-2 sm:items-end relative z-10">
                        <Link href="/promoter/payouts">
                            <button
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold"
                                style={{ background: "#f44a22", color: "#fff" }}
                            >
                                Manage Payouts <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </Link>
                        <Link href="/promoter/analytics/overview">
                            <button
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold"
                                style={{
                                    background: "rgba(255,255,255,0.06)",
                                    color: "var(--v-text-secondary)",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                }}
                            >
                                View Analytics <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </Link>
                    </div>
                </div>
            </motion.div>

            {/* ── KPI Row ── */}
            <motion.div {...mp(0.06)}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatTrendCard
                        label="Total Earned"
                        value={loading ? "—" : formatINRCompact(balance?.totalEarned || 0)}
                        trend="+18%"
                        trendUp
                        sparkData={[30, 45, 55, 50, 70, 65, 80]}
                        color="#818cf8"
                        icon={<TrendingUp className="w-4 h-4" />}
                    />
                    <StatTrendCard
                        label="Available"
                        value={loading ? "—" : formatINRCompact(balance?.available || 0)}
                        trendUp
                        sparkData={[20, 35, 30, 50, 45, 60, 55]}
                        color="#34d399"
                        icon={<Wallet className="w-4 h-4" />}
                    />
                    <StatTrendCard
                        label="Pending"
                        value={loading ? "—" : formatINRCompact(balance?.pending || 0)}
                        sparkData={[15, 20, 18, 25, 22, 28, 24]}
                        color="#f59e0b"
                        icon={<Clock className="w-4 h-4" />}
                    />
                    <StatTrendCard
                        label="Total Paid"
                        value={loading ? "—" : formatINRCompact(balance?.totalPaid || 0)}
                        sparkData={[40, 55, 50, 70, 65, 80, 75]}
                        color="#94a3b8"
                        icon={<CheckCircle2 className="w-4 h-4" />}
                    />
                </div>
            </motion.div>

            {/* ── Cashflow chart ── */}
            <motion.div {...mp(0.1)}>
                <div
                    className="rounded-[32px] p-6"
                    style={{
                        background: "var(--v-card, #1a1a1e)",
                        border: "1px solid var(--v-border)",
                    }}
                >
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[11px] font-black uppercase tracking-widest text-text-tertiary">
                            Earnings Trend
                        </span>
                    </div>
                    <CashflowChart
                        data={cashflow}
                        loading={loading}
                        showSeriesToggle={false}
                        showTimeRangePicker
                        activeRange={period}
                        onTimeRangeChange={(r) => setPeriod(r as Period)}
                        height={220}
                    />
                </div>
            </motion.div>

            {/* ── Charts Row ── */}
            <motion.div {...mp(0.14)}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <BarChartPlaceholder
                        title="Commission by Event"
                        subtitle="Earnings breakdown per promoted event"
                        color="#818cf8"
                    />
                    <DonutChartPlaceholder
                        title="Commission Type Breakdown"
                        segments={[
                            { label: "Per-ticket flat", value: 52, color: "#818cf8" },
                            { label: "Percentage-based", value: 31, color: "#7c3aed" },
                            { label: "Bonus tier", value: 11, color: "#f59e0b" },
                            { label: "Referral", value: 6, color: "#34d399" },
                        ]}
                    />
                </div>
            </motion.div>

            {/* ── Commission tiers ── */}
            {(tiers.length > 0 || !loading) && (
                <motion.div {...mp(0.18)}>
                    <div
                        className="rounded-[32px] p-6"
                        style={{
                            background: "var(--v-card, #1a1a1e)",
                            border: "1px solid var(--v-border)",
                        }}
                    >
                        <p className="text-[11px] font-black uppercase tracking-widest mb-4 text-text-tertiary">
                            Commission Tiers
                        </p>
                        {tiers.length === 0 ? (
                            <p className="text-[13px] text-text-tertiary">
                                Commission tier data will appear here once set up by your venue partner.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {tiers.map((tier) => (
                                    <div
                                        key={tier.label}
                                        className="flex items-center justify-between px-4 py-3 rounded-xl"
                                        style={{
                                            background: tier.isActive
                                                ? "rgba(129,140,248,0.08)"
                                                : "var(--v-elevated)",
                                            border: `1px solid ${
                                                tier.isActive
                                                    ? "rgba(129,140,248,0.2)"
                                                    : "var(--v-border)"
                                            }`,
                                        }}
                                    >
                                        <div>
                                            <p
                                                className="text-[13px] font-semibold"
                                                style={{
                                                    color: tier.isActive
                                                        ? "#818CF8"
                                                        : "var(--v-text-secondary)",
                                                }}
                                            >
                                                {tier.label}
                                            </p>
                                            <p
                                                className="text-[11px]"
                                                style={{ color: "var(--v-text-muted)" }}
                                            >
                                                From {formatINR(tier.threshold)} in sales
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p
                                                className="text-[16px] font-black"
                                                style={{
                                                    color: tier.isActive
                                                        ? "#818CF8"
                                                        : "var(--v-text-primary)",
                                                }}
                                            >
                                                {tier.rate}%
                                            </p>
                                            {tier.isActive && (
                                                <span
                                                    className="text-[10px] font-black px-2 py-0.5 rounded-full"
                                                    style={{
                                                        background: "rgba(129,140,248,0.15)",
                                                        color: "#818CF8",
                                                    }}
                                                >
                                                    Active
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div>
            )}

            {/* ── Minimum payout notice ── */}
            {!loading && balance && balance.available < 100 && balance.available > 0 && (
                <motion.div {...mp(0.2)}>
                    <div
                        className="flex items-center gap-3 px-5 py-4 rounded-2xl"
                        style={{
                            background: "rgba(245,158,11,0.08)",
                            border: "1px solid rgba(245,158,11,0.2)",
                        }}
                    >
                        <Clock className="w-4 h-4 shrink-0" style={{ color: "#F59E0B" }} />
                        <div>
                            <p className="text-[13px] font-semibold" style={{ color: "#F59E0B" }}>
                                Minimum payout: ₹100
                            </p>
                            <p className="text-[12px]" style={{ color: "rgba(245,158,11,0.7)" }}>
                                You need {formatINR(100 - balance.available)} more to request a
                                payout.
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* ── Analytics bridge ── */}
            <motion.div {...mp(0.22)}>
                <div
                    className="rounded-[32px] p-6"
                    style={{
                        background: "var(--v-card, #1a1a1e)",
                        border: "1px solid var(--v-border)",
                    }}
                >
                    <AnalyticsBridgeSection
                        profileType="promoter"
                        partnerId={promoterId}
                        timeRange={period}
                    />
                </div>
            </motion.div>
        </VenuePageShell>
    );
}
