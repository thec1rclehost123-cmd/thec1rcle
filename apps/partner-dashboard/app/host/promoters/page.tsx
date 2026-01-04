"use client";

import { useState, useEffect, useCallback } from "react";
import { useDashboardAuth } from "../../../components/providers/DashboardAuthProvider";
import {
    Users,
    UserPlus,
    Mail,
    Copy,
    Check,
    X,
    Search,
    TrendingUp,
    Ticket,
    MoreHorizontal,
    Star,
    ArrowRight,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2,
    Handshake,
    Instagram,
    PhoneCall
} from "lucide-react";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";

interface ConnectionRequest {
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

export default function PromotersPage() {
    const { profile } = useDashboardAuth();
    const [promoters, setPromoters] = useState<any[]>([]);
    const [connectionRequests, setConnectionRequests] = useState<ConnectionRequest[]>([]);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteData, setInviteData] = useState({ email: "", name: "" });
    const [loading, setLoading] = useState(false);
    const [inviteLink, setInviteLink] = useState("");
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<"network" | "requests">("network");
    const [processingRequest, setProcessingRequest] = useState<string | null>(null);

    const hostId = profile?.activeMembership?.partnerId;
    const hostName = profile?.displayName;

    // Fetch promoters from Firestore
    useEffect(() => {
        if (!hostId) return;
        const db = getFirebaseDb();
        const q = query(
            collection(db, "promoters"),
            where("associatedHostId", "==", hostId)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setPromoters(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [hostId]);

    // Real-time listener for connection requests from promoters
    useEffect(() => {
        if (!hostId) return;

        const db = getFirebaseDb();
        const q = query(
            collection(db, "promoter_connections"),
            where("targetId", "==", hostId),
            where("targetType", "==", "host")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const requests = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ConnectionRequest[];

            console.log(`[Host Promoters] Found ${requests.length} connection requests`);
            setConnectionRequests(requests);
        }, (error) => {
            console.error("[Host Promoters] Firestore listener error:", error);
        });

        return () => unsubscribe();
    }, [hostId]);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await fetch("/api/host/invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    hostId: profile?.activeMembership?.partnerId,
                    promoterEmail: inviteData.email,
                    promoterName: inviteData.name
                })
            });
            const data = await response.json();
            if (data.success) {
                setInviteLink(data.inviteLink);
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(inviteLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleConnectionAction = async (connectionId: string, action: "approve" | "reject") => {
        setProcessingRequest(connectionId);
        try {
            const db = getFirebaseDb();
            const now = new Date().toISOString();

            await updateDoc(doc(db, "promoter_connections", connectionId), {
                status: action === "approve" ? "approved" : "rejected",
                updatedAt: now,
                resolvedAt: now,
                resolvedBy: { uid: hostId, name: hostName }
            });

            console.log(`[Host] ${action}d connection ${connectionId}`);
            // Real-time listener will automatically update the list
        } catch (err: any) {
            console.error(`Failed to ${action} request:`, err);
            alert(err.message || `Failed to ${action} request`);
        } finally {
            setProcessingRequest(null);
        }
    };

    const pendingRequests = connectionRequests.filter(r => r.status === "pending");
    const approvedConnections = connectionRequests.filter(r => r.status === "approved");

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
        <div className="space-y-10">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight transition-all">Promoter Network</h1>
                    <p className="text-slate-500 font-medium mt-1">Manage and track your promoter team performance.</p>
                </div>
                <button
                    onClick={() => {
                        setShowInviteModal(true);
                        setInviteLink("");
                        setInviteData({ email: "", name: "" });
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                    <UserPlus className="h-5 w-5" />
                    Invite Promoter
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-6">
                    <div className="h-14 w-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Users className="h-7 w-7" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Network</p>
                        <p className="text-2xl font-black text-slate-900">{promoters.length}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-6">
                    <div className="h-14 w-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                        <Clock className="h-7 w-7" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pending Requests</p>
                        <p className="text-2xl font-black text-slate-900">{pendingRequests.length}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-6">
                    <div className="h-14 w-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Handshake className="h-7 w-7" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Connected</p>
                        <p className="text-2xl font-black text-slate-900">{approvedConnections.length}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-6">
                    <div className="h-14 w-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <TrendingUp className="h-7 w-7" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Sales</p>
                        <p className="text-2xl font-black text-slate-900">₹0</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab("network")}
                    className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === "network"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                        }`}
                >
                    My Network ({promoters.length})
                </button>
                <button
                    onClick={() => setActiveTab("requests")}
                    className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === "requests"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                        }`}
                >
                    Requests
                    {pendingRequests.length > 0 && (
                        <span className="px-1.5 py-0.5 bg-amber-500 text-white rounded-full text-[10px]">
                            {pendingRequests.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Network Tab */}
            {activeTab === "network" && (
                <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden">
                    <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="relative w-72">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Find promoter..."
                                className="w-full bg-white border border-slate-200 rounded-xl pl-12 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-50">
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Promoter</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Performance</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {promoters.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-8 py-20 text-center">
                                            <div className="max-w-xs mx-auto">
                                                <Users className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                                                <p className="text-slate-500 font-bold">No promoters found in your network.</p>
                                                <p className="text-xs text-slate-400 mt-2">Invite your team to start tracking sales and performance.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    promoters.map(promoter => (
                                        <tr key={promoter.id} className="hover:bg-slate-50 group transition-all">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-12 w-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-500 group-hover:bg-white group-hover:text-indigo-600 transition-all">
                                                        {promoter.name?.[0] || 'P'}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900">{promoter.name}</p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                            <Mail className="h-3 w-3" />
                                                            {promoter.email}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-2 w-24 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className="h-full bg-indigo-600 rounded-full" style={{ width: '0%' }}></div>
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-400">0% Grade</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[9px] font-black uppercase tracking-widest">
                                                    Active
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <button className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
                                                    <MoreHorizontal className="h-5 w-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Requests Tab */}
            {activeTab === "requests" && (
                <div className="space-y-6">
                    {/* Pending Requests */}
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-500" />
                            Pending Connection Requests ({pendingRequests.length})
                        </h3>

                        {pendingRequests.length === 0 ? (
                            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
                                <Handshake className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                <p className="text-slate-500 font-bold">No pending requests</p>
                                <p className="text-xs text-slate-400 mt-2">When promoters request to connect with you, they'll appear here.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {pendingRequests.map(request => (
                                    <div key={request.id} className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm hover:shadow-md transition-all">
                                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
                                            <div className="flex-1 space-y-6">
                                                <div className="flex items-start gap-4">
                                                    <div className="h-16 w-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-2xl">
                                                        {request.promoterName?.[0] || "P"}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-xl font-bold text-slate-900">{request.promoterName || "Unknown Promoter"}</h4>
                                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                                                            <p className="text-xs font-bold text-slate-400 flex items-center gap-1 uppercase tracking-wider">
                                                                <Mail className="w-3 h-3" />
                                                                {request.promoterEmail}
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
                                                            Submitted {formatDate(request.createdAt)}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Bio & Message */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Promoter Biography</p>
                                                        <p className="text-xs font-bold text-slate-600 italic leading-relaxed">
                                                            "{request.promoterBio || "No biography provided by the promoter."}"
                                                        </p>
                                                    </div>
                                                    {request.message && (
                                                        <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-2">Personal Message</p>
                                                            <p className="text-xs font-bold text-indigo-600 leading-relaxed">
                                                                "{request.message}"
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-3 min-w-[140px]">
                                                <button
                                                    onClick={() => handleConnectionAction(request.id, "approve")}
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
                                                    onClick={() => handleConnectionAction(request.id, "reject")}
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

                    {/* Approved Connections */}
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            Approved Connections ({approvedConnections.length})
                        </h3>

                        {approvedConnections.length === 0 ? (
                            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-3xl p-8 text-center">
                                <p className="text-slate-400 text-sm">No approved connections yet.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {approvedConnections.map(connection => (
                                    <div key={connection.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
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
                                            Connected
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="max-w-lg w-full bg-white rounded-[3rem] p-12 shadow-2xl animate-in zoom-in-95 duration-200 relative">
                        <button
                            onClick={() => setShowInviteModal(false)}
                            className="absolute top-8 right-8 p-2 text-slate-400 hover:text-slate-900 transition-all"
                        >
                            <X className="h-6 w-6" />
                        </button>

                        <div className="text-center mb-10">
                            <div className="h-20 w-20 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                                <UserPlus className="h-10 w-10" />
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Expand Your Team</h2>
                            <p className="text-slate-500 font-medium mt-2">Generate a unique onboarding link for your promoter.</p>
                        </div>

                        {!inviteLink ? (
                            <form onSubmit={handleInvite} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Promoter Email</label>
                                    <input
                                        required
                                        type="email"
                                        value={inviteData.email}
                                        onChange={e => setInviteData({ ...inviteData, email: e.target.value })}
                                        className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-6 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                        placeholder="promoter@exclusive.com"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Legal Name</label>
                                    <input
                                        required
                                        type="text"
                                        value={inviteData.name}
                                        onChange={e => setInviteData({ ...inviteData, name: e.target.value })}
                                        className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-6 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                        placeholder="Full Name"
                                    />
                                </div>
                                <button
                                    disabled={loading}
                                    type="submit"
                                    className="w-full h-14 bg-slate-900 text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-slate-800 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    {loading ? "Generating Assets..." : "Generate Invitation Link"}
                                    {!loading && <ArrowRight className="h-4 w-4" />}
                                </button>
                            </form>
                        ) : (
                            <div className="space-y-8">
                                <div className="p-8 bg-emerald-50 rounded-3xl border border-emerald-100 text-center">
                                    <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 mx-auto mb-4 border border-emerald-100 shadow-sm">
                                        <Check className="h-6 w-6" />
                                    </div>
                                    <p className="text-sm font-bold text-emerald-900">Invite Link Generated Successfully</p>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600/60 mt-2">Valid for 7 Days</p>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                                        <input
                                            readOnly
                                            value={inviteLink}
                                            className="flex-1 bg-transparent border-none text-[10px] font-bold text-slate-500 focus:outline-none"
                                        />
                                        <button
                                            onClick={copyToClipboard}
                                            className={`p-2 rounded-xl transition-all ${copied ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-400 hover:text-slate-900'}`}
                                        >
                                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                        </button>
                                    </div>
                                    <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Share this link with {inviteData.name}</p>
                                </div>

                                <button
                                    onClick={() => setShowInviteModal(false)}
                                    className="w-full h-14 border border-slate-200 text-slate-900 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all"
                                >
                                    Done
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
