import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import ScrollReveal from "./ScrollReveal";

export default function EventCard({ event, index = 0 }) {
  const price = event.price || "Free";
  const isFree = price === "Free" || price === 0;
  const isDefaultImage = event.image?.includes("holi-edit.svg");

  return (
    <ScrollReveal delay={index * 0.1} className="h-full">
      <Link href={`/event/${event.id || event.slug}`} className="group relative block h-full w-full">
        <div className="relative h-[420px] w-full overflow-hidden rounded-[32px] bg-surface transition-all duration-500 group-hover:-translate-y-2 group-hover:shadow-floating">
          {/* Image or Gradient Fallback */}
          <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-105">
            {isDefaultImage ? (
              <div className="h-full w-full bg-gradient-to-br from-iris/20 via-black to-surface" />
            ) : (
              <Image
                src={event.image}
                alt={event.title}
                fill
                className="object-cover opacity-90 transition-opacity duration-500 group-hover:opacity-70"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
            )}
          </div>

          {/* Stronger Gradient Overlay for Text Readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent opacity-90 transition-opacity duration-500 group-hover:opacity-100" />

          {/* Content */}
          <div className="absolute inset-0 flex flex-col justify-between p-6">
            {/* Top Tags */}
            <div className="flex items-start justify-between">
              <span className="inline-flex items-center rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur-md">
                {event.category || "Event"}
              </span>
              {isFree ? (
                <span className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300 backdrop-blur-md">
                  Free
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-gold/40 bg-gradient-to-r from-gold/20 to-gold-dark/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gold backdrop-blur-md shadow-[0_0_15px_rgba(255,215,0,0.2)]">
                  ₹{price}
                </span>
              )}
            </div>

            {/* Bottom Info */}
            <div className="transform transition-transform duration-500 group-hover:translate-y-[-8px]">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-iris-glow drop-shadow-md">
                {event.date} • {event.time}
              </p>
              <h3 className="mb-2 font-heading text-2xl font-bold leading-tight text-white drop-shadow-lg">
                {event.title}
              </h3>
              <p className="text-sm font-medium text-white/70 drop-shadow-md">
                {event.location}
              </p>

              {/* Hover Reveal Button */}
              <div className="mt-6 flex items-center gap-2 opacity-0 transition-all duration-500 group-hover:opacity-100">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                  </svg>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-white">
                  View Details
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </ScrollReveal>
  );
}

