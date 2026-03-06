"use client";

import { motion } from "framer-motion";
import {
    X,
    MapPin,
    Instagram,
    Music,
    Users,
    Calendar,
    TrendingDown,
    Clock,
    Volume2,
    Send,
    ShieldCheck,
    Phone,
    Loader2,
} from "lucide-react";

type ProfileType = "venue" | "host" | "promoter";

export interface NetworkProfile {
    id: string;
    type: ProfileType;
    name: string;
    city: string;
    bio?: string;
    instagram?: string;
    spotify?: string;
    phone?: string;
    isVerified?: boolean;
    connectionStatus?: "pending" | "approved" | "active" | "rejected" | "blocked" | null;
    // Venue-specific
    capacity?: number;
    operatingHours?: string;
    soundSystem?: string;
    musicPolicy?: string;
    // Agent-specific
    avgCrowdSize?: number;
    audienceDemographic?: string;
    noShowRate?: number;
    totalRevenueGenerated?: number;
    eventsCount?: number;
}

interface NetworkProfileModalProps {
    profile: NetworkProfile;
    onClose: () => void;
    onRequestPartnership?: (id: string) => void;
    isRequestLoading?: boolean;
}

export function NetworkProfileModal({
    profile,
    onClose,
    onRequestPartnership,
    isRequestLoading,
}: NetworkProfileModalProps) {
    const isVenue = profile.type === "venue";
    const isAgent = profile.type === "host" || profile.type === "promoter";
    const isConnected =
        profile.connectionStatus === "approved" || profile.connectionStatus === "active";
    const isPending = profile.connectionStatus === "pending";

    return (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-[8px]">
            <motion.div
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 60, opacity: 0 }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                className="bg-surface-elevated border border-border-default w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-[0_32px_80px_rgba(0,0,0,0.25)]"
            >
                {/* Cover */}
                <div className="relative h-36 bg-gradient-to-br from-surface-tertiary to-surface-secondary rounded-t-[2.5rem] overflow-hidden shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-c1rcle-orange/10 to-border-subtle/20" />
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2.5 bg-surface-elevated/80 backdrop-blur-md rounded-xl text-text-primary border border-border-subtle hover:bg-surface-elevated transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="absolute top-4 left-4">
                        <span
                            className={`px-3 py-1.5 rounded-full text-label font-bold backdrop-blur-md border border-border-subtle/40 text-text-primary uppercase ${
                                profile.type === "venue"
                                    ? "bg-surface-secondary/80"
                                    : profile.type === "host"
                                    ? "bg-surface-secondary/80"
                                    : "bg-surface-secondary/80"
                            }`}
                        >
                            {profile.type}
                        </span>
                    </div>
                </div>

                {/* Avatar row */}
                <div className="px-8 -mt-10 flex items-end justify-between mb-6">
                    <div className="w-20 h-20 rounded-2xl bg-surface-base border-4 border-surface-elevated flex items-center justify-center text-3xl font-black text-text-tertiary shadow-lg uppercase">
                        {profile.name[0]}
                    </div>
                    {profile.isVerified && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-secondary rounded-xl border border-border-default">
                            <ShieldCheck className="w-4 h-4 text-text-secondary" />
                            <span className="text-label font-bold text-text-secondary">Verified</span>
                        </div>
                    )}
                </div>

                <div className="px-8 pb-8 space-y-8">
                    {/* Identity */}
                    <div>
                        <h2 className="text-headline-sm font-bold text-text-primary">{profile.name}</h2>
                        <div className="flex flex-wrap items-center gap-4 mt-2">
                            <span className="flex items-center gap-1.5 text-body-sm text-text-tertiary">
                                <MapPin className="w-4 h-4" /> {profile.city}
                            </span>
                            {profile.instagram && (
                                <a
                                    href={`https://instagram.com/${profile.instagram.replace("@", "")}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-body-sm text-text-tertiary hover:text-c1rcle-orange transition-colors"
                                >
                                    <Instagram className="w-4 h-4" /> {profile.instagram}
                                </a>
                            )}
                            {profile.phone && (
                                <span className="flex items-center gap-1.5 text-body-sm text-text-tertiary">
                                    <Phone className="w-4 h-4" /> {profile.phone}
                                </span>
                            )}
                        </div>
                        {profile.bio && (
                            <p className="text-body text-text-secondary mt-4 leading-relaxed">{profile.bio}</p>
                        )}
                    </div>

                    {/* Venue specs */}
                    {isVenue && (
                        <div>
                            <h3 className="text-label font-black text-text-tertiary uppercase tracking-widest mb-4">
                                Venue Specs
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                {profile.capacity !== undefined && (
                                    <MetricTile
                                        icon={<Users className="w-4 h-4" />}
                                        label="Capacity"
                                        value={profile.capacity.toLocaleString()}
                                    />
                                )}
                                {profile.operatingHours && (
                                    <MetricTile
                                        icon={<Clock className="w-4 h-4" />}
                                        label="Hours"
                                        value={profile.operatingHours}
                                    />
                                )}
                                {profile.soundSystem && (
                                    <MetricTile
                                        icon={<Volume2 className="w-4 h-4" />}
                                        label="Sound System"
                                        value={profile.soundSystem}
                                    />
                                )}
                                {profile.musicPolicy && (
                                    <MetricTile
                                        icon={<Music className="w-4 h-4" />}
                                        label="Music Policy"
                                        value={profile.musicPolicy}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {/* Agent performance metrics */}
                    {isAgent && (
                        <div>
                            <h3 className="text-label font-black text-text-tertiary uppercase tracking-widest mb-4">
                                Performance Metrics
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                {profile.eventsCount !== undefined && (
                                    <MetricTile
                                        icon={<Calendar className="w-4 h-4" />}
                                        label="Total Events"
                                        value={String(profile.eventsCount)}
                                    />
                                )}
                                {profile.avgCrowdSize !== undefined && (
                                    <MetricTile
                                        icon={<Users className="w-4 h-4" />}
                                        label="Avg Crowd Size"
                                        value={String(profile.avgCrowdSize)}
                                    />
                                )}
                                {profile.noShowRate !== undefined && (
                                    <MetricTile
                                        icon={<TrendingDown className="w-4 h-4" />}
                                        label="No-Show Rate"
                                        value={`${profile.noShowRate}%`}
                                        valueClass={
                                            profile.noShowRate <= 10
                                                ? "text-c1rcle-orange"
                                                : "text-red-500"
                                        }
                                    />
                                )}
                                {profile.audienceDemographic && (
                                    <MetricTile
                                        icon={<Users className="w-4 h-4" />}
                                        label="Audience"
                                        value={profile.audienceDemographic}
                                    />
                                )}
                                {profile.totalRevenueGenerated !== undefined && (
                                    <MetricTile
                                        icon={<TrendingDown className="w-4 h-4 rotate-180" />}
                                        label="Revenue Generated"
                                        value={`₹${(profile.totalRevenueGenerated / 1000).toFixed(0)}K`}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {/* CTA */}
                    {onRequestPartnership && (
                        <div className="pt-2">
                            {isConnected ? (
                                <div className="w-full py-4 bg-surface-secondary rounded-2xl text-center text-body-sm font-bold text-text-secondary border border-border-default">
                                    Partnership Active
                                </div>
                            ) : isPending ? (
                                <div className="w-full py-4 bg-surface-secondary rounded-2xl text-center text-body-sm font-bold text-text-tertiary border border-border-default">
                                    Request Pending
                                </div>
                            ) : (
                                <button
                                    onClick={() => onRequestPartnership(profile.id)}
                                    disabled={isRequestLoading}
                                    className="w-full py-4 bg-c1rcle-orange text-text-inverse rounded-2xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.99] disabled:opacity-40"
                                >
                                    {isRequestLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4" />
                                            Request Partnership
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}

function MetricTile({
    icon,
    label,
    value,
    valueClass = "text-text-primary",
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    valueClass?: string;
}) {
    return (
        <div className="p-4 bg-surface-secondary rounded-2xl border border-border-subtle">
            <div className="flex items-center gap-2 mb-1 text-text-tertiary">
                {icon}
                <span className="text-caption">{label}</span>
            </div>
            <p className={`text-title font-bold ${valueClass}`}>{value}</p>
        </div>
    );
}
