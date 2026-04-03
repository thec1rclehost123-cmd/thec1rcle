"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import type { PayoutRequest } from "@/lib/types/splitFinance";
import { randomUUID } from "@/lib/utils/uuid";
import { formatINRFromPaise } from "@/lib/utils/format";

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; border: string; label: string }> = {
    pending:    { icon: Clock,         color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.25)",  label: "Pending" },
    processing: { icon: Clock,         color: "#93c5fd", bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.25)",  label: "Processing" },
    settled:    { icon: CheckCircle,   color: "#34d399", bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.25)",  label: "Settled" },
    failed:     { icon: XCircle,       color: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.25)", label: "Failed" },
    disputed:   { icon: AlertCircle,   color: "#fb923c", bg: "rgba(251,146,60,0.12)",  border: "rgba(251,146,60,0.25)",  label: "Disputed" },
    held:       { icon: AlertCircle,   color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.25)",  label: "On Hold" },
};

function PayoutPillRow({ payout }: { payout: PayoutRequest }) {
    const payoutAny = payout as PayoutRequest & { eventName?: string; eventDate?: string | null };
    const cfg = STATUS_CONFIG[payout.status] ?? STATUS_CONFIG["pending"];
    const Icon = cfg.icon;
    const dateStr = new Date(payout.requestedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const detail = payoutAny.eventName
        ? `${payoutAny.eventName}${payoutAny.eventDate ? " · " + new Date(payoutAny.eventDate).toLocaleDateString("en-IN") : ""}`
        : (payout.method ? `${payout.method}${payout.methodDetail ? " · " + payout.methodDetail : ""}` : "Venue payout");
    return (
        <div style={{
            display: "flex", alignItems: "center", gap: 14,
            borderRadius: 18, padding: "12px 16px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
        }}>
            {/* Status icon circle */}
            <div style={{
                width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: cfg.bg, border: `2px solid ${cfg.border}`,
            }}>
                <Icon size={16} style={{ color: cfg.color }} />
            </div>

            {/* Date + detail */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.88)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {dateStr}
                </p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.36)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {detail}
                </p>
            </div>

            {/* Amount + status badge */}
            <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p className="tabular-nums" style={{ fontSize: 15, fontWeight: 700, color: cfg.color, letterSpacing: "-0.01em" }}>
                    {formatINRFromPaise(payout.amountPaise)}
                </p>
                <span style={{
                    display: "inline-block", marginTop: 4,
                    fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em",
                    background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                    borderRadius: 100, padding: "2px 7px",
                }}>
                    {cfg.label}
                </span>
            </div>
        </div>
    );
}

export function VenuePayoutsClient() {
    const { profile } = useDashboardAuth();
    const venueId = profile?.activeMembership?.partnerId;
    const qc = useQueryClient();
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ["finance-venue-payouts", venueId],
        queryFn: async () => {
            const res = await fetch(`/api/venue/finance/venue-payouts?venueId=${venueId}`);
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        enabled: !!venueId,
        staleTime: 30_000,
    });

    const balance = data?.balance;
    const history: PayoutRequest[] = data?.history ?? [];

    return (
        <VenuePageShell
            title="Venue Payouts"
            subtitle="Your withdrawable balance and payout history"
            actions={
                <VenueActionButton
                    icon={ArrowDownToLine}
                    onClick={() => setShowWithdrawModal(true)}
                    disabled={!balance || balance.withdrawablePaise < 100}
                >
                    Withdraw
                </VenueActionButton>
            }
        >
            {/* Balance cards — glassmorphism */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {[
                    { label: "Withdrawable Balance", value: formatINRFromPaise(balance?.withdrawablePaise ?? 0), glow: "rgba(52,211,153,0.22)", border: "rgba(52,211,153,0.22)", accent: "#34d399" },
                    { label: "Pending Settlement",   value: formatINRFromPaise(balance?.pendingSettlementPaise ?? 0), glow: "rgba(251,191,36,0.22)", border: "rgba(251,191,36,0.22)", accent: "#fbbf24" },
                ].map((card) => (
                    <div key={card.label} style={{ position: "relative", overflow: "hidden", borderRadius: "1.25rem" }}>
                        <div style={{
                            position: "absolute", inset: 0, pointerEvents: "none",
                            background: `radial-gradient(ellipse at 60% -10%, ${card.glow} 0%, transparent 65%)`,
                        }} />
                        <div style={{
                            position: "relative", zIndex: 1,
                            background: "rgba(14,14,16,0.94)",
                            border: `1px solid ${card.border}`,
                            borderRadius: "1.25rem",
                            padding: "20px 24px",
                        }}>
                            <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: card.accent, marginBottom: 10 }}>
                                {card.label}
                            </p>
                            {isLoading ? (
                                <Skeleton className="h-9 w-32" />
                            ) : (
                                <p className="tabular-nums" style={{ fontSize: 34, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1 }}>
                                    {card.value}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Payout history — pill rows */}
            <div style={{ background: "rgba(18,18,20,0.96)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "1.25rem", overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <h3 style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.16em", color: "rgba(255,255,255,0.42)" }}>
                        Withdrawal History
                    </h3>
                </div>
                <div className="p-4 space-y-2">
                    {isLoading && [...Array(4)].map((_, i) => (
                        <div key={i} className="h-16 animate-pulse rounded-[18px]" style={{ background: "rgba(255,255,255,0.04)" }} />
                    ))}
                    {history.map((p) => <PayoutPillRow key={p.id} payout={p} />)}
                    {!isLoading && history.length === 0 && (
                        <div className="py-12 text-center" style={{ color: "rgba(255,255,255,0.36)", fontSize: 14 }}>
                            No payout history yet
                        </div>
                    )}
                </div>
            </div>
        </VenuePageShell>
    );
}
