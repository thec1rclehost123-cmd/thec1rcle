"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet, TrendingUp, Zap, Users, AlertTriangle, RefreshCw } from "lucide-react";
import { VenuePageShell } from "@/components/venue-layout/VenuePageShell";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { formatINRFromPaise } from "@/lib/utils/format";

interface EventOption {
    id: string;
    title: string;
    startDate: string;
}

interface Reconciliation {
    eventId: string;
    grossCollection: number;
    totalRedeemed: number;
    breakageRevenue: number;
    walletsIssued: number;
    itemDistribution: Array<{ itemId: string; name: string; count: number; totalPaise: number }>;
    exceptionList: Array<{ type: string; walletId: string; description: string }>;
    isLive: boolean;
    ticketRevenuePaise?: number;
}

export function CoverReconClient() {
    const { profile } = useDashboardAuth();
    const venueId = profile?.activeMembership?.partnerId;
    const [selectedEventId, setSelectedEventId] = useState<string>("");

    const { data, isLoading, refetch, isFetching } = useQuery<{
        events: EventOption[];
        reconciliation?: Reconciliation;
    }>({
        queryKey: ["cover-recon", venueId, selectedEventId],
        queryFn: async () => {
            const params = new URLSearchParams({ venueId: venueId! });
            if (selectedEventId) params.set("eventId", selectedEventId);
            const res = await fetch(`/api/venue/finance/cover-recon?${params}`);
            if (!res.ok) throw new Error("Failed to load cover reconciliation");
            return res.json();
        },
        enabled: !!venueId,
        staleTime: 5 * 60 * 1000,
    });

    const events = data?.events || [];
    const recon = data?.reconciliation;

    // Auto-select first event when events load
    if (events.length > 0 && !selectedEventId) {
        setSelectedEventId(events[0].id);
    }

    if (isLoading) {
        return (
            <VenuePageShell title="Cover Charge">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
                </div>
                <Skeleton className="h-48 rounded-xl" />
            </VenuePageShell>
        );
    }

    const totalRedeemable = recon ? recon.grossCollection - recon.totalRedeemed : 0;
    const payoutTotal = recon
        ? Math.round((recon.ticketRevenuePaise || 0) * 0.70) + recon.breakageRevenue
        : 0;

    return (
        <VenuePageShell
            title="Cover Charge"
            subtitle="Wallet reconciliation and breakage revenue"
            actions={
                <button
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-secondary border border-border-subtle text-[12px] font-semibold text-text-secondary hover:text-text-primary transition-all disabled:opacity-50"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
                    Refresh
                </button>
            }
        >
            {/* Event selector */}
            {events.length > 0 && (
                <div className="mb-6">
                    <label className="block text-[11px] font-bold text-text-tertiary uppercase tracking-widest mb-2">
                        Event
                    </label>
                    <select
                        value={selectedEventId}
                        onChange={e => setSelectedEventId(e.target.value)}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-surface-secondary border border-border-subtle text-[14px] text-text-primary focus:outline-none focus:border-violet-500/50 transition-all"
                    >
                        {events.map(ev => (
                            <option key={ev.id} value={ev.id}>
                                {ev.title}
                            </option>
                        ))}
                    </select>
                    {recon?.isLive && (
                        <span className="ml-3 text-[10px] font-bold uppercase tracking-widest text-amber-400">
                            Live — Event in Progress
                        </span>
                    )}
                </div>
            )}

            {!recon && !isLoading && (
                <div className="py-16 text-center rounded-xl border border-border-subtle bg-surface-secondary">
                    <Wallet className="w-8 h-8 text-text-tertiary mx-auto mb-3" />
                    <p className="text-text-tertiary text-sm font-medium">
                        {events.length === 0 ? "No cover charge events found for this venue." : "Select an event to view reconciliation."}
                    </p>
                </div>
            )}

            {recon && (
                <>
                    {/* KPI strip */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                        <KPICard
                            label="Total Collected"
                            value={formatINRFromPaise(recon.grossCollection)}
                            icon={Wallet}
                            color="violet"
                        />
                        <KPICard
                            label="Value Redeemed"
                            value={formatINRFromPaise(recon.totalRedeemed)}
                            icon={Zap}
                            color="blue"
                        />
                        <KPICard
                            label="Breakage Profit"
                            value={formatINRFromPaise(recon.breakageRevenue)}
                            icon={TrendingUp}
                            color="emerald"
                            accent
                        />
                        <KPICard
                            label="Wallets Issued"
                            value={String(recon.walletsIssued)}
                            icon={Users}
                            color="amber"
                        />
                    </div>

                    {/* Payout calculation */}
                    <div className="rounded-xl border border-border-subtle bg-surface-secondary p-5 mb-4">
                        <h3 className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest mb-4">
                            Available for Transfer
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 text-[13px] text-text-secondary">
                            <span className="font-semibold text-text-primary">
                                {recon.ticketRevenuePaise
                                    ? `${formatINRFromPaise(recon.ticketRevenuePaise)} ticket rev. × 70%`
                                    : "Ticket Revenue × 70%"}
                            </span>
                            <span className="text-text-tertiary">+</span>
                            <span className="font-semibold text-emerald-400">
                                {formatINRFromPaise(recon.breakageRevenue)} breakage × 100%
                            </span>
                            <span className="text-text-tertiary">=</span>
                            <span className="text-xl font-black text-text-primary tabular-nums">
                                {formatINRFromPaise(payoutTotal)}
                            </span>
                        </div>
                        <p className="text-[11px] text-text-tertiary mt-2">
                            Venues keep 100% of cover charge breakage (unspent credit at closure).
                        </p>
                    </div>

                    {/* Item distribution */}
                    {recon.itemDistribution.length > 0 && (
                        <div className="rounded-xl border border-border-subtle bg-surface-secondary overflow-hidden mb-4">
                            <div className="px-5 py-4 border-b border-border-subtle">
                                <h3 className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest">
                                    Item Distribution
                                </h3>
                            </div>
                            <table className="w-full text-[13px]">
                                <thead>
                                    <tr className="bg-surface-tertiary">
                                        <th className="px-5 py-3 text-left text-[10px] font-bold text-text-tertiary uppercase tracking-widest">Item</th>
                                        <th className="px-5 py-3 text-right text-[10px] font-bold text-text-tertiary uppercase tracking-widest">Times Charged</th>
                                        <th className="px-5 py-3 text-right text-[10px] font-bold text-text-tertiary uppercase tracking-widest">Total Value</th>
                                        <th className="px-5 py-3 text-right text-[10px] font-bold text-text-tertiary uppercase tracking-widest">% of Debits</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recon.itemDistribution.map((item, i) => {
                                        const pct = recon.totalRedeemed > 0
                                            ? Math.round((item.totalPaise / recon.totalRedeemed) * 100)
                                            : 0;
                                        return (
                                            <tr key={item.itemId || i} className="border-t border-border-subtle hover:bg-surface-tertiary/50 transition-all">
                                                <td className="px-5 py-3 font-medium text-text-primary">{item.name}</td>
                                                <td className="px-5 py-3 text-right text-text-secondary tabular-nums">{item.count}</td>
                                                <td className="px-5 py-3 text-right text-text-primary tabular-nums font-semibold">{formatINRFromPaise(item.totalPaise)}</td>
                                                <td className="px-5 py-3 text-right text-text-tertiary tabular-nums">{pct}%</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Exception list */}
                    {recon.exceptionList.length > 0 && (
                        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
                            <div className="flex items-center gap-2 mb-3">
                                <AlertTriangle className="w-4 h-4 text-red-400" />
                                <h3 className="text-[11px] font-bold text-red-400 uppercase tracking-widest">
                                    Exceptions ({recon.exceptionList.length})
                                </h3>
                            </div>
                            <div className="space-y-2">
                                {recon.exceptionList.map((exc, i) => (
                                    <div key={i} className="flex items-start gap-3 text-[12px]">
                                        <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[10px] font-bold uppercase tracking-widest flex-shrink-0">
                                            {exc.type}
                                        </span>
                                        <span className="text-text-secondary">{exc.description}</span>
                                        <span className="text-text-tertiary ml-auto font-mono text-[11px] flex-shrink-0">{exc.walletId}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </VenuePageShell>
    );
}

function KPICard({
    label, value, icon: Icon, color, accent,
}: {
    label: string;
    value: string;
    icon: React.FC<any>;
    color: "violet" | "blue" | "emerald" | "amber";
    accent?: boolean;
}) {
    const colorMap = {
        violet: { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500" },
        blue: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500" },
        emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500" },
        amber: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500" },
    };
    const c = colorMap[color];

    return (
        <div className={`rounded-xl border ${accent ? `border-l-[3px] ${c.border}/50 border-t-border-subtle border-r-border-subtle border-b-border-subtle` : "border-border-subtle"} bg-surface-secondary p-4`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.bg} mb-3`}>
                <Icon className={`w-4 h-4 ${c.text}`} />
            </div>
            <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-1">{label}</p>
            <p className={`text-xl font-black tabular-nums ${accent ? c.text : "text-text-primary"}`}>{value}</p>
        </div>
    );
}
