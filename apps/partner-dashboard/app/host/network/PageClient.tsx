"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Building2, CheckCircle2, Clock, XCircle, Search, Loader2,
    Handshake, X, Bell, Zap, RefreshCw, ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { VenuePageShell } from "@/components/venue-layout/VenuePageShell";
import { DiscoverDirectory, StatusCard } from "@/components/partnerships/DiscoverDirectory";
import { StatTrendCard } from "@/components/promoter/PlaceholderCharts";

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
    const { profile, user, getIdToken } = useDashboardAuth();
    const hostId = profile?.activeMembership?.partnerId;

    const [activeTab, setActiveTab] = useState<Tab>("discover");
    const [venues, setVenues] = useState<VenuePartner[]>([]);
    const [promoterConnections, setPromoterConnections] = useState<PromoterConnection[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);
    
    // Discover State
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
                c.type === "partnership"
            );
            setVenues(venueConns.map((c: any) => ({
                connectionId: c.id,
                id: c.otherId || c.venueId,
                name: c.otherName || c.venueName || "Venue",
                city: c.city || c.venueCity || c.otherCity || "",
                partnershipStatus: (c.status === "active" || c.status === "approved") ? "active" : (c.status === "pending") ? "pending" : "declined",
                createdAt: c.updatedAt || c.createdAt,
                initiatedBy: c.initiatedBy,
                photoURL: c.photoURL || c.otherAvatar || null,
                coverURL: c.coverURL || null,
            })));

            const promoterConns = allConns.filter((c: any) =>
                c.type === "promoter_connection"
            );
            setPromoterConnections(promoterConns.map((c: any) => ({
                connectionId: c.id,
                id: c.otherId || c.promoterId,
                name: c.otherName || c.promoterName || "Promoter",
                status: (c.status === "active" || c.status === "approved") ? "active" : (c.status === "pending") ? "pending" : "declined",
                initiatedBy: c.initiatedBy,
                createdAt: c.updatedAt || c.createdAt,
                photoURL: c.photoURL || c.otherAvatar || null,
            })));
        } catch (err) {
            console.error("Fetch network failed:", err);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [hostId, user]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleApprove = async (connectionId: string) => {
        setProcessingId(connectionId);
        try {
            const token = typeof getIdToken === "function" ? await getIdToken() : await user?.getIdToken();
            await fetch("/api/discovery", {
                method: "PATCH",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ connectionId, action: "approve" }),
            });
            await fetchData();
        } catch { /* */ } finally { setProcessingId(null); }
    };

    const handleReject = async (connectionId: string) => {
        setProcessingId(connectionId);
        try {
            const token = typeof getIdToken === "function" ? await getIdToken() : await user?.getIdToken();
            await fetch("/api/discovery", {
                method: "PATCH",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ connectionId, action: "reject" }),
            });
            await fetchData();
        } catch { /* */ } finally { setProcessingId(null); }
    };

    const handleAction = async (connectionId: string, action: "approve" | "reject" | "remove") => {
        setProcessingId(connectionId);
        try {
            const token = typeof getIdToken === "function" ? await getIdToken() : await user?.getIdToken();
            await fetch("/api/discovery", {
                method: "PATCH",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ connectionId, action }),
            });
            await fetchData();
        } catch { /* */ } finally { setProcessingId(null); }
    };

    const handleReRequest = async (targetId: string, targetType: string, targetName: string) => {
        setProcessingId(targetId);
        try {
            const token = typeof getIdToken === "function" ? await getIdToken() : await user?.getIdToken();
            await fetch("/api/discovery", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ requesterId: hostId, requesterType: "host", requesterName: profile?.displayName || "", targetId, targetType, targetName }),
            });
            await fetchData();
        } catch { /* */ } finally { setProcessingId(null); }
    };

    const activeVenues = venues.filter(v => v.partnershipStatus === "active");
    const activePromoters = promoterConnections.filter(p => p.status === "active");
    
    const pendingIncoming = [
        ...venues.filter(v => v.partnershipStatus === "pending" && v.initiatedBy === "venue").map(v => ({...v, type: "venue"})),
        ...promoterConnections.filter(p => p.status === "pending" && p.initiatedBy === "promoter").map(p => ({...p, type: "promoter"}))
    ];
    
    const pendingOutgoing = [
        ...venues.filter(v => v.partnershipStatus === "pending" && v.initiatedBy !== "venue").map(v => ({...v, type: "venue"})),
        ...promoterConnections.filter(p => p.status === "pending" && p.initiatedBy !== "promoter").map(p => ({...p, type: "promoter"}))
    ];
    
    const declined = [
        ...venues.filter(v => v.partnershipStatus === "declined").map(v => ({...v, type: "venue"})),
        ...promoterConnections.filter(p => p.status === "declined").map(p => ({...p, type: "promoter"}))
    ];

    const TABS: { id: Tab; label: string; count?: number }[] = [
        { id: "discover", label: "Discover" },
        { id: "active", label: "Active", count: activeVenues.length + activePromoters.length },
        { id: "incoming", label: "Incoming Requests", count: pendingIncoming.length },
        { id: "pending", label: "Sent Requests", count: pendingOutgoing.length },
        { id: "declined", label: "Declined", count: declined.length },
    ];

    return (
        <VenuePageShell
            title="Partners"
            subtitle="Venues and promoters connected to your host profile"
        >
            <div className="flex flex-col gap-5">
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
                            <p className="text-[11px] font-black uppercase tracking-widest text-white/40 mb-1">Partner Network</p>
                            <p className="text-[13px] font-medium text-white/70 max-w-lg">
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
                        <StatTrendCard label="Pending Incoming" value={pendingIncoming.length} color="#f59e0b" icon={<Bell className="w-4 h-4" />} />
                        <StatTrendCard label="Sent Requests" value={pendingOutgoing.length} color="#F44A22" icon={<Clock className="w-4 h-4" />} />
                    </div>
                </motion.div>

                {/* Tab bar + Toolbar */}
                <motion.div {...mp(0.1)} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center p-1.5 rounded-2xl shrink-0 bg-white/5 border border-white/10 no-scrollbar overflow-x-auto">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-black uppercase tracking-widest transition-all shrink-0"
                                style={activeTab === tab.id
                                    ? { background: "#27272a", color: "white" }
                                    : { color: "rgba(255,255,255,0.4)" }}
                            >
                                {tab.label}
                                {tab.count !== undefined && tab.count > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-orange-600 text-white">
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 flex-1 max-w-2xl">
                        <div className="flex items-center gap-2 flex-1 px-4 py-2 rounded-2xl bg-white/5 border border-white/10">
                            <Search className="w-3.5 h-3.5 text-white/30" />
                            <input
                                type="text"
                                value={discoverSearch}
                                onChange={e => setDiscoverSearch(e.target.value)}
                                placeholder="Search connections..."
                                className="flex-1 bg-transparent border-none outline-none text-[12px] font-medium placeholder:text-white/20 text-white"
                            />
                            {discoverSearch && <button onClick={() => setDiscoverSearch("")}><X className="w-3.5 h-3.5 text-white/30" /></button>}
                        </div>
                        
                        <div className="flex p-1 rounded-2xl bg-white/5 border border-white/10">
                            {["venue", "promoter"].map(t => (
                                <button key={t} onClick={() => setDiscoverType(t)}
                                    className="px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all"
                                    style={discoverType === t ? { background: "#27272a", color: "white" } : { color: "rgba(255,255,255,0.3)" }}>
                                    {t}s
                                </button>
                            ))}
                        </div>
                        
                        <button onClick={() => setDiscoverRefresh(n => n + 1)} className="p-2.5 rounded-2xl bg-white/5 border border-white/10 text-white/30 hover:text-white transition-colors">
                            <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </motion.div>

                {/* Content Area */}
                <div className="min-h-[400px]">
                    <AnimatePresence mode="wait">
                        {error ? (
                            <motion.div key="error" className="py-20 text-center border border-dashed border-white/10 rounded-[32px] bg-white/2 flex flex-col items-center gap-4">
                                <p className="text-white/40 text-[13px] font-medium">Failed to load partner connections.</p>
                                <button onClick={fetchData} className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-[11px] font-black uppercase tracking-widest text-white hover:bg-white/10">Retry Sync</button>
                            </motion.div>
                        ) : loading && activeTab !== "discover" ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {[1, 2, 3].map(i => <div key={i} className="h-48 rounded-[32px] bg-white/5 animate-pulse" />)}
                            </div>
                        ) : activeTab === "discover" ? (
                            <motion.div key="discover" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <DiscoverDirectory
                                    allowedTypes={["venue", "promoter"]}
                                    partnerId={hostId}
                                    role="host"
                                    searchQuery={discoverSearch}
                                    filterType={discoverType as any}
                                    filterCity={discoverCity}
                                    refreshTrigger={discoverRefresh}
                                />
                            </motion.div>
                        ) : (
                            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {(() => {
                                    const list = activeTab === "active" 
                                        ? [...activeVenues.map(v => ({...v, type: "venue"})), ...activePromoters.map(p => ({...p, type: "promoter"}))]
                                        : activeTab === "incoming" ? pendingIncoming
                                        : activeTab === "pending" ? pendingOutgoing
                                        : declined;
                                    
                                    const filtered = list.filter(p => 
                                        (!discoverSearch || p.name.toLowerCase().includes(discoverSearch.toLowerCase())) &&
                                        (p.type === discoverType)
                                    );

                                    if (filtered.length === 0) return (
                                        <div className="col-span-full py-20 text-center border border-dashed border-white/10 rounded-[32px] bg-white/2">
                                            <p className="text-white/20 text-[11px] font-black uppercase tracking-widest">No partners found</p>
                                        </div>
                                    );

                                    return filtered.map((p: any) => (
                                        <StatusCard
                                            key={p.connectionId || p.id}
                                            name={p.name}
                                            type={p.type}
                                            city={p.city}
                                            photoURL={p.photoURL}
                                            coverURL={p.coverURL}
                                            connectionStatus={activeTab === "active" ? "active" : activeTab === "incoming" ? "incoming" : activeTab === "pending" ? "pending" : "declined"}
                                            onApprove={() => handleAction(p.connectionId, "approve")}
                                            onReject={() => handleAction(p.connectionId, "reject")}
                                            onRemove={() => handleAction(p.connectionId, "remove")}
                                            onReRequest={() => handleReRequest(p.id, p.type, p.name)}
                                            isProcessing={processingId === p.connectionId || processingId === p.id}
                                            onViewProfile={() => router.push(`/host/partners/${p.id}`)}
                                        />
                                    ));
                                })()}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </VenuePageShell>
    );
}
