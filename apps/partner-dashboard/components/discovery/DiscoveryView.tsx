"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Search,
    RefreshCw,
    Users,
    ShieldCheck,
    Zap,
    MapPin,
    Star,
    CalendarDays,
    Clock,
    CheckCircle2,
    UserCircle,
    Building2,
    Filter,
    XCircle,
    Send,
    Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

type PartnerType = "host" | "venue" | "promoter" | "all";

interface Partner {
    id: string;
    type: "host" | "venue" | "promoter";
    name: string;
    avatar: string | null;
    coverImage: string | null;
    city: string;
    bio: string;
    tags: string[];
    eventsCount: number;
    followersCount: number;
    isVerified: boolean;
    connectionStatus: "pending" | "approved" | "rejected" | "blocked" | null;
    connectionId: string | null;
}

export function DiscoveryView({
    allowedTypes,
    partnerId,
    role
}: {
    allowedTypes: PartnerType[],
    partnerId: string | undefined,
    role: string
}) {
    const { profile, user } = useDashboardAuth();
    const [partners, setPartners] = useState<Partner[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState<PartnerType>(allowedTypes[0] || "all");
    const [filterCity, setFilterCity] = useState("");
    const [sendingRequest, setSendingRequest] = useState<string | null>(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);

    const fetchPartners = useCallback(async () => {
        if (!partnerId) return;
        setLoading(true);
        try {
            const token = await user?.getIdToken();
            const params = new URLSearchParams({
                partnerId: partnerId,
                role: role,
                action: "discover",
                limit: "30"
            });
            if (filterType !== "all") params.set("type", filterType);
            if (filterCity) params.set("city", filterCity);
            if (searchQuery) params.set("search", searchQuery);

            const res = await fetch(`/api/discovery?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json();
            setPartners(data.partners || []);
        } catch (err) {
            console.error("Failed to fetch partners:", err);
        } finally {
            setLoading(false);
        }
    }, [partnerId, role, user, filterType, filterCity, searchQuery]);

    useEffect(() => {
        if (partnerId) {
            fetchPartners();
        }
    }, [partnerId, fetchPartners]);

    const handleRequest = async (partner: Partner) => {
        if (!partnerId) return;
        setSendingRequest(partner.id);
        try {
            const token = await user?.getIdToken();
            const res = await fetch('/api/discovery', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    requesterId: partnerId,
                    requesterType: role,
                    requesterName: profile?.activeMembership?.partnerName || profile?.displayName,
                    requesterEmail: profile?.email,
                    targetId: partner.id,
                    targetType: partner.type,
                    targetName: partner.name
                })
            });

            if (!res.ok) throw new Error("Failed to send request");

            setSelectedPartner(partner);
            setShowSuccessModal(true);
            fetchPartners();
        } catch (err) {
            console.error(err);
            alert("Failed to send connection request. Please try again.");
        } finally {
            setSendingRequest(null);
        }
    };

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            {/* Search Controls */}
            <div className="flex flex-col md:flex-row gap-4 sticky top-4 z-30 p-2 bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-[2rem] shadow-sm">
                <div className="flex-1 relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Discovery search..."
                        className="w-full bg-transparent border-none rounded-2xl pl-11 pr-4 py-3 text-sm text-slate-900 focus:outline-none transition-all font-medium placeholder:text-slate-400"
                    />
                </div>
                <div className="flex gap-2 p-1">
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as PartnerType)}
                        className="pl-4 pr-10 py-2 bg-slate-50 border border-slate-200/50 rounded-xl text-[13px] font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none cursor-pointer hover:bg-slate-100 transition-colors"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '12px' }}
                    >
                        {allowedTypes.includes("all") && <option value="all">Everywhere</option>}
                        {allowedTypes.includes("venue") && <option value="venue">Venues</option>}
                        {allowedTypes.includes("host") && <option value="host">Hosts</option>}
                        {allowedTypes.includes("promoter") && <option value="promoter">Promoters</option>}
                    </select>
                    <select
                        value={filterCity}
                        onChange={(e) => setFilterCity(e.target.value)}
                        className="pl-4 pr-10 py-2 bg-slate-50 border border-slate-200/50 rounded-xl text-[13px] font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none cursor-pointer hover:bg-slate-100 transition-colors"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '12px' }}
                    >
                        <option value="">All Cities</option>
                        <option value="Pune">Pune</option>
                        <option value="Mumbai">Mumbai</option>
                        <option value="Goa">Goa</option>
                        <option value="Bengaluru">Bengaluru</option>
                    </select>
                    <button
                        onClick={() => fetchPartners()}
                        className="p-3 bg-white border border-slate-200/50 rounded-xl text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm active:scale-95"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {/* Partner Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-[420px] bg-slate-50/50 rounded-[2.5rem] animate-pulse border border-slate-100" />)}
                </div>
            ) : partners.length === 0 ? (
                <div className="py-24 bg-white/50 backdrop-blur-sm rounded-[3rem] border border-dashed border-slate-200 flex flex-col items-center text-center px-10">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                        <Users className="w-8 h-8 text-slate-300" />
                    </div>
                    <h4 className="text-xl font-semibold text-slate-900 tracking-tight">No Discoveries Found</h4>
                    <p className="text-slate-500 font-medium mt-2 max-w-xs">We couldn't find any partners matching those filters right now.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {partners.map((partner) => (
                        <PartnerCard
                            key={partner.id}
                            partner={partner}
                            onAction={() => handleRequest(partner)}
                            isActionLoading={sendingRequest === partner.id}
                        />
                    ))}
                </div>
            )}

            {/* Success Modal */}
            <AnimatePresence>
                {showSuccessModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[8px]">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-white rounded-[2.5rem] p-8 max-w-[340px] w-full text-center shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-white/20"
                        >
                            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                                <Send className="w-8 h-8" />
                            </div>
                            <h2 className="text-2xl font-semibold text-slate-900 mb-2 tracking-tight">Request Sent</h2>
                            <p className="text-slate-500 font-medium leading-relaxed mb-8 px-4">
                                Connection request for <span className="text-slate-900 font-bold">{selectedPartner?.name}</span> is on its way.
                            </p>
                            <button
                                onClick={() => setShowSuccessModal(false)}
                                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold tracking-tight hover:bg-blue-700 transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20"
                            >
                                Done
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function PartnerCard({ partner, onAction, isActionLoading }: { partner: Partner, onAction: () => void, isActionLoading: boolean }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="group bg-white border border-slate-200/60 rounded-[2.5rem] overflow-hidden flex flex-col hover:border-slate-300 hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)] transition-all duration-500"
        >
            {/* Image Section */}
            <div className="relative h-52 bg-slate-100 overflow-hidden">
                {partner.coverImage ? (
                    <img src={partner.coverImage} alt={partner.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-1000" />
                ) : (
                    <div className="h-full w-full bg-gradient-to-br from-indigo-50/50 to-purple-50/50" />
                )}

                {/* Glass Badges */}
                <div className="absolute top-4 left-4 z-20 flex gap-2">
                    <div className="px-3.5 py-1.5 bg-white/70 backdrop-blur-md rounded-full text-[11px] font-bold tracking-tight text-slate-800 border border-white/40 shadow-sm">
                        {partner.city}
                    </div>
                    <div className={`px-3.5 py-1.5 backdrop-blur-md rounded-full text-[11px] font-bold tracking-tight text-white flex items-center gap-1.5 border border-white/20 shadow-sm ${partner.type === 'host' ? 'bg-purple-500/80' :
                        partner.type === 'venue' ? 'bg-blue-500/80' : 'bg-emerald-500/80'
                        }`}>
                        {partner.type === 'host' ? <UserCircle className="w-3.5 h-3.5" /> : partner.type === 'venue' ? <Building2 className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                        {partner.type.charAt(0).toUpperCase() + partner.type.slice(1)}
                    </div>
                </div>

                {/* Verification Overlay */}
                {partner.isVerified && (
                    <div className="absolute bottom-4 right-4 z-20 p-2 bg-white/70 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm">
                        <ShieldCheck className="h-4 w-4 text-blue-600" />
                    </div>
                )}
            </div>

            {/* Details Section */}
            <div className="p-7 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight leading-tight">{partner.name}</h3>
                </div>

                <p className="text-slate-500 text-[14px] font-medium mb-6 line-clamp-2 leading-relaxed">
                    {partner.bio || 'Professional partner in the circle network.'}
                </p>

                <div className="grid grid-cols-2 gap-3 mb-8">
                    <div className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 rounded-2xl border border-slate-100/50">
                        <CalendarDays className="h-4 w-4 text-slate-400" />
                        <span className="text-[13px] font-bold text-slate-800 tracking-tight">{partner.eventsCount} Events</span>
                    </div>
                    <div className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 rounded-2xl border border-slate-100/50">
                        <Star className="h-4 w-4 text-slate-400" />
                        <span className="text-[13px] font-bold text-slate-800 tracking-tight">{partner.followersCount} Fans</span>
                    </div>
                </div>

                <div className="mt-auto space-y-3">
                    {partner.connectionStatus === 'approved' ? (
                        <div className="w-full py-4 bg-emerald-50 text-emerald-600 rounded-2xl text-[13px] font-bold tracking-tight flex items-center justify-center gap-2 border border-emerald-100/50">
                            <CheckCircle2 className="w-4 h-4" /> Connected
                        </div>
                    ) : partner.connectionStatus === 'pending' ? (
                        <div className="w-full py-4 bg-amber-50 text-amber-600 rounded-2xl text-[13px] font-bold tracking-tight flex items-center justify-center gap-2 border border-amber-100/50">
                            <Clock className="w-4 h-4" /> Request Pending
                        </div>
                    ) : partner.connectionStatus === 'rejected' ? (
                        <div className="w-full py-4 bg-slate-50 text-slate-500 rounded-2xl text-[13px] font-bold tracking-tight flex items-center justify-center gap-2 border border-slate-200">
                            <XCircle className="w-4 h-4" /> Not Interested
                        </div>
                    ) : partner.connectionStatus === 'blocked' ? (
                        <div className="w-full py-4 bg-red-50 text-red-600 rounded-2xl text-[13px] font-bold tracking-tight flex items-center justify-center gap-2 border border-red-100/50">
                            <ShieldCheck className="w-4 h-4" /> Blocked
                        </div>
                    ) : (
                        <button
                            onClick={onAction}
                            disabled={isActionLoading}
                            className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-[13px] font-bold tracking-tight shadow-lg shadow-slate-200 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
                        >
                            {isActionLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin text-white" />
                            ) : (
                                <>
                                    Connect
                                    <Zap className="h-4 w-4 fill-current opacity-80" />
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
