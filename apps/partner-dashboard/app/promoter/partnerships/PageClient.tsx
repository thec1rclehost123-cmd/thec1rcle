"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Users,
    Clock,
    CheckCircle2,
    XCircle,
    Search,
    RefreshCw,
    Loader2,
    Building2,
    UserCircle,
    ChevronRight,
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { DiscoverDirectory } from "@/components/partnerships/DiscoverDirectory";
import { NetworkProfileModal, NetworkProfile } from "@/components/partnerships/NetworkProfileModal";
import { motion, AnimatePresence } from "framer-motion";

type Tab = "discover" | "pending" | "active" | "declined";

interface Partnership {
    id: string;
    otherId: string;
    otherName: string;
    otherType: "host" | "venue" | "promoter";
    status: string;
    tier?: "trusted" | "standard";
    createdAt: any;
    updatedAt?: any;
}

export default function PromoterPartnershipsPage() {
    const { profile, user } = useDashboardAuth();
    const [partnerships, setPartnerships] = useState<Partnership[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>("discover");
    const [profileTarget, setProfileTarget] = useState<NetworkProfile | null>(null);

    const promoterId = profile?.activeMembership?.partnerId;

    const fetchPartnerships = useCallback(async () => {
        if (!promoterId) return;
        setLoading(true);
        try {
            const token = await user?.getIdToken();
            const res = await fetch(
                `/api/discovery?partnerId=${promoterId}&role=promoter&action=list`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const data = await res.json();
            setPartnerships(data.connections || []);
        } catch (err) {
            console.error("[Promoter Partnerships] fetch error:", err);
        } finally {
            setLoading(false);
        }
    }, [promoterId, user]);

    useEffect(() => {
        if (promoterId) fetchPartnerships();
    }, [promoterId, fetchPartnerships]);

    const formatDate = (ts: any) => {
        if (!ts) return "";
        const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
        return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    };

    const pending = partnerships.filter((p) => p.status === "pending");
    const active = partnerships.filter(
        (p) => p.status === "approved" || p.status === "active"
    );
    const declined = partnerships.filter((p) => p.status === "rejected");

    const TABS: { id: Tab; label: string; count?: number }[] = [
        { id: "discover", label: "Discover" },
        { id: "pending", label: "Pending", count: pending.length },
        { id: "active", label: "Active", count: active.length },
        { id: "declined", label: "Declined", count: declined.length },
    ];

    const filtered =
        activeTab === "pending"
            ? pending
            : activeTab === "active"
            ? active
            : activeTab === "declined"
            ? declined
            : [];

    return (
        <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border-default pb-8">
                <div>
                    <div className="flex items-center gap-3 mb-3 text-c1rcle-orange">
                        <div className="p-2 bg-c1rcle-orange-glow rounded-xl">
                            <Users className="w-5 h-5" />
                        </div>
                        <span className="text-label font-black uppercase tracking-widest">
                            Partner Network
                        </span>
                    </div>
                    <h1 className="text-display-sm font-bold text-text-primary tracking-tight">
                        Partnerships
                    </h1>
                    <p className="text-body text-text-tertiary mt-2 max-w-xl">
                        Build your venue and host network to unlock affiliate links and event access.
                    </p>
                </div>

                {/* KPI chips */}
                <div className="flex gap-3">
                    <div className="px-5 py-3 bg-surface-elevated border border-border-default rounded-2xl text-center">
                        <p className="text-stat-xs font-bold text-text-primary">{active.length}</p>
                        <p className="text-label text-text-tertiary mt-0.5">Active</p>
                    </div>
                    <div className="px-5 py-3 bg-surface-elevated border border-border-default rounded-2xl text-center">
                        <p className="text-stat-xs font-bold text-c1rcle-orange">{pending.length}</p>
                        <p className="text-label text-text-tertiary mt-0.5">Pending</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center p-1.5 bg-surface-secondary rounded-2xl w-fit border border-border-subtle overflow-x-auto">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all shrink-0 ${
                            activeTab === tab.id
                                ? "bg-surface-elevated text-text-primary shadow-sm"
                                : "text-text-tertiary hover:text-text-secondary"
                        }`}
                    >
                        {tab.id === "discover" && <Search className={`w-4 h-4 ${activeTab === tab.id ? "text-c1rcle-orange" : ""}`} />}
                        {tab.id === "pending" && <Clock className={`w-4 h-4 ${activeTab === tab.id ? "text-c1rcle-orange" : ""}`} />}
                        {tab.id === "active" && <CheckCircle2 className={`w-4 h-4 ${activeTab === tab.id ? "text-c1rcle-orange" : ""}`} />}
                        {tab.id === "declined" && <XCircle className={`w-4 h-4 ${activeTab === tab.id ? "" : ""}`} />}
                        {tab.label}
                        {tab.count !== undefined && tab.count > 0 && (
                            <span
                                className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                                    activeTab === tab.id
                                        ? "bg-c1rcle-orange text-text-inverse"
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
                                allowedTypes={["venue", "host"]}
                                partnerId={promoterId}
                                role="promoter"
                            />
                        </motion.div>
                    ) : (
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                        >
                            {loading ? (
                                <div className="flex justify-center py-32">
                                    <Loader2 className="w-8 h-8 text-text-placeholder animate-spin" />
                                </div>
                            ) : filtered.length === 0 ? (
                                <EmptyState tab={activeTab} />
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {filtered.map((p) => (
                                        <PartnershipCard
                                            key={p.id}
                                            partnership={p}
                                            formatDate={formatDate}
                                            onView={() =>
                                                setProfileTarget({
                                                    id: p.otherId,
                                                    type: p.otherType as any,
                                                    name: p.otherName,
                                                    city: "",
                                                    connectionStatus:
                                                        p.status === "active" ? "active" : (p.status as any),
                                                })
                                            }
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
        </div>
    );
}

function PartnershipCard({
    partnership,
    formatDate,
    onView,
}: {
    partnership: Partnership;
    formatDate: (ts: any) => string;
    onView: () => void;
}) {
    const isActive =
        partnership.status === "approved" || partnership.status === "active";
    const isPending = partnership.status === "pending";
    const isDeclined = partnership.status === "rejected";

    const statusConfig = isActive
        ? { label: "Active", dotClass: "bg-c1rcle-orange", textClass: "text-text-secondary" }
        : isPending
        ? { label: "Pending", dotClass: "bg-text-placeholder", textClass: "text-text-tertiary" }
        : { label: "Declined", dotClass: "bg-border-strong", textClass: "text-text-placeholder" };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="group bg-surface-elevated border border-border-default rounded-[2rem] p-6 hover:border-border-strong hover:shadow-sm transition-all"
        >
            <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-surface-secondary border border-border-subtle flex items-center justify-center text-xl font-black text-text-tertiary">
                        {partnership.otherName[0]}
                    </div>
                    <div>
                        <h3 className="text-title font-bold text-text-primary group-hover:text-c1rcle-orange transition-colors">
                            {partnership.otherName}
                        </h3>
                        <span className="flex items-center gap-1 text-caption text-text-tertiary capitalize mt-0.5">
                            {partnership.otherType === "venue" ? (
                                <Building2 className="w-3.5 h-3.5" />
                            ) : (
                                <UserCircle className="w-3.5 h-3.5" />
                            )}
                            {partnership.otherType}
                        </span>
                    </div>
                </div>
                {partnership.tier && isActive && (
                    <span
                        className={`text-label px-2.5 py-1 rounded-lg font-bold ${
                            partnership.tier === "trusted"
                                ? "bg-c1rcle-orange-glow text-c1rcle-orange"
                                : "bg-surface-tertiary text-text-tertiary border border-border-default"
                        }`}
                    >
                        {partnership.tier === "trusted" ? "Trusted" : "Standard"}
                    </span>
                )}
            </div>

            <div className="flex items-center justify-between text-caption mb-5">
                <span className="text-text-placeholder">
                    {formatDate(partnership.createdAt)}
                </span>
                <span className={`flex items-center gap-1.5 font-semibold ${statusConfig.textClass}`}>
                    <span className={`w-2 h-2 rounded-full ${statusConfig.dotClass}`} />
                    {statusConfig.label}
                </span>
            </div>

            <button
                onClick={onView}
                className="w-full py-3 bg-surface-secondary hover:bg-surface-tertiary border border-border-default rounded-xl text-caption font-bold text-text-secondary transition-all flex items-center justify-center gap-2"
            >
                View Profile <ChevronRight className="w-4 h-4" />
            </button>
        </motion.div>
    );
}

function EmptyState({ tab }: { tab: Tab }) {
    const config: Record<string, { icon: React.ReactNode; title: string; subtitle: string }> = {
        pending: {
            icon: <Clock className="w-8 h-8 text-text-placeholder" />,
            title: "No pending requests",
            subtitle: "Requests you send will appear here until venues respond.",
        },
        active: {
            icon: <CheckCircle2 className="w-8 h-8 text-text-placeholder" />,
            title: "No active partnerships",
            subtitle: "Once a venue approves your request, the partnership shows here.",
        },
        declined: {
            icon: <XCircle className="w-8 h-8 text-text-placeholder" />,
            title: "No declined requests",
            subtitle: "Requests that were declined by venues will appear here.",
        },
    };

    const c = config[tab] || config.pending;

    return (
        <div className="py-24 bg-surface-elevated rounded-[3rem] border border-dashed border-border-default flex flex-col items-center text-center px-10">
            <div className="w-16 h-16 bg-surface-tertiary rounded-2xl flex items-center justify-center mb-5">
                {c.icon}
            </div>
            <h4 className="text-title font-semibold text-text-primary">{c.title}</h4>
            <p className="text-body-sm text-text-tertiary mt-1 max-w-xs">{c.subtitle}</p>
        </div>
    );
}
