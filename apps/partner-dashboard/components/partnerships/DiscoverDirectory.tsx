"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Search,
    RefreshCw,
    Users,
    XCircle,
    Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { BasePartnerCard } from "@/components/partnerships/BasePartnerCard";
import { useRouter } from "next/navigation";

type PartnerFilterType = "host" | "venue" | "promoter" | "all";

interface DiscoveredPartner {
    id: string;
    type: "host" | "venue" | "promoter";
    name: string;
    avatar?: string | null;
    city: string;
    bio: string;
    tags: string[];
    eventsCount: number;
    followersCount: number;
    isVerified: boolean;
    connectionStatus: "pending" | "approved" | "rejected" | "blocked" | "active" | null;
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
    onOpenProfile?: (partner: DiscoveredPartner) => void;
}

export function DiscoverDirectory({ allowedTypes, partnerId, role, onOpenProfile }: DiscoverDirectoryProps) {
    const { profile, user } = useDashboardAuth();
    const router = useRouter();
    const [partners, setPartners] = useState<DiscoveredPartner[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState<PartnerFilterType>(
        allowedTypes.includes("all") || allowedTypes.length > 1 ? "all" : allowedTypes[0]
    );
    const [filterCity, setFilterCity] = useState("");
    const [requestingId, setRequestingId] = useState<string | null>(null);

    const fetchPartners = useCallback(async () => {
        if (!partnerId) return;
        setLoading(true);
        setError(null);
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
            if (!res.ok) throw new Error(`Discovery failed: ${res.statusText}`);
            const data = await res.json();
            setPartners(data.partners || []);
        } catch (err: any) {
            console.error("DiscoverDirectory fetch error:", err);
            setError(err.message || "Failed to load discovery directory");
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
            await fetchPartners();
        } catch (err) {
            console.error(err);
            alert("Failed to send partnership request. Please try again.");
        } finally {
            setRequestingId(null);
        }
    };

    const openProfile = (partner: DiscoveredPartner) => {
        if (onOpenProfile) {
            onOpenProfile(partner);
            return;
        }
        const basePath =
            role === "host"
                ? "/host/partners"
                : role === "promoter"
                ? "/promoter/partners"
                : "/venue/partners";
        router.push(`${basePath}/${partner.id}`);
    };

    return (
        <div className="space-y-5 animate-in fade-in duration-500">
            {/* Search bar */}
            <div className="flex flex-col gap-3 rounded-[28px] border border-border-default bg-[rgba(255,255,255,0.02)] p-3 md:flex-row md:items-center">
                <div className="flex-1 relative group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-text-tertiary group-focus-within:text-text-primary transition-colors" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name, city, genre..."
                        className="h-14 w-full rounded-full bg-[#06090a] border-none pl-14 pr-4 text-[18px] font-medium text-text-primary placeholder:text-text-placeholder focus:outline-none"
                    />
                </div>
                <div className="flex shrink-0 gap-2">
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as PartnerFilterType)}
                        className="h-14 rounded-[20px] border border-border-default bg-transparent px-5 pr-10 text-[16px] font-semibold text-text-secondary transition-colors hover:bg-white/[0.03] focus:outline-none cursor-pointer"
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
                        className="h-14 rounded-[20px] border border-border-default bg-transparent px-5 pr-10 text-[16px] font-semibold text-text-secondary transition-colors hover:bg-white/[0.03] focus:outline-none cursor-pointer"
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
                        className="inline-flex h-14 w-14 items-center justify-center rounded-[20px] border border-border-default bg-transparent text-text-tertiary transition-all hover:border-border-strong hover:bg-white/[0.03] hover:text-text-primary active:scale-95"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div
                            key={i}
                            className="h-72 bg-surface-secondary rounded-[2rem] animate-pulse border border-border-subtle"
                        />
                    ))}
                </div>
            ) : error ? (
                <div className="py-24 bg-surface-elevated rounded-[3rem] border border-dashed border-error/50 flex flex-col items-center text-center px-10">
                    <div className="w-16 h-16 bg-error/10 rounded-2xl flex items-center justify-center mb-5">
                        <XCircle className="w-8 h-8 text-error" />
                    </div>
                    <h4 className="text-title font-semibold text-text-primary">Discovery Unavailable</h4>
                    <p className="text-body-sm text-text-tertiary mt-1 max-w-xs">{error}</p>
                    <button 
                        onClick={() => fetchPartners()}
                        className="mt-6 px-6 py-2 bg-surface-secondary hover:bg-surface-tertiary rounded-xl text-caption font-bold transition-all flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" /> Try Again
                    </button>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    <AnimatePresence>
                        {partners.map((partner) => (
                            <BasePartnerCard
                                key={partner.id}
                                partner={partner as any}
                                onViewProfile={() => openProfile(partner)}
                                onPrimaryAction={() => handleRequestPartnership(partner.id)}
                                isActionLoading={requestingId === partner.id}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
