"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Users,
    Check,
    X,
    Search,
    UserCircle,
    Handshake,
    CheckCircle2,
    XCircle,
    Mail,
    Instagram,
    PhoneCall,
    Clock,
    Star,
    Building2,
    AlertCircle,
    MapPin,
    ChevronRight,
    Loader2
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { getFirebaseDb } from "@/lib/firebase/client";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";

interface PromoterRequest {
    id: string;
    promoterId: string;
    promoterName: string;
    promoterEmail: string;
    promoterInstagram?: string;
    promoterPhone?: string;
    promoterBio?: string;
    status: string;
    createdAt: any;
    message?: string;
}

interface HostPartnership {
    id: string;
    hostId: string;
    hostName: string;
    hostEmail?: string;
    status: string;
    createdAt: any;
}

export default function ClubConnectionsPage() {
    const { profile } = useDashboardAuth();
    const [hostPartnerships, setHostPartnerships] = useState<HostPartnership[]>([]);
    const [promoterRequests, setPromoterRequests] = useState<PromoterRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'hosts' | 'promoters' | 'discover'>('promoters');
    const [processingRequest, setProcessingRequest] = useState<string | null>(null);

    const clubId = profile?.activeMembership?.partnerId;
    const clubName = profile?.displayName;

    // Real-time listener for promoter connection requests
    useEffect(() => {
        if (!clubId) return;
        setLoading(true);

        const db = getFirebaseDb();

        // Listen to promoter_connections where this club is the target
        const connectionsQuery = query(
            collection(db, "promoter_connections"),
            where("targetId", "==", clubId),
            where("targetType", "==", "club")
        );

        const unsubscribe = onSnapshot(connectionsQuery, (snapshot) => {
            const requests = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as PromoterRequest[];

            console.log(`[Club Connections] Found ${requests.length} promoter requests`);
            setPromoterRequests(requests);
            setLoading(false);
        }, (error) => {
            console.error("[Club Connections] Firestore listener error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [clubId]);

    // Fetch host partnerships (from partnerships collection)
    useEffect(() => {
        if (!clubId) return;

        const fetchHostPartnerships = async () => {
            try {
                const res = await fetch(`/api/club/partnerships?clubId=${clubId}`);
                const data = await res.json();
                setHostPartnerships(data.partnerships || []);
            } catch (err) {
                console.error("Failed to fetch host partnerships:", err);
            }
        };

        fetchHostPartnerships();
    }, [clubId]);

    const handlePromoterAction = async (connectionId: string, action: 'approve' | 'reject') => {
        setProcessingRequest(connectionId);
        try {
            const db = getFirebaseDb();
            const now = new Date().toISOString();

            await updateDoc(doc(db, "promoter_connections", connectionId), {
                status: action === 'approve' ? 'approved' : 'rejected',
                updatedAt: now,
                resolvedAt: now,
                resolvedBy: { uid: clubId, name: clubName }
            });

            console.log(`[Club] ${action}d connection ${connectionId}`);
        } catch (err: any) {
            console.error(`Failed to ${action} request:`, err);
            alert(err.message || `Failed to ${action} request`);
        } finally {
            setProcessingRequest(null);
        }
    };

    const handleHostAction = async (partnershipId: string, action: 'approve' | 'reject') => {
        try {
            await fetch('/api/club/partnerships', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ partnershipId, action, clubId })
            });

            // Refresh host partnerships
            const res = await fetch(`/api/club/partnerships?clubId=${clubId}`);
            const data = await res.json();
            setHostPartnerships(data.partnerships || []);
        } catch (err) {
            console.error(err);
        }
    };

    const pendingPromoterRequests = promoterRequests.filter(r => r.status === 'pending');
    const approvedPromoterConnections = promoterRequests.filter(r => r.status === 'approved');
    const pendingHostRequests = hostPartnerships.filter(h => h.status === 'pending');
    const approvedHostPartnerships = hostPartnerships.filter(h => h.status === 'approved');

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
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Connections</h1>
                <p className="text-slate-500 text-sm mt-1">Manage host partnerships and promoter connections.</p>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('promoters')}
                    className={`px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'promoters' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <Handshake className="w-4 h-4" />
                    Promoters
                    {pendingPromoterRequests.length > 0 && (
                        <span className="px-1.5 py-0.5 bg-amber-500 text-white rounded-full text-[10px]">
                            {pendingPromoterRequests.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('hosts')}
                    className={`px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'hosts' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <UserCircle className="w-4 h-4" />
                    Hosts
                    {pendingHostRequests.length > 0 && (
                        <span className="px-1.5 py-0.5 bg-purple-500 text-white rounded-full text-[10px]">
                            {pendingHostRequests.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('discover')}
                    className={`px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'discover' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <Search className="w-4 h-4" />
                    Discover
                </button>
            </div>

            {/* Loading State */}
            {loading && activeTab !== 'discover' && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
                </div>
            )}

            {/* Hosts Tab */}
            {!loading && activeTab === 'hosts' && (
                <div className="space-y-6">
                    {/* Pending Host Requests */}
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-purple-500" />
                            Pending Host Partnerships ({pendingHostRequests.length})
                        </h3>

                        {pendingHostRequests.length === 0 ? (
                            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                                <UserCircle className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                <p className="text-slate-500 font-medium">No pending host requests</p>
                                <p className="text-xs text-slate-400 mt-2">When hosts request to partner with your venue, they'll appear here.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {pendingHostRequests.map(partner => (
                                    <div key={partner.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
                                                <UserCircle className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900">{partner.hostName}</h3>
                                                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" /> Host Partner Request
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => handleHostAction(partner.id, 'reject')}
                                                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50"
                                            >
                                                Decline
                                            </button>
                                            <button
                                                onClick={() => handleHostAction(partner.id, 'approve')}
                                                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 shadow-sm"
                                            >
                                                Approve
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Approved Host Partnerships */}
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            Partner Hosts ({approvedHostPartnerships.length})
                        </h3>

                        {approvedHostPartnerships.length === 0 ? (
                            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center">
                                <p className="text-slate-400 text-sm">No approved host partnerships yet.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {approvedHostPartnerships.map(partner => (
                                    <div key={partner.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-sm">
                                                {partner.hostName?.[0] || "H"}
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-slate-900 text-sm">{partner.hostName}</h4>
                                                <p className="text-[10px] text-slate-400">Host Partner</p>
                                            </div>
                                        </div>
                                        <span className="px-2 py-1 bg-purple-50 text-purple-600 rounded-full text-[10px] font-bold uppercase">
                                            Partner
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Promoters Tab */}
            {!loading && activeTab === 'promoters' && (
                <div className="space-y-6">
                    {/* Pending Promoter Requests */}
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-500" />
                            Pending Connection Requests ({pendingPromoterRequests.length})
                        </h3>

                        {pendingPromoterRequests.length === 0 ? (
                            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                                <Handshake className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                <p className="text-slate-500 font-medium">No pending promoter requests</p>
                                <p className="text-xs text-slate-400 mt-2">When promoters request to connect with your venue, they'll appear here.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {pendingPromoterRequests.map(request => (
                                    <div key={request.id} className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm hover:shadow-md transition-all">
                                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
                                            <div className="flex-1 space-y-6">
                                                <div className="flex items-start gap-4">
                                                    <div className="h-14 w-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black text-xl">
                                                        {request.promoterName?.[0] || "P"}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-lg font-bold text-slate-900">{request.promoterName || "Unknown Promoter"}</h4>
                                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                                                            <p className="text-xs font-bold text-slate-400 flex items-center gap-1 uppercase tracking-wider">
                                                                <Mail className="w-3 h-3" />
                                                                {request.promoterEmail || "No email"}
                                                            </p>
                                                            {request.promoterInstagram && (
                                                                <p className="text-xs font-bold text-pink-500 flex items-center gap-1 uppercase tracking-wider">
                                                                    <Instagram className="w-3 h-3" />
                                                                    {request.promoterInstagram.startsWith('@') ? request.promoterInstagram : `@${request.promoterInstagram}`}
                                                                </p>
                                                            )}
                                                            {request.promoterPhone && (
                                                                <p className="text-xs font-bold text-slate-400 flex items-center gap-1 uppercase tracking-wider">
                                                                    <PhoneCall className="w-3 h-3" />
                                                                    {request.promoterPhone}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest mt-2 flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            Requested {formatDate(request.createdAt)}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Bio & Message */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Promoter Biography</p>
                                                        <p className="text-xs font-bold text-slate-600 italic leading-relaxed">
                                                            "{request.promoterBio || "No biography provided."}"
                                                        </p>
                                                    </div>
                                                    {request.message && (
                                                        <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100/50">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-2">Personal Message</p>
                                                            <p className="text-xs font-bold text-amber-600 leading-relaxed">
                                                                "{request.message}"
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-3 min-w-[140px]">
                                                <button
                                                    onClick={() => handlePromoterAction(request.id, 'approve')}
                                                    disabled={processingRequest === request.id}
                                                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
                                                >
                                                    {processingRequest === request.id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                                    ) : (
                                                        "Confirm Partner"
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => handlePromoterAction(request.id, 'reject')}
                                                    disabled={processingRequest === request.id}
                                                    className="w-full py-4 bg-white border border-slate-200 text-slate-400 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all disabled:opacity-50"
                                                >
                                                    {processingRequest === request.id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                                    ) : (
                                                        "Decline"
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Approved Promoter Connections */}
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            Connected Promoters ({approvedPromoterConnections.length})
                        </h3>

                        {approvedPromoterConnections.length === 0 ? (
                            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center">
                                <p className="text-slate-400 text-sm">No connected promoters yet.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {approvedPromoterConnections.map(connection => (
                                    <div key={connection.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                                                {connection.promoterName?.[0] || "P"}
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-slate-900 text-sm">{connection.promoterName}</h4>
                                                <p className="text-[10px] text-slate-400">{connection.promoterEmail}</p>
                                            </div>
                                        </div>
                                        <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase">
                                            Active
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Discover Tab */}
            {activeTab === 'discover' && (
                <DiscoverView clubId={clubId} profile={profile} />
            )}
        </div>
    );
}

function DiscoverView({ clubId, profile }: { clubId: string | undefined, profile: any }) {
    const [partners, setPartners] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState<string>("all");
    const [sendingRequest, setSendingRequest] = useState<string | null>(null);

    const fetchPartners = useCallback(async () => {
        if (!clubId) return;
        setLoading(true);
        try {
            const params = new URLSearchParams({
                promoterId: clubId,
                action: "discover",
                limit: "30"
            });
            if (filterType !== "all") params.set("type", filterType);
            if (searchQuery) params.set("search", searchQuery);

            const res = await fetch(`/api/promoter/connections?${params}`);
            const data = await res.json();
            setPartners(data.partners || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [clubId, filterType, searchQuery]);

    useEffect(() => {
        fetchPartners();
    }, [fetchPartners]);

    const handleRequest = async (partner: any) => {
        if (!clubId) return;
        setSendingRequest(partner.id);
        try {
            await fetch('/api/promoter/connections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    promoterId: clubId,
                    promoterName: profile?.activeMembership?.partnerName || profile?.displayName,
                    targetId: partner.id,
                    targetType: partner.type,
                    targetName: partner.name
                })
            });
            fetchPartners();
        } catch (err) {
            console.error(err);
        } finally {
            setSendingRequest(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search for hosts or promoters..."
                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium"
                    />
                </div>
                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 focus:outline-none cursor-pointer"
                >
                    <option value="all">All Partners</option>
                    <option value="host">Hosts Only</option>
                    <option value="promoter">Promoters Only</option>
                    <option value="club">Clubs Only</option>
                </select>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => <div key={i} className="h-40 bg-slate-50 rounded-2xl animate-pulse" />)}
                </div>
            ) : partners.length === 0 ? (
                <div className="py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center">
                    <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">No partners found</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {partners.map(partner => (
                        <div key={partner.id} className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg transition-all flex flex-col">
                            <div className="flex items-start justify-between mb-4">
                                <div className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${partner.type === 'host' ? 'bg-purple-50 text-purple-600' : partner.type === 'club' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'
                                    }`}>
                                    {partner.type}
                                </div>
                                {partner.isVerified && <CheckCircle2 className="w-4 h-4 text-indigo-500" />}
                            </div>
                            <h4 className="font-bold text-slate-900 mb-1">{partner.name}</h4>
                            <p className="text-xs text-slate-500 line-clamp-2 mb-4">{partner.bio || "Verified partner in the Circle network."}</p>
                            <div className="mt-auto flex items-center justify-between pt-4 border-t border-slate-50">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> {partner.city}
                                </span>
                                {partner.connectionStatus === 'approved' ? (
                                    <span className="text-[10px] font-bold text-emerald-600 uppercase">Connected</span>
                                ) : partner.connectionStatus === 'pending' ? (
                                    <span className="text-[10px] font-bold text-amber-600 uppercase flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</span>
                                ) : (
                                    <button
                                        onClick={() => handleRequest(partner)}
                                        disabled={!!sendingRequest}
                                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase flex items-center gap-1 group"
                                    >
                                        Connect <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
