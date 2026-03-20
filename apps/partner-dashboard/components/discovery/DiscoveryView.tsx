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
import { VirtuosoGrid } from "react-virtuoso";
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
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* Search Controls */}
            <div className="flex flex-col md:flex-row gap-3 sticky top-4 z-30 p-1.5 bg-[var(--bg-elevated)]/80 backdrop-blur-xl border border-[var(--border-default)]/60 rounded-2xl shadow-sm">
                <div className="flex-1 relative group">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)] group-focus-within:text-blue-600 transition-colors" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search Circle..."
                        className="w-full bg-transparent border-none rounded-xl pl-10 pr-4 py-2 text-[13px] text-[var(--text-primary)] focus:outline-none transition-all font-medium placeholder:text-[var(--text-tertiary)]"
                    />
                </div>
                <div className="flex gap-1.5 p-0.5">
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as PartnerType)}
                        className="pl-3 pr-8 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-default)]/50 rounded-lg text-[11px] font-bold text-[var(--text-secondary)] focus:outline-none appearance-none cursor-pointer hover:bg-[var(--bg-fill)] transition-colors"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '10px' }}
                    >
                        {allowedTypes.includes("all") && <option value="all">Everywhere</option>}
                        {allowedTypes.includes("venue") && <option value="venue">Venues</option>}
                        {allowedTypes.includes("host") && <option value="host">Hosts</option>}
                        {allowedTypes.includes("promoter") && <option value="promoter">Promoters</option>}
                    </select>
                    <select
                        value={filterCity}
                        onChange={(e) => setFilterCity(e.target.value)}
                        className="pl-3 pr-8 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-default)]/50 rounded-lg text-[11px] font-bold text-[var(--text-secondary)] focus:outline-none appearance-none cursor-pointer hover:bg-[var(--bg-fill)] transition-colors"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '10px' }}
                    >
                        <option value="">All Cities</option>
                        <option value="Pune">Pune</option>
                        <option value="Mumbai">Mumbai</option>
                        <option value="Goa">Goa</option>
                        <option value="Bengaluru">Bengaluru</option>
                    </select>
                    <button
                        onClick={() => fetchPartners()}
                        className="p-2 bg-[var(--bg-elevated)] border border-[var(--border-default)]/50 rounded-lg text-[var(--text-tertiary)] hover:text-blue-600 transition-all shadow-sm active:scale-95"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {/* Partner Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <div key={i} className="h-[320px] bg-[var(--bg-secondary)]/50 rounded-2xl animate-pulse border border-[var(--border-subtle)]" />)}
                </div>
            ) : partners.length === 0 ? (
                <div className="py-20 bg-[var(--bg-elevated)]/50 backdrop-blur-sm rounded-3xl border border-dashed border-[var(--border-default)] flex flex-col items-center text-center px-8">
                    <div className="w-12 h-12 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-4">
                        <Users className="w-6 h-6 text-[var(--text-quaternary)]" />
                    </div>
                    <h4 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">No Discoveries Found</h4>
                    <p className="text-[var(--text-tertiary)] text-xs font-medium mt-1 max-w-xs">We couldn't find any partners matching those filters right now.</p>
                </div>
            ) : (
                <VirtuosoGrid
                    useWindowScroll
                    data={partners}
                    totalCount={partners.length}
                    overscan={200}
                    listClassName="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4"
                    itemContent={(index, partner) => (
                        <div className="p-0.5">
                            <PartnerCard
                                partner={partner}
                                onAction={() => handleRequest(partner)}
                                isActionLoading={sendingRequest === partner.id}
                            />
                        </div>
                    )}
                />
            )}

            {/* Success Modal */}
            <AnimatePresence>
                {showSuccessModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[8px]">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-[var(--bg-elevated)] rounded-[2.5rem] p-8 max-w-[340px] w-full text-center shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-white/20"
                        >
                            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                                <Send className="w-8 h-8" />
                            </div>
                            <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-2 tracking-tight">Request Sent</h2>
                            <p className="text-[var(--text-tertiary)] font-medium leading-relaxed mb-8 px-4">
                                Connection request for <span className="text-[var(--text-primary)] font-bold">{selectedPartner?.name}</span> is on its way.
                            </p>
                            <button
                                onClick={() => setShowSuccessModal(false)}
                                className="w-full py-4 bg-blue-600 text-[var(--text-primary)] rounded-2xl font-bold tracking-tight hover:bg-blue-700 transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20"
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
            className="group bg-[var(--bg-elevated)] border border-[var(--border-default)]/60 rounded-2xl overflow-hidden flex flex-col hover:border-[var(--border-default)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.04)] transition-all duration-500"
        >
            {/* Image Section */}
            <div className="relative h-32 bg-[var(--bg-fill)] overflow-hidden">
                {partner.coverImage ? (
                    <img src={partner.coverImage} alt={partner.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-1000" />
                ) : (
                    <div className="h-full w-full bg-gradient-to-br from-indigo-50/50 to-purple-50/50" />
                )}

                {/* Glass Badges */}
                <div className="absolute top-2.5 left-2.5 z-20 flex flex-wrap gap-1.5">
                    <div className="px-2 py-1 bg-[var(--bg-elevated)]/70 backdrop-blur-md rounded-lg text-[9px] font-bold tracking-tight text-[var(--text-primary)] border border-white/40 shadow-sm">
                        {partner.city}
                    </div>
                    <div className={`px-2 py-1 backdrop-blur-md rounded-lg text-[9px] font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-1 border border-white/20 shadow-sm ${partner.type === 'host' ? 'bg-purple-500/80' :
                        partner.type === 'venue' ? 'bg-blue-500/80' : 'bg-green-500/80'
                        }`}>
                        {partner.type === 'host' ? <UserCircle className="w-3 h-3" /> : partner.type === 'venue' ? <Building2 className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                        {partner.type.charAt(0).toUpperCase() + partner.type.slice(1)}
                    </div>
                </div>

                {/* Verification Overlay */}
                {partner.isVerified && (
                    <div className="absolute bottom-2.5 right-2.5 z-20 p-1.5 bg-[var(--bg-elevated)]/70 backdrop-blur-md rounded-lg border border-white/40 shadow-sm">
                        <ShieldCheck className="h-3 w-3 text-blue-600" />
                    </div>
                )}
            </div>

            {/* Details Section */}
            <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-tight leading-tight truncate">{partner.name}</h3>
                </div>

                <p className="text-[var(--text-tertiary)] text-[11px] font-medium mb-4 line-clamp-2 leading-relaxed">
                    {partner.bio || 'Verified circle network partner.'}
                </p>

                <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-subtle)]/50">
                        <CalendarDays className="h-3 w-3 text-[var(--text-tertiary)]" />
                        <span className="text-[10px] font-bold text-[var(--text-primary)] tracking-tight truncate">{partner.eventsCount} Events</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-subtle)]/50">
                        <Star className="h-3 w-3 text-[var(--text-tertiary)]" />
                        <span className="text-[10px] font-bold text-[var(--text-primary)] tracking-tight truncate">{partner.followersCount} Fans</span>
                    </div>
                </div>

                <div className="mt-auto pt-2">
                    {partner.connectionStatus === 'approved' ? (
                        <div className="w-full py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-bold tracking-tight flex items-center justify-center gap-1.5 border border-emerald-100/50">
                            <CheckCircle2 className="w-3 h-3" /> Connected
                        </div>
                    ) : partner.connectionStatus === 'pending' ? (
                        <div className="w-full py-2 bg-amber-50 text-amber-600 rounded-xl text-[10px] font-bold tracking-tight flex items-center justify-center gap-1.5 border border-amber-100/50">
                            <Clock className="w-3 h-3" /> Pending
                        </div>
                    ) : partner.connectionStatus === 'rejected' ? (
                        <div className="w-full py-2 bg-[var(--bg-secondary)] text-[var(--text-tertiary)] rounded-xl text-[10px] font-bold tracking-tight flex items-center justify-center gap-1.5 border border-[var(--border-default)]">
                            <XCircle className="w-3 h-3" /> Rejected
                        </div>
                    ) : partner.connectionStatus === 'blocked' ? (
                        <div className="w-full py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-bold tracking-tight flex items-center justify-center gap-1.5 border border-red-100/50">
                            <ShieldCheck className="w-3 h-3" /> Blocked
                        </div>
                    ) : (
                        <button
                            onClick={onAction}
                            disabled={isActionLoading}
                            className="w-full py-2.5 bg-[var(--bg-fill)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-xl text-[10px] font-black tracking-tight shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:opacity-50"
                        >
                            {isActionLoading ? (
                                <Loader2 className="w-3 h-3 animate-spin text-[var(--text-primary)]" />
                            ) : (
                                <>
                                    Connect
                                    <Zap className="h-3 w-3 fill-current opacity-80" />
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
