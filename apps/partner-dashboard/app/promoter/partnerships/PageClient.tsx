"use client";

import { useState } from "react";
import {
    Users,
    Clock,
    CheckCircle2,
    XCircle,
    Search,
    Loader2,
    Building2,
    UserCircle,
    ChevronRight,
    Network,
    Handshake,
    Zap,
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { usePromoterPartnerships } from "@/lib/hooks/usePromoterQueries";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { DiscoverDirectory } from "@/components/partnerships/DiscoverDirectory";
import { NetworkProfileModal, NetworkProfile } from "@/components/partnerships/NetworkProfileModal";
import { motion, AnimatePresence } from "framer-motion";
import { StatTrendCard } from "@/components/promoter/PlaceholderCharts";
import { formatDate } from "@/lib/utils/format";

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

const mp = (delay: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as any, delay },
});

export default function PromoterPartnershipsPage() {
    const { profile } = useDashboardAuth();
    const [activeTab, setActiveTab] = useState<Tab>("discover");
    const [profileTarget, setProfileTarget] = useState<NetworkProfile | null>(null);

    const promoterId = profile?.activeMembership?.partnerId;

    const { data, isLoading: loading } = usePromoterPartnerships(promoterId);
    const partnerships: Partnership[] = data?.connections || [];


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
        <VenuePageShell
            title="Partnerships"
            subtitle="Build your venue and host network to unlock affiliate links and event access"
            actions={
                <div className="flex gap-3">
                    <div
                        className="px-5 py-3 rounded-2xl text-center"
                        style={{
                            background: "var(--v-card)",
                            border: "1px solid var(--v-border)",
                        }}
                    >
                        <p
                            className="text-[20px] font-black tabular-nums"
                            style={{ color: "var(--v-text-primary)" }}
                        >
                            {active.length}
                        </p>
                        <p
                            className="text-[10px] font-black uppercase tracking-widest"
                            style={{ color: "var(--v-text-tertiary)" }}
                        >
                            Active
                        </p>
                    </div>
                    <div
                        className="px-5 py-3 rounded-2xl text-center"
                        style={{
                            background: "var(--v-card)",
                            border: "1px solid var(--v-border)",
                        }}
                    >
                        <p
                            className="text-[20px] font-black tabular-nums"
                            style={{ color: "#f59e0b" }}
                        >
                            {pending.length}
                        </p>
                        <p
                            className="text-[10px] font-black uppercase tracking-widest"
                            style={{ color: "var(--v-text-tertiary)" }}
                        >
                            Pending
                        </p>
                    </div>
                </div>
            }
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
                        value={pending.length}
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

            {/* ── Tabs ── */}
            <motion.div {...mp(0.1)}>
                <div
                    className="flex items-center p-1.5 rounded-2xl w-fit overflow-x-auto"
                    style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.06)",
                    }}
                >
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all shrink-0"
                            style={
                                activeTab === tab.id
                                    ? {
                                          background: "var(--v-elevated)",
                                          color: "var(--v-text-primary)",
                                      }
                                    : { color: "var(--v-text-tertiary)" }
                            }
                        >
                            {tab.id === "discover" && (
                                <Search
                                    className={`w-4 h-4 ${activeTab === tab.id ? "text-[#818cf8]" : ""}`}
                                />
                            )}
                            {tab.id === "pending" && (
                                <Clock
                                    className={`w-4 h-4 ${activeTab === tab.id ? "text-[#f59e0b]" : ""}`}
                                />
                            )}
                            {tab.id === "active" && (
                                <CheckCircle2
                                    className={`w-4 h-4 ${activeTab === tab.id ? "text-[#34d399]" : ""}`}
                                />
                            )}
                            {tab.id === "declined" && <XCircle className="w-4 h-4" />}
                            {tab.label}
                            {tab.count !== undefined && tab.count > 0 && (
                                <span
                                    className="px-1.5 py-0.5 rounded-md text-[10px] font-black"
                                    style={
                                        activeTab === tab.id
                                            ? { background: "#7c3aed", color: "#fff" }
                                            : {
                                                  background: "rgba(255,255,255,0.06)",
                                                  color: "var(--v-text-tertiary)",
                                              }
                                    }
                                >
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
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
                                    <Loader2
                                        className="w-8 h-8 animate-spin"
                                        style={{ color: "#7c3aed" }}
                                    />
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
                                                        p.status === "active"
                                                            ? "active"
                                                            : (p.status as any),
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
        </VenuePageShell>
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

    const statusConfig = isActive
        ? { label: "Active", color: "#34d399", bg: "rgba(52,211,153,0.1)" }
        : isPending
        ? { label: "Pending", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" }
        : { label: "Declined", color: "#f87171", bg: "rgba(248,113,113,0.1)" };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="group rounded-[32px] p-6 transition-all"
            style={{
                background: "var(--v-card, #1a1a1e)",
                border: "1px solid var(--v-border)",
            }}
            onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor =
                    "rgba(124,58,237,0.3)";
            }}
            onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--v-border)";
            }}
        >
            <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black"
                        style={{ background: "rgba(124,58,237,0.15)", color: "#a78bfa" }}
                    >
                        {partnership.otherName[0]}
                    </div>
                    <div>
                        <h3
                            className="text-[14px] font-bold text-text-primary group-hover:text-[#a78bfa] transition-colors"
                        >
                            {partnership.otherName}
                        </h3>
                        <span
                            className="flex items-center gap-1 text-[11px] text-text-tertiary capitalize mt-0.5"
                        >
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
                        className="text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest"
                        style={
                            partnership.tier === "trusted"
                                ? { background: "rgba(124,58,237,0.15)", color: "#a78bfa" }
                                : {
                                      background: "rgba(255,255,255,0.06)",
                                      color: "var(--v-text-tertiary)",
                                  }
                        }
                    >
                        {partnership.tier === "trusted" ? "Trusted" : "Standard"}
                    </span>
                )}
            </div>

            <div className="flex items-center justify-between mb-5">
                <span className="text-[11px] text-text-placeholder">
                    {formatDate(partnership.createdAt)}
                </span>
                <span
                    className="flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-lg"
                    style={{ background: statusConfig.bg, color: statusConfig.color }}
                >
                    <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: statusConfig.color }}
                    />
                    {statusConfig.label}
                </span>
            </div>

            <button
                onClick={onView}
                className="w-full py-3 rounded-xl text-[12px] font-bold transition-all flex items-center justify-center gap-2"
                style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "var(--v-text-secondary)",
                }}
            >
                View Profile <ChevronRight className="w-4 h-4" />
            </button>
        </motion.div>
    );
}

function EmptyState({ tab }: { tab: Tab }) {
    const config: Record<
        string,
        { icon: React.ReactNode; title: string; subtitle: string }
    > = {
        pending: {
            icon: <Clock className="w-8 h-8" style={{ color: "#f59e0b" }} />,
            title: "No pending requests",
            subtitle: "Requests you send will appear here until venues respond.",
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
