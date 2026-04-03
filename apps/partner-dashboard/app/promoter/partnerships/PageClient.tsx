"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Clock,
    CheckCircle2,
    XCircle,
    Search,
    Loader2,
    Bell,
    X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { usePromoterPartnerships } from "@/lib/hooks/usePromoterQueries";
import { VenuePageShell } from "@/components/venue-layout/VenuePageShell";
import { DiscoverDirectory } from "@/components/partnerships/DiscoverDirectory";
import { BasePartnerCard } from "@/components/partnerships/BasePartnerCard";
import { motion, AnimatePresence } from "framer-motion";

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
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<Tab>("discover");
    const [processingId, setProcessingId] = useState<string | null>(null);
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
    const declined = partnerships.filter((p) => p.status === "rejected");

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

    const TABS: { id: Tab; label: string; count?: number }[] = [
        { id: "discover", label: "Discover" },
        { id: "incoming", label: "Incoming", count: pendingIncoming.length },
        { id: "pending", label: "Pending", count: pendingOutgoing.length },
        { id: "active", label: "Active", count: active.length },
        { id: "declined", label: "Declined", count: declined.length },
    ];

    const filtered =
        activeTab === "active"
            ? active
            : activeTab === "declined"
            ? declined
            : [];

    const openPartnerProfile = (partnerId: string) => {
        router.push(`/promoter/partners/${partnerId}`);
    };

    return (
        <VenuePageShell
            title="Partners"
        >
            {/* ── Tabs ── */}
            <motion.div {...mp(0.1)}>
                <div
                    className="flex items-stretch p-2 rounded-[30px] w-full overflow-x-auto"
                    style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.06)",
                    }}
                >
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className="flex flex-1 items-center justify-center gap-3 px-7 py-5 rounded-[24px] text-[17px] font-semibold transition-all shrink-0 whitespace-nowrap"
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
                                    className={`w-5 h-5 ${activeTab === tab.id ? "text-[#818cf8]" : ""}`}
                                />
                            )}
                            {tab.id === "incoming" && (
                                <Bell
                                    className={`w-5 h-5 ${activeTab === tab.id ? "text-[#a78bfa]" : ""}`}
                                />
                            )}
                            {tab.id === "pending" && (
                                <Clock
                                    className={`w-5 h-5 ${activeTab === tab.id ? "text-[#f59e0b]" : ""}`}
                                />
                            )}
                            {tab.id === "active" && (
                                <CheckCircle2
                                    className={`w-5 h-5 ${activeTab === tab.id ? "text-[#34d399]" : ""}`}
                                />
                            )}
                            {tab.id === "declined" && <XCircle className="w-5 h-5" />}
                            {tab.label}
                            {tab.count !== undefined && tab.count > 0 && (
                                <span
                                    className="px-2.5 py-1 rounded-lg text-[12px] font-black min-w-[30px] text-center"
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
                                onOpenProfile={(partner) => openPartnerProfile(partner.id)}
                            />
                        </motion.div>
                    ) : activeTab === "incoming" ? (
                        <motion.div key="incoming" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            {loading ? (
                                <div className="flex justify-center py-32">
                                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#7c3aed" }} />
                                </div>
                            ) : pendingIncoming.length === 0 ? (
                                <div className="text-center py-20 px-6 border border-white/5 bg-white/[0.01] rounded-[40px] flex flex-col items-center gap-4">
                                 <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                                     <Clock className="w-10 h-10 text-white/20" />
                                 </div>
                                 <h3 className="text-lg font-black text-white">No incoming requests</h3>
                             </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                    <AnimatePresence mode="popLayout">
                                        {pendingIncoming.map((p) => (
                                            <BasePartnerCard
                                                key={p.id}
                                                partner={{
                                                    id: p.otherId,
                                                    type: p.otherType,
                                                    name: p.otherName,
                                                    eventsCount: 0,
                                                    followersCount: 0,
                                                    connectionStatus: null,
                                                }}
                                                onViewProfile={() => openPartnerProfile(p.otherId)}
                                                onPrimaryAction={() => handleAction(p.id, "approve")}
                                                onSecondaryAction={() => handleAction(p.id, "reject")}
                                                isActionLoading={processingId === p.id}
                                                primaryActionLabel="Approve"
                                                secondaryActionLabel="Decline"
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
                                    {pendingOutgoing.map((p) => (
                                        <BasePartnerCard
                                            key={p.id}
                                            partner={{
                                                id: p.otherId,
                                                type: p.otherType,
                                                name: p.otherName,
                                                eventsCount: 0,
                                                followersCount: 0,
                                                connectionStatus: "pending",
                                            }}
                                            onViewProfile={() => openPartnerProfile(p.otherId)}
                                            primaryActionLabel="Pending"
                                        />
                                    ))}
                                </div>
                            )}
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
                                        <BasePartnerCard
                                            key={p.id}
                                            partner={{
                                                id: p.otherId,
                                                type: p.otherType,
                                                name: p.otherName,
                                                eventsCount: 0,
                                                followersCount: 0,
                                                connectionStatus:
                                                    p.status === "approved" ? "active" : (p.status as any),
                                            }}
                                            onViewProfile={() => openPartnerProfile(p.otherId)}
                                            primaryActionLabel={
                                                activeTab === "active" ? "Connected" : "Declined"
                                            }
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

function EmptyState({ tab }: { tab: Tab }) {
    const config: Record<
        string,
        { icon: React.ReactNode; title: string }
    > = {
        incoming: {
            icon: <Bell className="w-8 h-8" style={{ color: "#a78bfa" }} />,
            title: "No incoming requests",
        },
        pending: {
            icon: <Clock className="w-8 h-8" style={{ color: "#f59e0b" }} />,
            title: "No sent requests",
        },
        active: {
            icon: <CheckCircle2 className="w-8 h-8" style={{ color: "#34d399" }} />,
            title: "No active partnerships",
        },
        declined: {
            icon: <XCircle className="w-8 h-8" style={{ color: "#f87171" }} />,
            title: "No declined requests",
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
        </div>
    );
}
