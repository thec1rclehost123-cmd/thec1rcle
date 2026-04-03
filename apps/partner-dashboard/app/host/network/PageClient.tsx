"use client";

import { useEffect, useState, useCallback } from "react";
import {
<<<<<<< HEAD
    Building2, CheckCircle2, Clock, XCircle,
    Search, Loader2, Handshake, X, Bell, Zap, RefreshCw,
=======
    Building2, CheckCircle2, Clock,
    Search, Loader2, X, Bell, Zap,
>>>>>>> origin/staging
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { VenuePageShell } from "@/components/venue-layout/VenuePageShell";
<<<<<<< HEAD
import { NetworkProfileModal, NetworkProfile } from "@/components/partnerships/NetworkProfileModal";
import { StatTrendCard } from "@/components/promoter/PlaceholderCharts";
import { DiscoverDirectory, StatusCard } from "@/components/partnerships/DiscoverDirectory";
=======
import { DiscoverDirectory } from "@/components/partnerships/DiscoverDirectory";
import { BasePartnerCard } from "@/components/partnerships/BasePartnerCard";
>>>>>>> origin/staging

type Tab = "discover" | "incoming" | "pending" | "active" | "declined";

interface VenuePartner {
    connectionId: string;
    id: string;
    name: string;
    city: string;
    partnershipStatus: "active" | "pending" | "declined";
    createdAt?: string;
    initiatedBy?: string;
    photoURL?: string | null;
    coverURL?: string | null;
}

interface PromoterConnection {
    connectionId: string;
    id: string;
    name: string;
    status: "active" | "pending" | "declined";
    initiatedBy?: string;
    createdAt?: string;
    photoURL?: string | null;
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
    const [discoverSearch, setDiscoverSearch] = useState("");
    const [discoverType, setDiscoverType] = useState("venue");
    const [discoverCity, setDiscoverCity] = useState("");
    const [discoverRefresh, setDiscoverRefresh] = useState(0);

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
                c.type === "partnership" && (c.status === "active" || c.status === "approved" || c.status === "pending" || c.status === "declined" || c.status === "rejected")
            );
            setVenues(venueConns.map((c: any) => ({
                connectionId: c.id,
                id: c.otherId || c.venueId,
                name: c.otherName || c.venueName || "Venue",
                city: c.city || c.venueCity || "",
                partnershipStatus: (c.status === "active" || c.status === "approved") ? "active" : (c.status === "pending") ? "pending" : "declined",
                createdAt: c.updatedAt || c.createdAt,
                initiatedBy: c.initiatedBy,
                photoURL: c.photoURL || null,
                coverURL: c.coverURL || null,
            })));

            const promoterConns = allConns.filter((c: any) =>
                c.type === "promoter_connection" && (c.status === "active" || c.status === "approved" || c.status === "pending" || c.status === "declined" || c.status === "rejected")
            );
            setPromoterConnections(promoterConns.map((c: any) => ({
                connectionId: c.id,
                id: c.otherId || c.promoterId,
                name: c.otherName || c.promoterName || "Promoter",
                status: (c.status === "active" || c.status === "approved") ? "active" : (c.status === "pending") ? "pending" : "declined",
                initiatedBy: c.initiatedBy,
                createdAt: c.updatedAt || c.createdAt,
                photoURL: c.photoURL || null,
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

    const handleVenueReRequest = async (v: VenuePartner) => {
        setProcessingId(v.connectionId);
        try {
            const token = typeof getIdToken === "function" ? await getIdToken() : await user?.getIdToken();
            await fetch("/api/discovery", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ requesterId: hostId, requesterType: "host", requesterName: profile?.name || "", targetId: v.id, targetType: "venue", targetName: v.name }),
            });
            await fetchData();
        } catch { /* */ } finally { setProcessingId(null); }
    };

    const handleVenueRemove = async (connectionId: string) => {
        setProcessingId(connectionId);
        try {
            const token = typeof getIdToken === "function" ? await getIdToken() : await user?.getIdToken();
            await fetch("/api/discovery", {
                method: "PATCH",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ connectionId, action: "remove", role: "host", partnerId: hostId }),
            });
            await fetchData();
        } catch { /* */ } finally { setProcessingId(null); }
    };

    const handlePromoterReRequest = async (p: PromoterConnection) => {
        setProcessingId(p.connectionId);
        try {
            const token = typeof getIdToken === "function" ? await getIdToken() : await user?.getIdToken();
            await fetch("/api/discovery", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ requesterId: hostId, requesterType: "host", requesterName: profile?.name || "", targetId: p.id, targetType: "promoter", targetName: p.name }),
            });
            await fetchData();
        } catch { /* */ } finally { setProcessingId(null); }
    };

    const handlePromoterRemove = async (connectionId: string) => {
        setProcessingId(connectionId);
        try {
            const token = typeof getIdToken === "function" ? await getIdToken() : await user?.getIdToken();
            await fetch("/api/discovery", {
                method: "PATCH",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ connectionId, action: "remove", role: "host", partnerId: hostId }),
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

    const declinedVenues = venues.filter(v => v.partnershipStatus === "declined");
    const declinedPromoters = promoterConnections.filter(p => p.status === "declined");
    // "initiatedBy === 'host'" means host sent the request and venue declined it
    const declinedVenuesByThem = declinedVenues.filter(v => v.initiatedBy === "host");
    const declinedVenuesByHost = declinedVenues.filter(v => v.initiatedBy !== "host");
    const declinedPromotersByThem = declinedPromoters.filter(p => p.initiatedBy === "host");
    const declinedPromotersByHost = declinedPromoters.filter(p => p.initiatedBy !== "host");

    const TABS: { id: Tab; label: string; count?: number }[] = [
        { id: "discover", label: "Discover" },
        { id: "active", label: "Active", count: activeVenues.length + activePromoters.length },
        { id: "incoming", label: "Incoming", count: pendingIncoming.length + pendingIncomingPromoters.length },
        { id: "pending", label: "Pending", count: pendingOutgoing.length },
        { id: "declined", label: "Declined", count: declinedVenues.length + declinedPromoters.length },
    ];

    return (
        <VenuePageShell
            title="Partners"
            subtitle="Venues and promoters connected to your host profile"
        >
<<<<<<< HEAD
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
                            Connect with venues and promoters to access production calendars, book slots, and grow your event portfolio.
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* Stats strip */}
            <motion.div {...mp(0.06)}>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatTrendCard label="Active Venues" value={activeVenues.length} trendUp={activeVenues.length > 0} color="#34d399" icon={<CheckCircle2 className="w-4 h-4" />} />
                    <StatTrendCard label="Active Promoters" value={activePromoters.length} trendUp={activePromoters.length > 0} color="#818cf8" icon={<Zap className="w-4 h-4" />} />
                    <StatTrendCard label="Pending Requests" value={pendingVenues.length + pendingIncomingPromoters.length} color="#f59e0b" icon={<Clock className="w-4 h-4" />} />
                    <StatTrendCard label="Total Connected" value={activeVenues.length + activePromoters.length} color="#F44A22" icon={<Building2 className="w-4 h-4" />} />
                </div>
            </motion.div>

            {/* Tab bar + search/filter — separate elements */}
            <motion.div {...mp(0.1)}>
                <div className="flex items-center gap-3">
                    {/* Tab pills */}
                    <div className="flex items-center p-1.5 rounded-2xl shrink-0" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all shrink-0"
                                style={activeTab === tab.id
                                    ? { background: "var(--v-elevated)", color: "var(--v-text-primary)" }
                                    : { color: "var(--v-text-tertiary)" }}
                            >
                                {tab.id === "discover" && <Search className={`w-3.5 h-3.5 ${activeTab === tab.id ? "text-[#818cf8]" : ""}`} />}
                                {tab.id === "incoming" && <Bell className={`w-3.5 h-3.5 ${activeTab === tab.id ? "text-[#F44A22]" : ""}`} />}
                                {tab.id === "pending" && <Clock className={`w-3.5 h-3.5 ${activeTab === tab.id ? "text-[#f59e0b]" : ""}`} />}
                                {tab.id === "active" && <CheckCircle2 className={`w-3.5 h-3.5 ${activeTab === tab.id ? "text-[#34d399]" : ""}`} />}
                                {tab.id === "declined" && <XCircle className={`w-3.5 h-3.5 ${activeTab === tab.id ? "text-[#f87171]" : ""}`} />}
                                {tab.label}
                                {tab.count !== undefined && tab.count > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black"
                                        style={activeTab === tab.id
                                            ? { background: "#F44A22", color: "#fff" }
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
                                placeholder="Search venues & promoters..."
                                className="flex-1 min-w-0 bg-transparent border-none outline-none text-[13px] font-medium placeholder:opacity-40"
                                style={{ color: "var(--v-text-primary)" }}
                            />
                            {discoverSearch && (
                                <button onClick={() => setDiscoverSearch("")} className="shrink-0 opacity-40 hover:opacity-70 transition-opacity">
                                    <X className="w-3.5 h-3.5" style={{ color: "var(--v-text-secondary)" }} />
                                </button>
=======
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
>>>>>>> origin/staging
                            )}
                        </div>
                        <div className="flex items-center gap-0.5 p-1.5 rounded-2xl shrink-0" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            {[{ value: "venue", label: "Venues" }, { value: "promoter", label: "Promoters" }].map(opt => (
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
<<<<<<< HEAD
                                <DiscoverDirectory
                                    allowedTypes={["venue", "promoter"]}
                                    partnerId={hostId}
                                    role="host"
                                    searchQuery={discoverSearch}
                                    filterType={discoverType as any}
                                    filterCity={discoverCity}
                                    refreshTrigger={discoverRefresh}
                                />
=======
                                <DiscoverDirectory allowedTypes={["venue", "promoter"]} partnerId={hostId} role="host" />
>>>>>>> origin/staging
                            </motion.div>

                        ) : activeTab === "incoming" ? (
                            <motion.div key="incoming" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                {loading ? (
                                    <div className="flex justify-center py-32">
                                        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#F44A22" }} />
                                    </div>
                                ) : (() => {
                                        const filteredVenueIncoming = discoverType === "venue"
                                            ? pendingIncoming.filter(v => !discoverSearch || v.name.toLowerCase().includes(discoverSearch.toLowerCase()))
                                            : [];
                                        const filteredPromoterIncoming = discoverType === "promoter"
                                            ? pendingIncomingPromoters.filter(p => !discoverSearch || p.name.toLowerCase().includes(discoverSearch.toLowerCase()))
                                            : [];
                                        if (filteredVenueIncoming.length === 0 && filteredPromoterIncoming.length === 0) {
                                            return <EmptyState icon={<Bell className="w-8 h-8" style={{ color: "#F44A22" }} />} title="No incoming requests" subtitle="Partnership requests from venues and promoters will appear here for your approval." />;
                                        }
                                        return (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                                <AnimatePresence>
                                                    {filteredVenueIncoming.map(v => (
                                                        <StatusCard
                                                            key={v.connectionId}
                                                            name={v.name}
                                                            type="venue"
                                                            city={v.city}
                                                            photoURL={v.photoURL}
                                                            coverURL={v.coverURL}
                                                            connectionStatus="incoming"
                                                            onApprove={() => handleApprove(v.connectionId)}
                                                            onReject={() => handleReject(v.connectionId)}
                                                            isProcessing={processingId === v.connectionId}
                                                        />
                                                    ))}
                                                    {filteredPromoterIncoming.map(p => (
                                                        <StatusCard
                                                            key={p.connectionId}
                                                            name={p.name}
                                                            type="promoter"
                                                            connectionStatus="incoming"
                                                            onApprove={() => handlePromoterAction(p.connectionId, "approve")}
                                                            onReject={() => handlePromoterAction(p.connectionId, "reject")}
                                                            isProcessing={processingId === p.connectionId}
                                                        />
                                                    ))}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    })()}
                            </motion.div>

                        ) : activeTab === "pending" ? (
                            <motion.div key="pending" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                {loading ? (
                                    <div className="flex justify-center py-32">
                                        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#F44A22" }} />
                                    </div>
                                ) : (() => {
                                    const filteredPendingOutgoing = discoverType === "venue"
                                        ? pendingOutgoing.filter(v => !discoverSearch || v.name.toLowerCase().includes(discoverSearch.toLowerCase()))
                                        : [];
                                    if (filteredPendingOutgoing.length === 0) {
                                        return <EmptyState icon={<Clock className="w-8 h-8" style={{ color: "#f59e0b" }} />} title="No sent requests" subtitle="Requests you've sent to venues awaiting their approval will appear here." />;
                                    }
                                    return (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                            {filteredPendingOutgoing.map(v => (
                                                <StatusCard
                                                    key={v.connectionId}
                                                    name={v.name}
                                                    type="venue"
                                                    city={v.city}
                                                    photoURL={v.photoURL}
                                                    coverURL={v.coverURL}
                                                    connectionStatus="pending"
                                                />
                                            ))}
                                        </div>
                                    );
                                    })()}
                            </motion.div>

                        ) : activeTab === "declined" ? (
                            <motion.div key="declined" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                {loading ? (
                                    <div className="flex justify-center py-32">
                                        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#F44A22" }} />
                                    </div>
                                ) : declinedVenues.length + declinedPromoters.length === 0 ? (
                                    <EmptyState icon={<XCircle className="w-8 h-8" style={{ color: "#f87171" }} />} title="No declined connections" subtitle="Declined partnership requests will appear here." />
                                ) : (
                                    <div className="flex flex-col gap-8">
                                        {(() => {
                                            const filteredByThem = discoverType === "venue"
                                                ? declinedVenuesByThem.filter(v => !discoverSearch || v.name.toLowerCase().includes(discoverSearch.toLowerCase()))
                                                : declinedPromotersByThem.filter(p => !discoverSearch || p.name.toLowerCase().includes(discoverSearch.toLowerCase()));
                                            const filteredByHost = discoverType === "venue"
                                                ? declinedVenuesByHost.filter(v => !discoverSearch || v.name.toLowerCase().includes(discoverSearch.toLowerCase()))
                                                : declinedPromotersByHost.filter(p => !discoverSearch || p.name.toLowerCase().includes(discoverSearch.toLowerCase()));
                                            return (
                                                <>
                                                    {filteredByThem.length > 0 && (
                                                        <div>
                                                            <p className="text-[11px] font-black uppercase tracking-widest mb-4" style={{ color: "var(--v-text-tertiary)" }}>They declined your request</p>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                                                {discoverType === "venue"
                                                                    ? (filteredByThem as VenuePartner[]).map(v => (
                                                                        <StatusCard
                                                                            key={v.connectionId}
                                                                            name={v.name}
                                                                            type="venue"
                                                                            city={v.city}
                                                                            photoURL={v.photoURL}
                                                                            coverURL={v.coverURL}
                                                                            connectionStatus="declined"
                                                                            onReRequest={() => handleVenueReRequest(v)}
                                                                            isProcessing={processingId === v.connectionId}
                                                                            onViewProfile={() => setProfileTarget({ id: v.id, type: "venue", name: v.name, city: v.city, connectionStatus: "rejected" })}
                                                                        />
                                                                    ))
                                                                    : (filteredByThem as PromoterConnection[]).map(p => (
                                                                        <StatusCard
                                                                            key={p.connectionId}
                                                                            name={p.name}
                                                                            type="promoter"
                                                                            connectionStatus="declined"
                                                                            onReRequest={() => handlePromoterReRequest(p)}
                                                                            isProcessing={processingId === p.connectionId}
                                                                            onViewProfile={() => setProfileTarget({ id: p.id, type: "promoter" as any, name: p.name, city: "", connectionStatus: "rejected" })}
                                                                        />
                                                                    ))
                                                                }
                                                            </div>
                                                        </div>
                                                    )}
                                                    {filteredByHost.length > 0 && (
                                                        <div>
                                                            <p className="text-[11px] font-black uppercase tracking-widest mb-4" style={{ color: "var(--v-text-tertiary)" }}>You declined</p>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                                                {discoverType === "venue"
                                                                    ? (filteredByHost as VenuePartner[]).map(v => (
                                                                        <StatusCard
                                                                            key={v.connectionId}
                                                                            name={v.name}
                                                                            type="venue"
                                                                            city={v.city}
                                                                            photoURL={v.photoURL}
                                                                            coverURL={v.coverURL}
                                                                            connectionStatus="declined"
                                                                            onRemove={() => handleVenueRemove(v.connectionId)}
                                                                            isProcessing={processingId === v.connectionId}
                                                                            onViewProfile={() => setProfileTarget({ id: v.id, type: "venue", name: v.name, city: v.city, connectionStatus: "rejected" })}
                                                                        />
                                                                    ))
                                                                    : (filteredByHost as PromoterConnection[]).map(p => (
                                                                        <StatusCard
                                                                            key={p.connectionId}
                                                                            name={p.name}
                                                                            type="promoter"
                                                                            connectionStatus="declined"
                                                                            onRemove={() => handlePromoterRemove(p.connectionId)}
                                                                            isProcessing={processingId === p.connectionId}
                                                                            onViewProfile={() => setProfileTarget({ id: p.id, type: "promoter" as any, name: p.name, city: "", connectionStatus: "rejected" })}
                                                                        />
                                                                    ))
                                                                }
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
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
<<<<<<< HEAD
                                ) : (() => {
                                    const filteredVenues = discoverType === "venue"
                                        ? activeVenues.filter(v => !discoverSearch || v.name.toLowerCase().includes(discoverSearch.toLowerCase()))
                                        : [];
                                    const filteredPromoters = discoverType === "promoter"
                                        ? activePromoters.filter(p => !discoverSearch || p.name.toLowerCase().includes(discoverSearch.toLowerCase()))
                                        : [];
                                    if (filteredVenues.length === 0 && filteredPromoters.length === 0) {
                                        return (
                                            <EmptyState
                                                icon={<Building2 className="w-8 h-8" style={{ color: "#34d399" }} />}
                                                title="No active partners"
                                                subtitle="Venues and promoters will appear here once connections are approved."
                                            />
                                        );
                                    }
                                    return (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                            {filteredVenues.map(v => (
                                                <StatusCard
                                                    key={v.id}
                                                    name={v.name}
                                                    type="venue"
                                                    city={v.city}
                                                    photoURL={v.photoURL}
                                                    coverURL={v.coverURL}
                                                    connectionStatus="active"
                                                    onViewProfile={() => setProfileTarget({ id: v.id, type: "venue", name: v.name, city: v.city, connectionStatus: "active" })}
                                                />
                                            ))}
                                            {filteredPromoters.map(p => (
                                                <StatusCard
                                                    key={p.id}
                                                    name={p.name}
                                                    type="promoter"
                                                    connectionStatus="active"
                                                    onViewProfile={() => setProfileTarget({ id: p.id, type: "promoter" as any, name: p.name, city: "", connectionStatus: "active" })}
                                                />
                                            ))}
                                        </div>
                                    );
                                })()}
=======
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
>>>>>>> origin/staging
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
