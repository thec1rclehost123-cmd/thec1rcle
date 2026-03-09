"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Users,
    CheckCircle2,
    Clock,
    Search,
    Loader2,
    X,
    ChevronRight,
    ShieldAlert,
    Star,
    Zap,
    UserCircle,
    MapPin,
    TrendingUp,
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { DiscoverDirectory } from "@/components/partnerships/DiscoverDirectory";
import { TierSelectionModal, ContractTier } from "@/components/partnerships/TierSelectionModal";
import { NetworkProfileModal, NetworkProfile } from "@/components/partnerships/NetworkProfileModal";
import { motion, AnimatePresence } from "framer-motion";

type Tab = "roster" | "pending" | "discover";

interface Connection {
    id: string;
    otherId: string;
    otherName: string;
    otherType: "host" | "promoter";
    status: string;
    tier?: ContractTier;
    createdAt: any;
    updatedAt?: any;
    message?: string;
}

export default function VenuePartnershipsPage() {
    const { profile, user } = useDashboardAuth();
    const [connections, setConnections] = useState<Connection[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>("pending");
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [tierTarget, setTierTarget] = useState<Connection | null>(null);
    const [profileTarget, setProfileTarget] = useState<NetworkProfile | null>(null);

    const venueId = profile?.activeMembership?.partnerId;
    const venueName = profile?.displayName;

    const fetchConnections = useCallback(async () => {
        if (!venueId || !user) return;
        setLoading(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch(
                `/api/discovery?action=list&partnerId=${venueId}&role=venue`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            const all: Connection[] = (data.connections || []).map((c: any) => ({
                id: c.id,
                otherId: c.otherId,
                otherName: c.otherName,
                otherType: c.type === "partnership" ? "host" : "promoter",
                status: c.status,
                tier: c.tier,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
                message: c.message,
            }));
            setConnections(all);
        } catch (err) {
            console.error("[Venue Partnerships] fetch error:", err);
        } finally {
            setLoading(false);
        }
    }, [venueId, user]);

    useEffect(() => {
        fetchConnections();
    }, [fetchConnections]);

    const handleApproveWithTier = async (tier: ContractTier, connectionId: string) => {
        try {
            const token = await user?.getIdToken();
            const res = await fetch("/api/discovery", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    connectionId,
                    action: "approve",
                    tier,
                    role: "venue",
                    partnerId: venueId,
                    partnerName: venueName,
                }),
            });
            if (!res.ok) throw new Error("Failed");
            setTierTarget(null);
            await fetchConnections();
        } catch (err) {
            console.error(err);
            alert("Failed to approve partnership.");
        }
    };

    const handleDecline = async (connectionId: string) => {
        setProcessingId(connectionId);
        try {
            const token = await user?.getIdToken();
            await fetch("/api/discovery", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    connectionId,
                    action: "reject",
                    role: "venue",
                    partnerId: venueId,
                }),
            });
            await fetchConnections();
        } catch (err) {
            console.error(err);
        } finally {
            setProcessingId(null);
        }
    };

    const formatDate = (ts: any) => {
        if (!ts) return "";
        const d = ts.toDate ? ts.toDate() : ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
        return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    };

    const roster = connections.filter((c) => c.status === "approved" || c.status === "active");
    const pending = connections.filter((c) => c.status === "pending");

    const TABS: { id: Tab; label: string; count?: number }[] = [
        { id: "roster", label: "Active Roster", count: roster.length },
        { id: "pending", label: "Pending", count: pending.length },
        { id: "discover", label: "Discover" },
    ];

    return (
        <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border-default pb-8">
                <div>
                    <div className="flex items-center gap-3 mb-3 text-accent-primary">
                        <div className="p-2 bg-accent-glow rounded-xl">
                            <Users className="w-5 h-5" />
                        </div>
                        <span className="text-label font-black uppercase tracking-widest">Network</span>
                    </div>
                    <h1 className="text-display-sm font-bold text-text-primary tracking-tight">
                        Partnerships
                    </h1>
                    <p className="text-body text-text-tertiary mt-2 max-w-xl">
                        Manage your approved agents, review incoming requests, and discover new partners.
                    </p>
                </div>

                {/* KPI chips */}
                <div className="flex gap-3">
                    <div className="px-5 py-3 bg-surface-elevated border border-border-default rounded-2xl text-center">
                        <p className="text-stat-xs font-bold text-text-primary">{roster.length}</p>
                        <p className="text-label text-text-tertiary mt-0.5">Active</p>
                    </div>
                    <div className="px-5 py-3 bg-surface-elevated border border-border-default rounded-2xl text-center">
                        <p className="text-stat-xs font-bold text-accent-primary">{pending.length}</p>
                        <p className="text-label text-text-tertiary mt-0.5">Pending</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center p-1.5 bg-surface-secondary rounded-2xl w-fit border border-border-subtle">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-6 py-2.5 rounded-xl text-[13px] font-semibold transition-all flex items-center gap-2 ${
                            activeTab === tab.id
                                ? "bg-surface-elevated text-text-primary shadow-sm"
                                : "text-text-tertiary hover:text-text-secondary"
                        }`}
                    >
                        {tab.label}
                        {tab.count !== undefined && tab.count > 0 && (
                            <span
                                className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                                    activeTab === tab.id
                                        ? "bg-accent-primary text-text-inverse"
                                        : "bg-surface-tertiary text-text-tertiary"
                                }`}
                            >
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Content */}
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
                                allowedTypes={["host", "promoter"]}
                                partnerId={venueId}
                                role="venue"
                            />
                        </motion.div>
                    ) : activeTab === "roster" ? (
                        <motion.div
                            key="roster"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                        >
                            <ActiveRoster
                                connections={roster}
                                loading={loading}
                                formatDate={formatDate}
                                onViewProfile={(conn) =>
                                    setProfileTarget({
                                        id: conn.otherId,
                                        type: conn.otherType,
                                        name: conn.otherName,
                                        city: "",
                                        connectionStatus:
                                            conn.status === "active" ? "active" : "approved",
                                    })
                                }
                            />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="pending"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                        >
                            <PendingRequests
                                requests={pending}
                                loading={loading}
                                processingId={processingId}
                                formatDate={formatDate}
                                onAccept={(conn) => setTierTarget(conn)}
                                onDecline={handleDecline}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Tier selection modal */}
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

            {/* Profile modal */}
            <AnimatePresence>
                {profileTarget && (
                    <NetworkProfileModal
                        profile={profileTarget}
                        onClose={() => setProfileTarget(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

/* ───────────────────── Sub-sections ───────────────────── */

function ActiveRoster({
    connections,
    loading,
    formatDate,
    onViewProfile,
}: {
    connections: Connection[];
    loading: boolean;
    formatDate: (ts: any) => string;
    onViewProfile: (conn: Connection) => void;
}) {
    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-52 bg-surface-secondary rounded-[2rem] animate-pulse border border-border-subtle" />
                ))}
            </div>
        );
    }

    if (connections.length === 0) {
        return (
            <EmptyState
                icon={<CheckCircle2 className="w-8 h-8 text-text-placeholder" />}
                title="No active partners yet"
                subtitle="Approve incoming requests to build your roster."
            />
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {connections.map((conn) => (
                <motion.div
                    key={conn.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group bg-surface-elevated border border-border-default rounded-[2rem] p-6 hover:border-border-strong hover:shadow-sm transition-all"
                >
                    <div className="flex items-start justify-between mb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-surface-secondary border border-border-subtle flex items-center justify-center text-xl font-black text-text-tertiary">
                                {conn.otherName[0]}
                            </div>
                            <div>
                                <h3 className="text-title font-bold text-text-primary group-hover:text-accent-primary transition-colors">
                                    {conn.otherName}
                                </h3>
                                <span className="flex items-center gap-1 text-caption text-text-tertiary capitalize mt-0.5">
                                    {conn.otherType === "host" ? (
                                        <UserCircle className="w-3.5 h-3.5" />
                                    ) : (
                                        <Zap className="w-3.5 h-3.5" />
                                    )}
                                    {conn.otherType}
                                </span>
                            </div>
                        </div>
                        {conn.tier && (
                            <span
                                className={`text-label px-2.5 py-1 rounded-lg font-bold ${
                                    conn.tier === "trusted"
                                        ? "bg-accent-glow text-accent-primary"
                                        : "bg-surface-tertiary text-text-tertiary border border-border-default"
                                }`}
                            >
                                {conn.tier === "trusted" ? "T1" : "T2"}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center justify-between text-caption text-text-tertiary mb-5">
                        <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Since {formatDate(conn.updatedAt || conn.createdAt)}
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-text-secondary">
                            <span className="w-2 h-2 rounded-full bg-accent-primary" /> Active
                        </span>
                    </div>

                    <button
                        onClick={() => onViewProfile(conn)}
                        className="w-full py-3 bg-surface-secondary hover:bg-surface-tertiary border border-border-default rounded-xl text-caption font-bold text-text-secondary transition-all flex items-center justify-center gap-2"
                    >
                        View Profile <ChevronRight className="w-4 h-4" />
                    </button>
                </motion.div>
            ))}
        </div>
    );
}

function PendingRequests({
    requests,
    loading,
    processingId,
    formatDate,
    onAccept,
    onDecline,
}: {
    requests: Connection[];
    loading: boolean;
    processingId: string | null;
    formatDate: (ts: any) => string;
    onAccept: (conn: Connection) => void;
    onDecline: (id: string) => void;
}) {
    if (loading) {
        return (
            <div className="space-y-4">
                {[1, 2].map((i) => (
                    <div key={i} className="h-28 bg-surface-secondary rounded-[2rem] animate-pulse border border-border-subtle" />
                ))}
            </div>
        );
    }

    if (requests.length === 0) {
        return (
            <EmptyState
                icon={<Clock className="w-8 h-8 text-text-placeholder" />}
                title="No pending requests"
                subtitle="Incoming partnership requests from hosts and promoters will appear here."
            />
        );
    }

    return (
        <div className="space-y-4">
            <AnimatePresence mode="popLayout">
                {requests.map((req) => (
                    <motion.div
                        key={req.id}
                        layout
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        className="group bg-surface-elevated border border-border-default rounded-[2rem] p-6 border-l-4 border-l-accent-primary hover:shadow-sm transition-all"
                    >
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-surface-secondary border border-border-subtle flex items-center justify-center text-xl font-black text-text-tertiary shrink-0">
                                    {req.otherName[0]}
                                </div>
                                <div>
                                    <h4 className="text-title font-bold text-text-primary group-hover:text-accent-primary transition-colors">
                                        {req.otherName}
                                    </h4>
                                    <div className="flex items-center gap-3 mt-0.5">
                                        <span className="text-caption text-text-tertiary capitalize flex items-center gap-1">
                                            {req.otherType === "host" ? (
                                                <UserCircle className="w-3.5 h-3.5" />
                                            ) : (
                                                <Zap className="w-3.5 h-3.5" />
                                            )}
                                            {req.otherType}
                                        </span>
                                        <span className="text-caption text-text-placeholder">
                                            {formatDate(req.createdAt)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={() => onAccept(req)}
                                    disabled={!!processingId}
                                    className="btn btn-primary h-10 px-5 text-[13px]"
                                >
                                    {processingId === req.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        "Accept"
                                    )}
                                </button>
                                <button
                                    onClick={() => onDecline(req.id)}
                                    disabled={!!processingId}
                                    className="h-10 w-10 rounded-xl bg-surface-tertiary border border-border-default text-text-tertiary flex items-center justify-center hover:bg-surface-secondary hover:text-text-primary transition-all active:scale-95 disabled:opacity-50"
                                    title="Decline"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {req.message && (
                            <div className="mt-4 p-4 bg-surface-secondary rounded-2xl border border-border-subtle">
                                <p className="text-body-sm text-text-secondary italic">"{req.message}"</p>
                            </div>
                        )}
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}

function EmptyState({
    icon,
    title,
    subtitle,
}: {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
}) {
    return (
        <div className="py-24 bg-surface-elevated rounded-[3rem] border border-dashed border-border-default flex flex-col items-center text-center px-10">
            <div className="w-16 h-16 bg-surface-tertiary rounded-2xl flex items-center justify-center mb-5">
                {icon}
            </div>
            <h4 className="text-title font-semibold text-text-primary">{title}</h4>
            <p className="text-body-sm text-text-tertiary mt-1 max-w-xs">{subtitle}</p>
        </div>
    );
}
