"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import EventCard from "../../../components/EventCard";
import {
    Calendar,
    Layout,
    Info,
    Heart,
    Eye,
    Clock,
    Music,
    Instagram,
    Twitter,
    Globe,
    MapPin,
    Mail,
    ShieldCheck,
    TrendingUp,
    ChevronRight,
    Camera,
    Phone
} from "lucide-react";

export default function ProfileClient({ upcomingEvents, pastEvents, posts, highlights, venue }) {
    const [activeTab, setActiveTab] = useState("events");
    const [eventFilter, setEventFilter] = useState("upcoming");

    const tabs = [
        { id: "events", label: "Schedule", icon: Calendar },
        { id: "posts", label: "Timeline", icon: Layout },
        { id: "gallery", label: "Gallery", icon: Camera },
        { id: "about", label: "About", icon: Info }
    ];

    return (
        <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-24 pb-32">
            {/* Highlights - Story Style */}
            {highlights && highlights.length > 0 && (
                <div className="flex gap-8 overflow-x-auto py-10 no-scrollbar mb-10 max-w-7xl mx-auto px-2">
                    {highlights.map((h) => (
                        <div key={h.id} className="flex flex-col items-center gap-4 flex-shrink-0 group cursor-pointer">
                            <div className="relative p-1 rounded-full border-2 border-emerald-500/30 group-hover:border-emerald-500 transition-all">
                                <div
                                    className="w-20 h-20 rounded-full border border-[var(--border-primary)] flex items-center justify-center overflow-hidden bg-[var(--surface-2)] shadow-xl"
                                    style={h.color ? { backgroundColor: `${h.color}20` } : {}}
                                >
                                    {h.imageUrl ? (
                                        <img src={h.imageUrl} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                        <Camera className="h-6 w-6 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" style={h.color ? { color: h.color } : {}} />
                                    )}
                                </div>
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                                {h.title || 'MOMENT'}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Apple Style Segmented Tabs */}
            <div className="flex justify-center mb-16">
                <div className="flex p-1 bg-[var(--surface-2)] rounded-2xl border border-[var(--border-secondary)]">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 py-2.5 px-6 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === tab.id
                                ? "bg-[var(--surface-1)] text-[var(--text-primary)] shadow-sm"
                                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                                }`}
                        >
                            <tab.icon className="h-3.5 w-3.5" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                >
                    {activeTab === "events" && (
                        <div className="space-y-12">
                            {/* Inner Filters - Minimal Pills */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setEventFilter("upcoming")}
                                    className={`px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border ${eventFilter === "upcoming"
                                        ? "bg-[var(--text-primary)] text-[var(--bg-color)] border-[var(--text-primary)]"
                                        : "bg-transparent text-[var(--text-secondary)] border-[var(--border-primary)] hover:border-[var(--text-muted)]"
                                        }`}
                                >
                                    Upcoming ({upcomingEvents.length})
                                </button>
                                <button
                                    onClick={() => setEventFilter("past")}
                                    className={`px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border ${eventFilter === "past"
                                        ? "bg-[var(--text-primary)] text-[var(--bg-color)] border-[var(--text-primary)]"
                                        : "bg-transparent text-[var(--text-secondary)] border-[var(--border-primary)] hover:border-[var(--text-muted)]"
                                        }`}
                                >
                                    Archive ({pastEvents.length})
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
                                {(eventFilter === "upcoming" ? upcomingEvents : pastEvents).map(event => (
                                    <EventCard
                                        key={event.id}
                                        event={event}
                                        isPast={eventFilter === "past"}
                                    />
                                ))}
                                {(eventFilter === "upcoming" ? upcomingEvents : pastEvents).length === 0 && (
                                    <div className="col-span-full py-32 text-center border-2 border-dashed border-[var(--border-secondary)] rounded-[3rem]">
                                        <p className="text-[var(--text-muted)] text-[11px] font-bold uppercase tracking-[0.3em]">
                                            No {eventFilter === "upcoming" ? "upcoming" : "past"} events scheduled
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === "posts" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {posts.map(post => (
                                <div key={post.id} className="p-0 rounded-[2.5rem] bg-[var(--surface-1)] border border-[var(--border-primary)] overflow-hidden hover:border-[var(--text-muted)] transition-all group shadow-sm hover:shadow-md">
                                    {post.imageUrl && (
                                        <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-[var(--border-secondary)]">
                                            <img src={post.imageUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="" />
                                        </div>
                                    )}

                                    <div className="p-8 space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="h-6 w-6 rounded-full bg-[var(--surface-2)] border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-bold">
                                                    {venue.name.charAt(0)}
                                                </div>
                                                <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest">
                                                    {new Date(post.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </span>
                                            </div>
                                        </div>

                                        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed font-medium">
                                            {post.content}
                                        </p>

                                        <div className="flex items-center gap-6 pt-4 border-t border-[var(--border-secondary)]">
                                            <button className="flex items-center gap-1.5 text-[var(--text-muted)] hover:text-rose-500 transition-colors">
                                                <Heart className="h-4 w-4" />
                                                <span className="text-[11px] font-bold">{post.likes || 0}</span>
                                            </button>
                                            <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                                                <Eye className="h-4 w-4" />
                                                <span className="text-[11px] font-bold">{post.views || 0}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {posts.length === 0 && (
                                <div className="col-span-full py-32 text-center border-2 border-dashed border-[var(--border-secondary)] rounded-[3rem]">
                                    <p className="text-[var(--text-muted)] text-[11px] font-bold uppercase tracking-[0.3em]">
                                        Nothing posted yet
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                    {activeTab === "gallery" && (
                        <div className="space-y-12">
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                                <div>
                                    <h3 className="text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)]">Media Gallery</h3>
                                    <p className="text-[12px] text-[var(--text-muted)] font-bold uppercase tracking-widest mt-2">Visual journey of {venue.displayName || venue.name}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {venue.photos?.map((photo, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="relative aspect-square rounded-[2rem] overflow-hidden border border-[var(--border-primary)] group"
                                    >
                                        <img src={photo} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" alt="" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </motion.div>
                                ))}
                                {(!venue.photos || venue.photos.length === 0) && (
                                    <div className="col-span-full py-32 text-center border-2 border-dashed border-[var(--border-secondary)] rounded-[3rem]">
                                        <p className="text-[var(--text-muted)] text-[11px] font-bold uppercase tracking-[0.3em]">
                                            No media in gallery yet
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === "about" && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
                            {/* Main Info */}
                            <div className="lg:col-span-2 space-y-16">
                                <section className="space-y-8">
                                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)] flex items-center gap-3">
                                        Collective Story
                                    </h3>
                                    <p className="text-xl md:text-2xl text-[var(--text-primary)] leading-relaxed font-medium">
                                        {venue.bio || venue.description || "A space curated for exceptional experiences."}
                                    </p>
                                </section>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <section className="space-y-4">
                                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                                            Atmosphere
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {venue.genres?.map(genre => (
                                                <span key={genre} className="px-4 py-1.5 rounded-full border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                                    {genre}
                                                </span>
                                            ))}
                                            {(!venue.genres || venue.genres.length === 0) && (
                                                <span className="text-[12px] text-[var(--text-muted)] font-medium">Curated Music • Premium Vibes</span>
                                            )}
                                        </div>
                                    </section>
                                    <section className="space-y-4">
                                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                                            Operations
                                        </h4>
                                        <p className="text-[13px] font-bold text-[var(--text-secondary)] uppercase tracking-wide">Standard • 6:00 PM - 4:00 AM</p>
                                    </section>
                                </div>
                            </div>

                            {/* Sidebar Info */}
                            <div className="space-y-12">
                                <div className="p-10 rounded-[2.5rem] bg-[var(--surface-2)] border border-[var(--border-secondary)] space-y-10">
                                    <div className="space-y-6">
                                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Discovery</h4>
                                        <div className="space-y-5">
                                            {venue.socialLinks?.instagram && (
                                                <a
                                                    href={`https://instagram.com/${venue.socialLinks.instagram.replace('@', '')}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-4 text-[13px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors group"
                                                >
                                                    <Instagram className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
                                                    @{venue.socialLinks.instagram.replace('@', '')}
                                                </a>
                                            )}
                                            {venue.website && (
                                                <a
                                                    href={venue.website.startsWith('http') ? venue.website : `https://${venue.website}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-4 text-[13px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors group"
                                                >
                                                    <Globe className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
                                                    Official Website
                                                </a>
                                            )}
                                            <a href={`mailto:${venue.email || 'hello@c1rcle.in'}`} className="flex items-center gap-4 text-[13px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors group">
                                                <Mail className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
                                                Contact & Inquiry
                                            </a>
                                            {venue.phone && (
                                                <div className="flex items-center gap-4 text-[13px] font-bold text-[var(--text-secondary)]">
                                                    <Phone className="h-4 w-4 text-[var(--text-muted)]" />
                                                    {venue.phone}
                                                </div>
                                            )}
                                            {venue.city && (
                                                <div className="flex items-center gap-4 text-[13px] font-bold text-[var(--text-secondary)]">
                                                    <MapPin className="h-4 w-4 text-[var(--text-muted)]" />
                                                    {venue.city}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="pt-10 border-t border-[var(--border-primary)] space-y-4">
                                        <div className="flex items-center gap-3 text-emerald-600">
                                            <ShieldCheck className="h-5 w-5" />
                                            <span className="text-[10px] font-bold uppercase tracking-widest">Trusted Partner</span>
                                        </div>
                                        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed font-medium">
                                            Verified by C1RCLE Security for authentic operations and guest safety.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
