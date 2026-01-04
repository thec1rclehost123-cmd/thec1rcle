"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

export default function HeroCarousel({ cards = [] }) {
  if (!cards.length) return null;

  // We use 4 sets to ensure we cover even large screens (4k)
  // and animate by -25% (width of one set) to loop seamlessly.
  const sets = [1, 2, 3, 4];

  return (
    <section className="relative w-full py-12 md:py-20 overflow-hidden bg-white dark:bg-[#0A0A0A]">
      <div className="mb-12 px-6 md:px-12 max-w-[1600px] mx-auto">
        <div className="flex items-center gap-4 mb-4">
          <div className="h-1 w-16 bg-gradient-to-r from-[#F44A22] to-[#FF6B4A] rounded-full" />
          <p className="text-xs font-black uppercase tracking-[0.3em] text-[#F44A22]">
            Trending Now
          </p>
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-black uppercase tracking-tight text-black dark:text-white">
          Featured{" "}
          <span className="inline-block bg-gradient-to-r from-[#F44A22] to-[#FF6B4A] bg-clip-text text-transparent">
            Drops
          </span>
        </h2>
      </div>

      <div className="flex overflow-hidden">
        <motion.div
          className="flex"
          animate={{
            x: ["0%", "-25%"],
          }}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: "loop",
              duration: 45,
              ease: "linear",
            },
          }}
        >
          {sets.map((setNum) => (
            <div key={setNum} className="flex gap-8 pr-8 shrink-0">
              {cards.map((card, index) => (
                <Link
                  key={`${setNum}-${card.id || index}`}
                  href={card.href}
                  className="group relative flex-none w-[260px] md:w-[400px] aspect-[3/4]"
                >
                  <div className="h-full w-full overflow-hidden rounded-[40px] bg-black/5 dark:bg-[#161616] border border-black/10 dark:border-white/10 relative transition-all duration-500 group-hover:scale-[1.03] group-hover:shadow-[0_20px_60px_rgba(0,0,0,0.3)] dark:group-hover:shadow-[0_20px_60px_rgba(244,74,34,0.2)]">
                    {/* Image with Zoom Effect */}
                    <div className="absolute inset-0 overflow-hidden">
                      <Image
                        src={card.image}
                        alt={card.title}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-110 opacity-90"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
                        loading="lazy"
                      />
                    </div>

                    {/* Enhanced Gradient Overlays */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent" />

                    {/* Shimmer Effect on Hover */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/0 to-transparent group-hover:via-white/10 transition-all duration-700 group-hover:translate-x-full" style={{ transform: 'translateX(-100%)' }} />

                    {/* Content */}
                    <div className="absolute inset-0 flex flex-col justify-between p-8">
                      {/* Top Badge */}
                      <div className="flex items-start justify-between">
                        <span className="inline-flex items-center rounded-full border border-[#F44A22]/40 bg-[#F44A22]/20 backdrop-blur-md px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-[#F44A22] shadow-lg">
                          Live
                        </span>
                      </div>

                      {/* Bottom Info */}
                      <div className="transform transition-all duration-500 group-hover:translate-y-[-12px]">
                        <p className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-white/70">
                          {card.time}
                        </p>
                        <h3 className="text-2xl md:text-3xl font-heading font-black text-white leading-tight mb-3 drop-shadow-lg">
                          {card.title}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-white/80 font-medium mb-6">
                          <svg className="w-4 h-4 text-[#F44A22]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span>{card.venue}</span>
                        </div>

                        {/* Hover Reveal CTA */}
                        <div className="opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-2 group-hover:translate-y-0">
                          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white text-black font-black text-xs uppercase tracking-[0.2em]">
                            <span>View Event</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Accent Glow */}
                    <div className="absolute -bottom-2 -right-2 w-32 h-32 bg-[#F44A22] rounded-full blur-3xl opacity-0 group-hover:opacity-30 transition-opacity duration-500" />
                  </div>
                </Link>
              ))}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
