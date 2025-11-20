import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

export default function Selects({ items }) {
  return (
    <section className="mx-auto mb-20 max-w-[1400px] px-4 sm:mb-24 sm:px-6">
      <div className="mb-12 flex items-end justify-between">
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-iris-glow">
            Curated Collections
          </p>
          <h2 className="font-heading text-3xl font-bold uppercase tracking-tight text-white sm:text-5xl">
            The C1rcle Selects
          </h2>
        </div>
        <Link
          href="/explore"
          className="hidden text-xs font-bold uppercase tracking-widest text-white/60 transition hover:text-white sm:block"
        >
          View All Collections
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => (
          <Link
            key={item.title}
            href={item.href}
            className="group relative aspect-[4/5] overflow-hidden rounded-[32px] border border-white/10 bg-surface"
          >
            <Image
              src={item.image}
              alt={item.title}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-80 transition-opacity duration-500 group-hover:opacity-90" />

            <div className="absolute bottom-0 left-0 right-0 p-8">
              <div className="transform transition-transform duration-500 group-hover:-translate-y-2">
                <h3 className="mb-2 font-heading text-2xl font-bold uppercase leading-none text-white sm:text-3xl">
                  {item.title}
                </h3>
                <p className="mb-6 text-sm font-medium text-white/70 line-clamp-2">
                  {item.description}
                </p>
                <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white">
                  Explore Collection
                  <svg className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
