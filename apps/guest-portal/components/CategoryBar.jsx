import Link from "next/link";
import { motion } from "framer-motion";

export default function CategoryBar({ categories }) {
  return (
    <section className="mx-auto mb-2 max-w-7xl px-0 sm:mb-4 sm:px-6">
      <div className="relative">
        {/* Fade masks for scroll interaction hint */}
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black dark:from-black to-transparent z-10 pointer-events-none md:hidden" />
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black dark:from-black to-transparent z-10 pointer-events-none md:hidden" />

        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 scrollbar-hide justify-start md:justify-center">
          {categories.map((category, index) => {
            const param = category.toLowerCase().replace(/\s+/g, "-");
            return (
              <Link
                key={category}
                href={`/explore?category=${encodeURIComponent(param)}`}
                className="group relative flex-none snap-start first:pl-2 last:pr-2"
              >
                <div className="relative overflow-hidden rounded-full border border-white/10 bg-white/5 px-5 py-2.5 backdrop-blur-md transition-all duration-300 active:scale-95 group-hover:bg-white/10 group-hover:border-white/20">
                  <span className="relative z-10 text-[11px] font-bold uppercase tracking-[0.15em] text-white/70 transition-colors group-hover:text-white">
                    {category}
                  </span>
                  <div className="absolute inset-0 -z-10 bg-gradient-to-r from-orange/0 via-orange/10 to-orange/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
