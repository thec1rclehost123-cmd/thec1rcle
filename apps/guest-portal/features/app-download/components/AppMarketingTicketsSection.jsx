'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { DownloadCTA } from './AppMarketingExperience';

const TicketsSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section
      ref={ref}
      className="relative min-h-screen flex items-center justify-center overflow-hidden py-24 bg-black"
    >
      {/* Amber radial glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70vw] h-[70vw] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,180,30,0.12) 0%, transparent 65%)' }}
      />

      {/* Circuit-board SVG background */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="circuit" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
            <path
              d="M40 0 L40 30 M40 50 L40 80 M0 40 L30 40 M50 40 L80 40"
              stroke="white"
              strokeWidth="0.8"
              fill="none"
            />
            <circle cx="40" cy="40" r="4" fill="none" stroke="white" strokeWidth="0.8" />
            <circle cx="40" cy="0" r="2" fill="white" opacity="0.6" />
            <circle cx="40" cy="80" r="2" fill="white" opacity="0.6" />
            <circle cx="0" cy="40" r="2" fill="white" opacity="0.6" />
            <circle cx="80" cy="40" r="2" fill="white" opacity="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#circuit)" />
      </svg>

      <div className="max-w-5xl mx-auto px-6 w-full text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-center gap-2 mb-4"
        >
          <span className="text-amber-400 text-xs font-bold uppercase tracking-[0.4em]">
            04 — Tickets
          </span>
          <span className="px-2 py-0.5 bg-amber-400/10 border border-amber-400/20 rounded-full text-amber-300 text-[10px] font-bold uppercase tracking-wider">
            New
          </span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="font-black text-white leading-[0.85] tracking-tighter uppercase"
          style={{ fontSize: 'clamp(2rem, 6.5vw, 6rem)' }}
        >
          BUY. SHARE.
          <br />
          <span className="text-[#F44A22]">TRANSFER.</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.25 }}
          className="mt-6 text-white/50 text-lg font-light"
        >
          Instant delivery. One-tap sharing. No more screenshots.
        </motion.p>

        {/* Ticket card */}
        <motion.div
          initial={{ opacity: 0, y: 60, rotate: -4, scale: 0.9 }}
          animate={inView ? { opacity: 1, y: 0, rotate: -3, scale: 1 } : {}}
          transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="mt-12 inline-block w-full max-w-lg mx-auto relative"
          style={{ boxShadow: '0 40px 80px rgba(0,0,0,0.8), 0 0 60px rgba(255,180,30,0.18)' }}
        >
          {/* Shimmer overlay */}
          <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none z-10">
            <motion.div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%)',
              }}
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
            />
          </div>
          <div
            className="border border-amber-400/20 rounded-3xl overflow-hidden flex"
            style={{ background: '#0d0d10' }}
          >
            <div className="flex-1 p-6 text-left">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[#F44A22] text-[10px] font-bold uppercase tracking-widest">
                  THE C1RCLE · TICKET
                </div>
                <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-400/10 border border-emerald-400/30 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-emerald-300 text-[9px] font-bold uppercase tracking-wider">
                    Verified ✓
                  </span>
                </div>
              </div>
              <div className="text-white font-black text-2xl tracking-tight">SUBCULTURE</div>
              <div className="text-white/40 text-sm mt-1">Kitty Su · New Delhi</div>
              <div className="mt-4 flex gap-6">
                <div>
                  <div className="text-white/30 text-[9px] uppercase tracking-wider">Date</div>
                  <div className="text-white text-sm font-bold">SAT, MAR 29</div>
                </div>
                <div>
                  <div className="text-white/30 text-[9px] uppercase tracking-wider">Time</div>
                  <div className="text-white text-sm font-bold">11:00 PM</div>
                </div>
                <div>
                  <div className="text-white/30 text-[9px] uppercase tracking-wider">Tier</div>
                  <div className="text-white text-sm font-bold">GENERAL</div>
                </div>
              </div>
              {/* Barcode strip */}
              <div className="mt-5 flex items-end gap-[1px] h-8">
                {[
                  3, 1, 4, 1, 5, 2, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 3, 1, 2, 1, 3, 4, 1, 2, 3, 1, 2,
                  1, 4, 3, 1, 2,
                ].map((w, i) => (
                  <div
                    key={i}
                    className="bg-white/30 rounded-[1px]"
                    style={{
                      width: w === 4 ? 3 : w === 3 ? 2 : 1,
                      height: i % 5 === 0 ? '100%' : '70%',
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="border-l border-dashed border-white/10 self-stretch" />
            <div className="w-20 flex flex-col items-center justify-center p-4 gap-3">
              <div
                className="w-12 h-12 border border-amber-400/20 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(255,180,30,0.05)' }}
              >
                <div className="grid grid-cols-3 gap-0.5">
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="w-1.5 h-1.5 bg-amber-300/50 rounded-[1px]" />
                  ))}
                </div>
              </div>
              <div
                className="text-white/20 text-[8px] font-bold uppercase tracking-wider"
                style={{ writingMode: 'vertical-lr' }}
              >
                C1RCLE
              </div>
            </div>
          </div>
        </motion.div>

        {/* Feature chips */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-8 flex flex-wrap justify-center gap-3"
        >
          {[
            '⚡ Instant Delivery',
            '🔗 Share with Friends',
            '🔒 Secure Entry',
            '0️⃣ No Hidden Fees',
          ].map((chip) => (
            <div
              key={chip}
              className="px-4 py-2 border border-white/10 rounded-full text-white/60 text-xs font-bold uppercase tracking-wider"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              {chip}
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.75 }}
          className="mt-8"
        >
          <DownloadCTA className="justify-center" />
        </motion.div>
      </div>
    </section>
  );
};

export default TicketsSection;
