"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";

export default function ExploreCarouselHeader({ slides = [] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timeoutRef = useRef(null);

  const nextSlide = () => {
    setActiveIndex((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goToSlide = (index) => {
    setActiveIndex(index);
  };

  useEffect(() => {
    if (!isPaused && slides.length > 0) {
      timeoutRef.current = setTimeout(nextSlide, 6000);
    }
    return () => clearTimeout(timeoutRef.current);
  }, [activeIndex, isPaused, slides.length]);

  if (!slides.length) return null;

  const activeEvent = slides[activeIndex];

  return (
    <section
      className="relative w-full overflow-hidden min-h-[50vh] lg:min-h-[750px] flex flex-col lg:flex-row items-start lg:items-center justify-start lg:justify-center pt-20 lg:pt-32 pb-12 lg:pb-0"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Full Background Image with Parallax Effect */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`bg-${activeEvent.id}`}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          className="absolute inset-0 z-0"
        >
          <Image
            src={activeEvent.image}
            alt=""
            fill
            className="object-cover"
            priority
          />
          {/* Multi-layered Gradient Overlays for Depth */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/30" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
        </motion.div>
      </AnimatePresence>

      {/* Animated Grain Texture */}
      <div className="absolute inset-0 z-[1] opacity-[0.03] mix-blend-overlay pointer-events-none">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxwYXRoIGQ9Ik0wIDBoMzAwdjMwMEgweiIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIuMDUiLz48L3N2Zz4=')]" />
      </div>

      <div className="relative z-10 w-full max-w-[1600px] px-6 lg:px-12 py-4 lg:py-16">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Left: Content */}
          <motion.div
            key={`content-${activeEvent.id}`}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="space-y-5 lg:space-y-8 text-center lg:text-left order-2 lg:order-1"
          >
            {/* Category Badge */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="inline-block"
            >
              <div className="px-4 py-1.5 lg:px-6 lg:py-2 rounded-full bg-[#F44A22]/20 border border-[#F44A22]/40 backdrop-blur-md">
                <p className="text-xs lg:text-sm font-black uppercase tracking-[0.3em] text-[#F44A22]">
                  {activeEvent.category || "Featured Event"}
                </p>
              </div>
            </motion.div>

            {/* Title - Extra Bold and Dramatic */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-3xl sm:text-5xl md:text-6xl lg:text-8xl font-heading font-black text-white uppercase leading-[0.9] tracking-tight"
              style={{
                textShadow: '0 4px 20px rgba(0,0,0,0.5), 0 0 40px rgba(244,74,34,0.3)'
              }}
            >
              {activeEvent.title}
            </motion.h1>

            {/* Event Details */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="space-y-2 lg:space-y-4"
            >
              <div className="flex flex-col sm:flex-row gap-1 sm:gap-5 text-sm sm:text-xl text-white/90 font-bold justify-center lg:justify-start">
                <div className="flex items-center gap-2 justify-center lg:justify-start">
                  <svg className="w-4 h-4 sm:w-6 sm:h-6 text-[#F44A22]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{activeEvent.date}</span>
                </div>
                <div className="hidden sm:block text-white/40">•</div>
                <div className="flex items-center gap-2 justify-center lg:justify-start">
                  <svg className="w-4 h-4 sm:w-6 sm:h-6 text-[#F44A22]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{activeEvent.time}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm sm:text-lg text-white/70 justify-center lg:justify-start">
                <svg className="w-4 h-4 sm:w-6 sm:h-6 text-[#F44A22]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="font-semibold">{activeEvent.venue || activeEvent.location}</span>
              </div>
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="flex flex-row flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-5 justify-center lg:justify-start pt-4 lg:pt-6"
            >
              <Link
                href={`/event/${activeEvent.id || activeEvent.slug}`}
                className="group relative px-8 py-3 lg:px-12 lg:py-6 bg-white text-black font-black uppercase tracking-[0.2em] text-sm lg:text-lg rounded-full overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.5)]"
              >
                <span className="relative z-10">Get Tickets</span>
                <div className="absolute inset-0 bg-gradient-to-r from-[#F44A22] to-[#FF6B4A] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>

              <div className="flex items-center gap-2 lg:gap-3 px-4 py-2 lg:px-6 lg:py-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
                <div className="flex -space-x-2 lg:-space-x-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-6 h-6 lg:w-10 lg:h-10 rounded-full bg-gradient-to-br from-[#F44A22] to-[#FF6B4A] border-2 border-white/20"
                      style={{
                        transform: `translateX(-${i * 2}px)`
                      }}
                    />
                  ))}
                </div>
                <span className="text-white font-bold text-xs lg:text-sm">+156 Going</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Right: Featured Image Card */}
          <motion.div
            key={`card-${activeEvent.id}`}
            initial={{ opacity: 0, scale: 0.9, rotateY: -15 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative order-1 lg:order-2 group perspective-1000 w-full max-w-[220px] lg:max-w-[500px] mx-auto mb-8 lg:mb-0"
          >
            <div className="relative aspect-[3/4] w-full max-w-[500px] mx-auto rounded-[32px] overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.6)] border border-white/20 transform transition-all duration-500 group-hover:scale-[1.02] group-hover:shadow-[0_30px_100px_rgba(244,74,34,0.4)]">
              <Image
                src={activeEvent.image}
                alt={activeEvent.title}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-110"
                priority
              />

              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-500" />

              {/* Shimmer Effect on Hover */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/0 to-transparent group-hover:via-white/10 transition-all duration-700 group-hover:translate-x-full" style={{ transform: 'translateX(-100%)' }} />
            </div>

            {/* Decorative Elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-[#F44A22] rounded-full blur-3xl opacity-40 animate-pulse" />
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-purple-500 rounded-full blur-3xl opacity-30 animate-pulse delay-1000" />
          </motion.div>
        </div>

        {/* Navigation & Pagination - Bottom Center */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="flex items-center justify-center gap-6 mt-8 lg:mt-16"
        >
          {/* Prev/Next Buttons */}
          <div className="flex gap-3">
            <button
              onClick={prevSlide}
              className="p-4 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 hover:scale-110 transition-all duration-300"
              aria-label="Previous slide"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <button
              onClick={nextSlide}
              className="p-4 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 hover:scale-110 transition-all duration-300"
              aria-label="Next slide"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>

          {/* Pagination Dots */}
          <div className="flex gap-2 px-6 py-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goToSlide(idx)}
                className={clsx(
                  "h-2 rounded-full transition-all duration-500",
                  idx === activeIndex
                    ? "w-12 bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)]"
                    : "w-2 bg-white/30 hover:bg-white/50 hover:scale-125"
                )}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </motion.div>

        {/* Scroll Down Indicator */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.8 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20"
        >
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/50">Scroll</span>
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-6 h-10 rounded-full border border-white/20 flex justify-center p-1"
            >
              <motion.div className="w-1 h-2 bg-white/50 rounded-full" />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

