"use client";

import { useState, useCallback, useEffect } from "react";
import {
    CheckCircle2, Clock, XCircle, Search, Loader2,
    Bell,
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { VenuePageShell } from "@/components/venue-layout/VenuePageShell";
import { DiscoverDirectory } from "@/components/partnerships/DiscoverDirectory";
import { BasePartnerCard } from "@/components/partnerships/BasePartnerCard";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

type Tab = "discover" | "incoming" | "pending" | "active" | "declined";

interface Connection {
    id: string;
    type: string;
    otherId: string;
    otherName: string;
    otherType: "host" | "promoter";
    otherAvatar?: string | null;
    otherIsVerified?: boolean;
    otherEventsCount?: number;
    otherFollowersCount?: number;
    status: string;
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
    const router = useRouter();
    const { profile, user } = useDashboardAuth();
    const [activeTab, setActiveTab] = useState<Tab>("discover");
    const [connections, setConnections] = useState<Connection[]>([]);
    const [loading, setLoading] = useState(true);
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

    const handleApprove = async (connectionId: string) => {
        const conn = connections.find(c => c.id === connectionId);
        setProcessingId(connectionId);
        try {
            const token = await user?.getIdToken();
            await fetch("/api/discovery", {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ connectionId, action: "approve", type: conn?.type, role: "venue", partnerId: venueId, partnerName: venueName }),
            });
            await fetchData();
        } catch { alert("Failed to approve partnership."); }
        finally { setProcessingId(null); }
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
    const activeHosts = active.filter(c => c.otherType === "host").length;
    const activePromoters = active.filter(c => c.otherType === "promoter").length;

    const TABS: { id: Tab; label: string; count?: number }[] = [
        { id: "discover", label: "Discover" },
        { id: "incoming", label: "Incoming", count: pendingIncoming.length },
        { id: "active", label: "Active", count: active.length },
    ];

    return (
        <VenuePageShell
            title="Partners"
            actions={
                <div className="flex items-center gap-3">
                    {[
                        { label: "Active", value: active.length, color: "var(--v-text-primary)" },
                        { label: "Pending", value: allPending.length, color: "#f59e0b" },
                        { label: "Hosts", value: activeHosts, color: "#F44A22" },
                        { label: "Promoters", value: activePromoters, color: "#818cf8" },
                    ].map((metric, i) => (
                        <div 
                            key={i}
                            className="min-w-[90px] rounded-[22px] px-4 py-2.5 text-center transition-all hover:scale-[1.02]" 
                            style={{ 
                                background: "rgba(255, 255, 255, 0.03)", 
                                border: "1px solid rgba(255, 255, 255, 0.08)",
                                backdropFilter: "blur(12px)",
                                boxShadow: "0 4px 24px -12px rgba(0,0,0,0.5)"
                            }}
                        >
                            <p className="text-[20px] font-black tabular-nums leading-none tracking-tight" style={{ color: metric.color }}>{metric.value}</p>
                            <p className="mt-1.5 text-[10px] font-black uppercase tracking-[0.15em] opacity-40" style={{ color: "var(--v-text-primary)" }}>{metric.label}</p>
                        </div>
                    ))}
                </div>
            }
        >
            {/* Tab bar */}
            <motion.div {...mp(0)} className="-mt-2">
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
                                onAccept={handleApprove}
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
                                onAccept={handleApprove}
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
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {(activeTab === "active" ? active : declined).map((connection) => (
                                        <BasePartnerCard
                                            key={connection.id}
                                            partner={{
                                                id: connection.otherId,
                                                type: connection.otherType,
                                                name: connection.otherName,
                                                avatar: connection.otherAvatar,
                                                isVerified: connection.otherIsVerified,
                                                eventsCount: connection.otherEventsCount,
                                                followersCount: connection.otherFollowersCount,
                                                connectionStatus: connection.status === "active" ? "active" : connection.status as any,
                                            }}
                                            onViewProfile={() => router.push(`/venue/partners/${connection.otherId}`)}
                                        />
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

        </VenuePageShell>
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
    onAccept: (id: string) => void;
    onDecline: (id: string) => void;
    emptyTab?: Tab;
}) {
    const router = useRouter();
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        <AnimatePresence mode="popLayout">
                            {incoming.map((req) => (
                                <BasePartnerCard
                                    key={req.id}
                                    partner={{
                                        id: req.otherId,
                                        type: req.otherType,
                                        name: req.otherName,
                                        avatar: req.otherAvatar,
                                        isVerified: req.otherIsVerified,
                                        eventsCount: req.otherEventsCount,
                                        followersCount: req.otherFollowersCount,
                                        connectionStatus: null,
                                    }}
                                    onViewProfile={() => router.push(`/venue/partners/${req.otherId}`)}
                                    onPrimaryAction={() => onAccept(req.id)}
                                    isActionLoading={processingId === req.id}
                                    primaryActionLabel="Accept"
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
            )}

            {/* Outgoing — awaiting host approval */}
            {outgoing.length > 0 && (
                <div className="space-y-4">
                    <p className="text-[11px] font-black uppercase tracking-widest text-text-tertiary border-l-4 border-l-border-default pl-4">
                        Sent · Awaiting host approval
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {outgoing.map((req) => (
                            <BasePartnerCard
                                key={req.id}
                                partner={{
                                    id: req.otherId,
                                    type: req.otherType,
                                    name: req.otherName,
                                    avatar: req.otherAvatar,
                                    isVerified: req.otherIsVerified,
                                    eventsCount: req.otherEventsCount,
                                    followersCount: req.otherFollowersCount,
                                    connectionStatus: "pending",
                                }}
                                onViewProfile={() => router.push(`/venue/partners/${req.otherId}`)}
                            />
                        ))}
                    </div>
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
