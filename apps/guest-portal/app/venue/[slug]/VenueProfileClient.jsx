"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
    BadgeCheck, Heart, Share2, ArrowLeft, MapPin,
    Calendar, Wifi, Car, Star, Shield, Music
} from "lucide-react";
import ShimmerImage from "../../../components/ShimmerImage";
import { useAuth } from "../../../components/providers/AuthProvider";
import { saveIntent } from "../../../lib/utils/intentStore";
import { followVenue, getVenueFollowStatus, unfollowVenue } from "../../../features/social/api/socialApi";

const FACILITY_ICONS = {
    parking: Car, wifi: Wifi, vip: Star, bar: Music, security: Shield,
};

export default function VenueProfileClient({ venue }) {
    const { user } = useAuth();
    const [followed, setFollowed] = useState(false);
    const [followersCount, setFollowersCount] = useState(venue.followers || 0);
    const [isFollowLoading, setIsFollowLoading] = useState(false);
    const [galleryOpen, setGalleryOpen] = useState(null);

    useEffect(() => {
        setFollowersCount(venue.followers || 0);
    }, [venue.followers]);

    useEffect(() => {
        if (!user || !venue?.id) return;
        getVenueFollowStatus(venue.id)
            .then(setFollowed)
            .catch(() => {});
    }, [user, venue?.id]);

    const handleFollow = async () => {
        if (isFollowLoading) return;
        if (!user) {
            saveIntent("FOLLOW_VENUE", null, { targetId: venue.id, targetType: "venue" });
            window.dispatchEvent(new CustomEvent("OPEN_AUTH_MODAL", {
                detail: { intent: "FOLLOW_VENUE", targetId: venue.id }
            }));
            return;
        }

        const nextStatus = !followed;
        setFollowed(nextStatus);
        setFollowersCount((prev) => nextStatus ? prev + 1 : Math.max(0, prev - 1));
        setIsFollowLoading(true);

        try {
            if (nextStatus) {
                await followVenue(venue.id);
            } else {
                await unfollowVenue(venue.id);
            }
        } catch {
            setFollowed(!nextStatus);
            setFollowersCount((prev) => !nextStatus ? prev + 1 : Math.max(0, prev - 1));
        } finally {
            setIsFollowLoading(false);
        }
    };

    const handleShare = () => {
        if (navigator.share) navigator.share({ title: venue.name, url: window.location.href });
        else navigator.clipboard?.writeText(window.location.href);
    };

    const imageUrl = venue.image || venue.coverURL || venue.bannerImage;
    const galleryPhotos = venue.gallery || venue.photos || [];
    const facilities = venue.facilities || [];
    const upcomingEvents = venue.upcomingEvents || [];
    const genres = venue.genres || venue.vibes || [];

    return (
        <div className="bg-white dark:bg-[#0A0A0A] min-h-screen">

            {/* ─── Hero ────────────────────────────────────────────────── */}
            <div className="relative h-[62vh] min-h-[400px] max-h-[680px] w-full overflow-hidden">
                {/* Static radial blobs */}
                <div className="pointer-events-none absolute inset-0 z-[1]">
                    <div className="absolute left-[10%] top-[15%] h-[22rem] w-[22rem] rounded-full bg-[radial-gradient(circle,rgba(244,74,34,0.14),transparent_72%)] blur-3xl" />
                    <div className="absolute right-[8%] bottom-[8%] h-[18rem] w-[18rem] rounded-full bg-[radial-gradient(circle,rgba(80,220,150,0.10),transparent_72%)] blur-3xl" />
                </div>

                {imageUrl ? (
                    <ShimmerImage src={imageUrl} alt={venue.name || venue.displayName} fill className="object-cover" priority />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-black/80 to-black" />
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

                {/* Badges */}
                <div className="absolute top-6 right-4 sm:right-8 z-20 flex flex-col gap-2 items-end">
                    {venue.isVerified && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F44A22] text-white shadow ring-1 ring-white/20">
                            <BadgeCheck size={15} />
                        </div>
                    )}
                    {venue.venueType && (
                        <span className="px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md text-[9px] font-black uppercase tracking-widest text-white/70 border border-white/15">
                            {venue.venueType}
                        </span>
                    )}
                    {venue.tablesAvailable && (
                        <span className="px-3 py-1.5 rounded-full bg-[#F44A22]/90 text-[9px] font-black uppercase tracking-widest text-white">
                            Tables Available
                        </span>
                    )}
                </div>

                {/* Hero text */}
                <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-8 lg:px-12 pb-10 z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[9px] font-black uppercase tracking-[0.3em] text-white/60 backdrop-blur-sm">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#F44A22]" />
                                {venue.neighborhood ?? venue.area ?? venue.city ?? 'Pune, IN'}
                            </span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-black uppercase tracking-tight text-white leading-tight">
                            {venue.name ?? venue.displayName ?? "Unnamed Venue"}
                        </h1>
                        {genres.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                                {genres.slice(0, 4).map(g => (
                                    <span key={g} className="px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-sm text-[9px] font-bold uppercase tracking-widest text-white/60">
                                        {g}
                                    </span>
                                ))}
                            </div>
                        )}
                    </motion.div>
                </div>
            </div>

            {/* ─── Stats + Actions ─────────────────────────────────────── */}
            <div className="border-b border-black/5 dark:border-white/[0.06]">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12 py-6 flex flex-wrap items-center justify-between gap-5">
                    <div className="flex gap-8">
                        <div>
                            <p className="text-2xl font-black text-black dark:text-white tabular-nums">{followersCount.toLocaleString('en-IN')}</p>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40 mt-0.5">Followers</p>
                        </div>
                        {upcomingEvents.length > 0 && (
                            <div>
                                <p className="text-2xl font-black text-black dark:text-white tabular-nums">{upcomingEvents.length}</p>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40 mt-0.5">Upcoming Events</p>
                            </div>
                        )}
                        {galleryPhotos.length > 0 && (
                            <div className="hidden sm:block">
                                <p className="text-2xl font-black text-black dark:text-white tabular-nums">{galleryPhotos.length}</p>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40 mt-0.5">Photos</p>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleFollow}
                            className={`flex items-center gap-2 px-7 py-3 rounded-full text-[11px] font-black uppercase tracking-widest transition-all hover:opacity-90 active:scale-95 shadow-lg ${
                                followed
                                    ? "bg-[#F44A22] text-white"
                                    : "bg-black dark:bg-white text-white dark:text-black"
                            }`}
                            disabled={isFollowLoading}
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
            <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12 py-12 space-y-14">

                {/* About */}
                {(venue.bio || venue.description) && (
                    <motion.section
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <div className="flex items-center gap-3 mb-5">
                            <div className="h-1 w-8 bg-gradient-to-r from-[#F44A22] to-[#FF6B4A] rounded-full" />
                            <p className="text-xs font-black uppercase tracking-[0.3em] text-[#F44A22]">About</p>
                        </div>
                        <p className="text-base leading-relaxed text-black/65 dark:text-white/55 font-medium max-w-3xl">
                            {venue.bio || venue.description}
                        </p>
                    </motion.section>
                )}

                {/* Facilities */}
                {facilities.length > 0 && (
                    <section>
                        <div className="flex items-center gap-3 mb-5">
                            <div className="h-1 w-8 bg-gradient-to-r from-[#F44A22] to-[#FF6B4A] rounded-full" />
                            <p className="text-xs font-black uppercase tracking-[0.3em] text-[#F44A22]">Facilities</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {facilities.map((f, i) => {
                                const FacIcon = FACILITY_ICONS[(f.name || f)?.toLowerCase()] || Shield;
                                return (
                                    <div key={i} className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-black/[0.04] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 text-[10px] font-bold uppercase tracking-widest text-black/60 dark:text-white/50">
                                        <FacIcon size={12} />
                                        {f.name || f}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Gallery */}
                {galleryPhotos.length > 0 && (
                    <section>
                        <div className="flex items-center gap-3 mb-5">
                            <div className="h-1 w-8 bg-gradient-to-r from-[#F44A22] to-[#FF6B4A] rounded-full" />
                            <p className="text-xs font-black uppercase tracking-[0.3em] text-[#F44A22]">Gallery</p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            {galleryPhotos.slice(0, 12).map((photo, i) => {
                                const src = typeof photo === "string" ? photo : (photo.url || photo.imageUrl);
                                return (
                                    <motion.button
                                        key={i}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setGalleryOpen(i)}
                                        className="relative aspect-square rounded-[20px] overflow-hidden border border-black/10 dark:border-white/10 group"
                                    >
                                        <ShimmerImage src={src} alt={`Gallery ${i + 1}`} fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
                                    </motion.button>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Upcoming Events */}
                {upcomingEvents.length > 0 && (
                    <section>
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <div className="h-1 w-8 bg-gradient-to-r from-[#F44A22] to-[#FF6B4A] rounded-full" />
                                <p className="text-xs font-black uppercase tracking-[0.3em] text-[#F44A22]">Upcoming Events</p>
                            </div>
                            <Link href={`/explore?venue=${venue.slug || venue.id}`} className="group flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors">
                                See all
                                <svg className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </Link>
                        </div>
                        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
                            {upcomingEvents.slice(0, 8).map(event => (
                                <Link
                                    key={event.id}
                                    href={`/event/${event.slug || event.id}`}
                                    className="flex-shrink-0 snap-start w-[200px] sm:w-[240px] rounded-[24px] overflow-hidden border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] hover:border-[#F44A22]/30 transition-all group"
                                >
                                    {event.coverImage && (
                                        <div className="relative aspect-[4/3] w-full overflow-hidden">
                                            <ShimmerImage src={event.coverImage} alt={event.title} fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
                                        </div>
                                    )}
                                    <div className="p-3">
                                        <p className="text-xs font-black text-black dark:text-white truncate">{event.title}</p>
                                        {event.startDate && (
                                            <p className="text-[9px] text-black/40 dark:text-white/40 font-bold uppercase tracking-wider mt-1">
                                                {new Date(event.startDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                                            </p>
                                        )}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            {/* Gallery lightbox */}
            <AnimatePresence>
                {galleryOpen !== null && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setGalleryOpen(null)}
                        className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            onClick={e => e.stopPropagation()}
                            className="relative max-w-3xl w-full aspect-square rounded-[32px] overflow-hidden"
                        >
                            {(() => {
                                const photo = galleryPhotos[galleryOpen];
                                const src = typeof photo === "string" ? photo : (photo?.url || photo?.imageUrl);
                                return <ShimmerImage src={src} alt="Gallery" fill className="object-contain" />;
                            })()}
                        </motion.div>
                        <button
                            onClick={() => setGalleryOpen(null)}
                            className="absolute top-6 right-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-all font-bold text-lg"
                        >
                            ✕
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="py-16" />
        </div>
    );
}
