"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Clock,
    CheckCircle2,
    XCircle,
    Users,
    Search,
    RefreshCw,
    Loader2
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { DiscoveryView } from "@/components/discovery/DiscoveryView";
import { motion, AnimatePresence } from "framer-motion";

type TabType = "discover" | "pending" | "connected" | "rejected";

export default function PromoterConnectionsPage() {
    const { profile, user } = useDashboardAuth();
    const [activeTab, setActiveTab] = useState<TabType>("discover");
    const [connections, setConnections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });

    const promoterId = profile?.activeMembership?.partnerId;
    const role = "promoter";

    const fetchConnections = useCallback(async () => {
        if (!promoterId) return;
        setLoading(true);
        try {
            const token = await user?.getIdToken();
            const res = await fetch(`/api/discovery?partnerId=${promoterId}&role=${role}&action=list`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setConnections(data.connections || []);

            // Calculate stats
            const pending = data.connections.filter((c: any) => c.status === 'pending').length;
            const approved = data.connections.filter((c: any) => c.status === 'approved' || c.status === 'active').length;
            const rejected = data.connections.filter((c: any) => c.status === 'rejected').length;
            setStats({ pending, approved, rejected });
        } catch (err) {
            console.error("Failed to fetch connections:", err);
        } finally {
            setLoading(false);
        }
    }, [promoterId, role, user]);

    useEffect(() => {
        if (promoterId) {
            fetchConnections();
        }
    }, [promoterId, fetchConnections]);

    const formatDate = (timestamp: any) => {
        if (!timestamp) return "";
        const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
        return date.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    };

    const filteredConnections = connections.filter(c => {
        if (activeTab === "pending") return c.status === "pending";
        if (activeTab === "connected") return c.status === "approved" || c.status === "active";
        if (activeTab === "rejected") return c.status === "rejected";
        return false;
    });

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-12 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2 text-indigo-600">
                        <div className="p-2 bg-indigo-50 rounded-xl">
                            <Users className="w-5 h-5" />
                        </div>
                        <span className="text-[13px] font-bold uppercase tracking-[0.2em]">Partner Network</span>
                    </div>
                    <h1 className="text-4xl font-semibold text-slate-900 tracking-tight">Connections</h1>
                    <p className="text-slate-500 text-lg font-medium mt-2 max-w-xl">
                        Build your professional network and unlock exclusive commissions.
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex items-center p-1.5 bg-slate-100/80 backdrop-blur-sm rounded-2xl w-fit overflow-x-auto">
                    {[
                        { id: "discover", label: "Discover", icon: Search },
                        { id: "pending", label: "Pending", count: stats.pending, icon: Clock },
                        { id: "connected", label: "Connected", count: stats.approved, icon: CheckCircle2 },
                        { id: "rejected", label: "Rejected", count: stats.rejected, icon: XCircle }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all shrink-0 ${activeTab === tab.id
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                                }`}
                        >
                            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-indigo-500' : ''}`} />
                            {tab.label}
                            {tab.count !== undefined && tab.count > 0 && (
                                <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${activeTab === tab.id ? "bg-indigo-500 text-white" : "bg-slate-200 text-slate-500"
                                    }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Container */}
            <div className="min-h-[500px]">
                <AnimatePresence mode="wait">
                    {activeTab === "discover" ? (
                        <motion.div
                            key="discover"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <DiscoveryView
                                allowedTypes={["host", "venue"]}
                                partnerId={promoterId}
                                role="promoter"
                            />
                        </motion.div>
                    ) : (
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-32">
                                    <Loader2 className="w-8 h-8 text-slate-200 animate-spin" />
                                </div>
                            ) : filteredConnections.length === 0 ? (
                                <div className="py-24 bg-white/50 rounded-[3rem] border border-dashed border-slate-200 flex flex-col items-center text-center px-10">
                                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-6">
                                        {activeTab === "pending" && <Clock className="w-8 h-8 text-slate-300" />}
                                        {activeTab === "connected" && <CheckCircle2 className="w-8 h-8 text-slate-300" />}
                                        {activeTab === "rejected" && <XCircle className="w-8 h-8 text-slate-300" />}
                                    </div>
                                    <h4 className="text-xl font-semibold text-slate-900">No {activeTab} connections</h4>
                                    <p className="text-slate-500 font-medium mt-2 max-w-xs">Visit the Discover tab to find new partners and grow your network.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {filteredConnections.map(connection => (
                                        <motion.div
                                            key={connection.id}
                                            layout
                                            className="group bg-white border border-slate-200/60 rounded-[2.5rem] p-7 transition-all hover:border-slate-300 hover:shadow-sm"
                                        >
                                            <div className="flex items-start justify-between mb-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xl uppercase">
                                                        {connection.otherName?.[0] || "?"}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-900 text-lg group-hover:text-indigo-600 transition-colors">
                                                            {connection.otherName}
                                                        </h4>
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-bold uppercase tracking-wider mt-1.5 ${connection.otherType === 'host' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                                                            }`}>
                                                            {connection.otherType}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-4 pt-6 border-t border-slate-50">
                                                <div className="flex items-center justify-between text-[13px]">
                                                    <span className="text-slate-400 font-medium">Requested on</span>
                                                    <span className="text-slate-900 font-semibold">{formatDate(connection.createdAt)}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-[13px]">
                                                    <span className="text-slate-400 font-medium">Status</span>
                                                    <span className={`font-bold px-3 py-1 rounded-full text-[11px] uppercase tracking-tight ${connection.status === 'pending' ? 'bg-amber-50 text-amber-600' :
                                                            (connection.status === 'approved' || connection.status === 'active') ? 'bg-emerald-50 text-emerald-600' :
                                                                'bg-slate-100 text-slate-500'
                                                        }`}>
                                                        {connection.status === 'active' ? 'connected' : connection.status}
                                                    </span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

