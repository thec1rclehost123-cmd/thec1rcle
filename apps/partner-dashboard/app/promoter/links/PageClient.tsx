"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { Link2, Plus, Copy, CheckCircle2, Search, ChevronDown } from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { VenuePageShell } from "@/components/venue-layout/VenuePageShell";
import GenerateLinkModal from "@/components/promoter/links/GenerateLinkModal";
import AnalyticsDrawer from "@/components/promoter/links/AnalyticsDrawer";

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatINR(paise: number) {
    if (!paise) return "₹0";
    const r = paise / 100;
    if (r >= 100000) return `₹${(r / 100000).toFixed(1)}L`;
    if (r >= 1000) return `₹${(r / 1000).toFixed(1)}K`;
    return `₹${Math.round(r).toLocaleString("en-IN")}`;
}

function StatusPill({ status }: { status: string }) {
    const isActive = status === "active";
    return (
        <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest"
            style={{
                background: isActive ? "rgba(52,211,153,0.1)" : "rgba(113,113,122,0.1)",
                color: isActive ? "#34d399" : "#71717a"
            }}
        >
            {isActive ? "Active" : status === "deactivated" ? "Off" : "Expired"}
        </span>
    );
}

// ─── KPI strip ────────────────────────────────────────────────────────────────

function KPICard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
    return (
        <div className="p-5 rounded-[1.5rem] flex flex-col gap-1"
            style={{ background: "var(--v-card, #1a1a1d)", border: "1px solid var(--v-border, rgba(255,255,255,0.08))" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--v-text-tertiary, #a1a1aa)" }}>
                {label}
            </p>
            <p className="text-[28px] font-black tabular-nums leading-none" style={{ color: "var(--v-text-primary, #fafafa)" }}>
                {value}
            </p>
            {sub && <p className="text-[11px]" style={{ color: "var(--v-text-tertiary, #a1a1aa)" }}>{sub}</p>}
        </div>
    );
}

// ─── skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
    return (
        <tr>
            {[1, 2, 3, 4, 5, 6].map(i => (
                <td key={i} className="px-4 py-4">
                    <div className="h-4 rounded animate-pulse"
                        style={{ background: "var(--v-elevated, #222226)", width: i === 1 ? "70%" : i === 2 ? "55%" : "40%" }} />
                </td>
            ))}
        </tr>
    );
}

// ─── main ─────────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "deactivated", label: "Off" },
    { key: "expired", label: "Expired" }
];

export default function PromoLinksPage() {
    const { profile, user } = useDashboardAuth();
    const promoterId = profile?.activeMembership?.partnerId;

    const [links, setLinks] = useState<any[]>([]);
    const [stats, setStats] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
    const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [token, setToken] = useState<string>("");

    const fetchData = useCallback(async () => {
        if (!promoterId) return;
        try {
            const t = await user?.getIdToken();
            if (t) setToken(t);
            const headers: Record<string, string> = t ? { Authorization: `Bearer ${t}` } : {};

            const [linksRes, statsRes] = await Promise.all([
                fetch(`/api/promoter/links?promoterId=${promoterId}&limit=100`, { headers }),
                fetch(`/api/promoter/stats?promoterId=${promoterId}`, { headers })
            ]);

            if (linksRes.ok) {
                const data = await linksRes.json();
                setLinks(data.links || []);
            }
            if (statsRes.ok) {
                const data = await statsRes.json();
                setStats(data);
            }
        } catch (e) {
            console.error("[PromoLinks] fetch error:", e);
        } finally {
            setLoading(false);
        }
    }, [promoterId, user]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filteredLinks = useMemo(() => {
        return links.filter(l => {
            const label = (l.campaignLabel || l.label || l.code || "").toLowerCase();
            const event = (l.eventTitle || l.eventId || "").toLowerCase();
            const q = searchQuery.toLowerCase();
            const matchesSearch = !q || label.includes(q) || event.includes(q);
            const matchesStatus = filterStatus === "all" || (l.status || "active") === filterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [links, searchQuery, filterStatus]);

    const handleCopyRow = (link: any, e: React.MouseEvent) => {
        e.stopPropagation();
        const slug = link.eventSlug || link.eventId || "";
        const ref = link.code || link.shortId || link.token || link.id;
        const url = `https://c1rcle.app/e/${slug}?ref=${ref}&s=${link.channel || ""}`;
        navigator.clipboard.writeText(url);
        setCopiedId(link.id);
        setTimeout(() => setCopiedId(null), 1500);
    };

    const handleLinkCreated = (link: any) => {
        setLinks(prev => {
            // Avoid duplicate if returned same link
            if (prev.find(l => l.id === link.id)) return prev;
            return [link, ...prev];
        });
    };

    const handleDeactivated = (linkId: string) => {
        setLinks(prev => prev.map(l => l.id === linkId ? { ...l, status: "deactivated" } : l));
    };

    // Compute KPI values — stats from API or derive from links as fallback
    const kpiActiveLinks = stats.activeLinks ?? links.filter(l => (l.status || "active") === "active").length;
    const kpiClicks = stats.lifetimeClicks ?? stats.totalClicks ?? links.reduce((s: number, l: any) => s + (l.clicks || l.clickCount || 0), 0);
    const kpiSales = stats.totalConversions ?? stats.totalSales ?? links.reduce((s: number, l: any) => s + (l.conversions || l.conversionCount || 0), 0);
    const kpiEarnings = stats.clearedCommission ?? stats.totalEarnings ?? 0;

    const selectedFilterLabel = STATUS_OPTIONS.find(o => o.key === filterStatus)?.label || "All";
    const selectedLink = links.find(l => l.id === selectedLinkId) || null;

    return (
        <VenuePageShell
            title="My Links"
            subtitle="Create tracking links, share them, and see your earnings"
        >
            {/* KPI strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KPICard label="Active Links" value={kpiActiveLinks} />
                <KPICard label="Total Clicks" value={kpiClicks.toLocaleString()} />
                <KPICard label="Sales" value={kpiSales.toLocaleString()} />
                <KPICard label="Earnings" value={formatINR(kpiEarnings)} sub="cleared" />
            </div>

            {/* New Link CTA */}
            <div>
                <button
                    onClick={() => setShowGenerateModal(true)}
                    className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl text-[14px] font-bold transition-all"
                    style={{ background: "var(--c1rcle-orange, #F44A22)", color: "#fff" }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
                    onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                >
                    <Plus size={16} />
                    New Link
                </button>
            </div>

            {/* Links table */}
            <div className="rounded-[2rem] overflow-hidden"
                style={{ background: "var(--v-card, #1a1a1d)", border: "1px solid var(--v-border, rgba(255,255,255,0.08))" }}>

                {/* Table toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4"
                    style={{ borderBottom: "1px solid var(--v-border, rgba(255,255,255,0.08))" }}>
                    <div className="flex items-center gap-3">
                        <Link2 size={16} style={{ color: "#a78bfa" }} />
                        <span className="text-[13px] font-bold" style={{ color: "var(--v-text-primary, #fafafa)" }}>
                            {loading ? "Loading…" : `${filteredLinks.length} link${filteredLinks.length !== 1 ? "s" : ""}`}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Search */}
                        <div className="relative">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2"
                                style={{ color: "var(--v-text-tertiary, #a1a1aa)" }} />
                            <input
                                type="text"
                                placeholder="Search links…"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-9 pr-4 py-2 rounded-xl text-[13px] outline-none w-48 transition-all"
                                style={{
                                    background: "var(--v-elevated, #222226)",
                                    border: "1px solid var(--v-border, rgba(255,255,255,0.08))",
                                    color: "var(--v-text-primary, #fafafa)"
                                }}
                                onFocus={e => (e.currentTarget.style.borderColor = "rgba(124,58,237,0.4)")}
                                onBlur={e => (e.currentTarget.style.borderColor = "var(--v-border, rgba(255,255,255,0.08))")}
                            />
                        </div>

                        {/* Status filter */}
                        <div className="relative">
                            <button
                                onClick={() => setFilterDropdownOpen(v => !v)}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all"
                                style={{
                                    background: "var(--v-elevated, #222226)",
                                    border: "1px solid var(--v-border, rgba(255,255,255,0.08))",
                                    color: "var(--v-text-secondary, #d1d1d6)"
                                }}
                            >
                                {selectedFilterLabel}
                                <ChevronDown size={13} style={{ color: "var(--v-text-tertiary, #a1a1aa)" }} />
                            </button>
                            {filterDropdownOpen && (
                                <div
                                    className="absolute right-0 top-full mt-1 z-10 rounded-xl overflow-hidden"
                                    style={{
                                        background: "var(--v-card, #1a1a1d)",
                                        border: "1px solid var(--v-border, rgba(255,255,255,0.08))",
                                        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                                        minWidth: 120
                                    }}
                                >
                                    {STATUS_OPTIONS.map(opt => (
                                        <button
                                            key={opt.key}
                                            onClick={() => { setFilterStatus(opt.key); setFilterDropdownOpen(false); }}
                                            className="w-full text-left px-4 py-2.5 text-[13px] transition-all"
                                            style={{
                                                color: filterStatus === opt.key ? "var(--v-text-primary, #fafafa)" : "var(--v-text-secondary, #d1d1d6)",
                                                background: filterStatus === opt.key ? "var(--v-elevated, #222226)" : "transparent",
                                                fontWeight: filterStatus === opt.key ? 700 : 500
                                            }}
                                            onMouseEnter={e => (e.currentTarget.style.background = "var(--v-elevated, #222226)")}
                                            onMouseLeave={e => (e.currentTarget.style.background = filterStatus === opt.key ? "var(--v-elevated, #222226)" : "transparent")}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr style={{ borderBottom: "1px solid var(--v-border, rgba(255,255,255,0.08))" }}>
                                {["Link Name", "Event", "Clicks", "Sales", "Earnings", "Status"].map(col => (
                                    <th key={col} className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest"
                                        style={{ color: "var(--v-text-tertiary, #a1a1aa)" }}>
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
                            ) : filteredLinks.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                                                style={{ background: "var(--v-elevated, #222226)" }}>
                                                <Link2 size={24} style={{ color: "var(--v-text-tertiary, #a1a1aa)" }} />
                                            </div>
                                            <div>
                                                <p className="text-[14px] font-bold mb-1" style={{ color: "var(--v-text-primary, #fafafa)" }}>
                                                    {searchQuery || filterStatus !== "all"
                                                        ? "No links match your filters"
                                                        : "No links yet"}
                                                </p>
                                                <p className="text-[12px]" style={{ color: "var(--v-text-tertiary, #a1a1aa)" }}>
                                                    {searchQuery || filterStatus !== "all"
                                                        ? "Try a different search or filter"
                                                        : "Create your first to start earning"}
                                                </p>
                                            </div>
                                            {!searchQuery && filterStatus === "all" && (
                                                <button
                                                    onClick={() => setShowGenerateModal(true)}
                                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all"
                                                    style={{ background: "var(--c1rcle-orange, #F44A22)", color: "#fff" }}
                                                >
                                                    <Plus size={14} /> New Link
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredLinks.map(link => {
                                    const isSelected = selectedLinkId === link.id;
                                    const clicks = link.clicks || link.clickCount || 0;
                                    const sales = link.conversions || link.conversionCount || 0;
                                    const earnings = link.commission || link.clearedCommission || 0;

                                    return (
                                        <tr
                                            key={link.id}
                                            onClick={() => setSelectedLinkId(link.id)}
                                            className="cursor-pointer transition-all group"
                                            style={{
                                                borderBottom: "1px solid var(--v-border, rgba(255,255,255,0.05))",
                                                background: isSelected
                                                    ? "rgba(124,58,237,0.06)"
                                                    : "transparent"
                                            }}
                                            onMouseEnter={e => {
                                                if (!isSelected) e.currentTarget.style.background = "var(--v-elevated, rgba(34,34,38,0.5))";
                                            }}
                                            onMouseLeave={e => {
                                                if (!isSelected) e.currentTarget.style.background = "transparent";
                                            }}
                                        >
                                            {/* Link Name + copy */}
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[13px] font-semibold truncate max-w-[140px]"
                                                        style={{ color: "var(--v-text-primary, #fafafa)" }}>
                                                        {link.campaignLabel || link.label || link.code || link.id?.slice(0, 8)}
                                                    </span>
                                                    <button
                                                        onClick={e => handleCopyRow(link, e)}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                                                        style={{ background: "var(--v-elevated, #222226)" }}
                                                        title="Copy link"
                                                    >
                                                        {copiedId === link.id
                                                            ? <CheckCircle2 size={11} style={{ color: "#34d399" }} />
                                                            : <Copy size={11} style={{ color: "var(--v-text-tertiary, #a1a1aa)" }} />
                                                        }
                                                    </button>
                                                </div>
                                            </td>

                                            {/* Event */}
                                            <td className="px-4 py-3.5">
                                                <span className="text-[12px] truncate max-w-[160px] block"
                                                    style={{ color: "var(--v-text-secondary, #d1d1d6)" }}>
                                                    {link.eventTitle || link.eventId || "—"}
                                                </span>
                                            </td>

                                            {/* Clicks */}
                                            <td className="px-4 py-3.5">
                                                <span className="text-[13px] font-semibold tabular-nums"
                                                    style={{ color: "var(--v-text-primary, #fafafa)" }}>
                                                    {clicks.toLocaleString()}
                                                </span>
                                            </td>

                                            {/* Sales */}
                                            <td className="px-4 py-3.5">
                                                <span className="text-[13px] font-semibold tabular-nums"
                                                    style={{ color: "var(--v-text-primary, #fafafa)" }}>
                                                    {sales.toLocaleString()}
                                                </span>
                                            </td>

                                            {/* Earnings */}
                                            <td className="px-4 py-3.5">
                                                <span className="text-[13px] font-semibold tabular-nums"
                                                    style={{ color: earnings > 0 ? "#34d399" : "var(--v-text-secondary, #d1d1d6)" }}>
                                                    {formatINR(earnings)}
                                                </span>
                                            </td>

                                            {/* Status */}
                                            <td className="px-4 py-3.5">
                                                <StatusPill status={link.status || "active"} />
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Generate link modal */}
            <AnimatePresence>
                {showGenerateModal && (
                    <GenerateLinkModal
                        promoterId={promoterId || ""}
                        promoterName={profile?.displayName}
                        token={token}
                        onClose={() => setShowGenerateModal(false)}
                        onCreated={(link) => {
                            handleLinkCreated(link);
                            setShowGenerateModal(false);
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Analytics drawer */}
            <AnalyticsDrawer
                linkId={selectedLinkId}
                token={token}
                onClose={() => setSelectedLinkId(null)}
                onDeactivated={handleDeactivated}
            />
        </VenuePageShell>
    );
}
