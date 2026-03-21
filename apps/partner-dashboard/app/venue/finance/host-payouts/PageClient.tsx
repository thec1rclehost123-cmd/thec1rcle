"use client";

import { useQuery } from "@tanstack/react-query";
import { HandCoins, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { VenuePageShell } from "@/components/venue-layout/VenuePageShell";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import type { PartnerSettlement, PartnerPayoutsPageData } from "@/lib/types/splitFinance";
import { formatINRFromPaise } from "@/lib/utils/format";

const STATUS_CHIPS: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    processing: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    settled: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    failed: "bg-red-500/15 text-red-400 border-red-500/20",
    disputed: "bg-orange-500/15 text-orange-400 border-orange-500/20",
    held: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
};

function SettlementRow({ s }: { s: PartnerSettlement }) {
    return (
        <tr className="border-b border-border-subtle hover:bg-surface-secondary">
            <td className="py-3 px-4 text-sm text-text-primary">{s.partnerName}</td>
            <td className="py-3 px-4 text-xs text-text-secondary truncate max-w-[160px]">{s.eventName}</td>
            <td className="py-3 px-4 text-xs text-text-tertiary">{s.eventDate?.slice(0, 10)}</td>
            <td className="py-3 px-4 text-sm tabular-nums text-text-primary">{formatINRFromPaise(s.netPaise)}</td>
            <td className="py-3 px-4">
                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${STATUS_CHIPS[s.status]}`}>
                    {s.status}
                </span>
            </td>
            <td className="py-3 px-4 text-xs text-text-tertiary">
                {s.settledAt ? new Date(s.settledAt).toLocaleDateString("en-IN") : "—"}
            </td>
            <td className="py-3 px-4 text-xs text-text-tertiary max-w-[120px] truncate">
                {s.holdReason ?? ""}
            </td>
        </tr>
    );
}

export function HostPayoutsClient() {
    const { profile } = useDashboardAuth();
    const venueId = profile?.activeMembership?.partnerId;

    const { data, isLoading } = useQuery<PartnerPayoutsPageData>({
        queryKey: ["finance-host-payouts", venueId],
        queryFn: async () => {
            const res = await fetch(`/api/venue/finance/host-payouts?venueId=${venueId}`);
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        enabled: !!venueId,
        staleTime: 30_000,
    });

    return (
        <VenuePageShell
            title="Host Payouts"
            subtitle="Settlement obligations owed to hosts for their events"
        >
            {/* Totals */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="dash-card p-5">
                    <p className="text-xs text-text-tertiary mb-1">Total Owed to Hosts</p>
                    <p className="text-3xl font-semibold text-text-primary tabular-nums">
                        {formatINRFromPaise(data?.totalOwedPaise ?? 0)}
                    </p>
                </div>
                <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.03] p-5">
                    <p className="text-xs text-text-tertiary mb-1">On Hold</p>
                    <p className="text-3xl font-semibold text-amber-300 tabular-nums">
                        {formatINRFromPaise(data?.totalHeldPaise ?? 0)}
                    </p>
                </div>
            </div>

            {/* Pending */}
            <SettlementTable
                title="Pending Settlements"
                rows={data?.pendingSettlements ?? []}
                isLoading={isLoading}
            />

            {/* History */}
            <div className="mt-4">
                <SettlementTable
                    title="Settlement History"
                    rows={data?.historySettlements ?? []}
                    isLoading={isLoading}
                />
            </div>
        </VenuePageShell>
    );
}

function SettlementTable({
    title,
    rows,
    isLoading,
}: {
    title: string;
    rows: PartnerSettlement[];
    isLoading: boolean;
}) {
    return (
        <div className="rounded-xl border border-border-default overflow-hidden">
            <div className="px-4 py-3 border-b border-border-default">
                <h3 className="text-sm font-semibold text-text-secondary">{title}</h3>
            </div>
            <table className="w-full">
                <thead>
                    <tr className="border-b border-border-subtle">
                        {["Host", "Event", "Date", "Net Due", "Status", "Settled", "Note"].map((h) => (
                            <th key={h} className="py-2.5 px-4 text-left text-xs font-medium text-text-tertiary">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {isLoading && [...Array(3)].map((_, i) => (
                        <tr key={i} className="border-b border-border-subtle">
                            {[...Array(7)].map((_, j) => (
                                <td key={j} className="py-3 px-4">
                                    <Skeleton className="h-4 w-full" />
                                </td>
                            ))}
                        </tr>
                    ))}
                    {rows.map((s) => <SettlementRow key={s.id} s={s} />)}
                    {!isLoading && rows.length === 0 && (
                        <tr>
                            <td colSpan={7} className="py-10 text-center text-sm text-text-tertiary">
                                No settlements
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
