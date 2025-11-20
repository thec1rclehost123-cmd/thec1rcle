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
      timeoutRef.current = setTimeout(nextSlide, 5000);
    }
    return () => clearTimeout(timeoutRef.current);
  }, [activeIndex, isPaused, slides.length]);

  if (!slides.length) return null;

  const activeEvent = slides[activeIndex];

  return (
    <section className="relative w-full overflow-hidden min-h-[600px] flex items-center justify-center bg-black py-12">
      {/* Blurred Background Layer */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`bg-${activeEvent.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="absolute inset-0 z-0"
        >
          <Image
            src={activeEvent.image}
            alt=""
            fill
            className="object-cover blur-[100px] opacity-50 scale-110"
            priority
          />
          <div className="absolute inset-0 bg-black/40" />
        </motion.div>
      </AnimatePresence>

      <div
        className="relative z-10 w-full max-w-6xl px-4 grid lg:grid-cols-[400px,1fr] gap-12 items-center"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Main Card */}
        <motion.div
          key={`card-${activeEvent.id}`}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative aspect-[3/4] w-full rounded-3xl overflow-hidden shadow-2xl border border-white/10 group"
        >
          <Image
            src={activeEvent.image}
            alt={activeEvent.title}
            fill
            className="object-cover"
            priority
          />
          {/* Card Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

          <div className="absolute bottom-6 left-6 right-6 lg:hidden">
            <h3 className="text-3xl font-heading font-black text-white uppercase leading-none mb-2">
              {activeEvent.title}
            </h3>
          </div>
        </motion.div>

        {/* Details Section */}
        <div className="space-y-6 text-center lg:text-left">
          <motion.div
            key={`text-${activeEvent.id}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-iris-glow mb-2">
              {activeEvent.category || "Featured Event"}
            </p>
            <h2 className="text-4xl md:text-6xl font-heading font-black text-white uppercase leading-tight mb-4">
              {activeEvent.title}
            </h2>
            <div className="flex flex-col gap-1 text-lg text-white/80 font-medium mb-8">
              <p>{activeEvent.date} • {activeEvent.time}</p>
              <p className="text-white/60">{activeEvent.venue || activeEvent.location}</p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <Link
                href={`/event/${activeEvent.id || activeEvent.slug}`}
                className="px-8 py-4 bg-white text-black font-bold uppercase tracking-widest rounded-full hover:bg-iris hover:text-white transition-colors duration-300"
              >
                Get Tickets
              </Link>
              <div className="flex items-center gap-2 text-sm font-medium text-white/60">
                <div className="flex -space-x-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-white/10 border border-black" />
                  ))}
                </div>
                <span>+35 Going</span>
              </div>
            </div>
          </motion.div>

          {/* Navigation & Pagination */}
          <div className="flex items-center justify-center lg:justify-start gap-6 pt-8">
            <div className="flex gap-2">
              <button
                onClick={prevSlide}
                className="p-3 rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10 transition"
                aria-label="Previous slide"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <button
                onClick={nextSlide}
                className="p-3 rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10 transition"
                aria-label="Next slide"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>

            <div className="flex gap-2">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => goToSlide(idx)}
                  className={clsx(
                    "h-1.5 rounded-full transition-all duration-300",
                    idx === activeIndex ? "w-8 bg-white" : "w-2 bg-white/20 hover:bg-white/40"
                  )}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
