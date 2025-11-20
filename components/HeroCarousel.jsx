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
    <section className="relative w-full py-12 overflow-hidden bg-black">
      <div className="mb-8 px-6 md:px-12">
        <h2 className="text-2xl font-heading font-bold uppercase tracking-widest text-white">
          Featured Drops
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
              duration: 40,
              ease: "linear",
            },
          }}
        >
          {sets.map((setNum) => (
            <div key={setNum} className="flex gap-6 pr-6 shrink-0">
              {cards.map((card, index) => (
                <Link
                  key={`${setNum}-${card.id || index}`}
                  href={card.href}
                  className="group relative flex-none w-[280px] md:w-[360px] aspect-[3/4]"
                >
                  <div className="h-full w-full overflow-hidden rounded-[32px] bg-surface border border-white/10 relative transition-transform duration-500 hover:scale-[1.02]">
                    <Image
                      src={card.image}
                      alt={card.title}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-110 opacity-80 group-hover:opacity-60"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

                    <div className="absolute bottom-0 left-0 right-0 p-6 transform transition-transform duration-500 group-hover:translate-y-[-4px]">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-iris-glow mb-2">
                        {card.time}
                      </p>
                      <h3 className="text-xl font-heading font-bold text-white leading-tight mb-1">
                        {card.title}
                      </h3>
                      <p className="text-sm text-white/60 font-medium">
                        {card.venue}
                      </p>
                    </div>
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
