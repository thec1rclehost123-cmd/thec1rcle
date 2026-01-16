"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

export default function Selects({ items }) {
  return (
    <section className="mx-auto mb-16 max-w-7xl px-4 pt-8 sm:mb-32 sm:px-6 sm:pt-12">
      <div className="mb-12 flex items-end justify-between border-b border-black/5 dark:border-white/5 pb-8">
        <div>
          <p className="mb-4 text-[11px] font-black uppercase tracking-[0.4em] text-iris">
            Curated Collections
          </p>
          <h2 className="font-heading text-4xl font-black uppercase tracking-tight text-black dark:text-white sm:text-7xl leading-none">
            The C1rcle <span className="text-transparent bg-clip-text bg-gradient-to-r from-iris to-iris-glow">Selects</span>
          </h2>
        </div>
        <Link
          href="/explore"
          className="flex text-[10px] sm:text-xs font-bold uppercase tracking-widest text-black/60 dark:text-white/60 transition-all hover:text-black dark:hover:text-white hover:-translate-y-0.5 items-center gap-2"
        >
          View All
          <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Link>
      </div>

      <div className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-8 scrollbar-hide sm:flex-wrap sm:justify-center sm:gap-10 sm:overflow-visible sm:pb-0 px-4 sm:px-0 -mx-4 sm:mx-0">
        {items.map((item, index) => {
          const [year, ...rest] = item.title.split(" ");
          const activity = rest.join(" ");

          return (
            <div key={item.title} className="w-[85vw] max-w-[340px] flex-none snap-center sm:w-full sm:max-w-md lg:max-w-[420px] sm:flex-1">
              <Link
                href={item.href}
                className="group relative block aspect-[4/5] overflow-hidden rounded-[32px] sm:rounded-[40px] border border-white/10 bg-[#0A0A0A] btn-lift shadow-2xl"
              >
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  className="object-cover transition-all duration-1000 group-hover:scale-110 opacity-60 group-hover:opacity-80"
                  loading="lazy"
                />

                {/* Enhanced gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90 transition-opacity duration-500 group-hover:opacity-95" />

                {/* Subtle glow on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-[radial-gradient(circle_at_bottom,rgba(244,74,34,0.15),transparent_70%)]" />

                {/* Content */}
                <div className="absolute inset-0 flex flex-col justify-end p-10">
                  <div className="transform transition-all duration-700 group-hover:-translate-y-4">
                    <div className="mb-4 space-y-1">
                      <span className="block font-heading text-4xl font-black uppercase tracking-tighter text-white/40 group-hover:text-white/60 transition-colors duration-500">
                        {year}
                      </span>
                      <h3 className="font-heading text-4xl md:text-5xl lg:text-6xl font-black uppercase leading-[0.85] text-white tracking-tighter drop-shadow-2xl">
                        {activity}
                      </h3>
                    </div>

                    <p className="mb-8 text-sm font-medium text-white/60 line-clamp-2 max-w-[280px]">
                      {item.description}
                    </p>

                    {/* Animated CTA */}
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/80 group-hover:text-white transition-colors">
                        Explore Collection
                      </span>
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/20 group-hover:bg-white group-hover:border-white transition-all duration-500 group-hover:scale-110">
                        <svg className="h-5 w-5 text-white group-hover:text-black transition-all duration-500 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
