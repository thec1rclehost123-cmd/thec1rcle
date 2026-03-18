"use client";

import { useState, useEffect, useMemo, memo, forwardRef } from "react";
import { VirtuosoGrid } from "react-virtuoso";
import { motion, AnimatePresence } from "framer-motion";
import {
    Calendar,
    MapPin,
    Ticket,
    Percent,
    Link as LinkIcon,
    Copy,
    Check,
    ExternalLink,
    Search,
    Filter,
    TrendingUp,
    Users,
    ChevronRight
} from "lucide-react";
import { useDashboardAuth } from "@/components/providers/DashboardAuthProvider";
import { VenuePageShell } from "@/components/venue-layout/VenuePageShell";
import { CITY_MAP } from "@c1rcle/core/events";

interface PromoterEvent {
    id: string;
    title: string;
    summary: string;
    image: string;
    date: string;
    startDate: string;
    time: string;
    location: string;
    venue: string;
    city: string;
    category: string;
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
}

const GridContainer = forwardRef<HTMLDivElement>((props, ref) => (
    <div {...props} ref={ref} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" />
));
GridContainer.displayName = "GridContainer";

const ItemContainer = forwardRef<HTMLDivElement>((props, ref) => (
    <div {...props} ref={ref} className="h-full w-full" />
));
ItemContainer.displayName = "ItemContainer";

const MemoizedPromoterEventCard = memo(({ event, myLinks, generateLink, generatingLink, copiedCode, copyLink }: any) => {
    const hasExistingLink = myLinks.some((l: any) => l.eventId === event.id && l.isActive);
    const eventLink = myLinks.find((l: any) => l.eventId === event.id && l.isActive);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[32px] bg-surface-elevated border border-border-default overflow-hidden group hover:border-border-strong transition-all duration-200"
        >
            {/* Image */}
            <div className="aspect-[4/3] bg-surface-tertiary relative overflow-hidden">
                {event.image ? (
                    <img
                        src={event.image}
                        alt={event.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Calendar className="w-12 h-12 text-text-placeholder" />
                    </div>
                )}
                {/* Commission Badge */}
                <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold backdrop-blur-sm">
                    {event.commissionRate}% Commission
                </div>
                {hasExistingLink && (
                    <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-[11px] font-bold backdrop-blur-sm flex items-center gap-1">
                        <Check className="w-3 h-3" /> Active Link
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-5">
                <span className="text-[10px] font-black uppercase tracking-widest text-violet-400">
                    {event.category}
                </span>
                <h3 className="text-base font-bold text-text-primary mt-1 mb-3 line-clamp-1">
                    {event.title}
                </h3>

                <div className="space-y-1.5 mb-4">
                    <div className="flex items-center gap-2 text-[12px] text-text-tertiary font-medium">
                        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                        {new Date(event.startDate).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} · {event.time}
                    </div>
                    <div className="flex items-center gap-2 text-[12px] text-text-tertiary font-medium">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        {event.venue}, {event.city}
                    </div>
                    <div className="flex items-center gap-2 text-[12px] text-text-tertiary font-medium">
                        <Ticket className="w-3.5 h-3.5 flex-shrink-0" />
                        ₹{event.priceRange.min}+ entry
                    </div>
                </div>

                {/* Stats strip */}
                <div className="flex items-center gap-4 py-3 border-t border-border-subtle">
                    <div className="flex items-center gap-1.5 text-[12px] text-text-tertiary font-medium">
                        <Users className="w-3.5 h-3.5" />
                        {event.stats.interested} interested
                    </div>
                    <div className="flex items-center gap-1.5 text-[12px] text-emerald-500 font-bold">
                        <Percent className="w-3.5 h-3.5" />
                        {event.commissionRate}% per sale
                    </div>
                </div>

                {/* Action */}
                {hasExistingLink && eventLink ? (
                    <div className="space-y-2 mt-3">
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-surface-secondary border border-border-subtle">
                            <LinkIcon className="w-4 h-4 text-violet-400 flex-shrink-0" />
                            <span className="flex-1 text-[12px] font-mono text-text-secondary truncate">
                                {eventLink.code}
                            </span>
                            <button
                                onClick={() => copyLink(eventLink.code)}
                                className="p-1.5 rounded-xl hover:bg-surface-tertiary text-text-tertiary hover:text-violet-400 transition-colors"
                            >
                                {copiedCode === eventLink.code ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                )}
                            </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            {[
                                { label: "Clicks", value: eventLink.clicks, color: "text-text-primary" },
                                { label: "Sales", value: eventLink.conversions, color: "text-text-primary" },
                                { label: "Earned", value: `₹${eventLink.commission}`, color: "text-emerald-400" },
                            ].map(({ label, value, color }) => (
                                <div key={label} className="py-2 rounded-2xl bg-surface-secondary">
                                    <p className={`text-sm font-black tabular-nums ${color}`}>{value}</p>
                                    <p className="text-[10px] text-text-placeholder uppercase tracking-wider mt-0.5">{label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => generateLink(event.id)}
                        disabled={generatingLink === event.id}
                        className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white text-[12px] font-black uppercase tracking-wide disabled:opacity-50 transition-colors"
                    >
                        {generatingLink === event.id ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <LinkIcon className="w-4 h-4" />
                        )}
                        {generatingLink === event.id ? "Generating…" : "Get Your Link"}
                    </button>
                )}
            </div>
        </motion.div>
    );
});
MemoizedPromoterEventCard.displayName = "MemoizedPromoterEventCard";

export default function PromoterEventsPage() {
    const { profile } = useDashboardAuth();
    const [events, setEvents] = useState<PromoterEvent[]>([]);
    const [myLinks, setMyLinks] = useState<PromoterLink[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCity, setSelectedCity] = useState("");
    const [generatingLink, setGeneratingLink] = useState<string | null>(null);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    const promoterId = profile?.activeMembership?.partnerId;
    const promoterName = profile?.displayName;

    useEffect(() => {
        if (promoterId) {
            fetchEvents();
            fetchMyLinks();
        }
    }, [promoterId]);

    const fetchEvents = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (promoterId) params.set("promoterId", promoterId);
            if (selectedCity) params.set("city", selectedCity);

            const res = await fetch(`/api/promoter/events?${params}`);
            const data = await res.json();
            setEvents(data.events || []);
        } catch (err) {
            console.error("Failed to fetch events:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMyLinks = async () => {
        try {
            const res = await fetch(`/api/promoter/links?promoterId=${promoterId}&isActive=true`);
            const data = await res.json();
            setMyLinks(data.links || []);
        } catch (err) {
            console.error("Failed to fetch links:", err);
        }
    };

    const generateLink = async (eventId: string) => {
        setGeneratingLink(eventId);
        try {
            const res = await fetch("/api/promoter/links", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    promoterId,
                    promoterName,
                    eventId
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to generate link");
            }

            const data = await res.json();
            setMyLinks(prev => [data.link, ...prev]);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setGeneratingLink(null);
        }
    };

    const copyLink = (code: string) => {
        const baseUrl = typeof window !== "undefined"
            ? window.location.origin.replace("partner-dashboard", "guest-portal")
            : "https://thec1rcle.in";
        const link = myLinks.find(l => l.code === code);
        if (link) {
            navigator.clipboard.writeText(`${baseUrl}/e/${link.eventId}?ref=${code}`);
            setCopiedCode(code);
            setTimeout(() => setCopiedCode(null), 2000);
        }
    };

    const hasLink = (eventId: string) => myLinks.some(l => l.eventId === eventId && l.isActive);
    const getLink = (eventId: string) => myLinks.find(l => l.eventId === eventId && l.isActive);

    const filteredEvents = useMemo(() => {
        return events.filter(event =>
            event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            event.venue.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [events, searchQuery]);

    return (
        <VenuePageShell
            title="Discover Events"
            subtitle="Find events to promote and earn commission on every sale"
            filterBar={
                <div className="flex items-center gap-3 w-full">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search events or venues..."
                            className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-surface-secondary border border-border-default text-sm text-text-primary placeholder:text-text-placeholder focus:outline-none focus:border-violet-500/50 transition-all"
                        />
                    </div>
                    <select
                        value={selectedCity}
                        onChange={(e) => { setSelectedCity(e.target.value); fetchEvents(); }}
                        className="px-4 py-2.5 rounded-2xl bg-surface-secondary border border-border-default text-sm text-text-primary focus:outline-none focus:border-violet-500/50 transition-all appearance-none cursor-pointer"
                    >
                        <option value="">All Cities</option>
                        {CITY_MAP.map(city => (
                            <option key={city.key} value={city.label.split(',')[0]}>{city.label}</option>
                        ))}
                    </select>
                </div>
            }
        >
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="rounded-[32px] bg-surface-elevated border border-border-default animate-pulse">
                            <div className="aspect-[4/3] bg-surface-tertiary rounded-t-[32px]" />
                            <div className="p-5 space-y-3">
                                <div className="h-4 w-3/4 bg-surface-tertiary rounded-lg" />
                                <div className="h-3 w-1/2 bg-surface-tertiary rounded-lg" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : filteredEvents.length === 0 ? (
                <div className="py-24 flex flex-col items-center text-center rounded-[32px] bg-surface-elevated border border-border-default border-dashed">
                    <div className="w-16 h-16 rounded-3xl bg-surface-tertiary flex items-center justify-center mb-5">
                        <Calendar className="w-7 h-7 text-text-placeholder" />
                    </div>
                    <h3 className="text-lg font-bold text-text-primary mb-2">No Events Available</h3>
                    <p className="text-sm text-text-tertiary max-w-xs leading-relaxed">
                        Connect with hosts and venues to get assigned to events and start earning commission.
                    </p>
                </div>
            ) : (
                <VirtuosoGrid
                    useWindowScroll
                    data={filteredEvents}
                    components={{ List: GridContainer, Item: ItemContainer }}
                    itemContent={(index, event) => (
                        <MemoizedPromoterEventCard
                            key={event.id}
                            event={event}
                            myLinks={myLinks}
                            generatingLink={generatingLink}
                            copiedCode={copiedCode}
                            generateLink={generateLink}
                            copyLink={copyLink}
                        />
                    )}
                />
            )}
        </VenuePageShell>
    );
}
