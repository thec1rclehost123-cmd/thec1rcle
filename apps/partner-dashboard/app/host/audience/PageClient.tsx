"use client";

import { useEffect, useState, useCallback } from "react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import {
    Users, Search, Star, RefreshCw, ChevronRight, Filter,
    Repeat2, UserCheck, Loader2, XCircle, Shield,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AudienceGuest {
    guestId: string;
    maskedName: string;
    eventsAttended: number;
    lastEventNames: string[];
    lastSeen: string | null;
    source: string;
    isVip: boolean;
    city: string | null;
    isRepeat: boolean;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
    return <div className={`animate-pulse bg-surface-tertiary rounded-xl ${className}`} />;
}

// ── VIP toggle ────────────────────────────────────────────────────────────────

function VipToggle({ guestId, isVip, onToggle }: { guestId: string; isVip: boolean; onToggle: (id: string, val: boolean) => void }) {
    return (
        <button
            onClick={() => onToggle(guestId, !isVip)}
            className={`p-1.5 rounded-lg transition-all ${isVip ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" : "bg-surface-tertiary text-text-placeholder hover:bg-surface-elevated hover:text-amber-400"}`}
            title={isVip ? "Remove VIP" : "Mark as VIP"}
        >
            <Star className="w-3.5 h-3.5" />
        </button>
    );
}

// ── Filter Bar ────────────────────────────────────────────────────────────────

interface Filters { search: string; vip: boolean; repeat: boolean; source: string }

function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
    return (
        <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-placeholder" />
                <input
                    value={filters.search}
                    onChange={e => onChange({ ...filters, search: e.target.value })}
                    placeholder="Search guests..."
                    className="w-full bg-surface-secondary border border-border-subtle rounded-xl pl-9 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-placeholder focus:outline-none focus:border-indigo-500/50"
                />
            </div>
            <button
                onClick={() => onChange({ ...filters, vip: !filters.vip })}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${filters.vip ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-surface-secondary border border-border-subtle text-text-tertiary hover:text-text-primary"}`}
            >
                <Star className="w-3.5 h-3.5" /> VIP
            </button>
            <button
                onClick={() => onChange({ ...filters, repeat: !filters.repeat })}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${filters.repeat ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" : "bg-surface-secondary border border-border-subtle text-text-tertiary hover:text-text-primary"}`}
            >
                <Repeat2 className="w-3.5 h-3.5" /> Repeat
            </button>
            <select
                value={filters.source}
                onChange={e => onChange({ ...filters, source: e.target.value })}
                className="bg-surface-secondary border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-indigo-500/50"
            >
                <option value="">All Sources</option>
                <option value="ticket">Ticket</option>
                <option value="manual">Manual</option>
                <option value="comp">Comp</option>
            </select>
        </div>
    );
}

// ── Guest Row ─────────────────────────────────────────────────────────────────

function GuestRow({ guest, onVipToggle }: { guest: AudienceGuest; onVipToggle: (id: string, val: boolean) => void }) {
    return (
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 px-6 py-4 hover:bg-surface-secondary transition-colors group">
            {/* Name + avatar */}
            <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-black text-sm shrink-0">
                    {guest.maskedName.charAt(0)}
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-text-primary font-semibold text-sm truncate">{guest.maskedName}</p>
                        {guest.isVip && <Star className="w-3 h-3 text-amber-400 shrink-0" />}
                        {guest.isRepeat && <Repeat2 className="w-3 h-3 text-indigo-400 shrink-0" />}
                    </div>
                    <p className="text-text-tertiary text-[11px] truncate">
                        {guest.lastEventNames.join(", ")}
                    </p>
                </div>
            </div>

            {/* Events */}
            <div className="text-center">
                <p className="font-black text-text-primary text-sm">{guest.eventsAttended}</p>
                <p className="text-text-placeholder text-[10px] uppercase tracking-widest">Events</p>
            </div>

            {/* Source */}
            <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                guest.source === "ticket" ? "bg-indigo-500/10 text-indigo-400" :
                guest.source === "comp" ? "bg-violet-500/10 text-violet-400" :
                "bg-white/5 text-text-tertiary"
            }`}>
                {guest.source}
            </span>

            {/* Last seen */}
            <p className="text-text-placeholder text-[11px] font-semibold hidden lg:block">
                {guest.lastSeen
                    ? new Date(guest.lastSeen).toLocaleDateString("en-IN", { month: "short", day: "numeric" })
                    : "—"}
            </p>

            {/* Actions */}
            <VipToggle guestId={guest.guestId} isVip={guest.isVip} onToggle={onVipToggle} />
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function HostAudiencePage() {
    const { profile, user } = useDashboardAuth() as any;
    const [guests, setGuests] = useState<AudienceGuest[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<Filters>({ search: "", vip: false, repeat: false, source: "" });

    const hostId = profile?.activeMembership?.partnerId;

    const fetchGuests = useCallback(async (cursor: string | null = null, replace = true) => {
        if (!hostId || !user) return;
        if (replace) { setLoading(true); setError(null); }
        else setLoadingMore(true);

        try {
            const token = typeof user.getIdToken === "function" ? await user.getIdToken() : "";
            const params = new URLSearchParams({ hostId, limit: "50" });
            if (cursor) params.set("cursor", cursor);
            if (filters.vip) params.set("vip", "true");
            if (filters.source) params.set("source", filters.source);

            const res = await fetch(`/api/host/audience?${params}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            if (replace) {
                setGuests(data.guests || []);
                setTotal(data.total || 0);
            } else {
                setGuests(prev => [...prev, ...(data.guests || [])]);
            }
            setHasMore(data.hasMore || false);
            setNextCursor(data.nextCursor || null);
        } catch (e: any) {
            setError("Failed to load audience.");
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [hostId, user, filters.vip, filters.source]);

    useEffect(() => { fetchGuests(); }, [fetchGuests]);

    const handleVipToggle = async (guestId: string, isVip: boolean) => {
        // Optimistic update
        setGuests(prev => prev.map(g => g.guestId === guestId ? { ...g, isVip } : g));

        try {
            const token = typeof user?.getIdToken === "function" ? await user.getIdToken() : "";
            await fetch(`/api/host/audience`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ hostId, guestId, isVip }),
            });
        } catch {
            // Revert on failure
            setGuests(prev => prev.map(g => g.guestId === guestId ? { ...g, isVip: !isVip } : g));
        }
    };

    // Client-side filter for search and repeat
    const filtered = guests.filter(g => {
        if (filters.search && !g.maskedName.toLowerCase().includes(filters.search.toLowerCase())) return false;
        if (filters.repeat && !g.isRepeat) return false;
        return true;
    });

    return (
        <div className="space-y-8 pb-16 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border-subtle">
                <div>
                    <div className="flex items-center gap-3 mb-3 text-indigo-400">
                        <div className="p-2 bg-indigo-500/10 rounded-xl">
                            <Users className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest">Audience</span>
                    </div>
                    <h1 className="text-3xl font-black text-text-primary tracking-tight">Guest Network</h1>
                    <p className="text-text-tertiary text-sm mt-2 max-w-lg">
                        Aggregated audience across all your events. Names are pseudonymized to protect guest privacy.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                        <Shield className="w-4 h-4 text-indigo-400" />
                        <span className="text-[11px] font-black text-indigo-400 uppercase tracking-widest">PII Masked</span>
                    </div>
                    <button onClick={() => fetchGuests()} className="p-2.5 bg-surface-elevated border border-border-subtle rounded-xl hover:bg-surface-tertiary transition-all text-text-tertiary">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Stats */}
            {!loading && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: "Total Guests", value: total, icon: Users, color: "text-indigo-400" },
                        { label: "VIP Guests", value: guests.filter(g => g.isVip).length, icon: Star, color: "text-amber-400" },
                        { label: "Repeat Attendees", value: guests.filter(g => g.isRepeat).length, icon: Repeat2, color: "text-violet-400" },
                        { label: "Ticketed", value: guests.filter(g => g.source === "ticket").length, icon: UserCheck, color: "text-emerald-400" },
                    ].map(stat => {
                        const Icon = stat.icon;
                        return (
                            <div key={stat.label} className="bg-surface-elevated border border-border-subtle rounded-2xl p-5">
                                <Icon className={`w-4 h-4 ${stat.color} mb-3`} />
                                <p className="text-2xl font-black text-text-primary">{stat.value.toLocaleString("en-IN")}</p>
                                <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mt-1">{stat.label}</p>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Filter bar */}
            <FilterBar filters={filters} onChange={setFilters} />

            {/* Guest table */}
            {loading ? (
                <div className="space-y-2">{[0,1,2,3,4,5].map(i => <Skeleton key={i} className="h-16" />)}</div>
            ) : error ? (
                <div className="py-16 text-center">
                    <XCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
                    <p className="text-text-primary font-bold">{error}</p>
                    <button onClick={() => fetchGuests()} className="mt-4 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all">
                        Retry
                    </button>
                </div>
            ) : filtered.length === 0 ? (
                <div className="py-20 bg-surface-elevated border border-dashed border-border-subtle rounded-2xl text-center">
                    <Users className="w-10 h-10 text-text-placeholder mx-auto mb-4" />
                    <p className="text-text-primary font-bold text-lg">No guests found</p>
                    <p className="text-text-tertiary text-sm mt-2">
                        {guests.length === 0 ? "Guests will appear here once tickets are sold." : "Try adjusting your filters."}
                    </p>
                </div>
            ) : (
                <div className="bg-surface-elevated border border-border-subtle rounded-2xl overflow-hidden">
                    {/* Table header */}
                    <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 px-6 py-3 border-b border-border-subtle">
                        {["Guest", "Events", "Source", "Last Seen", ""].map((col, i) => (
                            <p key={i} className="text-[10px] font-black text-text-placeholder uppercase tracking-widest">{col}</p>
                        ))}
                    </div>

                    <div className="divide-y divide-border-subtle">
                        {filtered.map(guest => (
                            <GuestRow key={guest.guestId} guest={guest} onVipToggle={handleVipToggle} />
                        ))}
                    </div>

                    {/* Load more */}
                    {hasMore && (
                        <div className="px-6 py-4 border-t border-border-subtle flex items-center justify-center">
                            <button
                                onClick={() => fetchGuests(nextCursor, false)}
                                disabled={loadingMore}
                                className="flex items-center gap-2 px-5 py-2.5 bg-surface-secondary hover:bg-surface-tertiary border border-border-subtle text-text-primary rounded-xl text-[11px] font-black uppercase tracking-widest transition-all"
                            >
                                {loadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                Load More
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
