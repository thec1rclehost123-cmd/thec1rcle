"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Users,
    Activity,
    CheckCircle2,
    Clock,
    Ticket,
    IndianRupee,
    RefreshCw,
    ArrowUpRight,
    Zap,
    Eye,
    Filter,
    TrendingUp
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import Link from "next/link";

interface GuestEntry {
    id: string;
    guestName: string;
    eventTitle: string;
    eventId: string;
    amount: number;
    commission: number;
    ticketCount: number;
    status: string;
    checkedIn: boolean;
    source: string | null;
    createdAt: string;
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
    wa: { label: "WhatsApp", color: "bg-green-500" },
    ig: { label: "Instagram", color: "bg-pink-500" },
    tw: { label: "Twitter/X", color: "bg-slate-800" },
    fb: { label: "Facebook", color: "bg-blue-600" },
    em: { label: "Email", color: "bg-amber-500" },
    ot: { label: "Other", color: "bg-gray-400" },
};

export default function GuestStreamPage() {
    const { profile, user } = useDashboardAuth();
    const [guests, setGuests] = useState<GuestEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filterStatus, setFilterStatus] = useState<"all" | "checked_in" | "pending">("all");
    const [autoRefresh, setAutoRefresh] = useState(true);

    const promoterId = profile?.activeMembership?.partnerId;

    const fetchGuests = useCallback(async (isRefresh = false) => {
        if (!promoterId) return;

        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const token = await user?.getIdToken();
            const res = await fetch(`/api/promoter/guests?promoterId=${promoterId}&limit=50`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            const data = await res.json();
            setGuests(data.guests || []);
        } catch (err) {
            console.error("[Guest Stream] Failed to fetch:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [promoterId, user]);

    useEffect(() => {
        fetchGuests();
    }, [fetchGuests]);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(() => fetchGuests(true), 30000);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchGuests]);

    const filteredGuests = guests.filter(g => {
        if (filterStatus === "checked_in") return g.checkedIn;
        if (filterStatus === "pending") return !g.checkedIn;
        return true;
    });

    const totalRevenue = guests.reduce((s, g) => s + g.amount, 0);
    const totalCommission = guests.reduce((s, g) => s + g.commission, 0);
    const totalCheckedIn = guests.filter(g => g.checkedIn).length;

    const formatCurrency = (amt: number) =>
        new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amt);

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "Just now";
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ago`;
    };

    return (
        <div className="space-y-8 pb-20 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border-default pb-8">
                <div>
                    <div className="flex items-center gap-3 mb-3 text-emerald-600">
                        <div className="p-2 bg-emerald-50 rounded-xl">
                            <Activity className="w-5 h-5" />
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-[0.2em]">Live Feed</span>
                        {autoRefresh && (
                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                Auto-updating
                            </span>
                        )}
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold text-text-primary tracking-tight">Guest Stream</h1>
                    <p className="text-text-tertiary text-base font-medium mt-2 max-w-xl">
                        Real-time feed of every ticket purchase made through your links.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${autoRefresh
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                            : "bg-surface-secondary text-text-tertiary border border-border-default"
                            }`}
                    >
                        {autoRefresh ? "Live" : "Paused"}
                    </button>
                    <button
                        onClick={() => fetchGuests(true)}
                        disabled={refreshing}
                        className="p-2.5 rounded-xl bg-surface-elevated border border-border-default hover:border-border-strong transition-all"
                    >
                        <RefreshCw className={`w-4 h-4 text-text-tertiary ${refreshing ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {/* Summary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard label="Total Guests" value={guests.length.toString()} icon={Users} color="indigo" />
                <SummaryCard label="Revenue Generated" value={formatCurrency(totalRevenue)} icon={TrendingUp} color="emerald" />
                <SummaryCard label="Your Commission" value={formatCurrency(totalCommission)} icon={IndianRupee} color="amber" />
                <SummaryCard label="Checked In" value={`${totalCheckedIn}/${guests.length}`} icon={CheckCircle2} color="blue" />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2">
                {(["all", "checked_in", "pending"] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilterStatus(f)}
                        className={`px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${filterStatus === f
                            ? "bg-surface-elevated text-text-primary border border-border-strong shadow-sm"
                            : "text-text-tertiary hover:text-text-secondary"
                            }`}
                    >
                        {f === "all" ? "All" : f === "checked_in" ? "Entered" : "Ticket Only"}
                        {f !== "all" && (
                            <span className="ml-1.5 text-[10px] font-bold opacity-50">
                                {f === "checked_in"
                                    ? guests.filter(g => g.checkedIn).length
                                    : guests.filter(g => !g.checkedIn).length
                                }
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Guest Stream */}
            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-20 rounded-2xl bg-surface-elevated border border-border-subtle animate-pulse" />
                    ))}
                </div>
            ) : filteredGuests.length === 0 ? (
                <div className="py-20 bg-surface-elevated rounded-[3rem] border border-dashed border-border-default flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-surface-tertiary rounded-2xl flex items-center justify-center mb-6">
                        <Users className="w-10 h-10 text-text-placeholder" />
                    </div>
                    <h3 className="text-xl font-bold text-text-primary mb-2">No Guests Yet</h3>
                    <p className="text-text-tertiary text-sm font-medium max-w-xs mx-auto mb-8">
                        When someone buys a ticket through your link, they'll appear here in real-time.
                    </p>
                    <Link href="/promoter/links" className="px-8 py-3 bg-surface-secondary text-text-primary rounded-xl font-bold text-sm hover:bg-surface-tertiary transition-all">
                        Get Your Links
                    </Link>
                </div>
            ) : (
                <div className="bg-surface-elevated rounded-[2rem] border border-border-default overflow-hidden">
                    {/* Table Header */}
                    <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b border-border-subtle bg-surface-secondary/50">
                        <div className="col-span-3 text-[10px] font-black text-text-tertiary uppercase tracking-widest">Guest</div>
                        <div className="col-span-3 text-[10px] font-black text-text-tertiary uppercase tracking-widest">Event</div>
                        <div className="col-span-1 text-[10px] font-black text-text-tertiary uppercase tracking-widest text-right">Amount</div>
                        <div className="col-span-1 text-[10px] font-black text-text-tertiary uppercase tracking-widest text-right">Commission</div>
                        <div className="col-span-1 text-[10px] font-black text-text-tertiary uppercase tracking-widest text-center">Source</div>
                        <div className="col-span-1 text-[10px] font-black text-text-tertiary uppercase tracking-widest text-center">Status</div>
                        <div className="col-span-2 text-[10px] font-black text-text-tertiary uppercase tracking-widest text-right">When</div>
                    </div>

                    {/* Rows */}
                    <div className="divide-y divide-border-subtle">
                        {filteredGuests.map((guest, i) => (
                            <div
                                key={guest.id || i}
                                className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-6 py-4 hover:bg-surface-secondary/30 transition-all group"
                                style={{ animationDelay: `${i * 30}ms` }}
                            >
                                {/* Guest */}
                                <div className="col-span-3 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-surface-secondary border border-border-subtle flex items-center justify-center text-sm font-bold text-text-tertiary flex-shrink-0">
                                        {guest.guestName[0]}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-text-primary truncate">{guest.guestName}</p>
                                        <p className="text-[10px] text-text-placeholder font-medium">
                                            {guest.ticketCount} ticket{guest.ticketCount > 1 ? "s" : ""}
                                        </p>
                                    </div>
                                </div>

                                {/* Event */}
                                <div className="col-span-3 flex items-center">
                                    <p className="text-sm text-text-secondary font-medium truncate">{guest.eventTitle}</p>
                                </div>

                                {/* Amount */}
                                <div className="col-span-1 flex items-center justify-end">
                                    <span className="text-sm font-bold text-text-primary">{formatCurrency(guest.amount)}</span>
                                </div>

                                {/* Commission */}
                                <div className="col-span-1 flex items-center justify-end">
                                    <span className="text-sm font-bold text-emerald-600">+{formatCurrency(guest.commission)}</span>
                                </div>

                                {/* Source */}
                                <div className="col-span-1 flex items-center justify-center">
                                    {guest.source && SOURCE_LABELS[guest.source] ? (
                                        <span className={`w-2.5 h-2.5 rounded-full ${SOURCE_LABELS[guest.source].color}`} title={SOURCE_LABELS[guest.source].label} />
                                    ) : (
                                        <span className="text-[10px] text-text-placeholder">—</span>
                                    )}
                                </div>

                                {/* Status */}
                                <div className="col-span-1 flex items-center justify-center">
                                    {guest.checkedIn ? (
                                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                                            <CheckCircle2 className="w-3 h-3" />
                                            In
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                                            <Ticket className="w-3 h-3" />
                                            Ticket
                                        </span>
                                    )}
                                </div>

                                {/* Time */}
                                <div className="col-span-2 flex items-center justify-end">
                                    <span className="text-xs text-text-placeholder font-medium">{timeAgo(guest.createdAt)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function SummaryCard({ label, value, icon: Icon, color }: {
    label: string;
    value: string;
    icon: any;
    color: string;
}) {
    const colors: Record<string, string> = {
        indigo: "bg-indigo-50 text-indigo-600",
        emerald: "bg-emerald-50 text-emerald-600",
        amber: "bg-amber-50 text-amber-600",
        blue: "bg-blue-50 text-blue-600",
    };

    return (
        <div className="p-5 rounded-2xl bg-surface-elevated border border-border-default hover:border-border-strong transition-all">
            <div className="flex items-center gap-2.5 mb-3">
                <div className={`h-8 w-8 rounded-lg ${colors[color]} flex items-center justify-center`}>
                    <Icon className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-black text-text-tertiary uppercase tracking-widest">{label}</span>
            </div>
            <p className="text-2xl font-black text-text-primary tracking-tight">{value}</p>
        </div>
    );
}
