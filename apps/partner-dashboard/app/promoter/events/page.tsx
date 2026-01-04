"use client";

import { useState, useEffect } from "react";
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

    const filteredEvents = events.filter(event =>
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.venue.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-headline">Discover Events</h1>
                <p className="text-body-sm text-[#86868b] mt-1">
                    Find events to promote and earn commission on every sale
                </p>
            </div>

            {/* Search and Filters */}
            <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search events..."
                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#f5f5f7] border border-transparent text-[15px] focus:outline-none focus:border-[#007aff] focus:bg-white transition-all"
                    />
                </div>
                <select
                    value={selectedCity}
                    onChange={(e) => {
                        setSelectedCity(e.target.value);
                        fetchEvents();
                    }}
                    className="px-4 py-3 rounded-xl bg-[#f5f5f7] border border-transparent text-[15px] focus:outline-none focus:border-[#007aff] focus:bg-white transition-all appearance-none cursor-pointer"
                >
                    <option value="">All Cities</option>
                    <option value="Pune">Pune</option>
                    <option value="Mumbai">Mumbai</option>
                    <option value="Goa">Goa</option>
                    <option value="Bengaluru">Bengaluru</option>
                </select>
            </div>

            {/* Events Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="card animate-pulse">
                            <div className="aspect-[4/3] bg-[#f5f5f7]" />
                            <div className="p-4 space-y-3">
                                <div className="h-5 w-3/4 bg-[#f5f5f7] rounded" />
                                <div className="h-4 w-1/2 bg-[#f5f5f7] rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : filteredEvents.length === 0 ? (
                <div className="card p-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-[#f5f5f7] flex items-center justify-center mx-auto mb-4">
                        <Calendar className="w-8 h-8 text-[#86868b]" />
                    </div>
                    <h3 className="text-headline-sm mb-2">No Events Available</h3>
                    <p className="text-body-sm text-[#86868b]">
                        Check back later for new events to promote.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredEvents.map(event => {
                        const eventLink = getLink(event.id);
                        const hasExistingLink = hasLink(event.id);

                        return (
                            <motion.div
                                key={event.id}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="card overflow-hidden group"
                            >
                                {/* Image */}
                                <div className="aspect-[4/3] bg-[#f5f5f7] relative overflow-hidden">
                                    {event.image ? (
                                        <img
                                            src={event.image}
                                            alt={event.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Calendar className="w-12 h-12 text-[#86868b]" />
                                        </div>
                                    )}

                                    {/* Commission Badge */}
                                    <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-[#34c759] text-white text-[13px] font-semibold shadow-lg">
                                        {event.commissionRate}% Commission
                                    </div>

                                    {/* Active Link Indicator */}
                                    {hasExistingLink && (
                                        <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-[#007aff] text-white text-[11px] font-semibold shadow-lg flex items-center gap-1">
                                            <Check className="w-3 h-3" /> Active Link
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="p-4">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <span className="text-[11px] font-medium text-[#007aff] uppercase tracking-wide">
                                                {event.category}
                                            </span>
                                            <h3 className="text-[17px] font-semibold text-[#1d1d1f] mt-1 line-clamp-1">
                                                {event.title}
                                            </h3>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 mb-4">
                                        <div className="flex items-center gap-2 text-[13px] text-[#6e6e73]">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {new Date(event.startDate).toLocaleDateString("en-IN", {
                                                weekday: "short",
                                                day: "numeric",
                                                month: "short"
                                            })} • {event.time}
                                        </div>
                                        <div className="flex items-center gap-2 text-[13px] text-[#6e6e73]">
                                            <MapPin className="w-3.5 h-3.5" />
                                            {event.venue}, {event.city}
                                        </div>
                                        <div className="flex items-center gap-2 text-[13px] text-[#6e6e73]">
                                            <Ticket className="w-3.5 h-3.5" />
                                            ₹{event.priceRange.min}+
                                        </div>
                                    </div>

                                    {/* Stats */}
                                    <div className="flex items-center gap-4 py-3 border-t border-[rgba(0,0,0,0.06)]">
                                        <div className="flex items-center gap-1.5 text-[13px] text-[#86868b]">
                                            <Users className="w-3.5 h-3.5" />
                                            {event.stats.interested} interested
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[13px] text-[#34c759]">
                                            <Percent className="w-3.5 h-3.5" />
                                            {event.commissionRate}% per sale
                                        </div>
                                    </div>

                                    {/* Action */}
                                    {hasExistingLink && eventLink ? (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 p-2 rounded-lg bg-[#f5f5f7]">
                                                <LinkIcon className="w-4 h-4 text-[#007aff]" />
                                                <span className="flex-1 text-[13px] font-mono text-[#1d1d1f]">
                                                    {eventLink.code}
                                                </span>
                                                <button
                                                    onClick={() => copyLink(eventLink.code)}
                                                    className="p-1.5 rounded-md hover:bg-white text-[#86868b] hover:text-[#007aff] transition-colors"
                                                >
                                                    {copiedCode === eventLink.code ? (
                                                        <Check className="w-4 h-4 text-[#34c759]" />
                                                    ) : (
                                                        <Copy className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-center">
                                                <div className="p-2 rounded-lg bg-[#f5f5f7]">
                                                    <p className="text-[15px] font-semibold text-[#1d1d1f]">{eventLink.clicks}</p>
                                                    <p className="text-[11px] text-[#86868b]">Clicks</p>
                                                </div>
                                                <div className="p-2 rounded-lg bg-[#f5f5f7]">
                                                    <p className="text-[15px] font-semibold text-[#1d1d1f]">{eventLink.conversions}</p>
                                                    <p className="text-[11px] text-[#86868b]">Sales</p>
                                                </div>
                                                <div className="p-2 rounded-lg bg-[#34c759]/10">
                                                    <p className="text-[15px] font-semibold text-[#34c759]">₹{eventLink.commission}</p>
                                                    <p className="text-[11px] text-[#34c759]">Earned</p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => generateLink(event.id)}
                                            disabled={generatingLink === event.id}
                                            className="w-full btn btn-primary flex items-center justify-center gap-2"
                                        >
                                            {generatingLink === event.id ? (
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <LinkIcon className="w-4 h-4" />
                                            )}
                                            {generatingLink === event.id ? "Generating..." : "Get Your Link"}
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
