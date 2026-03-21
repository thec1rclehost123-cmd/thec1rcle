"use client";

import { useState, useEffect, useCallback } from "react";
import {
    CheckCircle2, Clock, AlertCircle, XCircle, ArrowRight,
    Building2, CreditCard, ShieldCheck, Download, RefreshCw,
    Banknote, Plus, Info,
} from "lucide-react";
import Link from "next/link";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { AppleHeroStat } from "@/components/ui/AppleHeroStat";
import { VenueStatStrip } from "@/components/ui/VenueStatStrip";
import { BentoCard } from "@/components/ui/BentoCard";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import {
    formatINR,
    formatINRCompact,
    SETTLEMENT_STATUS_CONFIG,
    type PayoutRecord,
    type PayoutSettingsState,
    type PayoutMethod,
} from "@/lib/finance/definitions";

// ── Payout Settings Page ──────────────────────────────────────────────────────

export default function VenuePayoutsSettingsClient() {
    const { profile, getIdToken } = useDashboardAuth() as any;
    const venueId = profile?.activeMembership?.partnerId;

    const [settingsState, setSettingsState] = useState<PayoutSettingsState>("unconnected");
    const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalSettled, setTotalSettled] = useState(0);
    const [availableBalance, setAvailableBalance] = useState(0);

    const fetchPayouts = useCallback(async () => {
        if (!venueId) return;
        setLoading(true);
        try {
            const token = typeof getIdToken === "function" ? await getIdToken() : "";
            const res = await fetch(`/api/venue/finance/overview?venueId=${venueId}&period=90d`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (res.ok) {
                const data = await res.json();
                setAvailableBalance(data.metrics?.availableBalance || 0);
                setTotalSettled(data.metrics?.settledPayouts || 0);
                // payoutState is returned by the gateway's finance/summary as part of metrics
                const rawPayoutState = (data.metrics as any)?.payoutState as PayoutSettingsState | undefined;
                if (rawPayoutState) setSettingsState(rawPayoutState);
            }
        } catch {
            // keep defaults
        } finally {
            setLoading(false);
        }
    }, [venueId, getIdToken]);

    useEffect(() => {
        fetchPayouts();
    }, [fetchPayouts]);

    return (
        <VenuePageShell
            title="Payout Settings"
            subtitle="Bank account, payout schedule, and settlement history"
            actions={
                <VenueActionButton variant="ghost" onClick={fetchPayouts}>
                    <RefreshCw className="w-3.5 h-3.5" />
                    Refresh
                </VenueActionButton>
            }
        >
            {/* Payout status card */}
            {settingsState === "unconnected" ? (
                <UnconnectedPayoutState venueId={venueId} />
            ) : (
                <>
                    {/* Hero available balance */}
                    <AppleHeroStat
                        label="AVAILABLE BALANCE"
                        value={loading ? "—" : formatINR(availableBalance)}
                        subtitle="Eligible for immediate withdrawal"
                        loading={loading}
                        noData={!loading && !availableBalance}
                        cta={{ label: "Withdraw Now", href: "#" }}
                    />

                    {/* Stats */}
                    <VenueStatStrip
                        columns={3}
                        stats={[
                            { label: "TOTAL SETTLED (90D)", value: loading ? "—" : formatINRCompact(totalSettled), loading },
                            { label: "PAYOUT SCHEDULE",     value: "Weekly (Mon)", icon: <Clock className="w-3.5 h-3.5" /> },
                            { label: "ACTIVE ACCOUNT",      value: "HDFC •••• 8821", icon: <CreditCard className="w-3.5 h-3.5" /> },
                        ]}
                    />

                    {/* Payout history */}
                    <PayoutHistoryTable payouts={payouts} loading={loading} />
                </>
            )}

            {/* Bank account section */}
            <BankAccountSection state={settingsState} />

            {/* Payout schedule section */}
            <PayoutScheduleSection />
        </VenuePageShell>
    );
}

// ── Unconnected State ─────────────────────────────────────────────────────────

function UnconnectedPayoutState({ venueId }: { venueId: string }) {
    return (
        <div
            className="rounded-[var(--v-r-xl)] overflow-hidden"
            style={{ background: "var(--v-card)", border: "1px solid var(--v-border)" }}
        >
            {/* Trust header */}
            <div className="px-8 py-10 text-center" style={{ borderBottom: "1px solid var(--v-border)" }}>
                <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                    style={{ background: "rgba(var(--v-orange-rgb, 244,74,34),0.12)" }}
                >
                    <Banknote className="w-7 h-7" style={{ color: "var(--v-orange)" }} />
                </div>
                <h2 className="text-[20px] font-bold mb-2" style={{ color: "var(--v-text-primary)" }}>
                    Connect a Bank Account
                </h2>
                <p className="text-[14px] max-w-sm mx-auto" style={{ color: "var(--v-text-secondary)" }}>
                    Set up payouts to receive your venue's earnings directly to your bank account. Secure, fast, and compliant.
                </p>
            </div>

            {/* Trust signals */}
            <div className="grid grid-cols-3 divide-x" style={{ borderBottom: "1px solid var(--v-border)", borderColor: "var(--v-border)" }}>
                {[
                    { icon: ShieldCheck, label: "Bank-grade encryption", desc: "256-bit TLS + data at rest" },
                    { icon: CheckCircle2, label: "RBI compliant",         desc: "Regulated payout rails" },
                    { icon: Clock,        label: "T+1 settlements",       desc: "Next business day payouts" },
                ].map((t) => (
                    <div key={t.label} className="px-6 py-5 text-center">
                        <t.icon className="w-5 h-5 mx-auto mb-2" style={{ color: "#34D399" }} />
                        <p className="text-[12px] font-semibold" style={{ color: "var(--v-text-primary)" }}>{t.label}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--v-text-muted)" }}>{t.desc}</p>
                    </div>
                ))}
            </div>

            {/* Blocked capabilities */}
            <div className="px-8 py-6" style={{ borderBottom: "1px solid var(--v-border)" }}>
                <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--v-text-muted)" }}>
                    UNLOCKED AFTER SETUP
                </p>
                <div className="grid grid-cols-2 gap-2">
                    {[
                        "Instant balance withdrawal",
                        "Automated weekly payouts",
                        "Payout history & receipts",
                        "Partner settlement controls",
                        "Tax document generation",
                        "PDF statements",
                    ].map((cap) => (
                        <div key={cap} className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: "#34D399" }} />
                            <span className="text-[12px]" style={{ color: "var(--v-text-secondary)" }}>{cap}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* CTA */}
            <div className="px-8 py-6 flex items-center gap-3">
                <button
                    className="flex-1 py-3.5 rounded-xl text-[14px] font-bold transition-all hover:brightness-110 active:scale-[0.98]"
                    style={{ background: "var(--v-orange)", color: "#fff" }}
                >
                    Start Payout Setup
                </button>
                <button
                    className="px-5 py-3.5 rounded-xl text-[14px] font-semibold"
                    style={{ background: "var(--v-elevated)", color: "var(--v-text-secondary)", border: "1px solid var(--v-border)" }}
                >
                    Learn More
                </button>
            </div>
        </div>
    );
}

// ── Bank Account Section ──────────────────────────────────────────────────────

function BankAccountSection({ state }: { state: PayoutSettingsState }) {
    return (
        <BentoCard
            header={
                <div className="flex items-center justify-between w-full">
                    <span className="v-label">BANK ACCOUNT</span>
                    {state === "active" && (
                        <button
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
                            style={{ background: "var(--v-elevated)", color: "var(--v-text-secondary)", border: "1px solid var(--v-border)" }}
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Add Account
                        </button>
                    )}
                </div>
            }
        >
            {state === "unconnected" ? (
                <div className="flex items-center gap-3 py-2">
                    <Info className="w-4 h-4 shrink-0" style={{ color: "var(--v-text-muted)" }} />
                    <p className="text-[13px]" style={{ color: "var(--v-text-muted)" }}>
                        No bank account connected. Complete setup above to enable payouts.
                    </p>
                </div>
            ) : (
                <div
                    className="flex items-center gap-4 p-4 rounded-xl"
                    style={{ background: "var(--v-elevated)", border: "1px solid var(--v-border)" }}
                >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(52,211,153,0.12)" }}>
                        <Building2 className="w-5 h-5" style={{ color: "#34D399" }} />
                    </div>
                    <div>
                        <p className="text-[14px] font-semibold" style={{ color: "var(--v-text-primary)" }}>HDFC Bank</p>
                        <p className="text-[12px]" style={{ color: "var(--v-text-muted)" }}>Account ending •••• 8821 · RTGS/NEFT enabled</p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full" style={{ background: "rgba(52,211,153,0.12)", color: "#34D399" }}>
                            Verified
                        </span>
                    </div>
                </div>
            )}
        </BentoCard>
    );
}

// ── Payout Schedule ───────────────────────────────────────────────────────────

function PayoutScheduleSection() {
    const [schedule, setSchedule] = useState<"daily" | "weekly" | "monthly" | "manual">("weekly");

    const options = [
        { value: "daily",   label: "Daily",   desc: "Every business day" },
        { value: "weekly",  label: "Weekly",  desc: "Every Monday" },
        { value: "monthly", label: "Monthly", desc: "1st of each month" },
        { value: "manual",  label: "Manual",  desc: "On-demand only" },
    ] as const;

    return (
        <BentoCard header={<span className="v-label">PAYOUT SCHEDULE</span>}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {options.map((opt) => {
                    const active = schedule === opt.value;
                    return (
                        <button
                            key={opt.value}
                            onClick={() => setSchedule(opt.value)}
                            className="flex flex-col items-start gap-1 p-4 rounded-xl text-left transition-all duration-150"
                            style={{
                                background: active ? "rgba(var(--v-orange-rgb, 244,74,34),0.1)" : "var(--v-elevated)",
                                border: `1px solid ${active ? "rgba(var(--v-orange-rgb, 244,74,34),0.3)" : "var(--v-border)"}`,
                            }}
                        >
                            <span className="text-[13px] font-bold" style={{ color: active ? "var(--v-orange)" : "var(--v-text-primary)" }}>
                                {opt.label}
                            </span>
                            <span className="text-[11px]" style={{ color: "var(--v-text-muted)" }}>
                                {opt.desc}
                            </span>
                        </button>
                    );
                })}
            </div>
        </BentoCard>
    );
}

// ── Payout History Table ──────────────────────────────────────────────────────

function PayoutHistoryTable({ payouts, loading }: { payouts: PayoutRecord[]; loading: boolean }) {
    return (
        <BentoCard
            header={
                <div className="flex items-center justify-between w-full">
                    <span className="v-label">SETTLEMENT HISTORY</span>
                    <button
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
                        style={{ background: "var(--v-elevated)", color: "var(--v-text-secondary)", border: "1px solid var(--v-border)" }}
                    >
                        <Download className="w-3.5 h-3.5" />
                        Export
                    </button>
                </div>
            }
            loading={loading}
            empty={!loading && payouts.length === 0}
            emptyTitle="No payout history yet"
            emptyIcon={<Banknote className="w-8 h-8" />}
            padding="sm"
        >
            <div className="divide-y" style={{ borderColor: "var(--v-border)" }}>
                {payouts.map((p) => {
                    const cfg = SETTLEMENT_STATUS_CONFIG[p.status];
                    return (
                        <div key={p.id} className="flex items-center gap-4 px-5 py-4">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${cfg.bg}` }}>
                                <Banknote className="w-4 h-4" style={{ color: cfg.text }} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-semibold" style={{ color: "var(--v-text-primary)" }}>
                                    {formatINR(p.amount)}
                                </p>
                                <p className="text-[11px]" style={{ color: "var(--v-text-muted)" }}>
                                    {p.destination} · {new Date(p.requestedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                </p>
                            </div>
                            <span
                                className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full"
                                style={{ background: cfg.bg, color: cfg.text }}
                            >
                                {cfg.label}
                            </span>
                            <button style={{ color: "var(--v-text-muted)" }}>
                                <Download className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </BentoCard>
    );
}
