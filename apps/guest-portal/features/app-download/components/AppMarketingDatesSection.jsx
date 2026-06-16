'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { HeartSvg, Sparkle, DownloadCTA } from './AppMarketingExperience';

const DatesSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  const profiles = [
    {
      name: 'ARYA S.',
      tag: 'Going to SUBCULTURE',
      match: 94,
      color: 'from-rose-900 to-pink-950',
      rotation: '-6deg',
      x: '58%',
      y: '6%',
    },
    {
      name: 'KARAN V.',
      tag: 'Looking for +1',
      match: 88,
      color: 'from-violet-900 to-purple-950',
      rotation: '4deg',
      x: '50%',
      y: '52%',
    },
    {
      name: 'MAYA R.',
      tag: 'Attending LAPSUS',
      match: 97,
      color: 'from-fuchsia-900 to-pink-950',
      rotation: '-2deg',
      x: '68%',
      y: '33%',
    },
  ];

  return (
    <section
      ref={ref}
      className="relative min-h-screen flex items-center overflow-hidden py-24 bg-black"
    >
      {/* Dot grid */}
      <svg
        className="absolute bottom-10 right-10 opacity-[0.05] pointer-events-none"
        width="140"
        height="140"
        aria-hidden="true"
      >
        {Array.from({ length: 7 }, (_, r) =>
          Array.from({ length: 7 }, (_, c) => (
            <circle key={`${r}-${c}`} cx={c * 20 + 10} cy={r * 20 + 10} r="1.5" fill="white" />
          )),
        )}
      </svg>
      {/* Connector SVG between orb and text */}
      <svg
        className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none opacity-[0.04]"
        width="200"
        height="200"
        aria-hidden="true"
      >
        <circle
          cx="100"
          cy="100"
          r="80"
          stroke="white"
          strokeWidth="0.5"
          fill="none"
          strokeDasharray="4 8"
        />
        <circle
          cx="100"
          cy="100"
          r="50"
          stroke="white"
          strokeWidth="0.5"
          fill="none"
          strokeDasharray="2 6"
        />
      </svg>

      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 w-[55vw] h-[55vw] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(200,30,80,0.14) 0%, transparent 70%)' }}
      />

      {/* Floating hearts */}
      <HeartSvg
        size={10}
        className="absolute top-[18%] right-[36%] text-rose-400 opacity-30 animate-pulse"
      />
      <HeartSvg
        size={7}
        className="absolute top-[65%] left-[43%] text-rose-300 opacity-20 animate-pulse"
        style={{ animationDelay: '0.7s' }}
      />
      <HeartSvg
        size={14}
        className="absolute top-[42%] right-[42%] text-pink-400 opacity-20 animate-pulse"
        style={{ animationDelay: '1.3s' }}
      />
      <Sparkle
        size={8}
        className="absolute top-[28%] left-[6%]  text-rose-300 opacity-25 animate-pulse"
        style={{ animationDelay: '0.4s' }}
      />

      <div className="max-w-7xl mx-auto px-6 w-full relative min-h-[70vh] flex items-center">
        <div className="max-w-lg relative z-10">
          <motion.span
            initial={{ opacity: 0, x: -20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-1.5 text-rose-400 text-xs font-bold uppercase tracking-[0.4em]"
          >
            <HeartSvg size={11} /> 02 — Dates
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
            PLUS ONE.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="mt-6 text-white/50 text-base md:text-lg leading-relaxed font-light"
          >
            Match with people attending the same events. Turn strangers into memories.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.38 }}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-rose-500/20"
            style={{ background: 'rgba(200,30,80,0.08)' }}
          >
            <HeartSvg size={11} className="text-rose-400" />
            <span className="text-rose-300 text-xs font-bold">8,400+ connections made</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="mt-6"
          >
            <DownloadCTA />
          </motion.div>
        </div>

        {/* Floating profile cards (desktop) */}
        <div className="absolute inset-0 hidden lg:block pointer-events-none">
          {profiles.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 40 }}
              animate={inView ? { opacity: 1, y: 0, rotate: p.rotation } : {}}
              transition={{ duration: 0.8, delay: 0.3 + i * 0.15, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'absolute',
                left: p.x,
                top: p.y,
                boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(200,30,80,0.1)',
              }}
              className={`w-44 p-4 rounded-3xl bg-gradient-to-b ${p.color} border border-white/10`}
            >
              <div
                className="w-10 h-10 rounded-full mb-3 border border-white/10 flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.1)' }}
              >
                <span className="text-white font-black text-sm">{p.name[0]}</span>
              </div>
              <div className="text-white font-black text-sm tracking-tight">{p.name}</div>
              <div className="text-white/40 text-[10px] mt-0.5">{p.tag}</div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[9px] text-white/40 uppercase tracking-wider">Match</span>
                <span className="text-sm font-black text-rose-400">{p.match}%</span>
              </div>
              <div className="mt-1 h-1 bg-white/10 rounded overflow-hidden">
                <div className="h-full bg-rose-500 rounded" style={{ width: `${p.match}%` }} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default DatesSection;
