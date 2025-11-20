"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export default function HeroVideo({ src }) {
  const ref = useRef(null);
  const { scrollY } = useScroll();

  const y = useTransform(scrollY, [0, 500], [0, 200]);
  const opacity = useTransform(scrollY, [0, 500], [1, 0.3]);
  const scale = useTransform(scrollY, [0, 500], [1, 1.1]);

  return (
    <div className="relative h-[85vh] w-full overflow-hidden">
      <motion.div
        ref={ref}
        style={{ y, opacity, scale }}
        className="absolute inset-0 h-full w-full"
      >
        <video
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover"
        >
          <source src={src} type="video/mp4" />
        </video>

        {/* Cinematic Grain Overlay */}
        <div className="absolute inset-0 bg-black/20" />
      </motion.div>

      {/* Gradient Fade to Content */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-base" />

      {/* Hero Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="relative z-10 max-w-4xl"
        >
          <h1 className="text-6xl md:text-8xl lg:text-9xl font-heading font-black tracking-tighter text-white mb-6 mix-blend-overlay">
            THE C1RCLE
          </h1>
          <p className="text-lg md:text-xl text-white/80 font-medium tracking-widest uppercase max-w-2xl mx-auto">
            Discover Life Offline
          </p>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-[10px] uppercase tracking-[0.3em] text-white/50">Scroll</span>
        <div className="w-[1px] h-12 bg-gradient-to-b from-white/50 to-transparent" />
      </motion.div>
    </div>
  );
}
