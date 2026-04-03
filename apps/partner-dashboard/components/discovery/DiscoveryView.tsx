"use client";

import { useState, useEffect, useCallback } from "react";
import {
    RefreshCw,
    Users,
    ShieldCheck,
    MapPin,
    CalendarDays,
    Clock,
    CheckCircle2,
    UserCircle,
    Building2,
    XCircle,
    Send,
    Loader2,
    Star,
    Zap,
    Search,
} from "lucide-react";
import { VirtuosoGrid } from "react-virtuoso";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { VenueActionButton } from "@/components/venue-layout/VenuePageShell";

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
                headers: { "Authorization": `Bearer ${token}` }
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
        if (partnerId) fetchPartners();
    }, [partnerId, fetchPartners]);

    const handleRequest = async (partner: Partner) => {
        if (!partnerId) return;
        setSendingRequest(partner.id);
        try {
            const token = await user?.getIdToken();
            const res = await fetch("/api/discovery", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    requesterId: partnerId,
                    requesterType: role,
                    requesterName: profile?.activeMembership?.partnerName || profile?.displayName || undefined,
                    requesterEmail: profile?.email ?? undefined,
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
        <div className="space-y-8">
            {/* Search & Filter Bar */}
            <div className="flex flex-col xl:flex-row xl:items-center gap-4">
                {/* Search input */}
                <div className="relative group flex-1">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--v-text-muted)] group-focus-within:text-[var(--v-orange)] transition-colors" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search venues, cities, names..."
                        className="w-full bg-[var(--v-card)] border border-[var(--v-border)] rounded-[24px] pl-14 pr-6 py-4 text-[15px] text-text-primary placeholder:text-[var(--v-text-muted)] focus:outline-none focus:border-[var(--v-orange)]/50 transition-all font-bold tracking-tight shadow-sm"
                    />
                </div>

                {/* Filter controls */}
                <div className="flex items-center gap-3">
                    <div className="flex p-2 bg-[var(--v-card)] border border-[var(--v-border)] rounded-[24px] gap-2">
                        {allowedTypes.filter(t => t !== "all").map(t => (
                            <button
                                key={t}
                                onClick={() => setFilterType(t)}
                                className={`px-5 py-2.5 rounded-[16px] text-[12px] font-black uppercase tracking-wider transition-all ${filterType === t ? "bg-[var(--v-elevated)] text-text-primary shadow-lg" : "text-[var(--v-text-tertiary)] hover:text-text-primary"}`}
                            >
                                {t === "venue" ? "Venues" : t === "promoter" ? "Promoters" : t}
                            </button>
                        ))}
                    </div>

                    <select
                        value={filterCity}
                        onChange={(e) => setFilterCity(e.target.value)}
                        className="bg-[var(--v-card)] border border-[var(--v-border)] rounded-[24px] px-5 py-4 text-[13px] font-black text-text-primary focus:outline-none focus:border-[var(--v-orange)]/50 transition-all appearance-none cursor-pointer"
                    >
                        <option value="">All Cities</option>
                        <option value="Pune">Pune</option>
                        <option value="Mumbai">Mumbai</option>
                        <option value="Goa">Goa</option>
                        <option value="Bengaluru">Bengaluru</option>
                    </select>

                    <button
                        onClick={() => fetchPartners()}
                        className="w-14 h-14 flex items-center justify-center rounded-[20px] bg-[var(--v-card)] border border-[var(--v-border)] text-[var(--v-text-muted)] hover:text-[var(--v-orange)] hover:border-[var(--v-orange)]/30 transition-all active:scale-95"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {/* Partner Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <div key={i} className="h-80 rounded-[32px] animate-pulse bg-[var(--v-card)] border border-[var(--v-border)]" />
                    ))}
                </div>
            ) : partners.length === 0 ? (
                <div className="py-32 rounded-[56px] bg-[var(--v-card)] border border-dashed border-[var(--v-border)] flex flex-col items-center text-center px-12">
                    <div className="w-20 h-20 rounded-full bg-surface-tertiary flex items-center justify-center mb-8">
                        <Building2 className="w-10 h-10 text-text-tertiary" />
                    </div>
                    <h3 className="text-2xl font-black text-text-primary">No results found</h3>
                    <p className="text-[15px] text-[var(--v-text-tertiary)] mt-3 mb-10 max-w-sm leading-relaxed">
                        Try adjusting your filters or search to find partners on The C1rcle network.
                    </p>
                    <button
                        onClick={() => { setSearchQuery(""); setFilterCity(""); }}
                        className="h-12 px-8 rounded-2xl bg-surface-tertiary border border-border-subtle text-text-primary text-[13px] font-black uppercase tracking-widest hover:bg-surface-elevated transition-all"
                    >
                        Clear Filters
                    </button>
                </div>
            ) : (
                <VirtuosoGrid
                    useWindowScroll
                    data={partners}
                    totalCount={partners.length}
                    overscan={300}
                    listClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                    itemContent={(index, partner) => (
                        <PartnerCard
                            key={partner.id}
                            partner={partner}
                            onAction={() => handleRequest(partner)}
                            isActionLoading={sendingRequest === partner.id}
                        />
                    )}
                />
            )}

            {/* Success Modal */}
            <AnimatePresence>
                {showSuccessModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                        <motion.div
                            initial={{ scale: 0.92, opacity: 0, y: 24 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.92, opacity: 0, y: 24 }}
                            transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
                            className="rounded-[40px] p-10 max-w-[360px] w-full text-center border border-[var(--v-border)]"
                            style={{ background: "var(--v-elevated)" }}
                        >
                            <div className="w-20 h-20 rounded-[24px] flex items-center justify-center mx-auto mb-7"
                                style={{ background: "var(--v-orange)10", border: "1px solid var(--v-orange)20" }}>
                                <Send className="w-9 h-9" style={{ color: "var(--v-orange)" }} />
                            </div>
                            <h2 className="text-2xl font-black text-text-primary mb-3 tracking-tight">Request Sent</h2>
                            <p className="text-[var(--v-text-tertiary)] font-bold leading-relaxed mb-8 px-2">
                                Your partnership request to <span className="text-text-primary">{selectedPartner?.name}</span> is now pending their approval.
                            </p>
                            <VenueActionButton
                                variant="primary"
                                className="w-full h-13"
                                onClick={() => setShowSuccessModal(false)}
                            >
                                Done
                            </VenueActionButton>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function PartnerCard({ partner, onAction, isActionLoading }: {
    partner: Partner;
    onAction: () => void;
    isActionLoading: boolean;
}) {
    const typeColor = partner.type === "venue" ? "var(--v-info)" : partner.type === "promoter" ? "var(--v-orange)" : "var(--v-success)";
    const TypeIcon = partner.type === "venue" ? Building2 : partner.type === "host" ? UserCircle : Users;

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="group relative rounded-[32px] bg-[var(--v-card)] border border-[var(--v-border)] hover:bg-[var(--v-elevated)] transition-all overflow-hidden"
        >
            {/* Cover */}
            <div className="h-44 bg-surface-tertiary relative overflow-hidden">
                {partner.coverImage ? (
                    <img
                        src={partner.coverImage}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center"
                        style={{ background: `linear-gradient(135deg, ${typeColor}15, ${typeColor}05)` }}>
                        <TypeIcon className="w-12 h-12 text-text-tertiary" />
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* City + Type badges */}
                <div className="absolute top-4 left-4 flex items-center gap-2">
                    {partner.city && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest border border-white/10 backdrop-blur-md"
                            style={{ background: "rgba(0,0,0,0.4)", color: "rgba(255,255,255,0.9)" }}>
                            <MapPin className="w-3 h-3" />
                            {partner.city}
                        </div>
                    )}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest border backdrop-blur-md"
                        style={{ background: `${typeColor}20`, borderColor: `${typeColor}40`, color: typeColor }}>
                        <TypeIcon className="w-3 h-3" />
                        {partner.type}
                    </div>
                </div>

                {/* Verified badge */}
                {partner.isVerified && (
                    <div className="absolute top-4 right-4 p-2 rounded-xl border border-white/10 backdrop-blur-md"
                        style={{ background: "rgba(0,0,0,0.4)" }}>
                        <ShieldCheck className="w-4 h-4" style={{ color: "var(--v-info)" }} />
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-6">
                <h3 className="text-[17px] font-black text-text-primary tracking-tight truncate mb-1">{partner.name}</h3>
                <p className="text-[13px] text-[var(--v-text-tertiary)] font-bold line-clamp-2 leading-relaxed mb-5">
                    {partner.bio || "Verified C1rcle network partner."}
                </p>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="flex items-center gap-2 p-3 rounded-2xl bg-surface-tertiary border border-border-subtle">
                        <CalendarDays className="w-4 h-4 text-[var(--v-text-muted)] shrink-0" />
                        <span className="text-[12px] font-black text-text-primary tabular-nums">{partner.eventsCount} Events</span>
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-2xl bg-surface-tertiary border border-border-subtle">
                        <Star className="w-4 h-4 text-[var(--v-text-muted)] shrink-0" />
                        <span className="text-[12px] font-black text-text-primary tabular-nums">{partner.followersCount} Fans</span>
                    </div>
                </div>

                {/* Action */}
                {partner.connectionStatus === "approved" ? (
                    <div className="flex items-center justify-center gap-2 h-11 rounded-2xl text-[12px] font-black uppercase tracking-widest"
                        style={{ background: "var(--v-success-bg)", color: "var(--v-success)", border: "1px solid var(--v-success)20" }}>
                        <CheckCircle2 className="w-4 h-4" /> Connected
                    </div>
                ) : partner.connectionStatus === "pending" ? (
                    <div className="flex items-center justify-center gap-2 h-11 rounded-2xl text-[12px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-500/60 border border-amber-500/10 cursor-not-allowed">
                        <Clock className="w-4 h-4" /> Request Pending
                    </div>
                ) : partner.connectionStatus === "rejected" ? (
                    <div className="flex items-center justify-center gap-2 h-11 rounded-2xl text-[12px] font-black uppercase tracking-widest bg-surface-tertiary text-text-tertiary border border-border-subtle">
                        <XCircle className="w-4 h-4" /> Rejected
                    </div>
                ) : (
                    <button
                        onClick={onAction}
                        disabled={isActionLoading}
                        className="w-full flex items-center justify-center gap-2.5 h-11 rounded-2xl text-[12px] font-black uppercase tracking-widest bg-[var(--v-orange)]/10 hover:bg-[var(--v-orange)] text-[var(--v-orange)] hover:text-white border border-[var(--v-orange)]/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isActionLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                <Send className="w-4 h-4" /> Request Access
                            </>
                        )}
                    </button>
                )}
            </div>
        </motion.div>
    );
}
