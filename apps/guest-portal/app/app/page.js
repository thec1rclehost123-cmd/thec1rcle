'use client';

import { useState, useRef, Suspense, useEffect } from 'react';
import { motion, useScroll, useTransform, useMotionValue, useSpring, useMotionTemplate, useInView, AnimatePresence } from 'framer-motion';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { X, Heart, Download, Apple, PlayCircle, ChevronRight, QrCode } from 'lucide-react';
import { addDoc, collection } from "firebase/firestore";
import { getFirebaseDb } from "../../lib/firebase/client";
import { trackEvent } from '../../lib/utils/analytics';

import { useTheme } from 'next-themes';
import Head from 'next/head';

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="h-screen w-full bg-black" />;

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
    >
      {children}
    </motion.button>
  );
};

const FeatureCard = ({ title, subtitle, video, index, align }) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.9, 1, 0.9]);
  const opacity = useTransform(scrollYProgress, [0, 0.15, 0.85, 1], [0, 1, 1, 0]);

  return (
    <section ref={ref} className="min-h-[50vh] flex items-center justify-center py-24 relative overflow-hidden">
      {/* Background Glow */}
      <div className={`absolute top-1/2 ${align === 'left' ? 'left-0' : 'right-0'} w-[50vw] h-[50vw] bg-[#F44A22] rounded-full blur-[150px] opacity-10 pointer-events-none`} />

      <div className="max-w-7xl w-full px-6 grid lg:grid-cols-2 gap-20 items-center relative z-10">

        {/* Text Content */}
        <motion.div
          style={{ opacity, x: align === 'left' ? -50 : 50 }}
          className={`flex flex-col ${align === 'right' ? 'lg:order-2 lg:items-end lg:text-right' : 'lg:items-start text-left'}`}
        >
          <div className="flex items-center gap-4 mb-6">
            <span className="text-[#F44A22] font-mono text-xl">0{index}</span>
            <div className="h-[1px] w-20 bg-white/20" />
          </div>

          <h2 className="text-5xl sm:text-7xl md:text-9xl font-black text-white mb-8 leading-[0.85] tracking-tighter uppercase">
            {title}
          </h2>

          <p className="text-xl md:text-2xl text-white/60 max-w-lg leading-relaxed font-light mb-12">
            {subtitle}
          </p>

          <Link href="/explore">
            <MagneticButton className="px-8 py-4 border border-white/20 rounded-full overflow-hidden">
              <div className="absolute inset-0 bg-white translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              <span className="relative z-10 text-white group-hover:text-black font-bold uppercase tracking-widest text-sm transition-colors duration-300">
                Experience It
              </span>
            </MagneticButton>
          </Link>
        </motion.div>

        {/* Visual Card */}
        <motion.div
          style={{ scale, y }}
          className={`relative aspect-[4/5] ${align === 'right' ? 'lg:order-1' : ''}`}
        >
          <div className="absolute inset-0 bg-black rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl group">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 z-10" />

            <video
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700 ease-out"
            >
              <source src={video} type="video/mp4" />
            </video>

            {/* Floating UI Elements */}
            <div className="absolute bottom-8 left-8 right-8 z-20 transform translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-500">
              <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white font-bold uppercase tracking-wider text-sm">Live Status</span>
                  <div className="w-2 h-2 bg-[#F44A22] rounded-full animate-pulse" />
                </div>
                <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full w-2/3 bg-[#F44A22]" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
};

const GridSection = ({ title, subtitle, number }) => {
  return (
    <section className="min-h-[80vh] flex items-center justify-center py-24 relative overflow-hidden bg-white selection:bg-black selection:text-white">
      {/* Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />

      <div className="max-w-7xl w-full px-6 grid lg:grid-cols-2 gap-12 items-center relative z-10">

        {/* Content */}
        <div className="flex flex-col items-start text-left lg:order-1">
          <div className="flex items-center gap-4 mb-6">
            <span className="text-black font-mono text-xl">0{number}</span>
            <div className="h-[1px] w-20 bg-black/20" />
            <span className="px-3 py-1 border border-black/10 bg-black/5 rounded-full text-xs font-bold uppercase tracking-wider text-black/60">
              Identity Layer
            </span>
          </div>

          <div className="relative mb-8 group">
            <div className="absolute inset-0 bg-[#F44A22] translate-x-2 translate-y-2 transition-transform duration-300 group-hover:translate-x-4 group-hover:translate-y-4" />
            <div className="relative bg-black text-white px-8 py-4">
              <h2 className="text-6xl sm:text-8xl md:text-9xl font-black tracking-tighter uppercase leading-[0.8]">
                {title}
              </h2>
            </div>
          </div>

          <p className="text-xl text-black/60 max-w-lg leading-relaxed font-medium mb-10">
            {subtitle}
          </p>

          <Link href="/explore">
            <button className="relative bg-[#2a5bf5] text-white px-10 py-5 rounded-full font-bold uppercase tracking-widest text-sm hover:bg-[#1a4bd5] transition-all duration-300 shadow-xl hover:shadow-2xl hover:-translate-y-1 flex items-center gap-2 group">
              Get Access
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </Link>
        </div>

        {/* Visual - Astronaut/Floaty Element */}
        <div className="relative h-[50vh] flex items-center justify-center lg:order-2">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="relative z-10"
          >
            <img
              src="https://images.unsplash.com/photo-1614726365723-49cfae92782f?auto=format&fit=crop&q=80&w=1000"
              alt="Astronaut"
              className="w-full max-w-md object-contain drop-shadow-2xl mix-blend-darken filter contrast-125"
            />
          </motion.div>

          {/* Geometric Decors */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] border border-black/5 rounded-full animate-[spin_30s_linear_infinite]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100%] h-[100%] border border-black/10 rounded-full animate-[spin_20s_linear_infinite_reverse] border-dashed" />

          {/* Floating Elements */}
          <motion.div
            animate={{ y: [0, -20, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-0 right-10 bg-white p-4 rounded-xl shadow-xl border border-black/5 z-20"
          >
            <QrCode className="w-8 h-8 text-black" />
          </motion.div>

          <motion.div
            animate={{ y: [0, 30, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute bottom-10 left-10 bg-black text-white px-4 py-2 rounded-lg shadow-xl z-20 font-mono text-xs"
          >
            ACCESS GRANTED
          </motion.div>
        </div>

      </div>
    </section>
  );
};

const ManifestoLine = ({ children, className = "" }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-10% 0px -10% 0px" });

  return (
    <motion.p
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.p>
  );
};

const AppLikeGate = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const reason = searchParams.get("reason");
  const eventId = searchParams.get("eventId");
  const returnTo = searchParams.get("returnTo") || "/events";
  const [isOpen, setIsOpen] = useState(reason === "like");

  useEffect(() => {
    if (reason === "like") {
      trackEvent("app_like_gate_viewed", { eventId, reason: "like" });
    }
  }, [reason, eventId]);

  const closeModal = () => {
    setIsOpen(false);
    trackEvent("app_gate_dismissed", { eventId, method: "x" });
    setTimeout(() => {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
      router.push(returnTo);
    }, 300);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={closeModal}
        className="absolute inset-0 bg-black/80 backdrop-blur-xl"
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 30 }}
        className="relative w-full max-w-lg overflow-hidden rounded-[40px] border border-white/10 bg-zinc-900/50 p-8 sm:p-12 shadow-2xl backdrop-blur-2xl"
      >
        <button onClick={closeModal} className="absolute right-8 top-8 text-white/40 hover:text-white transition-colors">
          <X size={24} />
        </button>
        <div className="flex flex-col items-center text-center">
          <div className="mb-10 relative flex h-24 w-24 items-center justify-center rounded-[32px] bg-white/5 border border-white/10">
            <Heart size={42} className="text-white fill-white/10" />
            <div className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-white flex items-center justify-center text-black">
              <Download size={14} />
            </div>
          </div>
          <h1 className="mb-4 text-3xl font-display uppercase tracking-widest text-white">Download to like</h1>
          <p className="mb-10 text-base text-white/50 max-w-xs">
            Likes live in the app. Download it to like events and see everyone who’s interested.
          </p>
          <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              onClick={() => {
                trackEvent("app_download_clicked", { eventId, platform: "ios" });
                window.open("https://apps.apple.com/app/the-c1rcle", "_blank");
              }}
              className="flex items-center justify-center gap-3 rounded-2xl bg-white py-4 text-sm font-bold uppercase tracking-widest text-black transition hover:bg-zinc-200"
            >
              <Apple size={20} fill="currentColor" /> App Store
            </button>
            <button
              onClick={() => {
                trackEvent("app_download_clicked", { eventId, platform: "android" });
                window.open("https://play.google.com/store/apps/details?id=com.thec1rcle", "_blank");
              }}
              className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 py-4 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-white/10"
            >
              <PlayCircle size={20} /> Play Store
            </button>
          </div>
          <button onClick={closeModal} className="mt-8 text-xs font-bold uppercase tracking-[0.3em] text-white/30 hover:text-white transition-colors">
            Continue Browsing
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default function AppPage() {
  const [email, setEmail] = useState('');
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (email) {
      setLoading(true);
      try {
        const db = getFirebaseDb();
        await addDoc(collection(db, "waitlist"), {
          email,
          joinedAt: new Date().toISOString(),
          source: "app_page"
        });
        setJoined(true);
        setEmail('');
        setTimeout(() => setJoined(false), 5000);
      } catch (error) {
        console.error("Error joining waitlist:", error);
        alert("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    }
  };

  const scrollToWaitlist = () => {
    document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <AppLikeGate />
      <div className="bg-[var(--bg-color)] text-[var(--text-primary)] selection:bg-[#F44A22] selection:text-black transition-colors duration-500 overflow-x-hidden">

        {/* --- HERO --- */}
        <BillboardHero />

        {/* --- MANIFESTO --- */}
        <section className="py-32 px-6 bg-[var(--surface-1)] relative overflow-hidden transition-colors duration-500">
          <div className="max-w-5xl mx-auto text-center relative z-10">
            <ManifestoLine className="text-4xl md:text-6xl font-black leading-tight text-[var(--text-primary)] uppercase">
              "The night is not just a time.<br />
              It's a <span className="text-[#F44A22]">place</span>."
            </ManifestoLine>
            <ManifestoLine className="mt-12 text-xl text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed font-light">
              We are rewriting the code of social interaction. No more guessing. No more waiting. Just pure, unfiltered connection with the people and places that match your energy.
            </ManifestoLine>
          </div>
        </section>

        {/* --- FEATURES --- */}
        <FeatureCard
          index={1}
          title="THE HEAT"
          subtitle="Real-time crowd density maps. See where the city is alive before you even leave your house."
          video={VIDEOS.heatmap}
          align="left"
        />

        <FeatureCard
          index={2}
          title="THE SCAN"
          subtitle="Augmented reality social discovery. Point your phone to see who's who. Connect on vibe instantly."
          video={VIDEOS.scanner}
          align="right"
        />

        <GridSection
          number="03"
          title="THE KEY"
          subtitle="Your digital identity is your access pass. Skip lines, unlock VIP areas, and own the night."
        />

        {/* --- CTA --- */}
        <section id="waitlist" className="relative h-screen flex items-center justify-center bg-[#F44A22] overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-40 mix-blend-overlay" />

          <div className="relative z-10 max-w-4xl w-full px-6 text-center">
            <h2 className="text-[12vw] font-black text-black leading-[0.8] tracking-tighter mb-12 uppercase">
              GET IN<br />THE C1RCLE
            </h2>

            {joined ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-black p-8 rounded-3xl shadow-2xl inline-block"
              >
                <span className="text-white font-black text-2xl uppercase tracking-wider">Welcome to the list.</span>
              </motion.div>
            ) : (
              <form onSubmit={handleJoin} className="bg-black p-2 sm:p-4 rounded-[2rem] sm:rounded-full flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-0 shadow-2xl transform hover:scale-105 transition-transform duration-300">
                <input
                  type="email"
                  placeholder="ENTER YOUR EMAIL"
                  className="w-full sm:flex-1 bg-transparent text-white px-6 py-4 sm:px-8 focus:outline-none placeholder-white/40 font-bold text-lg sm:text-xl uppercase tracking-wider text-center sm:text-left"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <button type="submit" disabled={loading} className="w-full sm:w-auto bg-white text-black px-8 py-4 sm:px-12 sm:py-6 rounded-full font-black uppercase tracking-wider hover:bg-gray-200 transition-colors text-lg whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? "Joining..." : "Join Now"}
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </Suspense>
  );
}
