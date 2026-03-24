"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Building2,
    ChevronRight,
    CheckCircle2,
    Clock,
    Compass,
    TrendingUp,
    Users,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { VenuePageShell, VenueActionButton } from "@/components/venue-layout/VenuePageShell";
import { HubTabBar } from "@/components/shared/HubTabBar";
import { NetworkProfileModal, NetworkProfile } from "@/components/partnerships/NetworkProfileModal";
import { formatMonthYear } from "@/lib/utils/format";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VenuePartner {
    id: string;
    name: string;
    city: string;
    partnershipStatus: "active" | "pending";
    createdAt?: string;
}

// ─── Venue Card ───────────────────────────────────────────────────────────────

function VenueCard({
    venue,
    onViewProfile,
}: {
    venue: VenuePartner;
    onViewProfile: (v: VenuePartner) => void;
}) {
    const initials = venue.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="group relative overflow-hidden bg-surface-secondary dark:bg-[#121216] border border-border-subtle rounded-[2.5rem] p-7 hover:border-orange-500/30 transition-all duration-500 hover:shadow-2xl hover:shadow-orange-500/5"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

            {/* Header */}
            <div className="relative flex items-start gap-4 mb-6">
                <div className="relative shrink-0">
                    <div className="absolute inset-0 bg-orange-500/20 rounded-2xl blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative w-14 h-14 rounded-2xl bg-surface-tertiary border border-border-subtle flex items-center justify-center text-2xl font-black text-text-primary">
                        {initials}
                    </div>
                </div>
                <div className="min-w-0">
                    <h3 className="text-lg font-black text-text-primary tracking-tight group-hover:text-orange-500 transition-colors truncate">
                        {venue.name}
                    </h3>
                    <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-text-tertiary mt-1">
                        <div className="p-1 rounded bg-orange-500/10 text-orange-500">
                            <Building2 className="w-3 h-3" />
                        </div>
                        Venue{venue.city ? ` · ${venue.city}` : ""}
                    </span>
                </div>
            </div>

            {/* Status row */}
            <div className="relative flex items-center justify-between py-4 border-y border-border-subtle mb-6">
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-text-tertiary">
                    <Clock className="w-3.5 h-3.5 opacity-40" />
                    {venue.partnershipStatus === "active"
                        ? `Partner since ${formatMonthYear(venue.createdAt)}`
                        : `Requested ${formatMonthYear(venue.createdAt)}`}
                </span>
                {venue.partnershipStatus === "active" ? (
                    <span className="flex items-center gap-1.5 font-black text-[10px] uppercase tracking-widest text-orange-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" /> Active
                    </span>
                ) : (
                    <span className="flex items-center gap-1.5 font-black text-[10px] uppercase tracking-widest text-amber-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Pending
                    </span>
                )}
            </div>

            {/* Action */}
            {venue.partnershipStatus === "active" ? (
                <button
                    onClick={() => onViewProfile(venue)}
                    className="relative w-full py-3.5 bg-surface-secondary hover:bg-surface-tertiary border border-border-subtle rounded-2xl text-[11px] font-black uppercase tracking-widest text-text-primary transition-all flex items-center justify-center gap-2 group/btn"
                >
                    View Network Profile <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                </button>
            ) : (
                <div className="w-full py-3.5 bg-amber-500/5 border border-amber-500/10 rounded-2xl text-[11px] font-black uppercase tracking-widest text-amber-400/60 flex items-center justify-center gap-2 cursor-not-allowed">
                    <Clock className="w-4 h-4" /> Awaiting Response
                </div>
            )}
        </motion.div>
    );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ tab }: { tab: "active" | "pending" }) {
    return (
        <div className="py-32 relative overflow-hidden bg-surface-secondary dark:bg-[#0D0D0F] border border-dashed border-border-default rounded-[3rem] flex flex-col items-center text-center px-10 group">
            <div className="absolute inset-0 bg-gradient-to-b from-orange-500/[0.02] to-transparent pointer-events-none" />
            <div className="relative mb-6">
                <div className="absolute inset-0 bg-orange-500/20 rounded-[2rem] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="relative w-20 h-20 bg-surface-tertiary border border-border-subtle rounded-[2rem] flex items-center justify-center shadow-2xl">
                    {tab === "active"
                        ? <Building2 className="w-8 h-8 text-orange-500" />
                        : <Clock className="w-8 h-8 text-orange-500" />}
                </div>
            </div>
            <h4 className="relative text-2xl font-black text-text-primary tracking-tight mb-2 uppercase">
                {tab === "active" ? "No active venues yet" : "No pending requests"}
            </h4>
            <p className="relative text-[14px] text-text-tertiary font-medium max-w-xs leading-relaxed mb-8">
                {tab === "active"
                    ? "Venues will appear here once they accept your partnership request."
                    : "Requests you've sent that are awaiting venue approval will appear here."}
            </p>
            {tab === "active" && (
                <Link href="/host/discover">
                    <VenueActionButton variant="primary" className="h-12 px-8">
                        Explore Venues
                    </VenueActionButton>
                </Link>
            )}
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function HostNetworkPage() {
    const { profile, user } = useDashboardAuth() as any;
    const hostId = profile?.activeMembership?.partnerId;

    const [venueTab, setVenueTab] = useState<"active" | "pending">("active");
    const [search, setSearch] = useState("");
    const [venues, setVenues] = useState<VenuePartner[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [profileTarget, setProfileTarget] = useState<NetworkProfile | null>(null);

    const fetchData = useCallback(async () => {
        if (!hostId || !user) { setLoading(false); return; }
        setLoading(true);
        setError(false);
        try {
            const token = await user.getIdToken();
            const res = await fetch(
                `/api/discovery?action=list&partnerId=${hostId}&role=host`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!res.ok) throw new Error(`${res.status}`);

            const data = await res.json();
            const connections: any[] = data.connections || [];

            const venueConns = connections.filter((c: any) => c.type === "partnership");
            setVenues(venueConns.map((c: any) => ({
                id: c.otherId || c.venueId,
                name: c.otherName || c.venueName || "Venue",
                city: c.city || c.venueCity || "",
                partnershipStatus: c.status === "active" ? "active" : "pending",
                createdAt: c.updatedAt || c.createdAt,
            })));
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [hostId, user]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const activeVenues = venues.filter(v =>
        v.partnershipStatus === "active" &&
        (!search || v.name.toLowerCase().includes(search.toLowerCase()) || v.city.toLowerCase().includes(search.toLowerCase()))
    );
    const pendingVenues = venues.filter(v =>
        v.partnershipStatus === "pending" &&
        (!search || v.name.toLowerCase().includes(search.toLowerCase()) || v.city.toLowerCase().includes(search.toLowerCase()))
    );
    const displayed = venueTab === "active" ? activeVenues : pendingVenues;

    return (
        <VenuePageShell
            title="Venue Network"
            subtitle="Venues connected to your host profile"
            actions={
                <Link href="/host/discover">
                    <VenueActionButton variant="primary">
                        <Compass className="w-5 h-5 mr-2" />
                        Explore Venues
                    </VenueActionButton>
                </Link>
            }
        >
            <div className="space-y-8">
                {/* Stats strip */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { icon: Building2, label: "Active Venues", value: venues.filter(v => v.partnershipStatus === "active").length, color: "var(--v-info)" },
                        { icon: Clock, label: "Pending Requests", value: venues.filter(v => v.partnershipStatus === "pending").length, color: "var(--v-warning)" },
                        { icon: TrendingUp, label: "Total Connected", value: venues.filter(v => v.partnershipStatus === "active").length, color: "var(--v-success)" },
                    ].map(stat => {
                        const Icon = stat.icon;
                        return (
                            <div key={stat.label} className="flex items-center gap-5 p-8 rounded-[32px] bg-[var(--v-card)] border border-[var(--v-border)]">
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center border border-border-subtle shadow-xl" style={{ background: `${stat.color}10` }}>
                                    <Icon className="w-7 h-7" style={{ color: stat.color }} />
                                </div>
                                <div>
                                    <p className="text-3xl font-black text-text-primary tabular-nums tracking-tight">{stat.value}</p>
                                    <p className="text-[13px] text-[var(--v-text-tertiary)] font-black uppercase tracking-[0.1em]">{stat.label}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Active / Pending tabs + search */}
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                    <HubTabBar
                        tabs={[
                            { key: "active", label: "Active", icon: CheckCircle2, badge: activeVenues.length || undefined },
                            { key: "pending", label: "Pending", icon: Clock, badge: pendingVenues.length || undefined },
                        ]}
                        activeTab={venueTab}
                        onTabChange={(k) => setVenueTab(k as "active" | "pending")}
                    />
                    <div className="relative group w-full xl:w-80">
                        <svg className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--v-text-muted)] group-focus-within:text-[var(--v-orange)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                        <input
                            type="text"
                            placeholder="Search venues..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-[var(--v-card)] border border-[var(--v-border)] rounded-[24px] pl-14 pr-6 py-4 text-[15px] text-text-primary placeholder:text-[var(--v-text-muted)] focus:outline-none focus:border-[var(--v-orange)]/50 transition-all font-bold tracking-tight"
                        />
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="flex flex-col items-center justify-center py-16 rounded-[40px] border border-red-500/20 bg-red-500/5 gap-4 text-center">
                        <p className="text-[16px] font-black text-text-primary">Failed to load venues</p>
                        <p className="text-[13px] text-[var(--v-text-tertiary)]">Could not fetch your partnership data.</p>
                        <button onClick={fetchData} className="h-11 px-8 rounded-2xl bg-surface-tertiary border border-border-subtle text-text-primary text-[13px] font-black uppercase tracking-widest hover:bg-surface-elevated transition-all">
                            Retry
                        </button>
                    </div>
                )}

                {/* Grid */}
                {!error && (
                    <AnimatePresence mode="wait">
                        <motion.div key={venueTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                            {loading ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {[1, 2, 3].map(i => <div key={i} className="h-52 bg-surface-secondary rounded-[2rem] animate-pulse border border-border-subtle" />)}
                                </div>
                            ) : displayed.length === 0 ? (
                                <EmptyState tab={venueTab} />
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {displayed.map(v => (
                                        <VenueCard
                                            key={v.id}
                                            venue={v}
                                            onViewProfile={v => setProfileTarget({ id: v.id, type: "venue", name: v.name, city: v.city, connectionStatus: "active" })}
                                        />
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                )}
            </div>

            <AnimatePresence>
                {profileTarget && (
                    <NetworkProfileModal
                        profile={profileTarget}
                        onClose={() => setProfileTarget(null)}
                    />
                )}
            </AnimatePresence>
        </VenuePageShell>
    );
}
