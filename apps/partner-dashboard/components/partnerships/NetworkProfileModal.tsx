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
                className="bg-[var(--bg-elevated)] border border-[var(--border-default)] w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-[0_32px_80px_rgba(0,0,0,0.25)]"
            >
                {/* Cover */}
                <div className="relative h-40 bg-[#111113] rounded-t-[2.5rem] overflow-hidden shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/40 via-purple-600/20 to-transparent opacity-60" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,_rgba(244,74,34,0.15),_transparent_50%)]" />
                    
                    <button
                        onClick={onClose}
                        className="absolute top-5 right-5 p-2 bg-black/40 backdrop-blur-xl rounded-full text-white/80 border border-white/10 hover:bg-black/60 transition-all z-10"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="absolute top-5 left-5">
                        <span className="px-3.5 py-1.5 rounded-full text-[11px] font-black tracking-widest bg-white/10 backdrop-blur-xl border border-white/10 text-white uppercase shadow-2xl">
                            {profile.type}
                        </span>
                    </div>
                </div>

                {/* Avatar row */}
                <div className="px-8 -mt-12 flex items-end justify-between mb-8 relative z-10">
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-surface-elevated to-surface-secondary border-4 border-surface-elevated flex items-center justify-center text-4xl font-black text-white shadow-2xl uppercase overflow-hidden relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-accent-primary to-orange-600 opacity-20 group-hover:opacity-30 transition-opacity" />
                        <span className="relative z-10 drop-shadow-md">{profile.name[0]}</span>
                    </div>
                    {profile.isVerified && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-accent-glow rounded-2xl border border-accent-primary/20 shadow-lg shadow-accent-primary/5">
                            <ShieldCheck className="w-4 h-4 text-accent-primary" />
                            <span className="text-[12px] font-black uppercase tracking-tight text-accent-primary">Verified</span>
                        </div>
                    )}
                </div>

                <div className="px-8 pb-8 space-y-8">
                    {/* Identity */}
                    <div>
                        <h2 className="text-headline-sm font-bold text-[var(--text-primary)]">{profile.name}</h2>
                        <div className="flex flex-wrap items-center gap-4 mt-2">
                            <span className="flex items-center gap-1.5 text-body-sm text-[var(--text-tertiary)]">
                                <MapPin className="w-4 h-4" /> {profile.city}
                            </span>
                            {profile.instagram && (
                                <a
                                    href={`https://instagram.com/${profile.instagram.replace("@", "")}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-body-sm text-[var(--text-tertiary)] hover:text-accent-primary transition-colors"
                                >
                                    <Instagram className="w-4 h-4" /> {profile.instagram}
                                </a>
                            )}
                            {profile.phone && (
                                <span className="flex items-center gap-1.5 text-body-sm text-[var(--text-tertiary)]">
                                    <Phone className="w-4 h-4" /> {profile.phone}
                                </span>
                            )}
                        </div>
                        {profile.bio && (
                            <p className="text-body text-[var(--text-secondary)] mt-4 leading-relaxed">{profile.bio}</p>
                        )}
                    </div>

                    {/* Venue specs */}
                    {isVenue && (
                        <div className="animate-in slide-in-from-bottom-2 duration-500 delay-150 fill-mode-both">
                            <h3 className="text-[11px] font-black text-[var(--text-tertiary)] uppercase tracking-[0.2em] mb-5 px-1">
                                Venue Specs
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                {profile.capacity !== undefined && (
                                    <MetricTile
                                        icon={<Users className="w-4 h-4 text-blue-400" />}
                                        label="Capacity"
                                        value={profile.capacity.toLocaleString()}
                                        bgClass="bg-blue-400/5 border-blue-400/10"
                                    />
                                )}
                                {profile.operatingHours && (
                                    <MetricTile
                                        icon={<Clock className="w-4 h-4 text-amber-400" />}
                                        label="Hours"
                                        value={profile.operatingHours}
                                        bgClass="bg-amber-400/5 border-amber-400/10"
                                    />
                                )}
                                {profile.soundSystem && (
                                    <MetricTile
                                        icon={<Volume2 className="w-4 h-4 text-purple-400" />}
                                        label="Sound System"
                                        value={profile.soundSystem}
                                        bgClass="bg-purple-400/5 border-purple-400/10"
                                    />
                                )}
                                {profile.musicPolicy && (
                                    <MetricTile
                                        icon={<Music className="w-4 h-4 text-rose-400" />}
                                        label="Music Policy"
                                        value={profile.musicPolicy}
                                        bgClass="bg-rose-400/5 border-rose-400/10"
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {/* Agent performance metrics */}
                    {isAgent && (
                        <div className="animate-in slide-in-from-bottom-2 duration-500 delay-150 fill-mode-both">
                            <h3 className="text-[11px] font-black text-[var(--text-tertiary)] uppercase tracking-[0.2em] mb-5 px-1">
                                Performance Metrics
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                {profile.eventsCount !== undefined && (
                                    <MetricTile
                                        icon={<Calendar className="w-4 h-4 text-indigo-400" />}
                                        label="Total Events"
                                        value={String(profile.eventsCount)}
                                        bgClass="bg-indigo-400/5 border-indigo-400/10"
                                    />
                                )}
                                {profile.avgCrowdSize !== undefined && (
                                    <MetricTile
                                        icon={<Users className="w-4 h-4 text-emerald-400" />}
                                        label="Avg Crowd Size"
                                        value={String(profile.avgCrowdSize)}
                                        bgClass="bg-emerald-400/5 border-emerald-400/10"
                                    />
                                )}
                                {profile.noShowRate !== undefined && (
                                    <MetricTile
                                        icon={<TrendingDown className="w-4 h-4 text-rose-400" />}
                                        label="No-Show Rate"
                                        value={`${profile.noShowRate}%`}
                                        bgClass="bg-rose-400/5 border-rose-400/10"
                                        valueClass={
                                            profile.noShowRate <= 10
                                                ? "text-accent-primary"
                                                : "text-rose-500"
                                        }
                                    />
                                )}
                                {profile.audienceDemographic && (
                                    <MetricTile
                                        icon={<Users className="w-4 h-4 text-sky-400" />}
                                        label="Audience"
                                        value={profile.audienceDemographic}
                                        bgClass="bg-sky-400/5 border-sky-400/10"
                                    />
                                )}
                                {profile.totalRevenueGenerated !== undefined && (
                                    <MetricTile
                                        icon={<TrendingDown className="w-4 h-4 rotate-180 text-orange-400" />}
                                        label="Revenue Generated"
                                        value={`₹${(profile.totalRevenueGenerated / 1000).toFixed(0)}K`}
                                        bgClass="bg-orange-400/5 border-orange-400/10"
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {/* CTA */}
                    {onRequestPartnership && (
                        <div className="pt-4">
                            {isConnected ? (
                                <div className="w-full py-4 bg-emerald-500/10 rounded-2xl text-center text-[13px] font-black tracking-wide text-emerald-400 border border-emerald-500/20 flex items-center justify-center gap-2">
                                    <ShieldCheck className="w-4 h-4" /> PARTNERSHIP ACTIVE
                                </div>
                            ) : isPending ? (
                                <div className="w-full py-4 bg-amber-500/10 rounded-2xl text-center text-[13px] font-black tracking-wide text-amber-500 border border-amber-500/20 flex items-center justify-center gap-2">
                                    <Clock className="w-4 h-4" /> REQUEST PENDING
                                </div>
                            ) : (
                                <button
                                    onClick={() => onRequestPartnership(profile.id)}
                                    disabled={isRequestLoading}
                                    className="w-full group relative overflow-hidden py-4.5 bg-accent-primary text-white rounded-2xl text-[13px] font-black uppercase tracking-widest shadow-2xl shadow-accent-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:animate-shimmer" />
                                    {isRequestLoading ? (
                                        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                                    ) : (
                                        <div className="flex items-center justify-center gap-3">
                                            <Send className="w-4 h-4 rotate-12 group-hover:rotate-0 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                            Request Partnership
                                        </div>
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
    bgClass = "bg-[var(--bg-fill)] border-[var(--border-subtle)]",
    valueClass = "text-[var(--text-primary)]",
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    bgClass?: string;
    valueClass?: string;
}) {
    return (
        <div className={`p-4 rounded-3xl border transition-all hover:shadow-lg hover:bg-opacity-10 backdrop-blur-sm ${bgClass}`}>
            <div className="flex items-center gap-2 mb-2 text-[var(--text-tertiary)]">
                <div className="p-1.5 rounded-lg bg-white/5">
                    {icon}
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-tertiary)]">{label}</span>
            </div>
            <p className={`text-title-sm font-black tracking-tight ${valueClass}`}>{value}</p>
        </div>
    );
}
