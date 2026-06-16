'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Sparkle, FlameSvg, DownloadCTA } from './AppMarketingExperience';

const DiscoverSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  const mockEvents = [
    {
      name: 'SUBCULTURE',
      venue: 'Kitty Su, Mumbai',
      time: '11 PM',
      fill: 78,
      heat: 94,
      color: 'from-indigo-900 to-black',
    },
    {
      name: 'LAPSUS',
      venue: 'Bluefrog, Pune',
      time: '10 PM',
      fill: 62,
      heat: 71,
      color: 'from-violet-950 to-black',
    },
    {
      name: 'NIGHT RITUAL',
      venue: 'KYGO, Bengaluru',
      time: '12 AM',
      fill: 91,
      heat: 98,
      color: 'from-orange-950 to-black',
    },
  ];

  return (
    <section
      ref={ref}
      className="relative min-h-screen flex items-center overflow-hidden py-24"
      style={{ background: '#050508' }}
    >
      {/* Subtle grid background */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.025] pointer-events-none"
        aria-hidden="true"
      >
        <defs>
          <pattern id="disc-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#disc-grid)" />
      </svg>
      <div
        className="absolute top-0 right-0 w-[50vw] h-[50vw] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(30,60,200,0.15) 0%, transparent 70%)',
          transform: 'translate(20%, -20%)',
        }}
      />
      <Sparkle
        size={10}
        className="absolute bottom-[20%] left-[6%] text-indigo-400 opacity-30 animate-pulse"
      />
      <Sparkle
        size={7}
        className="absolute top-[30%] left-[4%] text-white opacity-15 animate-pulse"
        style={{ animationDelay: '0.9s' }}
      />

      <div className="max-w-7xl mx-auto px-6 w-full grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <motion.span
            initial={{ opacity: 0, x: -20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-1.5 text-[#F44A22] text-xs font-bold uppercase tracking-[0.4em]"
          >
            <FlameSvg size={11} /> 01 — Discover
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 40 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="mt-4 font-black text-white leading-[0.85] tracking-tighter uppercase"
            style={{ fontSize: 'clamp(2rem, 5.5vw, 5rem)' }}
          >
            FIND
            <br />
            YOUR
            <br />
            NIGHT.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="mt-6 text-white/50 text-base md:text-lg leading-relaxed max-w-md font-light"
          >
            AI-curated events ranked by heat score. Real-time crowd data. Every night, sorted by
            what's actually worth going to.
          </motion.p>

          {/* Feature tags */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.38 }}
            className="mt-5 flex flex-wrap gap-2"
          >
            {[
              { e: '🔥', l: 'Heat Score' },
              { e: '📍', l: 'Real-time' },
              { e: '✨', l: 'AI Curated' },
              { e: '🗺️', l: 'City Map' },
            ].map((f) => (
              <span
                key={f.l}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white/60 border border-white/10"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                {f.e} {f.l}
              </span>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="mt-7"
          >
            <DownloadCTA />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 60 }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex justify-center lg:justify-end"
        >
          <div className="relative w-64 sm:w-72">
            {/* Glow behind phone */}
            <div
              className="absolute -inset-6 rounded-[3rem] pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(30,60,200,0.35) 0%, transparent 70%)',
                filter: 'blur(24px)',
                opacity: 0.5,
              }}
            />
            <div
              className="relative bg-[#0a0a0f] border border-white/10 rounded-[2.5rem] overflow-hidden"
              style={{ boxShadow: '0 40px 80px rgba(0,0,0,0.8), 0 0 80px rgba(30,60,200,0.15)' }}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-20 h-1.5 bg-white/10 rounded-full" />
              </div>
              <div className="px-4 pb-6 pt-2 space-y-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[9px] text-white/30 uppercase tracking-widest font-bold">
                    TONIGHT IN MUMBAI
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-[#F44A22] font-bold">
                    <div className="w-1 h-1 rounded-full bg-[#F44A22] animate-pulse" /> LIVE
                  </div>
                </div>
                {mockEvents.map((ev, i) => (
                  <motion.div
                    key={ev.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6, delay: 0.4 + i * 0.1 }}
                    style={{
                      transform: i === 0 ? 'rotate(-1deg)' : i === 2 ? 'rotate(0.5deg)' : 'none',
                    }}
                    className={`relative p-3 rounded-2xl bg-gradient-to-b ${ev.color} border border-white/10`}
                  >
                    <div className="absolute top-2 right-3 flex items-center gap-1">
                      <span className="text-[8px] text-amber-400 font-black">{ev.heat}</span>
                      <FlameSvg size={8} className="text-[#F44A22]" />
                    </div>
                    <div className="text-white font-black text-sm tracking-tight">{ev.name}</div>
                    <div className="text-white/40 text-[9px] mt-0.5">{ev.venue}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-0.5 bg-white/10 rounded overflow-hidden">
                        <div
                          className="h-full bg-[#F44A22] rounded"
                          style={{ width: `${ev.fill}%` }}
                        />
                      </div>
                      <span className="text-white/25 text-[8px] font-mono">{ev.fill}%</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default DiscoverSection;
