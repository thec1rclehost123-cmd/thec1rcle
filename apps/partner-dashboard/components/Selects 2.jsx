"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

export default function Selects({ items }) {
  return (
    <section className="mx-auto mb-12 max-w-[1400px] px-4 sm:mb-24 sm:px-6">
      <div className="mb-12 flex items-end justify-between">
        <div>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-iris-glow">
            Curated Collections
          </p>
          <h2 className="font-heading text-3xl font-black uppercase tracking-tight text-black dark:text-white sm:text-6xl leading-[0.9]">
            The C1rcle <span className="text-transparent bg-clip-text bg-gradient-to-r from-iris via-black dark:via-white to-gold">Selects</span>
          </h2>
        </div>
        <Link
          href="/explore"
          className="hidden text-xs font-bold uppercase tracking-widest text-black/60 dark:text-white/60 transition-all hover:text-black dark:hover:text-white hover:-translate-y-0.5 sm:flex items-center gap-2"
        >
          View All
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Link>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => (
          <div key={item.title}>
            <Link
              href={item.href}
              className="group relative block aspect-[4/5] overflow-hidden rounded-[40px] gradient-border bg-surface btn-lift"
            >
              <Image
                src={item.image}
                alt={item.title}
                fill
                className="object-cover transition-all duration-700 group-hover:scale-110 group-hover:brightness-75"
                loading="lazy"
              />

              {/* Enhanced gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-85 transition-opacity duration-500 group-hover:opacity-95" />

              {/* Category badge - positioned top-left */}
              <div className="absolute left-6 top-6 z-10">
                <div className="relative overflow-hidden rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-6 py-3 backdrop-blur-md transition-all duration-300 group-hover:border-black/30 dark:group-hover:border-white/30 group-hover:bg-black/10 dark:group-hover:bg-white/10">
                  <span className="relative z-10 text-[10px] font-bold uppercase tracking-[0.2em] text-black/70 dark:text-white/70 transition-colors group-hover:text-black dark:group-hover:text-white">
                    {item.category}
                  </span>
                  <div className="absolute inset-0 -z-10 bg-gradient-to-r from-iris/0 via-iris/10 to-iris/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                </div>
              </div>

              {/* Subtle glow on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-t from-iris/20 to-transparent" />

              {/* Content */}
              <div className="absolute inset-0 flex flex-col justify-end p-8">
                <div className="transform transition-all duration-500 group-hover:-translate-y-3">
                  <h3 className="mb-3 font-heading text-2xl md:text-3xl font-black uppercase leading-none text-white sm:text-4xl tracking-tight drop-shadow-2xl">
                    {item.title}
                  </h3>
                  <p className="mb-6 text-sm font-medium text-white/80 line-clamp-2 drop-shadow-md">
                    {item.description}
                  </p>

                  {/* Animated CTA */}
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                      Explore Collection
                    </span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm border border-white/20 group-hover:bg-white group-hover:border-white transition-all duration-300">
                      <svg className="h-4 w-4 text-white group-hover:text-black transition-all duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
