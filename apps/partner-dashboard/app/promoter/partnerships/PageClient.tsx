"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import {
    Users,
    Clock,
    CheckCircle2,
    XCircle,
    Search,
    Loader2,
    Building2,
    UserCircle,
    Network,
    Handshake,
    Zap,
    Bell,
    X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { usePromoterPartnerships } from "@/lib/hooks/usePromoterQueries";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { DiscoverDirectory, StatusCard } from "@/components/partnerships/DiscoverDirectory";
import { NetworkProfileModal, NetworkProfile } from "@/components/partnerships/NetworkProfileModal";
import { motion, AnimatePresence } from "framer-motion";
import { StatTrendCard } from "@/components/promoter/PlaceholderCharts";

type Tab = "discover" | "incoming" | "pending" | "active" | "declined";

interface Partnership {
    id: string;
    otherId: string;
    otherName: string;
    otherType: "host" | "venue" | "promoter";
    status: string;
    tier?: "trusted" | "standard";
    createdAt: any;
    updatedAt?: any;
    initiatedBy?: string;
}

const mp = (delay: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as any, delay },
});

export default function PromoterPartnershipsPage() {
    const { profile, user } = useDashboardAuth() as any;
    const [activeTab, setActiveTab] = useState<Tab>("discover");
    const [profileTarget, setProfileTarget] = useState<NetworkProfile | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [discoverSearch, setDiscoverSearch] = useState("");
    const [discoverType, setDiscoverType] = useState("venue");
    const [discoverCity, setDiscoverCity] = useState("");
    const [discoverRefresh, setDiscoverRefresh] = useState(0);
    const queryClient = useQueryClient();

    const promoterId = profile?.activeMembership?.partnerId;

    const { data, isLoading: loading } = usePromoterPartnerships(promoterId);
    const partnerships: Partnership[] = data?.connections || [];

    const allPending = partnerships.filter((p) => p.status === "pending");
    const pendingIncoming = allPending.filter((p) => p.initiatedBy !== "promoter");
    const pendingOutgoing = allPending.filter((p) => p.initiatedBy === "promoter");
    const active = partnerships.filter(
        (p) => p.status === "approved" || p.status === "active"
    );
    const declined = partnerships.filter((p) => p.status === "rejected" || p.status === "declined");
    // initiatedBy === "promoter" → promoter sent the request, partner declined it → show Re-request
    const declinedByThem = declined.filter((p) => p.initiatedBy === "promoter");
    // initiatedBy !== "promoter" → partner sent, promoter declined → show Remove
    const declinedByPromoter = declined.filter((p) => p.initiatedBy !== "promoter");

    const handleAction = async (connectionId: string, action: "approve" | "reject") => {
        setProcessingId(connectionId);
        try {
            const token = user ? await user.getIdToken() : "";
            await fetch("/api/discovery", {
                method: "PATCH",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ connectionId, action, type: "promoter_connection" }),
            });
            queryClient.invalidateQueries({ queryKey: ["promoter-partnerships", promoterId || ""] });
        } catch { /* */ } finally { setProcessingId(null); }
    };

    const handleReRequest = async (conn: Partnership) => {
        setProcessingId(conn.id);
        try {
            const token = user ? await user.getIdToken() : "";
            await fetch("/api/discovery", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ requesterId: promoterId, requesterType: "promoter", requesterName: profile?.name || "", targetId: conn.otherId, targetType: conn.otherType, targetName: conn.otherName }),
            });
            queryClient.invalidateQueries({ queryKey: ["promoter-partnerships", promoterId || ""] });
        } catch { /* */ } finally { setProcessingId(null); }
    };

    const handleRemove = async (connectionId: string) => {
        setProcessingId(connectionId);
        try {
            const token = user ? await user.getIdToken() : "";
            await fetch("/api/discovery", {
                method: "PATCH",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ connectionId, action: "remove", role: "promoter", partnerId: promoterId }),
            });
            queryClient.invalidateQueries({ queryKey: ["promoter-partnerships", promoterId || ""] });
        } catch { /* */ } finally { setProcessingId(null); }
    };

    const TABS: { id: Tab; label: string; count?: number }[] = [
        { id: "discover", label: "Discover" },
        { id: "active", label: "Active", count: active.length },
        { id: "incoming", label: "Incoming", count: pendingIncoming.length },
        { id: "pending", label: "Pending", count: pendingOutgoing.length },
        { id: "declined", label: "Declined", count: declined.length },
    ];

    const filtered =
        activeTab === "active"
            ? active
            : activeTab === "declined"
            ? declined
            : [];

    return (
        <VenuePageShell
            title="Partnerships"
            subtitle="Build your venue and host network to unlock affiliate links and event access"
        >
            {/* ── Hero header ── */}
            <motion.div {...mp(0)}>
                <div
                    className="relative rounded-[32px] overflow-hidden px-6 py-7 flex items-center gap-5"
                    style={{
                        background:
                            "linear-gradient(135deg, #150d2e 0%, #0d0920 60%, #080810 100%)",
                        border: "1px solid rgba(124,58,237,0.2)",
                    }}
                >
                    <div
                        className="absolute top-0 right-0 w-56 h-56 rounded-full blur-3xl pointer-events-none"
                        style={{ background: "rgba(124,58,237,0.1)" }}
                    />
                    <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 relative z-10"
                        style={{ background: "rgba(124,58,237,0.2)", color: "#a78bfa" }}
                    >
                        <Handshake className="w-6 h-6" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-[11px] font-black uppercase tracking-widest text-text-tertiary mb-1">
                            Partner Network
                        </p>
                        <p className="text-[13px] font-medium text-text-secondary max-w-lg">
                            Connect with venues and hosts to unlock your affiliate link access and
                            event inventory.
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* ── Network stats strip ── */}
            <motion.div {...mp(0.06)}>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatTrendCard
                        label="Active Partners"
                        value={active.length}
                        trendUp={active.length > 0}
                        color="#34d399"
                        icon={<CheckCircle2 className="w-4 h-4" />}
                    />
                    <StatTrendCard
                        label="Pending Requests"
                        value={allPending.length}
                        color="#f59e0b"
                        icon={<Clock className="w-4 h-4" />}
                    />
                    <StatTrendCard
                        label="Venues Connected"
                        value={active.filter((p) => p.otherType === "venue").length}
                        color="#818cf8"
                        icon={<Building2 className="w-4 h-4" />}
                    />
                    <StatTrendCard
                        label="Hosts Connected"
                        value={active.filter((p) => p.otherType === "host").length}
                        color="#7c3aed"
                        icon={<UserCircle className="w-4 h-4" />}
                    />
                </div>
            </motion.div>

            {/* ── Tab bar + search/filter — separate elements ── */}
            <motion.div {...mp(0.1)}>
                <div className="flex items-center gap-3">
                    {/* Tab pills */}
                    <div className="flex items-center p-1.5 rounded-2xl shrink-0" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all shrink-0"
                                style={activeTab === tab.id
                                    ? { background: "var(--v-elevated)", color: "var(--v-text-primary)" }
                                    : { color: "var(--v-text-tertiary)" }}
                            >
                                {tab.id === "discover" && <Search className={`w-3.5 h-3.5 ${activeTab === tab.id ? "text-[#818cf8]" : ""}`} />}
                                {tab.id === "incoming" && <Bell className={`w-3.5 h-3.5 ${activeTab === tab.id ? "text-[#a78bfa]" : ""}`} />}
                                {tab.id === "pending" && <Clock className={`w-3.5 h-3.5 ${activeTab === tab.id ? "text-[#f59e0b]" : ""}`} />}
                                {tab.id === "active" && <CheckCircle2 className={`w-3.5 h-3.5 ${activeTab === tab.id ? "text-[#34d399]" : ""}`} />}
                                {tab.id === "declined" && <XCircle className={`w-3.5 h-3.5 ${activeTab === tab.id ? "text-[#f87171]" : ""}`} />}
                                {tab.label}
                                {tab.count !== undefined && tab.count > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black"
                                        style={activeTab === tab.id
                                            ? { background: "#7c3aed", color: "#fff" }
                                            : { background: "rgba(255,255,255,0.08)", color: "var(--v-text-tertiary)" }}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Search + filters — separate */}
                    <div className="flex items-center gap-2 flex-1">
                        <div className="flex items-center gap-2 flex-1 px-4 py-2.5 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--v-text-tertiary)" }} />
                            <input
                                type="text"
                                value={discoverSearch}
                                onChange={e => setDiscoverSearch(e.target.value)}
                                placeholder="Search venues & hosts..."
                                className="flex-1 min-w-0 bg-transparent border-none outline-none text-[13px] font-medium placeholder:opacity-40"
                                style={{ color: "var(--v-text-primary)" }}
                            />
                            {discoverSearch && (
                                <button onClick={() => setDiscoverSearch("")} className="shrink-0 opacity-40 hover:opacity-70 transition-opacity">
                                    <X className="w-3.5 h-3.5" style={{ color: "var(--v-text-secondary)" }} />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-0.5 p-1.5 rounded-2xl shrink-0" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            {[{ value: "venue", label: "Venues" }, { value: "host", label: "Hosts" }].map(opt => (
                                <button key={opt.value} onClick={() => setDiscoverType(opt.value)}
                                    className="px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all"
                                    style={discoverType === opt.value
                                        ? { background: "var(--v-elevated)", color: "var(--v-text-primary)" }
                                        : { color: "var(--v-text-tertiary)" }}>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <select value={discoverCity} onChange={e => setDiscoverCity(e.target.value)}
                            className="border-none outline-none text-[12px] font-semibold cursor-pointer px-4 py-2.5 rounded-2xl shrink-0"
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: discoverCity ? "var(--v-text-primary)" : "var(--v-text-tertiary)" }}>
                            <option value="" style={{ background: "#18181B" }}>All Cities</option>
                            <option value="Pune" style={{ background: "#18181B" }}>Pune</option>
                            <option value="Mumbai" style={{ background: "#18181B" }}>Mumbai</option>
                            <option value="Goa" style={{ background: "#18181B" }}>Goa</option>
                            <option value="Bengaluru" style={{ background: "#18181B" }}>Bengaluru</option>
                            <option value="Delhi" style={{ background: "#18181B" }}>Delhi</option>
                        </select>
                        <button onClick={() => setDiscoverRefresh(n => n + 1)}
                            className="p-2.5 rounded-2xl flex items-center justify-center transition-all active:scale-95 shrink-0"
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "var(--v-text-tertiary)" }}>
                            <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* ── Content ── */}
            <div className="min-h-[500px]">
                <AnimatePresence mode="wait">
                    {activeTab === "discover" ? (
                        <motion.div
                            key="discover"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                        >
                            <DiscoverDirectory
                                allowedTypes={["venue", "host"]}
                                partnerId={promoterId}
                                role="promoter"
                                searchQuery={discoverSearch}
                                filterType={discoverType as any}
                                filterCity={discoverCity}
                                refreshTrigger={discoverRefresh}
                            />
                        </motion.div>
                    ) : activeTab === "incoming" ? (
                        <motion.div key="incoming" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            {loading ? (
                                <div className="flex justify-center py-32">
                                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#7c3aed" }} />
                                </div>
                            ) : pendingIncoming.length === 0 ? (
                                <EmptyState tab="incoming" />
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                    <AnimatePresence>
                                        {pendingIncoming.map(p => (
                                            <StatusCard
                                                key={p.id}
                                                name={p.otherName}
                                                type={p.otherType}
                                                connectionStatus="incoming"
                                                onApprove={() => handleAction(p.id, "approve")}
                                                onReject={() => handleAction(p.id, "reject")}
                                                isProcessing={processingId === p.id}
                                            />
                                        ))}
                                    </AnimatePresence>
                                </div>
                            )}
                        </motion.div>
                    ) : activeTab === "pending" ? (
                        <motion.div key="pending" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            {loading ? (
                                <div className="flex justify-center py-32">
                                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#7c3aed" }} />
                                </div>
                            ) : pendingOutgoing.length === 0 ? (
                                <EmptyState tab="pending" />
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {pendingOutgoing.map(p => (
                                        <StatusCard
                                            key={p.id}
                                            name={p.otherName}
                                            type={p.otherType}
                                            connectionStatus="pending"
                                        />
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    ) : activeTab === "declined" ? (
                        <motion.div key="declined" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            {loading ? (
                                <div className="flex justify-center py-32">
                                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#7c3aed" }} />
                                </div>
                            ) : declined.length === 0 ? (
                                <EmptyState tab="declined" />
                            ) : (
                                <div className="flex flex-col gap-8">
                                    {declinedByThem.length > 0 && (
                                        <div>
                                            <p className="text-[11px] font-black uppercase tracking-widest mb-4" style={{ color: "var(--v-text-tertiary)" }}>They declined your request</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                                {declinedByThem.map(p => (
                                                    <StatusCard
                                                        key={p.id}
                                                        name={p.otherName}
                                                        type={p.otherType}
                                                        connectionStatus="declined"
                                                        onReRequest={() => handleReRequest(p)}
                                                        isProcessing={processingId === p.id}
                                                        onViewProfile={() => setProfileTarget({ id: p.otherId, type: p.otherType as any, name: p.otherName, city: "", connectionStatus: "rejected" })}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {declinedByPromoter.length > 0 && (
                                        <div>
                                            <p className="text-[11px] font-black uppercase tracking-widest mb-4" style={{ color: "var(--v-text-tertiary)" }}>You declined</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                                {declinedByPromoter.map(p => (
                                                    <StatusCard
                                                        key={p.id}
                                                        name={p.otherName}
                                                        type={p.otherType}
                                                        connectionStatus="declined"
                                                        onRemove={() => handleRemove(p.id)}
                                                        isProcessing={processingId === p.id}
                                                        onViewProfile={() => setProfileTarget({ id: p.otherId, type: p.otherType as any, name: p.otherName, city: "", connectionStatus: "rejected" })}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div key="active" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            {loading ? (
                                <div className="flex justify-center py-32">
                                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#7c3aed" }} />
                                </div>
                            ) : active.length === 0 ? (
                                <EmptyState tab="active" />
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {active.map(p => (
                                        <StatusCard
                                            key={p.id}
                                            name={p.otherName}
                                            type={p.otherType}
                                            connectionStatus="active"
                                            onViewProfile={() => setProfileTarget({ id: p.otherId, type: p.otherType as any, name: p.otherName, city: "", connectionStatus: "active" })}
                                        />
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Profile modal */}
            <AnimatePresence>
                {profileTarget && (
                    <NetworkProfileModal
                        profile={profileTarget}
                        onClose={() => setProfileTarget(null)}
                    />
                )}
            </AnimatePresence>
        </VenuePageShell>
    );
}

function EmptyState({ tab }: { tab: Tab }) {
    const config: Record<
        string,
        { icon: React.ReactNode; title: string; subtitle: string }
    > = {
        incoming: {
            icon: <Bell className="w-8 h-8" style={{ color: "#a78bfa" }} />,
            title: "No incoming requests",
            subtitle: "Partnership requests from venues and hosts will appear here for your approval.",
        },
        pending: {
            icon: <Clock className="w-8 h-8" style={{ color: "#f59e0b" }} />,
            title: "No sent requests",
            subtitle: "Requests you've sent awaiting venue or host approval will appear here.",
        },
        active: {
            icon: <CheckCircle2 className="w-8 h-8" style={{ color: "#34d399" }} />,
            title: "No active partnerships",
            subtitle: "Once a venue approves your request, the partnership shows here.",
        },
        declined: {
            icon: <XCircle className="w-8 h-8" style={{ color: "#f87171" }} />,
            title: "No declined requests",
            subtitle: "Requests that were declined by venues will appear here.",
        },
    };

    const c = config[tab] || config.pending;

    return (
        <div
            className="py-24 rounded-[32px] flex flex-col items-center text-center px-10"
            style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px dashed rgba(255,255,255,0.08)",
            }}
        >
            <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: "rgba(124,58,237,0.1)" }}
            >
                {c.icon}
            </div>
            <h4 className="text-[16px] font-bold text-text-primary">{c.title}</h4>
            <p className="text-[13px] text-text-tertiary mt-1 max-w-xs">{c.subtitle}</p>
        </div>
    );
}
