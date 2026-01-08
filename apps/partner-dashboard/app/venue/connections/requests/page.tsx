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
import { getFirebaseDb } from "@/lib/firebase/client";
import { collection, query, where, onSnapshot } from "firebase/firestore";
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

    // Real-time listener for promoter connection requests
    useEffect(() => {
        if (!venueId) return;
        setLoading(true);

        const db = getFirebaseDb();

        const connectionsQuery = query(
            collection(db, "promoter_connections"),
            where("targetId", "==", venueId),
            where("targetType", "==", "venue")
        );

        const unsubscribe = onSnapshot(connectionsQuery, (snapshot) => {
            const requests = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as PromoterRequest[];

            setPromoterRequests(requests);
            setLoading(false);
        }, (error) => {
            console.error("[Venue Connections] Firestore listener error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [venueId]);

    // Real-time listener for host connection requests (Partnerships)
    useEffect(() => {
        if (!venueId) return;

        const db = getFirebaseDb();
        const partnershipsQuery = query(
            collection(db, "partnerships"),
            where("venueId", "==", venueId)
        );

        const unsubscribe = onSnapshot(partnershipsQuery, (snapshot) => {
            const partnerships = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as HostPartnership[];

            setHostPartnerships(partnerships);
        }, (error) => {
            console.error("[Venue Connections] Host snapshot error:", error);
        });

        return () => unsubscribe();
    }, [venueId]);

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
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-12 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2 text-indigo-600">
                        <div className="p-2 bg-indigo-50 rounded-xl">
                            <Users className="w-5 h-5" />
                        </div>
                        <span className="text-[13px] font-bold uppercase tracking-[0.2em]">Network</span>
                    </div>
                    <h1 className="text-4xl font-semibold text-slate-900 tracking-tight">Connections</h1>
                    <p className="text-slate-500 text-lg font-medium mt-2 max-w-xl">
                        Manage your verified host partnerships and sales network.
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex items-center p-1.5 bg-slate-100/80 backdrop-blur-sm rounded-2xl w-fit">
                    <button
                        onClick={() => setActiveTab('promoters')}
                        className={`px-6 py-2.5 rounded-xl text-[13px] font-semibold transition-all flex items-center gap-2.5 ${activeTab === 'promoters' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Zap className={`w-4 h-4 ${activeTab === 'promoters' ? 'text-blue-500 fill-blue-500' : ''}`} />
                        Promoters
                        {pendingPromoterRequests.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 bg-blue-500 text-white rounded-md text-[10px] font-bold">
                                {pendingPromoterRequests.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('hosts')}
                        className={`px-6 py-2.5 rounded-xl text-[13px] font-semibold transition-all flex items-center gap-2.5 ${activeTab === 'hosts' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <UserCircle className={`w-4 h-4 ${activeTab === 'hosts' ? 'text-indigo-500' : ''}`} />
                        Hosts
                        {pendingHostRequests.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 bg-indigo-500 text-white rounded-md text-[10px] font-bold">
                                {pendingHostRequests.length}
                            </span>
                        )}
                    </button>
                    <div className="w-px h-4 bg-slate-200 mx-1" />
                    <button
                        onClick={() => setActiveTab('discover')}
                        className={`px-6 py-2.5 rounded-xl text-[13px] font-semibold transition-all flex items-center gap-2.5 ${activeTab === 'discover' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
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
                                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-slate-400" />
                                    {activeTab === 'promoters' ? 'Promoter Requests' : 'Host Requests'}
                                </h3>
                                <span className="text-[12px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
                                    {activeTab === 'promoters' ? pendingPromoterRequests.length : pendingHostRequests.length} Incoming
                                </span>
                            </div>

                            <AnimatePresence mode="popLayout">
                                {loading ? (
                                    <div className="p-20 flex justify-center"><Loader2 className="w-8 h-8 text-slate-200 animate-spin" /></div>
                                ) : (activeTab === 'promoters' ? pendingPromoterRequests : pendingHostRequests).length === 0 ? (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="py-16 bg-white/50 rounded-[2.5rem] border border-dashed border-slate-200 flex flex-col items-center text-center px-10"
                                    >
                                        <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                                            <Clock className="w-6 h-6 text-slate-200" />
                                        </div>
                                        <h4 className="text-lg font-semibold text-slate-900">Quiet for now</h4>
                                        <p className="text-slate-500 text-sm font-medium mt-1">Pending connection requests will appear here.</p>
                                    </motion.div>
                                ) : (activeTab === 'promoters' ? pendingPromoterRequests : pendingHostRequests).map((request: any) => (
                                    <motion.div
                                        key={request.id}
                                        layout
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="group bg-white border border-slate-200/60 rounded-[2rem] p-6 pr-4 hover:border-slate-300 hover:shadow-sm transition-all"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-start gap-4">
                                                <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center text-xl font-bold text-slate-400 shrink-0">
                                                    {(activeTab === 'promoters' ? (request.promoterName?.[0] || 'P') : (request.hostName?.[0] || 'H'))}
                                                </div>
                                                <div className="pt-0.5">
                                                    <h4 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                                        {activeTab === 'promoters' ? request.promoterName : request.hostName}
                                                    </h4>
                                                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                                        <span className="text-[12px] font-medium text-slate-400 flex items-center gap-1.5">
                                                            <Clock className="w-3.5 h-3.5" /> {formatDate(request.createdAt)}
                                                        </span>
                                                        {(activeTab === 'promoters' ? request.promoterEmail : request.hostEmail) && (
                                                            <span className="text-[12px] font-medium text-slate-400 flex items-center gap-1.5">
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
                                                    className="h-10 px-4 rounded-xl bg-slate-900 text-white text-[13px] font-bold hover:bg-black transition-all active:scale-95 disabled:opacity-50"
                                                >
                                                    {processingRequest === request.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Approve'}
                                                </button>
                                                <button
                                                    onClick={() => handleAction(request.id, 'reject', activeTab === 'promoters' ? 'promoter' : 'host')}
                                                    disabled={!!processingRequest}
                                                    className="h-10 w-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all active:scale-95 disabled:opacity-50"
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
                                                    className="h-10 w-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                                                    title="Block"
                                                >
                                                    <ShieldAlert className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                        {request.message && (
                                            <div className="mt-5 p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                                                <p className="text-[13px] text-slate-600 font-medium leading-relaxed italic">"{request.message}"</p>
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
                                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    {activeTab === 'promoters' ? 'Partnered Promoters' : 'Verified Hosts'}
                                </h3>
                                <span className="text-[12px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                                    {activeTab === 'promoters' ? approvedPromoterConnections.length : approvedHostPartnerships.length} Active
                                </span>
                            </div>

                            <div className="space-y-3">
                                {(activeTab === 'promoters' ? approvedPromoterConnections : approvedHostPartnerships).length === 0 ? (
                                    <div className="py-16 bg-slate-50/50 rounded-[2.5rem] border border-dashed border-slate-200 flex flex-col items-center text-center px-10">
                                        <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center mb-4 border border-slate-100">
                                            <CheckCircle2 className="w-6 h-6 text-slate-100" />
                                        </div>
                                        <h4 className="text-lg font-semibold text-slate-900">No active network</h4>
                                        <p className="text-slate-500 text-sm font-medium mt-1">Once approved, partners will appear here.</p>
                                    </div>
                                ) : (activeTab === 'promoters' ? approvedPromoterConnections : approvedHostPartnerships).map((conn: any) => (
                                    <motion.div
                                        key={conn.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="bg-white border border-slate-200/60 rounded-[2rem] p-5 flex items-center justify-between hover:border-slate-300 hover:shadow-sm transition-all group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-lg font-bold text-slate-300">
                                                {(activeTab === 'promoters' ? (conn.promoterName?.[0] || 'P') : (conn.hostName?.[0] || 'H'))}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                                    {activeTab === 'promoters' ? conn.promoterName : conn.hostName}
                                                </h4>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[11px] font-medium text-slate-400">Since {formatDate(conn.updatedAt || conn.createdAt)}</span>
                                                    <span className="h-1 w-1 rounded-full bg-emerald-400" />
                                                    <span className="text-[11px] font-bold text-emerald-500">Active</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button className="h-10 w-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-all active:scale-95">
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
