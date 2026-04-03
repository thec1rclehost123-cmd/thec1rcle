"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Building2, CheckCircle2, Clock,
    Search, Loader2, X, Bell, Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { VenuePageShell } from "@/components/venue-layout/VenuePageShell";
import { DiscoverDirectory } from "@/components/partnerships/DiscoverDirectory";
import { BasePartnerCard } from "@/components/partnerships/BasePartnerCard";

type Tab = "discover" | "incoming" | "pending" | "active";

interface VenuePartner {
    connectionId: string;
    id: string;
    name: string;
    city: string;
    partnershipStatus: "active" | "pending";
    createdAt?: string;
    initiatedBy?: string;
}

interface PromoterConnection {
    connectionId: string;
    id: string;
    name: string;
    status: "active" | "pending";
    initiatedBy?: string;
    createdAt?: string;
}

const mp = (delay: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as any, delay },
});

export default function HostNetworkPage() {
    const router = useRouter();
    const { profile, user, getIdToken } = useDashboardAuth() as any;
    const hostId = profile?.activeMembership?.partnerId;

    const [activeTab, setActiveTab] = useState<Tab>("discover");
    const [venues, setVenues] = useState<VenuePartner[]>([]);
    const [promoterConnections, setPromoterConnections] = useState<PromoterConnection[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!hostId || !user) { setLoading(false); return; }
        setLoading(true);
        setError(false);
        try {
            const token = await user.getIdToken();
            const res = await fetch(
                `/api/discovery?action=list&partnerId=${hostId}&role=host`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!res.ok) throw new Error(`${res.status}`);
            const data = await res.json();
            const allConns: any[] = data.connections || [];

            const venueConns = allConns.filter((c: any) =>
                c.type === "partnership" && (c.status === "active" || c.status === "approved" || c.status === "pending")
            );
            setVenues(venueConns.map((c: any) => ({
                connectionId: c.id,
                id: c.otherId || c.venueId,
                name: c.otherName || c.venueName || "Venue",
                city: c.city || c.venueCity || "",
                partnershipStatus: (c.status === "active" || c.status === "approved") ? "active" : "pending",
                createdAt: c.updatedAt || c.createdAt,
                initiatedBy: c.initiatedBy,
            })));

            const promoterConns = allConns.filter((c: any) =>
                c.type === "promoter_connection" && (c.status === "active" || c.status === "approved" || c.status === "pending")
            );
            setPromoterConnections(promoterConns.map((c: any) => ({
                connectionId: c.id,
                id: c.otherId || c.promoterId,
                name: c.otherName || c.promoterName || "Promoter",
                status: (c.status === "active" || c.status === "approved") ? "active" : "pending",
                initiatedBy: c.initiatedBy,
                createdAt: c.updatedAt || c.createdAt,
            })));
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [hostId, user]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleApprove = async (connectionId: string) => {
        setProcessingId(connectionId);
        try {
            const token = typeof getIdToken === "function" ? await getIdToken() : "";
            await fetch("/api/host/partnerships", {
                method: "PATCH",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ partnershipId: connectionId, action: "approve" }),
            });
            await fetchData();
        } catch { /* */ } finally { setProcessingId(null); }
    };

    const handleReject = async (connectionId: string) => {
        setProcessingId(connectionId);
        try {
            const token = typeof getIdToken === "function" ? await getIdToken() : "";
            await fetch("/api/host/partnerships", {
                method: "PATCH",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ partnershipId: connectionId, action: "reject" }),
            });
            await fetchData();
        } catch { /* */ } finally { setProcessingId(null); }
    };

    const handlePromoterAction = async (connectionId: string, action: "approve" | "reject") => {
        setProcessingId(connectionId);
        try {
            const token = typeof getIdToken === "function" ? await getIdToken() : "";
            await fetch("/api/discovery", {
                method: "PATCH",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ connectionId, action, type: "promoter_connection" }),
            });
            await fetchData();
        } catch { /* */ } finally { setProcessingId(null); }
    };

    const activeVenues = venues.filter(v => v.partnershipStatus === "active");
    const pendingVenues = venues.filter(v => v.partnershipStatus === "pending");
    const pendingIncoming = pendingVenues.filter(v => v.initiatedBy === "venue");
    const pendingOutgoing = pendingVenues.filter(v => v.initiatedBy !== "venue");

    const activePromoters = promoterConnections.filter(p => p.status === "active");
    const pendingIncomingPromoters = promoterConnections.filter(p => p.status === "pending" && p.initiatedBy === "promoter");

    const TABS: { id: Tab; label: string; count?: number }[] = [
        { id: "discover", label: "Discover" },
        { id: "incoming", label: "Incoming", count: pendingIncoming.length + pendingIncomingPromoters.length },
        { id: "pending", label: "Pending", count: pendingOutgoing.length },
        { id: "active", label: "Active", count: activeVenues.length + activePromoters.length },
    ];

    return (
        <VenuePageShell
            title="Partners"
            subtitle="Venues and promoters connected to your host profile"
            actions={
                <div className="flex gap-3">
                    <div className="px-5 py-3 rounded-2xl text-center" style={{ background: "var(--v-card)", border: "1px solid var(--v-border)" }}>
                        <p className="text-[20px] font-black tabular-nums" style={{ color: "var(--v-text-primary)" }}>{activeVenues.length + activePromoters.length}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--v-text-tertiary)" }}>Active</p>
                    </div>
                    <div className="px-5 py-3 rounded-2xl text-center" style={{ background: "var(--v-card)", border: "1px solid var(--v-border)" }}>
                        <p className="text-[20px] font-black tabular-nums" style={{ color: "#f59e0b" }}>{pendingVenues.length + pendingIncomingPromoters.length}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--v-text-tertiary)" }}>Pending</p>
                    </div>
                </div>
            }
        >
            {/* Tab bar */}
            <motion.div {...mp(0)}>
                <div className="flex items-center p-2 rounded-[28px] w-fit overflow-x-auto" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className="flex items-center gap-3 px-7 py-4 rounded-[24px] text-[17px] font-semibold transition-all shrink-0"
                            style={activeTab === tab.id
                                ? { background: "var(--v-elevated)", color: "var(--v-text-primary)" }
                                : { color: "var(--v-text-tertiary)" }}
                        >
                            {tab.id === "discover" && <Search className={`w-5 h-5 ${activeTab === tab.id ? "text-[#818cf8]" : ""}`} />}
                            {tab.id === "incoming" && <Bell className={`w-5 h-5 ${activeTab === tab.id ? "text-[#F44A22]" : ""}`} />}
                            {tab.id === "pending" && <Clock className={`w-5 h-5 ${activeTab === tab.id ? "text-[#f59e0b]" : ""}`} />}
                            {tab.id === "active" && <CheckCircle2 className={`w-5 h-5 ${activeTab === tab.id ? "text-[#34d399]" : ""}`} />}
                            {tab.label}
                            {tab.count !== undefined && tab.count > 0 && (
                                <span
                                    className="px-2 py-1 rounded-lg text-[12px] font-black min-w-[28px] text-center"
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
                {error && (
                    <div className="flex flex-col items-center justify-center py-16 rounded-[40px] border border-red-500/20 bg-red-500/5 gap-4 text-center">
                        <p className="text-[16px] font-black text-text-primary">Failed to load partners</p>
                        <button onClick={fetchData} className="h-11 px-8 rounded-2xl bg-surface-tertiary border border-border-subtle text-text-primary text-[13px] font-black uppercase tracking-widest">
                            Retry
                        </button>
                    </div>
                )}

                {!error && (
                    <AnimatePresence mode="wait">
                        {activeTab === "discover" ? (
                            <motion.div key="discover" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                <DiscoverDirectory allowedTypes={["venue", "promoter"]} partnerId={hostId} role="host" />
                            </motion.div>

                        ) : activeTab === "incoming" ? (
                            <motion.div key="incoming" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                {loading ? (
                                    <div className="flex justify-center py-32">
                                        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#F44A22" }} />
                                    </div>
                                ) : pendingIncoming.length === 0 && pendingIncomingPromoters.length === 0 ? (
                                    <EmptyState icon={<Bell className="w-8 h-8" style={{ color: "#F44A22" }} />} title="No incoming requests" subtitle="Partnership requests from venues and promoters will appear here for your approval." />
                                ) : (
                                    <div className="space-y-8">
                                        {/* Venue requests */}
                                        {pendingIncoming.length > 0 && (
                                            <div className="space-y-4">
                                                {pendingIncomingPromoters.length > 0 && (
                                                    <p className="text-[11px] font-black uppercase tracking-widest text-text-tertiary border-l-4 border-l-orange-500 pl-4">
                                                        Venues · Awaiting your approval
                                                    </p>
                                                )}
                                                <AnimatePresence mode="popLayout">
                                                    {pendingIncoming.map(v => (
                                                        <motion.div key={v.connectionId} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                                            className="border border-border-subtle p-6 rounded-[2rem]" style={{ background: "var(--v-card)" }}>
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-5">
                                                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black" style={{ background: "rgba(244,74,34,0.12)", color: "#F44A22" }}>
                                                                        {v.name[0]}
                                                                    </div>
                                                                    <div>
                                                                        <h3 className="text-xl font-black text-text-primary">{v.name}</h3>
                                                                        <div className="flex items-center gap-2 mt-1">
                                                                            <Building2 className="w-3.5 h-3.5 text-orange-500" />
                                                                            <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">
                                                                                Venue{v.city ? ` · ${v.city}` : ""}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <button
                                                                        onClick={() => handleApprove(v.connectionId)}
                                                                        disabled={!!processingId}
                                                                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-400 hover:to-rose-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-orange-500/20 transition-all active:scale-95 disabled:opacity-50"
                                                                    >
                                                                        {processingId === v.connectionId
                                                                            ? <Loader2 className="w-4 h-4 animate-spin" />
                                                                            : <>Approve <CheckCircle2 className="w-3.5 h-3.5" /></>}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleReject(v.connectionId)}
                                                                        disabled={!!processingId}
                                                                        className="h-12 w-12 rounded-xl border border-border-subtle text-text-tertiary flex items-center justify-center hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all active:scale-95 disabled:opacity-50"
                                                                        style={{ background: "var(--v-elevated)" }}
                                                                    >
                                                                        <X className="w-5 h-5" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    ))}
                                                </AnimatePresence>
                                            </div>
                                        )}

                                        {/* Promoter requests */}
                                        {pendingIncomingPromoters.length > 0 && (
                                            <div className="space-y-4">
                                                {pendingIncoming.length > 0 && (
                                                    <p className="text-[11px] font-black uppercase tracking-widest text-text-tertiary border-l-4 border-l-[#818cf8] pl-4">
                                                        Promoters · Awaiting your approval
                                                    </p>
                                                )}
                                                <AnimatePresence mode="popLayout">
                                                    {pendingIncomingPromoters.map(p => (
                                                        <motion.div key={p.connectionId} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                                            className="border border-border-subtle p-6 rounded-[2rem]" style={{ background: "var(--v-card)" }}>
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-5">
                                                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black" style={{ background: "rgba(129,140,248,0.12)", color: "#818cf8" }}>
                                                                        {p.name[0]}
                                                                    </div>
                                                                    <div>
                                                                        <h3 className="text-xl font-black text-text-primary">{p.name}</h3>
                                                                        <div className="flex items-center gap-2 mt-1">
                                                                            <Zap className="w-3.5 h-3.5 text-[#818cf8]" />
                                                                            <span className="text-[10px] font-black uppercase tracking-widest text-[#818cf8]">Promoter</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <button
                                                                        onClick={() => handlePromoterAction(p.connectionId, "approve")}
                                                                        disabled={!!processingId}
                                                                        className="flex items-center gap-2 px-6 py-3 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 disabled:opacity-50"
                                                                        style={{ background: "linear-gradient(135deg, #6366f1, #818cf8)" }}
                                                                    >
                                                                        {processingId === p.connectionId
                                                                            ? <Loader2 className="w-4 h-4 animate-spin" />
                                                                            : <>Approve <CheckCircle2 className="w-3.5 h-3.5" /></>}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handlePromoterAction(p.connectionId, "reject")}
                                                                        disabled={!!processingId}
                                                                        className="h-12 w-12 rounded-xl border border-border-subtle text-text-tertiary flex items-center justify-center hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all active:scale-95 disabled:opacity-50"
                                                                        style={{ background: "var(--v-elevated)" }}
                                                                    >
                                                                        <X className="w-5 h-5" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    ))}
                                                </AnimatePresence>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </motion.div>

                        ) : activeTab === "pending" ? (
                            <motion.div key="pending" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                {loading ? (
                                    <div className="flex justify-center py-32">
                                        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#F44A22" }} />
                                    </div>
                                ) : pendingOutgoing.length === 0 ? (
                                    <EmptyState icon={<Clock className="w-8 h-8" style={{ color: "#f59e0b" }} />} title="No sent requests" subtitle="Requests you've sent to venues awaiting their approval will appear here." />
                                ) : (
                                    <div className="space-y-4">
                                        {pendingOutgoing.map(v => (
                                            <motion.div key={v.connectionId} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                                className="border border-border-subtle p-6 rounded-[2rem] opacity-75" style={{ background: "var(--v-card)" }}>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-5">
                                                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black text-text-tertiary" style={{ background: "rgba(255,255,255,0.05)" }}>
                                                            {v.name[0]}
                                                        </div>
                                                        <div>
                                                            <h3 className="text-xl font-black text-text-primary">{v.name}</h3>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <Building2 className="w-3.5 h-3.5 text-orange-500" />
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">
                                                                    Venue{v.city ? ` · ${v.city}` : ""}
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
                            </motion.div>

                        ) : (
                            <motion.div key="active" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                {loading ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="h-52 rounded-[32px] animate-pulse border border-border-subtle" style={{ background: "var(--v-card)" }} />
                                        ))}
                                    </div>
                                ) : activeVenues.length === 0 && activePromoters.length === 0 ? (
                                    <EmptyState
                                        icon={<Building2 className="w-8 h-8" style={{ color: "#34d399" }} />}
                                        title="No active partners"
                                        subtitle="Venues and promoters will appear here once connections are approved."
                                    />
                                ) : (
                                    <div className="space-y-8">
                                        {activeVenues.length > 0 && (
                                            <div className="space-y-4">
                                                {activePromoters.length > 0 && (
                                                    <p className="text-[11px] font-black uppercase tracking-widest text-text-tertiary border-l-4 border-l-[#34d399] pl-4">Venues</p>
                                                )}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                    {activeVenues.map(v => (
                                                        <BasePartnerCard
                                                            key={v.id}
                                                            partner={{
                                                                id: v.id,
                                                                type: "venue",
                                                                name: v.name,
                                                                eventsCount: 0,
                                                                followersCount: 0,
                                                                connectionStatus: "active",
                                                            }}
                                                            onViewProfile={() => router.push(`/host/partners/${v.id}`)}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {activePromoters.length > 0 && (
                                            <div className="space-y-4">
                                                {activeVenues.length > 0 && (
                                                    <p className="text-[11px] font-black uppercase tracking-widest text-text-tertiary border-l-4 border-l-[#818cf8] pl-4">Promoters</p>
                                                )}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                    {activePromoters.map(p => (
                                                        <BasePartnerCard
                                                            key={p.id}
                                                            partner={{
                                                                id: p.id,
                                                                type: "promoter",
                                                                name: p.name,
                                                                eventsCount: 0,
                                                                followersCount: 0,
                                                                connectionStatus: "active",
                                                            }}
                                                            onViewProfile={() => router.push(`/host/partners/${p.id}`)}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
            </div>

        </VenuePageShell>
    );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
    return (
        <div
            className="py-24 rounded-[32px] flex flex-col items-center text-center px-10"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)" }}
        >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: "rgba(244,74,34,0.1)" }}>
                {icon}
            </div>
            <h4 className="text-[16px] font-bold text-text-primary">{title}</h4>
            <p className="text-[13px] text-text-tertiary mt-1 max-w-xs">{subtitle}</p>
        </div>
    );
}
