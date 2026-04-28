'use client';

import { useState, useRef, Suspense, useEffect } from 'react';
import { motion, useScroll, useTransform, useMotionValue, useSpring, useMotionTemplate, useInView, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Apple, PlayCircle, ChevronRight, QrCode } from 'lucide-react';

import Head from 'next/head';
import AppMarketingLikeGate from './AppMarketingLikeGate';
import AppWaitlistSection from './AppWaitlistSection';

// --- ASSETS ---
const VIDEOS = {
  hero: "https://cdn.coverr.co/videos/coverr-people-dancing-in-a-nightclub-5429/1080p.mp4",
  heatmap: "https://cdn.coverr.co/videos/coverr-driving-through-city-lights-at-night-4666/1080p.mp4",
  scanner: "https://cdn.coverr.co/videos/coverr-party-crowd-2662/1080p.mp4",
  vip: "https://cdn.coverr.co/videos/coverr-pouring-champagne-5393/1080p.mp4"
};

// --- COMPONENTS ---

const BillboardHero = () => {
  const [isActivated, setIsActivated] = useState(false);

  return (
    <>
      <Head>
        <link rel="preload" href="/hero-day.png" as="image" fetchpriority="high" />
        <link rel="preload" href="/hero-night.png" as="image" fetchpriority="high" />
      </Head>

      <section className="relative h-screen w-full overflow-hidden bg-black isolation-isolate">
        {/* Night Image Layer (Sits below) */}
        <div
          className="absolute inset-0 w-full h-full transition-opacity duration-300 ease-in-out"
          style={{
            opacity: isActivated ? 1 : 0,
            transitionDelay: isActivated ? '50ms' : '0ms',
            zIndex: 1
          }}
        >
          <img
            src="/hero-night.png"
            alt="The C1rcle Billboard Night"
            className="w-full h-full object-cover object-[center_bottom] antialiased"
            style={{
              imageRendering: '-webkit-optimize-contrast',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'translate3d(0, 0, 0)'
            }}
            loading="eager"
            fetchPriority="high"
          />
        </div>

        {/* Day Image Layer (Sits above by default) */}
        <div
          className="absolute inset-0 w-full h-full transition-opacity duration-300 ease-in-out"
          style={{
            opacity: isActivated ? 0 : 1,
            zIndex: 2
          }}
        >
          <img
            src="/hero-day.png"
            alt="The C1rcle Billboard Day"
            className="w-full h-full object-cover object-[center_bottom] antialiased"
            style={{
              imageRendering: '-webkit-optimize-contrast',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'translate3d(0, 0, 0)'
            }}
            loading="eager"
            fetchPriority="high"
          />
        </div>

        {/* Subtle Overlay - Reduced opacity to maintain maximal image clarity */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/40 z-[10] pointer-events-none" />

        {/* Content Overlay */}
        <div className="relative z-[30] h-full w-full flex flex-col items-center justify-end pb-24 px-6">
          <div className="text-center max-w-4xl mx-auto flex flex-col items-center gap-12">

            {/* EXPERIENTIAL TOGGLE */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="flex flex-col items-center gap-4"
            >
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">
                {isActivated ? "Night Activated" : "Activate the night"}
              </span>
              <button
                onClick={() => setIsActivated(!isActivated)}
                className="group relative flex h-12 w-24 items-center rounded-full bg-white/5 p-1 backdrop-blur-md border border-white/10 transition-colors hover:bg-white/10"
                aria-label="Toggle Night Scene"
              >
                <motion.div
                  className="flex h-10 w-10 items-center justify-center rounded-full shadow-2xl"
                  animate={{
                    x: isActivated ? 48 : 0,
                    backgroundColor: isActivated ? "#F44A22" : "#ffffff",
                  }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                >
                  {isActivated ? (
                    <PlayCircle className="h-5 w-5 text-black" fill="currentColor" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-black animate-pulse" />
                  )}
                </motion.div>

                {isActivated && (
                  <div className="absolute inset-0 rounded-full shadow-[0_0_20px_rgba(244,74,34,0.4)] pointer-events-none" />
                )}
              </button>
            </motion.div>

            {/* APP CTA BUTTONS */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="flex flex-col sm:flex-row gap-5 items-center justify-center"
            >
              <MagneticButton
                onClick={() => alert("The C1rcle App is coming soon to the App Store!")}
                className="group relative px-8 py-4 bg-white text-black rounded-full font-black text-sm md:text-base uppercase tracking-wider hover:scale-105 transition-all duration-300 min-w-[200px] flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(255,255,255,0.3)]"
              >
                <Apple size={20} fill="currentColor" />
                <span>App Store</span>
              </MagneticButton>

              <MagneticButton
                onClick={() => alert("The C1rcle App is coming soon to the Play Store!")}
                className="group relative px-8 py-4 bg-black/40 backdrop-blur-md border border-white/20 !text-white rounded-full font-black text-sm md:text-base uppercase tracking-wider hover:bg-white hover:!text-black transition-all duration-300 min-w-[200px] flex items-center justify-center gap-3"
              >
                <PlayCircle size={20} />
                <span className="text-white group-hover:text-black">Play Store</span>
              </MagneticButton>
            </motion.div>
          </div>
        </div>
      </section>
    </>
  );
};

const MagneticButton = ({ children, className = "" }) => {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const handleMouseMove = (e) => {
    const { clientX, clientY } = e;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    x.set((clientX - centerX) * 0.3);
    y.set((clientY - centerY) * 0.3);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x, y }}
      className={`relative group ${className}`}
      suppressHydrationWarning
    >
      {children}
    </motion.button>
  );
};

// ── SVG PRIMITIVES ──────────────────────────────────────────────────
const Sparkle = ({ size = 16, style = {}, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" style={style} className={className} aria-hidden="true">
    <path d="M8 0L9.2 6.8L16 8L9.2 9.2L8 16L6.8 9.2L0 8L6.8 6.8L8 0Z" />
  </svg>
);
const HeartSvg = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.27 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.08C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.77-3.4 6.86-8.55 11.53L12 21.35z"/>
  </svg>
);
const FlameSvg = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 2C9.82 4.18 9 7.5 10.5 10c-1.5-.5-2.5-2-2.5-2C6.5 11 6 13.5 7.5 16c-2-1-3.5-4-2-7C3 11.5 2 15 3 18c1 3 4 5 9 5s8-2 9-5c1.5-4.5-1-9-3.5-11-.5 2-2 3.5-2 3.5.5-2.5-.5-5.5-3.5-8.5z"/>
  </svg>
);
const HeartbeatLine = () => (
  <svg viewBox="0 0 320 50" fill="none" className="w-full h-10 opacity-70" aria-hidden="true">
    <path d="M0,25 L50,25 L65,8 L80,42 L95,12 L110,38 L125,25 L320,25" stroke="#F44A22" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const CitySkyline = () => (
  <svg viewBox="0 0 500 80" fill="none" className="w-full" aria-hidden="true">
    {[[10,45,18,35],[35,30,25,50],[40,20,14,12],[90,35,30,45],[96,25,18,12],[148,40,22,40],[178,28,28,52],[184,18,16,12],[238,36,24,44],[292,32,26,48],[298,22,14,12],[352,30,22,50],[406,38,24,42],[460,34,28,46],[466,24,16,12]].map(([x,y,w,h], i) => (
      <rect key={i} x={x} y={y} width={w} height={h} fill="white" rx="1" opacity={0.08 + (i % 3) * 0.03}/>
    ))}
  </svg>
);

// ── MARQUEE STRIP ────────────────────────────────────────────────────
const MarqueeStrip = () => {
  const items = ["DISCOVER", "DATES", "CHATS", "TICKETS", "HEAT MAP", "FREE FOREVER", "INDIA'S NIGHTLIFE APP", "NO FEES", "EARLY ACCESS"];
  return (
    <div className="overflow-hidden bg-[#F44A22] py-3">
      <style>{`@keyframes c1marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
      <div className="flex whitespace-nowrap" style={{ animation: "c1marquee 26s linear infinite" }}>
        {[0, 1].map((rep) => (
          <div key={rep} className="flex items-center shrink-0">
            {items.map((item) => (
              <span key={`${rep}-${item}`} className="flex items-center gap-2 px-5 text-black font-black uppercase tracking-widest text-[11px]">
                <span className="w-1 h-1 rounded-full bg-black/40" />
                {item}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── DOWNLOAD CTA ─────────────────────────────────────────────────────
const DownloadCTA = ({ className = "" }) => (
  <div className={`flex flex-wrap gap-3 ${className}`}>
    <a href="https://apps.apple.com/app/the-c1rcle" target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-full text-xs font-black uppercase tracking-wider hover:bg-gray-100 transition-colors">
      <Apple size={14} fill="currentColor" /> App Store
    </a>
    <a href="https://play.google.com/store/apps/details?id=com.thec1rcle" target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-2 px-5 py-2.5 border border-white/20 text-white rounded-full text-xs font-black uppercase tracking-wider hover:bg-white/10 transition-colors">
      <PlayCircle size={14} /> Play Store
    </a>
  </div>
);

// ── SOCIAL PROOF TOAST ───────────────────────────────────────────────
const SocialProofToast = () => {
  const toasts = [
    { name: "Priya S.", city: "Mumbai", action: "just downloaded" },
    { name: "Arjun K.", city: "Pune", action: "joined the waitlist" },
    { name: "82 people", city: "", action: "signed up this hour" },
    { name: "Riya M.", city: "Delhi", action: "found her +1" },
  ];
  const [idx, setIdx] = useState(0);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const first = setTimeout(() => setShow(true), 5000);
    const interval = setInterval(() => {
      setShow(false);
      setTimeout(() => { setIdx(i => (i + 1) % toasts.length); setShow(true); }, 700);
    }, 6000);
    return () => { clearTimeout(first); clearInterval(interval); };
  }, []);
  const t = toasts[idx];
  return (
    <AnimatePresence>
      {show && (
        <motion.div key={idx}
          initial={{ opacity: 0, x: -24, scale: 0.92 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -16, scale: 0.96 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-6 left-6 z-50 flex items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl pointer-events-none"
          style={{ background: "rgba(16,16,20,0.96)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs text-white shrink-0" style={{ background: "rgba(244,74,34,0.25)" }}>{t.name[0]}</div>
          <div className="min-w-0">
            <div className="text-white text-sm font-bold leading-tight">{t.name}{t.city && <span className="text-white/40 font-normal text-xs"> · {t.city}</span>}</div>
            <div className="text-white/50 text-xs">{t.action}</div>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-[#F44A22] animate-pulse shrink-0 ml-1" />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ── SECTIONS ──────────────────────────────────────────────────────────
const PulseSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const lines = ["THE NIGHT", "LIVES IN", "YOUR POCKET"];

  return (
    <section ref={ref} className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black">
      <div className="absolute bottom-0 left-0 w-[60vw] h-[60vw] pointer-events-none" style={{ background: "radial-gradient(circle, rgba(244,74,34,0.22) 0%, transparent 70%)", transform: "translate(-20%, 30%)" }} />
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] pointer-events-none" style={{ background: "radial-gradient(circle, rgba(120,80,255,0.18) 0%, transparent 70%)", transform: "translate(20%, -20%)" }} />

      {/* Sparkle decorations */}
      <Sparkle size={12} className="absolute top-[22%] left-[11%] text-[#F44A22] opacity-70 animate-pulse" />
      <Sparkle size={8}  className="absolute top-[38%] left-[7%]  text-white opacity-25 animate-pulse" style={{ animationDelay: "0.5s" }} />
      <Sparkle size={15} className="absolute top-[15%] right-[13%] text-violet-400 opacity-50 animate-pulse" style={{ animationDelay: "1s" }} />
      <Sparkle size={9}  className="absolute bottom-[28%] right-[8%] text-[#F44A22] opacity-40 animate-pulse" style={{ animationDelay: "1.5s" }} />
      <Sparkle size={7}  className="absolute bottom-[18%] left-[21%] text-white opacity-20 animate-pulse" style={{ animationDelay: "0.8s" }} />
      <Sparkle size={11} className="absolute top-[55%] right-[22%] text-amber-400 opacity-30 animate-pulse" style={{ animationDelay: "1.2s" }} />

      {/* Dot grids */}
      <svg className="absolute top-8 left-8 opacity-[0.06] pointer-events-none" width="100" height="100" aria-hidden="true">
        {Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => <circle key={`${r}-${c}`} cx={c*24+12} cy={r*24+12} r="1.5" fill="white"/>))}
      </svg>
      <svg className="absolute bottom-8 right-8 opacity-[0.06] pointer-events-none" width="100" height="100" aria-hidden="true">
        {Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => <circle key={`${r}-${c}`} cx={c*24+12} cy={r*24+12} r="1.5" fill="white"/>))}
      </svg>

      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
        {/* Rating badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 mb-5 px-4 py-2 rounded-full border border-white/10"
          style={{ background: "rgba(255,255,255,0.05)" }}
        >
          <span className="text-amber-400 text-xs">★★★★★</span>
          <span className="text-white/60 text-xs font-bold">4.9 · 2,400+ ratings</span>
        </motion.div>

        <motion.span
          initial={{ opacity: 0, y: 8 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay: 0.05 }}
          className="block text-white/40 text-xs font-bold uppercase tracking-[0.4em] mb-5"
        >
          The C1rcle App
        </motion.span>

        {lines.map((line, i) => (
          <div key={line} className="overflow-hidden">
            <motion.h2
              initial={{ opacity: 0, y: 60 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.9, delay: 0.1 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="block font-black text-white leading-[0.85] tracking-tighter uppercase"
              style={{ fontSize: "clamp(2.4rem, 9vw, 7.5rem)" }}
            >
              {line}
            </motion.h2>
          </div>
        ))}

        <motion.p
          initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
          className="mt-7 text-white/50 text-base md:text-lg font-light tracking-wide max-w-lg mx-auto"
        >
          Events, connections, tickets, and real-time city pulse — all in one place.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, delay: 0.65 }}
          className="mt-8 flex flex-col items-center gap-4"
        >
          <div className="flex items-center gap-2 text-white/40 text-sm">
            <div className="flex -space-x-2">
              {["#F44A22","#7C3AED","#0EA5E9","#10B981"].map((c,i) => <div key={i} className="w-6 h-6 rounded-full border-2 border-black" style={{ background: c }} />)}
            </div>
            <span>Join <span className="text-white font-bold">12,847</span> others on the waitlist</span>
          </div>
          <DownloadCTA />
          <span className="text-white/25 text-[10px] uppercase tracking-widest">Free · No credit card · No hidden fees</span>
        </motion.div>
      </div>
    </section>
  );
};

const DiscoverSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  const mockEvents = [
    { name: "SUBCULTURE", venue: "Kitty Su, Mumbai", time: "11 PM", fill: 78, heat: 94, color: "from-indigo-900 to-black" },
    { name: "LAPSUS", venue: "Bluefrog, Pune", time: "10 PM", fill: 62, heat: 71, color: "from-violet-950 to-black" },
    { name: "NIGHT RITUAL", venue: "KYGO, Bengaluru", time: "12 AM", fill: 91, heat: 98, color: "from-orange-950 to-black" },
  ];

  return (
    <section ref={ref} className="relative min-h-screen flex items-center overflow-hidden py-24" style={{ background: "#050508" }}>
      {/* Subtle grid background */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.025] pointer-events-none" aria-hidden="true">
        <defs>
          <pattern id="disc-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.8"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#disc-grid)" />
      </svg>
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] pointer-events-none" style={{ background: "radial-gradient(circle, rgba(30,60,200,0.15) 0%, transparent 70%)", transform: "translate(20%, -20%)" }} />
      <Sparkle size={10} className="absolute bottom-[20%] left-[6%] text-indigo-400 opacity-30 animate-pulse" />
      <Sparkle size={7}  className="absolute top-[30%] left-[4%] text-white opacity-15 animate-pulse" style={{ animationDelay: "0.9s" }} />

      <div className="max-w-7xl mx-auto px-6 w-full grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <motion.span
            initial={{ opacity: 0, x: -20 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-1.5 text-[#F44A22] text-xs font-bold uppercase tracking-[0.4em]"
          >
            <FlameSvg size={11} /> 01 — Discover
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 40 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="mt-4 font-black text-white leading-[0.85] tracking-tighter uppercase"
            style={{ fontSize: "clamp(2rem, 5.5vw, 5rem)" }}
          >
            FIND<br />YOUR<br />NIGHT.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.8, delay: 0.25 }}
            className="mt-6 text-white/50 text-base md:text-lg leading-relaxed max-w-md font-light"
          >
            AI-curated events ranked by heat score. Real-time crowd data. Every night, sorted by what's actually worth going to.
          </motion.p>

          {/* Feature tags */}
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, delay: 0.38 }}
            className="mt-5 flex flex-wrap gap-2"
          >
            {[{ e: "🔥", l: "Heat Score" }, { e: "📍", l: "Real-time" }, { e: "✨", l: "AI Curated" }, { e: "🗺️", l: "City Map" }].map((f) => (
              <span key={f.l} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white/60 border border-white/10" style={{ background: "rgba(255,255,255,0.04)" }}>
                {f.e} {f.l}
              </span>
            ))}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, delay: 0.5 }} className="mt-7">
            <DownloadCTA />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 60 }} animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex justify-center lg:justify-end"
        >
          <div className="relative w-64 sm:w-72">
            {/* Glow behind phone */}
            <div className="absolute -inset-6 rounded-[3rem] pointer-events-none" style={{ background: "radial-gradient(circle, rgba(30,60,200,0.35) 0%, transparent 70%)", filter: "blur(24px)", opacity: 0.5 }} />
            <div className="relative bg-[#0a0a0f] border border-white/10 rounded-[2.5rem] overflow-hidden" style={{ boxShadow: "0 40px 80px rgba(0,0,0,0.8), 0 0 80px rgba(30,60,200,0.15)" }}>
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-20 h-1.5 bg-white/10 rounded-full" />
              </div>
              <div className="px-4 pb-6 pt-2 space-y-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[9px] text-white/30 uppercase tracking-widest font-bold">TONIGHT IN MUMBAI</div>
                  <div className="flex items-center gap-1 text-[9px] text-[#F44A22] font-bold">
                    <div className="w-1 h-1 rounded-full bg-[#F44A22] animate-pulse" /> LIVE
                  </div>
                </div>
                {mockEvents.map((ev, i) => (
                  <motion.div
                    key={ev.name}
                    initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6, delay: 0.4 + i * 0.1 }}
                    style={{ transform: i === 0 ? "rotate(-1deg)" : i === 2 ? "rotate(0.5deg)" : "none" }}
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
                        <div className="h-full bg-[#F44A22] rounded" style={{ width: `${ev.fill}%` }} />
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

const DatesSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  const profiles = [
    { name: "ARYA S.", tag: "Going to SUBCULTURE", match: 94, color: "from-rose-900 to-pink-950", rotation: "-6deg", x: "58%", y: "6%" },
    { name: "KARAN V.", tag: "Looking for +1", match: 88, color: "from-violet-900 to-purple-950", rotation: "4deg", x: "50%", y: "52%" },
    { name: "MAYA R.", tag: "Attending LAPSUS", match: 97, color: "from-fuchsia-900 to-pink-950", rotation: "-2deg", x: "68%", y: "33%" },
  ];

  return (
    <section ref={ref} className="relative min-h-screen flex items-center overflow-hidden py-24 bg-black">
      {/* Dot grid */}
      <svg className="absolute bottom-10 right-10 opacity-[0.05] pointer-events-none" width="140" height="140" aria-hidden="true">
        {Array.from({ length: 7 }, (_, r) => Array.from({ length: 7 }, (_, c) => <circle key={`${r}-${c}`} cx={c*20+10} cy={r*20+10} r="1.5" fill="white"/>))}
      </svg>
      {/* Connector SVG between orb and text */}
      <svg className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none opacity-[0.04]" width="200" height="200" aria-hidden="true">
        <circle cx="100" cy="100" r="80" stroke="white" strokeWidth="0.5" fill="none" strokeDasharray="4 8"/>
        <circle cx="100" cy="100" r="50" stroke="white" strokeWidth="0.5" fill="none" strokeDasharray="2 6"/>
      </svg>

      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[55vw] h-[55vw] pointer-events-none" style={{ background: "radial-gradient(circle, rgba(200,30,80,0.14) 0%, transparent 70%)" }} />

      {/* Floating hearts */}
      <HeartSvg size={10} className="absolute top-[18%] right-[36%] text-rose-400 opacity-30 animate-pulse" />
      <HeartSvg size={7}  className="absolute top-[65%] left-[43%] text-rose-300 opacity-20 animate-pulse" style={{ animationDelay: "0.7s" }} />
      <HeartSvg size={14} className="absolute top-[42%] right-[42%] text-pink-400 opacity-20 animate-pulse" style={{ animationDelay: "1.3s" }} />
      <Sparkle  size={8}  className="absolute top-[28%] left-[6%]  text-rose-300 opacity-25 animate-pulse" style={{ animationDelay: "0.4s" }} />

      <div className="max-w-7xl mx-auto px-6 w-full relative min-h-[70vh] flex items-center">
        <div className="max-w-lg relative z-10">
          <motion.span
            initial={{ opacity: 0, x: -20 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-1.5 text-rose-400 text-xs font-bold uppercase tracking-[0.4em]"
          >
            <HeartSvg size={11} /> 02 — Dates
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 40 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="mt-4 font-black text-white leading-[0.85] tracking-tighter uppercase"
            style={{ fontSize: "clamp(2rem, 5.5vw, 5rem)" }}
          >
            FIND<br />YOUR<br />PLUS ONE.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.8, delay: 0.25 }}
            className="mt-6 text-white/50 text-base md:text-lg leading-relaxed font-light"
          >
            Match with people attending the same events. Turn strangers into memories.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, delay: 0.38 }}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-rose-500/20"
            style={{ background: "rgba(200,30,80,0.08)" }}
          >
            <HeartSvg size={11} className="text-rose-400" />
            <span className="text-rose-300 text-xs font-bold">8,400+ connections made</span>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, delay: 0.5 }} className="mt-6">
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
              style={{ position: "absolute", left: p.x, top: p.y, boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(200,30,80,0.1)" }}
              className={`w-44 p-4 rounded-3xl bg-gradient-to-b ${p.color} border border-white/10`}
            >
              <div className="w-10 h-10 rounded-full mb-3 border border-white/10 flex items-center justify-center" style={{ background: "rgba(255,255,255,0.1)" }}>
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

const ChatSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  const bubbles = [
    { text: "I'm already at the door 🔥", self: false, delay: 0.3, reactions: null },
    { text: "Where's the group??", self: true, delay: 0.45, reactions: null },
    { text: "TONIGHT IS INSANE", self: false, delay: 0.6, reactions: [{ e: "🔥", n: 12 }, { e: "❤️", n: 8 }] },
    { text: "Just got in, find me at the bar", self: false, delay: 0.75, reactions: null },
    { text: "On my way, 5 mins", self: true, delay: 0.9, reactions: null },
  ];

  return (
    <section ref={ref} className="relative min-h-screen flex items-center overflow-hidden py-24" style={{ background: "#030609" }}>
      {/* Dot grid */}
      <svg className="absolute top-8 left-8 opacity-[0.05] pointer-events-none" width="120" height="120" aria-hidden="true">
        {Array.from({ length: 6 }, (_, r) => Array.from({ length: 6 }, (_, c) => <circle key={`${r}-${c}`} cx={c*24+12} cy={r*24+12} r="1.5" fill="white"/>))}
      </svg>
      <div className="absolute bottom-0 right-0 w-[50vw] h-[50vw] pointer-events-none" style={{ background: "radial-gradient(circle, rgba(0,180,160,0.12) 0%, transparent 70%)", transform: "translate(10%, 20%)" }} />

      <div className="max-w-7xl mx-auto px-6 w-full grid lg:grid-cols-2 gap-16 items-center">
        {/* Chat UI */}
        <div className="space-y-2.5 lg:order-1">
          {/* Group header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: 0.15 }}
            className="flex items-center justify-between mb-4 pb-4 border-b border-white/[0.06]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border border-teal-500/30 flex items-center justify-center" style={{ background: "rgba(20,100,80,0.4)" }}>
                <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse" />
              </div>
              <div>
                <div className="text-white font-bold text-sm">SUBCULTURE — Kitty Su</div>
                <div className="text-teal-400/70 text-xs">247 attending tonight</div>
              </div>
            </div>
            {/* Member avatar strip */}
            <div className="flex -space-x-1.5">
              {["#F44A22","#7C3AED","#0EA5E9"].map((c,i) => <div key={i} className="w-6 h-6 rounded-full border border-black" style={{ background: c }} />)}
              <div className="w-6 h-6 rounded-full border border-black flex items-center justify-center text-[8px] text-white font-bold" style={{ background: "#333" }}>+44</div>
            </div>
          </motion.div>

          {bubbles.map((b, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: b.delay, ease: [0.16, 1, 0.3, 1] }}
              className={`flex flex-col ${b.self ? "items-end" : "items-start"}`}
            >
              <div
                className={`px-4 py-2.5 rounded-2xl text-sm font-medium max-w-[75%] ${b.self ? "bg-[#F44A22] text-white rounded-br-sm" : "text-white/80 rounded-bl-sm border border-white/10"}`}
                style={b.self ? {} : { background: "rgba(255,255,255,0.06)", backdropFilter: "blur(10px)" }}
              >
                {b.text}
              </div>
              {b.reactions && (
                <div className="flex gap-1 mt-1">
                  {b.reactions.map((r) => (
                    <span key={r.e} className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] border border-white/10" style={{ background: "rgba(255,255,255,0.04)" }}>
                      {r.e} <span className="text-white/50">{r.n}</span>
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          ))}

          {/* Typing indicator */}
          <motion.div initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ duration: 0.5, delay: 1.1 }} className="flex items-start">
            <div className="px-4 py-3 rounded-2xl rounded-bl-sm border border-white/10 flex items-center gap-1" style={{ background: "rgba(255,255,255,0.06)" }}>
              {[0, 0.2, 0.4].map((d) => (
                <motion.div key={d} className="w-1.5 h-1.5 bg-white/40 rounded-full" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: d }} />
              ))}
            </div>
          </motion.div>
        </div>

        {/* Text */}
        <div className="lg:order-2">
          <motion.span
            initial={{ opacity: 0, x: 20 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6 }}
            className="text-teal-400 text-xs font-bold uppercase tracking-[0.4em]"
          >
            03 — Chats
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 40 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="mt-4 font-black text-white leading-[0.85] tracking-tighter uppercase"
            style={{ fontSize: "clamp(2rem, 5.5vw, 5rem)" }}
          >
            THE<br />PREGAME<br />STARTS<br />HERE.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.8, delay: 0.25 }}
            className="mt-6 text-white/50 text-base md:text-lg leading-relaxed font-light max-w-md"
          >
            Auto-created group chats for every event. Private DMs. Live reactions. From pregame to afterparty.
          </motion.p>
          {/* Live counter */}
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, delay: 0.4 }}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-teal-500/20 w-fit"
            style={{ background: "rgba(0,180,160,0.06)" }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-teal-300 text-xs font-bold">34 people chatting right now</span>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const TicketsSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} className="relative min-h-screen flex items-center justify-center overflow-hidden py-24 bg-black">
      {/* Amber radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70vw] h-[70vw] pointer-events-none" style={{ background: "radial-gradient(circle, rgba(255,180,30,0.12) 0%, transparent 65%)" }} />

      {/* Circuit-board SVG background */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="circuit" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M40 0 L40 30 M40 50 L40 80 M0 40 L30 40 M50 40 L80 40" stroke="white" strokeWidth="0.8" fill="none"/>
            <circle cx="40" cy="40" r="4" fill="none" stroke="white" strokeWidth="0.8"/>
            <circle cx="40" cy="0" r="2" fill="white" opacity="0.6"/>
            <circle cx="40" cy="80" r="2" fill="white" opacity="0.6"/>
            <circle cx="0" cy="40" r="2" fill="white" opacity="0.6"/>
            <circle cx="80" cy="40" r="2" fill="white" opacity="0.6"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#circuit)"/>
      </svg>

      <div className="max-w-5xl mx-auto px-6 w-full text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-center gap-2 mb-4"
        >
          <span className="text-amber-400 text-xs font-bold uppercase tracking-[0.4em]">04 — Tickets</span>
          <span className="px-2 py-0.5 bg-amber-400/10 border border-amber-400/20 rounded-full text-amber-300 text-[10px] font-bold uppercase tracking-wider">New</span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="font-black text-white leading-[0.85] tracking-tighter uppercase"
          style={{ fontSize: "clamp(2rem, 6.5vw, 6rem)" }}
        >
          BUY. SHARE.<br />
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
          style={{ boxShadow: "0 40px 80px rgba(0,0,0,0.8), 0 0 60px rgba(255,180,30,0.18)" }}
        >
          {/* Shimmer overlay */}
          <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none z-10">
            <motion.div
              className="absolute inset-0"
              style={{ background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%)" }}
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
            />
          </div>
          <div className="border border-amber-400/20 rounded-3xl overflow-hidden flex" style={{ background: "#0d0d10" }}>
            <div className="flex-1 p-6 text-left">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[#F44A22] text-[10px] font-bold uppercase tracking-widest">THE C1RCLE · TICKET</div>
                <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-400/10 border border-emerald-400/30 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-emerald-300 text-[9px] font-bold uppercase tracking-wider">Verified ✓</span>
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
                {[3,1,4,1,5,2,3,1,2,4,1,3,2,1,4,2,3,1,2,1,3,4,1,2,3,1,2,1,4,3,1,2].map((w, i) => (
                  <div key={i} className="bg-white/30 rounded-[1px]" style={{ width: w === 4 ? 3 : w === 3 ? 2 : 1, height: i % 5 === 0 ? "100%" : "70%" }} />
                ))}
              </div>
            </div>
            <div className="border-l border-dashed border-white/10 self-stretch" />
            <div className="w-20 flex flex-col items-center justify-center p-4 gap-3">
              <div className="w-12 h-12 border border-amber-400/20 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,180,30,0.05)" }}>
                <div className="grid grid-cols-3 gap-0.5">
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="w-1.5 h-1.5 bg-amber-300/50 rounded-[1px]" />
                  ))}
                </div>
              </div>
              <div className="text-white/20 text-[8px] font-bold uppercase tracking-wider" style={{ writingMode: "vertical-lr" }}>C1RCLE</div>
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
          {["⚡ Instant Delivery", "🔗 Share with Friends", "🔒 Secure Entry", "0️⃣ No Hidden Fees"].map((chip) => (
            <div key={chip} className="px-4 py-2 border border-white/10 rounded-full text-white/60 text-xs font-bold uppercase tracking-wider" style={{ background: "rgba(255,255,255,0.04)" }}>
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

const LiveSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const cities = ["Mumbai", "Pune", "Delhi", "Bengaluru", "Goa", "Hyderabad"];
  const statCards = [
    { label: "Events live tonight", value: "47", color: "#F44A22" },
    { label: "Cities covered", value: "18", color: "#a855f7" },
    { label: "Users online now", value: "3.2K", color: "#10b981" },
  ];

  return (
    <section ref={ref} className="relative min-h-screen flex items-center justify-center overflow-hidden py-24 bg-black">
      {/* Pulse rings */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ width: 80 + i * 160, height: 80 + i * 160, border: "1px solid rgba(244,74,34,0.25)" }}
            animate={{ scale: [1, 2.2], opacity: [0.5, 0] }}
            transition={{ duration: 3, repeat: Infinity, delay: i * 0.9, ease: "easeOut" }}
          />
        ))}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-[#F44A22] rounded-full"
          style={{ boxShadow: "0 0 24px rgba(244,74,34,0.9), 0 0 60px rgba(244,74,34,0.4)" }}
        />
      </div>

      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto w-full">
        <motion.span
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6 }}
          className="text-[#F44A22] text-xs font-bold uppercase tracking-[0.4em]"
        >
          05 — Live
        </motion.span>

        <motion.h2
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 font-black text-white leading-[0.85] tracking-tighter uppercase"
          style={{ fontSize: "clamp(2.5rem, 8vw, 7rem)" }}
        >
          THE CITY<br />NEVER<br />STOPS.
        </motion.h2>

        {/* Heartbeat line */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={inView ? { opacity: 1, scaleX: 1 } : {}}
          transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 origin-left"
        >
          <HeartbeatLine />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.35 }}
          className="mt-6 text-white/50 text-lg font-light max-w-lg mx-auto"
        >
          Real-time crowd density. See what&apos;s alive right now. Go where the energy is.
        </motion.p>

        {/* Stat cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.45 }}
          className="mt-10 grid grid-cols-3 gap-3 max-w-lg mx-auto"
        >
          {statCards.map((s) => (
            <div key={s.label} className="p-4 rounded-2xl border border-white/10 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="font-black text-2xl" style={{ color: s.color }}>{s.value}</div>
              <div className="text-white/40 text-[10px] font-bold uppercase tracking-wider mt-1">{s.label}</div>
            </div>
          ))}
        </motion.div>

        {/* City chips */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.55 }}
          className="mt-6 flex flex-wrap justify-center gap-2"
        >
          {cities.map((city) => (
            <div key={city} className="flex items-center gap-1.5 px-3 py-1.5 border border-white/10 rounded-full text-white/50 text-xs font-bold" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-[#F44A22]" style={{ boxShadow: "0 0 6px rgba(244,74,34,0.8)" }} />
              {city}
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mt-10"
        >
          <DownloadCTA className="justify-center" />
        </motion.div>

        {/* City skyline at bottom */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 1.2, delay: 0.8 }}
          className="mt-16"
        >
          <CitySkyline />
        </motion.div>
      </div>
    </section>
  );
};

export default function AppMarketingExperience() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <AppMarketingLikeGate />
      <SocialProofToast />
      <div className="relative bg-[var(--bg-color)] text-[var(--text-primary)] selection:bg-[#F44A22] selection:text-black transition-colors duration-500 overflow-x-hidden">

        {/* --- HERO --- */}
        <BillboardHero />

        {/* --- MARKETING SECTIONS --- */}
        <PulseSection />
        <MarqueeStrip />
        <DiscoverSection />
        <DatesSection />
        <ChatSection />
        <TicketsSection />
        <LiveSection />

        {/* --- CTA --- */}
        <AppWaitlistSection />
      </div>
    </Suspense>
  );
}
