"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import ShimmerImage from "../ShimmerImage";
import { Heart, ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { formatEventDate, formatEventTime } from "@c1rcle/core/time";
import { resolvePoster } from "@c1rcle/core/events";

/**
 * Shared EventCard component for THE C1RCLE.
 * Matches user website design pixel-for-pixel.
 */
export default function EventCard({
    event,
    index = 0,
    height = "h-[280px] sm:h-[340px] md:h-[420px]",
    isPreview = false,
    showDemoHover = false,
    device = "desktop"
}) {
    // Computed price logic
    const priceDisplay = useMemo(() => {
        if (!event.tickets || event.tickets.length === 0) {
            if (event.isRSVP) return "Free";
            return event.price ? `₹${Number(event.price).toLocaleString('en-IN')}` : "";
        }

        const paidTiers = event.tickets.filter(t => Number(t.price) > 0);
        if (paidTiers.length === 0) return "Free";

        const lowestPaid = Math.min(...paidTiers.map(t => Number(t.price)));
        return `From ₹${lowestPaid.toLocaleString('en-IN')}`;
    }, [event.tickets, event.isRSVP, event.price]);

    const isFree = priceDisplay === "Free";
    const poster = useMemo(() => resolvePoster(event), [event]);
    const isDefaultImage = !poster || poster.includes("placeholder.svg") || poster.includes("holi-edit.svg");

    // Placeholders
    const displayTitle = event.title || "Your Event Title";
    const displayVenue = event.venueName || event.venue || "Venue";
    const displayCity = event.city || "City";

    // Date/Time Formatting with timezone shift prevention (Using Core IST Utils)
    const displayDate = useMemo(() => {
        return formatEventDate(event.date || event.startDate);
    }, [event.date, event.startDate]);

    const displayTime = useMemo(() => {
        return formatEventTime(event.time || event.startTime, event.date || event.startDate, "");
    }, [event.time, event.startTime, event.date, event.startDate]);

    // Interaction handlers
    const slug = event.id || event.slug || "preview";
    const href = `/event/${slug}`;
    const Wrapper = isPreview ? "div" : Link;
    const wrapperProps = isPreview ? {} : { href };

    const handleCtaClick = (e) => {
        if (isPreview) {
            e.preventDefault();
            e.stopPropagation();
            window.open(href, "_blank");
        }
    };

    return (
        <motion.div
            initial={isPreview ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.5,
                delay: index * 0.1,
                ease: [0.16, 1, 0.3, 1]
            }}
            className={`relative w-full ${device === 'mobile' ? 'max-w-[320px] mx-auto' : 'h-full'}`}
        >
            <Wrapper {...wrapperProps} className={`group relative block h-full w-full ${isPreview ? 'cursor-default' : ''}`}>
                <div className={`gradient-border relative ${height} w-full overflow-hidden rounded-[20px] sm:rounded-[32px] bg-white dark:bg-surface transition-all duration-500 shadow-sm dark:shadow-none ${!isPreview ? 'btn-lift' : ''} ${showDemoHover ? 'translate-y-[-4px] shadow-lg shadow-orange/40' : ''}`}>

                    {/* Image */}
                    <div className={`absolute inset-0 transition-transform duration-700 ${(!isPreview || showDemoHover) ? 'group-hover:scale-110' : ''}`}>
                        <ShimmerImage
                            key={poster || "placeholder"}
                            src={poster || "/events/placeholder.svg"}
                            alt={displayTitle}
                            fill
                            wrapperClassName="h-full w-full"
                            className="object-cover opacity-95 dark:opacity-90 transition-opacity duration-500 group-hover:opacity-100"
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 33vw"
                        />
                    </div>
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 dark:via-black/60 to-transparent opacity-90 transition-opacity duration-500 group-hover:opacity-95" />

                    {/* Content */}
                    <div className="absolute inset-0 flex flex-col justify-between p-3 sm:p-6">

                        {/* Top Tags */}
                        <div className="flex items-start justify-between relative z-30">
                            <div className="flex flex-col gap-2">
                                <span className="inline-flex items-center rounded-full border border-white/20 bg-black/30 dark:bg-black/40 px-2 py-0.5 sm:px-3 sm:py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur-md">
                                    {event.category || "Event"}
                                </span>

                                {event.trending && (
                                    <span className="inline-flex items-center rounded-full border border-orange/40 bg-orange/20 px-2 py-0.5 sm:px-3 sm:py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-orange-light backdrop-blur-md">
                                        Trending
                                    </span>
                                )}

                                {priceDisplay && (
                                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 sm:px-3 sm:py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest backdrop-blur-md ${isFree
                                        ? "border-emerald-400/30 bg-emerald-400/20 text-emerald-300"
                                        : "border-orange/40 bg-gradient-to-r from-orange/20 to-orange-dark/20 text-white"
                                        }`}>
                                        {priceDisplay}
                                    </span>
                                )}
                            </div>

                            {/* Heart Button (Visual only in preview) */}
                            <div className="relative">
                                <div className="group/like flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full border border-white/18 bg-white/12 backdrop-blur-[14px] transition-all duration-300">
                                    <Heart size={20} className="text-white" />
                                </div>
                            </div>
                        </div>

                        {/* Bottom Info */}
                        <div className={`absolute bottom-0 left-0 right-0 p-3 sm:p-6 transform transition-transform duration-500 z-20 ${(!isPreview || showDemoHover) ? 'group-hover:translate-y-[-4px]' : ''}`}>

                            {/* Glass Background on Hover */}
                            <div className={`absolute inset-0 -z-10 bg-black/60 dark:bg-black/40 backdrop-blur-xl transition-all duration-500 rounded-t-[16px] sm:rounded-t-[24px] translate-y-full ${(!isPreview || showDemoHover) ? 'group-hover:translate-y-0 opacity-100' : 'opacity-0'}`} />

                            <div className="relative z-10">
                                <p className="mb-1 sm:mb-2 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-[#f44a22] drop-shadow-md">
                                    {displayDate} {displayTime ? `• ${displayTime}` : ''}
                                </p>
                                <h3 className="mb-1 sm:mb-2 font-heading text-lg sm:text-2xl md:text-3xl font-black leading-[0.9] text-white drop-shadow-lg line-clamp-2 uppercase tracking-tighter">
                                    {displayTitle}
                                </h3>
                                <p className="text-[10px] sm:text-sm font-medium text-white/70 drop-shadow-md line-clamp-1">
                                    {displayVenue}, {displayCity}
                                </p>

                                {/* Social Row / Guestlist */}
                                {event.guests && event.guests.length > 0 && (
                                    <div className="mt-2 sm:mt-4 relative z-10">
                                        <div className="inline-flex items-center gap-1.5 sm:gap-2.5 bg-white/10 border border-white/20 p-1.5 pr-3 sm:p-2 sm:pr-4 rounded-full backdrop-blur-xl">
                                            <div className="flex -space-x-1.5 sm:-space-x-2.5">
                                                {event.guests.slice(0, 3).map((guest, i) => (
                                                    <div
                                                        key={i}
                                                        className="relative h-5 w-5 sm:h-7 sm:w-7 rounded-full ring-1 sm:ring-2 ring-black/50 bg-gradient-to-br from-purple-400 to-pink-400"
                                                        style={{ zIndex: 3 - i }}
                                                    >
                                                        <img
                                                            src={`https://api.dicebear.com/9.x/notionists/svg?seed=${guest}&backgroundColor=c0aede,b6e3f4`}
                                                            alt={guest}
                                                            className="h-full w-full rounded-full object-cover"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-1.5 sm:gap-2">
                                                <span className="text-[10px] sm:text-sm font-bold text-white tracking-tight">
                                                    {event.guests.length}
                                                </span>
                                                <div className="h-1 w-1 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* CTA Button */}
                                <div className={`mt-4 sm:mt-6 flex items-center gap-3 transition-all duration-500 delay-75 ${(!isPreview || showDemoHover) ? 'opacity-100 translate-y-0' : 'opacity-100 translate-y-0'}`}>
                                    <span
                                        onClick={handleCtaClick}
                                        className={`flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black font-black text-[10px] uppercase tracking-widest hover:bg-white/90 transition-all shadow-xl shadow-black/20 ${isPreview ? 'cursor-pointer pointer-events-auto' : ''} active:scale-95`}
                                    >
                                        {isPreview ? 'View Experience' : 'Book Tickets'}
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Wrapper>

            <style jsx>{`
        .gradient-border {
          position: relative;
        }
        .gradient-border::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg, rgba(244, 74, 34, 0.5), rgba(254, 248, 232, 0.3));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .btn-lift {
          transition: all 0.3s ease-out;
        }
        .btn-lift:hover {
          transform: translateY(-4px);
        }
      `}</style>
        </motion.div>
    );
}
