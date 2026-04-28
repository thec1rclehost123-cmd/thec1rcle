"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";

export default function HeroVideo({ src }) {
  const ref = useRef(null);
  const { scrollY } = useScroll();

  // Smoother, more subtle parallax effects
  const y = useTransform(scrollY, [0, 600], [0, 80]);
  const opacity = useTransform(scrollY, [0, 600], [1, 0]);
  const scale = useTransform(scrollY, [0, 600], [1, 1.08]);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
      {/* Background Video Layer with Parallax */}
      <div className="absolute inset-0 h-full w-full">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover"
        >
          <source src={src} type="video/mp4" />
        </video>
      </div>

      {/* Multi-layered Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-black/80" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/40" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.5)_100%)]" />

      {/* Animated Film Grain Texture */}
      <div className="absolute inset-0 z-[1] opacity-[0.04] mix-blend-overlay pointer-events-none">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxwYXRoIGQ9Ik0wIDBoMzAwdjMwMEgweiIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIuMDUiLz48L3N2Zz4=')]" />
      </div>

      {/* Hero Content */}
      <motion.div
        style={{ opacity }}
        className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 z-10 pt-20 md:pt-32"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
          className="relative max-w-7xl space-y-6 md:space-y-12"
        >
          {/* Main Title - THE C1RCLE with Premium Effects */}
          <div className="relative">
            <motion.h1
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl xl:text-[10rem] font-heading font-black tracking-tighter leading-none"
              style={{
                background: 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 50%, #e5e7eb 100%)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'gradient-shift 15s ease-in-out infinite',
                filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.1))',
              }}
            >
              THE C1RCLE
            </motion.h1>

            {/* Glowing Accent Lines */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-[#F44A22] to-transparent shadow-[0_0_20px_rgba(244,74,34,0.8)]"
            />
          </div>

          {/* Subtitle with Enhanced Glass Effect */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="backdrop-blur-xl bg-white/5 border border-white/20 rounded-full px-10 py-5 inline-block shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
          >
            <p className="text-sm md:text-2xl text-white font-bold tracking-[0.2em] md:tracking-[0.4em] uppercase">
              Discover Life Offline
            </p>
          </motion.div>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="text-sm md:text-lg text-white/70 max-w-2xl mx-auto font-medium leading-relaxed px-4"
          >
            Curated campus nights, rooftop flows, and underground pop-ups —
            <br className="hidden md:block" />
            inspired by global social drops, remixed for Gen Z India
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <Link
              href="/explore"
              className="group relative px-8 py-4 md:px-10 md:py-5 bg-white text-black font-black uppercase tracking-[0.2em] text-xs md:text-sm rounded-full overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.6)]"
            >
              <span className="relative z-10">Explore Events</span>
              <div className="absolute inset-0 bg-gradient-to-r from-[#F44A22] to-[#FF6B4A] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </Link>

            <Link
              href="/create"
              className="group px-8 py-4 md:px-10 md:py-5 border-2 border-white/30 text-white font-black uppercase tracking-[0.2em] text-xs md:text-sm rounded-full backdrop-blur-md hover:bg-white/10 hover:border-white/50 transition-all duration-300"
            >
              Create Event
            </Link>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Enhanced Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 z-20"
      >
        <span className="text-xs uppercase tracking-[0.3em] text-white/50 font-bold">Scroll Down</span>
        <motion.div
          className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center p-2"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-white"
            animate={{ y: [0, 16, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </motion.div>

      {/* Bottom Gradient Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black via-black/50 to-transparent pointer-events-none" />

      {/* Decorative Glow Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#F44A22] rounded-full blur-[120px] opacity-20 animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500 rounded-full blur-[120px] opacity-15 animate-pulse delay-1000 pointer-events-none" />
    </div>
  );
}

