"use client";

import { useState } from "react";
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
import { useQueryClient } from "@tanstack/react-query";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { useVenueConnections } from "@/lib/hooks/useVenueQueries";
import { formatDate } from "@/lib/utils/format";
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
    const [activeTab, setActiveTab] = useState<'hosts' | 'promoters' | 'discover'>('promoters');
    const [processingRequest, setProcessingRequest] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const venueId = profile?.activeMembership?.partnerId;
    const venueName = profile?.displayName;

    const { data: connectionsData, isLoading: loading } = useVenueConnections(venueId);
    const allConnections = connectionsData?.connections || [];

    const promoterRequests: PromoterRequest[] = allConnections
        .filter((c: any) => c.type === "promoter_connection")
        .map((c: any) => ({
            id: c.id,
            promoterId: c.otherId,
            promoterName: c.otherName,
            ...c,
        }));

    const hostPartnerships: HostPartnership[] = allConnections
        .filter((c: any) => c.type === "partnership")
        .map((c: any) => ({
            id: c.id,
            hostId: c.otherId,
            hostName: c.otherName,
            ...c,
        }));

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

            await queryClient.invalidateQueries({ queryKey: ["venue-connections", venueId] });
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


    return (
        <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
            {/* Content only - Header and Tabs removed for consistency with parent wrapper */}
            <div className="min-h-[600px] max-w-4xl mx-auto">
                <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-body-sm font-semibold text-text-primary flex items-center gap-2">
                            <Clock className="w-4 h-4 text-text-tertiary" />
                            Pending Connection Requests
                        </h3>
                        <span className="text-label text-text-tertiary bg-surface-secondary px-2 py-1 rounded-md">
                            {(pendingPromoterRequests.length + pendingHostRequests.length)} Incoming
                        </span>
                    </div>

                    <AnimatePresence mode="popLayout">
                        {loading ? (
                            <div className="p-20 flex justify-center"><Loader2 className="w-8 h-8 text-text-placeholder animate-spin" /></div>
                        ) : (pendingPromoterRequests.length + pendingHostRequests.length) === 0 ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="py-24 bg-surface-secondary border-2 border-dashed border-border-default rounded-[3rem] flex flex-col items-center text-center px-10"
                            >
                                <div className="w-16 h-16 rounded-2xl bg-accent-glow flex items-center justify-center mb-6">
                                    <Clock className="w-8 h-8 text-accent-primary" />
                                </div>
                                <h4 className="text-title text-text-primary font-bold uppercase tracking-tight">Quiet for now</h4>
                                <p className="text-body-sm text-text-secondary mt-2 max-w-xs">Incoming partnership requests from hosts and promoters will appear here.</p>
                            </motion.div>
                        ) : (
                            <div className="space-y-4">
                                {[...pendingPromoterRequests, ...pendingHostRequests]
                                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                    .map((request: any) => (
                                    <motion.div
                                        key={request.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="group relative overflow-hidden bg-surface-secondary border border-border-subtle p-6 rounded-[2rem]"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-accent-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                        
                                        <div className="relative flex items-center justify-between">
                                            <div className="flex items-center gap-5">
                                                <div className="w-14 h-14 rounded-2xl bg-surface-tertiary flex items-center justify-center text-xl font-black text-text-primary shadow-sm border border-border-subtle">
                                                    {(request.promoterName?.[0] || request.hostName?.[0] || '?')}
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-black text-text-primary tracking-tight">
                                                        {request.promoterName || request.hostName}
                                                    </h3>
                                                    <div className="flex items-center gap-3 mt-1.5">
                                                        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-accent-primary">
                                                            {request.type === 'promoter_connection' ? <Zap className="w-3.5 h-3.5" /> : <UserCircle className="w-3.5 h-3.5" />}
                                                            {request.type === 'promoter_connection' ? 'Promoter' : 'Host'}
                                                        </span>
                                                        <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">•</span>
                                                        <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">
                                                            Received {formatDate(request.createdAt)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => handleAction(request.id, 'approve', request.type === 'promoter_connection' ? 'promoter' : 'host')}
                                                    disabled={!!processingRequest}
                                                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-400 hover:to-rose-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-orange-500/20 transition-all active:scale-95 disabled:opacity-50"
                                                >
                                                    {processingRequest === request.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Approve'}
                                                </button>
                                                <button
                                                    onClick={() => handleAction(request.id, 'reject', request.type === 'promoter_connection' ? 'promoter' : 'host')}
                                                    disabled={!!processingRequest}
                                                    className="h-12 w-12 rounded-xl bg-surface-tertiary border border-border-subtle text-text-tertiary flex items-center justify-center hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all active:scale-95 disabled:opacity-50"
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>

                                        {request.message && (
                                            <div className="mt-5 p-4 bg-surface-tertiary/50 rounded-2xl border border-border-subtle">
                                                <p className="text-[13px] text-text-secondary italic">"{request.message}"</p>
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
