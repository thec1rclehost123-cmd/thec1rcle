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
    TrendingUp,
    Link2,
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import Link from "next/link";
import { motion } from "framer-motion";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { BarChartPlaceholder, StatTrendCard } from "@/components/promoter/PlaceholderCharts";
import { formatNumber } from "@/lib/utils/format";

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
    wa: { label: "WhatsApp", color: "#22c55e" },
    ig: { label: "Instagram", color: "#ec4899" },
    tw: { label: "Twitter/X", color: "#94a3b8" },
    fb: { label: "Facebook", color: "#3b82f6" },
    em: { label: "Email", color: "#f59e0b" },
    ot: { label: "Other", color: "#6b7280" },
};

const mp = (delay: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as any, delay },
});

export default function GuestStreamPage() {
    const { profile, user } = useDashboardAuth();
    const [guests, setGuests] = useState<GuestEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [filterStatus, setFilterStatus] = useState<"all" | "checked_in" | "pending">("all");
    const [autoRefresh, setAutoRefresh] = useState(true);

    const promoterId = profile?.activeMembership?.partnerId;

    const fetchGuests = useCallback(
        async (isRefresh = false) => {
            if (!promoterId) return;

            if (isRefresh) setRefreshing(true);
            else { setLoading(true); setError(false); }

            try {
                const token = await user?.getIdToken();
                const res = await fetch(
                    `/api/promoter/guests?promoterId=${promoterId}&limit=50`,
                    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
                );
                const data = await res.json();
                setGuests(data.guests || []);
            } catch (err) {
                console.error("[Guest Stream] Failed to fetch:", err);
                if (!isRefresh) setError(true);
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [promoterId, user]
    );

    useEffect(() => {
        fetchGuests();
    }, [fetchGuests]);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(() => fetchGuests(true), 30000);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchGuests]);

    const filteredGuests = guests.filter((g) => {
        if (filterStatus === "checked_in") return g.checkedIn;
        if (filterStatus === "pending") return !g.checkedIn;
        return true;
    });

    const totalRevenue = guests.reduce((s, g) => s + g.amount, 0);
    const totalCommission = guests.reduce((s, g) => s + g.commission, 0);
    const totalCheckedIn = guests.filter((g) => g.checkedIn).length;

    const formatCurrency = (amt: number) =>
        new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
        }).format(amt);

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
        <VenuePageShell
            title="Guest Stream"
            actions={
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold transition-all"
                        style={
                            autoRefresh
                                ? {
                                      background: "rgba(52,211,153,0.12)",
                                      color: "#34d399",
                                      border: "1px solid rgba(52,211,153,0.25)",
                                  }
                                : {
                                      background: "var(--v-elevated)",
                                      color: "var(--v-text-tertiary)",
                                      border: "1px solid var(--v-border)",
                                  }
                        }
                    >
                        <span
                            className="w-2 h-2 rounded-full"
                            style={{
                                background: autoRefresh ? "#34d399" : "var(--v-text-muted)",
                            }}
                        />
                        {autoRefresh ? "Live" : "Paused"}
                    </button>
                    <VenueActionButton
                        variant="secondary"
                        onClick={() => fetchGuests(true)}
                        disabled={refreshing}
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                        Refresh
                    </VenueActionButton>
                </div>
            }
        >
            {/* ── Hero band ── */}
            <motion.div {...mp(0)}>
                <div
                    className="relative rounded-[32px] overflow-hidden px-6 py-7 flex items-center gap-5"
                    style={{
                        background:
                            "linear-gradient(135deg, #150d2e 0%, #0d0920 60%, #080810 100%)",
                        border: "1px solid rgba(52,211,153,0.2)",
                    }}
                >
                    <div
                        className="absolute top-0 right-0 w-56 h-56 rounded-full blur-3xl pointer-events-none"
                        style={{ background: "rgba(52,211,153,0.07)" }}
                    />
                    <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 relative z-10"
                        style={{ background: "rgba(52,211,153,0.15)", color: "#34d399" }}
                    >
                        <Activity className="w-6 h-6" />
                    </div>
                    <div className="relative z-10 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <p className="text-[11px] font-black uppercase tracking-widest text-text-tertiary">
                                Guest Stream
                            </p>
                            {autoRefresh && (
                                <span
                                    className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full"
                                    style={{
                                        background: "rgba(52,211,153,0.12)",
                                        color: "#34d399",
                                    }}
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse" />
                                    Live
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* ── Live stats strip ── */}
            <motion.div {...mp(0.06)}>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatTrendCard
                        label="Total Guests"
                        value={formatNumber(guests.length)}
                        sparkData={[20, 35, 30, 50, 45, 60, 55]}
                        color="#818cf8"
                        icon={<Users className="w-4 h-4" />}
                    />
                    <StatTrendCard
                        label="Checked In"
                        value={`${totalCheckedIn}/${guests.length}`}
                        trendUp={totalCheckedIn > 0}
                        sparkData={[10, 20, 18, 30, 28, 40, 35]}
                        color="#34d399"
                        icon={<CheckCircle2 className="w-4 h-4" />}
                    />
                    <StatTrendCard
                        label="Revenue Generated"
                        value={formatCurrency(totalRevenue)}
                        sparkData={[30, 50, 45, 65, 55, 75, 70]}
                        color="#f59e0b"
                        icon={<TrendingUp className="w-4 h-4" />}
                    />
                    <StatTrendCard
                        label="Your Commission"
                        value={formatCurrency(totalCommission)}
                        trendUp={totalCommission > 0}
                        sparkData={[15, 25, 22, 35, 30, 45, 40]}
                        color="#7c3aed"
                        icon={<IndianRupee className="w-4 h-4" />}
                    />
                </div>
            </motion.div>

            {/* ── Filter tabs ── */}
            <motion.div {...mp(0.1)}>
                <div className="flex items-center gap-2">
                    {(["all", "checked_in", "pending"] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilterStatus(f)}
                            className="px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all"
                            style={
                                filterStatus === f
                                    ? {
                                          background: "var(--v-elevated)",
                                          color: "var(--v-text-primary)",
                                          border: "1px solid var(--v-border)",
                                      }
                                    : { color: "var(--v-text-tertiary)" }
                            }
                        >
                            {f === "all" ? "All" : f === "checked_in" ? "Entered" : "Ticket Only"}
                            {f !== "all" && (
                                <span className="ml-1.5 text-[10px] font-bold opacity-50">
                                    {f === "checked_in"
                                        ? guests.filter((g) => g.checkedIn).length
                                        : guests.filter((g) => !g.checkedIn).length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </motion.div>

            {/* ── Guest list ── */}
            <motion.div {...mp(0.12)}>
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div
                                key={i}
                                className="h-20 rounded-2xl animate-pulse"
                                style={{ background: "rgba(255,255,255,0.04)" }}
                            />
                        ))}
                    </div>
                ) : error ? (
                    <div className="py-16 rounded-[32px] flex flex-col items-center text-center gap-4"
                        style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)" }}>
                        <TrendingUp className="w-10 h-10" style={{ color: "#f87171" }} />
                        <div>
                            <p className="font-black text-text-primary">Failed to load guests</p>
                            <p className="text-sm text-text-tertiary mt-1">Could not fetch your guest stream. Check your connection.</p>
                        </div>
                        <button
                            onClick={() => fetchGuests()}
                            className="px-6 py-2 rounded-xl text-sm font-bold"
                            style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
                        >
                            Retry
                        </button>
                    </div>
                ) : filteredGuests.length === 0 ? (
                    /* ── Premium empty state ── */
                    <div
                        className="py-20 rounded-[32px] flex flex-col items-center text-center"
                        style={{
                            background: "rgba(255,255,255,0.02)",
                            border: "1px dashed rgba(255,255,255,0.08)",
                        }}
                    >
                        <div
                            className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
                            style={{ background: "rgba(124,58,237,0.1)" }}
                        >
                            <Users className="w-10 h-10" style={{ color: "#7c3aed" }} />
                        </div>
                        <h3 className="text-xl font-black text-text-primary mb-2">
                            No Guests Yet
                        </h3>
                        <Link href="/promoter/links">
                            <button
                                className="px-8 py-3 rounded-xl font-bold text-sm"
                                style={{
                                    background: "rgba(124,58,237,0.15)",
                                    color: "#a78bfa",
                                    border: "1px solid rgba(124,58,237,0.3)",
                                }}
                            >
                                <Link2 className="w-4 h-4 inline mr-2" />
                                Get Your Links
                            </button>
                        </Link>
                    </div>
                ) : (
                    <div
                        className="rounded-[32px] overflow-hidden"
                        style={{
                            background: "var(--v-card, #1a1a1e)",
                            border: "1px solid var(--v-border)",
                        }}
                    >
                        {/* Table header */}
                        <div
                            className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b"
                            style={{
                                borderColor: "var(--v-border)",
                                background: "rgba(255,255,255,0.02)",
                            }}
                        >
                            {["Guest", "Event", "Amount", "Commission", "Source", "Status", "When"].map(
                                (h, i) => (
                                    <div
                                        key={h}
                                        className={`text-[10px] font-black uppercase tracking-widest text-text-tertiary ${
                                            i === 0
                                                ? "col-span-3"
                                                : i === 1
                                                ? "col-span-3"
                                                : i >= 5
                                                ? "col-span-1 text-center"
                                                : i === 6
                                                ? "col-span-2 text-right"
                                                : "col-span-1 text-right"
                                        }`}
                                    >
                                        {h}
                                    </div>
                                )
                            )}
                        </div>

                        {/* Rows */}
                        <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                            {filteredGuests.map((guest, i) => (
                                <div
                                    key={guest.id || i}
                                    className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-6 py-4 transition-all"
                                    style={{ animationDelay: `${i * 30}ms` }}
                                    onMouseEnter={(e) =>
                                        ((e.currentTarget as HTMLDivElement).style.background =
                                            "rgba(255,255,255,0.02)")
                                    }
                                    onMouseLeave={(e) =>
                                        ((e.currentTarget as HTMLDivElement).style.background =
                                            "")
                                    }
                                >
                                    {/* Guest */}
                                    <div className="col-span-3 flex items-center gap-3">
                                        <div
                                            className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0"
                                            style={{
                                                background: "rgba(124,58,237,0.15)",
                                                color: "#a78bfa",
                                            }}
                                        >
                                            {guest.guestName?.[0] ?? "?"}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-text-primary truncate">
                                                {guest.guestName}
                                            </p>
                                            <p className="text-[10px] text-text-placeholder font-medium">
                                                {guest.ticketCount} ticket
                                                {guest.ticketCount > 1 ? "s" : ""}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Event */}
                                    <div className="col-span-3 flex items-center">
                                        <p className="text-sm text-text-secondary font-medium truncate">
                                            {guest.eventTitle}
                                        </p>
                                    </div>

                                    {/* Amount */}
                                    <div className="col-span-1 flex items-center justify-end">
                                        <span className="text-sm font-bold text-text-primary tabular-nums">
                                            {formatCurrency(guest.amount)}
                                        </span>
                                    </div>

                                    {/* Commission */}
                                    <div className="col-span-1 flex items-center justify-end">
                                        <span
                                            className="text-sm font-black tabular-nums"
                                            style={{ color: "#34d399" }}
                                        >
                                            +{formatCurrency(guest.commission)}
                                        </span>
                                    </div>

                                    {/* Source */}
                                    <div className="col-span-1 flex items-center justify-center">
                                        {guest.source && SOURCE_LABELS[guest.source] ? (
                                            <span
                                                className="w-2.5 h-2.5 rounded-full"
                                                style={{
                                                    background: SOURCE_LABELS[guest.source].color,
                                                }}
                                                title={SOURCE_LABELS[guest.source].label}
                                            />
                                        ) : (
                                            <span className="text-[10px] text-text-placeholder">
                                                —
                                            </span>
                                        )}
                                    </div>

                                    {/* Status */}
                                    <div className="col-span-1 flex items-center justify-center">
                                        {guest.checkedIn ? (
                                            <span
                                                className="flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg"
                                                style={{
                                                    background: "rgba(52,211,153,0.12)",
                                                    color: "#34d399",
                                                }}
                                            >
                                                <CheckCircle2 className="w-3 h-3" />
                                                In
                                            </span>
                                        ) : (
                                            <span
                                                className="flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg"
                                                style={{
                                                    background: "rgba(245,158,11,0.1)",
                                                    color: "#f59e0b",
                                                }}
                                            >
                                                <Ticket className="w-3 h-3" />
                                                Ticket
                                            </span>
                                        )}
                                    </div>

                                    {/* Time */}
                                    <div className="col-span-2 flex items-center justify-end">
                                        <span className="text-xs text-text-placeholder font-medium">
                                            {timeAgo(guest.createdAt)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </motion.div>

            {/* ── Chart ── */}
            {guests.length > 0 && (
                <motion.div {...mp(0.16)}>
                    <BarChartPlaceholder
                        title="Guests by Event"
                        color="#818cf8"
                    />
                </motion.div>
            )}
        </VenuePageShell>
    );
}
