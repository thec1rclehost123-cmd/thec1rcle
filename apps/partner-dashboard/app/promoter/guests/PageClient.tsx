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
    Plus,
    X,
    Loader2,
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

    // ── Add Guest modal state ────────────────────────────────────────────────
    const [assignOpen, setAssignOpen] = useState(false);
    const [assignTicketId, setAssignTicketId] = useState("");
    const [assignEventId, setAssignEventId] = useState("");
    const [assignEvents, setAssignEvents] = useState<{ id: string; title: string }[]>([]);
    const [assignEventsLoaded, setAssignEventsLoaded] = useState(false);
    type AssignStep = "idle" | "looking_up" | "preview" | "confirming" | "assigned"
                   | "already_assigned" | "wrong_event" | "invalid" | "no_link" | "error";
    const [assignStep, setAssignStep] = useState<AssignStep>("idle");
    const [assignMsg, setAssignMsg] = useState("");
    const [assignPreview, setAssignPreview] = useState<{
        guestName: string; userEmail: string; eventName: string;
        totalAmount: number; ticketCount: number; checkedIn: boolean;
    } | null>(null);

    const promoterId = profile?.activeMembership?.partnerId;

    const fetchGuests = useCallback(
        async (isRefresh = false) => {
            if (!promoterId) return;

            if (isRefresh) setRefreshing(true);
            else { setLoading(true); setError(false); }

            try {
                const token = await user?.getIdToken();
                const res = await fetch(
                    `/api/partners/promoters/guests?promoterId=${promoterId}&limit=50`,
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

    // ── Add Guest handlers ───────────────────────────────────────────────────
    const openAssignModal = async () => {
        setAssignOpen(true);
        setAssignTicketId("");
        setAssignEventId("");
        setAssignStep("idle");
        setAssignMsg("");
        setAssignPreview(null);

        if (!assignEventsLoaded && promoterId) {
            try {
                const token = await user?.getIdToken();
                const res = await fetch(`/api/partners/promoters/events?promoterId=${promoterId}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                const data = await res.json();
                const evts = (data.events || data.assignments || []).map((e: any) => ({
                    id: e.eventId || e.id,
                    title: e.eventTitle || e.title || "Unnamed event",
                }));
                setAssignEvents(evts);
                if (evts.length === 1) setAssignEventId(evts[0].id);
            } catch { /* fail silently */ }
            setAssignEventsLoaded(true);
        }
    };

    // Step 1 — Look up the order, show preview
    const lookupTicket = async () => {
        if (!assignTicketId.trim() || !assignEventId) return;
        setAssignStep("looking_up");
        setAssignPreview(null);
        try {
            const token = await user?.getIdToken();
            const res = await fetch(
                `/api/promoter/guests/lookup?orderId=${encodeURIComponent(assignTicketId.trim())}&eventId=${encodeURIComponent(assignEventId)}`,
                { headers: token ? { Authorization: `Bearer ${token}` } : {} }
            );
            const data = await res.json();
            const c = data.case as string;
            if (c === "can_assign") {
                setAssignPreview(data.order);
                setAssignStep("preview");
            } else {
                setAssignStep(c as AssignStep);
                const msgs: Record<string, string> = {
                    already_assigned: "This ticket is already attributed to a promoter.",
                    wrong_event: "This ticket belongs to a different event.",
                    invalid: "No confirmed order found with this ID.",
                    error: "Something went wrong. Please try again.",
                };
                setAssignMsg(msgs[c] ?? "Unexpected response.");
            }
        } catch {
            setAssignStep("error");
            setAssignMsg("Something went wrong. Please try again.");
        }
    };

    // Step 2 — Confirm and assign
    const confirmAssign = async () => {
        if (!assignTicketId.trim() || !assignEventId) return;
        setAssignStep("confirming");
        try {
            const token = await user?.getIdToken();
            const res = await fetch("/api/promoter/guests/assign", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ orderId: assignTicketId.trim(), eventId: assignEventId }),
            });
            const data = await res.json();
            const c = (data.case ?? "error") as AssignStep;
            if (c === "assigned") {
                setAssignStep("assigned");
                setAssignMsg("Guest added successfully!");
                fetchGuests(true);
                setTimeout(() => setAssignOpen(false), 1800);
            } else {
                setAssignStep(c);
                const msgs: Record<string, string> = {
                    already_assigned: "This ticket is already attributed to a promoter.",
                    wrong_event: "This ticket belongs to a different event.",
                    invalid: "No confirmed order found with this ID.",
                    no_link: "Create a tracking link for this event first, then retry.",
                    error: "Something went wrong. Please try again.",
                };
                setAssignMsg(msgs[c] ?? "Unexpected response.");
            }
        } catch {
            setAssignStep("error");
            setAssignMsg("Something went wrong. Please try again.");
        }
    };

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
                    <VenueActionButton
                        variant="primary"
                        onClick={openAssignModal}
                    >
                        <Plus className="w-4 h-4" />
                        Add Guest
                    </VenueActionButton>
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
            {/* ── Add Guest Modal (2-step: Look Up → Preview → Confirm) ── */}
            {assignOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setAssignOpen(false)} />

                    <div className="relative w-full max-w-md rounded-[24px] border border-white/10 p-6 shadow-2xl" style={{ background: "#0e0e12" }}>

                        {/* Header */}
                        <div className="mb-5 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-white">Add Guest by Ticket ID</h3>
                                <p className="mt-0.5 text-xs text-white/40">
                                    {assignStep === "preview" ? "Confirm you want to add this guest" : "Look up a confirmed order to attribute it to you"}
                                </p>
                            </div>
                            <button onClick={() => setAssignOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-white/40 transition-all hover:bg-white/10 hover:text-white">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* ── STEP 1: Entry form ── */}
                        {(assignStep === "idle" || assignStep === "looking_up" || assignStep === "already_assigned" || assignStep === "wrong_event" || assignStep === "invalid" || assignStep === "no_link" || assignStep === "error") && (
                            <>
                                {/* Event selector */}
                                <div className="mb-4">
                                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-white/40">Event</label>
                                    {assignEvents.length > 0 ? (
                                        <select
                                            value={assignEventId}
                                            onChange={(e) => { setAssignEventId(e.target.value); setAssignStep("idle"); }}
                                            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-violet-500/50"
                                        >
                                            <option value="">Select an event…</option>
                                            {assignEvents.map((ev) => (
                                                <option key={ev.id} value={ev.id}>{ev.title}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            value={assignEventId}
                                            onChange={(e) => { setAssignEventId(e.target.value); setAssignStep("idle"); }}
                                            placeholder="Event ID"
                                            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/50"
                                        />
                                    )}
                                </div>

                                {/* Ticket ID input */}
                                <div className="mb-5">
                                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-white/40">Ticket / Order ID</label>
                                    <input
                                        type="text"
                                        value={assignTicketId}
                                        onChange={(e) => { setAssignTicketId(e.target.value); setAssignStep("idle"); }}
                                        placeholder="e.g. ORD-abc123xyz"
                                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/50"
                                        onKeyDown={(e) => e.key === "Enter" && lookupTicket()}
                                    />
                                </div>

                                {/* Error feedback */}
                                {["already_assigned", "wrong_event", "invalid", "no_link", "error"].includes(assignStep) && (
                                    <div className="mb-4 rounded-xl px-4 py-3 text-sm font-medium" style={{ background: "rgba(239,68,68,0.10)", color: "#f87171", border: "1px solid rgba(239,68,68,0.20)" }}>
                                        {assignMsg}
                                    </div>
                                )}

                                {/* Look Up button */}
                                <button
                                    onClick={lookupTicket}
                                    disabled={assignStep === "looking_up" || !assignTicketId.trim() || !assignEventId}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40"
                                    style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.25)" }}
                                >
                                    {assignStep === "looking_up" ? (
                                        <><Loader2 className="h-4 w-4 animate-spin" />Looking up…</>
                                    ) : (
                                        <><Plus className="h-4 w-4" />Look Up Ticket</>
                                    )}
                                </button>
                            </>
                        )}

                        {/* ── STEP 2: Preview + Confirm ── */}
                        {(assignStep === "preview" || assignStep === "confirming" || assignStep === "assigned") && assignPreview && (
                            <>
                                {/* Order preview card */}
                                <div className="mb-5 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/15 text-sm font-bold text-violet-300">
                                            {assignPreview.guestName.slice(0, 1).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-bold text-white">{assignPreview.guestName}</p>
                                            <p className="text-xs text-white/40">{assignPreview.userEmail}</p>
                                        </div>
                                        {assignPreview.checkedIn && (
                                            <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">Checked In</span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        {[
                                            { label: "Event", value: assignPreview.eventName },
                                            { label: "Amount", value: `₹${assignPreview.totalAmount.toLocaleString("en-IN")}` },
                                            { label: "Tickets", value: String(assignPreview.ticketCount) },
                                        ].map(({ label, value }) => (
                                            <div key={label} className="rounded-xl bg-white/[0.04] p-2">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-white/35">{label}</p>
                                                <p className="mt-0.5 text-xs font-bold text-white truncate">{value}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Success message */}
                                {assignStep === "assigned" && (
                                    <div className="mb-4 rounded-xl px-4 py-3 text-sm font-medium" style={{ background: "rgba(52,211,153,0.10)", color: "#34d399", border: "1px solid rgba(52,211,153,0.20)" }}>
                                        {assignMsg}
                                    </div>
                                )}

                                {/* Action buttons */}
                                {assignStep !== "assigned" && (
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => { setAssignStep("idle"); setAssignPreview(null); }}
                                            className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-bold text-white/50 transition-all hover:border-white/20 hover:text-white/70"
                                        >
                                            Go Back
                                        </button>
                                        <button
                                            onClick={confirmAssign}
                                            disabled={assignStep === "confirming"}
                                            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all disabled:opacity-50"
                                            style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}
                                        >
                                            {assignStep === "confirming" ? (
                                                <><Loader2 className="h-4 w-4 animate-spin" />Adding…</>
                                            ) : (
                                                <><CheckCircle2 className="h-4 w-4" />Confirm Add</>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}

                        <p className="mt-4 text-center text-[10px] text-white/20">
                            Only unattributed confirmed tickets · 50 per event limit
                        </p>
                    </div>
                </div>
            )}
        </VenuePageShell>
    );
}
