import Link from "next/link";
import { motion } from "framer-motion";

export default function CategoryBar({ categories }) {
  return (
    <section className="mx-auto mb-10 max-w-7xl px-4 sm:mb-20 sm:px-6">
      <div className="flex snap-x gap-4 overflow-x-auto pb-4 scrollbar-hide justify-start md:justify-center">
        {categories.map((category, index) => {
          const param = category.toLowerCase().replace(/\s+/g, "-");
          return (
            <Link
              key={category}
              href={`/explore?category=${encodeURIComponent(param)}`}
              className="group relative flex-none"
            >
              <div className="relative overflow-hidden rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2 md:px-6 md:py-3 backdrop-blur-md transition-all duration-300 group-hover:border-black/30 dark:group-hover:border-white/30 group-hover:bg-black/10 dark:group-hover:bg-white/10">
                <span className="relative z-10 text-[10px] font-bold uppercase tracking-[0.2em] text-black/70 dark:text-white/70 transition-colors group-hover:text-black dark:group-hover:text-white">
                  {category}
                </span>
                <div className="absolute inset-0 -z-10 bg-gradient-to-r from-iris/0 via-iris/10 to-iris/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
