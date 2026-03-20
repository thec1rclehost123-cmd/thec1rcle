"use client";

import { useQuery } from "@tanstack/react-query";
import { Wallet, CreditCard, Receipt, RefreshCw, Check, AlertTriangle } from "lucide-react";
import { VenuePageShell } from "@/components/venue-layout/VenuePageShell";
import { KPITile } from "@/components/ui/KPITile";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import type { PaymentsPageData } from "@/lib/types/splitFinance";
import { formatINRFromPaise } from "@/lib/utils/format";

const PLAN_COLORS: Record<string, string> = {
    basic: "bg-zinc-500/15 text-zinc-400",
    silver: "bg-slate-500/15 text-slate-300",
    gold: "bg-amber-500/15 text-amber-400",
    diamond: "bg-cyan-500/15 text-cyan-300",
};

export function PaymentsClient() {
    const { profile } = useDashboardAuth();
    const venueId = profile?.activeMembership?.partnerId;

    const { data, isLoading } = useQuery<PaymentsPageData>({
        queryKey: ["finance-payments", venueId],
        queryFn: async () => {
            const res = await fetch(`/api/venue/finance/payments?venueId=${venueId}`);
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        enabled: !!venueId,
        staleTime: 60_000,
    });

    if (isLoading) {
        return (
            <VenuePageShell title="Payments">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
                </div>
                <Skeleton className="h-40 rounded-xl" />
            </VenuePageShell>
        );
    }

    const wallet = data?.wallet;
    const sub = data?.subscription;

    return (
        <VenuePageShell
            title="Payments"
            subtitle="Wallet balance, subscription, and billing methods"
        >
            {/* Wallet KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-fill)] p-5">
                    <p className="text-xs text-[var(--text-tertiary)] mb-1">Available</p>
                    <p className="text-2xl font-semibold text-[var(--text-primary)] tabular-nums">
                        {formatINRFromPaise(wallet?.availablePaise ?? 0)}
                    </p>
                </div>
                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-fill)] p-5">
                    <p className="text-xs text-[var(--text-tertiary)] mb-1">Pending</p>
                    <p className="text-2xl font-semibold text-[var(--text-secondary)] tabular-nums">
                        {formatINRFromPaise(wallet?.pendingPaise ?? 0)}
                    </p>
                </div>
                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-fill)] p-5">
                    <p className="text-xs text-[var(--text-tertiary)] mb-1">On Hold</p>
                    <p className="text-2xl font-semibold text-[var(--text-secondary)] tabular-nums">
                        {formatINRFromPaise(wallet?.heldPaise ?? 0)}
                    </p>
                </div>
            </div>

            {/* Subscription */}
            {sub && (
                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-fill)] p-5 mb-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Subscription</h3>
                        <span className={`inline-flex items-center rounded-md border border-transparent px-2 py-0.5 text-xs font-medium capitalize ${PLAN_COLORS[sub.plan]}`}>
                            {sub.plan}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                            <p className="text-xs text-[var(--text-tertiary)]">Status</p>
                            <p className="text-sm text-[var(--text-primary)] capitalize">{sub.status.replace("_", " ")}</p>
                        </div>
                        <div>
                            <p className="text-xs text-[var(--text-tertiary)]">Amount</p>
                            <p className="text-sm text-[var(--text-primary)] tabular-nums">{formatINRFromPaise(sub.amountPaise)}/mo</p>
                        </div>
                        <div>
                            <p className="text-xs text-[var(--text-tertiary)]">Next Billing</p>
                            <p className="text-sm text-[var(--text-primary)]">{sub.nextBillingDate ?? "—"}</p>
                        </div>
                        <div>
                            <p className="text-xs text-[var(--text-tertiary)]">Autopay</p>
                            <p className="text-sm text-[var(--text-primary)] flex items-center gap-1">
                                {sub.autopayEnabled
                                    ? <><Check className="h-3.5 w-3.5 text-emerald-400" /> Enabled</>
                                    : <><AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> Disabled</>
                                }
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Billing methods */}
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-fill)] p-5">
                <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">Billing Methods</h3>
                {(!data?.billingMethods || data.billingMethods.length === 0) ? (
                    <p className="text-sm text-[var(--text-tertiary)]">No billing methods added yet.</p>
                ) : (
                    <div className="space-y-3">
                        {data.billingMethods.map((bm) => (
                            <div key={bm.id} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <CreditCard className="h-4 w-4 text-[var(--text-tertiary)]" />
                                    <div>
                                        <p className="text-sm text-[var(--text-primary)]">{bm.label}</p>
                                        <p className="text-xs text-[var(--text-tertiary)]">{bm.maskedDetail}</p>
                                    </div>
                                </div>
                                {bm.isDefault && (
                                    <span className="text-xs text-[var(--text-tertiary)] border border-[var(--border-default)] rounded px-2 py-0.5">
                                        Default
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </VenuePageShell>
    );
}
