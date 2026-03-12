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
    Instagram,
    PhoneCall
} from "lucide-react";


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

    // Fetch network and requests from API Gateway proxy
    useEffect(() => {
        if (!hostId || !profile) return;

        const fetchNetworkAndRequests = async () => {
            try {
                const token = await (window as any).getAuthToken?.();
                const res = await fetch(`/api/discovery?action=list&partnerId=${hostId}&role=host`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                });

                if (!res.ok) throw new Error("Failed to fetch connections");

                const data = await res.json();
                const connections = data.connections || [];

                const promoterRequests = connections.filter((c: any) => c.type === "promoter_connection");

                setConnectionRequests(promoterRequests);

                // Active promoters are connection requests that are approved
                const approvedPromoters = promoterRequests
                    .filter((c: any) => c.status === "approved" || c.status === "active")
                    .map((c: any) => ({
                        id: c.otherId,
                        name: c.otherName,
                        email: c.promoterEmail,
                        phone: c.promoterPhone,
                        instagram: c.promoterInstagram,
                        status: c.status,
                        connectionId: c.id
                    }));

                setPromoters(approvedPromoters);
            } catch (error) {
                console.error("[Host Promoters] Fetch error:", error);
            }
        };
        fetchNetworkAndRequests();
    }, [hostId, profile]);

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
            const token = await (window as any).getAuthToken?.();
            const res = await fetch('/api/discovery', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` })
                },
                body: JSON.stringify({
                    connectionId,
                    action,
                    role: "host",
                    partnerId: hostId,
                    partnerName: hostName
                })
            });

            if (!res.ok) throw new Error("Failed to update request");

            console.log(`[Host] ${action}d connection ${connectionId}`);
            // To simulate realtime update until full refetch, we can update local state:
            setConnectionRequests(prev => prev.filter(r => r.id !== connectionId || action === 'approve'));
            if (action === 'approve') {
                const approvedItem = connectionRequests.find(r => r.id === connectionId);
                if (approvedItem) {
                    setPromoters(prev => [...prev, {
                        id: approvedItem.promoterId,
                        name: approvedItem.promoterName,
                        email: approvedItem.promoterEmail,
                        status: "approved",
                        connectionId
                    }]);
                }
            }
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
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-text-primary tracking-tight transition-all">Promoter Network</h1>
                    <p className="text-text-tertiary font-medium mt-0.5 text-sm">Manage and track your promoter team performance.</p>
                </div>
                <button
                    onClick={() => {
                        setShowInviteModal(true);
                        setInviteLink("");
                        setInviteData({ email: "", name: "" });
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-text-primary rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                    <UserPlus className="h-4 w-4" />
                    Invite Promoter
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-surface-elevated p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Users className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-text-tertiary">Total Network</p>
                        <p className="text-xl font-black text-text-primary">{promoters.length}</p>
                    </div>
                </div>
                <div className="bg-surface-elevated p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                        <Clock className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-text-tertiary">Pending</p>
                        <p className="text-xl font-black text-text-primary">{pendingRequests.length}</p>
                    </div>
                </div>
                <div className="bg-surface-elevated p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Users className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-text-tertiary">Connected</p>
                        <p className="text-xl font-black text-text-primary">{approvedConnections.length}</p>
                    </div>
                </div>
                <div className="bg-surface-elevated p-4 rounded-2xl border border-border-default shadow-sm flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <TrendingUp className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-text-tertiary">Total Sales</p>
                        <p className="text-xl font-black text-text-primary">₹0</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 p-1 bg-surface-secondary rounded-lg w-fit">
                <button
                    onClick={() => setActiveTab("network")}
                    className={`px-4 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all ${activeTab === "network"
                        ? "bg-surface-elevated text-text-primary shadow-sm"
                        : "text-text-tertiary hover:text-text-secondary"
                        }`}
                >
                    My Network ({promoters.length})
                </button>
                <button
                    onClick={() => setActiveTab("requests")}
                    className={`px-4 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeTab === "requests"
                        ? "bg-surface-elevated text-text-primary shadow-sm"
                        : "text-text-tertiary hover:text-text-secondary"
                        }`}
                >
                    Requests
                    {pendingRequests.length > 0 && (
                        <span className="px-1.5 py-0.5 bg-amber-500 text-text-primary rounded-full text-[9px]">
                            {pendingRequests.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Network Tab */}
            {activeTab === "network" && (
                <div className="bg-surface-elevated border border-border-default rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between bg-surface-tertiary/50">
                        <div className="relative w-60">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
                            <input
                                type="text"
                                placeholder="Find promoter..."
                                className="w-full bg-surface-elevated border border-border-default rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-50">
                                    <th className="px-5 py-3 text-[9px] font-black text-text-tertiary uppercase tracking-widest">Promoter</th>
                                    <th className="px-5 py-3 text-[9px] font-black text-text-tertiary uppercase tracking-widest">Performance</th>
                                    <th className="px-5 py-3 text-[9px] font-black text-text-tertiary uppercase tracking-widest">Status</th>
                                    <th className="px-5 py-3 text-[9px] font-black text-text-tertiary uppercase tracking-widest text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {promoters.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-5 py-12 text-center">
                                            <div className="max-w-xs mx-auto">
                                                <Users className="h-10 w-10 text-text-placeholder mx-auto mb-3" />
                                                <p className="text-text-tertiary font-bold text-sm">No promoters found in your network.</p>
                                                <p className="text-xs text-text-tertiary mt-1">Invite your team to start tracking sales and performance.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    promoters.map(promoter => (
                                        <tr key={promoter.id} className="hover:bg-surface-tertiary group transition-all">
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-xl bg-surface-secondary border border-border-default flex items-center justify-center font-black text-sm text-text-tertiary group-hover:bg-surface-elevated group-hover:text-indigo-600 transition-all">
                                                        {promoter.name?.[0] || 'P'}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-text-primary text-sm">{promoter.name}</p>
                                                        <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest flex items-center gap-1">
                                                            <Mail className="h-3 w-3" />
                                                            {promoter.email}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-1.5 w-20 bg-surface-secondary rounded-full overflow-hidden">
                                                        <div className="h-full bg-indigo-600 rounded-full" style={{ width: '0%' }}></div>
                                                    </div>
                                                    <span className="text-[11px] font-bold text-text-tertiary">0%</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[9px] font-black uppercase tracking-widest">
                                                    Active
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <button className="p-1.5 text-text-tertiary hover:text-text-primary transition-colors">
                                                    <MoreHorizontal className="h-4 w-4" />
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
                <div className="space-y-5">
                    {/* Pending Requests */}
                    <div>
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-text-tertiary mb-3 flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-amber-500" />
                            Pending Connection Requests ({pendingRequests.length})
                        </h3>

                        {pendingRequests.length === 0 ? (
                            <div className="bg-surface-elevated border border-border-default rounded-2xl p-8 text-center">
                                <Users className="w-10 h-10 text-text-placeholder mx-auto mb-3" />
                                <p className="text-text-tertiary font-bold text-sm">No pending requests</p>
                                <p className="text-xs text-text-tertiary mt-1">When promoters request to connect with you, they'll appear here.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {pendingRequests.map(request => (
                                    <div key={request.id} className="bg-surface-elevated border border-border-default rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
                                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                            <div className="flex-1 space-y-3">
                                                <div className="flex items-start gap-3">
                                                    <div className="h-12 w-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-lg">
                                                        {request.promoterName?.[0] || "P"}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-base font-bold text-text-primary">{request.promoterName || "Unknown Promoter"}</h4>
                                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                                                            <p className="text-xs font-bold text-text-tertiary flex items-center gap-1 uppercase tracking-wider">
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
                                                                <p className="text-xs font-bold text-text-tertiary flex items-center gap-1 uppercase tracking-wider">
                                                                    <PhoneCall className="w-3 h-3" />
                                                                    {request.promoterPhone}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] text-text-placeholder font-bold uppercase tracking-widest mt-2 flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            Submitted {formatDate(request.createdAt)}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Bio & Message */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div className="p-3 bg-surface-tertiary rounded-xl border border-border-subtle">
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-text-tertiary mb-1">Promoter Biography</p>
                                                        <p className="text-[11px] font-bold text-text-secondary italic leading-relaxed">
                                                            "{request.promoterBio || "No biography provided by the promoter."}"
                                                        </p>
                                                    </div>
                                                    {request.message && (
                                                        <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
                                                            <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-1">Personal Message</p>
                                                            <p className="text-[11px] font-bold text-indigo-600 leading-relaxed">
                                                                "{request.message}"
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-2 min-w-[120px]">
                                                <button
                                                    onClick={() => handleConnectionAction(request.id, "approve")}
                                                    disabled={processingRequest === request.id}
                                                    className="w-full py-2.5 bg-emerald-600 text-text-primary rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
                                                >
                                                    {processingRequest === request.id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                                    ) : (
                                                        "Confirm"
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => handleConnectionAction(request.id, "reject")}
                                                    disabled={processingRequest === request.id}
                                                    className="w-full py-2.5 bg-surface-elevated border border-border-default text-text-tertiary rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-surface-tertiary transition-all disabled:opacity-50"
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
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-text-tertiary mb-3 flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            Approved Connections ({approvedConnections.length})
                        </h3>

                        {approvedConnections.length === 0 ? (
                            <div className="bg-surface-tertiary border border-dashed border-border-default rounded-2xl p-6 text-center">
                                <p className="text-text-tertiary text-sm">No approved connections yet.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {approvedConnections.map(connection => (
                                    <div key={connection.id} className="bg-surface-elevated border border-border-default rounded-xl p-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                                                {connection.promoterName?.[0] || "P"}
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-text-primary text-sm">{connection.promoterName}</h4>
                                                <p className="text-[10px] text-text-tertiary">{connection.promoterEmail}</p>
                                            </div>
                                        </div>
                                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-bold uppercase">
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
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-surface-secondary/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="max-w-md w-full bg-surface-elevated rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 relative">
                        <button
                            onClick={() => setShowInviteModal(false)}
                            className="absolute top-4 right-4 p-1.5 text-text-tertiary hover:text-text-primary transition-all"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        <div className="text-center mb-5">
                            <div className="h-14 w-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                <UserPlus className="h-7 w-7" />
                            </div>
                            <h2 className="text-xl font-black text-text-primary tracking-tight">Expand Your Team</h2>
                            <p className="text-text-tertiary font-medium mt-1 text-sm">Generate a unique onboarding link for your promoter.</p>
                        </div>

                        {!inviteLink ? (
                            <form onSubmit={handleInvite} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary ml-1">Promoter Email</label>
                                    <input
                                        required
                                        type="email"
                                        value={inviteData.email}
                                        onChange={e => setInviteData({ ...inviteData, email: e.target.value })}
                                        className="w-full h-11 bg-surface-tertiary border border-border-default rounded-xl px-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                        placeholder="promoter@exclusive.com"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary ml-1">Legal Name</label>
                                    <input
                                        required
                                        type="text"
                                        value={inviteData.name}
                                        onChange={e => setInviteData({ ...inviteData, name: e.target.value })}
                                        className="w-full h-11 bg-surface-tertiary border border-border-default rounded-xl px-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                        placeholder="Full Name"
                                    />
                                </div>
                                <button
                                    disabled={loading}
                                    type="submit"
                                    className="w-full h-11 bg-surface-secondary text-text-primary rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-surface-tertiary transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? "Generating Assets..." : "Generate Invitation Link"}
                                    {!loading && <ArrowRight className="h-4 w-4" />}
                                </button>
                            </form>
                        ) : (
                            <div className="space-y-4">
                                <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                                    <div className="h-10 w-10 bg-surface-elevated rounded-xl flex items-center justify-center text-emerald-600 mx-auto mb-2 border border-emerald-100 shadow-sm">
                                        <Check className="h-5 w-5" />
                                    </div>
                                    <p className="text-sm font-bold text-emerald-900">Invite Link Generated Successfully</p>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600/60 mt-1">Valid for 7 Days</p>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 p-3 bg-surface-tertiary border border-border-default rounded-xl">
                                        <input
                                            readOnly
                                            value={inviteLink}
                                            className="flex-1 bg-transparent border-none text-[10px] font-bold text-text-tertiary focus:outline-none"
                                        />
                                        <button
                                            onClick={copyToClipboard}
                                            className={`p-1.5 rounded-lg transition-all ${copied ? 'bg-emerald-600 text-text-primary' : 'bg-surface-elevated border border-border-default text-text-tertiary hover:text-text-primary'}`}
                                        >
                                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                        </button>
                                    </div>
                                    <p className="text-center text-[10px] font-black uppercase tracking-widest text-text-tertiary">Share this link with {inviteData.name}</p>
                                </div>

                                <button
                                    onClick={() => setShowInviteModal(false)}
                                    className="w-full h-10 border border-border-default text-text-primary rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-surface-tertiary transition-all"
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
