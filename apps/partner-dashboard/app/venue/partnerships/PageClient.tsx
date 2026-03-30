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
    Quote,
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { DiscoverDirectory } from "@/components/partnerships/DiscoverDirectory";
import { TierSelectionModal, ContractTier } from "@/components/partnerships/TierSelectionModal";
import { NetworkProfileModal, NetworkProfile } from "@/components/partnerships/NetworkProfileModal";
import { motion, AnimatePresence } from "framer-motion";
import { formatMonthYear } from "@/lib/utils/format";

type Tab = "roster" | "pending" | "discover";

interface Connection {
    id: string;
    type: string;
    otherId: string;
    otherName: string;
    otherType: "host" | "promoter";
    status: string;
    tier?: ContractTier;
    createdAt: any;
    updatedAt?: any;
    message?: string;
    photoURL?: string | null;
    coverURL?: string | null;
    city?: string;
}

export default function VenuePartnershipsPage() {
    const { profile, user } = useDashboardAuth();
    const [connections, setConnections] = useState<Connection[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>("discover");
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [tierTarget, setTierTarget] = useState<Connection | null>(null);
    const [profileTarget, setProfileTarget] = useState<NetworkProfile | null>(null);

    const venueId = profile?.activeMembership?.partnerId;
    const venueName = profile?.displayName;

    const fetchConnections = useCallback(async () => {
        if (!venueId || !user) return;
        setLoading(true);
        setError(null);
        try {
            const token = await user.getIdToken();
            const res = await fetch(
                `/api/discovery?action=list&partnerId=${venueId}&role=venue`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
            const data = await res.json();
            const all: Connection[] = (data.connections || []).map((c: any) => ({
                id: c.id,
                type: c.type,
                otherId: c.otherId,
                otherName: c.otherName,
                otherType: c.otherType || (c.type === "partnership" ? "host" : "promoter"),
                status: c.status,
                tier: c.tier,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
                message: c.message,
                photoURL: c.photoURL || null,
                coverURL: c.coverURL || null,
                city: c.city || "",
            }));
            setConnections(all);
        } catch (err: any) {
            console.error("[Venue Partnerships] fetch error:", err);
            setError(err.message || "Failed to load partnerships");
        } finally {
            setLoading(false);
        }
    }, [venueId, user]);

    useEffect(() => {
        fetchConnections();
    }, [fetchConnections]);

    const handleApproveWithTier = async (tier: ContractTier, connectionId: string) => {
        const conn = connections.find(c => c.id === connectionId);
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
                    type: conn?.type,
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
        const conn = connections.find(c => c.id === connectionId);
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
                    type: conn?.type,
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


    const roster = connections.filter((c) => c.status === "approved" || c.status === "active");
    const pending = connections.filter((c) => c.status === "pending");

    const TABS: { id: Tab; label: string; count?: number }[] = [
        { id: "discover", label: "Discover" },
        { id: "pending", label: "Pending", count: pending.length },
        { id: "roster", label: "Active Roster", count: roster.length },
    ];

    return (
        <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500">
            {/* Content only - Header and Tabs removed for consistency with parent wrapper */}
            <div className="min-h-[500px]">
                {error ? (
                    <div className="py-24 bg-surface-elevated rounded-[3rem] border border-dashed border-error/50 flex flex-col items-center text-center px-10">
                        <div className="w-16 h-16 bg-error/10 rounded-2xl flex items-center justify-center mb-5">
                            <ShieldAlert className="w-8 h-8 text-error" />
                        </div>
                        <h4 className="text-title font-semibold text-text-primary">Connection Error</h4>
                        <p className="text-body-sm text-text-tertiary mt-1 max-w-xs">{error}</p>
                        <button 
                            onClick={() => fetchConnections()}
                            className="mt-6 px-6 py-2 bg-surface-secondary hover:bg-surface-tertiary rounded-xl text-caption font-bold transition-all"
                        >
                            Retry Connection
                        </button>
                    </div>
                ) : (
                    <ActiveRoster
                        connections={roster}
                        loading={loading}
                        formatDate={formatMonthYear}
                        onViewProfile={(conn) =>
                            setProfileTarget({
                                id: conn.otherId,
                                type: conn.otherType,
                                name: conn.otherName,
                                city: conn.city || "",
                                photoURL: conn.photoURL,
                                coverURL: conn.coverURL,
                                connectionStatus:
                                    conn.status === "active" ? "active" : "approved",
                            })
                        }
                    />
                )}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {connections.map((conn) => (
                <motion.div
                    key={conn.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group relative overflow-hidden bg-surface-secondary dark:bg-[#121216] border border-border-subtle rounded-[2.5rem] p-7 hover:border-orange-500/30 transition-all duration-500 hover:shadow-2xl hover:shadow-orange-500/5"
                >
                    {/* Background Shine */}
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                    
                    <div className="relative flex items-start justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <div className="absolute inset-0 bg-orange-500/20 rounded-2xl blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="relative w-14 h-14 rounded-2xl bg-surface-tertiary border border-border-subtle flex items-center justify-center text-2xl font-black text-text-primary overflow-hidden">
                                    {conn.photoURL
                                        ? <img src={conn.photoURL} alt={conn.otherName} className="w-full h-full object-cover" />
                                        : conn.otherName[0]}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-text-primary tracking-tight group-hover:text-orange-500 transition-colors">
                                    {conn.otherName}
                                </h3>
                                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-text-tertiary mt-1">
                                    {conn.otherType === "host" ? (
                                        <div className="p-1 rounded bg-orange-500/10 text-orange-500">
                                            <UserCircle className="w-3 h-3" />
                                        </div>
                                    ) : (
                                        <div className="p-1 rounded bg-orange-500/10 text-orange-500">
                                            <Zap className="w-3 h-3" />
                                        </div>
                                    )}
                                    {conn.otherType}
                                </span>
                            </div>
                        </div>
                        {conn.tier && (
                            <span
                                className={`text-[10px] px-3 py-1.5 rounded-xl font-black uppercase tracking-widest ${
                                    conn.tier === "trusted"
                                        ? "bg-gradient-to-r from-orange-500 to-rose-600 text-white shadow-lg shadow-orange-500/20"
                                        : "bg-surface-tertiary text-text-tertiary border border-border-subtle"
                                }`}
                            >
                                {conn.tier === "trusted" ? "Trusted" : "Standard"}
                            </span>
                        )}
                    </div>

                    <div className="relative flex items-center justify-between py-4 border-y border-border-subtle mb-6">
                        <span className="flex items-center gap-1.5 text-[11px] font-medium text-text-tertiary">
                            <Clock className="w-3.5 h-3.5 opacity-40" />
                            Partner since {formatMonthYear(conn.updatedAt || conn.createdAt)}
                        </span>
                        <span className="flex items-center gap-1.5 font-black text-[10px] uppercase tracking-widest text-orange-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" /> Active
                        </span>
                    </div>

                    <button
                        onClick={() => onViewProfile(conn)}
                        className="relative w-full py-3.5 bg-surface-secondary hover:bg-surface-tertiary border border-border-subtle rounded-2xl text-[11px] font-black uppercase tracking-widest text-text-primary transition-all flex items-center justify-center gap-2 group/btn overflow-hidden"
                    >
                        <span className="relative z-10 flex items-center gap-2">
                            View Network Profile <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                        </span>
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
                icon={<Clock className="w-8 h-8" />}
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
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95, x: 20 }}
                        className="relative overflow-hidden bg-surface-secondary dark:bg-[#121216] border border-border-subtle p-6 rounded-[2rem] group"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        
                        <div className="relative flex items-center justify-between">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-surface-tertiary border border-border-subtle flex items-center justify-center text-2xl font-black text-text-primary shadow-xl overflow-hidden">
                                    {req.photoURL
                                        ? <img src={req.photoURL} alt={req.otherName} className="w-full h-full object-cover" />
                                        : req.otherName[0]}
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-text-primary tracking-tight">{req.otherName}</h3>
                                    <div className="flex items-center gap-3 mt-1.5">
                                        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-orange-500">
                                            {req.otherType === "host" ? <UserCircle className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
                                            {req.otherType}
                                        </span>
                                        <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">•</span>
                                        <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">
                                            Received {formatDate(req.createdAt)}
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
                                    {processingId === req.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>Accept Request <CheckCircle2 className="w-3.5 h-3.5" /></>
                                    )}
                                </button>
                                <button
                                    onClick={() => onDecline(req.id)}
                                    disabled={!!processingId}
                                    className="h-12 w-12 rounded-xl bg-surface-secondary border border-border-default text-text-tertiary flex items-center justify-center hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all active:scale-95 disabled:opacity-50"
                                    title="Decline"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {req.message && (
                            <div className="mt-5 p-5 bg-surface-secondary rounded-2xl border border-border-subtle relative">
                                <div className="absolute top-4 left-4 text-orange-500/20">
                                    <Quote size={16} />
                                </div>
                                <p className="text-[13px] text-text-tertiary italic pl-8 leading-relaxed">"{req.message}"</p>
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
        <div className="py-32 relative overflow-hidden bg-surface-secondary dark:bg-[#0D0D0F] border border-dashed border-border-default rounded-[3rem] flex flex-col items-center text-center px-10 group">
            <div className="absolute inset-0 bg-gradient-to-b from-orange-500/[0.02] to-transparent pointer-events-none" />
            
            <div className="relative mb-6">
                <div className="absolute inset-0 bg-orange-500/20 rounded-[2rem] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="relative w-20 h-20 bg-surface-tertiary border border-border-subtle rounded-[2rem] flex items-center justify-center text-text-primary shadow-2xl transition-transform duration-500 group-hover:scale-110">
                    <div className="text-orange-500">
                        {icon}
                    </div>
                </div>
            </div>

            <h4 className="relative text-2xl font-black text-text-primary tracking-tight mb-2 uppercase">{title}</h4>
            <p className="relative text-[14px] text-text-tertiary font-medium max-w-xs leading-relaxed">{subtitle}</p>
        </div>
    );
}
