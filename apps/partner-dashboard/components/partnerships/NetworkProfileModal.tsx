"use client";

import { useState, useEffect } from "react";
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
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";

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
    photoURL?: string | null;
    coverURL?: string | null;
    connectionStatus?: "pending" | "approved" | "active" | "rejected" | "blocked" | null;
    // Venue-specific
    capacity?: number;
    operatingHours?: string;
    soundSystem?: string;
    musicPolicy?: string;
    eventsCount?: number;
    hostsConnected?: number;
    promotersConnected?: number;
    ticketsSold?: number;
    // Agent-specific
    avgCrowdSize?: number;
    audienceDemographic?: string;
    noShowRate?: number;
    totalRevenueGenerated?: number;
}

interface NetworkProfileModalProps {
    profile: NetworkProfile;
    onClose: () => void;
    onRequestPartnership?: (id: string) => void;
    isRequestLoading?: boolean;
}

interface LiveVenueStats {
    eventsHosted: number;
    ticketsSold: number;
    hostsConnected: number;
    promotersConnected: number;
}

interface LiveHostStats {
    eventsHosted: number;
    ticketsSold: number;
    venuesConnected: number;
    promotersConnected: number;
}

export function NetworkProfileModal({
    profile,
    onClose,
    onRequestPartnership,
    isRequestLoading,
}: NetworkProfileModalProps) {
    const { user } = useDashboardAuth();
    const isVenue = profile.type === "venue";
    const isHost  = profile.type === "host";
    const isConnected =
        profile.connectionStatus === "approved" || profile.connectionStatus === "active";
    const isPending = profile.connectionStatus === "pending";

    const [liveStats,     setLiveStats]     = useState<LiveVenueStats | null>(null);
    const [liveHostStats, setLiveHostStats] = useState<LiveHostStats | null>(null);
    const [statsLoading,  setStatsLoading]  = useState(false);

    // Fresh profile data — photo/cover/bio may be stale in the discovery list
    const [freshProfile, setFreshProfile] = useState<Partial<NetworkProfile>>({});
    const [profileLoading, setProfileLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        const fetchFreshProfile = async () => {
            setProfileLoading(true);
            try {
                const token = await user.getIdToken();
                const headers = { Authorization: `Bearer ${token}` };

                if (isHost) {
                    const res = await fetch(`/api/partners/hosts/profile?hostId=${profile.id}`, { headers });
                    if (res.ok && !cancelled) {
                        const json = await res.json();
                        const p = json.profile;
                        if (p) setFreshProfile({
                            name:     p.displayName || undefined,
                            city:     p.city        || undefined,
                            bio:      p.bio         || undefined,
                            photoURL: p.photoURL    || undefined,
                            coverURL: p.coverURL    || p.backdropURL || undefined,
                            instagram: p.socialLinks?.instagram || undefined,
                        });
                    }
                } else if (isVenue) {
                    const res = await fetch(`/api/partners/venues/profile?venueId=${profile.id}`, { headers });
                    if (res.ok && !cancelled) {
                        const json = await res.json();
                        const p = json.profile;
                        if (p) setFreshProfile({
                            name:     p.displayName || undefined,
                            city:     p.city        || undefined,
                            bio:      p.bio         || undefined,
                            photoURL: p.photoURL    || undefined,
                            coverURL: p.coverURL    || p.backdropURL || undefined,
                            instagram: p.socialLinks?.instagram || undefined,
                        });
                    }
                }
            } catch {
                // silently fall back to discovery data
            } finally {
                if (!cancelled) setProfileLoading(false);
            }
        };
        fetchFreshProfile();
        return () => { cancelled = true; };
    }, [profile.id, isHost, isVenue, user]);

    // Merge fresh data over stale discovery data
    const p = { ...profile, ...freshProfile };

    // ── Live venue stats ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!isVenue || !user) return;
        let cancelled = false;
        const fetchVenueStats = async () => {
            setStatsLoading(true);
            try {
                const token = await user.getIdToken();
                const headers = { Authorization: `Bearer ${token}` };

                const [eventsRes, connectionsRes, summaryRes] = await Promise.allSettled([
                    fetch(`/api/partners/venues/events?venueId=${profile.id}&limit=200`, { headers }),
                    fetch(`/api/discovery?action=list&partnerId=${profile.id}&role=venue`, { headers }),
                    fetch(`/api/partners/venues/overview/summary?venueId=${profile.id}`, { headers }),
                ]);

                const eventsData      = eventsRes.status === "fulfilled"      && eventsRes.value.ok      ? await eventsRes.value.json()      : null;
                const connectionsData = connectionsRes.status === "fulfilled"  && connectionsRes.value.ok ? await connectionsRes.value.json() : null;
                const summaryData     = summaryRes.status === "fulfilled"      && summaryRes.value.ok     ? await summaryRes.value.json()     : null;

                const active: any[] = (connectionsData?.connections ?? []).filter(
                    (c: any) => c.status === "approved" || c.status === "active"
                );

                if (!cancelled) {
                    setLiveStats({
                        eventsHosted:       Array.isArray(eventsData?.events) ? eventsData.events.length : 0,
                        ticketsSold:        summaryData?.totalGuestProfiles ?? 0,
                        hostsConnected:     active.filter((c: any) => c.otherType === "host").length,
                        promotersConnected: active.filter((c: any) => c.otherType === "promoter").length,
                    });
                }
            } catch {
                // leave liveStats null — tiles will be hidden
            } finally {
                if (!cancelled) setStatsLoading(false);
            }
        };
        fetchVenueStats();
        return () => { cancelled = true; };
    }, [isVenue, profile.id, user]);

    // ── Live host stats ───────────────────────────────────────────────────────
    useEffect(() => {
        if (!isHost || !user) return;
        let cancelled = false;
        const fetchHostStats = async () => {
            setStatsLoading(true);
            try {
                const token = await user.getIdToken();
                const headers = { Authorization: `Bearer ${token}` };

                const [summaryRes, connectionsRes] = await Promise.allSettled([
                    fetch(`/api/partners/hosts/overview/summary?hostId=${profile.id}`, { headers }),
                    fetch(`/api/discovery?action=list&partnerId=${profile.id}&role=host`, { headers }),
                ]);

                const summaryData     = summaryRes.status === "fulfilled"     && summaryRes.value.ok     ? await summaryRes.value.json()     : null;
                const connectionsData = connectionsRes.status === "fulfilled" && connectionsRes.value.ok ? await connectionsRes.value.json() : null;

                const active: any[] = (connectionsData?.connections ?? []).filter(
                    (c: any) => c.status === "approved" || c.status === "active"
                );

                if (!cancelled) {
                    setLiveHostStats({
                        eventsHosted:       summaryData?.summary?.upcomingEvents?.length ?? (profile.eventsCount ?? 0),
                        ticketsSold:        summaryData?.summary?.totalTicketsSold ?? 0,
                        venuesConnected:    summaryData?.summary?.activeVenuePartnerships ?? active.filter((c: any) => c.otherType === "venue").length,
                        promotersConnected: summaryData?.summary?.activePromoterPartnerships ?? active.filter((c: any) => c.otherType === "promoter").length,
                    });
                }
            } catch {
                // leave liveHostStats null — fall back to profile fields
            } finally {
                if (!cancelled) setStatsLoading(false);
            }
        };
        fetchHostStats();
        return () => { cancelled = true; };
    }, [isHost, profile.id, user]);

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
                <div className="relative h-40 bg-[#111113] rounded-t-[2.5rem] overflow-hidden shrink-0">
                    {p.coverURL ? (
                        <img src={p.coverURL} alt="cover" className="absolute inset-0 w-full h-full object-cover" />
                    ) : profileLoading ? (
                        <div className="absolute inset-0 bg-surface-secondary animate-pulse" />
                    ) : (
                        <>
                            <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/40 via-purple-600/20 to-transparent opacity-60" />
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,_rgba(244,74,34,0.15),_transparent_50%)]" />
                        </>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#111113]/80 via-transparent to-transparent" />

                    <button
                        onClick={onClose}
                        className="absolute top-5 right-5 p-2 bg-black/40 backdrop-blur-xl rounded-full text-white/80 border border-white/10 hover:bg-black/60 transition-all z-10"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="absolute top-5 left-5">
                        <span className="px-3.5 py-1.5 rounded-full text-[11px] font-black tracking-widest bg-white/10 backdrop-blur-xl border border-white/10 text-white uppercase shadow-2xl">
                            {p.type}
                        </span>
                    </div>
                </div>

                {/* Avatar row */}
                <div className="px-8 -mt-12 flex items-end justify-between mb-8 relative z-10">
                    <div className="w-24 h-24 rounded-3xl border-4 border-surface-elevated shadow-2xl overflow-hidden bg-gradient-to-br from-surface-elevated to-surface-secondary flex items-center justify-center">
                        {profileLoading ? (
                            <div className="w-full h-full bg-surface-secondary animate-pulse" />
                        ) : p.photoURL ? (
                            <img src={p.photoURL} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-4xl font-black text-white uppercase drop-shadow-md">{p.name[0]}</span>
                        )}
                    </div>
                    {p.isVerified && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-accent-glow rounded-2xl border border-accent-primary/20 shadow-lg shadow-accent-primary/5">
                            <ShieldCheck className="w-4 h-4 text-accent-primary" />
                            <span className="text-[12px] font-black uppercase tracking-tight text-accent-primary">Verified</span>
                        </div>
                    )}
                </div>

                <div className="px-8 pb-8 space-y-8">
                    {/* Identity */}
                    <div>
                        <h2 className="text-headline-sm font-bold text-text-primary">{p.name}</h2>
                        <div className="flex flex-wrap items-center gap-4 mt-2">
                            {p.city && (
                                <span className="flex items-center gap-1.5 text-body-sm text-text-tertiary">
                                    <MapPin className="w-4 h-4" /> {p.city}
                                </span>
                            )}
                            {p.instagram && (
                                <a
                                    href={`https://instagram.com/${p.instagram.replace("@", "")}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-body-sm text-text-tertiary hover:text-accent-primary transition-colors"
                                >
                                    <Instagram className="w-4 h-4" /> {p.instagram}
                                </a>
                            )}
                            {p.phone && (
                                <span className="flex items-center gap-1.5 text-body-sm text-text-tertiary">
                                    <Phone className="w-4 h-4" /> {p.phone}
                                </span>
                            )}
                        </div>
                        {p.bio && (
                            <p className="text-body text-text-secondary mt-4 leading-relaxed">{p.bio}</p>
                        )}
                    </div>

                    {/* Venue stats — fetched live */}
                    {isVenue && (
                        <div className="animate-in slide-in-from-bottom-2 duration-500 delay-150 fill-mode-both">
                            <h3 className="text-[11px] font-black text-text-muted uppercase tracking-[0.2em] mb-5 px-1">
                                Venue Stats
                            </h3>
                            {statsLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    <MetricTile
                                        icon={<Calendar className="w-4 h-4 text-indigo-400" />}
                                        label="Events Hosted"
                                        value={String(liveStats?.eventsHosted ?? 0)}
                                        bgClass="bg-indigo-400/5 border-indigo-400/10"
                                    />
                                    <MetricTile
                                        icon={<Users className="w-4 h-4 text-emerald-400" />}
                                        label="Tickets Sold"
                                        value={String(liveStats?.ticketsSold ?? 0)}
                                        bgClass="bg-emerald-400/5 border-emerald-400/10"
                                    />
                                    <MetricTile
                                        icon={<Users className="w-4 h-4 text-blue-400" />}
                                        label="Hosts Connected"
                                        value={String(liveStats?.hostsConnected ?? 0)}
                                        bgClass="bg-blue-400/5 border-blue-400/10"
                                    />
                                    <MetricTile
                                        icon={<Users className="w-4 h-4 text-purple-400" />}
                                        label="Promoters"
                                        value={String(liveStats?.promotersConnected ?? 0)}
                                        bgClass="bg-purple-400/5 border-purple-400/10"
                                    />
                                    {p.capacity !== undefined && (
                                        <MetricTile
                                            icon={<Users className="w-4 h-4 text-sky-400" />}
                                            label="Capacity"
                                            value={p.capacity.toLocaleString()}
                                            bgClass="bg-sky-400/5 border-sky-400/10"
                                        />
                                    )}
                                    {p.operatingHours && (
                                        <MetricTile
                                            icon={<Clock className="w-4 h-4 text-amber-400" />}
                                            label="Hours"
                                            value={p.operatingHours}
                                            bgClass="bg-amber-400/5 border-amber-400/10"
                                        />
                                    )}
                                    {p.soundSystem && (
                                        <MetricTile
                                            icon={<Volume2 className="w-4 h-4 text-purple-400" />}
                                            label="Sound System"
                                            value={p.soundSystem}
                                            bgClass="bg-purple-400/5 border-purple-400/10"
                                        />
                                    )}
                                    {p.musicPolicy && (
                                        <MetricTile
                                            icon={<Music className="w-4 h-4 text-rose-400" />}
                                            label="Music Policy"
                                            value={p.musicPolicy}
                                            bgClass="bg-rose-400/5 border-rose-400/10"
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Host live stats */}
                    {isHost && (
                        <div className="animate-in slide-in-from-bottom-2 duration-500 delay-150 fill-mode-both">
                            <h3 className="text-[11px] font-black text-text-muted uppercase tracking-[0.2em] mb-5 px-1">
                                Performance Metrics
                            </h3>
                            {statsLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    <MetricTile
                                        icon={<Calendar className="w-4 h-4 text-indigo-400" />}
                                        label="Events Hosted"
                                        value={String(liveHostStats?.eventsHosted ?? p.eventsCount ?? 0)}
                                        bgClass="bg-indigo-400/5 border-indigo-400/10"
                                    />
                                    <MetricTile
                                        icon={<Users className="w-4 h-4 text-emerald-400" />}
                                        label="Tickets Sold"
                                        value={String(liveHostStats?.ticketsSold ?? 0)}
                                        bgClass="bg-emerald-400/5 border-emerald-400/10"
                                    />
                                    <MetricTile
                                        icon={<Users className="w-4 h-4 text-amber-400" />}
                                        label="Venues Connected"
                                        value={String(liveHostStats?.venuesConnected ?? 0)}
                                        bgClass="bg-amber-400/5 border-amber-400/10"
                                    />
                                    <MetricTile
                                        icon={<Users className="w-4 h-4 text-purple-400" />}
                                        label="Promoters"
                                        value={String(liveHostStats?.promotersConnected ?? 0)}
                                        bgClass="bg-purple-400/5 border-purple-400/10"
                                    />
                                    {p.avgCrowdSize !== undefined && (
                                        <MetricTile
                                            icon={<Users className="w-4 h-4 text-sky-400" />}
                                            label="Avg Crowd Size"
                                            value={String(p.avgCrowdSize)}
                                            bgClass="bg-sky-400/5 border-sky-400/10"
                                        />
                                    )}
                                    {p.noShowRate !== undefined && (
                                        <MetricTile
                                            icon={<TrendingDown className="w-4 h-4 text-rose-400" />}
                                            label="No-Show Rate"
                                            value={`${p.noShowRate}%`}
                                            bgClass="bg-rose-400/5 border-rose-400/10"
                                            valueClass={p.noShowRate <= 10 ? "text-accent-primary" : "text-rose-500"}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Promoter performance metrics (static) */}
                    {p.type === "promoter" && (
                        <div className="animate-in slide-in-from-bottom-2 duration-500 delay-150 fill-mode-both">
                            <h3 className="text-[11px] font-black text-text-muted uppercase tracking-[0.2em] mb-5 px-1">
                                Performance Metrics
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                {p.eventsCount !== undefined && (
                                    <MetricTile
                                        icon={<Calendar className="w-4 h-4 text-indigo-400" />}
                                        label="Total Events"
                                        value={String(p.eventsCount)}
                                        bgClass="bg-indigo-400/5 border-indigo-400/10"
                                    />
                                )}
                                {p.avgCrowdSize !== undefined && (
                                    <MetricTile
                                        icon={<Users className="w-4 h-4 text-emerald-400" />}
                                        label="Avg Crowd Size"
                                        value={String(p.avgCrowdSize)}
                                        bgClass="bg-emerald-400/5 border-emerald-400/10"
                                    />
                                )}
                                {p.noShowRate !== undefined && (
                                    <MetricTile
                                        icon={<TrendingDown className="w-4 h-4 text-rose-400" />}
                                        label="No-Show Rate"
                                        value={`${p.noShowRate}%`}
                                        bgClass="bg-rose-400/5 border-rose-400/10"
                                        valueClass={p.noShowRate <= 10 ? "text-accent-primary" : "text-rose-500"}
                                    />
                                )}
                                {p.audienceDemographic && (
                                    <MetricTile
                                        icon={<Users className="w-4 h-4 text-sky-400" />}
                                        label="Audience"
                                        value={p.audienceDemographic}
                                        bgClass="bg-sky-400/5 border-sky-400/10"
                                    />
                                )}
                                {p.totalRevenueGenerated !== undefined && (
                                    <MetricTile
                                        icon={<TrendingDown className="w-4 h-4 rotate-180 text-orange-400" />}
                                        label="Revenue Generated"
                                        value={`₹${(p.totalRevenueGenerated / 1000).toFixed(0)}K`}
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
                                    onClick={() => onRequestPartnership(p.id)}
                                    disabled={isRequestLoading}
                                    className="w-full group relative overflow-hidden py-4.5 bg-accent-primary text-text-inverse rounded-2xl text-[13px] font-black uppercase tracking-widest shadow-2xl shadow-accent-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
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
    bgClass = "bg-surface-secondary border-border-subtle",
    valueClass = "text-text-primary",
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    bgClass?: string;
    valueClass?: string;
}) {
    return (
        <div className={`p-4 rounded-3xl border transition-all hover:shadow-lg hover:bg-opacity-10 backdrop-blur-sm ${bgClass}`}>
            <div className="flex items-center gap-2 mb-2 text-text-tertiary">
                <div className="p-1.5 rounded-lg bg-white/5">
                    {icon}
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">{label}</span>
            </div>
            <p className={`text-title-sm font-black tracking-tight ${valueClass}`}>{value}</p>
        </div>
    );
}
