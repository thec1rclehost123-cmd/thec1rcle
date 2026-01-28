"use client";

import Image from "next/image";
import {
    CheckCircle2,
    Sparkles,
    Zap,
    Flame,
    Star,
    Clock,
    Users,
    Crown
} from "lucide-react";

// Badge configurations
const BADGE_CONFIG = {
    trending: {
        icon: Flame,
        label: "Trending",
        gradient: "from-orange-500 to-red-500",
        bgClass: "bg-gradient-to-r from-orange-500/20 to-red-500/20 border-orange-500/30",
        textClass: "text-orange-500",
        animate: true
    },
    exclusive: {
        icon: Crown,
        label: "Exclusive",
        gradient: "from-purple-500 to-pink-500",
        bgClass: "bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/30",
        textClass: "text-purple-500",
        animate: false
    },
    tonight: {
        icon: Zap,
        label: "Tonight",
        gradient: "from-[#F44A22] to-[#FF6B4A]",
        bgClass: "bg-gradient-to-r from-[#F44A22]/20 to-[#FF6B4A]/20 border-[#F44A22]/30",
        textClass: "text-[#F44A22]",
        animate: true
    },
    soldOutSoon: {
        icon: Clock,
        label: "Selling Fast",
        gradient: "from-yellow-500 to-orange-500",
        bgClass: "bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/30",
        textClass: "text-yellow-500",
        animate: true
    },
    reservationOnly: {
        icon: Star,
        label: "Reservation Only",
        gradient: "from-emerald-500 to-teal-500",
        bgClass: "bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border-emerald-500/30",
        textClass: "text-emerald-500",
        animate: false
    },
    verified: {
        icon: CheckCircle2,
        label: "Verified",
        gradient: "from-blue-500 to-cyan-500",
        bgClass: "bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-blue-500/30",
        textClass: "text-blue-500",
        animate: false
    },
    new: {
        icon: Sparkles,
        label: "New",
        gradient: "from-pink-500 to-rose-500",
        bgClass: "bg-gradient-to-r from-pink-500/20 to-rose-500/20 border-pink-500/30",
        textClass: "text-pink-500",
        animate: false
    },
    popular: {
        icon: Users,
        label: "Popular",
        gradient: "from-indigo-500 to-purple-500",
        bgClass: "bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border-indigo-500/30",
        textClass: "text-indigo-500",
        animate: false
    }
};

function DynamicBadge({ type }) {
    const config = BADGE_CONFIG[type];
    if (!config) return null;

    const Icon = config.icon;

    return (
        <div className={`flex items-center gap-2 px-4 py-2.5 backdrop-blur-xl border rounded-full shadow-lg ${config.bgClass}`}>
            {config.animate && (
                <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${config.gradient} animate-pulse`} />
            )}
            <Icon className={`h-3.5 w-3.5 ${config.textClass}`} />
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${config.textClass}`}>
                {config.label}
            </span>
        </div>
    );
}

export default function VenueHeroEnhanced({
    venue,
    video = null,
    badges = [],
    stats = null
}) {
    // Determine which badges to show
    const activeBadges = [];

    if (venue.isTrending || badges.includes('trending')) activeBadges.push('trending');
    if (venue.isExclusive || badges.includes('exclusive')) activeBadges.push('exclusive');
    if (venue.hasEventTonight || badges.includes('tonight')) activeBadges.push('tonight');
    if (venue.isSoldOutSoon || badges.includes('soldOutSoon')) activeBadges.push('soldOutSoon');
    if (venue.reservationOnly || badges.includes('reservationOnly')) activeBadges.push('reservationOnly');
    if (venue.verified || badges.includes('verified')) activeBadges.push('verified');
    if (venue.isNew || badges.includes('new')) activeBadges.push('new');

    const coverImage = venue.coverURL || venue.image || "/events/neon-nights.jpg";
    const venueVideo = video || venue.videoURL || venue.coverVideoURL;

    return (
        <section className="relative h-[100svh] w-full overflow-hidden">
            {/* Video or Image Background */}
            <div className="absolute inset-0 z-0">
                {venueVideo ? (
                    <video
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover scale-110"
                    >
                        <source src={venueVideo} type="video/mp4" />
                    </video>
                ) : (
                    <Image
                        src={coverImage}
                        alt={venue.name}
                        fill
                        priority
                        className="object-cover scale-110 animate-slow-zoom"
                    />
                )}

                {/* Cinematic Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-[#0A0A0A] via-white/30 dark:via-[#0A0A0A]/30 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-white/50 dark:from-[#0A0A0A]/50 via-transparent to-white/50 dark:to-[#0A0A0A]/50" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,white_100%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_0%,#0A0A0A_100%)] opacity-70" />

                {/* Film Grain */}
                <div className="absolute inset-0 opacity-[0.02] bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E')]" />
            </div>

            {/* Floating Gradient Orbs */}
            <div className="absolute top-20 right-[10%] w-72 h-72 bg-[#F44A22]/20 rounded-full blur-[100px] animate-pulse opacity-60" />
            <div className="absolute bottom-32 left-[5%] w-96 h-96 bg-[#FF6B4A]/15 rounded-full blur-[120px] animate-pulse delay-1000 opacity-50" />

            {/* Tour Banner Stripes */}
            <div className="absolute inset-0 z-1 pointer-events-none overflow-hidden flex items-center justify-center">
                <div className="absolute h-16 w-[150%] bg-[#F44A22] transform -rotate-12 flex items-center justify-center opacity-80 shadow-2xl">
                    <div className="flex gap-16 whitespace-nowrap animate-marquee">
                        {[1, 2, 3, 4, 5].map(i => (
                            <span key={i} className="text-white text-xs font-black uppercase tracking-[0.5em]">
                                {venue.name} • LIVE IN {venue.city || 'YOUR CITY'} •
                            </span>
                        ))}
                    </div>
                </div>
                <div className="absolute h-16 w-[150%] bg-black transform rotate-12 flex items-center justify-center opacity-90 shadow-2xl translate-y-24">
                    <div className="flex gap-16 whitespace-nowrap animate-marquee-reverse">
                        {[1, 2, 3, 4, 5].map(i => (
                            <span key={i} className="text-white text-xs font-black uppercase tracking-[0.5em]">
                                EXCLUSIVE EXPERIENCE • NO LIMITS • SECURE TICKETS •
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Hero Content */}
            <div className="relative z-10 h-full flex flex-col justify-end pb-24 md:pb-32 px-6 sm:px-12 lg:px-24">
                {/* Dynamic Badges */}
                <div className="flex flex-wrap items-center gap-3 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {/* Venue Type Badge */}
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-black/5 dark:bg-white/5 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-full shadow-lg">
                        <Sparkles className="h-3.5 w-3.5 text-[#F44A22]" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-black/70 dark:text-white/70">
                            {venue.venueType || "Premium Venue"}
                        </span>
                    </div>

                    {/* Dynamic Status Badges */}
                    {activeBadges.slice(0, 3).map(badge => (
                        <DynamicBadge key={badge} type={badge} />
                    ))}

                    {/* Live Follower Count */}
                    {stats?.followers > 0 && (
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#F44A22]/10 to-[#FF6B4A]/10 backdrop-blur-xl border border-[#F44A22]/20 rounded-full shadow-lg">
                            <div className="w-2 h-2 bg-[#F44A22] rounded-full animate-ping" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#F44A22]">
                                {stats.followers.toLocaleString()} Following
                            </span>
                        </div>
                    )}
                </div>

                {/* Venue Name */}
                <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-heading font-black uppercase tracking-tighter leading-[0.85] mb-6 text-black dark:text-white animate-in fade-in slide-in-from-bottom-8 duration-1000">
                    <span className="inline-block">{venue.name}</span>
                </h1>

                {/* Tagline & CTAs */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                    {venue.tagline && (
                        <p className="text-lg md:text-xl text-black/60 dark:text-white/60 font-medium max-w-xl animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-200">
                            "{venue.tagline}"
                        </p>
                    )}

                    <div className="flex gap-4">
                        <button className="px-10 py-5 bg-[#F44A22] text-white rounded-full text-[11px] font-black uppercase tracking-[0.3em] shadow-glow hover:scale-105 transition-all">
                            Secure Your Access
                        </button>
                        <button className="px-10 py-5 bg-white/10 dark:bg-white/5 backdrop-blur-xl border border-white/20 text-black dark:text-white rounded-full text-[11px] font-black uppercase tracking-[0.3em] hover:bg-white/20 transition-all">
                            Explore Vibe
                        </button>
                    </div>
                </div>
            </div>

            {/* Scroll Indicator */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
                <div className="w-6 h-10 rounded-full border-2 border-black/20 dark:border-white/20 flex justify-center pt-2">
                    <div className="w-1.5 h-3 bg-[#F44A22] rounded-full animate-bounce" />
                </div>
            </div>

            {/* Corner Accents */}
            <div className="absolute bottom-0 right-0 w-[40%] h-[30%] bg-gradient-to-tl from-[#F44A22]/20 via-transparent to-transparent blur-2xl pointer-events-none" />
            <div className="absolute top-0 left-0 w-[30%] h-[20%] bg-gradient-to-br from-[#FF6B4A]/10 via-transparent to-transparent blur-2xl pointer-events-none" />
        </section>
    );
}
