"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Search,
    Users,
    Building2,
    UserCircle,
    CheckCircle2,
    Clock,
    XCircle,
    MapPin,
    Star,
    CalendarDays,
    RefreshCw,
    ShieldCheck,
    Zap,
    Filter,
    ChevronRight
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import Link from "next/link";

type PartnerType = "host" | "club" | "promoter" | "all";

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
    connectionStatus: "pending" | "approved" | "rejected" | null;
    connectionId: string | null;
}

export default function HostDiscoverPage() {
    const { profile } = useDashboardAuth();
    const [partners, setPartners] = useState<Partner[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState<PartnerType>("all");
    const [filterCity, setFilterCity] = useState("");
    const [sendingRequest, setSendingRequest] = useState<string | null>(null);

    const hostId = profile?.activeMembership?.partnerId;

    const fetchPartners = useCallback(async () => {
        if (!hostId) return;
        setLoading(true);
        try {
            const params = new URLSearchParams({
                promoterId: hostId, // Using hostId as the source ID for discovery
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
    }, [hostId, filterType, filterCity, searchQuery]);

    useEffect(() => {
        if (hostId) {
            fetchPartners();
        }
    }, [hostId, fetchPartners]);

    const handleRequest = async (partner: Partner) => {
        if (!hostId) return;
        setSendingRequest(partner.id);
        try {
            // Use the generic connection request API
            await fetch('/api/promoter/connections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    promoterId: hostId, // Source
                    promoterName: profile?.activeMembership?.partnerName || profile?.displayName,
                    targetId: partner.id,
                    targetType: partner.type,
                    targetName: partner.name
                })
            });

            // Refresh partners to show pending status
            fetchPartners();
        } catch (err) {
            console.error(err);
        } finally {
            setSendingRequest(null);
        }
    };

    return (
        <div className="space-y-10 pb-20 animate-in fade-in duration-500">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-10">
                <div className="max-w-2xl">
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
                        Discovery Network
                    </h1>
                    <p className="text-slate-500 text-lg font-medium mt-3 leading-relaxed">
                        Find and partner with verified clubs, promoters, and other hosts to expand your reach.
                    </p>
                </div>
            </div>

            {/* Search Controls */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search partners..."
                        className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-base text-slate-900 focus:outline-none focus:border-slate-400 transition-all font-medium placeholder:text-slate-300 shadow-sm"
                    />
                </div>
                <div className="flex gap-3">
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as PartnerType)}
                        className="px-6 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 focus:outline-none focus:border-slate-400 shadow-sm appearance-none cursor-pointer"
                    >
                        <option value="all">All Partners</option>
                        <option value="club">Clubs Only</option>
                        <option value="host">Hosts Only</option>
                        <option value="promoter">Promoters Only</option>
                    </select>
                    <select
                        value={filterCity}
                        onChange={(e) => setFilterCity(e.target.value)}
                        className="px-6 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 focus:outline-none focus:border-slate-400 shadow-sm appearance-none cursor-pointer"
                    >
                        <option value="">All Cities</option>
                        <option value="Pune">Pune</option>
                        <option value="Mumbai">Mumbai</option>
                        <option value="Goa">Goa</option>
                        <option value="Bengaluru">Bengaluru</option>
                    </select>
                    <button
                        onClick={() => fetchPartners()}
                        className="p-4 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:text-slate-900 shadow-sm transition-colors"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {/* Partner Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                    {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-[400px] bg-white rounded-[2.5rem] animate-pulse border border-slate-100 shadow-sm" />)}
                </div>
            ) : partners.length === 0 ? (
                <div className="py-20 bg-white rounded-[3rem] border border-dashed border-slate-200 flex flex-col items-center text-center px-10">
                    <Users className="w-12 h-12 text-slate-300 mb-4" />
                    <h4 className="text-xl font-bold text-slate-900">No Partners Found</h4>
                    <p className="text-slate-500 font-medium mt-1">Try adjusting your filters to find more connections.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
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
        </div>
    );
}

function PartnerCard({ partner, onAction, isActionLoading }: { partner: Partner, onAction: () => void, isActionLoading: boolean }) {
    return (
        <div className="group bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden flex flex-col hover:border-slate-300 hover:shadow-2xl hover:shadow-slate-100 transition-all">
            {/* Image Section */}
            <div className="relative h-48 bg-slate-50 overflow-hidden">
                {partner.coverImage ? (
                    <img src={partner.coverImage} alt={partner.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700" />
                ) : (
                    <div className="h-full w-full bg-gradient-to-br from-indigo-500 to-purple-600 opacity-80" />
                )}

                <div className="absolute top-5 left-5 z-20 flex gap-2">
                    <span className="px-4 py-1.5 bg-white/90 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-slate-900 border border-slate-100 shadow-sm">
                        {partner.city}
                    </span>
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-1.5 shadow-lg ${partner.type === 'host' ? 'bg-purple-600' : partner.type === 'club' ? 'bg-indigo-600' : 'bg-emerald-600'
                        }`}>
                        {partner.type === 'host' ? <UserCircle className="w-3 h-3" /> : partner.type === 'club' ? <Building2 className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                        {partner.type}
                    </span>
                </div>
            </div>

            {/* Details Section */}
            <div className="p-8 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-black text-slate-950 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">{partner.name}</h3>
                    {partner.isVerified && (
                        <ShieldCheck className="h-5 w-5 text-indigo-500" />
                    )}
                </div>

                <p className="text-slate-500 text-sm font-medium mb-6 line-clamp-2 leading-relaxed">
                    {partner.bio || 'Professional partner in the circle network.'}
                </p>

                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                            <CalendarDays className="h-4 w-4" />
                        </div>
                        <p className="text-xs font-bold text-slate-900">{partner.eventsCount} Events</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                            <Star className="h-4 w-4" />
                        </div>
                        <p className="text-xs font-bold text-slate-900">{partner.followersCount} Followers</p>
                    </div>
                </div>

                <div className="mt-auto pt-6 border-t border-slate-50">
                    {partner.connectionStatus === 'approved' ? (
                        <div className="w-full py-4 bg-emerald-50 text-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                            <CheckCircle2 className="w-4 h-4" /> Already Connected
                        </div>
                    ) : partner.connectionStatus === 'pending' ? (
                        <div className="w-full py-4 bg-amber-50 text-amber-600 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                            <Clock className="w-4 h-4" /> Request Pending
                        </div>
                    ) : (
                        <button
                            onClick={onAction}
                            disabled={isActionLoading}
                            className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2"
                        >
                            {isActionLoading ? 'Sending...' : 'Request Partnership'}
                            <Zap className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
