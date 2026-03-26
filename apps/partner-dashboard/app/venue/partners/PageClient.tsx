"use client";

import { useState, useCallback, useEffect } from "react";
import {
    CheckCircle2, Clock, XCircle, Search, Loader2,
    UserCircle, ChevronRight, Handshake, Zap, X, Bell,
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { VenuePageShell } from "@/components/venue-layout/VenuePageShell";
import { DiscoverDirectory } from "@/components/partnerships/DiscoverDirectory";
import { NetworkProfileModal, NetworkProfile } from "@/components/partnerships/NetworkProfileModal";
import { TierSelectionModal, ContractTier } from "@/components/partnerships/TierSelectionModal";
import { StatTrendCard } from "@/components/promoter/PlaceholderCharts";
import { motion, AnimatePresence } from "framer-motion";
import { formatMonthYear } from "@/lib/utils/format";

type Tab = "discover" | "incoming" | "pending" | "active" | "declined";

interface Connection {
    id: string;
    type: string;
    otherId: string;
    otherName: string;
    otherType: "host" | "promoter";
    status: string;
    tier?: "trusted" | "standard";
    createdAt: any;
    updatedAt?: any;
    message?: string;
    initiatedBy?: string;
}

const mp = (delay: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as any, delay },
});

export default function VenuePartnersPage() {
    const { profile, user } = useDashboardAuth();
    const [activeTab, setActiveTab] = useState<Tab>("discover");
    const [connections, setConnections] = useState<Connection[]>([]);
    const [loading, setLoading] = useState(true);
    const [profileTarget, setProfileTarget] = useState<NetworkProfile | null>(null);
    const [tierTarget, setTierTarget] = useState<Connection | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const venueId = profile?.activeMembership?.partnerId;
    const venueName = profile?.displayName;

    const fetchData = useCallback(async () => {
        if (!venueId || !user) { setLoading(false); return; }
        setLoading(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch(
                `/api/discovery?action=list&partnerId=${venueId}&role=venue`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!res.ok) throw new Error(`${res.status}`);
            const data = await res.json();
            setConnections(data.connections || []);
        } catch (err) {
            console.error("[VenuePartners] fetch error:", err);
        } finally {
            setLoading(false);
        }
    }, [venueId, user]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleApproveWithTier = async (tier: ContractTier, connectionId: string) => {
        const conn = connections.find(c => c.id === connectionId);
        try {
            const token = await user?.getIdToken();
            await fetch("/api/discovery", {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ connectionId, action: "approve", type: conn?.type, tier, role: "venue", partnerId: venueId, partnerName: venueName }),
            });
            setTierTarget(null);
            await fetchData();
        } catch { alert("Failed to approve partnership."); }
    };

    const handleDecline = async (connectionId: string) => {
        const conn = connections.find(c => c.id === connectionId);
        setProcessingId(connectionId);
        try {
            const token = await user?.getIdToken();
            await fetch("/api/discovery", {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ connectionId, action: "reject", type: conn?.type, role: "venue", partnerId: venueId }),
            });
            await fetchData();
        } catch { /* */ } finally { setProcessingId(null); }
    };

    const active = connections.filter(c => c.status === "approved" || c.status === "active");
    const allPending = connections.filter(c => c.status === "pending");
    const pendingIncoming = allPending.filter(c => c.initiatedBy !== "venue");
    const pendingOutgoing = allPending.filter(c => c.initiatedBy === "venue");
    const declined = connections.filter(c => c.status === "rejected");

    const TABS: { id: Tab; label: string; count?: number }[] = [
        { id: "discover", label: "Discover" },
        { id: "incoming", label: "Incoming", count: pendingIncoming.length },
        { id: "pending", label: "Pending", count: pendingOutgoing.length },
        { id: "active", label: "Active", count: active.length },
        { id: "declined", label: "Declined", count: declined.length },
    ];

    return (
        <VenuePageShell
            title="Partners"
            subtitle="Hosts and promoters who operate with your venue"
            actions={
                <div className="flex gap-3">
                    <div className="px-5 py-3 rounded-2xl text-center" style={{ background: "var(--v-card)", border: "1px solid var(--v-border)" }}>
                        <p className="text-[20px] font-black tabular-nums" style={{ color: "var(--v-text-primary)" }}>{active.length}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--v-text-tertiary)" }}>Active</p>
                    </div>
                    <div className="px-5 py-3 rounded-2xl text-center" style={{ background: "var(--v-card)", border: "1px solid var(--v-border)" }}>
                        <p className="text-[20px] font-black tabular-nums" style={{ color: "#f59e0b" }}>{allPending.length}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--v-text-tertiary)" }}>Pending</p>
                    </div>
                </div>
            }
        >
            {/* Hero banner */}
            <motion.div {...mp(0)}>
                <div
                    className="relative rounded-[32px] overflow-hidden px-6 py-7 flex items-center gap-5"
                    style={{ background: "linear-gradient(135deg, #1a0e05 0%, #0f0a05 60%, #080808 100%)", border: "1px solid rgba(244,74,34,0.2)" }}
                >
                    <div className="absolute top-0 right-0 w-56 h-56 rounded-full blur-3xl pointer-events-none" style={{ background: "rgba(244,74,34,0.08)" }} />
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 relative z-10" style={{ background: "rgba(244,74,34,0.15)", color: "#F44A22" }}>
                        <Handshake className="w-6 h-6" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-[11px] font-black uppercase tracking-widest text-text-tertiary mb-1">Partner Network</p>
                        <p className="text-[13px] font-medium text-text-secondary max-w-lg">
                            Connect with hosts and promoters to build your event production network and grow your venue's reach.
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* Stats strip */}
            <motion.div {...mp(0.06)}>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatTrendCard label="Active Partners" value={active.length} trendUp={active.length > 0} color="#34d399" icon={<CheckCircle2 className="w-4 h-4" />} />
                    <StatTrendCard label="Pending Requests" value={allPending.length} color="#f59e0b" icon={<Clock className="w-4 h-4" />} />
                    <StatTrendCard label="Hosts Connected" value={active.filter(c => c.otherType === "host").length} color="#F44A22" icon={<UserCircle className="w-4 h-4" />} />
                    <StatTrendCard label="Promoters Connected" value={active.filter(c => c.otherType === "promoter").length} color="#818cf8" icon={<Zap className="w-4 h-4" />} />
                </div>
            </motion.div>

            {/* Tab bar */}
            <motion.div {...mp(0.1)}>
                <div className="flex items-center p-1.5 rounded-2xl w-fit overflow-x-auto" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all shrink-0"
                            style={activeTab === tab.id
                                ? { background: "var(--v-elevated)", color: "var(--v-text-primary)" }
                                : { color: "var(--v-text-tertiary)" }}
                        >
                            {tab.id === "discover" && <Search className={`w-4 h-4 ${activeTab === tab.id ? "text-[#818cf8]" : ""}`} />}
                            {tab.id === "incoming" && <Bell className={`w-4 h-4 ${activeTab === tab.id ? "text-[#F44A22]" : ""}`} />}
                            {tab.id === "pending" && <Clock className={`w-4 h-4 ${activeTab === tab.id ? "text-[#f59e0b]" : ""}`} />}
                            {tab.id === "active" && <CheckCircle2 className={`w-4 h-4 ${activeTab === tab.id ? "text-[#34d399]" : ""}`} />}
                            {tab.id === "declined" && <XCircle className="w-4 h-4" />}
                            {tab.label}
                            {tab.count !== undefined && tab.count > 0 && (
                                <span
                                    className="px-1.5 py-0.5 rounded-md text-[10px] font-black"
                                    style={activeTab === tab.id
                                        ? { background: "#F44A22", color: "#fff" }
                                        : { background: "rgba(255,255,255,0.06)", color: "var(--v-text-tertiary)" }}
                                >
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </motion.div>

            {/* Content */}
            <div className="min-h-[500px]">
                <AnimatePresence mode="wait">
                    {activeTab === "discover" ? (
                        <motion.div key="discover" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            <DiscoverDirectory allowedTypes={["host", "promoter"]} partnerId={venueId} role="venue" />
                        </motion.div>
                    ) : activeTab === "incoming" ? (
                        <motion.div key="incoming" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            <PendingSection
                                incoming={pendingIncoming}
                                outgoing={[]}
                                loading={loading}
                                processingId={processingId}
                                onAccept={setTierTarget}
                                onDecline={handleDecline}
                                emptyTab="incoming"
                            />
                        </motion.div>
                    ) : activeTab === "pending" ? (
                        <motion.div key="pending" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            <PendingSection
                                incoming={[]}
                                outgoing={pendingOutgoing}
                                loading={loading}
                                processingId={processingId}
                                onAccept={setTierTarget}
                                onDecline={handleDecline}
                                emptyTab="pending"
                            />
                        </motion.div>
                    ) : (
                        <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            {loading ? (
                                <div className="flex justify-center py-32">
                                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#F44A22" }} />
                                </div>
                            ) : (activeTab === "active" ? active : declined).length === 0 ? (
                                <EmptyState tab={activeTab} />
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {(activeTab === "active" ? active : declined).map(c => (
                                        <PartnerCard
                                            key={c.id}
                                            connection={c}
                                            onView={() => setProfileTarget({
                                                id: c.otherId,
                                                type: c.otherType,
                                                name: c.otherName,
                                                city: "",
                                                connectionStatus: c.status === "active" ? "active" : c.status as any,
                                            })}
                                        />
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <AnimatePresence>
                {tierTarget && (
                    <TierSelectionModal
                        partnerName={tierTarget.otherName}
                        partnerType={tierTarget.otherType}
                        connectionId={tierTarget.id}
                        onConfirm={handleApproveWithTier}
                        onClose={() => setTierTarget(null)}
                    />
                )}
            </AnimatePresence>
            <AnimatePresence>
                {profileTarget && (
                    <NetworkProfileModal profile={profileTarget} onClose={() => setProfileTarget(null)} />
                )}
            </AnimatePresence>
        </VenuePageShell>
    );
}

// ── Partner card (active / declined grid) ──────────────────────────────────────

function PartnerCard({ connection, onView }: { connection: Connection; onView: () => void }) {
    const isActive = connection.status === "approved" || connection.status === "active";
    const statusConfig = isActive
        ? { label: "Active", color: "#34d399", bg: "rgba(52,211,153,0.1)" }
        : { label: "Declined", color: "#f87171", bg: "rgba(248,113,113,0.1)" };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="group rounded-[32px] p-6 transition-all"
            style={{ background: "var(--v-card, #1a1a1e)", border: "1px solid var(--v-border)" }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(244,74,34,0.3)"}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = "var(--v-border)"}
        >
            <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black" style={{ background: "rgba(244,74,34,0.12)", color: "#F44A22" }}>
                        {connection.otherName[0]}
                    </div>
                    <div>
                        <h3 className="text-[14px] font-bold text-text-primary group-hover:text-[#F44A22] transition-colors">
                            {connection.otherName}
                        </h3>
                        <span className="flex items-center gap-1 text-[11px] text-text-tertiary capitalize mt-0.5">
                            {connection.otherType === "host" ? <UserCircle className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
                            {connection.otherType}
                        </span>
                    </div>
                </div>
                {connection.tier && isActive && (
                    <span
                        className="text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest"
                        style={connection.tier === "trusted"
                            ? { background: "rgba(244,74,34,0.15)", color: "#F44A22" }
                            : { background: "rgba(255,255,255,0.06)", color: "var(--v-text-tertiary)" }}
                    >
                        {connection.tier === "trusted" ? "Trusted" : "Standard"}
                    </span>
                )}
            </div>

            <div className="flex items-center justify-between mb-5">
                <span className="text-[11px] text-text-placeholder">
                    {formatMonthYear(connection.updatedAt || connection.createdAt)}
                </span>
                <span
                    className="flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-lg"
                    style={{ background: statusConfig.bg, color: statusConfig.color }}
                >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusConfig.color }} />
                    {statusConfig.label}
                </span>
            </div>

            <button
                onClick={onView}
                className="w-full py-3 rounded-xl text-[12px] font-bold transition-all flex items-center justify-center gap-2"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--v-text-secondary)" }}
            >
                View Profile <ChevronRight className="w-4 h-4" />
            </button>
        </motion.div>
    );
}

// ── Pending section ────────────────────────────────────────────────────────────

function PendingSection({
    incoming, outgoing, loading, processingId, onAccept, onDecline, emptyTab = "pending",
}: {
    incoming: Connection[];
    outgoing: Connection[];
    loading: boolean;
    processingId: string | null;
    onAccept: (conn: Connection) => void;
    onDecline: (id: string) => void;
    emptyTab?: Tab;
}) {
    if (loading) {
        return (
            <div className="flex justify-center py-32">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#F44A22" }} />
            </div>
        );
    }

    if (incoming.length === 0 && outgoing.length === 0) {
        return <EmptyState tab={emptyTab} />;
    }

    return (
        <div className="space-y-8">
            {/* Incoming — venue approves these */}
            {incoming.length > 0 && (
                <div className="space-y-4">
                    <p className="text-[11px] font-black uppercase tracking-widest text-text-tertiary border-l-4 border-l-amber-500 pl-4">
                        Incoming · Awaiting your approval
                    </p>
                    <AnimatePresence mode="popLayout">
                        {incoming.map(req => (
                            <motion.div
                                key={req.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="border border-border-subtle p-6 rounded-[2rem]"
                                style={{ background: "var(--v-card)" }}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-5">
                                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black" style={{ background: "rgba(244,74,34,0.12)", color: "#F44A22" }}>
                                            {(req.otherName?.[0] || "?").toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-text-primary tracking-tight">{req.otherName}</h3>
                                            <div className="flex items-center gap-3 mt-1.5">
                                                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-orange-500">
                                                    {req.otherType === "host" ? <UserCircle className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
                                                    {req.otherType}
                                                </span>
                                                <span className="text-[10px] text-text-tertiary font-bold">•</span>
                                                <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">
                                                    {new Date(req.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => onAccept(req)}
                                            disabled={!!processingId}
                                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-400 hover:to-rose-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-orange-500/20 transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            {processingId === req.id
                                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                                : <>Accept <CheckCircle2 className="w-3.5 h-3.5" /></>}
                                        </button>
                                        <button
                                            onClick={() => onDecline(req.id)}
                                            disabled={!!processingId}
                                            className="h-12 w-12 rounded-xl border border-border-subtle text-text-tertiary flex items-center justify-center hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all active:scale-95 disabled:opacity-50"
                                            style={{ background: "var(--v-elevated)" }}
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                                {req.message && (
                                    <div className="mt-5 p-4 rounded-2xl border border-border-subtle" style={{ background: "rgba(255,255,255,0.03)" }}>
                                        <p className="text-[13px] text-text-secondary italic">"{req.message}"</p>
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {/* Outgoing — awaiting host approval */}
            {outgoing.length > 0 && (
                <div className="space-y-4">
                    <p className="text-[11px] font-black uppercase tracking-widest text-text-tertiary border-l-4 border-l-border-default pl-4">
                        Sent · Awaiting host approval
                    </p>
                    {outgoing.map(req => (
                        <motion.div
                            key={req.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="border border-border-subtle p-6 rounded-[2rem] opacity-75"
                            style={{ background: "var(--v-card)" }}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-5">
                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black text-text-tertiary" style={{ background: "rgba(255,255,255,0.05)" }}>
                                        {(req.otherName?.[0] || "?").toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-text-primary tracking-tight">{req.otherName}</h3>
                                        <div className="flex items-center gap-3 mt-1.5">
                                            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-orange-500">
                                                {req.otherType === "host" ? <UserCircle className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
                                                {req.otherType}
                                            </span>
                                            <span className="text-[10px] text-text-tertiary font-bold">•</span>
                                            <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">
                                                {new Date(req.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)" }}>
                                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                                    <span className="text-[11px] font-black uppercase tracking-widest text-amber-400">Awaiting approval</span>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ tab }: { tab: Tab }) {
    const config: Record<string, { icon: React.ReactNode; title: string; subtitle: string }> = {
        incoming: {
            icon: <Bell className="w-8 h-8" style={{ color: "#F44A22" }} />,
            title: "No incoming requests",
            subtitle: "Partnership requests from hosts and promoters will appear here.",
        },
        pending: {
            icon: <Clock className="w-8 h-8" style={{ color: "#f59e0b" }} />,
            title: "No pending requests",
            subtitle: "Requests you've sent awaiting approval will appear here.",
        },
        active: {
            icon: <CheckCircle2 className="w-8 h-8" style={{ color: "#34d399" }} />,
            title: "No active partners",
            subtitle: "Once you approve a request, the partner shows here.",
        },
        declined: {
            icon: <XCircle className="w-8 h-8" style={{ color: "#f87171" }} />,
            title: "No declined requests",
            subtitle: "Requests you declined will appear here.",
        },
    };
    const c = config[tab] || config.active;

    return (
        <div
            className="py-24 rounded-[32px] flex flex-col items-center text-center px-10"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)" }}
        >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: "rgba(244,74,34,0.1)" }}>
                {c.icon}
            </div>
            <h4 className="text-[16px] font-bold text-text-primary">{c.title}</h4>
            <p className="text-[13px] text-text-tertiary mt-1 max-w-xs">{c.subtitle}</p>
        </div>
    );
}
