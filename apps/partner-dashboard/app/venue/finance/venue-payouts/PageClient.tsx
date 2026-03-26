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

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    pending: { icon: Clock, color: "text-amber-400", label: "Pending" },
    processing: { icon: Clock, color: "text-blue-400", label: "Processing" },
    settled: { icon: CheckCircle, color: "text-emerald-400", label: "Settled" },
    failed: { icon: XCircle, color: "text-red-400", label: "Failed" },
    disputed: { icon: AlertCircle, color: "text-orange-400", label: "Disputed" },
    held: { icon: AlertCircle, color: "text-amber-400", label: "On Hold" },
};

function PayoutRow({ payout }: { payout: PayoutRequest }) {
    const cfg = STATUS_CONFIG[payout.status] ?? STATUS_CONFIG["pending"];
    const Icon = cfg.icon;
    return (
        <tr className="border-b border-border-subtle hover:bg-surface-secondary transition-colors">
            <td className="py-3 px-4 text-sm text-text-primary tabular-nums">{formatINRFromPaise(payout.amountPaise)}</td>
            <td className="py-3 px-4 text-xs text-text-secondary capitalize">{payout.method}</td>
            <td className="py-3 px-4 text-xs text-text-tertiary">{payout.methodDetail}</td>
            <td className="py-3 px-4">
                <span className={`flex items-center gap-1.5 text-xs ${cfg.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {cfg.label}
                </span>
            </td>
            <td className="py-3 px-4 text-xs text-text-tertiary">
                {new Date(payout.requestedAt).toLocaleDateString("en-IN")}
            </td>
            <td className="py-3 px-4 text-xs text-text-tertiary">
                {payout.settledAt ? new Date(payout.settledAt).toLocaleDateString("en-IN") : "—"}
            </td>
        </tr>
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
            {/* Balance cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="dash-card p-5">
                    <p className="text-xs text-text-tertiary mb-1">Withdrawable Balance</p>
                    {isLoading ? (
                        <Skeleton className="h-8 w-32" />
                    ) : (
                        <p className="text-3xl font-semibold text-text-primary tabular-nums">
                            {formatINRFromPaise(balance?.withdrawablePaise ?? 0)}
                        </p>
                    )}
                </div>
                <div className="dash-card p-5">
                    <p className="text-xs text-text-tertiary mb-1">Pending Settlement</p>
                    {isLoading ? (
                        <Skeleton className="h-8 w-32" />
                    ) : (
                        <p className="text-3xl font-semibold text-text-secondary tabular-nums">
                            {formatINRFromPaise(balance?.pendingSettlementPaise ?? 0)}
                        </p>
                    )}
                </div>
            </div>

            {/* History table */}
            <div className="rounded-xl border border-border-default overflow-hidden">
                <div className="px-4 py-3 border-b border-border-default">
                    <h3 className="text-sm font-semibold text-text-secondary">Withdrawal History</h3>
                </div>
                <div className="overflow-x-auto">
                <table className="w-full min-w-[480px]">
                    <thead>
                        <tr className="border-b border-border-subtle">
                            {["Amount", "Method", "Account", "Status", "Requested", "Settled"].map((h) => (
                                <th key={h} className="py-2.5 px-4 text-left text-xs font-medium text-text-tertiary">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading && [...Array(3)].map((_, i) => (
                            <tr key={i} className="border-b border-border-subtle">
                                {[...Array(6)].map((_, j) => (
                                    <td key={j} className="py-3 px-4">
                                        <Skeleton className="h-4 w-full" />
                                    </td>
                                ))}
                            </tr>
                        ))}
                        {history.map((p) => <PayoutRow key={p.id} payout={p} />)}
                        {!isLoading && history.length === 0 && (
                            <tr>
                                <td colSpan={6} className="py-12 text-center text-sm text-text-tertiary">
                                    No payout history yet
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                </div>
            </div>
        </VenuePageShell>
    );
}
