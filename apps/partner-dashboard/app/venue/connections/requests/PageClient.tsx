"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Users,
    Check,
    X,
    Search,
    UserCircle,
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
    Loader2,
    Zap,
    ShieldCheck,
    ShieldAlert
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

import { DiscoveryView } from "@/components/discovery/DiscoveryView";
import { motion, AnimatePresence } from "framer-motion";

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

export default function VenueConnectionsPage() {
    const { profile, user } = useDashboardAuth();
    const [hostPartnerships, setHostPartnerships] = useState<HostPartnership[]>([]);
    const [promoterRequests, setPromoterRequests] = useState<PromoterRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'hosts' | 'promoters' | 'discover'>('promoters');
    const [processingRequest, setProcessingRequest] = useState<string | null>(null);

    const venueId = profile?.activeMembership?.partnerId;
    const venueName = profile?.displayName;

    // Fetch connections from the internal API
    useEffect(() => {
        if (!venueId || !user) return;
        setLoading(true);

        const fetchConnections = async () => {
            try {
                const token = await user.getIdToken();
                const res = await fetch(`/api/discovery?action=list&partnerId=${venueId}&role=venue`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!res.ok) throw new Error("Failed to fetch connections");

                const data = await res.json();
                const allConnections = data.connections || [];

                // Map API normalized formats back to what the UI expects
                const promoters = allConnections
                    .filter((c: any) => c.type === "promoter_connection")
                    .map((c: any) => ({
                        id: c.id,
                        promoterId: c.otherId,
                        promoterName: c.otherName,
                        ...c,
                        status: c.status,
                        createdAt: c.createdAt
                    }));

                const hosts = allConnections
                    .filter((c: any) => c.type === "partnership")
                    .map((c: any) => ({
                        id: c.id,
                        hostId: c.otherId,
                        hostName: c.otherName,
                        ...c,
                        status: c.status,
                        createdAt: c.createdAt
                    }));

                setPromoterRequests(promoters);
                setHostPartnerships(hosts);
            } catch (error) {
                console.error("[Venue Connections] Fetch error:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchConnections();
    }, [venueId, user]);

    const handleAction = async (connectionId: string, action: 'approve' | 'reject' | 'block', type: 'host' | 'promoter') => {
        setProcessingRequest(connectionId);
        try {
            const token = await user?.getIdToken();
            const res = await fetch('/api/discovery', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    connectionId,
                    action,
                    role: 'venue',
                    partnerId: venueId,
                    partnerName: venueName
                })
            });

            if (!res.ok) throw new Error("Failed to process request");

        } catch (err: any) {
            console.error(`Failed to ${action} request:`, err);
            alert(err.message || `Failed to ${action} request`);
        } finally {
            setProcessingRequest(null);
        }
    };

    const pendingPromoterRequests = promoterRequests.filter(r => r.status === 'pending');
    const approvedPromoterConnections = promoterRequests.filter(r => r.status === 'approved' || r.status === 'active');
    const pendingHostRequests = hostPartnerships.filter(h => h.status === 'pending');
    const approvedHostPartnerships = hostPartnerships.filter(h => h.status === 'approved' || h.status === 'active');

    const formatDate = (timestamp: any) => {
        if (!timestamp) return "";
        const date = timestamp.toDate ? timestamp.toDate() : (timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp));
        return date.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    };

    return (
        <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2 text-c1rcle-orange">
                        <div className="p-2 bg-c1rcle-orange-glow rounded-xl">
                            <Users className="w-5 h-5" />
                        </div>
                        <span className="text-label">NETWORK</span>
                    </div>
                    <h1 className="text-display-sm text-text-primary">Connections</h1>
                    <p className="text-body text-text-tertiary mt-2 max-w-xl">
                        Manage your verified host partnerships and sales network.
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex items-center p-1.5 bg-surface-secondary backdrop-blur-sm rounded-2xl w-fit border border-border-subtle">
                    <button
                        onClick={() => setActiveTab('promoters')}
                        className={`px-6 py-2.5 rounded-xl text-[13px] font-semibold transition-all flex items-center gap-2.5 ${activeTab === 'promoters' ? 'bg-surface-elevated text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-secondary'
                            }`}
                    >
                        <Zap className={`w-4 h-4 ${activeTab === 'promoters' ? 'text-c1rcle-orange' : ''}`} />
                        Promoters
                        {pendingPromoterRequests.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 bg-c1rcle-orange text-text-primary rounded-md text-[10px] font-bold">
                                {pendingPromoterRequests.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('hosts')}
                        className={`px-6 py-2.5 rounded-xl text-[13px] font-semibold transition-all flex items-center gap-2.5 ${activeTab === 'hosts' ? 'bg-surface-elevated text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-secondary'
                            }`}
                    >
                        <UserCircle className={`w-4 h-4 ${activeTab === 'hosts' ? 'text-indigo-500' : ''}`} />
                        Hosts
                        {pendingHostRequests.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 bg-indigo-500 text-text-primary rounded-md text-[10px] font-bold">
                                {pendingHostRequests.length}
                            </span>
                        )}
                    </button>
                    <div className="w-px h-4 bg-border-subtle mx-1" />
                    <button
                        onClick={() => setActiveTab('discover')}
                        className={`px-6 py-2.5 rounded-xl text-[13px] font-semibold transition-all flex items-center gap-2.5 ${activeTab === 'discover' ? 'bg-surface-elevated text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-secondary'
                            }`}
                    >
                        <Search className="w-4 h-4" />
                        Discover
                    </button>
                </div>
            </div>

            {/* Content Container */}
            <div className="min-h-[600px]">
                {activeTab === 'discover' ? (
                    <DiscoveryView
                        allowedTypes={["host", "promoter"]}
                        partnerId={venueId}
                        role="venue"
                    />
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        {/* Requests Column */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-body-sm font-semibold text-text-primary flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-text-tertiary" />
                                    {activeTab === 'promoters' ? 'Promoter Requests' : 'Host Requests'}
                                </h3>
                                <span className="text-label text-text-tertiary bg-surface-secondary px-2 py-1 rounded-md">
                                    {activeTab === 'promoters' ? pendingPromoterRequests.length : pendingHostRequests.length} Incoming
                                </span>
                            </div>

                            <AnimatePresence mode="popLayout">
                                {loading ? (
                                    <div className="p-20 flex justify-center"><Loader2 className="w-8 h-8 text-text-placeholder animate-spin" /></div>
                                ) : (activeTab === 'promoters' ? pendingPromoterRequests : pendingHostRequests).length === 0 ? (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="py-16 card border-2 border-dashed border-border-default flex flex-col items-center text-center px-10"
                                    >
                                        <div className="w-14 h-14 rounded-2xl bg-c1rcle-orange-glow flex items-center justify-center mb-4">
                                            <Clock className="w-7 h-7 text-c1rcle-orange" />
                                        </div>
                                        <h4 className="text-title text-text-primary font-semibold">Quiet for now</h4>
                                        <p className="text-body-sm text-text-secondary mt-2">Pending connection requests will appear here.</p>
                                    </motion.div>
                                ) : (activeTab === 'promoters' ? pendingPromoterRequests : pendingHostRequests).map((request: any) => (
                                    <motion.div
                                        key={request.id}
                                        layout
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="group card p-6 pr-4 hover:shadow-md transition-all"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-start gap-4">
                                                <div className="h-14 w-14 rounded-2xl bg-surface-tertiary flex items-center justify-center text-xl font-bold text-text-tertiary shrink-0">
                                                    {(activeTab === 'promoters' ? (request.promoterName?.[0] || 'P') : (request.hostName?.[0] || 'H'))}
                                                </div>
                                                <div className="pt-0.5">
                                                    <h4 className="text-title text-text-primary group-hover:text-c1rcle-orange transition-colors">
                                                        {activeTab === 'promoters' ? request.promoterName : request.hostName}
                                                    </h4>
                                                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                                        <span className="text-caption text-text-tertiary flex items-center gap-1.5">
                                                            <Clock className="w-3.5 h-3.5" /> {formatDate(request.createdAt)}
                                                        </span>
                                                        {(activeTab === 'promoters' ? request.promoterEmail : request.hostEmail) && (
                                                            <span className="text-caption text-text-tertiary flex items-center gap-1.5">
                                                                <Mail className="w-3.5 h-3.5" /> {activeTab === 'promoters' ? request.promoterEmail : request.hostEmail}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex gap-2 p-1">
                                                <button
                                                    onClick={() => handleAction(request.id, 'approve', activeTab === 'promoters' ? 'promoter' : 'host')}
                                                    disabled={!!processingRequest}
                                                    className="btn btn-primary h-10 px-4"
                                                >
                                                    {processingRequest === request.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Approve'}
                                                </button>
                                                <button
                                                    onClick={() => handleAction(request.id, 'reject', activeTab === 'promoters' ? 'promoter' : 'host')}
                                                    disabled={!!processingRequest}
                                                    className="h-10 w-10 rounded-xl bg-surface-tertiary text-text-tertiary flex items-center justify-center hover:bg-red-500/10 hover:text-red-500 transition-all active:scale-95 disabled:opacity-50"
                                                    title="Reject"
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const reason = window.prompt("Reason for blocking (optional):");
                                                        if (reason !== null) handleAction(request.id, 'block', activeTab === 'promoters' ? 'promoter' : 'host');
                                                    }}
                                                    disabled={!!processingRequest}
                                                    className="h-10 w-10 rounded-xl bg-surface-tertiary text-text-tertiary flex items-center justify-center hover:bg-text-primary hover:text-text-inverse transition-all active:scale-95 disabled:opacity-50"
                                                    title="Block"
                                                >
                                                    <ShieldAlert className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                        {request.message && (
                                            <div className="mt-5 p-4 bg-surface-secondary rounded-2xl border border-border-subtle">
                                                <p className="text-body-sm text-text-secondary italic">"{request.message}"</p>
                                            </div>
                                        )}
                                    </motion.div>
                                ))
                                }
                            </AnimatePresence>
                        </div>

                        {/* Approved Column */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-body-sm font-semibold text-text-primary flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-c1rcle-orange" />
                                    {activeTab === 'promoters' ? 'Partnered Promoters' : 'Verified Hosts'}
                                </h3>
                                <span className="text-label text-c1rcle-orange bg-green-500/10 px-2 py-1 rounded-md">
                                    {activeTab === 'promoters' ? approvedPromoterConnections.length : approvedHostPartnerships.length} Active
                                </span>
                            </div>

                            <div className="space-y-3">
                                {(activeTab === 'promoters' ? approvedPromoterConnections : approvedHostPartnerships).length === 0 ? (
                                    <div className="py-16 card border-2 border-dashed border-border-default flex flex-col items-center text-center px-10">
                                        <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mb-4">
                                            <CheckCircle2 className="w-7 h-7 text-c1rcle-orange" />
                                        </div>
                                        <h4 className="text-title text-text-primary font-semibold">No active network</h4>
                                        <p className="text-body-sm text-text-secondary mt-2">Once approved, partners will appear here.</p>
                                    </div>
                                ) : (activeTab === 'promoters' ? approvedPromoterConnections : approvedHostPartnerships).map((conn: any) => (
                                    <motion.div
                                        key={conn.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="card p-5 flex items-center justify-between hover:shadow-md transition-all group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-2xl bg-surface-tertiary flex items-center justify-center text-lg font-bold text-text-tertiary">
                                                {(activeTab === 'promoters' ? (conn.promoterName?.[0] || 'P') : (conn.hostName?.[0] || 'H'))}
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-text-primary group-hover:text-c1rcle-orange transition-colors">
                                                    {activeTab === 'promoters' ? conn.promoterName : conn.hostName}
                                                </h4>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-caption text-text-tertiary">Since {formatDate(conn.updatedAt || conn.createdAt)}</span>
                                                    <span className="h-1 w-1 rounded-full bg-green-500" />
                                                    <span className="text-caption font-semibold text-c1rcle-orange">Active</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button className="h-10 w-10 bg-surface-tertiary rounded-xl flex items-center justify-center text-text-tertiary hover:bg-surface-elevated hover:text-text-primary transition-all active:scale-95">
                                            <ChevronRight className="w-5 h-5" />
                                        </button>
                                    </motion.div>
                                ))
                                }
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
