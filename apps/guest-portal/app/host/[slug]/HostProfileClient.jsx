"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
    BadgeCheck, TrendingUp, Heart, Share2, ArrowLeft,
    Instagram, Twitter, Music, ExternalLink, Calendar, MapPin
} from "lucide-react";
import ShimmerImage from "../../../components/ShimmerImage";
import { useAuth } from "../../../components/providers/AuthProvider";

const SOCIAL_META = {
    instagram: { icon: Instagram, label: "Instagram" },
    twitter: { icon: Twitter, label: "Twitter" },
    soundcloud: { icon: Music, label: "SoundCloud" },
    spotify: { icon: Music, label: "Spotify" },
    website: { icon: ExternalLink, label: "Website" },
};

export default function HostProfileClient({ host }) {
    const { user } = useAuth();
    const [activeContentTab, setActiveContentTab] = useState("posts");
    const [followed, setFollowed] = useState(false);

    const handleFollow = () => {
        if (!user) {
            window.dispatchEvent(new CustomEvent('OPEN_AUTH_MODAL', {
                detail: { intent: "FOLLOW_HOST", targetId: host.id }
            }));
            return;
        }
        setFollowed(f => !f);
    };

    const handleShare = () => {
        if (navigator.share) navigator.share({ title: host.name, url: window.location.href });
        else navigator.clipboard?.writeText(window.location.href);
    };

    const socialLinks = host.socialLinks || {};
    const hasSocials = Object.values(socialLinks).some(Boolean);
    const hasPosts = (host.posts || []).length > 0;
    const hasHighlights = (host.highlights || []).length > 0;
    const hasContent = hasPosts || hasHighlights;

    const nextEventLabel = host.nextEventDate
        ? new Date(host.nextEventDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
        : null;

    return (
        <div className="bg-white dark:bg-[#0A0A0A] min-h-screen">

            {/* ─── Hero ────────────────────────────────────────────────── */}
            <div className="relative h-[62vh] min-h-[400px] max-h-[680px] w-full overflow-hidden">
                {/* Static radial blobs (no animation, matching site's ArtistsSection pattern) */}
                <div className="pointer-events-none absolute inset-0 z-[1]">
                    <div className="absolute left-[14%] top-[18%] h-[20rem] w-[20rem] rounded-full bg-[radial-gradient(circle,rgba(244,74,34,0.18),transparent_72%)] blur-3xl" />
                    <div className="absolute right-[12%] bottom-[10%] h-[18rem] w-[18rem] rounded-full bg-[radial-gradient(circle,rgba(110,140,255,0.14),transparent_72%)] blur-3xl" />
                </div>

                {host.cover || host.coverURL ? (
                    <ShimmerImage
                        src={host.cover || host.coverURL}
                        alt={host.name || host.displayName}
                        fill
                        className="object-cover"
                        priority
                    />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#F44A22]/15 via-black/80 to-black" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/20 z-[2]" />

                {/* Back */}
                <div className="absolute top-6 left-4 sm:left-8 z-20">
                    <Link
                        href="/hosts"
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/15 text-white/70 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                        <ArrowLeft size={12} />
                        Discovery
                    </Link>
                </div>

                {/* Hero content */}
                <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-8 lg:px-12 pb-10 z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        className="flex items-end gap-5"
                    >
                        <div className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-full overflow-hidden border-2 border-white/25 shadow-2xl flex-shrink-0">
                            <ShimmerImage
                                src={host.photoURL || host.avatar || "/events/holi-edit.svg"}
                                alt={host.name || host.displayName}
                                fill
                                className="object-cover"
                            />
                        </div>

                        <div className="flex-1 min-w-0 pb-1">
                            <div className="flex items-center flex-wrap gap-2 mb-2">
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[9px] font-black uppercase tracking-[0.3em] text-white/60 backdrop-blur-sm">
                                    <span className="h-1.5 w-1.5 rounded-full bg-[#F44A22]" />
                                    {host.role ?? "Host"}
                                </span>
                                {host.verified && (
                                    <div className="h-6 w-6 rounded-full bg-[#F44A22] flex items-center justify-center">
                                        <BadgeCheck size={13} className="text-white" />
                                    </div>
                                )}
                                {host.trending && (
                                    <div className="h-6 w-6 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
                                        <TrendingUp size={13} className="text-white/70" />
                                    </div>
                                )}
                            </div>
                            <h1 className="text-3xl sm:text-4xl md:text-5xl font-heading font-black uppercase tracking-tight text-white leading-tight">
                                {host.name ?? host.displayName ?? "Unnamed Host"}
                            </h1>
                            {host.neighborhood && (
                                <p className="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-white/40">
                                    <MapPin size={10} />
                                    {host.neighborhood}
                                </p>
                            )}
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* ─── Stats + Actions ─────────────────────────────────────── */}
            <div className="border-b border-black/5 dark:border-white/[0.06]">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12 py-6 flex flex-wrap items-center justify-between gap-5">
                    <div className="flex gap-8">
                        <div>
                            <p className="text-2xl font-black text-black dark:text-white tabular-nums">{(host.followers ?? 0).toLocaleString('en-IN')}</p>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40 mt-0.5">Followers</p>
                        </div>
                        <div>
                            <p className="text-2xl font-black text-black dark:text-white tabular-nums">{host.upcomingEventsCount ?? 0}</p>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40 mt-0.5">Events</p>
                        </div>
                        {nextEventLabel && (
                            <div className="hidden sm:block">
                                <p className="text-sm font-black bg-gradient-to-r from-[#F44A22] to-[#FF6B4A] bg-clip-text text-transparent">{nextEventLabel}</p>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40 mt-0.5">Next Event</p>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleFollow}
                            className={`flex items-center gap-2 px-7 py-3 rounded-full text-[11px] font-black uppercase tracking-widest transition-all hover:opacity-90 active:scale-95 shadow-lg ${
                                followed
                                    ? "bg-[#F44A22] text-white shadow-[#F44A22]/20"
                                    : "bg-black dark:bg-white text-white dark:text-black"
                            }`}
                        >
                            <Heart size={13} fill={followed ? "currentColor" : "none"} />
                            {followed ? "Following" : "Follow"}
                        </button>
                        <button
                            onClick={handleShare}
                            className="flex h-11 w-11 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white transition-all active:scale-90"
                        >
                            <Share2 size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ─── Body ─────────────────────────────────────────────────── */}
            <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">

                    {/* Left */}
                    <div className="lg:col-span-2 space-y-10">

                        {(host.bio || host.tagline) && (
                            <motion.div
                                initial={{ opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            >
                                {host.tagline && (
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#F44A22] mb-3">{host.tagline}</p>
                                )}
                                {host.bio && (
                                    <p className="text-base leading-relaxed text-black/65 dark:text-white/55 font-medium">{host.bio}</p>
                                )}
                            </motion.div>
                        )}

                        {(host.genres || host.vibes || []).length > 0 && (
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="h-px w-8 bg-gradient-to-r from-[#F44A22] to-[#FF6B4A]" />
                                    <p className="text-[9px] font-black uppercase tracking-[0.35em] text-black/30 dark:text-white/30">Sound</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(host.genres || host.vibes || []).map(g => (
                                        <span key={g} className="px-4 py-2 rounded-full bg-[#F44A22]/8 border border-[#F44A22]/20 text-[10px] font-black uppercase tracking-widest text-[#F44A22]">
                                            {g}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {(host.styleTags || []).length > 0 && (
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="h-px w-8 bg-gradient-to-r from-[#F44A22] to-[#FF6B4A]" />
                                    <p className="text-[9px] font-black uppercase tracking-[0.35em] text-black/30 dark:text-white/30">Style</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(host.styleTags || []).map(t => (
                                        <span key={t} className="px-4 py-2 rounded-full bg-black/[0.04] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 text-[10px] font-bold uppercase tracking-widest text-black/50 dark:text-white/50">
                                            {t}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {hasSocials && (
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="h-px w-8 bg-gradient-to-r from-[#F44A22] to-[#FF6B4A]" />
                                    <p className="text-[9px] font-black uppercase tracking-[0.35em] text-black/30 dark:text-white/30">Links</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(socialLinks).map(([platform, url]) => {
                                        if (!url) return null;
                                        const meta = SOCIAL_META[platform];
                                        const Icon = meta?.icon || ExternalLink;
                                        return (
                                            <a
                                                key={platform}
                                                href={url.startsWith('http') ? url : `https://${url}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/[0.04] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-black/60 dark:text-white/60 hover:border-black/20 dark:hover:border-white/20 hover:text-black dark:hover:text-white transition-all"
                                            >
                                                <Icon size={12} />
                                                {meta?.label || platform}
                                            </a>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right */}
                    <div className="space-y-5">
                        {nextEventLabel && (
                            <div className="p-5 rounded-[24px] bg-[#F44A22]/8 border border-[#F44A22]/20">
                                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#F44A22] mb-2">Next Event</p>
                                <p className="text-lg font-black text-black dark:text-white">{nextEventLabel}</p>
                            </div>
                        )}

                        {(host.upcomingEvents || []).length > 0 && (
                            <div>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="h-px w-6 bg-gradient-to-r from-[#F44A22] to-[#FF6B4A]" />
                                    <p className="text-[9px] font-black uppercase tracking-[0.35em] text-black/30 dark:text-white/30">Upcoming</p>
                                </div>
                                <div className="space-y-2">
                                    {(host.upcomingEvents || []).slice(0, 3).map(event => (
                                        <Link
                                            key={event.id}
                                            href={`/event/${event.slug || event.id}`}
                                            className="flex items-center gap-3 p-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/8 dark:border-white/8 hover:border-[#F44A22]/30 transition-all group"
                                        >
                                            {event.coverImage && (
                                                <div className="relative h-11 w-11 rounded-xl overflow-hidden flex-shrink-0">
                                                    <ShimmerImage src={event.coverImage} alt={event.title} fill className="object-cover" />
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-xs font-black text-black dark:text-white truncate">{event.title}</p>
                                                <p className="text-[9px] text-black/40 dark:text-white/40 font-bold uppercase tracking-wider mt-0.5">
                                                    {event.startDate ? new Date(event.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                                                </p>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        <Link
                            href={`/explore?host=${host.slug || host.id}`}
                            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03] text-[10px] font-black uppercase tracking-widest text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white hover:border-black/20 dark:hover:border-white/20 transition-all"
                        >
                            <Calendar size={12} />
                            See All Events
                        </Link>
                    </div>
                </div>

                {/* Posts / Highlights */}
                {hasContent && (
                    <div className="mt-16 pt-10 border-t border-black/5 dark:border-white/[0.06]">
                        <div className="flex items-center gap-1 p-1 bg-black/[0.04] dark:bg-white/[0.04] rounded-2xl border border-black/10 dark:border-white/10 w-fit mb-8">
                            {hasPosts && (
                                <button
                                    onClick={() => setActiveContentTab("posts")}
                                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                        activeContentTab === "posts"
                                            ? "bg-white dark:bg-black/60 text-black dark:text-white shadow-sm"
                                            : "text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white"
                                    }`}
                                >
                                    Posts
                                </button>
                            )}
                            {hasHighlights && (
                                <button
                                    onClick={() => setActiveContentTab("highlights")}
                                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                        activeContentTab === "highlights"
                                            ? "bg-white dark:bg-black/60 text-black dark:text-white shadow-sm"
                                            : "text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white"
                                    }`}
                                >
                                    Highlights
                                </button>
                            )}
                        </div>

                        <AnimatePresence mode="wait">
                            {activeContentTab === "posts" && hasPosts && (
                                <motion.div
                                    key="posts"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ duration: 0.3 }}
                                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
                                >
                                    {(host.posts || []).map(post => (
                                        <div key={post.id} className="rounded-[24px] overflow-hidden border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
                                            {post.imageUrl && (
                                                <div className="relative aspect-[4/3] w-full">
                                                    <ShimmerImage src={post.imageUrl} alt="post" fill className="object-cover" />
                                                </div>
                                            )}
                                            {post.content && (
                                                <div className="p-4">
                                                    <p className="text-sm text-black/65 dark:text-white/55 leading-relaxed line-clamp-3 font-medium">{post.content}</p>
                                                    {post.createdAt && (
                                                        <p className="mt-2 text-[9px] font-bold uppercase tracking-widest text-black/30 dark:text-white/30">
                                                            {new Date(post.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </motion.div>
                            )}
                            {activeContentTab === "highlights" && hasHighlights && (
                                <motion.div
                                    key="highlights"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ duration: 0.3 }}
                                    className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
                                >
                                    {(host.highlights || []).map(hl => (
                                        <div key={hl.id} className="rounded-[20px] overflow-hidden border border-black/10 dark:border-white/10">
                                            {hl.images?.[0] && (
                                                <div className="relative aspect-square">
                                                    <ShimmerImage src={hl.images[0]} alt={hl.title} fill className="object-cover" />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                                                    <p className="absolute bottom-3 left-3 right-3 text-[10px] font-black uppercase tracking-widest text-white truncate">{hl.title}</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            <div className="py-16" />
        </div>
    );
}
