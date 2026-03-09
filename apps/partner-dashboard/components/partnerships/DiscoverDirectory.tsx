"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Search,
    RefreshCw,
    Users,
    ShieldCheck,
    Zap,
    MapPin,
    CalendarDays,
    Clock,
    CheckCircle2,
    UserCircle,
    Building2,
    XCircle,
    Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { NetworkProfileModal, NetworkProfile } from "@/components/partnerships/NetworkProfileModal";

type PartnerFilterType = "host" | "venue" | "promoter" | "all";

interface DiscoveredPartner {
    id: string;
    type: "host" | "venue" | "promoter";
    name: string;
    city: string;
    bio: string;
    tags: string[];
    eventsCount: number;
    followersCount: number;
    isVerified: boolean;
    connectionStatus: "pending" | "approved" | "rejected" | "blocked" | null;
    // Extended fields
    capacity?: number;
    operatingHours?: string;
    soundSystem?: string;
    musicPolicy?: string;
    avgCrowdSize?: number;
    audienceDemographic?: string;
    noShowRate?: number;
    instagram?: string;
    phone?: string;
}

interface DiscoverDirectoryProps {
    allowedTypes: PartnerFilterType[];
    partnerId: string | undefined;
    role: string;
}

export function DiscoverDirectory({ allowedTypes, partnerId, role }: DiscoverDirectoryProps) {
    const { profile, user } = useDashboardAuth();
    const [partners, setPartners] = useState<DiscoveredPartner[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState<PartnerFilterType>(
        allowedTypes.includes("all") ? "all" : allowedTypes[0]
    );
    const [filterCity, setFilterCity] = useState("");
    const [selectedProfile, setSelectedProfile] = useState<NetworkProfile | null>(null);
    const [requestingId, setRequestingId] = useState<string | null>(null);

    const fetchPartners = useCallback(async () => {
        if (!partnerId) return;
        setLoading(true);
        try {
            const token = await user?.getIdToken();
            const params = new URLSearchParams({
                partnerId,
                role,
                action: "discover",
                limit: "30",
            });
            if (filterType !== "all") params.set("type", filterType);
            if (filterCity) params.set("city", filterCity);
            if (searchQuery) params.set("search", searchQuery);

            const res = await fetch(`/api/discovery?${params}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            setPartners(data.partners || []);
        } catch (err) {
            console.error("DiscoverDirectory fetch error:", err);
        } finally {
            setLoading(false);
        }
    }, [partnerId, role, user, filterType, filterCity, searchQuery]);

    useEffect(() => {
        if (partnerId) fetchPartners();
    }, [partnerId, fetchPartners]);

    const handleRequestPartnership = async (targetId: string) => {
        if (!partnerId) return;
        setRequestingId(targetId);
        try {
            const token = await user?.getIdToken();
            const target = partners.find((p) => p.id === targetId);
            const res = await fetch("/api/discovery", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    requesterId: partnerId,
                    requesterType: role,
                    requesterName:
                        profile?.activeMembership?.partnerName || profile?.displayName,
                    requesterEmail: profile?.email,
                    targetId,
                    targetType: target?.type,
                    targetName: target?.name,
                }),
            });
            if (!res.ok) throw new Error("Failed");
            // Refresh + close modal
            await fetchPartners();
            setSelectedProfile(null);
        } catch (err) {
            console.error(err);
            alert("Failed to send partnership request. Please try again.");
        } finally {
            setRequestingId(null);
        }
    };

    const openProfile = (partner: DiscoveredPartner) => {
        setSelectedProfile({
            id: partner.id,
            type: partner.type,
            name: partner.name,
            city: partner.city,
            bio: partner.bio,
            instagram: partner.instagram,
            phone: partner.phone,
            isVerified: partner.isVerified,
            connectionStatus: partner.connectionStatus,
            capacity: partner.capacity,
            operatingHours: partner.operatingHours,
            soundSystem: partner.soundSystem,
            musicPolicy: partner.musicPolicy,
            avgCrowdSize: partner.avgCrowdSize,
            audienceDemographic: partner.audienceDemographic,
            noShowRate: partner.noShowRate,
            eventsCount: partner.eventsCount,
        });
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Search bar */}
            <div className="flex flex-col md:flex-row gap-3 p-3 bg-surface-elevated/80 backdrop-blur-xl border border-border-default rounded-[2rem] shadow-sm">
                <div className="flex-1 relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary group-focus-within:text-text-primary transition-colors" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name, city, genre..."
                        className="w-full bg-transparent border-none rounded-2xl pl-11 pr-4 py-3 text-sm text-text-primary focus:outline-none font-medium placeholder:text-text-placeholder"
                    />
                </div>
                <div className="flex gap-2 shrink-0">
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as PartnerFilterType)}
                        className="pl-4 pr-8 py-2.5 bg-surface-secondary border border-border-default rounded-xl text-caption font-semibold text-text-secondary focus:outline-none cursor-pointer hover:bg-surface-tertiary transition-colors"
                    >
                        {allowedTypes.includes("all") && <option value="all">All Types</option>}
                        {allowedTypes.includes("venue") && <option value="venue">Venues</option>}
                        {allowedTypes.includes("host") && <option value="host">Hosts</option>}
                        {allowedTypes.includes("promoter") && (
                            <option value="promoter">Promoters</option>
                        )}
                    </select>
                    <select
                        value={filterCity}
                        onChange={(e) => setFilterCity(e.target.value)}
                        className="pl-4 pr-8 py-2.5 bg-surface-secondary border border-border-default rounded-xl text-caption font-semibold text-text-secondary focus:outline-none cursor-pointer hover:bg-surface-tertiary transition-colors"
                    >
                        <option value="">All Cities</option>
                        <option value="Pune">Pune</option>
                        <option value="Mumbai">Mumbai</option>
                        <option value="Goa">Goa</option>
                        <option value="Bengaluru">Bengaluru</option>
                        <option value="Delhi">Delhi</option>
                    </select>
                    <button
                        onClick={fetchPartners}
                        className="p-2.5 bg-surface-secondary border border-border-default rounded-xl text-text-tertiary hover:text-text-primary hover:border-border-strong transition-all active:scale-95"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div
                            key={i}
                            className="h-72 bg-surface-secondary rounded-[2rem] animate-pulse border border-border-subtle"
                        />
                    ))}
                </div>
            ) : partners.length === 0 ? (
                <div className="py-24 bg-surface-elevated rounded-[3rem] border border-dashed border-border-default flex flex-col items-center text-center px-10">
                    <div className="w-16 h-16 bg-surface-tertiary rounded-2xl flex items-center justify-center mb-5">
                        <Users className="w-8 h-8 text-text-placeholder" />
                    </div>
                    <h4 className="text-title font-semibold text-text-primary">No results found</h4>
                    <p className="text-body-sm text-text-tertiary mt-1 max-w-xs">
                        Try adjusting your filters or search query.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    <AnimatePresence>
                        {partners.map((partner) => (
                            <DirectoryCard
                                key={partner.id}
                                partner={partner}
                                onViewProfile={() => openProfile(partner)}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {/* Profile modal */}
            <AnimatePresence>
                {selectedProfile && (
                    <NetworkProfileModal
                        profile={selectedProfile}
                        onClose={() => setSelectedProfile(null)}
                        onRequestPartnership={handleRequestPartnership}
                        isRequestLoading={requestingId === selectedProfile.id}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

function DirectoryCard({
    partner,
    onViewProfile,
}: {
    partner: DiscoveredPartner;
    onViewProfile: () => void;
}) {
    const typeIcon =
        partner.type === "venue" ? (
            <Building2 className="w-4 h-4" />
        ) : partner.type === "host" ? (
            <UserCircle className="w-4 h-4" />
        ) : (
            <Zap className="w-4 h-4" />
        );

    const statusBadge = () => {
        switch (partner.connectionStatus) {
            case "approved":
            case "active":
                return (
                    <span className="flex items-center gap-1 text-label font-bold text-text-secondary">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Active
                    </span>
                );
            case "pending":
                return (
                    <span className="flex items-center gap-1 text-label font-bold text-text-tertiary">
                        <Clock className="w-3.5 h-3.5" /> Pending
                    </span>
                );
            case "rejected":
                return (
                    <span className="flex items-center gap-1 text-label font-bold text-text-placeholder">
                        <XCircle className="w-3.5 h-3.5" /> Declined
                    </span>
                );
            default:
                return null;
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="group bg-surface-elevated border border-border-default rounded-[2rem] overflow-hidden hover:border-border-strong hover:shadow-sm transition-all duration-300 flex flex-col"
        >
            {/* Card header strip */}
            <div className="h-2 bg-gradient-to-r from-accent-glow to-transparent" />

            <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-surface-secondary border border-border-subtle flex items-center justify-center text-xl font-black text-text-tertiary">
                            {partner.name[0]}
                        </div>
                        <div>
                            <h3 className="text-title font-bold text-text-primary leading-tight">
                                {partner.name}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-0.5 text-caption text-text-tertiary">
                                <MapPin className="w-3 h-3" /> {partner.city}
                            </div>
                        </div>
                    </div>
                    {partner.isVerified && (
                        <ShieldCheck className="w-4 h-4 text-text-tertiary shrink-0 mt-1" />
                    )}
                </div>

                {/* Type + status row */}
                <div className="flex items-center justify-between mb-4">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-secondary rounded-lg text-label font-bold text-text-secondary border border-border-subtle capitalize">
                        {typeIcon} {partner.type}
                    </span>
                    {statusBadge()}
                </div>

                {partner.bio && (
                    <p className="text-caption text-text-tertiary leading-relaxed line-clamp-2 mb-4">
                        {partner.bio}
                    </p>
                )}

                {/* Metrics row */}
                <div className="grid grid-cols-2 gap-2 mb-5 mt-auto">
                    <div className="flex items-center gap-2 p-2.5 bg-surface-secondary rounded-xl border border-border-subtle">
                        <CalendarDays className="w-3.5 h-3.5 text-text-tertiary" />
                        <span className="text-caption font-bold text-text-primary">
                            {partner.eventsCount} Events
                        </span>
                    </div>
                    <div className="flex items-center gap-2 p-2.5 bg-surface-secondary rounded-xl border border-border-subtle">
                        <Users className="w-3.5 h-3.5 text-text-tertiary" />
                        <span className="text-caption font-bold text-text-primary">
                            {partner.followersCount} Fans
                        </span>
                    </div>
                </div>

                <button
                    onClick={onViewProfile}
                    className="w-full py-3 bg-surface-secondary hover:bg-surface-tertiary border border-border-default hover:border-border-strong text-text-primary rounded-xl text-caption font-bold transition-all active:scale-[0.98]"
                >
                    View Profile
                </button>
            </div>
        </motion.div>
    );
}
