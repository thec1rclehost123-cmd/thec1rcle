"use client";

import Link from "next/link";
import Image from "next/image";
import ShimmerImage from "./ShimmerImage";
import { motion } from "framer-motion";
import LikeButton from "./LikeButton";

export default function EventCard({ event, index = 0, height = "h-[280px] sm:h-[340px] md:h-[420px]" }) {
  const price = event.price || "Free";
  const isFree = price === "Free" || price === 0;
  const isDefaultImage = event.image?.includes("holi-edit.svg");

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        ease: [0.16, 1, 0.3, 1]
      }}
      className="h-full"
    >
      <Link href={`/event/${event.id || event.slug}`} className="group relative block h-full w-full">
        <div className={`gradient-border relative ${height} w-full overflow-hidden rounded-[20px] sm:rounded-[32px] bg-white dark:bg-surface transition-all duration-500 btn-lift`}>
          {/* Image or Gradient Fallback */}
          <motion.div
            className="absolute inset-0 transition-transform duration-700 group-hover:scale-105"
            layoutId={`event-image-${event.id || event.slug}`}
          >
            {isDefaultImage ? (
              <div className="h-full w-full bg-gradient-to-br from-iris/20 via-black to-surface" />
            ) : (
              <ShimmerImage
                src={event.image}
                alt={event.title}
                fill
                wrapperClassName="h-full w-full"
                className="object-cover opacity-90 transition-opacity duration-500 group-hover:opacity-70"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 33vw"
                loading="lazy"
              />
            )}
          </motion.div>

          {/* Stronger Gradient Overlay for Text Readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent opacity-90 transition-opacity duration-500 group-hover:opacity-100" />

          {/* Content */}
          <div className="absolute inset-0 flex flex-col justify-between p-3 sm:p-6">
            {/* Top Tags & Like Button */}
            <div className="flex items-start justify-between relative z-30">
              <div className="flex flex-col gap-2">
                <span className="inline-flex items-center rounded-full border border-white/10 bg-black/40 px-2 py-0.5 sm:px-3 sm:py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur-md">
                  {event.category || "Event"}
                </span>
                {isFree ? (
                  <span className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 sm:px-3 sm:py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-emerald-300 backdrop-blur-md">
                    Free
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-gold/40 bg-gradient-to-r from-gold/20 to-gold-dark/20 px-2 py-0.5 sm:px-3 sm:py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-gold backdrop-blur-md shadow-[0_0_15px_rgba(255,215,0,0.2)]">
                    ₹{price}
                  </span>
                )}
              </div>

              <div className="absolute top-0 right-0">
                <LikeButton
                  eventId={event.id || event.slug}
                />
              </div>
            </div>

            {/* Bottom Info */}
            <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-6 transform transition-transform duration-500 group-hover:translate-y-[-4px] z-20">
              {/* Glass Background on Hover */}
              <div className="absolute inset-0 -z-10 bg-black/40 backdrop-blur-xl opacity-0 group-hover:opacity-100 transition-all duration-500 rounded-t-[16px] sm:rounded-t-[24px] translate-y-full group-hover:translate-y-0" />

              <div className="relative z-10">
                <p className="mb-1 sm:mb-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-iris-glow drop-shadow-md">
                  {event.date} • {event.time}
                </p>
                <h3 className="mb-1 sm:mb-2 font-heading text-sm sm:text-xl md:text-2xl font-bold leading-tight text-white drop-shadow-lg line-clamp-2">
                  {event.title}
                </h3>
                <p className="text-[10px] sm:text-sm font-medium text-white/70 drop-shadow-md line-clamp-1">
                  {event.location}
                </p>

                {/* Guestlist Display */}
                {event.guests && event.guests.length > 0 && (
                  <div className="mt-2 sm:mt-4 relative z-10">
                    <div className="group/guestlist inline-flex items-center gap-1.5 sm:gap-2.5 bg-white/10 hover:bg-white/15 border border-white/20 p-1.5 pr-3 sm:p-2 sm:pr-4 rounded-full backdrop-blur-xl transition-all duration-300 hover:scale-[1.02]">
                      {/* Avatars Stack */}
                      <div className="flex -space-x-1.5 sm:-space-x-2.5">
                        {event.guests.slice(0, 4).map((guest, i) => (
                          <div
                            key={i}
                            className="relative h-5 w-5 sm:h-7 sm:w-7 rounded-full ring-1 sm:ring-2 ring-black/50 bg-gradient-to-br from-purple-400 to-pink-400 transition-all duration-300 group-hover/guestlist:ring-white/30"
                            style={{ zIndex: 4 - i }}
                          >
                            <img
                              src={`https://api.dicebear.com/9.x/notionists/svg?seed=${guest}&backgroundColor=c0aede,b6e3f4`}
                              alt={guest}
                              className="h-full w-full rounded-full object-cover"
                            />
                          </div>
                        ))}
                        {event.guests.length > 4 && (
                          <div className="relative h-5 w-5 sm:h-7 sm:w-7 flex items-center justify-center rounded-full ring-1 sm:ring-2 ring-black/50 bg-gradient-to-br from-zinc-800 to-zinc-900 text-[8px] sm:text-[9px] font-extrabold text-white z-0 group-hover/guestlist:ring-white/30 transition-all duration-300">
                            +{event.guests.length - 4}
                          </div>
                        )}
                      </div>

                      {/* Count & Status */}
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="text-[10px] sm:text-sm font-bold text-white tracking-tight">
                          {event.guests.length}
                        </span>
                        <div className="h-1 w-1 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Hover Reveal Button */}
                <div className="mt-4 sm:mt-6 hidden sm:flex items-center gap-3 opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 delay-75">
                  <span className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black font-bold text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-colors">
                    View Details
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                      <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div >
  );
}
