"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search,
    Users,
    Building2,
    UserCircle,
    CheckCircle2,
    Clock,
    XCircle,
    Link2,
    MapPin,
    Star,
    CalendarDays,
    ChevronRight,
    Send,
    X,
    Loader2,
    Handshake,
    RefreshCw,
    Info,
    Sparkles
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { getFirebaseDb } from "@/lib/firebase/client";
import { doc, setDoc } from "firebase/firestore";

type ConnectionStatus = "pending" | "approved" | "rejected" | "revoked" | null;
type PartnerType = "host" | "club" | "promoter" | "all";
type TabType = "discover" | "pending" | "connected" | "rejected";

interface Partner {
    id: string;
    type: "host" | "club" | "promoter";
    name: string;
    avatar: string | null;
    coverImage: string | null;
    city: string;
    bio: string;
    tags: string[];
    eventsCount: number;
    followersCount: number;
    isVerified: boolean;
    connectionStatus: ConnectionStatus;
    connectionId: string | null;
}

interface Connection {
    id: string;
    promoterId: string;
    promoterName: string;
    targetId: string;
    targetType: "host" | "club" | "promoter";
    targetName: string;
    status: string;
    createdAt: any;
    updatedAt: any;
    rejectionReason?: string;
}

export default function PromoterConnectionsPage() {
    const { profile } = useDashboardAuth();
    const [activeTab, setActiveTab] = useState<TabType>("discover");
    const [partners, setPartners] = useState<Partner[]>([]);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState<PartnerType>("all");
    const [filterCity, setFilterCity] = useState("");
    const [sendingRequest, setSendingRequest] = useState<string | null>(null);
    const [cancellingRequest, setCancellingRequest] = useState<string | null>(null);
    const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);

    const promoterId = profile?.activeMembership?.partnerId;
    const promoterName = profile?.displayName;
    const promoterEmail = profile?.email;

    const fetchPartners = useCallback(async () => {
        if (!promoterId) return;
        setLoading(true);
        try {
            const params = new URLSearchParams({
                promoterId,
                action: "discover",
                limit: "30"
            });
            if (filterType !== "all") params.set("type", filterType);
            if (filterCity) params.set("city", filterCity);
            if (searchQuery) params.set("search", searchQuery);

            const res = await fetch(`/api/promoter/connections?${params}`);
            const data = await res.json();
            setPartners(data.partners || []);
        } catch (err) {
            console.error("Failed to fetch partners:", err);
        } finally {
            setLoading(false);
        }
    }, [promoterId, filterType, filterCity, searchQuery]);

    const fetchConnections = useCallback(async () => {
        if (!promoterId) return;
        try {
            const res = await fetch(`/api/promoter/connections?promoterId=${promoterId}&action=list`);
            const data = await res.json();
            setConnections(data.connections || []);
        } catch (err) {
            console.error("Failed to fetch connections:", err);
        }
    }, [promoterId]);

    const fetchStats = useCallback(async () => {
        if (!promoterId) return;
        try {
            const res = await fetch(`/api/promoter/connections?promoterId=${promoterId}&action=stats`);
            const data = await res.json();
            setStats(data.stats || { pending: 0, approved: 0, rejected: 0 });
        } catch (err) {
            console.error("Failed to fetch stats:", err);
        }
    }, [promoterId]);

    useEffect(() => {
        if (promoterId) {
            fetchPartners();
            fetchConnections();
            fetchStats();
        }
    }, [promoterId, fetchPartners, fetchConnections, fetchStats]);

    useEffect(() => {
        if (activeTab === "discover" && promoterId) {
            fetchPartners();
        }
    }, [activeTab, filterType, filterCity, searchQuery, promoterId, fetchPartners]);

    const sendRequest = async (partner: Partner) => {
        if (!promoterId) return;
        setSendingRequest(partner.id);
        try {
            // Generate unique connection ID
            const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            const now = new Date().toISOString();

            // Create connection document directly in Firestore with client auth
            const connectionData = {
                id: connectionId,
                promoterId,
                promoterName: promoterName || "Promoter",
                promoterEmail: promoterEmail || "",
                promoterInstagram: profile?.instagram || "",
                promoterPhone: profile?.phone || "",
                promoterBio: profile?.bio || "",
                targetId: partner.id,
                targetType: partner.type,
                targetName: partner.name,
                message: "",
                status: "pending",
                createdAt: now,
                updatedAt: now,
                resolvedAt: null,
                resolvedBy: null
            };

            const db = getFirebaseDb();
            await setDoc(doc(db, "promoter_connections", connectionId), connectionData);

            // Refresh data
            fetchPartners();
            fetchConnections();
            fetchStats();
            setSelectedPartner(partner);
            setShowSuccessModal(true);
        } catch (err: any) {
            console.error("Failed to send request:", err);
            alert(err.message || "Failed to send partnership request");
        } finally {
            setSendingRequest(null);
        }
    };

    const cancelRequest = async (connectionId: string) => {
        if (!promoterId) return;
        setCancellingRequest(connectionId);
        try {
            const db = getFirebaseDb();
            await setDoc(doc(db, "promoter_connections", connectionId), {
                status: "cancelled",
                updatedAt: new Date().toISOString()
            }, { merge: true });

            fetchPartners();
            fetchConnections();
            fetchStats();
        } catch (err: any) {
            console.error("Failed to cancel request:", err);
            alert(err.message || "Failed to cancel request");
        } finally {
            setCancellingRequest(null);
        }
    };

    const disconnect = async (connectionId: string) => {
        if (!promoterId) return;
        if (!confirm("Are you sure you want to disconnect? You may need to wait before reconnecting.")) return;

        try {
            const db = getFirebaseDb();
            await setDoc(doc(db, "promoter_connections", connectionId), {
                status: "revoked",
                updatedAt: new Date().toISOString(),
                revokedAt: new Date().toISOString(),
                revokedBy: promoterId
            }, { merge: true });

            fetchPartners();
            fetchConnections();
            fetchStats();
        } catch (err: any) {
            console.error("Failed to disconnect:", err);
            alert(err.message || "Failed to disconnect");
        }
    };

    const filteredConnections = connections.filter(c => {
        if (activeTab === "pending") return c.status === "pending";
        if (activeTab === "connected") return c.status === "approved";
        if (activeTab === "rejected") return c.status === "rejected";
        return true;
    });

    const formatDate = (timestamp: any) => {
        if (!timestamp) return "";
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    };

    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-headline flex items-center gap-3">
                        <Handshake className="w-8 h-8 text-[#007aff]" />
                        Connections
                    </h1>
                    <p className="text-body-sm text-[#86868b] mt-1">
                        Partner with hosts and clubs to unlock commission-enabled events
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-4 py-2 bg-[#f5f5f7] rounded-xl">
                        <Clock className="w-4 h-4 text-amber-500" />
                        <span className="text-[13px] font-medium text-[#1d1d1f]">{stats.pending} Pending</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-[#34c759]/10 rounded-xl">
                        <CheckCircle2 className="w-4 h-4 text-[#34c759]" />
                        <span className="text-[13px] font-medium text-[#34c759]">{stats.approved} Connected</span>
                    </div>
                </div>
            </div>

            {/* Info Banner */}
            <div className="p-4 bg-gradient-to-r from-[#007aff]/5 to-[#5856d6]/5 rounded-2xl border border-[#007aff]/10 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-[#007aff] flex-shrink-0 mt-0.5" />
                <p className="text-[13px] text-[#1d1d1f] leading-relaxed">
                    <strong>How it works:</strong> Once a host or club approves your request, their events with promoter commissions enabled will automatically appear in your Events tab. You can then generate tracking links and start earning!
                </p>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 p-1 bg-[#f5f5f7] rounded-xl w-fit">
                {[
                    { id: "discover", label: "Discover", icon: Search },
                    { id: "pending", label: "Pending", count: stats.pending, icon: Clock },
                    { id: "connected", label: "Connected", count: stats.approved, icon: CheckCircle2 },
                    { id: "rejected", label: "Rejected", count: stats.rejected, icon: XCircle }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all ${activeTab === tab.id
                            ? "bg-white text-[#1d1d1f] shadow-sm"
                            : "text-[#86868b] hover:text-[#1d1d1f]"
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                        {tab.count !== undefined && tab.count > 0 && (
                            <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${activeTab === tab.id ? "bg-[#007aff] text-white" : "bg-[#e5e5ea] text-[#86868b]"
                                }`}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Discover Tab */}
            {activeTab === "discover" && (
                <div className="space-y-6">
                    {/* Search & Filters */}
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search hosts or clubs..."
                                className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#f5f5f7] border border-transparent text-[15px] focus:outline-none focus:border-[#007aff] focus:bg-white transition-all"
                            />
                        </div>
                        <div className="flex gap-3">
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value as PartnerType)}
                                className="px-4 py-3 rounded-xl bg-[#f5f5f7] border border-transparent text-[15px] focus:outline-none focus:border-[#007aff] focus:bg-white transition-all appearance-none cursor-pointer"
                            >
                                <option value="all">All Types</option>
                                <option value="host">Hosts Only</option>
                                <option value="club">Clubs Only</option>
                                <option value="promoter">Promoters Only</option>
                            </select>
                            <select
                                value={filterCity}
                                onChange={(e) => setFilterCity(e.target.value)}
                                className="px-4 py-3 rounded-xl bg-[#f5f5f7] border border-transparent text-[15px] focus:outline-none focus:border-[#007aff] focus:bg-white transition-all appearance-none cursor-pointer"
                            >
                                <option value="">All Cities</option>
                                <option value="Pune">Pune</option>
                                <option value="Mumbai">Mumbai</option>
                                <option value="Goa">Goa</option>
                                <option value="Bengaluru">Bengaluru</option>
                            </select>
                            <button
                                onClick={() => fetchPartners()}
                                className="p-3 rounded-xl bg-[#f5f5f7] hover:bg-[#e5e5ea] transition-colors"
                            >
                                <RefreshCw className="w-5 h-5 text-[#86868b]" />
                            </button>
                        </div>
                    </div>

                    {/* Partners Grid */}
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="card animate-pulse">
                                    <div className="h-32 bg-[#f5f5f7]" />
                                    <div className="p-4 space-y-3">
                                        <div className="h-5 w-2/3 bg-[#f5f5f7] rounded" />
                                        <div className="h-4 w-1/2 bg-[#f5f5f7] rounded" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : partners.length === 0 ? (
                        <div className="card p-12 text-center">
                            <div className="w-16 h-16 rounded-full bg-[#f5f5f7] flex items-center justify-center mx-auto mb-4">
                                <Users className="w-8 h-8 text-[#86868b]" />
                            </div>
                            <h3 className="text-headline-sm mb-2">No Partners Found</h3>
                            <p className="text-body-sm text-[#86868b]">
                                Try adjusting your search or filters to find hosts and clubs.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <AnimatePresence>
                                {partners.map(partner => (
                                    <motion.div
                                        key={partner.id}
                                        layout
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        className="card overflow-hidden group"
                                    >
                                        {/* Cover Image */}
                                        <div className="h-24 bg-gradient-to-br from-[#007aff] to-[#5856d6] relative">
                                            {partner.coverImage && (
                                                <img
                                                    src={partner.coverImage}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                            )}
                                            {/* Type Badge */}
                                            <div className={`absolute top-3 right-3 px-2 py-1 rounded-full text-[11px] font-bold uppercase ${partner.type === "host"
                                                ? "bg-purple-500 text-white"
                                                : partner.type === "club"
                                                    ? "bg-indigo-500 text-white"
                                                    : "bg-emerald-500 text-white"
                                                }`}>
                                                {partner.type === "host" ? (
                                                    <span className="flex items-center gap-1">
                                                        <UserCircle className="w-3 h-3" /> Host
                                                    </span>
                                                ) : partner.type === "club" ? (
                                                    <span className="flex items-center gap-1">
                                                        <Building2 className="w-3 h-3" /> Club
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1">
                                                        <Users className="w-3 h-3" /> Promoter
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="p-4 -mt-8 relative">
                                            {/* Avatar */}
                                            <div className="w-16 h-16 rounded-2xl bg-white border-4 border-white shadow-lg overflow-hidden mb-3">
                                                {partner.avatar ? (
                                                    <img
                                                        src={partner.avatar}
                                                        alt={partner.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full bg-[#f5f5f7] flex items-center justify-center">
                                                        {partner.type === "host" ? (
                                                            <UserCircle className="w-8 h-8 text-[#86868b]" />
                                                        ) : partner.type === "club" ? (
                                                            <Building2 className="w-8 h-8 text-[#86868b]" />
                                                        ) : (
                                                            <Users className="w-8 h-8 text-[#86868b]" />
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <h3 className="text-[17px] font-semibold text-[#1d1d1f] flex items-center gap-2">
                                                {partner.name}
                                                {partner.isVerified && (
                                                    <CheckCircle2 className="w-4 h-4 text-[#007aff]" />
                                                )}
                                            </h3>

                                            {partner.city && (
                                                <div className="flex items-center gap-1 text-[13px] text-[#86868b] mt-1">
                                                    <MapPin className="w-3 h-3" />
                                                    {partner.city}
                                                </div>
                                            )}

                                            {partner.bio && (
                                                <p className="text-[13px] text-[#6e6e73] mt-2 line-clamp-2">
                                                    {partner.bio}
                                                </p>
                                            )}

                                            {/* Stats */}
                                            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[rgba(0,0,0,0.06)]">
                                                <div className="flex items-center gap-1 text-[12px] text-[#86868b]">
                                                    <CalendarDays className="w-3.5 h-3.5" />
                                                    {partner.eventsCount} events
                                                </div>
                                                <div className="flex items-center gap-1 text-[12px] text-[#86868b]">
                                                    <Star className="w-3.5 h-3.5" />
                                                    {partner.followersCount} followers
                                                </div>
                                            </div>

                                            {/* Action Button */}
                                            <div className="mt-4">
                                                {partner.connectionStatus === "approved" ? (
                                                    <div className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#34c759]/10 text-[#34c759] rounded-xl text-[13px] font-semibold">
                                                        <CheckCircle2 className="w-4 h-4" />
                                                        Connected
                                                    </div>
                                                ) : partner.connectionStatus === "pending" ? (
                                                    <div className="flex items-center justify-center gap-2 w-full py-2.5 bg-amber-100 text-amber-700 rounded-xl text-[13px] font-semibold">
                                                        <Clock className="w-4 h-4" />
                                                        Request Pending
                                                    </div>
                                                ) : partner.connectionStatus === "rejected" ? (
                                                    <button
                                                        disabled
                                                        className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#f5f5f7] text-[#86868b] rounded-xl text-[13px] font-semibold cursor-not-allowed"
                                                    >
                                                        <XCircle className="w-4 h-4" />
                                                        Previously Declined
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => sendRequest(partner)}
                                                        disabled={sendingRequest === partner.id}
                                                        className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#007aff] text-white rounded-xl text-[13px] font-semibold hover:bg-[#0066cc] transition-colors disabled:opacity-50"
                                                    >
                                                        {sendingRequest === partner.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Send className="w-4 h-4" />
                                                        )}
                                                        Request Partnership
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            )}

            {/* My Connections Tab (Pending/Connected/Rejected) */}
            {activeTab !== "discover" && (
                <div className="space-y-4">
                    {filteredConnections.length === 0 ? (
                        <div className="card p-12 text-center">
                            <div className="w-16 h-16 rounded-full bg-[#f5f5f7] flex items-center justify-center mx-auto mb-4">
                                {activeTab === "pending" && <Clock className="w-8 h-8 text-amber-500" />}
                                {activeTab === "connected" && <Link2 className="w-8 h-8 text-[#34c759]" />}
                                {activeTab === "rejected" && <XCircle className="w-8 h-8 text-red-400" />}
                            </div>
                            <h3 className="text-headline-sm mb-2">
                                {activeTab === "pending" && "No Pending Requests"}
                                {activeTab === "connected" && "No Active Connections"}
                                {activeTab === "rejected" && "No Rejected Requests"}
                            </h3>
                            <p className="text-body-sm text-[#86868b]">
                                {activeTab === "pending" && "Your partnership requests will appear here while waiting for approval."}
                                {activeTab === "connected" && "Discover hosts and clubs to start building your network."}
                                {activeTab === "rejected" && "Previously declined requests will appear here."}
                            </p>
                            {activeTab !== "rejected" && (
                                <button
                                    onClick={() => setActiveTab("discover")}
                                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#007aff] text-white rounded-xl text-[13px] font-semibold hover:bg-[#0066cc] transition-colors"
                                >
                                    <Search className="w-4 h-4" />
                                    Discover Partners
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <AnimatePresence>
                                {filteredConnections.map(connection => (
                                    <motion.div
                                        key={connection.id}
                                        layout
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="card p-4 flex items-center justify-between gap-4"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${connection.targetType === "host"
                                                ? "bg-purple-100 text-purple-600"
                                                : connection.targetType === "club"
                                                    ? "bg-indigo-100 text-indigo-600"
                                                    : "bg-emerald-100 text-emerald-600"
                                                }`}>
                                                {connection.targetType === "host" ? (
                                                    <UserCircle className="w-6 h-6" />
                                                ) : connection.targetType === "club" ? (
                                                    <Building2 className="w-6 h-6" />
                                                ) : (
                                                    <Users className="w-6 h-6" />
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="text-[15px] font-semibold text-[#1d1d1f]">
                                                    {connection.targetName || "Unknown Partner"}
                                                </h4>
                                                <div className="flex items-center gap-2 text-[12px] text-[#86868b]">
                                                    <span className="capitalize">{connection.targetType}</span>
                                                    <span>•</span>
                                                    <span>Requested {formatDate(connection.createdAt)}</span>
                                                </div>
                                                {connection.status === "rejected" && connection.rejectionReason && (
                                                    <p className="text-[12px] text-red-500 mt-1">
                                                        Reason: {connection.rejectionReason}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {/* Status Badge */}
                                            <div className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase ${connection.status === "pending"
                                                ? "bg-amber-100 text-amber-700"
                                                : connection.status === "approved"
                                                    ? "bg-[#34c759]/10 text-[#34c759]"
                                                    : "bg-red-100 text-red-600"
                                                }`}>
                                                {connection.status}
                                            </div>

                                            {/* Actions */}
                                            {connection.status === "pending" && (
                                                <button
                                                    onClick={() => cancelRequest(connection.id)}
                                                    disabled={cancellingRequest === connection.id}
                                                    className="px-3 py-1.5 border border-[#e5e5ea] text-[#86868b] rounded-lg text-[12px] font-semibold hover:bg-[#f5f5f7] transition-colors disabled:opacity-50"
                                                >
                                                    {cancellingRequest === connection.id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        "Cancel"
                                                    )}
                                                </button>
                                            )}

                                            {connection.status === "approved" && (
                                                <button
                                                    onClick={() => disconnect(connection.id)}
                                                    className="px-3 py-1.5 border border-red-200 text-red-500 rounded-lg text-[12px] font-semibold hover:bg-red-50 transition-colors"
                                                >
                                                    Disconnect
                                                </button>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            )}
            {/* Success Modal */}
            <AnimatePresence>
                {showSuccessModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
                        >
                            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                <Send className="w-10 h-10" />
                            </div>
                            <h2 className="text-2xl font-bold text-[#1d1d1f] mb-3">Request Sent!</h2>
                            <p className="text-[#86868b] text-sm leading-relaxed mb-8">
                                Your partnership request for <strong>{selectedPartner?.name}</strong> has been transmitted. Your professional profile has been shared with them.
                            </p>
                            <button
                                onClick={() => setShowSuccessModal(false)}
                                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg"
                            >
                                Nice!
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
