"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    Calendar,
    CheckCircle2,
    Copy,
    PencilLine,
    Link as LinkIcon,
    MapPin,
    RefreshCw,
    Search,
    Sparkles,
    Ticket,
    Users,
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { VenuePageShell } from "@/components/venue-layout/VenuePageShell";
import { ErrorState } from "@/components/ui/ErrorState";
import { CITY_MAP } from "@c1rcle/core/events";
import GenerateLinkModal from "@/components/promoter/links/GenerateLinkModal";
import EditLinkModal from "@/components/promoter/links/EditLinkModal";

const GUEST_PORTAL_URL =
    process.env.NEXT_PUBLIC_GUEST_PORTAL_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "";

type PromoterTab = "all" | "available" | "linked";

interface PromoterEvent {
    id: string;
    title: string;
    summary: string;
    image: string;
    date: string;
    startDate: string;
    startTime?: string;
    time: string;
    location: string;
    venue: string;
    venueName?: string;
    hostName?: string;
    city: string;
    category: string;
    creatorRole?: string;
    priceRange: { min: number; max: number };
    commissionRate: number;
    tickets: { id: string; name: string; price: number; promoterEnabled: boolean }[];
    stats: { interested: number };
}

interface PromoterLink {
    id: string;
    code: string;
    eventId: string;
    eventTitle: string;
    clicks: number;
    conversions: number;
    revenue: number;
    commission: number;
    isActive: boolean;
    fullUrl?: string | null;
    eventSlug?: string | null;
    vanityPrefix?: string | null;
    vanitySlug?: string | null;
    vanityAlias?: string | null;
}

function formatINR(paiseOrRupees: number) {
    const amount = Number(paiseOrRupees || 0);
    if (!amount) return "₹0";
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
    return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

function formatEventDate(startDate?: string) {
    if (!startDate) {
        return { day: "--", month: "---", weekday: "Schedule pending", full: "Date TBA" };
    }

    return {
        day: new Intl.DateTimeFormat("en-IN", { day: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(startDate)),
        month: new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "Asia/Kolkata" }).format(new Date(startDate)).toUpperCase(),
        weekday: new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: "Asia/Kolkata" }).format(new Date(startDate)),
        full: new Intl.DateTimeFormat("en-IN", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "Asia/Kolkata",
        }).format(new Date(startDate)),
    };
}

function buildLinkUrl(link: PromoterLink) {
    if (link.fullUrl) return link.fullUrl;
    const slug = link.eventSlug || link.eventId;
    return `${GUEST_PORTAL_URL}/e/${slug}?ref=${link.code}`;
}

function resolveEventTime(event: PromoterEvent) {
    if (event.time && event.time !== "Time TBA") return event.time;
    if (event.startTime) {
        const [rawHour = "0", rawMinute = "00"] = String(event.startTime).split(":");
        const hour = Number(rawHour);
        const minute = Number(rawMinute);
        if (!Number.isNaN(hour) && !Number.isNaN(minute)) {
            const suffix = hour >= 12 ? "PM" : "AM";
            const normalizedHour = hour % 12 || 12;
            return `${normalizedHour}:${String(minute).padStart(2, "0")} ${suffix}`;
        }
    }
    if (event.startDate) {
        const date = new Date(event.startDate);
        if (!Number.isNaN(date.getTime())) {
            return new Intl.DateTimeFormat("en-IN", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
                timeZone: "Asia/Kolkata",
            }).format(date);
        }
    }
    return "Time TBA";
}

function LoadingCard() {
    return (
        <div className="relative overflow-hidden rounded-[30px] border border-white/5 bg-[linear-gradient(180deg,rgba(35,35,40,0.98),rgba(24,24,28,0.98))] p-3.5">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-[linear-gradient(100deg,transparent,rgba(255,255,255,0.08),transparent)]" />
            <div className="relative space-y-4">
                <div className="aspect-[16/10] rounded-[24px] bg-white/[0.04]" />
                <div className="h-6 w-2/3 rounded-xl bg-white/[0.05]" />
                <div className="h-20 rounded-[20px] bg-white/[0.04]" />
                <div className="h-14 rounded-[20px] bg-white/[0.04]" />
            </div>
        </div>
    );
}

export default function PromoterEventsPage() {
    const { profile, user } = useDashboardAuth();
    const promoterId = profile?.activeMembership?.partnerId;
    const promoterName = profile?.displayName;

    const [events, setEvents] = useState<PromoterEvent[]>([]);
    const [myLinks, setMyLinks] = useState<PromoterLink[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCity, setSelectedCity] = useState("");
    const [activeTab, setActiveTab] = useState<PromoterTab>("all");
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
    const [selectedEventIdForModal, setSelectedEventIdForModal] = useState<string | null>(null);
    const [editingLink, setEditingLink] = useState<PromoterLink | null>(null);
    const [authToken, setAuthToken] = useState("");

    const fetchPageData = useCallback(async (manualRefresh = false) => {
        if (!promoterId) return;
        if (manualRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const authToken = await user?.getIdToken();
            if (authToken) setAuthToken(authToken);
            const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
            const params = new URLSearchParams();
            if (selectedCity) params.set("city", selectedCity);

            const [eventsRes, linksRes] = await Promise.all([
                fetch(`/api/partners/promoters/events?${params.toString()}`, { headers }),
                fetch("/api/partners/promoters/links?isActive=true", { headers }),
            ]);

            if (!eventsRes.ok || !linksRes.ok) {
                throw new Error("Failed to load promoter events");
            }

            const eventsData = await eventsRes.json();
            const linksData = await linksRes.json();
            setEvents(Array.isArray(eventsData.events) ? eventsData.events : []);
            setMyLinks(Array.isArray(linksData.links) ? linksData.links : []);
            setFetchError(null);
            setRefreshedAt(new Date());
        } catch (error) {
            console.error("Failed to fetch promoter events:", error);
            setFetchError("Failed to load events. Please try again.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [promoterId, selectedCity, user]);

    useEffect(() => {
        fetchPageData();
    }, [fetchPageData]);

    const getActiveLink = useCallback((eventId: string) => {
        return myLinks.find((link) => link.eventId === eventId && link.isActive);
    }, [myLinks]);

    const filteredEvents = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return events.filter((event) => {
            const hasLink = Boolean(getActiveLink(event.id));
            const matchesTab =
                activeTab === "all" ||
                (activeTab === "linked" && hasLink) ||
                (activeTab === "available" && !hasLink);
            const matchesSearch =
                !query ||
                [event.title, event.venue, event.city, event.category]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(query));

            return matchesTab && matchesSearch;
        });
    }, [activeTab, events, getActiveLink, searchQuery]);

    const counts = useMemo(() => {
        const linked = events.filter((event) => Boolean(getActiveLink(event.id))).length;
        return {
            all: events.length,
            linked,
            available: Math.max(events.length - linked, 0),
        };
    }, [events, getActiveLink]);

    const copyLink = async (link: PromoterLink) => {
        await navigator.clipboard.writeText(buildLinkUrl(link));
        setCopiedCode(link.code);
        window.setTimeout(() => setCopiedCode(null), 1500);
    };

    return (
        <VenuePageShell
            title="Events"
            actions={
                <button
                    onClick={() => fetchPageData(true)}
                    disabled={refreshing || loading}
                    className="flex items-center gap-2 px-5 py-3 bg-surface-elevated border border-border-default hover:border-border-strong text-text-secondary text-sm font-semibold rounded-xl transition-all disabled:opacity-60"
                >
                    <RefreshCw className={`h-4 w-4 ${(refreshing || loading) ? "animate-spin" : ""}`} />
                    {refreshedAt ? refreshedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Refresh"}
                </button>
            }
        >
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 p-1 bg-surface-secondary rounded-xl w-fit overflow-x-auto max-w-full scrollbar-hide">
                    {[
                        { id: "all", label: "All", count: counts.all },
                        { id: "available", label: "Ready", count: counts.available },
                        { id: "linked", label: "Linked", count: counts.linked },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as PromoterTab)}
                            className={`px-4 py-2 rounded-lg text-[13px] font-semibold transition-all ${activeTab === tab.id
                                ? "bg-surface-elevated text-text-primary shadow-sm"
                                : "text-text-tertiary hover:text-text-secondary"
                                }`}
                        >
                            {tab.label}
                            <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-black ${activeTab === tab.id ? "bg-[var(--c1rcle-orange,#F44A22)] text-white" : "bg-surface-tertiary text-text-secondary"}`}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="flex flex-col gap-3 rounded-3xl border border-border-default bg-surface-elevated p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="relative w-full lg:max-w-md">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Search events, venues, or categories"
                            className="w-full rounded-2xl border border-border-subtle bg-surface-secondary py-3 pl-11 pr-4 text-sm text-text-primary outline-none transition-all placeholder:text-text-tertiary focus:border-border-strong"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <select
                            value={selectedCity}
                            onChange={(event) => setSelectedCity(event.target.value)}
                            className="rounded-2xl border border-border-subtle bg-surface-secondary px-4 py-3 text-sm text-text-primary outline-none transition-all focus:border-border-strong"
                        >
                            <option value="">All Cities</option>
                            {CITY_MAP.map((city) => (
                                <option key={city.key} value={city.label.split(",")[0]}>
                                    {city.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6].map((item) => <LoadingCard key={item} />)}
                </div>
            ) : fetchError ? (
                <ErrorState
                    title="Failed to load events"
                    message={fetchError}
                    onRetry={() => fetchPageData()}
                />
            ) : filteredEvents.length === 0 ? (
                <div className="relative overflow-hidden rounded-[34px] border border-white/5 bg-[linear-gradient(180deg,rgba(34,34,38,0.98),rgba(21,21,25,0.98))] p-12 text-center shadow-[0_24px_80px_rgba(0,0,0,0.16)]">
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                    <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.08),transparent_60%)]">
                        <div className="relative flex h-14 w-14 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04]">
                            <Calendar className="h-7 w-7 text-white/75" />
                            <Sparkles className="absolute -right-2 -top-2 h-4 w-4 text-amber-300/80" />
                        </div>
                    </div>
                    <h3 className="mb-2 text-xl font-black tracking-[-0.03em] text-text-primary">No promotable events in this view</h3>
                    <p className="mx-auto max-w-sm text-sm leading-6 text-text-tertiary">
                        Try another city or search query. RSVP-only events and non-promotable ticket setups are intentionally excluded.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredEvents.map((event) => {
                        const link = getActiveLink(event.id);
                        const hasLink = Boolean(link);
                        const dateParts = formatEventDate(event.startDate);
                        const partnerLabel = event.creatorRole === "host" ? "Host" : "Venue";
                        const partnerValue = event.creatorRole === "host"
                            ? (event.hostName || event.venue || "Host")
                            : (event.venueName || event.venue || "Venue");
                        const eventTime = resolveEventTime(event);

                        return (
                            <motion.div
                                key={event.id}
                                layout
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="group relative rounded-[30px] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1"
                            >
                                {event.image ? (
                                    <div
                                        className="pointer-events-none absolute -inset-[10px] rounded-[38px] opacity-75 blur-3xl saturate-[1.6]"
                                        style={{
                                            backgroundImage: `url(${event.image})`,
                                            backgroundSize: "cover",
                                            backgroundPosition: "center",
                                        }}
                                    />
                                ) : (
                                    <div className="pointer-events-none absolute -inset-[10px] rounded-[38px] bg-[radial-gradient(circle_at_center,rgba(203,132,255,0.34),transparent_62%)] blur-3xl opacity-100" />
                                )}

                                <div className="relative overflow-hidden rounded-[30px] border border-white/[0.04] bg-[linear-gradient(180deg,rgba(38,38,42,0.98),rgba(24,24,28,0.98))] p-3.5 shadow-[0_4px_16px_rgba(0,0,0,0.3),0_24px_80px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.06)]">
                                    {event.image ? (
                                        <div
                                            className="pointer-events-none absolute inset-0 rounded-[30px] opacity-95"
                                            style={{
                                                backgroundImage: `url(${event.image})`,
                                                backgroundSize: "cover",
                                                backgroundPosition: "center",
                                                filter: "saturate(1.7) brightness(1.2)",
                                            }}
                                        />
                                    ) : (
                                        <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-[linear-gradient(180deg,rgba(244,196,255,0.98),rgba(214,144,255,0.94))] opacity-100 shadow-[0_0_22px_rgba(210,138,255,0.75),0_0_48px_rgba(182,97,255,0.42)]" />
                                    )}
                                    <div className="pointer-events-none absolute inset-[2px] rounded-[28px] bg-[linear-gradient(180deg,rgba(38,38,42,0.985),rgba(24,24,28,0.985))]" />
                                    {event.image ? (
                                        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[30px]">
                                            <img
                                                src={event.image}
                                                alt=""
                                                aria-hidden="true"
                                                className="absolute inset-0 h-full w-full scale-110 object-cover opacity-[0.15] blur-[72px] saturate-150"
                                            />
                                            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,18,20,0.58)_0%,rgba(18,18,20,0.88)_46%,rgba(18,18,20,0.98)_100%)]" />
                                        </div>
                                    ) : null}
                                    <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.09),transparent_70%)]" />

                                    <div className="relative flex h-full flex-col">
                                        <div className="relative overflow-hidden rounded-[24px] bg-black/30">
                                            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-3 py-3">
                                                <span className="inline-flex items-center gap-2 rounded-full bg-white/8 border border-white/10 px-3 py-1.5 text-xs font-bold text-white/90 shadow-sm">
                                                    <span className={`h-1.5 w-1.5 rounded-full ${hasLink ? "bg-violet-400" : "bg-emerald-400"}`} />
                                                    {hasLink ? "Link Active" : "Ready to Promote"}
                                                </span>
                                                <span className="rounded-full bg-black/35 px-3 py-1.5 text-[11px] font-bold text-emerald-300 backdrop-blur-md">
                                                    {event.commissionRate}% commission
                                                </span>
                                            </div>

                                            <div className="aspect-[16/10] w-full">
                                                {event.image ? (
                                                    <img
                                                        src={event.image}
                                                        alt={event.title}
                                                        className="h-full w-full object-cover transition-transform duration-[6000ms] ease-out group-hover:scale-[1.06]"
                                                    />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center bg-surface-secondary">
                                                        <Calendar className="h-8 w-8 text-text-tertiary" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center_80%,transparent_40%,rgba(0,0,0,0.95)_100%)]" />
                                            <div className="absolute inset-x-4 bottom-4">
                                                <div className="text-[24px] font-black leading-[1.05] text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.6)] line-clamp-2">
                                                    {event.title}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-2.5 flex flex-1 flex-col">
                                            <div className="mb-2 flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-300">
                                                        {partnerLabel}
                                                    </p>
                                                    <p className="line-clamp-1 text-[20px] font-black tracking-[-0.03em] text-text-primary">
                                                        {partnerValue}
                                                    </p>
                                                    <p className="text-[11px] font-medium text-text-tertiary">
                                                        {[event.venue, event.city].filter(Boolean).join(", ")}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="rounded-[20px] bg-black/18 p-3.5">
                                                <div className="grid grid-cols-[auto_1px_minmax(0,1fr)] items-center gap-4">
                                                    <div className="min-w-[64px] text-center">
                                                        <div className="text-[52px] font-black leading-none text-text-primary">
                                                            {dateParts.day}
                                                        </div>
                                                        <div className="mt-1 text-[11px] font-black uppercase tracking-[0.3em] text-text-tertiary">
                                                            {dateParts.month}
                                                        </div>
                                                    </div>
                                                    <div className="h-14 w-px bg-white/10" />
                                                    <div className="min-w-0">
                                                        <div className="text-[25px] font-black leading-tight text-text-primary">
                                                            {eventTime}
                                                        </div>
                                                        <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.24em] text-text-tertiary">
                                                            {dateParts.weekday}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="mt-3">
                                                    <div className="relative h-1 rounded-full bg-white/10">
                                                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500" style={{ width: "100%" }} />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-2.5 grid grid-cols-3 gap-2">
                                                <div className="rounded-2xl bg-white/[0.04] px-3.5 py-2.5">
                                                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
                                                        <Users className="h-3.5 w-3.5" />
                                                        Interest
                                                    </div>
                                                    <div className="mt-1 text-lg font-black text-text-primary">{event.stats?.interested ?? 0}</div>
                                                </div>
                                                <div className="rounded-2xl bg-white/[0.04] px-3.5 py-2.5">
                                                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
                                                        <MapPin className="h-3.5 w-3.5" />
                                                        Venue
                                                    </div>
                                                    <div className="mt-1 line-clamp-1 text-sm font-black text-text-primary">{event.venue || "TBA"}</div>
                                                </div>
                                                <div className="rounded-2xl bg-white/[0.04] px-3.5 py-2.5">
                                                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
                                                        <Ticket className="h-3.5 w-3.5" />
                                                        Starting
                                                    </div>
                                                    <div className="mt-1 text-lg font-black text-emerald-300">{event.priceRange?.min ? `₹${event.priceRange.min}` : "Paid"}</div>
                                                </div>
                                            </div>

                                            {hasLink && link ? (
                                                <div className="mt-2.5 space-y-2.5">
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <div className="rounded-2xl bg-white/[0.04] px-3.5 py-2.5">
                                                            <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Clicks</div>
                                                            <div className="mt-1 text-lg font-black text-text-primary">{link.clicks || 0}</div>
                                                        </div>
                                                        <div className="rounded-2xl bg-white/[0.04] px-3.5 py-2.5">
                                                            <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Sales</div>
                                                            <div className="mt-1 text-lg font-black text-text-primary">{link.conversions || 0}</div>
                                                        </div>
                                                        <div className="rounded-2xl bg-white/[0.04] px-3.5 py-2.5">
                                                            <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Earned</div>
                                                            <div className="mt-1 text-lg font-black text-emerald-300">{formatINR(link.commission || 0)}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => copyLink(link)}
                                                            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-emerald-500/95 px-4 py-3 text-white shadow-[0_0_24px_rgba(16,185,129,0.3)] transition duration-300 hover:scale-[1.02] hover:bg-emerald-500 active:scale-[0.97]"
                                                        >
                                                            {copiedCode === link.code ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                                            <div className="text-sm font-black">{copiedCode === link.code ? "Copied" : "Copy Link"}</div>
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingLink(link)}
                                                            className="flex items-center justify-center gap-2 rounded-full border border-white/12 px-4 py-3 text-text-secondary transition duration-300 hover:bg-white/8 hover:text-text-primary active:scale-[0.97]"
                                                        >
                                                            <PencilLine className="h-4 w-4" />
                                                            <div className="text-sm font-black">Edit</div>
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setSelectedEventIdForModal(event.id)}
                                                    className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500/95 px-4 py-3 text-white shadow-[0_0_24px_rgba(16,185,129,0.3)] transition duration-300 hover:scale-[1.02] hover:bg-emerald-500 active:scale-[0.97] disabled:opacity-60"
                                                >
                                                    <LinkIcon className="h-4 w-4" />
                                                    <div className="text-sm font-black">Get Your Link</div>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            <AnimatePresence>
                {selectedEventIdForModal ? (
                    <GenerateLinkModal
                        promoterId={promoterId || ""}
                        promoterName={promoterName}
                        token={authToken}
                        initialEventId={selectedEventIdForModal}
                        lockEvent
                        onClose={() => setSelectedEventIdForModal(null)}
                        onCreated={(link) => {
                            setMyLinks((prev) => {
                                const withoutEvent = prev.filter((item) => item.eventId !== link.eventId);
                                return [link, ...withoutEvent];
                            });
                        }}
                    />
                ) : null}
            </AnimatePresence>

            <AnimatePresence>
                {editingLink ? (
                    <EditLinkModal
                        link={editingLink}
                        token={authToken}
                        onClose={() => setEditingLink(null)}
                        onSaved={(updatedLink) => {
                            setMyLinks((prev) => prev.map((item) => item.id === updatedLink.id ? { ...item, ...updatedLink } : item));
                            setEditingLink(updatedLink);
                        }}
                    />
                ) : null}
            </AnimatePresence>
        </VenuePageShell>
    );
}
