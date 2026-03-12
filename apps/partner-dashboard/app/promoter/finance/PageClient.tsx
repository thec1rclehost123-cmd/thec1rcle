"use client";

import { useState, useEffect, useCallback } from "react";
import {
    TrendingUp, Clock, CheckCircle2, Wallet, ReceiptText,
    ArrowRight, RefreshCw, Award,
} from "lucide-react";
import Link from "next/link";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { CashflowChart } from "@/components/finance/CashflowChart";
import { AnalyticsBridgeSection } from "@/components/finance/AnalyticsBridgeSection";
import {
    formatINR,
    formatINRCompact,
    pctChange,
    SETTLEMENT_STATUS_CONFIG,
    type CashflowDataPoint,
} from "@/lib/finance/definitions";

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

export default function PromoterFinancePageClient() {
    const { profile, getIdToken } = useDashboardAuth() as any;
    const promoterId = profile?.activeMembership?.partnerId;

    const [period, setPeriod]     = useState<Period>("30d");
    const [loading, setLoading]   = useState(true);
    const [balance, setBalance]   = useState<PromoterBalance | null>(null);
    const [cashflow, setCashflow] = useState<CashflowDataPoint[]>([]);
    const [tiers, setTiers]       = useState<CommissionTier[]>([]);

    const fetchData = useCallback(async () => {
        if (!promoterId) return;
        setLoading(true);
        try {
            const token = typeof getIdToken === "function" ? await getIdToken() : "";
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            // Fetch balance
            const balRes = await fetch(`/api/promoter/payouts?promoterId=${promoterId}`, { headers });
            if (balRes.ok) {
                const d = await balRes.json();
                setBalance(d.balance || null);
            }

            // Fetch commissions (for cashflow approximation)
            const commRes = await fetch(`/api/promoter/commissions?promoterId=${promoterId}&period=${period}`, { headers });
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

    const settledStatus = SETTLEMENT_STATUS_CONFIG["paid"];
    const pendingStatus = SETTLEMENT_STATUS_CONFIG["pending"];

    return (
        <div className="space-y-6 pb-20">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6" style={{ borderBottom: "1px solid var(--v-border)" }}>
                <div>
                    <h1 className="text-[28px] font-bold tracking-tight" style={{ color: "var(--v-text-primary, #fff)" }}>
                        Finance
                    </h1>
                    <p className="text-[14px] mt-1" style={{ color: "var(--v-text-secondary, rgba(255,255,255,0.5))" }}>
                        Your earnings, commissions, and payout status
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchData}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all hover:brightness-110"
                        style={{ background: "var(--v-elevated)", color: "var(--v-text-secondary)", border: "1px solid var(--v-border)" }}
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Refresh
                    </button>
                    <Link href="/promoter/payouts">
                        <button
                            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-bold transition-all hover:brightness-110 active:scale-[0.98]"
                            style={{ background: "var(--v-orange)", color: "#fff" }}
                        >
                            <Wallet className="w-4 h-4" />
                            Request Payout
                        </button>
                    </Link>
                </div>
            </div>

            {/* Hero: Settled Commissions */}
            <div
                className="rounded-2xl px-8 py-10 flex flex-col sm:flex-row sm:items-end justify-between gap-6"
                style={{ background: "var(--v-hero, #0d0d10)", border: "1px solid var(--v-border)" }}
            >
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Award className="w-4 h-4" style={{ color: "var(--v-orange)" }} />
                        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--v-text-muted)" }}>
                            TOTAL SETTLED COMMISSIONS
                        </span>
                    </div>
                    {loading ? (
                        <div className="h-16 w-48 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.06)" }} />
                    ) : (
                        <p className="text-[52px] font-bold leading-none tabular-nums tracking-tight" style={{ color: "var(--v-text-primary, #fff)" }}>
                            {formatINR(balance?.totalPaid || 0)}
                        </p>
                    )}
                </div>
                <div className="flex flex-col gap-2 sm:items-end">
                    <Link href="/promoter/payouts">
                        <button
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold"
                            style={{ background: "var(--v-orange)", color: "#fff" }}
                        >
                            Manage Payouts <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    </Link>
                    <Link href="/promoter/analytics">
                        <button
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold"
                            style={{ background: "var(--v-elevated)", color: "var(--v-text-secondary)", border: "1px solid var(--v-border)" }}
                        >
                            View Analytics <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    </Link>
                </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    {
                        label: "Total Earned",
                        value: loading ? "—" : formatINRCompact(balance?.totalEarned || 0),
                        icon: TrendingUp,
                        color: "#818CF8",
                    },
                    {
                        label: "Available",
                        value: loading ? "—" : formatINRCompact(balance?.available || 0),
                        icon: Wallet,
                        color: "#34D399",
                        highlight: true,
                    },
                    {
                        label: "Pending",
                        value: loading ? "—" : formatINRCompact(balance?.pending || 0),
                        icon: Clock,
                        color: "#F59E0B",
                    },
                    {
                        label: "Total Paid",
                        value: loading ? "—" : formatINRCompact(balance?.totalPaid || 0),
                        icon: CheckCircle2,
                        color: "#94A3B8",
                    },
                ].map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <div
                            key={stat.label}
                            className="flex flex-col p-5 rounded-2xl"
                            style={{
                                background: stat.highlight ? "rgba(52,211,153,0.07)" : "var(--v-card, #1a1a1e)",
                                border: `1px solid ${stat.highlight ? "rgba(52,211,153,0.2)" : "var(--v-border)"}`,
                            }}
                        >
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${stat.color}18` }}>
                                    <Icon className="w-4 h-4" style={{ color: stat.color }} />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--v-text-muted)" }}>
                                    {stat.label}
                                </span>
                            </div>
                            {loading ? (
                                <div className="h-8 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.06)", width: "80%" }} />
                            ) : (
                                <p className="text-[24px] font-bold tabular-nums leading-none" style={{ color: stat.highlight ? "#34D399" : "var(--v-text-primary, #fff)" }}>
                                    {stat.value}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Earnings cashflow */}
            <div
                className="rounded-2xl p-6"
                style={{ background: "var(--v-card, #1a1a1e)", border: "1px solid var(--v-border)" }}
            >
                <div className="flex items-center justify-between mb-4">
                    <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--v-text-muted)" }}>
                        EARNINGS TREND
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

            {/* Commission tiers */}
            {(tiers.length > 0 || !loading) && (
                <div
                    className="rounded-2xl p-6"
                    style={{ background: "var(--v-card, #1a1a1e)", border: "1px solid var(--v-border)" }}
                >
                    <p className="text-[11px] font-bold uppercase tracking-widest mb-4" style={{ color: "var(--v-text-muted)" }}>
                        COMMISSION TIERS
                    </p>
                    {tiers.length === 0 ? (
                        <p className="text-[13px]" style={{ color: "var(--v-text-muted)" }}>
                            Commission tier data will appear here once set up by your venue partner.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {tiers.map((tier) => (
                                <div
                                    key={tier.label}
                                    className="flex items-center justify-between px-4 py-3 rounded-xl"
                                    style={{
                                        background: tier.isActive ? "rgba(129,140,248,0.08)" : "var(--v-elevated)",
                                        border: `1px solid ${tier.isActive ? "rgba(129,140,248,0.2)" : "var(--v-border)"}`,
                                    }}
                                >
                                    <div>
                                        <p className="text-[13px] font-semibold" style={{ color: tier.isActive ? "#818CF8" : "var(--v-text-secondary)" }}>
                                            {tier.label}
                                        </p>
                                        <p className="text-[11px]" style={{ color: "var(--v-text-muted)" }}>
                                            From {formatINR(tier.threshold)} in sales
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[16px] font-bold" style={{ color: tier.isActive ? "#818CF8" : "var(--v-text-primary)" }}>
                                            {tier.rate}%
                                        </p>
                                        {tier.isActive && (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(129,140,248,0.15)", color: "#818CF8" }}>
                                                Active
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Minimum payout notice */}
            {!loading && balance && balance.available < 100 && balance.available > 0 && (
                <div
                    className="flex items-center gap-3 px-5 py-4 rounded-2xl"
                    style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}
                >
                    <Clock className="w-4 h-4 shrink-0" style={{ color: "#F59E0B" }} />
                    <div>
                        <p className="text-[13px] font-semibold" style={{ color: "#F59E0B" }}>Minimum payout: ₹100</p>
                        <p className="text-[12px]" style={{ color: "rgba(245,158,11,0.7)" }}>
                            You need {formatINR(100 - balance.available)} more to request a payout.
                        </p>
                    </div>
                </div>
            )}

            {/* Analytics bridge */}
            <div
                className="rounded-2xl p-6"
                style={{ background: "var(--v-card, #1a1a1e)", border: "1px solid var(--v-border)" }}
            >
                <AnalyticsBridgeSection
                    profileType="promoter"
                    partnerId={promoterId}
                    timeRange={period}
                />
            </div>
        </div>
    );
}
